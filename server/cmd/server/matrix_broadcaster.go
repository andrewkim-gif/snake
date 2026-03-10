package main

import (
	"encoding/json"
	"log/slog"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/game"
	"github.com/andrewkim-gif/snake/server/internal/ws"
)

// ============================================================
// v33 Phase 2 — Matrix WebSocket Protocol Extension
//
// This file contains:
//   1. registerMatrixEventHandlers() — wires matrix_* uplink events
//   2. startMatrixBroadcaster() — 20Hz goroutine for matrix downlinks
//
// Uplink events (C→S, 7):
//   matrix_join, matrix_leave, matrix_input (10Hz),
//   matrix_kill, matrix_damage, matrix_capture, matrix_level_up
//
// Downlink events (S→C, 9):
//   matrix_state (20Hz), matrix_epoch, matrix_spawn_seed,
//   matrix_kill_confirmed, matrix_kill_rejected, matrix_score (2Hz),
//   matrix_result, matrix_level_up_choices, matrix_buff
//
// Wire format: {"e": "event_name", "d": {...}} — same as all WS events
// ============================================================

// registerMatrixEventHandlers registers all matrix_* event handlers
// on the event router. Called from registerEventHandlers() in main.go.
func registerMatrixEventHandlers(router *ws.EventRouter, hub *ws.Hub, v14 *V14Systems) {
	if v14 == nil || v14.ArenaManager == nil {
		slog.Warn("v14 systems not available, skipping matrix event registration")
		return
	}

	arenaManager := v14.ArenaManager

	// ================================================================
	// matrix_join (C→S): Join a Matrix arena for online play
	// ================================================================
	router.On(ws.EventMatrixJoin, func(client *ws.Client, data json.RawMessage) {
		var payload ws.MatrixJoinPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			slog.Warn("invalid matrix_join payload", "clientId", client.ID, "error", err)
			return
		}

		if payload.CountryCode == "" {
			errFrame, _ := ws.EncodeFrame(ws.EventError, ws.ErrorPayload{
				Code:    "matrix_join_failed",
				Message: "countryCode required",
			})
			client.Send(errFrame)
			return
		}

		req := game.MatrixJoinRequest{
			ClientID:     client.ID,
			CountryCode:  payload.CountryCode,
			Build:        payload.Build,
			AgentID:      payload.AgentID,
			IsAgent:      client.IsAgent,
			IsDirectPlay: !client.IsAgent,
		}

		result := arenaManager.MatrixJoin(req)

		// Send join result
		frame, err := ws.EncodeFrame(ws.EventMatrixJoin, result)
		if err == nil {
			client.Send(frame)
		}

		if result.Success {
			// Move client to country room in Hub
			hub.MoveClientToRoom(client.ID, payload.CountryCode)

			slog.Info("matrix_join success",
				"clientId", client.ID,
				"country", payload.CountryCode,
			)
		}
	})

	// ================================================================
	// matrix_leave (C→S): Leave Matrix arena
	// ================================================================
	router.On(ws.EventMatrixLeave, func(client *ws.Client, data json.RawMessage) {
		arenaManager.MatrixLeave(client.ID)
		hub.RegisterLobby(client)

		slog.Info("matrix_leave",
			"clientId", client.ID,
		)
	})

	// ================================================================
	// matrix_input (C→S): Player position/input update (10Hz)
	// ================================================================
	router.On(ws.EventMatrixInput, func(client *ws.Client, data json.RawMessage) {
		var payload ws.MatrixInputPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}

		arenaManager.MatrixInput(client.ID, game.MatrixInputData{
			X:     payload.X,
			Y:     payload.Y,
			Angle: payload.Angle,
			Boost: payload.Boost,
			Tick:  payload.Tick,
		})
	})

	// ================================================================
	// matrix_kill (C→S): Kill report for server validation
	// ================================================================
	router.On(ws.EventMatrixKill, func(client *ws.Client, data json.RawMessage) {
		var payload ws.MatrixKillPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}

		report := game.KillReport{
			KillerID: client.ID,
			TargetID: payload.TargetID,
			WeaponID: payload.WeaponID,
			Damage:   payload.Damage,
			Distance: payload.Distance,
			Tick:     payload.Tick,
		}

		result := arenaManager.MatrixKill(client.ID, report)

		if result.Valid {
			// Kill confirmed: the engine already queued KillConfirmEvent
			// in pendingKillConfirms. The broadcaster will pick it up.
			// Additionally, send immediate confirmation to the killer.
			confirmFrame, _ := ws.EncodeFrame(ws.EventMatrixKillConfirmed, game.KillConfirmEvent{
				KillerID:   client.ID,
				TargetID:   payload.TargetID,
				Score:      result.Score,
				TotalKills: 0, // populated by engine in pending events
			})
			client.Send(confirmFrame)

			// Notify all arena players via room broadcast
			if cc, ok := arenaManager.GetMatrixPlayerCountry(client.ID); ok {
				hub.BroadcastToRoomExcept(cc, confirmFrame, client.ID)
			}
		} else {
			// Send rejection only to the reporter
			rejectFrame, _ := ws.EncodeFrame(ws.EventMatrixKillRejected, game.KillRejectEvent{
				ClientID: client.ID,
				Reason:   result.Reason,
			})
			client.Send(rejectFrame)
		}
	})

	// ================================================================
	// matrix_damage (C→S): PvP damage report
	// ================================================================
	router.On(ws.EventMatrixDamage, func(client *ws.Client, data json.RawMessage) {
		var payload ws.MatrixDamagePayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}

		report := game.DamageReport{
			AttackerID: client.ID,
			TargetID:   payload.TargetID,
			WeaponID:   payload.WeaponID,
			Damage:     payload.Damage,
			Tick:       payload.Tick,
		}

		_ = arenaManager.MatrixDamage(client.ID, report)
		// Damage validation is silent — no response to client
		// (kill events are confirmed/rejected separately)
	})

	// ================================================================
	// matrix_capture (C→S): Capture point entry
	// ================================================================
	router.On(ws.EventMatrixCapture, func(client *ws.Client, data json.RawMessage) {
		var payload ws.MatrixCapturePayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}

		arenaManager.MatrixCapture(client.ID, payload.PointID)
	})

	// ================================================================
	// matrix_level_up (C→S): Level-up skill/weapon choice
	// ================================================================
	router.On(ws.EventMatrixLevelUp, func(client *ws.Client, data json.RawMessage) {
		var payload ws.MatrixLevelUpPayload
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}

		// Parse level from choice or default to incrementing
		arenaManager.MatrixLevelUp(client.ID, 0)
	})

	slog.Info("v33 matrix event handlers registered",
		"uplinkEvents", 7,
		"downlinkEvents", 9,
	)
}

// startMatrixBroadcaster starts a 20Hz goroutine that collects and sends
// all pending matrix downlink events to connected clients.
//
// Downlink types:
//   - matrix_state (20Hz): Full/delta world state → room broadcast
//   - matrix_epoch: Phase transition → room broadcast
//   - matrix_spawn_seed: Deterministic monster seed → room broadcast
//   - matrix_score (2Hz): Per-player scores → unicast
//   - matrix_result: Epoch end results → room broadcast
//   - matrix_buff: Token buff updates → unicast
//   - matrix_kill_confirmed/rejected: Handled inline in uplink handler
func startMatrixBroadcaster(hub *ws.Hub, arenaManager *game.CountryArenaManager, done <-chan struct{}) {
	ticker := time.NewTicker(50 * time.Millisecond) // 20Hz
	scoreTicker := time.NewTicker(500 * time.Millisecond) // 2Hz for scores
	defer ticker.Stop()
	defer scoreTicker.Stop()

	sendScores := false

	// v33 Phase 8: Delta compressor for matrix_state bandwidth optimization
	deltaCompressor := game.NewDeltaCompressor()

	for {
		select {
		case <-done:
			return
		case <-scoreTicker.C:
			sendScores = true
		case <-ticker.C:
			batches := arenaManager.CollectMatrixDownlinks()

			for _, batch := range batches {
				roomID := batch.CountryCode

				// --- matrix_state (20Hz, delta compressed) ---
				if batch.WorldState != nil && len(batch.WorldState.Players) > 0 {
					// v33 Phase 8: Apply delta compression
					deltaState := deltaCompressor.CompressDelta(roomID, batch.WorldState)
					frame, err := ws.EncodeFrame(ws.EventMatrixState, deltaState)
					if err == nil {
						hub.BroadcastToRoom(roomID, frame)
					}
				}

				// --- matrix_epoch (phase changes) ---
				for _, change := range batch.PhaseChanges {
					frame, err := ws.EncodeFrame(ws.EventMatrixEpoch, change)
					if err == nil {
						hub.BroadcastToRoom(roomID, frame)
					}
				}

				// --- matrix_spawn_seed ---
				for _, seed := range batch.SeedEvents {
					frame, err := ws.EncodeFrame(ws.EventMatrixSpawnSeed, seed)
					if err == nil {
						hub.BroadcastToRoom(roomID, frame)
					}
				}

				// --- matrix_result (epoch end) ---
				for _, result := range batch.Results {
					frame, err := ws.EncodeFrame(ws.EventMatrixResult, result)
					if err == nil {
						hub.BroadcastToRoom(roomID, frame)
					}
				}

				// --- matrix_buff (per-player unicast) ---
				for clientID, buffs := range batch.BuffUpdates {
					frame, err := ws.EncodeFrame(ws.EventMatrixBuff, buffs)
					if err == nil {
						hub.SendToClient(clientID, frame)
					}
				}

				// --- matrix_score (2Hz, per-player unicast) ---
				if sendScores {
					for clientID, scoreUpdate := range batch.ScoreUpdates {
						frame, err := ws.EncodeFrame(ws.EventMatrixScore, scoreUpdate)
						if err == nil {
							hub.SendToClient(clientID, frame)
						}
					}
				}
			}

			sendScores = false
		}
	}
}
