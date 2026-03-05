package ws

import (
	"encoding/json"
	"testing"
)

func TestParseFrame_Valid(t *testing.T) {
	data := []byte(`{"e":"input","d":{"a":1.57,"b":1,"s":42}}`)
	event, payload, err := ParseFrame(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if event != "input" {
		t.Fatalf("expected event 'input', got '%s'", event)
	}
	if payload == nil {
		t.Fatal("expected non-nil payload")
	}

	// Verify payload can be unmarshalled
	var input struct {
		A float64 `json:"a"`
		B int     `json:"b"`
		S int     `json:"s"`
	}
	if err := json.Unmarshal(payload, &input); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if input.A != 1.57 || input.B != 1 || input.S != 42 {
		t.Fatalf("unexpected payload values: %+v", input)
	}
}

func TestParseFrame_MissingEvent(t *testing.T) {
	data := []byte(`{"d":{"a":1.57}}`)
	_, _, err := ParseFrame(data)
	if err == nil {
		t.Fatal("expected error for missing event")
	}
}

func TestParseFrame_InvalidJSON(t *testing.T) {
	data := []byte(`not json`)
	_, _, err := ParseFrame(data)
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestMakeFrame(t *testing.T) {
	type TestData struct {
		X int    `json:"x"`
		Y string `json:"y"`
	}

	frame, err := MakeFrame("test_event", TestData{X: 10, Y: "hello"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Parse it back
	event, payload, err := ParseFrame(frame)
	if err != nil {
		t.Fatalf("parse back: %v", err)
	}
	if event != "test_event" {
		t.Fatalf("expected 'test_event', got '%s'", event)
	}

	var result TestData
	if err := json.Unmarshal(payload, &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if result.X != 10 || result.Y != "hello" {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestMakeFrame_RoundTrip(t *testing.T) {
	// Test all event types can be serialized
	events := []string{
		EventJoinRoom, EventLeaveRoom, EventInput, EventRespawn,
		EventChooseUpgrade, EventPing, EventJoined, EventState,
		EventDeath, EventKill, EventMinimap, EventPong,
		EventRoomsUpdate, EventRoundStart, EventRoundEnd,
		EventRoundReset, EventLevelUp, EventSynergyActivated,
		EventArenaShrink, EventError,
	}

	for _, e := range events {
		frame, err := MakeFrame(e, map[string]string{"test": "data"})
		if err != nil {
			t.Fatalf("MakeFrame(%s): %v", e, err)
		}
		gotEvent, _, err := ParseFrame(frame)
		if err != nil {
			t.Fatalf("ParseFrame(%s): %v", e, err)
		}
		if gotEvent != e {
			t.Fatalf("expected event '%s', got '%s'", e, gotEvent)
		}
	}
}
