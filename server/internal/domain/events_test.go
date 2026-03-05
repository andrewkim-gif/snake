package domain

import (
	"encoding/json"
	"testing"
)

func TestInputPayload_JSON(t *testing.T) {
	input := InputPayload{A: 1.57, B: 1, S: 42}

	data, err := json.Marshal(input)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	// Verify compact field names
	var raw map[string]interface{}
	json.Unmarshal(data, &raw)

	if _, ok := raw["a"]; !ok {
		t.Fatal("expected 'a' field in JSON")
	}
	if _, ok := raw["b"]; !ok {
		t.Fatal("expected 'b' field in JSON")
	}
	if _, ok := raw["s"]; !ok {
		t.Fatal("expected 's' field in JSON")
	}

	// Unmarshal back
	var result InputPayload
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if result.A != 1.57 || result.B != 1 || result.S != 42 {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestStatePayload_JSON(t *testing.T) {
	state := StatePayload{
		T: 100,
		S: []AgentNetworkData{
			{I: "p1", N: "Player1", X: 100.5, Y: 200.5, H: 1.57, M: 50.0, B: true, K: 0, LV: 3},
		},
		O: []OrbNetworkData{
			{X: 50.0, Y: 60.0, V: 2.0, C: 3, T: 0},
		},
		L: []LeaderEntry{
			{ID: "p1", Name: "Player1", Score: 50, Kills: 2, Rank: 1},
		},
	}

	data, err := json.Marshal(state)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var result StatePayload
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if result.T != 100 {
		t.Fatalf("expected tick 100, got %d", result.T)
	}
	if len(result.S) != 1 || result.S[0].I != "p1" {
		t.Fatal("agent data mismatch")
	}
	if len(result.O) != 1 {
		t.Fatal("orb data mismatch")
	}
	if len(result.L) != 1 {
		t.Fatal("leaderboard data mismatch")
	}
}

func TestDeathPayload_JSON(t *testing.T) {
	death := DeathPayload{
		Score:        100,
		Kills:        5,
		Duration:     120.5,
		Rank:         3,
		Killer:       "enemy1",
		DamageSource: DamageSourceAura,
		Level:        7,
	}

	data, err := json.Marshal(death)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var result DeathPayload
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if result.DamageSource != DamageSourceAura {
		t.Fatalf("expected damage source 'aura', got '%s'", result.DamageSource)
	}
}

func TestJoinedPayload_JSON(t *testing.T) {
	joined := JoinedPayload{
		RoomID:    "room-1",
		ID:        "player-1",
		Spawn:     Position{X: 100, Y: 200},
		Arena:     ArenaInfo{Radius: 6000, OrbCount: 1000},
		Tick:      50,
		RoomState: RoomPlaying,
		TimeRemaining: 250,
	}

	data, err := json.Marshal(joined)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var result JoinedPayload
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if result.RoomState != RoomPlaying {
		t.Fatalf("expected 'playing', got '%s'", result.RoomState)
	}
}

func TestAgentNetworkData_SegmentsCompat(t *testing.T) {
	// Verify that the segments-compatible field is present
	agent := AgentNetworkData{
		I: "p1", N: "Test", X: 100, Y: 200, H: 0, M: 10, B: false, K: 0, LV: 1,
		P: [][]float64{{100, 200}},
	}

	data, err := json.Marshal(agent)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var raw map[string]interface{}
	json.Unmarshal(data, &raw)

	if _, ok := raw["p"]; !ok {
		t.Fatal("segments compat field 'p' should be present")
	}
}
