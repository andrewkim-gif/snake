package game

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/to-nexus/snake-server/internal/domain"
)

// mockBroadcaster for testing
type mockBC struct{}

func (m *mockBC) RegisterClient(clientID, roomID string) {}
func (m *mockBC) UnregisterToLobby(clientID string)      {}
func (m *mockBC) SendToClient(clientID string, data []byte) {}
func (m *mockBC) SendToRoom(roomID string, data []byte, excludeID string) {}
func (m *mockBC) BroadcastAll(data []byte) {}

func setupTestRoomManager() *RoomManager {
	ac := DefaultArenaConfig()
	rc := DefaultRoomConfig()
	rc.MaxRooms = 1
	rc.BotsPerRoom = 0 // no bots for test simplicity
	bc := &mockBC{}
	return NewRoomManager(ac, rc, bc)
}

func TestHandleCommand_ValidGoTo(t *testing.T) {
	rm := setupTestRoomManager()
	api := NewAgentAPI(rm)

	// Get the room and add a test agent
	room := rm.GetRoom("room-1")
	if room == nil {
		t.Fatal("expected room-1 to exist")
	}
	arena := room.GetArena()
	arena.AddAgent("test-agent", "TestBot", 0, domain.Position{X: 0, Y: 0})
	if agent, ok := arena.GetAgent("test-agent"); ok {
		agent.IsBot = true
	}

	// Send go_to command
	body := CommandRequest{
		AgentID: "test-agent",
		RoomID:  "room-1",
		Command: "go_to",
		Params:  map[string]interface{}{"x": 100.0, "y": 200.0},
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/agent/command", bytes.NewReader(jsonBody))
	w := httptest.NewRecorder()

	api.HandleCommand(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp CommandResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	if !resp.OK {
		t.Errorf("expected OK=true, got error: %s", resp.Error)
	}

	// Verify AI override was set
	agent, _ := arena.GetAgent("test-agent")
	if agent.AIOverride == nil {
		t.Error("expected AIOverride to be set")
	}
	if agent.AIOverride.Command != "go_to" {
		t.Errorf("expected command 'go_to', got '%s'", agent.AIOverride.Command)
	}
}

func TestHandleCommand_InvalidCommand(t *testing.T) {
	rm := setupTestRoomManager()
	api := NewAgentAPI(rm)

	room := rm.GetRoom("room-1")
	arena := room.GetArena()
	arena.AddAgent("test-agent", "TestBot", 0, domain.Position{X: 0, Y: 0})

	body := CommandRequest{
		AgentID: "test-agent",
		RoomID:  "room-1",
		Command: "invalid_command",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/agent/command", bytes.NewReader(jsonBody))
	w := httptest.NewRecorder()

	api.HandleCommand(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid command, got %d", w.Code)
	}
}

func TestHandleCommand_AgentNotFound(t *testing.T) {
	rm := setupTestRoomManager()
	api := NewAgentAPI(rm)

	body := CommandRequest{
		AgentID: "nonexistent",
		RoomID:  "room-1",
		Command: "go_center",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/agent/command", bytes.NewReader(jsonBody))
	w := httptest.NewRecorder()

	api.HandleCommand(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestHandleObserve_Basic(t *testing.T) {
	rm := setupTestRoomManager()
	api := NewAgentAPI(rm)

	room := rm.GetRoom("room-1")
	arena := room.GetArena()
	arena.AddAgent("observer", "ObserverBot", 0, domain.Position{X: 100, Y: 100})

	// Add a nearby agent (within 200px)
	arena.AddAgent("nearby", "NearBot", 0, domain.Position{X: 150, Y: 100})

	// Add a far agent (outside 200px)
	arena.AddAgent("far", "FarBot", 0, domain.Position{X: 1000, Y: 1000})

	req := httptest.NewRequest(http.MethodGet, "/api/agent/observe?agentId=observer&roomId=room-1", nil)
	w := httptest.NewRecorder()

	api.HandleObserve(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp ObserveResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	// Check self info
	if resp.Self == nil {
		t.Fatal("expected self info")
	}
	if resp.Self.ID != "observer" {
		t.Errorf("expected self.id=observer, got %s", resp.Self.ID)
	}

	// Check agents list
	if len(resp.Agents) != 3 {
		t.Errorf("expected 3 agents, got %d", len(resp.Agents))
	}

	// Check nearby threats (only "nearby" should be within 200px)
	if len(resp.NearbyThreats) != 1 {
		t.Errorf("expected 1 nearby threat, got %d", len(resp.NearbyThreats))
	} else if resp.NearbyThreats[0].ID != "nearby" {
		t.Errorf("expected nearby threat id='nearby', got '%s'", resp.NearbyThreats[0].ID)
	}

	// Check zone
	if resp.Zone == "" {
		t.Error("expected zone to be set")
	}
}

func TestHandleObserve_MissingParams(t *testing.T) {
	rm := setupTestRoomManager()
	api := NewAgentAPI(rm)

	req := httptest.NewRequest(http.MethodGet, "/api/agent/observe", nil)
	w := httptest.NewRecorder()

	api.HandleObserve(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestProcessAIOverride_GoTo(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)
	arena.AddAgent("test", "Test", 0, domain.Position{X: 0, Y: 0})

	agent, _ := arena.GetAgent("test")
	agent.AIOverride = &domain.AIOverride{
		Command:   "go_to",
		Params:    map[string]interface{}{"x": 100.0, "y": 200.0},
		ExpiresAt: arena.GetTick() + 100,
	}

	action := ProcessAIOverride(agent, arena, arena.GetTick())
	if action == nil {
		t.Fatal("expected action from go_to override")
	}
}

func TestProcessAIOverride_Expired(t *testing.T) {
	cfg := DefaultArenaConfig()
	arena := NewArena(cfg)
	arena.AddAgent("test", "Test", 0, domain.Position{X: 0, Y: 0})

	agent, _ := arena.GetAgent("test")
	agent.AIOverride = &domain.AIOverride{
		Command:   "go_center",
		ExpiresAt: 0, // already expired
	}

	action := ProcessAIOverride(agent, arena, 1)
	if action != nil {
		t.Error("expected nil action for expired override")
	}
	if agent.AIOverride != nil {
		t.Error("expected AIOverride to be cleared after expiry")
	}
}
