package main

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/andrewkim-gif/snake/server/internal/game"
	"github.com/andrewkim-gif/snake/server/internal/ws"
)

// ============================================================
// Phase 6 — Tycoon WebSocket Event Handlers
//
// 타이쿤 클라이언트→서버 이벤트를 TycoonManager의 엔진에 라우팅한다.
//
// Uplink events (C→S):
//   building_purchase, building_bid, attack_order, unit_produce,
//   defense_build, merge_request, trade_order, alliance_action,
//   war_declare, city_subscribe_tycoon, city_unsubscribe_tycoon,
//   income_collect
//
// Downlink events (S→C):
//   building_update, auction_update, territory_update, battle_start,
//   battle_result, army_march, army_arrival, income_settled,
//   trade_match, war_update, alliance_update, tycoon_error
// ============================================================

// registerTycoonEventHandlers는 타이쿤 WS 이벤트를 TycoonManager 엔진에 연결한다.
func registerTycoonEventHandlers(
	router *ws.EventRouter,
	hub *ws.Hub,
	tm *game.TycoonManager,
) {
	if tm == nil {
		slog.Info("TycoonManager not available, skipping tycoon event registration")
		return
	}

	ctx := context.Background()

	// ================================================================
	// building_purchase (C→S): 건물 구매 요청
	// ================================================================
	router.On(ws.EventBuildingPurchase, func(client *ws.Client, data json.RawMessage) {
		var payload ws.BuildingPurchasePayload
		if err := json.Unmarshal(data, &payload); err != nil {
			sendTycoonError(client, "invalid_payload", "building_purchase: "+err.Error())
			return
		}

		// PurchaseBuilding(ctx, buildingID, buyerID, buyerName, price)
		// 가격은 건물에서 자동 결정되므로 0 전달 (서버 내부에서 조회)
		err := tm.Buildings.PurchaseBuilding(ctx, payload.BuildingID, client.ID, client.ID, 0)
		if err != nil {
			sendTycoonError(client, "purchase_failed", err.Error())
			return
		}

		frame, _ := ws.EncodeFrame(ws.EventBuildingUpdate, map[string]string{
			"building_id": payload.BuildingID,
			"status":      "purchased",
			"owner_id":    client.ID,
		})
		client.Send(frame)
	})

	// ================================================================
	// building_bid (C→S): 경매 입찰
	// ================================================================
	router.On(ws.EventBuildingBid, func(client *ws.Client, data json.RawMessage) {
		var payload ws.BuildingBidPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			sendTycoonError(client, "invalid_payload", "building_bid: "+err.Error())
			return
		}

		// PlaceBid(ctx, auctionID, bidderID, bidderName, amount, isNPC)
		result, err := tm.Auction.PlaceBid(ctx, payload.AuctionID, client.ID, client.ID, payload.Amount, false)
		if err != nil {
			sendTycoonError(client, "bid_failed", err.Error())
			return
		}

		// 경매 상태를 모든 구독자에게 브로드캐스트
		frame, _ := ws.EncodeFrame(ws.EventAuctionUpdate, result)
		hub.BroadcastAll(frame)
	})

	// ================================================================
	// attack_order (C→S): 공격 명령 (군대 이동)
	// ================================================================
	router.On(ws.EventAttackOrder, func(client *ws.Client, data json.RawMessage) {
		var payload ws.AttackOrderPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			sendTycoonError(client, "invalid_payload", "attack_order: "+err.Error())
			return
		}

		// MarchArmy(ctx, armyID, targetRegion) — 각 army에 대해 행군 명령
		for _, armyID := range payload.ArmyIDs {
			march, err := tm.Military.MarchArmy(ctx, armyID, payload.TargetRegion)
			if err != nil {
				sendTycoonError(client, "attack_failed", err.Error())
				return
			}

			// 군대 이동을 모든 클라이언트에 알림 (Globe에서 표시)
			frame, _ := ws.EncodeFrame(ws.EventArmyMarch, march)
			hub.BroadcastAll(frame)
		}
	})

	// ================================================================
	// unit_produce (C→S): 유닛 생산
	// ================================================================
	router.On(ws.EventUnitProduce, func(client *ws.Client, data json.RawMessage) {
		var payload ws.UnitProducePayload
		if err := json.Unmarshal(data, &payload); err != nil {
			sendTycoonError(client, "invalid_payload", "unit_produce: "+err.Error())
			return
		}

		// ProduceUnits(ctx, ownerID, unitType, count)
		err := tm.Military.ProduceUnits(ctx, client.ID, game.UnitType(payload.UnitType), payload.Count)
		if err != nil {
			sendTycoonError(client, "produce_failed", err.Error())
			return
		}

		frame, _ := ws.EncodeFrame(ws.EventBuildingUpdate, map[string]any{
			"action":    "unit_produced",
			"unit_type": payload.UnitType,
			"count":     payload.Count,
		})
		client.Send(frame)
	})

	// ================================================================
	// defense_build (C→S): 방어시설 건설
	// ================================================================
	router.On(ws.EventDefenseBuild, func(client *ws.Client, data json.RawMessage) {
		var payload ws.DefenseBuildPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			sendTycoonError(client, "invalid_payload", "defense_build: "+err.Error())
			return
		}

		// BuildDefense(ctx, ownerID, regionCode, defType)
		err := tm.Military.BuildDefense(ctx, client.ID, payload.BuildingID, game.DefenseType(payload.Type))
		if err != nil {
			sendTycoonError(client, "defense_failed", err.Error())
			return
		}

		frame, _ := ws.EncodeFrame(ws.EventBuildingUpdate, map[string]any{
			"action":      "defense_built",
			"building_id": payload.BuildingID,
			"type":        payload.Type,
		})
		client.Send(frame)
	})

	// ================================================================
	// merge_request (C→S): 건물 합병
	// ================================================================
	router.On(ws.EventMergeRequest, func(client *ws.Client, data json.RawMessage) {
		var payload ws.MergeRequestPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			sendTycoonError(client, "invalid_payload", "merge_request: "+err.Error())
			return
		}

		// ExecuteMerge(ctx, ownerID, buildingIDs)
		result, err := tm.Merge.ExecuteMerge(ctx, client.ID, payload.BuildingIDs)
		if err != nil {
			sendTycoonError(client, "merge_failed", err.Error())
			return
		}

		frame, _ := ws.EncodeFrame(ws.EventBuildingUpdate, result)
		client.Send(frame)
	})

	// ================================================================
	// trade_order (C→S): 거래소 주문
	// ================================================================
	router.On(ws.EventTradeOrder, func(client *ws.Client, data json.RawMessage) {
		var payload ws.TradeOrderPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			sendTycoonError(client, "invalid_payload", "trade_order: "+err.Error())
			return
		}

		// sell/buy에 따라 다른 메서드 호출
		switch payload.OrderType {
		case "sell":
			result, err := tm.Trade.CreateSellOrder(ctx, payload.BuildingID, client.ID, client.ID, payload.Price)
			if err != nil {
				sendTycoonError(client, "trade_failed", err.Error())
				return
			}
			frame, _ := ws.EncodeFrame(ws.EventTradeMatch, result)
			client.Send(frame)
		case "buy":
			result, err := tm.Trade.CreateBuyOrder(ctx, payload.BuildingID, client.ID, client.ID, payload.Price)
			if err != nil {
				sendTycoonError(client, "trade_failed", err.Error())
				return
			}
			frame, _ := ws.EncodeFrame(ws.EventTradeMatch, result)
			client.Send(frame)
		default:
			sendTycoonError(client, "trade_failed", "unknown order type: "+payload.OrderType)
		}
	})

	// ================================================================
	// alliance_action (C→S): 동맹 액션 (create/join/leave)
	// ================================================================
	router.On(ws.EventAllianceAction, func(client *ws.Client, data json.RawMessage) {
		var payload ws.AllianceActionPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			sendTycoonError(client, "invalid_payload", "alliance_action: "+err.Error())
			return
		}

		var result any
		var err error

		switch payload.Action {
		case "create":
			result, err = tm.Diplomacy.CreateAlliance(ctx, client.ID, payload.Name)
		case "join":
			err = tm.Diplomacy.JoinAlliance(ctx, payload.AllianceID, client.ID)
			result = map[string]string{"alliance_id": payload.AllianceID, "action": "joined"}
		case "leave":
			err = tm.Diplomacy.LeaveAlliance(ctx, payload.AllianceID, client.ID)
			result = map[string]string{"alliance_id": payload.AllianceID, "action": "left"}
		default:
			sendTycoonError(client, "alliance_failed", "unknown action: "+payload.Action)
			return
		}

		if err != nil {
			sendTycoonError(client, "alliance_failed", err.Error())
			return
		}

		// 동맹 상태를 모든 클라이언트에 브로드캐스트
		frame, _ := ws.EncodeFrame(ws.EventAllianceUpdate, result)
		hub.BroadcastAll(frame)
	})

	// ================================================================
	// war_declare (C→S): 전쟁 선포
	// ================================================================
	router.On(ws.EventWarDeclare, func(client *ws.Client, data json.RawMessage) {
		var payload ws.WarDeclarePayload
		if err := json.Unmarshal(data, &payload); err != nil {
			sendTycoonError(client, "invalid_payload", "war_declare: "+err.Error())
			return
		}

		// DeclareWar(ctx, attackerID, defenderID)
		result, err := tm.Diplomacy.DeclareWar(ctx, client.ID, payload.TargetNation)
		if err != nil {
			sendTycoonError(client, "war_declare_failed", err.Error())
			return
		}

		// 전쟁 선포를 모든 클라이언트에 알림
		frame, _ := ws.EncodeFrame(ws.EventWarUpdate, result)
		hub.BroadcastAll(frame)
	})

	// ================================================================
	// income_collect (C→S): 수익 수확
	// ================================================================
	router.On(ws.EventIncomeCollect, func(client *ws.Client, data json.RawMessage) {
		// SettleIncome(ctx, playerID)
		result, err := tm.Income.SettleIncome(ctx, client.ID)
		if err != nil {
			sendTycoonError(client, "income_failed", err.Error())
			return
		}

		frame, _ := ws.EncodeFrame(ws.EventIncomeSettled, result)
		client.Send(frame)
	})

	// ================================================================
	// city_subscribe_tycoon (C→S): 도시 상세 구독
	// ================================================================
	router.On(ws.EventCitySubscribeTycoon, func(client *ws.Client, data json.RawMessage) {
		var payload ws.CitySubscribeTycoonPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			sendTycoonError(client, "invalid_payload", "city_subscribe: "+err.Error())
			return
		}

		// Hub의 도시 구독 기능 사용
		hub.SubscribeCity(client.ID, payload.CityCode)

		slog.Debug("tycoon city subscribed",
			"clientId", client.ID,
			"cityCode", payload.CityCode,
		)
	})

	// ================================================================
	// city_unsubscribe_tycoon (C→S): 도시 구독 해제
	// ================================================================
	router.On(ws.EventCityUnsubscribeTycoon, func(client *ws.Client, data json.RawMessage) {
		var payload ws.CitySubscribeTycoonPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}

		hub.UnsubscribeCity(client.ID, payload.CityCode)

		slog.Debug("tycoon city unsubscribed",
			"clientId", client.ID,
			"cityCode", payload.CityCode,
		)
	})

	slog.Info("tycoon event handlers registered", "events", 12)
}

// sendTycoonError는 tycoon_error 이벤트를 클라이언트에 전송한다.
func sendTycoonError(client *ws.Client, code, message string) {
	frame, err := ws.EncodeFrame(ws.EventTycoonError, ws.TycoonErrorPayload{
		Code:    code,
		Message: message,
	})
	if err != nil {
		return
	}
	client.Send(frame)
}
