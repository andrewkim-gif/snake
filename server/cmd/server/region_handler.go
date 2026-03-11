package main

import (
	"encoding/json"
	"log/slog"

	"github.com/andrewkim-gif/snake/server/internal/game"
	"github.com/andrewkim-gif/snake/server/internal/ws"
)

// ============================================================
// v39 Phase 4 — Region WebSocket Protocol Extension
//
// This file contains:
//   1. registerRegionEventHandlers() — wires region_* uplink events
//
// Uplink events (C→S, 3):
//   region_join, region_leave, country_regions
//
// Downlink events (S→C, 3):
//   region_joined, region_list, region_state
//
// Wire format: {"e": "event_name", "d": {...}} — same as all WS events.
// ============================================================

// registerRegionEventHandlers registers all region_* event handlers
// on the event router. Called from registerEventHandlers() in main.go.
func registerRegionEventHandlers(
	router *ws.EventRouter,
	hub *ws.Hub,
	regionManager *game.CountryRegionManager,
) {
	if regionManager == nil {
		slog.Warn("region manager not available, skipping region event registration")
		return
	}

	// ================================================================
	// country_regions (C→S): Request region list for a country
	// ================================================================
	router.On(ws.EventCountryRegions, func(client *ws.Client, data json.RawMessage) {
		var payload ws.CountryRegionsPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			slog.Warn("invalid country_regions payload", "clientId", client.ID, "error", err)
			return
		}

		if payload.CountryCode == "" {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "country_regions_failed",
				Message: "countryCode required",
			})
			client.Send(errFrame)
			return
		}

		regions := regionManager.GetRegionList(payload.CountryCode)
		if regions == nil {
			regions = []game.RegionListEntry{}
		}

		response := struct {
			CountryCode string                  `json:"countryCode"`
			Regions     []game.RegionListEntry  `json:"regions"`
		}{
			CountryCode: payload.CountryCode,
			Regions:     regions,
		}

		frame, err := ws.EncodeFrame(ws.EventRegionList, response)
		if err == nil {
			client.Send(frame)
		}

		slog.Debug("country_regions response",
			"clientId", client.ID,
			"countryCode", payload.CountryCode,
			"regionCount", len(regions),
		)
	})

	// ================================================================
	// region_join (C→S): Join a specific region arena
	// ================================================================
	router.On(ws.EventRegionJoin, func(client *ws.Client, data json.RawMessage) {
		var payload ws.RegionJoinPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			slog.Warn("invalid region_join payload", "clientId", client.ID, "error", err)
			return
		}

		if payload.CountryCode == "" || payload.RegionId == "" {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "region_join_failed",
				Message: "countryCode and regionId required",
			})
			client.Send(errFrame)
			return
		}

		req := game.RegionJoinRequest{
			ClientID:    client.ID,
			Name:        client.ID, // 클라이언트 ID를 이름으로 사용 (별도 Name 필드 없음)
			CountryCode: payload.CountryCode,
			RegionId:    payload.RegionId,
			FactionId:   payload.FactionId,
			FactionName: payload.FactionName,
		}

		result := regionManager.JoinRegion(req)

		// Send join result
		frame, err := ws.EncodeFrame(ws.EventRegionJoined, result)
		if err == nil {
			client.Send(frame)
		}

		if result.Success {
			// Move client to region room for broadcasts
			hub.MoveClientToRoom(client.ID, payload.RegionId)

			slog.Info("region_join success",
				"clientId", client.ID,
				"regionId", payload.RegionId,
				"countryCode", payload.CountryCode,
			)
		}
	})

	// ================================================================
	// region_leave (C→S): Leave a region arena
	// ================================================================
	router.On(ws.EventRegionLeave, func(client *ws.Client, data json.RawMessage) {
		regionManager.LeaveRegion(client.ID)
		hub.RegisterLobby(client)

		slog.Info("region_leave",
			"clientId", client.ID,
		)
	})

	slog.Info("v39 region event handlers registered",
		"uplinkEvents", 3,
		"downlinkEvents", 3,
	)
}
