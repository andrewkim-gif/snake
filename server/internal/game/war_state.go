package game

// ============================================================
// v14 Phase 7 — S31: War State Definitions
// War state machine: Declaration → Preparation → Active → Ended
// ============================================================

// WarState represents the current phase of a war.
type WarState string

const (
	// WarStateNone — no active war.
	WarStateNone WarState = "none"

	// WarStatePreparation — 24-hour preparation period after declaration.
	WarStatePreparation WarState = "preparation"

	// WarStateActive — war is ongoing (max 72 hours).
	WarStateActive WarState = "active"

	// WarStateEnded — war has concluded.
	WarStateEnded WarState = "ended"
)

// WarOutcome describes how a war ended.
type WarOutcome string

const (
	WarOutcomeNone          WarOutcome = "none"
	WarOutcomeAttackerWin   WarOutcome = "attacker_win"
	WarOutcomeDefenderWin   WarOutcome = "defender_win"
	WarOutcomeAutoSurrender WarOutcome = "auto_surrender" // 3x score gap
	WarOutcomeFatigueEnd    WarOutcome = "fatigue_end"    // both sides exhausted
	WarOutcomeTruce         WarOutcome = "truce"          // mutual ceasefire
)

// WarDeclarationType classifies how a war was declared.
type WarDeclarationType string

const (
	WarDeclHegemony  WarDeclarationType = "hegemony"  // single hegemony nation
	WarDeclCoalition WarDeclarationType = "coalition"  // 3+ nations joint
)

// WarEventType classifies war lifecycle events.
type WarEventType string

const (
	WarEvtDeclared       WarEventType = "war_declared"
	WarEvtPrepStarted    WarEventType = "war_prep_started"
	WarEvtActivated      WarEventType = "war_activated"
	WarEvtEnded          WarEventType = "war_ended"
	WarEvtScoreUpdate    WarEventType = "war_score_update"
	WarEvtAutoSurrender  WarEventType = "war_auto_surrender"
	WarEvtAllyJoined     WarEventType = "war_ally_joined"
	WarEvtFatigueStarted WarEventType = "war_fatigue_started"
)

// WarSide identifies which side of a war an entity belongs to.
type WarSide string

const (
	WarSideAttacker WarSide = "attacker"
	WarSideDefender WarSide = "defender"
	WarSideNeutral  WarSide = "neutral"
)

// ContinentCode groups countries for adjacency/war targeting.
type ContinentCode string

const (
	ContinentAfrica       ContinentCode = "AF"
	ContinentAsia         ContinentCode = "AS"
	ContinentEurope       ContinentCode = "EU"
	ContinentNorthAmerica ContinentCode = "NA"
	ContinentSouthAmerica ContinentCode = "SA"
	ContinentOceania      ContinentCode = "OC"
	ContinentAntarctica   ContinentCode = "AN"
)
