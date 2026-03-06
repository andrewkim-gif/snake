package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrewkim-gif/snake/server/internal/auth"
	"github.com/go-chi/chi/v5"
)

// helper: create a request with user ID in context
func withUserID(r *http.Request, userID string) *http.Request {
	ctx := context.WithValue(r.Context(), auth.ContextKeyUserID, userID)
	return r.WithContext(ctx)
}

func TestHandleDeploy_Success(t *testing.T) {
	ar := NewAgentRouter()
	ar.Deploy = func(userID, factionID, countryISO, agentName string, skinID int, autoRedeploy bool) (*DeployResponse, error) {
		return &DeployResponse{
			AgentID:    "agent_test_1",
			CountryISO: countryISO,
			Cost:       100,
			Status:     "active",
		}, nil
	}

	body := `{"country_iso":"KOR","agent_name":"TestAgent","skin_id":1}`
	req := httptest.NewRequest("POST", "/api/agents/deploy", bytes.NewBufferString(body))
	req = withUserID(req, "user_123")
	rr := httptest.NewRecorder()

	router := chi.NewRouter()
	router.Mount("/api/agents", ar.Routes())
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp DeployResponse
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp.AgentID != "agent_test_1" {
		t.Errorf("expected agent_test_1, got %s", resp.AgentID)
	}
	if resp.CountryISO != "KOR" {
		t.Errorf("expected KOR, got %s", resp.CountryISO)
	}
}

func TestHandleDeploy_Unauthorized(t *testing.T) {
	ar := NewAgentRouter()
	body := `{"country_iso":"KOR"}`
	req := httptest.NewRequest("POST", "/api/agents/deploy", bytes.NewBufferString(body))
	// No user ID in context
	rr := httptest.NewRecorder()

	router := chi.NewRouter()
	router.Mount("/api/agents", ar.Routes())
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestHandleDeploy_MissingCountry(t *testing.T) {
	ar := NewAgentRouter()
	body := `{"agent_name":"Test"}`
	req := httptest.NewRequest("POST", "/api/agents/deploy", bytes.NewBufferString(body))
	req = withUserID(req, "user_123")
	rr := httptest.NewRecorder()

	router := chi.NewRouter()
	router.Mount("/api/agents", ar.Routes())
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestHandleRecall_Success(t *testing.T) {
	ar := NewAgentRouter()
	ar.Recall = func(userID, agentID string) error {
		return nil
	}

	body := `{"agent_id":"agent_test_1"}`
	req := httptest.NewRequest("POST", "/api/agents/recall", bytes.NewBufferString(body))
	req = withUserID(req, "user_123")
	rr := httptest.NewRecorder()

	router := chi.NewRouter()
	router.Mount("/api/agents", ar.Routes())
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestHandleSetStrategy_Success(t *testing.T) {
	ar := NewAgentRouter()

	body := `{"combat_behavior":{"aggression":0.7,"target_priority":"nearest","retreat_threshold":0.3,"use_dash":true}}`
	req := httptest.NewRequest("POST", "/api/agents/test_agent/strategy", bytes.NewBufferString(body))
	req = withUserID(req, "user_123")
	rr := httptest.NewRecorder()

	router := chi.NewRouter()
	router.Mount("/api/agents", ar.Routes())
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	// Verify strategy was stored
	strategy := ar.GetStrategy("test_agent")
	if strategy == nil {
		t.Fatal("strategy not stored")
	}
	if strategy.CombatBehavior.Aggression != 0.7 {
		t.Errorf("expected aggression 0.7, got %f", strategy.CombatBehavior.Aggression)
	}
}

func TestHandleSetStrategy_InvalidAggression(t *testing.T) {
	ar := NewAgentRouter()

	body := `{"combat_behavior":{"aggression":1.5,"target_priority":"nearest","retreat_threshold":0.3}}`
	req := httptest.NewRequest("POST", "/api/agents/test_agent/strategy", bytes.NewBufferString(body))
	req = withUserID(req, "user_123")
	rr := httptest.NewRecorder()

	router := chi.NewRouter()
	router.Mount("/api/agents", ar.Routes())
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestHandleGetBattleLog_Empty(t *testing.T) {
	ar := NewAgentRouter()

	req := httptest.NewRequest("GET", "/api/agents/test_agent/battle-log", nil)
	req = withUserID(req, "user_123")
	rr := httptest.NewRecorder()

	router := chi.NewRouter()
	router.Mount("/api/agents", ar.Routes())
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp BattleLogResponse
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp.Total != 0 {
		t.Errorf("expected 0 logs, got %d", resp.Total)
	}
}

func TestAddBattleLog(t *testing.T) {
	ar := NewAgentRouter()

	ar.AddBattleLog("agent_1", BattleLogEntry{
		BattleID:   "b1",
		CountryISO: "KOR",
		Result:     "survived",
		Kills:      3,
	})
	ar.AddBattleLog("agent_1", BattleLogEntry{
		BattleID:   "b2",
		CountryISO: "JPN",
		Result:     "died",
		Kills:      1,
	})

	req := httptest.NewRequest("GET", "/api/agents/agent_1/battle-log", nil)
	req = withUserID(req, "user_123")
	rr := httptest.NewRecorder()

	router := chi.NewRouter()
	router.Mount("/api/agents", ar.Routes())
	router.ServeHTTP(rr, req)

	var resp BattleLogResponse
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp.Total != 2 {
		t.Errorf("expected 2 logs, got %d", resp.Total)
	}
}

func TestOpenAPISpec(t *testing.T) {
	ar := NewAgentRouter()

	req := httptest.NewRequest("GET", "/api/agents/openapi", nil)
	rr := httptest.NewRecorder()

	router := chi.NewRouter()
	router.Mount("/api/agents", ar.Routes())
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}

	var spec map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&spec); err != nil {
		t.Fatalf("failed to decode OpenAPI spec: %v", err)
	}

	if spec["openapi"] != "3.0.3" {
		t.Errorf("expected openapi 3.0.3, got %v", spec["openapi"])
	}
}
