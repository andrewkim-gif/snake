package game

import (
	"time"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v39 Phase 1 — Region Types & Data Model
// 국가별 지역(Region) 분할을 위한 타입 정의.
// 기존 CountryArena를 확장하여 RegionArena 체계를 지원한다.
// ============================================================

// ── 국가 티어 (지역 수 + 아레나 크기 결정) ──

// CountryTier represents the power level classification of a country.
// Determines region count, arena size, and max players.
type CountryTier string

const (
	TierS CountryTier = "S" // 강대국: 7지역, 6000px, 30명
	TierA CountryTier = "A" // 지역 강국: 5지역, 5000px, 25명
	TierB CountryTier = "B" // 중견국: 4지역, 4000px, 20명
	TierC CountryTier = "C" // 소국: 3지역, 3000px, 15명
	TierD CountryTier = "D" // 도시국가/소도서국: 3지역, 2500px, 10명
)

// TierConfig holds the configuration values for a country tier.
type TierConfig struct {
	RegionCount int // 지역 수
	ArenaSize   int // 아레나 크기 (px)
	MaxPlayers  int // 지역당 최대 플레이어
}

// TierConfigs maps each tier to its configuration.
var TierConfigs = map[CountryTier]TierConfig{
	TierS: {RegionCount: 7, ArenaSize: 6000, MaxPlayers: 30},
	TierA: {RegionCount: 5, ArenaSize: 5000, MaxPlayers: 25},
	TierB: {RegionCount: 4, ArenaSize: 4000, MaxPlayers: 20},
	TierC: {RegionCount: 3, ArenaSize: 3000, MaxPlayers: 15},
	TierD: {RegionCount: 3, ArenaSize: 2500, MaxPlayers: 10},
}

// GetTierConfig returns the tier configuration for the given tier.
func GetTierConfig(tier CountryTier) TierConfig {
	if cfg, ok := TierConfigs[tier]; ok {
		return cfg
	}
	return TierConfigs[TierD] // fallback
}

// ── 지역 유형 ──

// RegionType classifies the function of a region within a country.
type RegionType string

const (
	RegionCapital      RegionType = "capital"      // 수도 — Tech, PvP 데미지 +10%
	RegionIndustrial   RegionType = "industrial"   // 산업 — Minerals, 생산 속도 +15%
	RegionPort         RegionType = "port"         // 항구 — Gold, 교역 수수료 -20%
	RegionAgricultural RegionType = "agricultural" // 농업 — Food, HP 재생 +10%
	RegionMilitary     RegionType = "military"     // 군사 — Oil, 방어 +15%
	RegionResource     RegionType = "resource"     // 자원 — Minerals+Oil, 수집량 x1.5
	RegionCultural     RegionType = "cultural"     // 문화 — Influence, 외교 +20%
)

// ── 자원 유형 ──

// ResourceType represents the 6 base resource types.
type ResourceType string

const (
	ResourceTech      ResourceType = "tech"
	ResourceMinerals  ResourceType = "minerals"
	ResourceGold      ResourceType = "gold"
	ResourceFood      ResourceType = "food"
	ResourceOil       ResourceType = "oil"
	ResourceInfluence ResourceType = "influence"
)

// ── 지역 아레나 상태 ──

// RegionState represents the runtime state of a region arena.
type RegionState string

const (
	RegionIdle     RegionState = "idle"     // 플레이어 없음 (Lazy 해제 대상)
	RegionActive   RegionState = "active"   // PvE 페이즈 활성
	RegionBR       RegionState = "br"       // 배틀로얄 페이즈
	RegionSettling RegionState = "settling" // 정산 중
)

// ── 라운드 페이즈 ──

// RoundPhase represents the current phase within a 15-minute round cycle.
type RoundPhase string

const (
	PhasePvE        RoundPhase = "pve"        // 600초 (10분) — PvE 파밍
	PhaseBRCountdown RoundPhase = "br_countdown" // 10초 — BR 전환 카운트다운
	PhaseBR         RoundPhase = "br"         // 300초 (5분) — 배틀로얄
	PhaseSettlement RoundPhase = "settlement" // 15초 — 정산
)

// BRSubPhase represents sub-phases within the Battle Royale phase.
type BRSubPhase string

const (
	BRSubSkirmish    BRSubPhase = "skirmish"     // 0~90s: x1.0 배율
	BRSubEngagement  BRSubPhase = "engagement"   // 90~210s: x1.5 배율
	BRSubFinalBattle BRSubPhase = "final_battle" // 210~300s: x3.0 배율
)

// ── 주권 에스컬레이션 레벨 ──

// SovereigntyLevel represents the sovereignty escalation ladder.
type SovereigntyLevel string

const (
	SovLevelNone             SovereigntyLevel = "none"              // 주권 없음
	SovLevelActiveDomination SovereigntyLevel = "active_domination" // 일일 정산 1회 지배
	SovLevelSovereignty      SovereigntyLevel = "sovereignty"       // 3일 연속 지배
	SovLevelHegemony         SovereigntyLevel = "hegemony"          // 14일 연속 지배
)

// ── 라운드 타이밍 상수 ──

const (
	// RoundPvEDuration is the PvE farming phase duration in seconds.
	RoundPvEDuration = 600.0 // 10분

	// RoundBRDuration is the Battle Royale phase duration in seconds.
	RoundBRDuration = 300.0 // 5분

	// RoundSettlementDuration is the settlement phase duration in seconds.
	RoundSettlementDuration = 15.0 // 15초

	// RoundTotalDuration is the total round duration in seconds.
	RoundTotalDuration = RoundPvEDuration + RoundBRDuration + RoundSettlementDuration // 915초

	// RoundBRCountdownDuration is the BR countdown duration in seconds.
	RoundBRCountdownDuration = 10.0 // 10초

	// RoundWarWarningAt is the war warning time (seconds from PvE start).
	RoundWarWarningAt = 540.0 // 9분
)

// ── 지역 효과 ──

// RegionEffects defines the PvE/PvP buffs for a region.
type RegionEffects struct {
	PvPDamageMultiplier  float64 `json:"pvpDamageMultiplier"`  // 1.1 = +10%
	PvESpawnRate         float64 `json:"pveSpawnRate"`         // 1.0 = 기본
	ResourceGatherRate   float64 `json:"resourceGatherRate"`   // 1.5 = +50%
	HPRegenBonus         float64 `json:"hpRegenBonus"`         // 0.1 = +10%
	DefenseBonus         float64 `json:"defenseBonus"`         // 0.15 = +15%
	TradeDiscount        float64 `json:"tradeDiscount"`        // 0.2 = -20%
	DiplomacyBonus       float64 `json:"diplomacyBonus"`       // 0.2 = +20%
}

// ── 지역 정의 (정적 데이터) ──

// RegionDef represents the static definition of a region within a country.
type RegionDef struct {
	RegionId         string       `json:"regionId"`         // "KOR_seoul"
	CountryCode      string       `json:"countryCode"`      // "KOR"
	Name             string       `json:"name"`             // "서울 수도권"
	NameEn           string       `json:"nameEn"`           // "Seoul Capital"
	Type             RegionType   `json:"type"`             // capital
	PrimaryResource  ResourceType `json:"primaryResource"`  // tech
	SpecialtyResource string     `json:"specialtyResource"` // "semiconductor"
	Biome            string       `json:"biome"`            // "urban"
	SpecialEffect    string       `json:"specialEffect"`    // "PvP 데미지 +10%"
	Effects          RegionEffects `json:"effects"`
	ArenaSize        int          `json:"arenaSize"`        // 5000
	MaxPlayers       int          `json:"maxPlayers"`       // 25
}

// CountryRegionsDef represents all regions for a single country.
type CountryRegionsDef struct {
	CountryCode      string       `json:"countryCode"`
	Tier             CountryTier  `json:"tier"`
	Regions          []RegionDef  `json:"regions"`
	SpecialtyResource string     `json:"specialtyResource"`
	ArenaSize        int          `json:"arenaSize"`
	MaxPlayers       int          `json:"maxPlayers"`
}

// ── 지배 상태 (런타임) ──

// DominanceState represents the territory control state of a region.
type DominanceState struct {
	RegionId              string         `json:"regionId"`
	CountryCode           string         `json:"countryCode"`
	ControllingFactionId  string         `json:"controllingFactionId,omitempty"`
	ControllingFactionColor string       `json:"controllingFactionColor,omitempty"`
	ControlSince          *time.Time     `json:"controlSince,omitempty"`
	DailyScores           map[string]int `json:"dailyScores"`
	LastSettlement        time.Time      `json:"lastSettlement"`
	ControlStreak         int            `json:"controlStreak"`
}

// NewDominanceState creates a new neutral dominance state for a region.
func NewDominanceState(regionId, countryCode string) *DominanceState {
	return &DominanceState{
		RegionId:    regionId,
		CountryCode: countryCode,
		DailyScores: make(map[string]int),
	}
}

// ── 국가 주권 상태 ──

// CountrySovereigntyState represents the sovereignty status of a country.
type CountrySovereigntyState struct {
	CountryCode          string           `json:"countryCode"`
	SovereignFactionId   string           `json:"sovereignFactionId,omitempty"`
	SovereigntyLevel     SovereigntyLevel `json:"sovereigntyLevel"`
	AllRegionsControlled bool             `json:"allRegionsControlled"`
	SovereignStreakDays   int             `json:"sovereignStreakDays"`
	SovereignSince       *time.Time       `json:"sovereignSince,omitempty"`
}

// NewCountrySovereigntyState creates a new sovereignty state with no sovereign.
func NewCountrySovereigntyState(countryCode string) *CountrySovereigntyState {
	return &CountrySovereigntyState{
		CountryCode:      countryCode,
		SovereigntyLevel: SovLevelNone,
	}
}

// ── 라운드 상태 (런타임) ──

// RoundState represents the current state of a 15-minute round.
type RoundState struct {
	RoundNumber   int        `json:"roundNumber"`
	Phase         RoundPhase `json:"phase"`
	BRSubPhase    BRSubPhase `json:"brSubPhase,omitempty"`
	Elapsed       float64    `json:"elapsed"`       // 현재 페이즈 경과 시간 (초)
	Countdown     float64    `json:"countdown"`     // 현재 페이즈 남은 시간 (초)
	PvPEnabled    bool       `json:"pvpEnabled"`
	BRCountdown   int        `json:"brCountdown,omitempty"` // BR 전환 카운트다운 (10~1)
	RoundStartAt  time.Time  `json:"roundStartAt"`
}

// NewRoundState creates a new round state at the beginning of a round.
func NewRoundState(roundNumber int) *RoundState {
	return &RoundState{
		RoundNumber:  roundNumber,
		Phase:        PhasePvE,
		Countdown:    RoundPvEDuration,
		PvPEnabled:   false,
		RoundStartAt: time.Now(),
	}
}

// ── 라운드 결과 ──

// FactionRoundResult holds the result for a single faction in a round.
type FactionRoundResult struct {
	FactionId      string `json:"factionId"`
	FactionName    string `json:"factionName"`
	MemberCount    int    `json:"memberCount"`
	SurvivorsCount int    `json:"survivorsCount"`
	SurvivalRP     int    `json:"survivalRP"`
	KillRP         int    `json:"killRP"`
	ResourceRP     int    `json:"resourceRP"`
	TotalRP        int    `json:"totalRP"`
	Rank           int    `json:"rank"`
}

// RegionRoundResult holds the complete result of a single round in a region arena.
type RegionRoundResult struct {
	RegionId       string               `json:"regionId"`
	RoundNumber    int                  `json:"roundNumber"`
	FactionResults []FactionRoundResult `json:"factionResults"`
	StartedAt      time.Time            `json:"startedAt"`
	EndedAt        time.Time            `json:"endedAt"`
}

// ── 팩션 현황 (아레나 내 실시간) ──

// FactionPresence represents the real-time presence of a faction in a region arena.
type FactionPresence struct {
	FactionId    string   `json:"factionId"`
	FactionName  string   `json:"factionName"`
	Color        string   `json:"color"`
	Members      []string `json:"members"`
	AliveCount   int      `json:"aliveCount"`
	TotalKills   int      `json:"totalKills"`
	IsEliminated bool     `json:"isEliminated"`
}

// ── 자원 노드 ──

// ResourceNode represents a harvestable resource node in the arena.
type ResourceNode struct {
	Id           string   `json:"id"`
	Position     domain.Position  `json:"position"`
	ResourceType string   `json:"resourceType"`
	Amount       int      `json:"amount"`
	MaxAmount    int      `json:"maxAmount"`
	RespawnTimer float64  `json:"respawnTimer"`
	IsSpecialty  bool     `json:"isSpecialty"`
	GatherTime   float64  `json:"gatherTime"` // 채취 소요 시간 (초)
}

// ResourceSpawnConfig holds configuration for resource node spawning.
type ResourceSpawnConfig struct {
	BasicNodes      int     `json:"basicNodes"`      // 기본 자원 노드 수 (10~20)
	SpecialtyNodes  int     `json:"specialtyNodes"`  // 특산 자원 노드 수 (3~5)
	RespawnInterval float64 `json:"respawnInterval"` // 재생 간격 (120초)
	GatherDuration  float64 `json:"gatherDuration"`  // 채취 시간 (3초)
	MaxPerPlayer    int     `json:"maxPerPlayer"`    // 인벤토리 유형별 상한 (50)
}

// DefaultResourceSpawnConfig returns the default resource spawning configuration.
func DefaultResourceSpawnConfig() ResourceSpawnConfig {
	return ResourceSpawnConfig{
		BasicNodes:      15,
		SpecialtyNodes:  4,
		RespawnInterval: 120.0,
		GatherDuration:  3.0,
		MaxPerPlayer:    50,
	}
}

// ── 플레이어 인벤토리 ──

// ResourceBundle represents the 6 base resource types (v35 compatible).
type ResourceBundle struct {
	Gold      int `json:"gold"`
	Oil       int `json:"oil"`
	Minerals  int `json:"minerals"`
	Food      int `json:"food"`
	Tech      int `json:"tech"`
	Influence int `json:"influence"`
}

// PlayerInventory represents a player's resource inventory within a round.
type PlayerInventory struct {
	Basic     ResourceBundle `json:"basic"`
	Specialty map[string]int `json:"specialty"`
	Capacity  int            `json:"capacity"` // 유형별 상한 (50)
}

// NewPlayerInventory creates a new empty player inventory.
func NewPlayerInventory() *PlayerInventory {
	return &PlayerInventory{
		Specialty: make(map[string]int),
		Capacity:  50,
	}
}

// ── 건물 ──

// RegionBuilding represents a faction-built structure in a region.
type RegionBuilding struct {
	Id             string  `json:"id"`
	Type           string  `json:"type"` // "barracks" | "watchtower" | "market" | "fortress"
	Position       domain.Position `json:"position"`
	OwnerFaction   string  `json:"ownerFaction"`
	Level          int     `json:"level"`
	HP             int     `json:"hp"`
	MaxHP          int     `json:"maxHp"`
	Active         bool    `json:"active"`
	OriginalCost   int     `json:"originalCost"`
	ActivationCost int     `json:"activationCost"` // 인수 비용 (50%)
}

// ── 인게임 Gold 분리 ──

// PlayerEconomy separates round gold from account gold.
type PlayerEconomy struct {
	RoundGold   int `json:"roundGold"`   // 라운드 내 획득 Gold (매 라운드 리셋)
	AccountGold int `json:"accountGold"` // 계정 Gold (누적)
}

// ── BR 세이프존 ──

// BRSafeZone represents the battle royale safe zone state.
type BRSafeZone struct {
	CenterX       float64 `json:"centerX"`
	CenterY       float64 `json:"centerY"`
	CurrentRadius float64 `json:"currentRadius"`
	TargetRadius  float64 `json:"targetRadius"`
	Phase         int     `json:"phase"`
	DPS           float64 `json:"dps"`
	IsShrinking   bool    `json:"isShrinking"`
	IsWarning     bool    `json:"isWarning"`
}

// BRSafeZonePhase defines a single safe zone shrink phase.
type BRSafeZonePhase struct {
	Phase        int     `json:"phase"`
	StartTime    float64 `json:"startTime"`    // BR 시작 후 초
	WarningDur   float64 `json:"warningDur"`   // 경고 지속 시간 (초)
	ShrinkDur    float64 `json:"shrinkDur"`    // 수축 지속 시간 (초)
	TargetRadius float64 `json:"targetRadius"` // arenaSize 대비 비율
	DPS          float64 `json:"dps"`
}

// BRSafeZonePhases defines the safe zone shrink timeline during BR phase.
var BRSafeZonePhases = []BRSafeZonePhase{
	{Phase: 1, StartTime: 0, WarningDur: 20, ShrinkDur: 20, TargetRadius: 0.8, DPS: 5},
	{Phase: 2, StartTime: 60, WarningDur: 15, ShrinkDur: 20, TargetRadius: 0.5, DPS: 10},
	{Phase: 3, StartTime: 150, WarningDur: 10, ShrinkDur: 15, TargetRadius: 0.25, DPS: 20},
	{Phase: 4, StartTime: 240, WarningDur: 5, ShrinkDur: 15, TargetRadius: 0.1, DPS: 40},
}

// ── S 티어 국가 목록 ──

// STierCountries is the definitive list of S-tier countries (8).
var STierCountries = []string{"USA", "CHN", "RUS", "IND", "JPN", "DEU", "GBR", "FRA"}

// ATierCountries is the definitive list of A-tier countries (20).
var ATierCountries = []string{
	"KOR", "BRA", "CAN", "AUS", "ITA", "TUR", "SAU", "MEX",
	"IDN", "ESP", "NLD", "POL", "ARG", "ZAF", "EGY", "PAK",
	"NGA", "IRN", "ISR", "UKR",
}
