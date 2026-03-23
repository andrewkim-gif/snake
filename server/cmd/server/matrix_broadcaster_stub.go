package main

import (
	"github.com/andrewkim-gif/snake/server/internal/game"
	"github.com/andrewkim-gif/snake/server/internal/ws"
)

// startMatrixBroadcaster was the 20Hz Matrix downlink broadcaster.
// Stub: blocks until done channel is closed (Arena/Matrix removed).
func startMatrixBroadcaster(_ *ws.Hub, _ *game.CountryArenaManager, done <-chan struct{}) {
	<-done
}

// registerMatrixEventHandlers was the Matrix uplink event wiring.
// Stub: no-op (Arena/Matrix removed).
func registerMatrixEventHandlers(_ *ws.EventRouter, _ *ws.Hub, _ *V14Systems) {}
