package city

import (
	"log/slog"
)

// ─── Diplomacy Bridge ───
//
// DiplomacyBridge connects CitySimEngine to the global DiplomacyEngine and WarManager.
// It translates Iso-level diplomatic actions into Globe-level system calls,
// and propagates war effects back into city simulation.

// DiplomacyQuerier is the read-only interface to the global diplomacy system.
type DiplomacyQuerier interface {
	AreAllied(factionA, factionB string) bool
	AreAtWar(factionA, factionB string) bool
	HasTradeAgreement(factionA, factionB string) bool
	HasSanction(sanctioner, sanctioned string) bool
	IsTradeBlocked(factionA, factionB string) bool
	GetTradeFeeReduction(factionA, factionB string) float64
}

// DiplomacyProposer is the write interface for proposing diplomatic actions.
type DiplomacyProposer interface {
	ProposeTreatyFromCity(treatyType, fromISO3, toISO3, proposedBy string) error
}

// WarQuerier provides war status queries from the WarManager.
type WarQuerier interface {
	IsAtWar(iso3 string) bool
	GetWarEnemies(iso3 string) []string
	GetWarIntensity(iso3 string) float64 // 0.0~1.0, higher = more intense
}

// DiplomacyBridge manages the city-level diplomatic state and war effects.
type DiplomacyBridge struct {
	iso3 string

	// War effect modifiers (applied per tick)
	WarResourceDrain    float64 `json:"warResourceDrain"`    // Extra resource cost during war
	WarHappinessPenalty float64 `json:"warHappinessPenalty"`  // Happiness reduction during war
	MilitaryBoost       float64 `json:"militaryBoost"`       // Military building efficiency bonus

	// Trade modifiers from diplomacy
	TradeBonus float64 `json:"tradeBonus"` // Trade price bonus from alliances

	// Active diplomatic status
	IsAtWar       bool     `json:"isAtWar"`
	Enemies       []string `json:"enemies,omitempty"`
	AllyCount     int      `json:"allyCount"`
	TradePartners int      `json:"tradePartners"`
	SanctionedBy  int      `json:"sanctionedBy"`

	// External interfaces (nil if not connected)
	diplomacy DiplomacyQuerier
	warMgr    WarQuerier
}

// NewDiplomacyBridge creates a new diplomacy bridge for a city.
func NewDiplomacyBridge(iso3 string) *DiplomacyBridge {
	return &DiplomacyBridge{
		iso3: iso3,
	}
}

// SetDiplomacy sets the global diplomacy engine reference.
func (db *DiplomacyBridge) SetDiplomacy(dq DiplomacyQuerier) {
	db.diplomacy = dq
}

// SetWarManager sets the global war manager reference.
func (db *DiplomacyBridge) SetWarManager(wq WarQuerier) {
	db.warMgr = wq
}

// ─── Per-Tick Update ───

// TickDiplomacy updates the bridge state from the global systems.
// Called once per city tick.
// Returns:
//   - resourceDrainCost: extra treasury cost from war
//   - happinessMod: happiness modifier from war/diplomacy
//   - militaryMult: military building efficiency multiplier (1.0 = normal)
func (db *DiplomacyBridge) TickDiplomacy(iso3 string) (resourceDrainCost float64, happinessMod float64, militaryMult float64) {
	db.iso3 = iso3
	resourceDrainCost = 0
	happinessMod = 0
	militaryMult = 1.0

	// --- War Effects ---
	if db.warMgr != nil {
		db.IsAtWar = db.warMgr.IsAtWar(iso3)
		db.Enemies = db.warMgr.GetWarEnemies(iso3)

		if db.IsAtWar {
			intensity := db.warMgr.GetWarIntensity(iso3)

			// Resource drain: 50~200 per tick based on intensity
			db.WarResourceDrain = 50 + intensity*150
			resourceDrainCost = db.WarResourceDrain

			// Happiness penalty: -5 to -20 based on intensity
			db.WarHappinessPenalty = -(5 + intensity*15)
			happinessMod = db.WarHappinessPenalty

			// Military boost: +10% to +30% efficiency
			db.MilitaryBoost = 0.10 + intensity*0.20
			militaryMult = 1.0 + db.MilitaryBoost

			slog.Debug("war effects applied",
				"iso3", iso3,
				"intensity", intensity,
				"resourceDrain", db.WarResourceDrain,
				"happinessPenalty", db.WarHappinessPenalty,
				"militaryBoost", db.MilitaryBoost,
			)
		} else {
			db.WarResourceDrain = 0
			db.WarHappinessPenalty = 0
			db.MilitaryBoost = 0
		}
	} else {
		db.IsAtWar = false
		db.Enemies = nil
	}

	// --- Trade Effects ---
	// Trade bonuses are computed per trade route in the economy tick,
	// but we track general diplomatic status here.
	db.AllyCount = 0
	db.TradePartners = 0
	db.SanctionedBy = 0
	db.TradeBonus = 0

	return resourceDrainCost, happinessMod, militaryMult
}

// GetTradeModifier returns the trade price modifier for a specific trading partner.
// Positive = bonus (allies/trade agreements), negative = penalty (sanctions).
func (db *DiplomacyBridge) GetTradeModifier(partnerISO3 string) float64 {
	if db.diplomacy == nil {
		return 0
	}

	modifier := 0.0

	// Alliance bonus: +15% trade prices
	if db.diplomacy.AreAllied(db.iso3, partnerISO3) {
		modifier += 0.15
	}

	// Trade agreement bonus: trade fee reduction
	feeReduction := db.diplomacy.GetTradeFeeReduction(db.iso3, partnerISO3)
	modifier += feeReduction * 0.10

	// War penalty: no trade with enemies
	if db.diplomacy.AreAtWar(db.iso3, partnerISO3) {
		modifier = -1.0 // Complete trade block
	}

	// Sanction penalty
	if db.diplomacy.IsTradeBlocked(db.iso3, partnerISO3) {
		modifier = -1.0 // Complete trade block
	}

	return modifier
}

// IsTradeAllowed returns whether trade with a partner is allowed.
func (db *DiplomacyBridge) IsTradeAllowed(partnerISO3 string) bool {
	if db.diplomacy == nil {
		return true // No diplomacy system = free trade
	}
	if db.diplomacy.AreAtWar(db.iso3, partnerISO3) {
		return false
	}
	if db.diplomacy.IsTradeBlocked(db.iso3, partnerISO3) {
		return false
	}
	return true
}

// ─── Diplomacy Bridge Snapshot for Client ───

// DiplomacyBridgeSnapshot is the serializable diplomacy state sent to clients.
type DiplomacyBridgeSnapshot struct {
	IsAtWar             bool     `json:"isAtWar"`
	Enemies             []string `json:"enemies,omitempty"`
	WarResourceDrain    float64  `json:"warResourceDrain"`
	WarHappinessPenalty float64  `json:"warHappinessPenalty"`
	MilitaryBoost       float64  `json:"militaryBoost"`
	TradeBonus          float64  `json:"tradeBonus"`
	AllyCount           int      `json:"allyCount"`
	TradePartners       int      `json:"tradePartners"`
	SanctionedBy        int      `json:"sanctionedBy"`
}

// Snapshot creates a client-ready diplomacy bridge snapshot.
func (db *DiplomacyBridge) Snapshot() DiplomacyBridgeSnapshot {
	enemies := db.Enemies
	if enemies == nil {
		enemies = []string{}
	}
	return DiplomacyBridgeSnapshot{
		IsAtWar:             db.IsAtWar,
		Enemies:             enemies,
		WarResourceDrain:    db.WarResourceDrain,
		WarHappinessPenalty: db.WarHappinessPenalty,
		MilitaryBoost:       db.MilitaryBoost,
		TradeBonus:          db.TradeBonus,
		AllyCount:           db.AllyCount,
		TradePartners:       db.TradePartners,
		SanctionedBy:        db.SanctionedBy,
	}
}
