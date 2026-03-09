package city

import (
	"fmt"
	"math"
	"math/rand"
)

// ─── Faction Axis Constants ───

// FactionAxis represents one of the 4 political axes.
type FactionAxis int

const (
	AxisEconomic    FactionAxis = iota // Capitalist (+1) ↔ Communist (-1)
	AxisEnvironment                    // Industrialist (+1) ↔ Environmentalist (-1)
	AxisGovernance                     // Militarist (+1) ↔ Religious (-1)
	AxisSocial                         // Progressive (+1) ↔ Conservative (-1)
	NumAxes         = 4
)

// String returns the axis name.
func (a FactionAxis) String() string {
	switch a {
	case AxisEconomic:
		return "economic"
	case AxisEnvironment:
		return "environment"
	case AxisGovernance:
		return "governance"
	case AxisSocial:
		return "social"
	default:
		return "unknown"
	}
}

// FactionAxes holds the 4-axis affinities (each -1.0 to +1.0).
type FactionAxes [NumAxes]float64

// ─── Edict System ───

// EdictID is a unique edict identifier.
type EdictID string

// EdictDef defines an available edict/decree.
type EdictDef struct {
	ID              EdictID            `json:"id"`
	Name            string             `json:"name"`
	Description     string             `json:"description"`
	Category        string             `json:"category"` // economic, social, military, environmental
	FactionEffect   FactionAxes        `json:"factionEffect"`
	HappinessEffect HappinessModifiers `json:"happinessEffect"`
	CostPerTick     float64            `json:"costPerTick"`
	MinTreasury     float64            `json:"minTreasury"`
	Cooldown        int                `json:"cooldown"` // ticks before can re-enact
}

// HappinessModifiers holds per-factor happiness modifiers from an edict.
type HappinessModifiers struct {
	Food          float64 `json:"food"`
	Healthcare    float64 `json:"healthcare"`
	Entertainment float64 `json:"entertainment"`
	Faith         float64 `json:"faith"`
	Housing       float64 `json:"housing"`
	Job           float64 `json:"job"`
	Liberty       float64 `json:"liberty"`
	Safety        float64 `json:"safety"`
}

// ActiveEdict is an enacted edict instance.
type ActiveEdict struct {
	EdictID     EdictID `json:"edictId"`
	EnactedTick uint64  `json:"enactedTick"`
	Active      bool    `json:"active"`
}

// ─── Political Event ───

// PoliticalEventType categorizes political events.
type PoliticalEventType string

const (
	EventProtest     PoliticalEventType = "protest"
	EventStrike      PoliticalEventType = "strike"
	EventCoupAttempt PoliticalEventType = "coup_attempt"
	EventFactionShift PoliticalEventType = "faction_shift"
	EventEdictEnacted PoliticalEventType = "edict_enacted"
	EventEdictRevoked PoliticalEventType = "edict_revoked"
)

// PoliticalEvent represents a political occurrence.
type PoliticalEvent struct {
	Type     PoliticalEventType `json:"type"`
	Message  string             `json:"message"`
	Severity string             `json:"severity"` // info, warning, critical
	Tick     uint64             `json:"tick"`
}

// ─── Edict Catalog ───

// AllEdicts is the master catalog of available edicts.
var AllEdicts = []EdictDef{
	// Economic edicts
	{
		ID:          "tax_cut",
		Name:        "Tax Cut",
		Description: "Reduce tax burden. Capitalists love it, communists hate it.",
		Category:    "economic",
		FactionEffect: FactionAxes{+0.15, 0, 0, 0}, // economic +
		HappinessEffect: HappinessModifiers{Job: +5, Liberty: +3},
		CostPerTick: 50,
		MinTreasury: 1000,
		Cooldown:    30,
	},
	{
		ID:          "wealth_redistribution",
		Name:        "Wealth Redistribution",
		Description: "Tax the rich, fund public services. Communists cheer.",
		Category:    "economic",
		FactionEffect: FactionAxes{-0.15, 0, 0, +0.05}, // economic -, social +
		HappinessEffect: HappinessModifiers{Healthcare: +5, Housing: +5, Job: -3},
		CostPerTick: 40,
		MinTreasury: 500,
		Cooldown:    30,
	},
	{
		ID:          "free_market",
		Name:        "Free Market Act",
		Description: "Deregulate all industries. Boosts production, angers environmentalists.",
		Category:    "economic",
		FactionEffect: FactionAxes{+0.10, +0.15, 0, 0}, // economic +, environment +
		HappinessEffect: HappinessModifiers{Job: +8, Liberty: +3},
		CostPerTick: 20,
		MinTreasury: 200,
		Cooldown:    20,
	},
	// Social edicts
	{
		ID:          "religious_freedom",
		Name:        "Religious Freedom Act",
		Description: "Protect religious practices. Religious factions approve, militarists indifferent.",
		Category:    "social",
		FactionEffect: FactionAxes{0, 0, -0.15, -0.05}, // governance -, social -
		HappinessEffect: HappinessModifiers{Faith: +10, Liberty: +5},
		CostPerTick: 15,
		MinTreasury: 200,
		Cooldown:    20,
	},
	{
		ID:          "social_reform",
		Name:        "Social Reform Package",
		Description: "Progressive policies: education, healthcare access for all.",
		Category:    "social",
		FactionEffect: FactionAxes{-0.05, 0, 0, +0.20}, // social ++
		HappinessEffect: HappinessModifiers{Healthcare: +8, Entertainment: +3, Liberty: +5},
		CostPerTick: 60,
		MinTreasury: 1500,
		Cooldown:    40,
	},
	{
		ID:          "tradition_preservation",
		Name:        "Tradition Preservation",
		Description: "Protect cultural heritage. Conservatives love it, progressives grumble.",
		Category:    "social",
		FactionEffect: FactionAxes{0, 0, -0.05, -0.20}, // social --
		HappinessEffect: HappinessModifiers{Faith: +8, Entertainment: -3},
		CostPerTick: 25,
		MinTreasury: 400,
		Cooldown:    25,
	},
	// Military edicts
	{
		ID:          "military_buildup",
		Name:        "Military Buildup",
		Description: "Increase military spending. Militarists rejoice.",
		Category:    "military",
		FactionEffect: FactionAxes{0, 0, +0.20, 0}, // governance ++
		HappinessEffect: HappinessModifiers{Safety: +10, Liberty: -5},
		CostPerTick: 80,
		MinTreasury: 2000,
		Cooldown:    30,
	},
	{
		ID:          "conscription",
		Name:        "Conscription Act",
		Description: "Mandatory military service. Boosts safety, kills liberty.",
		Category:    "military",
		FactionEffect: FactionAxes{0, 0, +0.15, -0.10}, // governance +, social -
		HappinessEffect: HappinessModifiers{Safety: +15, Liberty: -15, Job: -5},
		CostPerTick: 60,
		MinTreasury: 1000,
		Cooldown:    50,
	},
	// Environmental edicts
	{
		ID:          "green_initiative",
		Name:        "Green Initiative",
		Description: "Environmental regulations. Environmentalists approve, industrialists object.",
		Category:    "environmental",
		FactionEffect: FactionAxes{0, -0.20, 0, +0.05}, // environment --, social +
		HappinessEffect: HappinessModifiers{Healthcare: +5, Job: -5},
		CostPerTick: 45,
		MinTreasury: 800,
		Cooldown:    25,
	},
	{
		ID:          "industrial_expansion",
		Name:        "Industrial Expansion",
		Description: "Prioritize industrial output over environment. Jobs boom.",
		Category:    "environmental",
		FactionEffect: FactionAxes{+0.05, +0.20, 0, 0}, // environment ++, economic +
		HappinessEffect: HappinessModifiers{Job: +10, Healthcare: -3},
		CostPerTick: 35,
		MinTreasury: 600,
		Cooldown:    25,
	},
	{
		ID:          "food_subsidies",
		Name:        "Food Subsidies",
		Description: "Government-funded food program. Everyone eats, treasury weeps.",
		Category:    "economic",
		FactionEffect: FactionAxes{-0.10, 0, 0, +0.05}, // economic -, social +
		HappinessEffect: HappinessModifiers{Food: +15},
		CostPerTick: 70,
		MinTreasury: 1000,
		Cooldown:    20,
	},
	{
		ID:          "martial_law",
		Name:        "Martial Law",
		Description: "Emergency military control. Maximum safety, minimum freedom.",
		Category:    "military",
		FactionEffect: FactionAxes{0, 0, +0.25, -0.15}, // governance +++, social --
		HappinessEffect: HappinessModifiers{Safety: +25, Liberty: -25, Entertainment: -10},
		CostPerTick: 100,
		MinTreasury: 3000,
		Cooldown:    60,
	},
}

// edictDefMap provides O(1) lookup by edict ID.
var edictDefMap map[EdictID]*EdictDef

func init() {
	edictDefMap = make(map[EdictID]*EdictDef, len(AllEdicts))
	for i := range AllEdicts {
		edictDefMap[AllEdicts[i].ID] = &AllEdicts[i]
	}
}

// GetEdictDef returns an edict definition by ID.
func GetEdictDef(id EdictID) *EdictDef {
	return edictDefMap[id]
}

// ─── PoliticsEngine ───

const (
	MaxActiveEdicts         = 5     // 최대 동시 활성 칙령 수
	DissatisfactionThreshold = 80.0 // 쿠데타/파업 발동 임계치
	MaxRecentEvents         = 10    // 최근 이벤트 보관 수
)

// PoliticsEngine manages the faction and edict system for a single city.
type PoliticsEngine struct {
	// Citizen faction affinities aggregated (average across all citizens)
	FactionAvg FactionAxes

	// Approval rating 0~100 (based on citizen happiness weighted by faction alignment)
	Approval float64

	// Dissatisfaction 0~100 (inverse of approval, amplified by edict conflicts)
	Dissatisfaction float64

	// Active edicts
	ActiveEdicts []ActiveEdict

	// Edict cooldowns: edictID → tick when cooldown expires
	EdictCooldowns map[EdictID]uint64

	// Recent political events (ring buffer, max MaxRecentEvents)
	RecentEvents []PoliticalEvent
}

// NewPoliticsEngine creates a fresh politics engine.
func NewPoliticsEngine() *PoliticsEngine {
	return &PoliticsEngine{
		Approval:       50,
		Dissatisfaction: 20,
		ActiveEdicts:   make([]ActiveEdict, 0, MaxActiveEdicts),
		EdictCooldowns: make(map[EdictID]uint64),
		RecentEvents:   make([]PoliticalEvent, 0, MaxRecentEvents),
	}
}

// IsEdictActive checks if an edict is currently active.
func (p *PoliticsEngine) IsEdictActive(edictID EdictID) bool {
	for _, ae := range p.ActiveEdicts {
		if ae.EdictID == edictID && ae.Active {
			return true
		}
	}
	return false
}

// IssueEdict enacts a new edict. Returns error if invalid.
func (p *PoliticsEngine) IssueEdict(edictID EdictID, treasury float64, currentTick uint64) error {
	def := GetEdictDef(edictID)
	if def == nil {
		return fmt.Errorf("unknown edict: %s", edictID)
	}

	// Check max active edicts
	activeCount := 0
	for _, ae := range p.ActiveEdicts {
		if ae.Active {
			if ae.EdictID == edictID {
				return fmt.Errorf("edict already active: %s", edictID)
			}
			activeCount++
		}
	}
	if activeCount >= MaxActiveEdicts {
		return fmt.Errorf("maximum active edicts reached (%d)", MaxActiveEdicts)
	}

	// Check cooldown
	if cooldownEnd, ok := p.EdictCooldowns[edictID]; ok {
		if currentTick < cooldownEnd {
			return fmt.Errorf("edict on cooldown: %d ticks remaining", cooldownEnd-currentTick)
		}
	}

	// Check treasury
	if treasury < def.MinTreasury {
		return fmt.Errorf("insufficient treasury: need %.0f, have %.0f", def.MinTreasury, treasury)
	}

	p.ActiveEdicts = append(p.ActiveEdicts, ActiveEdict{
		EdictID:     edictID,
		EnactedTick: currentTick,
		Active:      true,
	})

	p.addEvent(PoliticalEvent{
		Type:     EventEdictEnacted,
		Message:  fmt.Sprintf("Edict enacted: %s", def.Name),
		Severity: "info",
		Tick:     currentTick,
	})

	return nil
}

// RevokeEdict deactivates an active edict.
func (p *PoliticsEngine) RevokeEdict(edictID EdictID, currentTick uint64) error {
	def := GetEdictDef(edictID)
	if def == nil {
		return fmt.Errorf("unknown edict: %s", edictID)
	}

	found := false
	for i := range p.ActiveEdicts {
		if p.ActiveEdicts[i].EdictID == edictID && p.ActiveEdicts[i].Active {
			p.ActiveEdicts[i].Active = false
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("edict not active: %s", edictID)
	}

	// Set cooldown
	p.EdictCooldowns[edictID] = currentTick + uint64(def.Cooldown)

	p.addEvent(PoliticalEvent{
		Type:     EventEdictRevoked,
		Message:  fmt.Sprintf("Edict revoked: %s", def.Name),
		Severity: "info",
		Tick:     currentTick,
	})

	return nil
}

// TickPolitics runs the per-tick politics update.
// Returns treasury cost deducted for active edicts this tick.
func (p *PoliticsEngine) TickPolitics(citizens []*CitizenAgent, currentTick uint64, rng *rand.Rand) float64 {
	// 1. Aggregate citizen faction affinities
	p.aggregateFactions(citizens)

	// 2. Compute approval from citizen happiness + faction alignment
	p.computeApproval(citizens)

	// 3. Compute dissatisfaction (amplified by edict conflicts)
	p.computeDissatisfaction()

	// 4. Pay edict costs, clean up inactive edicts
	totalCost := p.payEdictCosts()

	// 5. Check for political events (ultimatums)
	p.checkUltimatums(currentTick, rng)

	return totalCost
}

// aggregateFactions computes the average citizen faction affinities across all axes.
func (p *PoliticsEngine) aggregateFactions(citizens []*CitizenAgent) {
	if len(citizens) == 0 {
		return
	}

	var sums FactionAxes
	for _, c := range citizens {
		for i := 0; i < NumAxes; i++ {
			if i < len(c.FactionAffinities) {
				sums[i] += c.FactionAffinities[i]
			}
		}
	}

	n := float64(len(citizens))
	for i := 0; i < NumAxes; i++ {
		p.FactionAvg[i] = sums[i] / n
	}
}

// computeApproval calculates the overall approval rating (0~100).
func (p *PoliticsEngine) computeApproval(citizens []*CitizenAgent) {
	if len(citizens) == 0 {
		return
	}

	// Base approval = average citizen happiness
	var totalHappiness float64
	for _, c := range citizens {
		totalHappiness += c.OverallHappiness
	}
	baseApproval := totalHappiness / float64(len(citizens))

	// Edict alignment bonus/penalty: if active edicts align with citizen affinities, +bonus
	edictBonus := 0.0
	for _, ae := range p.ActiveEdicts {
		if !ae.Active {
			continue
		}
		def := GetEdictDef(ae.EdictID)
		if def == nil {
			continue
		}
		// Dot product of edict's faction effect with population's average affinity
		// If signs match → approval bonus, if opposite → penalty
		for i := 0; i < NumAxes; i++ {
			edictBonus += def.FactionEffect[i] * p.FactionAvg[i] * 10
		}
	}

	newApproval := clampF(baseApproval+edictBonus, 0, 100)
	// Smooth: 40% new, 60% old
	p.Approval = p.Approval*0.6 + newApproval*0.4
}

// computeDissatisfaction calculates overall dissatisfaction.
func (p *PoliticsEngine) computeDissatisfaction() {
	// Base: inverse of approval
	baseDissatisfaction := 100 - p.Approval

	// Amplify if active edicts conflict with population
	conflictAmplifier := 0.0
	for _, ae := range p.ActiveEdicts {
		if !ae.Active {
			continue
		}
		def := GetEdictDef(ae.EdictID)
		if def == nil {
			continue
		}
		for i := 0; i < NumAxes; i++ {
			// If edict pushes opposite to population preference, increase dissatisfaction
			if def.FactionEffect[i]*p.FactionAvg[i] < 0 {
				conflictAmplifier += math.Abs(def.FactionEffect[i]) * 5
			}
		}
	}

	newDissatisfaction := clampF(baseDissatisfaction+conflictAmplifier, 0, 100)
	// Smooth: 30% new, 70% old
	p.Dissatisfaction = p.Dissatisfaction*0.7 + newDissatisfaction*0.3
}

// payEdictCosts totals the per-tick cost of active edicts.
func (p *PoliticsEngine) payEdictCosts() float64 {
	totalCost := 0.0
	for _, ae := range p.ActiveEdicts {
		if !ae.Active {
			continue
		}
		def := GetEdictDef(ae.EdictID)
		if def == nil {
			continue
		}
		totalCost += def.CostPerTick
	}
	return totalCost
}

// checkUltimatums fires political events when dissatisfaction exceeds thresholds.
func (p *PoliticsEngine) checkUltimatums(currentTick uint64, rng *rand.Rand) {
	if p.Dissatisfaction >= DissatisfactionThreshold {
		// Roll for event severity
		roll := rng.Float64()

		if p.Dissatisfaction >= 95 && roll < 0.15 {
			// Coup attempt (very rare, very high dissatisfaction)
			p.addEvent(PoliticalEvent{
				Type:     EventCoupAttempt,
				Message:  "Military coup attempt! Government stability at risk.",
				Severity: "critical",
				Tick:     currentTick,
			})
		} else if p.Dissatisfaction >= 90 && roll < 0.25 {
			// General strike
			p.addEvent(PoliticalEvent{
				Type:     EventStrike,
				Message:  "Workers launch general strike. Production halted.",
				Severity: "critical",
				Tick:     currentTick,
			})
		} else if roll < 0.30 {
			// Mass protest
			p.addEvent(PoliticalEvent{
				Type:     EventProtest,
				Message:  "Mass protests erupt across the city.",
				Severity: "warning",
				Tick:     currentTick,
			})
		}
	} else if p.Dissatisfaction >= 60 && rng.Float64() < 0.10 {
		// Minor protests
		p.addEvent(PoliticalEvent{
			Type:     EventProtest,
			Message:  "Minor protests in the city center.",
			Severity: "info",
			Tick:     currentTick,
		})
	}
}

// addEvent appends a political event, keeping the ring buffer at MaxRecentEvents.
func (p *PoliticsEngine) addEvent(evt PoliticalEvent) {
	p.RecentEvents = append(p.RecentEvents, evt)
	if len(p.RecentEvents) > MaxRecentEvents {
		p.RecentEvents = p.RecentEvents[len(p.RecentEvents)-MaxRecentEvents:]
	}
}

// GetActiveEdictHappinessModifiers returns the cumulative happiness modifiers
// from all active edicts. Used by citizen happiness computation.
func (p *PoliticsEngine) GetActiveEdictHappinessModifiers() HappinessModifiers {
	var mods HappinessModifiers
	for _, ae := range p.ActiveEdicts {
		if !ae.Active {
			continue
		}
		def := GetEdictDef(ae.EdictID)
		if def == nil {
			continue
		}
		mods.Food += def.HappinessEffect.Food
		mods.Healthcare += def.HappinessEffect.Healthcare
		mods.Entertainment += def.HappinessEffect.Entertainment
		mods.Faith += def.HappinessEffect.Faith
		mods.Housing += def.HappinessEffect.Housing
		mods.Job += def.HappinessEffect.Job
		mods.Liberty += def.HappinessEffect.Liberty
		mods.Safety += def.HappinessEffect.Safety
	}
	return mods
}

// ─── Politics Snapshot for Client ───

// PoliticsSnapshot is the serializable state sent to clients.
type PoliticsSnapshot struct {
	Factions        FactionSnapshotData `json:"factions"`
	ActiveEdicts    []ActiveEdict       `json:"activeEdicts"`
	AvailableEdicts []EdictDefSnapshot  `json:"availableEdicts"`
	RecentEvents    []PoliticalEvent    `json:"recentEvents"`
}

// FactionSnapshotData holds faction aggregate data for client.
type FactionSnapshotData struct {
	Axes            FactionAxesSnapshot `json:"axes"`
	Approval        float64             `json:"approval"`
	Dissatisfaction float64             `json:"dissatisfaction"`
}

// FactionAxesSnapshot is the JSON-friendly version of faction axes.
type FactionAxesSnapshot struct {
	Economic    float64 `json:"economic"`
	Environment float64 `json:"environment"`
	Governance  float64 `json:"governance"`
	Social      float64 `json:"social"`
}

// EdictDefSnapshot is a JSON-friendly edict definition for client rendering.
type EdictDefSnapshot struct {
	ID              string                       `json:"id"`
	Name            string                       `json:"name"`
	Description     string                       `json:"description"`
	Category        string                       `json:"category"`
	FactionEffect   FactionAxesSnapshot          `json:"factionEffect"`
	HappinessEffect HappinessModifiers           `json:"happinessEffect"`
	CostPerTick     float64                      `json:"costPerTick"`
	MinTreasury     float64                      `json:"minTreasury"`
	OnCooldown      bool                         `json:"onCooldown"`
	CooldownLeft    uint64                       `json:"cooldownLeft"`
}

// Snapshot creates a client-ready politics snapshot.
func (p *PoliticsEngine) Snapshot(currentTick uint64) PoliticsSnapshot {
	// Active edicts snapshot (only active ones)
	activeEdicts := make([]ActiveEdict, 0)
	for _, ae := range p.ActiveEdicts {
		if ae.Active {
			activeEdicts = append(activeEdicts, ae)
		}
	}

	// Build edict catalog with cooldown info
	edictDefs := make([]EdictDefSnapshot, len(AllEdicts))
	for i, def := range AllEdicts {
		onCooldown := false
		cooldownLeft := uint64(0)
		if cd, ok := p.EdictCooldowns[def.ID]; ok && currentTick < cd {
			onCooldown = true
			cooldownLeft = cd - currentTick
		}
		edictDefs[i] = EdictDefSnapshot{
			ID:          string(def.ID),
			Name:        def.Name,
			Description: def.Description,
			Category:    def.Category,
			FactionEffect: FactionAxesSnapshot{
				Economic:    def.FactionEffect[AxisEconomic],
				Environment: def.FactionEffect[AxisEnvironment],
				Governance:  def.FactionEffect[AxisGovernance],
				Social:      def.FactionEffect[AxisSocial],
			},
			HappinessEffect: def.HappinessEffect,
			CostPerTick:     def.CostPerTick,
			MinTreasury:     def.MinTreasury,
			OnCooldown:      onCooldown,
			CooldownLeft:    cooldownLeft,
		}
	}

	return PoliticsSnapshot{
		Factions: FactionSnapshotData{
			Axes: FactionAxesSnapshot{
				Economic:    p.FactionAvg[AxisEconomic],
				Environment: p.FactionAvg[AxisEnvironment],
				Governance:  p.FactionAvg[AxisGovernance],
				Social:      p.FactionAvg[AxisSocial],
			},
			Approval:        p.Approval,
			Dissatisfaction: p.Dissatisfaction,
		},
		ActiveEdicts:    activeEdicts,
		AvailableEdicts: edictDefs,
		RecentEvents:    p.RecentEvents,
	}
}
