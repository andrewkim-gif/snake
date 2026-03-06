// Package agent — LLM Agent Bridge (Phase 5, S27).
// Integrates external LLM APIs (Claude, GPT, Llama) with the game's decision system.
// On level-up, sends game state to the configured LLM and receives action choices.
// Features: 2s timeout with fallback to default AI, multi-provider support.
package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"
)

// --- Constants ---

const (
	// LLMTimeoutDuration is the max wait time for an LLM API call.
	LLMTimeoutDuration = 2 * time.Second

	// MaxLLMKeysPerUser is the max number of LLM API keys a user can register.
	MaxLLMKeysPerUser = 3
)

// LLMProvider identifies the LLM provider type.
type LLMProvider string

const (
	LLMProviderClaude LLMProvider = "claude"
	LLMProviderGPT    LLMProvider = "gpt"
	LLMProviderLlama  LLMProvider = "llama"
)

// --- Types ---

// LLMConfig stores a user's LLM API key configuration.
type LLMConfig struct {
	UserID   string      `json:"user_id"`
	Provider LLMProvider `json:"provider"`
	APIKey   string      `json:"api_key"` // Stored encrypted in production
	Model    string      `json:"model"`   // e.g. "claude-sonnet-4-20250514", "gpt-4o", "llama-3.1-70b"
	BaseURL  string      `json:"base_url,omitempty"` // Custom endpoint for Llama/self-hosted
	Enabled  bool        `json:"enabled"`
}

// GameStateForLLM is the game state context sent to the LLM for decision-making.
type GameStateForLLM struct {
	AgentID       string              `json:"agent_id"`
	Level         int                 `json:"level"`
	HP            float64             `json:"hp"`
	Score         int                 `json:"score"`
	Kills         int                 `json:"kills"`
	Position      PositionData        `json:"position"`
	Zone          string              `json:"zone"`
	ArenaRadius   float64             `json:"arena_radius"`
	TimeRemaining int                 `json:"time_remaining_sec"`
	AliveCount    int                 `json:"alive_count"`
	MyRank        int                 `json:"my_rank"`
	CurrentBuild  BuildData           `json:"current_build"`
	NearbyThreats []ThreatData        `json:"nearby_threats"`
	AvailableChoices []UpgradeChoice  `json:"available_choices"`
}

// PositionData is a simplified position for the LLM.
type PositionData struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// BuildData summarizes the agent's current build.
type BuildData struct {
	Tomes     map[string]int `json:"tomes"`
	Abilities []string       `json:"abilities"`
	Synergies []string       `json:"synergies"`
}

// ThreatData describes a nearby enemy.
type ThreatData struct {
	ID        string  `json:"id"`
	HP        float64 `json:"hp"`
	Distance  float64 `json:"distance"`
	BuildType string  `json:"build_type"`
}

// UpgradeChoice is a single level-up option presented to the LLM.
type UpgradeChoice struct {
	Index       int    `json:"index"` // 0, 1, or 2
	Type        string `json:"type"`  // "tome" or "ability"
	Name        string `json:"name"`
	Description string `json:"description"`
}

// LLMDecision is the response from the LLM.
type LLMDecision struct {
	ChosenAction int    `json:"chosen_action"` // Index of the chosen upgrade (0, 1, or 2)
	Reasoning    string `json:"reasoning"`
	Confidence   float64 `json:"confidence,omitempty"` // 0.0 ~ 1.0
}

// LLMCallResult is the full result of an LLM API call.
type LLMCallResult struct {
	Decision   *LLMDecision
	Provider   LLMProvider
	Model      string
	LatencyMs  int64
	UsedFallback bool
	Error      error
}

// --- LLM Bridge ---

// LLMBridge manages LLM API key registration and decision-making calls.
type LLMBridge struct {
	mu      sync.RWMutex
	configs map[string]*LLMConfig // userID → LLM config
	client  *http.Client
	stats   LLMBridgeStats
}

// LLMBridgeStats tracks usage statistics.
type LLMBridgeStats struct {
	TotalCalls     int64 `json:"total_calls"`
	SuccessfulCalls int64 `json:"successful_calls"`
	TimeoutCalls   int64 `json:"timeout_calls"`
	FallbackCalls  int64 `json:"fallback_calls"`
	ErrorCalls     int64 `json:"error_calls"`
}

// NewLLMBridge creates a new LLM bridge.
func NewLLMBridge() *LLMBridge {
	return &LLMBridge{
		configs: make(map[string]*LLMConfig),
		client: &http.Client{
			Timeout: LLMTimeoutDuration,
		},
	}
}

// RegisterLLMKey registers or updates a user's LLM API configuration.
func (b *LLMBridge) RegisterLLMKey(cfg LLMConfig) error {
	if cfg.UserID == "" {
		return fmt.Errorf("user_id is required")
	}
	if cfg.APIKey == "" {
		return fmt.Errorf("api_key is required")
	}

	// Validate provider
	switch cfg.Provider {
	case LLMProviderClaude, LLMProviderGPT, LLMProviderLlama:
		// Valid
	default:
		return fmt.Errorf("unsupported provider: %s (use claude, gpt, or llama)", cfg.Provider)
	}

	// Set defaults
	if cfg.Model == "" {
		switch cfg.Provider {
		case LLMProviderClaude:
			cfg.Model = "claude-sonnet-4-20250514"
		case LLMProviderGPT:
			cfg.Model = "gpt-4o"
		case LLMProviderLlama:
			cfg.Model = "llama-3.1-70b"
		}
	}
	if cfg.Enabled == false {
		cfg.Enabled = true
	}

	b.mu.Lock()
	defer b.mu.Unlock()
	b.configs[cfg.UserID] = &cfg

	slog.Info("llm bridge: key registered",
		"userId", cfg.UserID,
		"provider", cfg.Provider,
		"model", cfg.Model,
	)

	return nil
}

// RemoveLLMKey removes a user's LLM configuration.
func (b *LLMBridge) RemoveLLMKey(userID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.configs, userID)
}

// GetLLMConfig returns the LLM config for a user.
func (b *LLMBridge) GetLLMConfig(userID string) *LLMConfig {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.configs[userID]
}

// HasLLMConfig returns true if the user has an LLM configuration.
func (b *LLMBridge) HasLLMConfig(userID string) bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	cfg, ok := b.configs[userID]
	return ok && cfg.Enabled
}

// RequestDecision calls the LLM API with the game state and returns the decision.
// If the LLM call fails or times out, returns a fallback decision.
func (b *LLMBridge) RequestDecision(userID string, gameState *GameStateForLLM) *LLMCallResult {
	b.mu.Lock()
	b.stats.TotalCalls++
	b.mu.Unlock()

	startTime := time.Now()

	b.mu.RLock()
	cfg, ok := b.configs[userID]
	b.mu.RUnlock()

	if !ok || !cfg.Enabled {
		b.mu.Lock()
		b.stats.FallbackCalls++
		b.mu.Unlock()
		return &LLMCallResult{
			Decision:     defaultFallbackDecision(gameState),
			UsedFallback: true,
			LatencyMs:    0,
		}
	}

	// Build request based on provider
	ctx, cancel := context.WithTimeout(context.Background(), LLMTimeoutDuration)
	defer cancel()

	var decision *LLMDecision
	var err error

	switch cfg.Provider {
	case LLMProviderClaude:
		decision, err = b.callClaude(ctx, cfg, gameState)
	case LLMProviderGPT:
		decision, err = b.callGPT(ctx, cfg, gameState)
	case LLMProviderLlama:
		decision, err = b.callLlama(ctx, cfg, gameState)
	default:
		err = fmt.Errorf("unsupported provider: %s", cfg.Provider)
	}

	latency := time.Since(startTime).Milliseconds()

	if err != nil {
		slog.Warn("llm bridge: call failed, using fallback",
			"userId", userID,
			"provider", cfg.Provider,
			"error", err,
			"latencyMs", latency,
		)

		b.mu.Lock()
		if ctx.Err() == context.DeadlineExceeded {
			b.stats.TimeoutCalls++
		} else {
			b.stats.ErrorCalls++
		}
		b.stats.FallbackCalls++
		b.mu.Unlock()

		return &LLMCallResult{
			Decision:     defaultFallbackDecision(gameState),
			Provider:     cfg.Provider,
			Model:        cfg.Model,
			LatencyMs:    latency,
			UsedFallback: true,
			Error:        err,
		}
	}

	b.mu.Lock()
	b.stats.SuccessfulCalls++
	b.mu.Unlock()

	slog.Info("llm bridge: decision received",
		"userId", userID,
		"provider", cfg.Provider,
		"choice", decision.ChosenAction,
		"latencyMs", latency,
	)

	return &LLMCallResult{
		Decision:  decision,
		Provider:  cfg.Provider,
		Model:     cfg.Model,
		LatencyMs: latency,
	}
}

// GetStats returns the current bridge statistics.
func (b *LLMBridge) GetStats() LLMBridgeStats {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.stats
}

// --- Provider-specific API calls ---

func (b *LLMBridge) callClaude(ctx context.Context, cfg *LLMConfig, state *GameStateForLLM) (*LLMDecision, error) {
	prompt := buildPrompt(state)

	body := map[string]interface{}{
		"model":      cfg.Model,
		"max_tokens": 200,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
	}

	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal claude request: %w", err)
	}

	url := "https://api.anthropic.com/v1/messages"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create claude request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", cfg.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := b.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("claude API call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("claude API error %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode claude response: %w", err)
	}

	if len(result.Content) == 0 {
		return nil, fmt.Errorf("empty claude response")
	}

	return parseDecision(result.Content[0].Text, state)
}

func (b *LLMBridge) callGPT(ctx context.Context, cfg *LLMConfig, state *GameStateForLLM) (*LLMDecision, error) {
	prompt := buildPrompt(state)

	body := map[string]interface{}{
		"model":      cfg.Model,
		"max_tokens": 200,
		"messages": []map[string]string{
			{"role": "system", "content": "You are an AI agent playing a survival roguelike game. Respond with JSON only: {\"chosen_action\": N, \"reasoning\": \"...\"}"},
			{"role": "user", "content": prompt},
		},
		"response_format": map[string]string{"type": "json_object"},
	}

	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal gpt request: %w", err)
	}

	url := "https://api.openai.com/v1/chat/completions"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create gpt request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	resp, err := b.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gpt API call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gpt API error %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode gpt response: %w", err)
	}

	if len(result.Choices) == 0 {
		return nil, fmt.Errorf("empty gpt response")
	}

	return parseDecision(result.Choices[0].Message.Content, state)
}

func (b *LLMBridge) callLlama(ctx context.Context, cfg *LLMConfig, state *GameStateForLLM) (*LLMDecision, error) {
	prompt := buildPrompt(state)

	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "https://api.together.xyz/v1"
	}

	body := map[string]interface{}{
		"model":      cfg.Model,
		"max_tokens": 200,
		"messages": []map[string]string{
			{"role": "system", "content": "You are an AI agent playing a survival roguelike game. Respond with JSON only: {\"chosen_action\": N, \"reasoning\": \"...\"}"},
			{"role": "user", "content": prompt},
		},
	}

	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal llama request: %w", err)
	}

	url := baseURL + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create llama request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	resp, err := b.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("llama API call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("llama API error %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode llama response: %w", err)
	}

	if len(result.Choices) == 0 {
		return nil, fmt.Errorf("empty llama response")
	}

	return parseDecision(result.Choices[0].Message.Content, state)
}

// --- Helpers ---

// buildPrompt creates the game state prompt for the LLM.
func buildPrompt(state *GameStateForLLM) string {
	stateJSON, _ := json.MarshalIndent(state, "", "  ")

	return fmt.Sprintf(`You are controlling an AI agent in a survival roguelike arena battle.

Current game state:
%s

Choose ONE upgrade from the available choices. Consider:
1. Your current build (tomes/abilities/synergies)
2. Nearby threats and their build types
3. Time remaining and arena shrink pressure
4. Your rank and survival priority

Respond with JSON only:
{"chosen_action": <0|1|2>, "reasoning": "<brief 1-sentence explanation>"}`, string(stateJSON))
}

// parseDecision extracts the LLM decision from raw text.
func parseDecision(text string, state *GameStateForLLM) (*LLMDecision, error) {
	text = strings.TrimSpace(text)

	// Try to extract JSON from the response
	// Handle cases where the LLM wraps JSON in markdown code blocks
	if idx := strings.Index(text, "{"); idx >= 0 {
		if endIdx := strings.LastIndex(text, "}"); endIdx >= 0 {
			text = text[idx : endIdx+1]
		}
	}

	var decision LLMDecision
	if err := json.Unmarshal([]byte(text), &decision); err != nil {
		// Try to extract just the chosen_action number
		for i := 0; i < 3; i++ {
			if strings.Contains(text, fmt.Sprintf(`"chosen_action": %d`, i)) ||
				strings.Contains(text, fmt.Sprintf(`"chosen_action":%d`, i)) {
				decision.ChosenAction = i
				decision.Reasoning = "parsed from partial response"
				return &decision, nil
			}
		}
		return nil, fmt.Errorf("failed to parse LLM decision: %w (text: %s)", err, text[:min(len(text), 200)])
	}

	// Validate choice index
	if decision.ChosenAction < 0 || decision.ChosenAction >= len(state.AvailableChoices) {
		if len(state.AvailableChoices) > 0 {
			decision.ChosenAction = 0 // Default to first choice
		}
	}

	return &decision, nil
}

// defaultFallbackDecision returns a deterministic fallback choice based on game state.
func defaultFallbackDecision(state *GameStateForLLM) *LLMDecision {
	if len(state.AvailableChoices) == 0 {
		return &LLMDecision{
			ChosenAction: 0,
			Reasoning:    "no choices available",
		}
	}

	// Simple heuristic: prefer defensive when low HP, offensive when ahead
	choiceIndex := 0
	reasoning := "fallback: default first choice"

	hpRatio := state.HP / 100.0 // rough HP ratio
	if hpRatio < 0.3 {
		// Low HP: prefer defensive upgrades (armor, regen, shield)
		for i, c := range state.AvailableChoices {
			nameLower := strings.ToLower(c.Name)
			if strings.Contains(nameLower, "armor") ||
				strings.Contains(nameLower, "regen") ||
				strings.Contains(nameLower, "shield") {
				choiceIndex = i
				reasoning = "fallback: low HP, choosing defensive"
				break
			}
		}
	} else if state.MyRank <= 3 {
		// Top rank: prefer offensive
		for i, c := range state.AvailableChoices {
			nameLower := strings.ToLower(c.Name)
			if strings.Contains(nameLower, "damage") ||
				strings.Contains(nameLower, "blade") ||
				strings.Contains(nameLower, "cursed") {
				choiceIndex = i
				reasoning = "fallback: top rank, choosing offensive"
				break
			}
		}
	}

	return &LLMDecision{
		ChosenAction: choiceIndex,
		Reasoning:    reasoning,
	}
}

// min returns the minimum of two ints.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
