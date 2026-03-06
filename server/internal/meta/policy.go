package meta

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/andrewkim-gif/snake/server/internal/auth"
	"github.com/go-chi/chi/v5"
)

// PolicyType enumerates the adjustable economic policy levers.
type PolicyType string

const (
	PolicyTaxRate       PolicyType = "tax_rate"
	PolicyTradeOpenness PolicyType = "trade_openness"
	PolicyMilitary      PolicyType = "military_spend"
	PolicyTechInvest    PolicyType = "tech_invest"
)

// PolicyLimits defines the allowed range for each policy.
var PolicyLimits = map[PolicyType]PolicyRange{
	PolicyTaxRate:       {Min: 0.0, Max: 0.50, Step: 0.01, Default: 0.10},
	PolicyTradeOpenness: {Min: 0.0, Max: 1.00, Step: 0.05, Default: 0.50},
	PolicyMilitary:      {Min: 0.0, Max: 0.50, Step: 0.01, Default: 0.20},
	PolicyTechInvest:    {Min: 0.0, Max: 0.30, Step: 0.01, Default: 0.10},
}

// PolicyRange defines min/max/step for a policy slider.
type PolicyRange struct {
	Min     float64 `json:"min"`
	Max     float64 `json:"max"`
	Step    float64 `json:"step"`
	Default float64 `json:"default"`
}

// PolicySnapshot holds the current policy values for a country.
type PolicySnapshot struct {
	CountryISO    string  `json:"country_iso"`
	TaxRate       float64 `json:"tax_rate"`
	TradeOpenness float64 `json:"trade_openness"`
	MilitarySpend float64 `json:"military_spend"`
	TechInvest    float64 `json:"tech_invest"`
	UpdatedAt     time.Time `json:"updated_at"`
	UpdatedBy     string    `json:"updated_by,omitempty"`
}

// PolicyEffect describes the impact of each policy setting.
type PolicyEffect struct {
	Policy      PolicyType `json:"policy"`
	Value       float64    `json:"value"`
	Description string     `json:"description"`
	TradeOff    string     `json:"trade_off"`
	// Computed effects
	GoldIncomeModifier    float64 `json:"gold_income_modifier,omitempty"`
	ProductionModifier    float64 `json:"production_modifier,omitempty"`
	DefenseBonusModifier  float64 `json:"defense_bonus_modifier,omitempty"`
	TechProductionBonus   float64 `json:"tech_production_bonus,omitempty"`
	GDPModifier           float64 `json:"gdp_modifier,omitempty"`
}

// ComputePolicyEffects calculates the effects of the current policies.
func ComputePolicyEffects(taxRate, tradeOpenness, militarySpend, techInvest float64) []PolicyEffect {
	return []PolicyEffect{
		{
			Policy:             PolicyTaxRate,
			Value:              taxRate,
			Description:        fmt.Sprintf("Tax Rate: %.0f%% — Gold income from resource production", taxRate*100),
			TradeOff:           "High tax may cause agent migration to other countries",
			GoldIncomeModifier: taxRate,
			GDPModifier:        1.0 - (taxRate * 0.1), // High tax slightly reduces GDP
		},
		{
			Policy:             PolicyTradeOpenness,
			Value:              tradeOpenness,
			Description:        fmt.Sprintf("Trade Openness: %.0f%% — Allow import/export of resources", tradeOpenness*100),
			TradeOff:           "High openness increases GDP but makes you vulnerable to sanctions",
			GDPModifier:        1.0 + (tradeOpenness * 0.3),
			ProductionModifier: 1.0,
		},
		{
			Policy:              PolicyMilitary,
			Value:               militarySpend,
			Description:         fmt.Sprintf("Military Spending: %.0f%% — Defense bonus for arena battles", militarySpend*100),
			TradeOff:            "High military spending reduces civilian production and GDP",
			DefenseBonusModifier: militarySpend * 0.6, // 50% military = +30% defense
			ProductionModifier:   1.0 - (militarySpend * 0.5),
			GDPModifier:          1.0 - (militarySpend * 0.3),
		},
		{
			Policy:            PolicyTechInvest,
			Value:             techInvest,
			Description:       fmt.Sprintf("Tech Investment: %.0f%% — Boost Tech production and long-term GDP", techInvest*100),
			TradeOff:          "Short-term resource reduction for long-term gains",
			TechProductionBonus: techInvest,
			GDPModifier:         1.0 + (techInvest * 0.5),
		},
	}
}

// PolicyChangeRecord logs a policy change for audit.
type PolicyChangeRecord struct {
	CountryISO    string     `json:"country_iso"`
	Policy        PolicyType `json:"policy"`
	OldValue      float64    `json:"old_value"`
	NewValue      float64    `json:"new_value"`
	ChangedBy     string     `json:"changed_by"`
	ChangedAt     time.Time  `json:"changed_at"`
}

// PolicyEngine manages economic policy for countries.
// It wraps EconomyEngine.SetPolicy with permission checks and audit logging.
type PolicyEngine struct {
	economy        *EconomyEngine
	factionManager *FactionManager

	// Audit log of recent policy changes (ring buffer)
	changeLog []PolicyChangeRecord
	maxLog    int
}

// NewPolicyEngine creates a new policy engine.
func NewPolicyEngine(economy *EconomyEngine, fm *FactionManager) *PolicyEngine {
	return &PolicyEngine{
		economy:        economy,
		factionManager: fm,
		changeLog:      make([]PolicyChangeRecord, 0, 200),
		maxLog:         200,
	}
}

// GetPolicy returns the current policy snapshot for a country.
func (pe *PolicyEngine) GetPolicy(iso3 string) *PolicySnapshot {
	econ := pe.economy.GetEconomy(iso3)
	if econ == nil {
		return nil
	}

	return &PolicySnapshot{
		CountryISO:    iso3,
		TaxRate:       econ.TaxRate,
		TradeOpenness: econ.TradeOpenness,
		MilitarySpend: econ.MilitarySpend,
		TechInvest:    econ.TechInvest,
	}
}

// UpdatePolicy updates a single policy for a country.
// Checks sovereignty (Lv.3+ required) and faction permissions.
func (pe *PolicyEngine) UpdatePolicy(iso3, userID string, policy PolicyType, value float64) error {
	// Check user has a faction
	factionID := pe.factionManager.GetUserFaction(userID)
	if factionID == "" {
		return fmt.Errorf("you must be in a faction to set policies")
	}

	// Check sovereignty
	econ := pe.economy.GetEconomy(iso3)
	if econ == nil {
		return fmt.Errorf("country %s not found", iso3)
	}
	if econ.SovereignFaction != factionID {
		return fmt.Errorf("your faction does not control %s", iso3)
	}
	if econ.SovereigntyLevel < 3 {
		return fmt.Errorf("sovereignty level %d < 3 required for policy changes", econ.SovereigntyLevel)
	}

	// Check permission (Council+)
	if !pe.factionManager.HasPermission(factionID, userID, RoleCouncil) {
		return fmt.Errorf("requires Council+ permission to set economic policy")
	}

	// Validate policy range
	limits, ok := PolicyLimits[policy]
	if !ok {
		return fmt.Errorf("unknown policy: %s", policy)
	}
	if value < limits.Min || value > limits.Max {
		return fmt.Errorf("value %.2f out of range [%.2f, %.2f]", value, limits.Min, limits.Max)
	}

	// Get old value for audit
	var oldValue float64
	switch policy {
	case PolicyTaxRate:
		oldValue = econ.TaxRate
	case PolicyTradeOpenness:
		oldValue = econ.TradeOpenness
	case PolicyMilitary:
		oldValue = econ.MilitarySpend
	case PolicyTechInvest:
		oldValue = econ.TechInvest
	}

	// Apply the policy update
	taxRate := econ.TaxRate
	tradeOpen := econ.TradeOpenness
	milSpend := econ.MilitarySpend
	techInv := econ.TechInvest

	switch policy {
	case PolicyTaxRate:
		taxRate = value
	case PolicyTradeOpenness:
		tradeOpen = value
	case PolicyMilitary:
		milSpend = value
	case PolicyTechInvest:
		techInv = value
	}

	if err := pe.economy.SetPolicy(iso3, taxRate, tradeOpen, milSpend, techInv); err != nil {
		return fmt.Errorf("failed to apply policy: %w", err)
	}

	// Audit log
	record := PolicyChangeRecord{
		CountryISO: iso3,
		Policy:     policy,
		OldValue:   oldValue,
		NewValue:   value,
		ChangedBy:  userID,
		ChangedAt:  time.Now(),
	}
	pe.changeLog = append(pe.changeLog, record)
	if len(pe.changeLog) > pe.maxLog {
		pe.changeLog = pe.changeLog[len(pe.changeLog)-pe.maxLog:]
	}

	slog.Info("policy changed",
		"country", iso3,
		"policy", policy,
		"old", oldValue,
		"new", value,
		"by", userID,
	)

	return nil
}

// UpdateAllPolicies updates all policies at once for a country.
func (pe *PolicyEngine) UpdateAllPolicies(iso3, userID string, taxRate, tradeOpenness, militarySpend, techInvest float64) error {
	factionID := pe.factionManager.GetUserFaction(userID)
	if factionID == "" {
		return fmt.Errorf("you must be in a faction to set policies")
	}

	econ := pe.economy.GetEconomy(iso3)
	if econ == nil {
		return fmt.Errorf("country %s not found", iso3)
	}
	if econ.SovereignFaction != factionID {
		return fmt.Errorf("your faction does not control %s", iso3)
	}
	if econ.SovereigntyLevel < 3 {
		return fmt.Errorf("sovereignty level %d < 3 required for policy changes", econ.SovereigntyLevel)
	}

	if !pe.factionManager.HasPermission(factionID, userID, RoleCouncil) {
		return fmt.Errorf("requires Council+ permission to set economic policy")
	}

	return pe.economy.SetPolicy(iso3, taxRate, tradeOpenness, militarySpend, techInvest)
}

// GetPolicyEffects returns the computed effects of the current policy.
func (pe *PolicyEngine) GetPolicyEffects(iso3 string) []PolicyEffect {
	econ := pe.economy.GetEconomy(iso3)
	if econ == nil {
		return nil
	}
	return ComputePolicyEffects(econ.TaxRate, econ.TradeOpenness, econ.MilitarySpend, econ.TechInvest)
}

// GetRecentChanges returns recent policy changes, optionally filtered by country.
func (pe *PolicyEngine) GetRecentChanges(iso3 string, limit int) []PolicyChangeRecord {
	if limit <= 0 {
		limit = 20
	}

	var results []PolicyChangeRecord
	for i := len(pe.changeLog) - 1; i >= 0 && len(results) < limit; i-- {
		if iso3 == "" || pe.changeLog[i].CountryISO == iso3 {
			results = append(results, pe.changeLog[i])
		}
	}
	return results
}

// --- HTTP API ---

// PolicyRoutes returns a chi.Router with policy HTTP endpoints.
func (pe *PolicyEngine) PolicyRoutes() chi.Router {
	r := chi.NewRouter()

	// Public: get policy and limits
	r.Get("/limits", pe.handleGetLimits)
	r.Get("/{countryISO}", pe.handleGetPolicy)
	r.Get("/{countryISO}/effects", pe.handleGetEffects)
	r.Get("/{countryISO}/history", pe.handleGetHistory)

	// Authenticated: set policy
	r.Group(func(r chi.Router) {
		r.Use(auth.JWTAuth)
		r.Put("/{countryISO}", pe.handleSetPolicy)
		r.Patch("/{countryISO}", pe.handleUpdateSinglePolicy)
	})

	return r
}

// handleGetLimits — GET /api/economy/policy/limits
func (pe *PolicyEngine) handleGetLimits(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"limits": PolicyLimits,
	})
}

// handleGetPolicy — GET /api/economy/policy/{countryISO}
func (pe *PolicyEngine) handleGetPolicy(w http.ResponseWriter, r *http.Request) {
	iso := chi.URLParam(r, "countryISO")
	policy := pe.GetPolicy(iso)
	if policy == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "country not found"})
		return
	}

	effects := pe.GetPolicyEffects(iso)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"policy":  policy,
		"effects": effects,
	})
}

// handleGetEffects — GET /api/economy/policy/{countryISO}/effects
func (pe *PolicyEngine) handleGetEffects(w http.ResponseWriter, r *http.Request) {
	iso := chi.URLParam(r, "countryISO")
	effects := pe.GetPolicyEffects(iso)
	if effects == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "country not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"effects": effects,
	})
}

// handleGetHistory — GET /api/economy/policy/{countryISO}/history
func (pe *PolicyEngine) handleGetHistory(w http.ResponseWriter, r *http.Request) {
	iso := chi.URLParam(r, "countryISO")
	changes := pe.GetRecentChanges(iso, 50)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"changes": changes,
	})
}

// SetPolicyRequest is the request body for setting all policies.
type SetPolicyRequest struct {
	TaxRate       float64 `json:"tax_rate"`
	TradeOpenness float64 `json:"trade_openness"`
	MilitarySpend float64 `json:"military_spend"`
	TechInvest    float64 `json:"tech_invest"`
}

// handleSetPolicy — PUT /api/economy/policy/{countryISO}
func (pe *PolicyEngine) handleSetPolicy(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	if userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	iso := chi.URLParam(r, "countryISO")

	var req SetPolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if err := pe.UpdateAllPolicies(iso, userID, req.TaxRate, req.TradeOpenness, req.MilitarySpend, req.TechInvest); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	policy := pe.GetPolicy(iso)
	effects := pe.GetPolicyEffects(iso)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"policy":  policy,
		"effects": effects,
	})
}

// UpdateSinglePolicyRequest is the request body for updating a single policy.
type UpdateSinglePolicyRequest struct {
	Policy PolicyType `json:"policy"`
	Value  float64    `json:"value"`
}

// handleUpdateSinglePolicy — PATCH /api/economy/policy/{countryISO}
func (pe *PolicyEngine) handleUpdateSinglePolicy(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	if userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	iso := chi.URLParam(r, "countryISO")

	var req UpdateSinglePolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if err := pe.UpdatePolicy(iso, userID, req.Policy, req.Value); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	policy := pe.GetPolicy(iso)
	effects := pe.GetPolicyEffects(iso)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"policy":  policy,
		"effects": effects,
	})
}
