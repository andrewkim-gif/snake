package game

import (
	"testing"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// newTestRoomConfig returns a RoomConfig suitable for testing
// with immediate start (CountdownSec=0, MinPlayersToStart=1).
func newTestRoomConfig() RoomConfig {
	return RoomConfig{
		MaxRooms:          1,
		MaxPlayersPerRoom: 100,
		MaxHumansPerRoom:  10,
		MaxBotsPerRoom:    0, // no bots for predictable tests
		RoundDurationSec:  300,
		CountdownSec:      0, // skip countdown
		EndingSec:         5,
		CooldownSec:       15,
		MinPlayersToStart: 1,
	}
}

// newTestRoom creates a Room with test configuration.
func newTestRoom() *Room {
	return NewRoom("test-room", "Test Arena", newTestRoomConfig())
}

// collectRoomEvents is a helper that captures emitted room events.
func collectRoomEvents(r *Room) *[]RoomEvent {
	var collected []RoomEvent
	r.OnEvents = func(events []RoomEvent) {
		collected = append(collected, events...)
	}
	return &collected
}

// --- TestRoomStateTransitions ---

func TestRoomStateTransitions(t *testing.T) {
	t.Run("initial state is waiting", func(t *testing.T) {
		r := newTestRoom()
		state := r.GetState()
		if state != domain.RoomStateWaiting {
			t.Errorf("initial state = %v, want waiting", state)
		}
	})

	t.Run("waiting to playing when player joins (CountdownSec=0)", func(t *testing.T) {
		r := newTestRoom()
		collectRoomEvents(r)

		err := r.AddPlayer("p1", "Player1", 0)
		if err != nil {
			t.Fatalf("AddPlayer failed: %v", err)
		}

		// Tick once to trigger transition from waiting -> (skip countdown) -> playing
		r.tick()

		state := r.GetState()
		if state != domain.RoomStatePlaying {
			t.Errorf("state = %v, want playing after adding player and tick", state)
		}
	})

	t.Run("waiting to countdown when CountdownSec > 0", func(t *testing.T) {
		cfg := newTestRoomConfig()
		cfg.CountdownSec = 10
		r := NewRoom("test", "Test", cfg)
		collectRoomEvents(r)

		r.AddPlayer("p1", "Player1", 0)
		r.tick()

		state := r.GetState()
		if state != domain.RoomStateCountdown {
			t.Errorf("state = %v, want countdown", state)
		}
	})

	t.Run("countdown ticks down to playing", func(t *testing.T) {
		cfg := newTestRoomConfig()
		cfg.CountdownSec = 1 // 1 second = TickRate ticks
		r := NewRoom("test", "Test", cfg)
		collectRoomEvents(r)

		r.AddPlayer("p1", "Player1", 0)
		r.tick() // transitions to countdown

		// Tick through the countdown (TickRate ticks)
		for i := 0; i < TickRate; i++ {
			r.tick()
		}

		state := r.GetState()
		if state != domain.RoomStatePlaying {
			t.Errorf("state = %v after countdown, want playing", state)
		}
	})

	t.Run("ending transitions to cooldown", func(t *testing.T) {
		r := newTestRoom()
		collectRoomEvents(r)

		// Manually transition to ending state
		r.mu.Lock()
		r.transitionTo(domain.RoomStateEnding)
		r.mu.Unlock()

		// Tick through ending phase
		endingTicks := newTestRoomConfig().EndingSec * TickRate
		for i := 0; i < endingTicks; i++ {
			r.tick()
		}

		state := r.GetState()
		if state != domain.RoomStateCooldown {
			t.Errorf("state = %v, want cooldown after ending", state)
		}
	})

	t.Run("cooldown transitions to waiting", func(t *testing.T) {
		r := newTestRoom()
		events := collectRoomEvents(r)

		r.mu.Lock()
		r.transitionTo(domain.RoomStateCooldown)
		r.mu.Unlock()

		cooldownTicks := newTestRoomConfig().CooldownSec * TickRate
		for i := 0; i < cooldownTicks; i++ {
			r.tick()
		}

		state := r.GetState()
		if state != domain.RoomStateWaiting {
			t.Errorf("state = %v, want waiting after cooldown", state)
		}

		// Check that round_reset event was emitted
		foundReset := false
		for _, e := range *events {
			if e.Type == RoomEvtRoundReset {
				foundReset = true
			}
		}
		if !foundReset {
			t.Error("expected round_reset event after cooldown -> waiting")
		}
	})
}

// --- TestAddRemovePlayer ---

func TestAddRemovePlayer(t *testing.T) {
	t.Run("add player", func(t *testing.T) {
		r := newTestRoom()

		err := r.AddPlayer("p1", "Player1", 0)
		if err != nil {
			t.Fatalf("AddPlayer failed: %v", err)
		}

		if !r.HasPlayer("p1") {
			t.Error("room should have player p1")
		}
		if r.PlayerCount() != 1 {
			t.Errorf("player count = %v, want 1", r.PlayerCount())
		}
	})

	t.Run("remove player", func(t *testing.T) {
		r := newTestRoom()
		r.AddPlayer("p1", "Player1", 0)
		r.RemovePlayer("p1")

		if r.HasPlayer("p1") {
			t.Error("room should not have player p1 after removal")
		}
		if r.PlayerCount() != 0 {
			t.Errorf("player count = %v, want 0", r.PlayerCount())
		}
	})

	t.Run("full room rejects new player", func(t *testing.T) {
		cfg := newTestRoomConfig()
		cfg.MaxHumansPerRoom = 2
		r := NewRoom("test", "Test", cfg)

		r.AddPlayer("p1", "Player1", 0)
		r.AddPlayer("p2", "Player2", 0)
		err := r.AddPlayer("p3", "Player3", 0)

		if err == nil {
			t.Error("expected error when adding player to full room")
		}
	})

	t.Run("add player during playing spawns agent", func(t *testing.T) {
		r := newTestRoom()
		collectRoomEvents(r)

		r.AddPlayer("p1", "Player1", 0)
		r.tick() // transitions to playing

		// Verify agent exists in arena
		arena := r.GetArena()
		agent, ok := arena.GetAgent("p1")
		if !ok {
			t.Fatal("player agent should exist in arena after round start")
		}
		if !agent.Alive {
			t.Error("player agent should be alive")
		}

		// Add second player during play
		r.AddPlayer("p2", "Player2", 0)
		agent2, ok2 := arena.GetAgent("p2")
		if !ok2 {
			t.Fatal("late-joining player agent should be spawned immediately")
		}
		if !agent2.Alive {
			t.Error("late-joining agent should be alive")
		}
	})
}

// --- TestEndRound ---

func TestEndRound(t *testing.T) {
	t.Run("determines winner and emits round_end", func(t *testing.T) {
		r := newTestRoom()
		events := collectRoomEvents(r)

		r.AddPlayer("p1", "Player1", 0)
		r.tick() // start round

		// Give player a high score
		arena := r.GetArena()
		agent, _ := arena.GetAgent("p1")
		agent.Score = 500
		agent.Kills = 5

		// Force round end by setting stateTicksLeft to 0
		r.mu.Lock()
		r.stateTicksLeft = 1
		r.mu.Unlock()
		r.tick() // this should trigger endRound

		// Check state transitioned to ending
		state := r.GetState()
		if state != domain.RoomStateEnding {
			t.Errorf("state = %v, want ending after round end", state)
		}

		// Check round_end event was emitted
		foundRoundEnd := false
		for _, e := range *events {
			if e.Type == RoomEvtRoundEnd {
				foundRoundEnd = true
				roundEnd, ok := e.Data.(domain.RoundEndEvent)
				if !ok {
					t.Fatal("round_end event data is not RoundEndEvent")
				}
				if roundEnd.Winner == nil {
					t.Error("winner should not be nil")
				} else {
					if roundEnd.Winner.Name != "Player1" {
						t.Errorf("winner name = %v, want Player1", roundEnd.Winner.Name)
					}
				}
			}
		}
		if !foundRoundEnd {
			t.Error("expected round_end event")
		}
	})
}

// --- TestGetInfo ---

func TestGetInfo(t *testing.T) {
	t.Run("returns correct room info", func(t *testing.T) {
		r := newTestRoom()
		r.AddPlayer("p1", "Player1", 0)

		info := r.GetInfo()

		if info.ID != "test-room" {
			t.Errorf("id = %v, want test-room", info.ID)
		}
		if info.Name != "Test Arena" {
			t.Errorf("name = %v, want Test Arena", info.Name)
		}
		if info.State != domain.RoomStateWaiting {
			t.Errorf("state = %v, want waiting", info.State)
		}
		if info.Players != 1 {
			t.Errorf("players = %v, want 1", info.Players)
		}
		if info.MaxPlayers != 10 {
			t.Errorf("maxPlayers = %v, want 10", info.MaxPlayers)
		}
	})
}

// --- TestGetJoinedEvent ---

func TestGetJoinedEvent(t *testing.T) {
	t.Run("returns joined event with correct fields", func(t *testing.T) {
		r := newTestRoom()
		r.AddPlayer("p1", "Player1", 0)

		evt := r.GetJoinedEvent("p1")

		if evt.RoomID != "test-room" {
			t.Errorf("roomId = %v, want test-room", evt.RoomID)
		}
		if evt.ID != "p1" {
			t.Errorf("id = %v, want p1", evt.ID)
		}
		if evt.RoomState != domain.RoomStateWaiting {
			t.Errorf("roomState = %v, want waiting", evt.RoomState)
		}
	})
}
