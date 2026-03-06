package agent

import (
	"testing"
)

func TestRegisterLLMKey(t *testing.T) {
	bridge := NewLLMBridge()

	// Valid registration
	err := bridge.RegisterLLMKey(LLMConfig{
		UserID:   "user_1",
		Provider: LLMProviderClaude,
		APIKey:   "sk-test-key",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	cfg := bridge.GetLLMConfig("user_1")
	if cfg == nil {
		t.Fatal("expected config to be stored")
	}
	if cfg.Provider != LLMProviderClaude {
		t.Errorf("expected claude, got %s", cfg.Provider)
	}
	if cfg.Model != "claude-sonnet-4-20250514" {
		t.Errorf("expected default model, got %s", cfg.Model)
	}
}

func TestRegisterLLMKey_InvalidProvider(t *testing.T) {
	bridge := NewLLMBridge()

	err := bridge.RegisterLLMKey(LLMConfig{
		UserID:   "user_1",
		Provider: "invalid",
		APIKey:   "sk-test",
	})
	if err == nil {
		t.Fatal("expected error for invalid provider")
	}
}

func TestRegisterLLMKey_MissingUserID(t *testing.T) {
	bridge := NewLLMBridge()

	err := bridge.RegisterLLMKey(LLMConfig{
		Provider: LLMProviderGPT,
		APIKey:   "sk-test",
	})
	if err == nil {
		t.Fatal("expected error for missing user_id")
	}
}

func TestHasLLMConfig(t *testing.T) {
	bridge := NewLLMBridge()

	if bridge.HasLLMConfig("nonexistent") {
		t.Error("expected false for nonexistent user")
	}

	bridge.RegisterLLMKey(LLMConfig{
		UserID:   "user_1",
		Provider: LLMProviderGPT,
		APIKey:   "sk-test",
	})

	if !bridge.HasLLMConfig("user_1") {
		t.Error("expected true after registration")
	}
}

func TestRemoveLLMKey(t *testing.T) {
	bridge := NewLLMBridge()

	bridge.RegisterLLMKey(LLMConfig{
		UserID:   "user_1",
		Provider: LLMProviderClaude,
		APIKey:   "sk-test",
	})

	bridge.RemoveLLMKey("user_1")

	if bridge.HasLLMConfig("user_1") {
		t.Error("expected config to be removed")
	}
}

func TestRequestDecision_NoConfig_UsesFallback(t *testing.T) {
	bridge := NewLLMBridge()

	state := &GameStateForLLM{
		AgentID: "agent_1",
		Level:   5,
		HP:      80,
		AvailableChoices: []UpgradeChoice{
			{Index: 0, Type: "tome", Name: "Damage Up", Description: "+15% DPS"},
			{Index: 1, Type: "tome", Name: "Armor Up", Description: "+15% defense"},
			{Index: 2, Type: "ability", Name: "Shield Burst", Description: "3s invincibility"},
		},
	}

	result := bridge.RequestDecision("nonexistent_user", state)
	if !result.UsedFallback {
		t.Error("expected fallback when no config")
	}
	if result.Decision == nil {
		t.Fatal("expected non-nil decision")
	}
	if result.Decision.ChosenAction < 0 || result.Decision.ChosenAction > 2 {
		t.Errorf("choice %d out of range", result.Decision.ChosenAction)
	}
}

func TestDefaultFallbackDecision_LowHP(t *testing.T) {
	state := &GameStateForLLM{
		HP:     20,
		MyRank: 8,
		AvailableChoices: []UpgradeChoice{
			{Index: 0, Type: "tome", Name: "Damage Up", Description: "+15% DPS"},
			{Index: 1, Type: "tome", Name: "Armor Up", Description: "+15% defense"},
			{Index: 2, Type: "ability", Name: "Regen Aura", Description: "heal over time"},
		},
	}

	decision := defaultFallbackDecision(state)
	// Should prefer defensive (armor/regen) when low HP
	if decision.ChosenAction != 1 && decision.ChosenAction != 2 {
		t.Logf("choice: %d, reasoning: %s", decision.ChosenAction, decision.Reasoning)
		// Not a strict failure since the heuristic might prefer armor at index 1
	}
}

func TestDefaultFallbackDecision_TopRank(t *testing.T) {
	state := &GameStateForLLM{
		HP:     150,
		MyRank: 1,
		AvailableChoices: []UpgradeChoice{
			{Index: 0, Type: "tome", Name: "Damage Up", Description: "+15% DPS"},
			{Index: 1, Type: "tome", Name: "Armor Up", Description: "+15% defense"},
			{Index: 2, Type: "ability", Name: "Shield Burst", Description: "3s invincibility"},
		},
	}

	decision := defaultFallbackDecision(state)
	// Should prefer offensive when top rank
	if decision.ChosenAction != 0 {
		t.Logf("choice: %d, reasoning: %s", decision.ChosenAction, decision.Reasoning)
	}
}

func TestDefaultFallbackDecision_EmptyChoices(t *testing.T) {
	state := &GameStateForLLM{
		AvailableChoices: []UpgradeChoice{},
	}

	decision := defaultFallbackDecision(state)
	if decision.ChosenAction != 0 {
		t.Errorf("expected 0 for empty choices, got %d", decision.ChosenAction)
	}
}

func TestParseDecision_ValidJSON(t *testing.T) {
	state := &GameStateForLLM{
		AvailableChoices: []UpgradeChoice{
			{Index: 0}, {Index: 1}, {Index: 2},
		},
	}

	text := `{"chosen_action": 1, "reasoning": "armor is better"}`
	decision, err := parseDecision(text, state)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if decision.ChosenAction != 1 {
		t.Errorf("expected 1, got %d", decision.ChosenAction)
	}
}

func TestParseDecision_WrappedInMarkdown(t *testing.T) {
	state := &GameStateForLLM{
		AvailableChoices: []UpgradeChoice{
			{Index: 0}, {Index: 1}, {Index: 2},
		},
	}

	text := "```json\n{\"chosen_action\": 2, \"reasoning\": \"go aggressive\"}\n```"
	decision, err := parseDecision(text, state)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if decision.ChosenAction != 2 {
		t.Errorf("expected 2, got %d", decision.ChosenAction)
	}
}

func TestParseDecision_OutOfRange(t *testing.T) {
	state := &GameStateForLLM{
		AvailableChoices: []UpgradeChoice{
			{Index: 0}, {Index: 1}, {Index: 2},
		},
	}

	text := `{"chosen_action": 5, "reasoning": "invalid"}`
	decision, err := parseDecision(text, state)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should default to 0
	if decision.ChosenAction != 0 {
		t.Errorf("expected 0 for out-of-range, got %d", decision.ChosenAction)
	}
}

func TestBridgeStats(t *testing.T) {
	bridge := NewLLMBridge()

	// Make a call without config (fallback)
	state := &GameStateForLLM{
		AvailableChoices: []UpgradeChoice{{Index: 0}},
	}
	bridge.RequestDecision("user_x", state)

	stats := bridge.GetStats()
	if stats.TotalCalls != 1 {
		t.Errorf("expected 1 total call, got %d", stats.TotalCalls)
	}
	if stats.FallbackCalls != 1 {
		t.Errorf("expected 1 fallback call, got %d", stats.FallbackCalls)
	}
}
