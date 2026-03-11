package game

import (
	"math"
	"sync"
)

// ============================================================
// v39 Phase 3 — FactionCombatSystem: 팩션 기반 PvP 전투 시스템
//
// 팩션 면역 매트릭스:
//   - 같은 팩션 = DMG 0% (절대 공격 불가)
//   - 동맹 팩션 = PvE 중 면역 / BR 중 면역 없음
//   - 적대 팩션 = 100% 데미지
//
// KillValidator Step 0:
//   - 팩션 검증을 데미지 파이프라인 첫 단계에 삽입
//   - 기존 KillValidator 6-step 앞에 팩션 면역 검사 추가
//
// Underdog Boost:
//   - 인원 적은 팩션에 HP/DMG 보정 (최대 +30%/+20%)
//   - 1인 팩션(무소속)은 NPC 3명 지원
//
// 킬/어시스트/전멸 포인트:
//   - PvP 킬 → Region Point 기여 (+2 RP)
//   - 어시스트 (3초 내 데미지) → +1 RP
//   - 팩션 전멸 보너스 → +5 RP
// ============================================================

// ── 팩션 전투 상수 ──

const (
	// FactionImmunityDamage는 아군/동맹 데미지 배율 (면역 시)
	FactionImmunityDamage = 0.0

	// FactionAreaEffectMult는 영역 효과의 적대 팩션 데미지 배율
	FactionAreaEffectMult = 0.8

	// FactionAssistWindow는 어시스트 판정 시간 (초)
	FactionAssistWindow = 3.0

	// FactionMaxAlliances는 팩션당 최대 동맹 수
	FactionMaxAlliances = 2

	// FactionMaxMembers는 팩션당 최대 멤버 수
	FactionMaxMembers = 50

	// ── 킬 포인트 상수 ──

	// FactionKillGold는 적 팩션 처치 시 Gold 보상
	FactionKillGold = 20
	// FactionKillNationScore는 적 팩션 처치 시 Nation Score
	FactionKillNationScore = 15
	// FactionKillRP는 PvP 킬 → Region Point 기여
	FactionKillRP = 2

	// FactionAssistGold는 어시스트 Gold 보상
	FactionAssistGold = 8
	// FactionAssistNationScore는 어시스트 Nation Score
	FactionAssistNationScore = 5
	// FactionAssistRP는 어시스트 → Region Point 기여
	FactionAssistRP = 1

	// FactionWipeGold는 팩션 전멸 기여 Gold 보상
	FactionWipeGold = 50
	// FactionWipeNationScore는 팩션 전멸 기여 Nation Score
	FactionWipeNationScore = 30
	// FactionWipeRP는 팩션 전멸 → Region Point 보너스
	FactionWipeRP = 5

	// ── Underdog Boost 상수 ──

	// UnderdogMaxHPBoost는 최소 팩션의 최대 HP 보정 (30%)
	UnderdogMaxHPBoost = 0.30
	// UnderdogMaxDMGBoost는 최소 팩션의 최대 DMG 보정 (20%)
	UnderdogMaxDMGBoost = 0.20
	// UnderdogMaxNPCSupport는 최소 팩션에 지원되는 최대 NPC 수
	UnderdogMaxNPCSupport = 3

	// ── Underdog Boost Phase 8 확장 상수 ──

	// UnderdogSmallFactionThreshold는 소규모 팩션 기준 인원 (3명 이하)
	UnderdogSmallFactionThreshold = 3
	// UnderdogSmallFactionHPBoost는 소규모 팩션(≤3명) 고정 HP 보정 (+30%)
	UnderdogSmallFactionHPBoost = 0.30
	// UnderdogSmallFactionDMGBoost는 소규모 팩션(≤3명) 고정 DMG 보정 (+20%)
	UnderdogSmallFactionDMGBoost = 0.20
	// UnderdogRatioScaleMin는 동적 배율 시작 인원 비율 (평균 대비 50% 이하에서 발동)
	UnderdogRatioScaleMin = 0.50
	// UnderdogRPBonusMult는 Underdog 팩션 RP 보너스 배율 (1.5 = +50%)
	UnderdogRPBonusMult = 1.5
	// UnderdogXPBonusMult는 Underdog 팩션 XP 보너스 배율 (1.2 = +20%)
	UnderdogXPBonusMult = 1.2
	// UnderdogMaxGarrisonSupport는 Underdog 팩션에 지원되는 최대 NPC 수비대 수
	UnderdogMaxGarrisonSupport = 5
)

// ── 팩션 관계 타입 ──

// FactionRelation은 두 팩션 간의 관계를 나타낸다.
type FactionRelation string

const (
	// FactionRelSame은 같은 팩션 (절대 면역)
	FactionRelSame FactionRelation = "same"
	// FactionRelAllied는 동맹 팩션
	FactionRelAllied FactionRelation = "allied"
	// FactionRelHostile은 적대 팩션
	FactionRelHostile FactionRelation = "hostile"
)

// ── 데미지 타입 (공격 경로) ──

// FactionDamageType은 데미지 전달 경로를 분류한다.
type FactionDamageType string

const (
	FactionDmgDirect     FactionDamageType = "direct"     // 직접 공격
	FactionDmgProjectile FactionDamageType = "projectile" // 투사체
	FactionDmgArea       FactionDamageType = "area"       // 영역 효과
	FactionDmgKnockback  FactionDamageType = "knockback"  // 넉백
)

// ── Kill Reject Reason (팩션 관련) ──

const (
	// RejectSameFaction은 같은 팩션 공격 시 리젝트
	RejectSameFaction KillRejectReason = "same_faction"
	// RejectAlliedFaction은 동맹 팩션 면역 시 리젝트
	RejectAlliedFaction KillRejectReason = "allied_faction_immune"
)

// ── FactionImmunityRules — 면역 규칙 ──

// FactionImmunityRules는 팩션 간 면역 규칙을 정의한다.
type FactionImmunityRules struct {
	// SameFactionImmune: 같은 팩션 공격 불가 여부 (항상 true)
	SameFactionImmune bool
	// AllianceImmuneInBR: 배틀로얄에서 동맹 면역 여부 (false = 면역 없음)
	AllianceImmuneInBR bool
	// AllianceImmuneInPvE: PvE 중 동맹 면역 여부 (true = 면역 유지)
	AllianceImmuneInPvE bool
	// MaxAlliancesPerFaction: 팩션당 최대 동맹 수
	MaxAlliancesPerFaction int
}

// DefaultFactionImmunityRules는 기본 면역 규칙을 반환한다.
func DefaultFactionImmunityRules() FactionImmunityRules {
	return FactionImmunityRules{
		SameFactionImmune:      true,
		AllianceImmuneInBR:     false, // BR에서 동맹 면역 없음
		AllianceImmuneInPvE:    true,  // PvE 중 동맹 면역
		MaxAlliancesPerFaction: FactionMaxAlliances,
	}
}

// ── FactionRegistry — 팩션 정보 저장소 ──

// FactionRegistry는 플레이어와 팩션 간 매핑을 관리한다.
type FactionRegistry struct {
	mu sync.RWMutex
	// playerFaction: playerId → factionId
	playerFaction map[string]string
	// factionMembers: factionId → []playerId (아레나 내 활성 멤버)
	factionMembers map[string][]string
	// factionNames: factionId → factionName
	factionNames map[string]string
	// factionColors: factionId → hex color
	factionColors map[string]string
}

// NewFactionRegistry는 새로운 팩션 레지스트리를 생성한다.
func NewFactionRegistry() *FactionRegistry {
	return &FactionRegistry{
		playerFaction:  make(map[string]string),
		factionMembers: make(map[string][]string),
		factionNames:   make(map[string]string),
		factionColors:  make(map[string]string),
	}
}

// RegisterPlayer는 플레이어를 팩션에 등록한다.
func (fr *FactionRegistry) RegisterPlayer(playerId, factionId, factionName, color string) {
	fr.mu.Lock()
	defer fr.mu.Unlock()

	// 무소속 플레이어는 solo-faction 자동 생성
	if factionId == "" {
		factionId = "solo_" + playerId
		factionName = "Solo"
		color = "#808080" // 회색
	}

	fr.playerFaction[playerId] = factionId
	fr.factionNames[factionId] = factionName
	fr.factionColors[factionId] = color

	// 중복 방지
	members := fr.factionMembers[factionId]
	for _, m := range members {
		if m == playerId {
			return
		}
	}
	fr.factionMembers[factionId] = append(fr.factionMembers[factionId], playerId)
}

// UnregisterPlayer는 플레이어를 팩션에서 제거한다.
func (fr *FactionRegistry) UnregisterPlayer(playerId string) {
	fr.mu.Lock()
	defer fr.mu.Unlock()

	factionId, ok := fr.playerFaction[playerId]
	if !ok {
		return
	}
	delete(fr.playerFaction, playerId)

	// 멤버 목록에서 제거
	members := fr.factionMembers[factionId]
	for i, m := range members {
		if m == playerId {
			fr.factionMembers[factionId] = append(members[:i], members[i+1:]...)
			break
		}
	}

	// 팩션 멤버가 0명이면 정리
	if len(fr.factionMembers[factionId]) == 0 {
		delete(fr.factionMembers, factionId)
		delete(fr.factionNames, factionId)
		delete(fr.factionColors, factionId)
	}
}

// GetFactionId는 플레이어의 팩션 ID를 반환한다.
func (fr *FactionRegistry) GetFactionId(playerId string) string {
	fr.mu.RLock()
	defer fr.mu.RUnlock()
	return fr.playerFaction[playerId]
}

// GetFactionName은 팩션명을 반환한다.
func (fr *FactionRegistry) GetFactionName(factionId string) string {
	fr.mu.RLock()
	defer fr.mu.RUnlock()
	return fr.factionNames[factionId]
}

// GetFactionColor는 팩션 컬러를 반환한다.
func (fr *FactionRegistry) GetFactionColor(factionId string) string {
	fr.mu.RLock()
	defer fr.mu.RUnlock()
	return fr.factionColors[factionId]
}

// GetFactionMembers는 팩션의 멤버 목록을 반환한다.
func (fr *FactionRegistry) GetFactionMembers(factionId string) []string {
	fr.mu.RLock()
	defer fr.mu.RUnlock()
	members := fr.factionMembers[factionId]
	result := make([]string, len(members))
	copy(result, members)
	return result
}

// GetFactionMemberCount는 팩션의 멤버 수를 반환한다.
func (fr *FactionRegistry) GetFactionMemberCount(factionId string) int {
	fr.mu.RLock()
	defer fr.mu.RUnlock()
	return len(fr.factionMembers[factionId])
}

// GetAllFactionIds는 모든 활성 팩션 ID 목록을 반환한다.
func (fr *FactionRegistry) GetAllFactionIds() []string {
	fr.mu.RLock()
	defer fr.mu.RUnlock()
	ids := make([]string, 0, len(fr.factionMembers))
	for id := range fr.factionMembers {
		ids = append(ids, id)
	}
	return ids
}

// GetAverageSize는 전체 팩션 평균 크기를 반환한다.
func (fr *FactionRegistry) GetAverageSize() int {
	fr.mu.RLock()
	defer fr.mu.RUnlock()
	if len(fr.factionMembers) == 0 {
		return 1
	}
	total := 0
	for _, members := range fr.factionMembers {
		total += len(members)
	}
	avg := total / len(fr.factionMembers)
	if avg < 1 {
		return 1
	}
	return avg
}

// Reset은 레지스트리를 초기화한다.
func (fr *FactionRegistry) Reset() {
	fr.mu.Lock()
	defer fr.mu.Unlock()
	fr.playerFaction = make(map[string]string)
	fr.factionMembers = make(map[string][]string)
	fr.factionNames = make(map[string]string)
	fr.factionColors = make(map[string]string)
}

// ── FactionAllianceRegistry — 동맹 정보 ──

// FactionAllianceRegistry는 팩션 간 동맹 관계를 관리한다.
type FactionAllianceRegistry struct {
	mu sync.RWMutex
	// alliances: factionId → set of allied factionIds
	alliances map[string]map[string]bool
}

// NewFactionAllianceRegistry는 새로운 동맹 레지스트리를 생성한다.
func NewFactionAllianceRegistry() *FactionAllianceRegistry {
	return &FactionAllianceRegistry{
		alliances: make(map[string]map[string]bool),
	}
}

// SetAlliance는 두 팩션 간 동맹을 설정한다.
func (far *FactionAllianceRegistry) SetAlliance(factionA, factionB string) {
	far.mu.Lock()
	defer far.mu.Unlock()

	if far.alliances[factionA] == nil {
		far.alliances[factionA] = make(map[string]bool)
	}
	if far.alliances[factionB] == nil {
		far.alliances[factionB] = make(map[string]bool)
	}
	far.alliances[factionA][factionB] = true
	far.alliances[factionB][factionA] = true
}

// RemoveAlliance는 두 팩션 간 동맹을 해제한다.
func (far *FactionAllianceRegistry) RemoveAlliance(factionA, factionB string) {
	far.mu.Lock()
	defer far.mu.Unlock()

	if far.alliances[factionA] != nil {
		delete(far.alliances[factionA], factionB)
	}
	if far.alliances[factionB] != nil {
		delete(far.alliances[factionB], factionA)
	}
}

// IsAllied는 두 팩션이 동맹인지 확인한다.
func (far *FactionAllianceRegistry) IsAllied(factionA, factionB string) bool {
	far.mu.RLock()
	defer far.mu.RUnlock()

	if far.alliances[factionA] == nil {
		return false
	}
	return far.alliances[factionA][factionB]
}

// GetAllies는 팩션의 동맹 목록을 반환한다.
func (far *FactionAllianceRegistry) GetAllies(factionId string) []string {
	far.mu.RLock()
	defer far.mu.RUnlock()

	allies := make([]string, 0)
	if far.alliances[factionId] == nil {
		return allies
	}
	for allyId := range far.alliances[factionId] {
		allies = append(allies, allyId)
	}
	return allies
}

// Reset은 동맹 레지스트리를 초기화한다.
func (far *FactionAllianceRegistry) Reset() {
	far.mu.Lock()
	defer far.mu.Unlock()
	far.alliances = make(map[string]map[string]bool)
}

// ── FactionCombatSystem — 팩션 기반 데미지 매트릭스 ──

// FactionCombatSystem은 팩션 기반 PvP 전투를 관리한다.
type FactionCombatSystem struct {
	factionRegistry  *FactionRegistry
	allianceRegistry *FactionAllianceRegistry
	immunityRules    FactionImmunityRules

	// 데미지 기록 (어시스트 판정용)
	damageTracker *FactionDamageTracker

	// 팩션별 킬 포인트 누적 (라운드 내)
	factionRP   map[string]*FactionCombatScore
	factionRPMu sync.RWMutex
}

// FactionCombatScore는 라운드 내 팩션 전투 점수를 누적한다.
type FactionCombatScore struct {
	FactionId string `json:"factionId"`
	Kills     int    `json:"kills"`
	Assists   int    `json:"assists"`
	Wipes     int    `json:"wipes"`
	KillRP    int    `json:"killRP"`
	AssistRP  int    `json:"assistRP"`
	WipeRP    int    `json:"wipeRP"`
	TotalRP   int    `json:"totalRP"`
}

// NewFactionCombatSystem은 새로운 팩션 전투 시스템을 생성한다.
func NewFactionCombatSystem(
	factionRegistry *FactionRegistry,
	allianceRegistry *FactionAllianceRegistry,
) *FactionCombatSystem {
	return &FactionCombatSystem{
		factionRegistry:  factionRegistry,
		allianceRegistry: allianceRegistry,
		immunityRules:    DefaultFactionImmunityRules(),
		damageTracker:    NewFactionDamageTracker(),
		factionRP:        make(map[string]*FactionCombatScore),
	}
}

// ── KillValidator Step 0 — 팩션 검증 ──

// ValidateFactionKill은 킬 리포트에 대해 팩션 면역 검사를 수행한다.
// KillValidator 파이프라인의 Step 0으로 삽입된다.
// 반환: (유효 여부, 리젝트 사유)
func (fcs *FactionCombatSystem) ValidateFactionKill(
	killerId, targetId string,
	phase RoundPhase,
) (bool, KillRejectReason) {
	killerFaction := fcs.factionRegistry.GetFactionId(killerId)
	targetFaction := fcs.factionRegistry.GetFactionId(targetId)

	// Step 0-a: 같은 팩션 면역 (절대 공격 불가)
	if killerFaction != "" && killerFaction == targetFaction {
		return false, RejectSameFaction
	}

	// Step 0-b: PvE 중 동맹 면역
	if phase == PhasePvE && fcs.immunityRules.AllianceImmuneInPvE {
		if killerFaction != "" && targetFaction != "" {
			if fcs.allianceRegistry.IsAllied(killerFaction, targetFaction) {
				return false, RejectAlliedFaction
			}
		}
	}

	// Step 0-c: BR에서 동맹 면역 없음 → 통과
	// PvE 페이즈 중 PvP가 비활성이므로 PvE 중 모든 PvP 데미지는 0
	if phase == PhasePvE {
		return false, RejectPvPDisabled
	}

	return true, ""
}

// ── 데미지 매트릭스 ──

// GetFactionRelation은 두 플레이어 간 팩션 관계를 반환한다.
func (fcs *FactionCombatSystem) GetFactionRelation(
	attackerId, targetId string,
) FactionRelation {
	attackerFaction := fcs.factionRegistry.GetFactionId(attackerId)
	targetFaction := fcs.factionRegistry.GetFactionId(targetId)

	if attackerFaction == targetFaction && attackerFaction != "" {
		return FactionRelSame
	}
	if fcs.allianceRegistry.IsAllied(attackerFaction, targetFaction) {
		return FactionRelAllied
	}
	return FactionRelHostile
}

// GetDamageMultiplier는 팩션 관계에 따른 데미지 배율을 반환한다.
func (fcs *FactionCombatSystem) GetDamageMultiplier(
	attackerFaction, targetFaction string,
	phase RoundPhase,
	dmgType FactionDamageType,
) float64 {
	// 같은 팩션: 항상 0
	if attackerFaction == targetFaction && attackerFaction != "" {
		return FactionImmunityDamage
	}

	// PvE 페이즈: 모든 PvP 데미지 0
	if phase == PhasePvE || phase == PhaseBRCountdown {
		return FactionImmunityDamage
	}

	// 동맹: BR 중에는 면역 없음 (정상 데미지)
	// PvE 중에는 면역 (위에서 이미 0 반환됨)

	// 적대: 데미지 타입별 배율
	switch dmgType {
	case FactionDmgArea:
		return FactionAreaEffectMult // 영역 효과 80%
	default:
		return 1.0 // 직접/투사체/넉백 100%
	}
}

// ── Underdog Boost ──

// UnderdogBoostResult는 Underdog 보정 결과를 담는다.
type UnderdogBoostResult struct {
	HPMultiplier   float64 `json:"hpMultiplier"`   // HP 보정 배율 (1.0 ~ 1.3)
	DMGMultiplier  float64 `json:"dmgMultiplier"`  // DMG 보정 배율 (1.0 ~ 1.2)
	NPCSupport     int     `json:"npcSupport"`     // NPC 지원 수 (0 ~ 3)
	RPBonusMult    float64 `json:"rpBonusMult"`    // RP 보너스 배율 (1.0 ~ 1.5)
	XPBonusMult    float64 `json:"xpBonusMult"`    // XP 보너스 배율 (1.0 ~ 1.2)
	IsSmallFaction bool    `json:"isSmallFaction"` // 소규모 팩션 여부 (≤3명)
	PopRatio       float64 `json:"popRatio"`       // 인원 비율 (팩션 / 평균)
}

// CalculateUnderdogBoost는 팩션 크기 대비 Underdog 보정을 계산한다.
// Phase 8 확장: 소규모 팩션(≤3명) 고정 부스트 + 인원 비율 기반 동적 배율.
//
// 동적 배율 계산:
//   - 팩션 인원이 평균의 50% 이하일 때 Underdog 발동
//   - deficit = 1.0 - (팩션인원 / 평균인원), 0~1 범위
//   - HP: 1.0 + deficit * 0.30 (최대 +30%)
//   - DMG: 1.0 + deficit * 0.20 (최대 +20%)
//   - NPC 지원: ceil(deficit * 3) (최대 3체)
//   - RP 보너스: 1.0 + deficit * 0.5 (최대 +50%)
//   - XP 보너스: 1.0 + deficit * 0.2 (최대 +20%)
//
// 소규모 팩션(≤3명) 고정 보정:
//   - HP +30%, DMG +20% 고정 적용 (동적 배율과 중 더 높은 값)
//   - NPC 3체 고정 지원
func (fcs *FactionCombatSystem) CalculateUnderdogBoost(factionId string) UnderdogBoostResult {
	factionSize := fcs.factionRegistry.GetFactionMemberCount(factionId)
	avgSize := fcs.factionRegistry.GetAverageSize()

	result := UnderdogBoostResult{
		HPMultiplier:  1.0,
		DMGMultiplier: 1.0,
		NPCSupport:    0,
		RPBonusMult:   1.0,
		XPBonusMult:   1.0,
		PopRatio:      1.0,
	}

	// 평균 이상이면 부스트 없음
	if factionSize >= avgSize || avgSize <= 0 {
		return result
	}

	ratio := float64(factionSize) / float64(avgSize)
	result.PopRatio = ratio
	deficit := 1.0 - ratio

	// 소규모 팩션 (≤3명) 고정 부스트
	isSmall := factionSize <= UnderdogSmallFactionThreshold
	result.IsSmallFaction = isSmall

	// 동적 배율 계산
	hpMult := 1.0 + deficit*UnderdogMaxHPBoost
	dmgMult := 1.0 + deficit*UnderdogMaxDMGBoost
	npcSupport := int(math.Ceil(deficit * float64(UnderdogMaxNPCSupport)))
	rpMult := 1.0 + deficit*(UnderdogRPBonusMult-1.0)
	xpMult := 1.0 + deficit*(UnderdogXPBonusMult-1.0)

	// 소규모 팩션이면 고정값과 동적값 중 높은 값 적용
	if isSmall {
		smallHP := 1.0 + UnderdogSmallFactionHPBoost
		smallDMG := 1.0 + UnderdogSmallFactionDMGBoost
		if smallHP > hpMult {
			hpMult = smallHP
		}
		if smallDMG > dmgMult {
			dmgMult = smallDMG
		}
		if npcSupport < UnderdogMaxNPCSupport {
			npcSupport = UnderdogMaxNPCSupport
		}
	}

	// 상한 클램핑
	if hpMult > 1.0+UnderdogMaxHPBoost {
		hpMult = 1.0 + UnderdogMaxHPBoost
	}
	if dmgMult > 1.0+UnderdogMaxDMGBoost {
		dmgMult = 1.0 + UnderdogMaxDMGBoost
	}
	if npcSupport > UnderdogMaxNPCSupport {
		npcSupport = UnderdogMaxNPCSupport
	}
	if rpMult > UnderdogRPBonusMult {
		rpMult = UnderdogRPBonusMult
	}
	if xpMult > UnderdogXPBonusMult {
		xpMult = UnderdogXPBonusMult
	}

	result.HPMultiplier = hpMult
	result.DMGMultiplier = dmgMult
	result.NPCSupport = npcSupport
	result.RPBonusMult = rpMult
	result.XPBonusMult = xpMult

	return result
}

// IsUnderdogFaction은 해당 팩션이 Underdog 부스트 대상인지 확인한다.
func (fcs *FactionCombatSystem) IsUnderdogFaction(factionId string) bool {
	factionSize := fcs.factionRegistry.GetFactionMemberCount(factionId)
	avgSize := fcs.factionRegistry.GetAverageSize()

	if avgSize <= 0 {
		return false
	}

	// 소규모 팩션이거나 평균 50% 이하이면 Underdog
	if factionSize <= UnderdogSmallFactionThreshold {
		return true
	}
	ratio := float64(factionSize) / float64(avgSize)
	return ratio < UnderdogRatioScaleMin
}

// GetAllUnderdogBoosts는 모든 팩션의 Underdog 부스트를 일괄 계산하여 반환한다.
func (fcs *FactionCombatSystem) GetAllUnderdogBoosts() map[string]UnderdogBoostResult {
	factionIds := fcs.factionRegistry.GetAllFactionIds()
	result := make(map[string]UnderdogBoostResult, len(factionIds))
	for _, fid := range factionIds {
		result[fid] = fcs.CalculateUnderdogBoost(fid)
	}
	return result
}

// ── 데미지 추적 (어시스트 판정) ──

// FactionDamageTracker는 팩션 킬/어시스트 판정을 위해 데미지를 추적한다.
type FactionDamageTracker struct {
	mu sync.RWMutex
	// records: targetId → []DamageRecord (최근 데미지 기록)
	records map[string][]DamageRecord
}

// DamageRecord는 단일 데미지 이벤트를 기록한다.
type DamageRecord struct {
	AttackerId string  // 공격자 ID
	FactionId  string  // 공격자 팩션 ID
	Damage     float64 // 데미지량
	Timestamp  float64 // 게임 시간 (초)
}

// NewFactionDamageTracker는 새로운 데미지 추적기를 생성한다.
func NewFactionDamageTracker() *FactionDamageTracker {
	return &FactionDamageTracker{
		records: make(map[string][]DamageRecord),
	}
}

// RecordDamage는 데미지 이벤트를 기록한다.
func (fdt *FactionDamageTracker) RecordDamage(targetId, attackerId, factionId string, damage, gameTime float64) {
	fdt.mu.Lock()
	defer fdt.mu.Unlock()

	record := DamageRecord{
		AttackerId: attackerId,
		FactionId:  factionId,
		Damage:     damage,
		Timestamp:  gameTime,
	}

	fdt.records[targetId] = append(fdt.records[targetId], record)

	// 최대 50개 기록 유지 (오래된 것 제거)
	if len(fdt.records[targetId]) > 50 {
		fdt.records[targetId] = fdt.records[targetId][len(fdt.records[targetId])-50:]
	}
}

// GetAssistants는 킬 시점 기준 FactionAssistWindow 이내에 데미지를 준
// 다른 플레이어(킬러 제외)의 목록을 반환한다.
func (fdt *FactionDamageTracker) GetAssistants(targetId, killerId string, gameTime float64) []DamageRecord {
	fdt.mu.RLock()
	defer fdt.mu.RUnlock()

	records := fdt.records[targetId]
	if len(records) == 0 {
		return nil
	}

	cutoff := gameTime - FactionAssistWindow
	seen := make(map[string]bool)
	var assistants []DamageRecord

	for _, r := range records {
		if r.Timestamp < cutoff {
			continue
		}
		if r.AttackerId == killerId {
			continue
		}
		if seen[r.AttackerId] {
			continue
		}
		seen[r.AttackerId] = true
		assistants = append(assistants, r)
	}

	return assistants
}

// ClearTarget은 대상의 데미지 기록을 정리한다.
func (fdt *FactionDamageTracker) ClearTarget(targetId string) {
	fdt.mu.Lock()
	defer fdt.mu.Unlock()
	delete(fdt.records, targetId)
}

// Reset은 모든 기록을 초기화한다.
func (fdt *FactionDamageTracker) Reset() {
	fdt.mu.Lock()
	defer fdt.mu.Unlock()
	fdt.records = make(map[string][]DamageRecord)
}

// ── 킬/어시스트/전멸 처리 ──

// FactionKillEvent는 팩션 킬 이벤트 정보를 담는다.
type FactionKillEvent struct {
	KillerId       string  `json:"killerId"`
	KillerFaction  string  `json:"killerFaction"`
	TargetId       string  `json:"targetId"`
	TargetFaction  string  `json:"targetFaction"`
	Gold           int     `json:"gold"`
	NationScore    int     `json:"nationScore"`
	RegionPointRP  int     `json:"regionPointRP"`
	IsWipeKill     bool    `json:"isWipeKill"`
	GameTime       float64 `json:"-"`
}

// FactionAssistEvent는 팩션 어시스트 이벤트 정보를 담는다.
type FactionAssistEvent struct {
	AssisterId     string `json:"assisterId"`
	AssisterFaction string `json:"assisterFaction"`
	TargetId       string `json:"targetId"`
	TargetFaction  string `json:"targetFaction"`
	Gold           int    `json:"gold"`
	NationScore    int    `json:"nationScore"`
	RegionPointRP  int    `json:"regionPointRP"`
}

// OnFactionKill은 팩션 PvP 킬을 처리하고 포인트를 계산한다.
func (fcs *FactionCombatSystem) OnFactionKill(
	killerId, targetId string,
	gameTime float64,
	alivePlayers map[string]bool, // playerId → alive 여부
) (*FactionKillEvent, []FactionAssistEvent) {
	killerFaction := fcs.factionRegistry.GetFactionId(killerId)
	targetFaction := fcs.factionRegistry.GetFactionId(targetId)

	// 1. 팩션 전멸 확인
	isWipeKill := fcs.checkFactionWipe(targetFaction, targetId, alivePlayers)

	// 2. 킬 이벤트 생성
	killGold := FactionKillGold
	killNS := FactionKillNationScore
	killRP := FactionKillRP

	if isWipeKill {
		killGold += FactionWipeGold
		killNS += FactionWipeNationScore
		killRP += FactionWipeRP
	}

	killEvent := &FactionKillEvent{
		KillerId:      killerId,
		KillerFaction: killerFaction,
		TargetId:      targetId,
		TargetFaction: targetFaction,
		Gold:          killGold,
		NationScore:   killNS,
		RegionPointRP: killRP,
		IsWipeKill:    isWipeKill,
		GameTime:      gameTime,
	}

	// 3. 팩션 RP 누적
	fcs.addFactionRP(killerFaction, killRP, 0, 0)
	if isWipeKill {
		fcs.addFactionRP(killerFaction, 0, 0, FactionWipeRP)
	}

	// 4. 어시스트 처리
	assistRecords := fcs.damageTracker.GetAssistants(targetId, killerId, gameTime)
	var assistEvents []FactionAssistEvent
	for _, r := range assistRecords {
		assistEvent := FactionAssistEvent{
			AssisterId:      r.AttackerId,
			AssisterFaction: r.FactionId,
			TargetId:        targetId,
			TargetFaction:   targetFaction,
			Gold:            FactionAssistGold,
			NationScore:     FactionAssistNationScore,
			RegionPointRP:   FactionAssistRP,
		}
		assistEvents = append(assistEvents, assistEvent)
		fcs.addFactionRP(r.FactionId, 0, FactionAssistRP, 0)
	}

	// 5. 데미지 기록 정리
	fcs.damageTracker.ClearTarget(targetId)

	return killEvent, assistEvents
}

// checkFactionWipe는 타겟 팩션의 마지막 멤버 사망 여부를 확인한다.
func (fcs *FactionCombatSystem) checkFactionWipe(
	targetFaction, dyingPlayerId string,
	alivePlayers map[string]bool,
) bool {
	members := fcs.factionRegistry.GetFactionMembers(targetFaction)
	for _, m := range members {
		if m == dyingPlayerId {
			continue // 죽는 플레이어는 제외
		}
		if alivePlayers[m] {
			return false // 아직 살아있는 멤버가 있음
		}
	}
	return true // 모든 멤버 사망 → 전멸
}

// addFactionRP는 팩션 RP를 누적한다.
func (fcs *FactionCombatSystem) addFactionRP(factionId string, killRP, assistRP, wipeRP int) {
	if factionId == "" {
		return
	}
	fcs.factionRPMu.Lock()
	defer fcs.factionRPMu.Unlock()

	score, ok := fcs.factionRP[factionId]
	if !ok {
		score = &FactionCombatScore{FactionId: factionId}
		fcs.factionRP[factionId] = score
	}

	if killRP > 0 {
		score.Kills++
		score.KillRP += killRP
	}
	if assistRP > 0 {
		score.Assists++
		score.AssistRP += assistRP
	}
	if wipeRP > 0 {
		score.Wipes++
		score.WipeRP += wipeRP
	}
	score.TotalRP = score.KillRP + score.AssistRP + score.WipeRP
}

// GetFactionRP는 특정 팩션의 전투 RP를 반환한다.
func (fcs *FactionCombatSystem) GetFactionRP(factionId string) *FactionCombatScore {
	fcs.factionRPMu.RLock()
	defer fcs.factionRPMu.RUnlock()

	if score, ok := fcs.factionRP[factionId]; ok {
		return score
	}
	return &FactionCombatScore{FactionId: factionId}
}

// GetAllFactionRP는 모든 팩션의 전투 RP를 반환한다.
func (fcs *FactionCombatSystem) GetAllFactionRP() map[string]*FactionCombatScore {
	fcs.factionRPMu.RLock()
	defer fcs.factionRPMu.RUnlock()

	result := make(map[string]*FactionCombatScore, len(fcs.factionRP))
	for k, v := range fcs.factionRP {
		cp := *v
		result[k] = &cp
	}
	return result
}

// ResetRound는 라운드 전환 시 RP 및 데미지 기록을 초기화한다.
func (fcs *FactionCombatSystem) ResetRound() {
	fcs.factionRPMu.Lock()
	fcs.factionRP = make(map[string]*FactionCombatScore)
	fcs.factionRPMu.Unlock()

	fcs.damageTracker.Reset()
}

// ── 팩션 생존 현황 ──

// FactionSurvivalStatus는 팩션별 생존 현황을 나타낸다.
type FactionSurvivalStatus struct {
	FactionId   string `json:"factionId"`
	FactionName string `json:"factionName"`
	Color       string `json:"color"`
	TotalCount  int    `json:"totalCount"`
	AliveCount  int    `json:"aliveCount"`
	Eliminated  bool   `json:"eliminated"`
}

// GetFactionSurvivalStatuses는 모든 팩션의 생존 현황을 반환한다.
func (fcs *FactionCombatSystem) GetFactionSurvivalStatuses(
	alivePlayers map[string]bool,
) []FactionSurvivalStatus {
	factionIds := fcs.factionRegistry.GetAllFactionIds()
	statuses := make([]FactionSurvivalStatus, 0, len(factionIds))

	for _, fid := range factionIds {
		members := fcs.factionRegistry.GetFactionMembers(fid)
		aliveCount := 0
		for _, m := range members {
			if alivePlayers[m] {
				aliveCount++
			}
		}

		statuses = append(statuses, FactionSurvivalStatus{
			FactionId:   fid,
			FactionName: fcs.factionRegistry.GetFactionName(fid),
			Color:       fcs.factionRegistry.GetFactionColor(fid),
			TotalCount:  len(members),
			AliveCount:  aliveCount,
			Eliminated:  aliveCount == 0,
		})
	}

	return statuses
}

// ── 팩션별 색상 팔레트 (8색) ──

// FactionColors는 8가지 팩션 식별 컬러 팔레트를 정의한다.
var FactionColors = [8]string{
	"#EF4444", // Red — 레드
	"#3B82F6", // Blue — 블루
	"#22C55E", // Green — 그린
	"#F59E0B", // Amber — 앰버
	"#8B5CF6", // Violet — 바이올렛
	"#EC4899", // Pink — 핑크
	"#06B6D4", // Cyan — 시안
	"#F97316", // Orange — 오렌지
}

// GetFactionColorByIndex는 인덱스로 팩션 컬러를 반환한다.
func GetFactionColorByIndex(idx int) string {
	return FactionColors[idx%len(FactionColors)]
}
