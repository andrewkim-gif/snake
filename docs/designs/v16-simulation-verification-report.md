# v16 시뮬레이션 기획서 검증 리포트

> **검증 대상**: `docs/designs/v16-simulation-system-plan.md`
> **검증일**: 2026-03-07
> **검증 방법**: 실제 서버 코드베이스 API 표면 대조 분석 + 심층 전투/레벨링/빌드 시스템 검증
> **Go 빌드 상태**: ✅ `go build ./...` SUCCESS

---

## Summary

| 카테고리 | 이슈 수 | Critical | High | Medium | Low |
|---------|---------|----------|------|--------|-----|
| API 불일치 | 12 | 3 | 5 | 3 | 1 |
| 아키텍처 갭 | 5 | 2 | 2 | 1 | 0 |
| 타입 불일치 | 4 | 1 | 2 | 1 | 0 |
| 설계 리스크 | 4 | 1 | 1 | 2 | 0 |
| **1차 소계** | **25** | **7** | **10** | **7** | **1** |
| 전투 모델 불일치 | 4 | 2 | 1 | 1 | 0 |
| 레벨/빌드 시스템 갭 | 5 | 0 | 3 | 1 | 1 |
| 신규 코드 필요 항목 | 5 | 0 | 2 | 3 | 0 |
| 기타 | 4 | 0 | 0 | 2 | 2 |
| **2차 소계** | **18** | **2** | **6** | **7** | **3** |
| **총합계** | **43** | **9** | **16** | **14** | **4** |

---

## 🚨 Critical Issues (즉시 수정 필요)

### C-01: Arena/Room에 외부 틱 메서드가 없음

- **위치**: 기획서 §6.2 `e.world.TickActiveArenas()` (line 714)
- **근거**: `Arena.Run(ctx)`와 `Room.Run(ctx)`는 모두 **블로킹 자체 루프**. `processTick()`, `tick()`은 모두 unexported(private). 외부에서 틱을 주입하는 API가 없음.
- **영향**: 시뮬레이션 엔진이 가속 시간으로 아레나를 구동할 수 없음. 핵심 메인 루프 전체가 작동 불가.
- **수정안**:
  - **(A) Export tick 메서드 추가** — `Arena.ProcessOneTick()`, `Room.ProcessOneTick()` public 메서드 신설. SimulationEngine이 자체 루프에서 호출.
  - **(B) 기존 패턴 유지** — `Arena.Run(ctx)` goroutine 방식 그대로 유지하되, SimClock이 `time.Timer`를 가로채서 가속. 이 경우 `time.NewTicker` 대신 커스텀 심 타이머 주입 필요.
  - **권장**: (A). 기존 `cmd/balance/main.go`도 `arena.Run(ctx)` goroutine + `bm.UpdateBots()` 패턴을 사용 중이므로, 외부 tick export가 가장 직관적.

### C-02: WorldManager에 `DeployAgent()` 메서드 없음

- **위치**: 기획서 §6.3 `e.world.DeployAgent(agent.ID, deployment.TargetCountry)` (line 768)
- **근거**: WorldManager는 `JoinCountry(clientID, countryISO, name, skinID, appearance)` 메서드만 제공. 이것은 **인간 플레이어**를 위한 것으로, clientID(WebSocket 세션)를 전제함. AI 에이전트를 임의 국가에 배치하는 API 없음.
- **영향**: 시뮬레이션 시드 프로세스(§6.3)와 배치 최적화(§7.3) 전체가 작동 불가.
- **수정안**:
  - `WorldManager.DeploySimAgent(agentID, countryISO string, agent *domain.Agent) error` 신설
  - `CountryArena.AddSimAgent(agent *domain.Agent, factionID string)` 신설 — WebSocket clientID 없이 에이전트 추가
  - 내부적으로 `JoinCountry`의 로직을 분리하여 재사용

### C-03: 시간 가속 시 Arena 내부 `time.NewTicker`와 충돌

- **위치**: 기획서 §9.1 SimClock 설계 전체
- **근거**: Arena.Run()은 `time.NewTicker(50ms)`를 내부에서 생성 (arena.go:96). Room.Run()도 마찬가지. 이들은 **실제 wall clock**에 바인딩됨. SimClock으로 가속해도 Arena 내부 타이머는 실시간으로 동작.
- **영향**: ×10 이상 가속이 불가능. 50ms 틱을 5ms로 줄이려면 Arena 내부 수정 필수.
- **수정안**:
  - **(A) Clock 인터페이스 주입** — Arena/Room 생성자에 `Clock` 인터페이스를 주입하여 `time.NewTicker` 대신 `clock.NewTicker` 사용. 프로덕션은 `RealClock`, 시뮬레이션은 `SimClock` 주입.
  - **(B) C-01의 (A)안 채택** — 외부 tick export 시 자연스럽게 해결됨. 틱 호출 빈도를 SimulationEngine이 제어.
  - **권장**: (B). C-01 해결 시 자동 해결됨.

### C-04: `domain.Agent`에 `FactionID` 필드 없음

- **위치**: 기획서 §5, §6.5, §7 전체 — 팩션 기반 스코어링의 핵심
- **근거**: `domain.Agent`에 `Nationality` 필드만 존재. `FactionID`는 없음. 현재 팩션-에이전트 매핑은 `CountryArena.agentFaction map[string]string`에서 별도 관리됨.
- **영향**: 통계적 전투 근사(§6.5)에서 `agent.FactionID`로 팩션별 전투력 합산 불가. 에이전트 레벨에서 팩션 정보 접근 불가.
- **수정안**:
  - **(A) domain.Agent에 FactionID 추가** — `FactionID string json:"factionId,omitempty"` 필드 추가 (v16 마이그레이션)
  - **(B) 외부 매핑 유지** — SimState에서 `agentFaction map[string]string` 별도 관리 (domain 수정 없음)
  - **권장**: (A). 프로토콜에도 노출되므로 클라이언트에서 팩션 식별 가능.

### C-05: `WorldManager`에 `Factions()`, `Economy()` 접근자 없음

- **위치**: 기획서 §6.3 `e.world.Factions().CreateFaction(...)`, `e.world.Economy().InitializeAll()` (lines 754, 773)
- **근거**: WorldManager는 FactionManager, EconomyEngine, DiplomacyEngine에 대한 참조를 보유하지 않음. 이들은 `meta` 패키지의 독립 서브시스템으로, `cmd/server/main.go`에서 개별 초기화됨.
- **영향**: 기획서의 `e.world.Factions()`, `e.world.Economy()`, `e.world.EconomyTick()`, `e.world.DiplomacyTick()` 호출 전부 불가.
- **수정안**:
  - **(A) SimulationEngine이 직접 참조** — WorldManager를 통하지 않고 SimEngine이 FactionManager, EconomyEngine 등을 직접 보유 (권장)
  - **(B) WorldManager에 접근자 추가** — `SetFactionManager()`, `SetEconomyEngine()` 등 주입 + `Factions()`, `Economy()` getter 추가
  - **권장**: (A). WorldManager의 책임 범위를 유지하면서 SimEngine이 오케스트레이터 역할.

### C-06: BotManager에 TrainingProfile/BuildPath 설정 메서드 없음

- **위치**: 기획서 §3.2 Layer 2 (line 326-339) TacticalDirective
- **근거**: `BotManager`는 봇 생성 시 `AllBuildPaths[rand.Intn(len(AllBuildPaths))]`로 **랜덤** 빌드패스 할당. 외부에서 특정 빌드패스를 지정하거나 TrainingProfile을 설정하는 메서드가 없음. `SetTrainingProfile()`, `SetBuildPath()` 모두 없음.
- **영향**: 전략 AI가 전술 레이어에 지시(TacticalDirective)를 내리는 것이 불가능. Layer 2 전체가 작동 안 함.
- **수정안**:
  - `BotManager.SetBotBuildPath(botID string, path BotBuildPath)` 메서드 추가
  - `BotManager.SetBotCombatStyle(botID string, style CombatStyle)` 메서드 추가
  - 또는 `BotManager.ApplyTacticalDirective(botID string, directive TacticalDirective)` 통합 메서드

### C-07: `BattleResult` 타입이 domain에 없음 + `ResourceBundle` 미정의

- **위치**: 기획서 §2.4 `BattleResult`, §7.2 `ResourceBundle`
- **근거**: `world.BattleResult`는 world 패키지에 정의되어 있으나 (`world_manager.go`), domain에는 없음. `ResourceBundle`은 `meta/faction.go`에 정의됨. 기획서는 이들이 공유 타입인 것처럼 참조하지만 패키지 경계가 다름.
- **영향**: 패키지 간 순환 의존 위험. SimEngine이 두 패키지 모두 import 시 문제 없으나, strategy 패키지에서 둘 다 필요할 때 주의.
- **수정안**: `BattleResult`를 domain 패키지로 승격하거나, 시뮬레이션 전용 타입 정의

### C-08: `agent.CombatPower()` 메서드가 존재하지 않음

- **위치**: 기획서 §6.5 line 834 `power := agent.CombatPower()`
- **근거**: `domain.Agent`에 `CombatPower()` 메서드가 없음. Agent는 60+ 필드(HP, MaxHP, Defense, BaseDPS, CritChance, WeaponSlots, Passives, Level 등)를 가지지만 이를 단일 스칼라로 집계하는 함수가 없음.
- **영향**: 통계적 전투 근사(§6.5)가 비활성 아레나(~145국)의 전투 결과를 결정하는 핵심 공식. 이것 없이는 Turbo/Headless 모드 전체 불가.
- **수정안**: `func CombatPower(a *domain.Agent) float64` 구현. 공식: `(BaseHP + Level*HPPerLevel) * (WeaponDPS * PassiveMult * CritMult) / (1 + Defense*0.01)`. 10종 무기 × 5 진화 레벨 + 10종 패시브 스택 + 시너지 보너스 고려 필요. 비자명한 구현.

### C-09: v10 Mass 기반 vs v14 HP 기반 — 이중 전투 모델 미해결

- **위치**: 기획서 §6.5, §9.3 전체 — 전투력 계산의 기초
- **근거**: 코드베이스에 두 전투 시스템이 공존:
  - **v10**: `agent.Mass` 기반 HP, 8 Tome(패시브 스택), 6 Ability(자동발동), 10 시너지, Aura DPS + Dash 대미지
  - **v14**: `agent.HP` 기반 (BaseHP=100, +10/Level), 10 Weapon(Lv1-5 진화, 자동사격), 10 Passive(스택형), 10 v14 시너지, StatusEffect(화상/둔화/기절)
- **영향**: 기획서가 어느 전투 모델을 사용하는지 명시하지 않음. `CombatPower()` 공식, `TierAgentBuffs`, `SimplifiedArena` 모두 이 결정에 의존.
- **수정안**: 기획서에 "시뮬레이션은 v14 HP+Weapon 전투 모델 사용"을 명시. v10 Mass/Tome/Ability는 레거시로 취급.

---

## ⚠️ High Priority Issues (조기 수정 권장)

### H-01: EconomyEngine에 `InitializeAll()` 없음 — 195국 개별 호출 필요

- **위치**: 기획서 §6.3 `e.world.Economy().InitializeAll()` (line 773)
- **근거**: EconomyEngine은 `InitializeCountry(iso3, tier, oil, minerals, food, tech, manpower)` 메서드만 제공. 195국 일괄 초기화 메서드 없음.
- **영향**: 시뮬레이션 시드 단계에서 195국 초기화에 대한 래퍼 필요.
- **수정안**: SimEngine에서 `for iso := range countries { economy.InitializeCountry(iso, ...) }` 루프 작성. 또는 `EconomyEngine.InitializeAll(countries []CountryConfig)` 편의 메서드 추가.

### H-02: WorldManager 배틀 스케줄링이 `time.AfterFunc` 기반

- **위치**: 기획서 §6.2 메인 루프의 ArenaScheduler 호출
- **근거**: `WorldManager.ScheduleBattle(countryISO)`와 `startBattle()`/`endBattle()`이 `time.AfterFunc()` (실제 시간) 사용. 배틀 라이프사이클이 wall clock에 바인딩.
- **영향**: 시뮬레이션에서 배틀 시작/종료 타이밍을 가속할 수 없음. ×10 가속 시에도 배틀은 실시간으로 진행.
- **수정안**: C-01(A)안 채택 시, SimEngine이 배틀 라이프사이클을 직접 관리하면 해결. `WorldManager.startBattle()` 로직을 분리하여 SimEngine에서도 호출 가능하게.

### H-03: WarManager 전쟁 단계 전환이 `time.Sleep()` goroutine 기반

- **위치**: 기획서 §7.4 WarStrategyAI의 전쟁 실행
- **근거**: `DeclareWar()` 성공 후 `scheduleWarPhases()` goroutine이 `time.Sleep(48h)` (준비 기간), `time.Sleep(warDuration)` 으로 단계 전환. 실제 시간에 바인딩.
- **영향**: 48시간 준비 기간이 시뮬레이션에서 48시간 소요. ×1000 가속 불가.
- **수정안**: `WarManager.AdvancePhase(warID)` 수동 단계 전환 메서드 추가. 또는 SimEngine이 WarRecord 상태를 직접 조작.

### H-04: DiplomacyEngine 메서드명 불일치 — `ProposeAlliance()` → `ProposeTreaty()`

- **위치**: 기획서 §7.5 DiplomacyAI
- **근거**: 기획서의 `ProposeAlliance(factionA, factionB)` 호출은 실제로 `ProposeTreaty(id, DiplomacyAlliance, factionA, factionB, proposedBy)`. Treaty 타입 파라미터가 추가로 필요.
- **영향**: 기획서 pseudocode 수정 필요. 기능적으로는 작동 가능하나 API 시그니처 불일치.
- **수정안**: 기획서의 DiplomacyAI를 `ProposeTreaty()` API에 맞게 수정. 또는 `ProposeAlliance(a, b, proposedBy)` 편의 메서드 추가.

### H-05: SovereigntyEngine에 `TransferCountry()` 없음 — `ProcessBattleResult()`만 존재

- **위치**: 기획서 §6.5 전투 결과 처리 → 영토 변경
- **근거**: 기획서가 가정하는 직접적 영토 이전 API가 없음. 영토 변경은 오직 `ProcessBattleResult(result BattleResult)`를 통해서만 가능 (반응형).
- **영향**: 시뮬레이션에서 프로그래밍적 영토 할당(초기 시드, 테스트)이 불가. 항상 BattleResult를 생성해서 전달해야 함.
- **수정안**: `SovereigntyEngine.ForceTransfer(iso3, newFactionID string)` 메서드 추가 (시뮬레이션/관리 전용).

### H-06: TrainingStore가 BotManager와 완전 분리됨

- **위치**: 기획서 §3.2 Layer 2 — TacticalDirective에서 빌드패스/전투스타일 적용
- **근거**: `TrainingStore`는 에이전트 프로필을 JSON으로 저장/로드하지만, `BotManager`가 `TrainingStore`에 대한 참조가 전혀 없음. 봇 생성 시 `AllBuildPaths[rand.Intn(5)]`으로 랜덤 할당 — 프로필 미참조.
- **영향**: 훈련 프로필 기반 봇 행동 제어 불가. Layer 2의 TacticalDirective 적용 경로 없음.
- **수정안**: `BotManager.SetTrainingStore(ts *TrainingStore)` 주입 + 봇 생성 시 프로필 참조 로직 추가.

### H-07: CountryArena가 BotManager를 노출하지 않음

- **위치**: 기획서 §6.3 에이전트 배치, §6.5 전투 시뮬레이션
- **근거**: CountryArena는 내부적으로 `game.Room`을 래핑하며, Room이 BotManager를 관리. 외부에서 봇을 직접 추가/제거/제어하는 API 없음.
- **영향**: SimEngine이 특정 국가 아레나에 전략 AI가 지시한 에이전트를 배치할 수 없음.
- **수정안**: `CountryArena.GetBotManager() *BotManager` 접근자 추가. 또는 `AddSimBot(config BotConfig)` 전용 메서드.

### H-08: EconomyEngine.Tick()이 자동 타이머 기반 — 외부 제어 불가

- **위치**: 기획서 §6.2 `economyTick()` 호출
- **근거**: `EconomyEngine.Start(ctx)` 실행 시 `TickInterval` (기본 1시간) 간격으로 자체 goroutine이 `Tick()` 호출. 외부에서 틱 빈도를 제어하거나 수동 호출하는 패턴이 아님.
- **영향**: 시뮬레이션에서 경제 시간 가속 불가. 1시간 경제 틱을 즉시 실행할 수 없음.
- **수정안**: `EconomyEngine.ManualTick() EconomyTickSummary` 메서드 추가 (Start 없이 수동 호출). 시뮬레이션 시 `Start()` 호출 않고 `ManualTick()`만 사용.

### H-09: DiplomacyEngine에 자동 틱 없음 — 수동 조율 필요

- **위치**: 기획서 §6.2 `diplomacyTick()` 호출
- **근거**: `ExpireOldTreaties()`와 `ProcessTributeTick()`은 존재하지만 자동 호출 안 됨. 현재 `EconomyEngine`이 내부적으로 `ProcessTributeTick()` 호출하며, `ExpireOldTreaties()`는 별도 호출 필요.
- **영향**: SimEngine이 직접 `ExpireOldTreaties()` 호출 타이밍을 관리해야 함.
- **수정안**: 기획서에 DiplomacyTick 수동 호출 명시. SimEngine이 economyTick 후 diplomacyTick 순서로 호출.

### H-10: `DeclareWar()`가 WarManager와 DiplomacyEngine 양쪽에 존재

- **위치**: 기획서 §7.4 전쟁 선포
- **근거**: `WarManager.DeclareWar(attackerID, defenderID)`와 `DiplomacyEngine.DeclareWar(id, attackerID, defenderID)` 양쪽에 존재. 시맨틱 중복으로 인해 어느 것을 호출해야 하는지 혼란.
- **영향**: 잘못된 엔트리 포인트 호출 시 비용 차감/유효성 검증 누락 가능.
- **수정안**: 기획서에 `WarManager.DeclareWar()`를 표준 엔트리 포인트로 명시 (비용 차감 + 유효성 검증 포함).

### H-11: v14 빌드패스 부재 — 기존 5 빌드패스가 v10 Tome/Ability만 커버

- **위치**: 기획서 §3.1, §3.2 TacticalDirective
- **근거**: `AllBuildPaths`(berserker, tank, speedster, vampire, scholar)의 Priority 리스트가 v10 Tome(`TomeDamage`, `TomeCursed` 등)과 Ability만 참조. v14의 10 Weapon + 10 Passive + 5 진화 레벨 조합을 위한 빌드패스가 없음.
- **영향**: v14 전투 모델 사용 시 기존 빌드패스가 무기 선택/패시브 우선순위를 지정하지 못함. Layer 2 TacticalDirective의 `BuildPath` 지정이 실질적 효과 없음.
- **수정안**: v14 전용 빌드패스 추가: `WeaponBerserker`(Bonk+Flame+Fury 패시브), `WeaponTank`(Crystal+Gravity+IronSkin), `WeaponAssassin`(Shadow+Chain+Precision) 등.

### H-12: MaxLevel 20 (v14) vs 12 (v10) — 기획서의 레벨 기반 계산 보정 필요

- **위치**: 기획서 §6.5 전투력 계산, §3.4 TierAgentBuffs
- **근거**: v10 `MaxLevel=12` (XP 0-345), v14 `V14MaxLevel=20` (XP 0-2120). 기획서는 "level"을 범용적으로 참조하나 어느 시스템인지 미명시. Lv20 v14 에이전트는 HP=290 + 5무기슬롯(Lv5) — Lv12 v10보다 훨씬 강력.
- **영향**: `CombatPower()` 공식, `TierAgentBuffs.XPMult` 보정, `SimplifiedArena` 시뮬레이션 정확도에 직접 영향.
- **수정안**: 기획서에 "v14 레벨링 (MaxLevel=20)" 명시. CombatPower에 WeaponEvolution(Lv5=1.6x DPS, 1.5x Range, 0.7x CD) 반영.

### H-13: 시너지 20종 (v10 10종 + v14 10종) — 기획서의 "10 시너지" 과소 기재

- **위치**: 기획서 §3.1 빌드 시스템 참조
- **근거**: v10 시너지 10종(holy_trinity, glass_cannon, iron_fortress 등) + v14 시너지 10종(thermal_shock, assassins_mark, fortress 등) = 총 20종. 기획서가 "10 synergies"로만 표기.
- **영향**: 빌드패스-시너지 타겟 매핑이 불완전. 통계적 전투 근사에서 시너지 보너스 계산 부정확.
- **수정안**: 시너지 목록을 v10+v14 전체 20종으로 갱신. v14 시너지 요건(무기 조합 기반)을 빌드패스에 반영.

### H-14: `agent.EffectiveDPS` 필드/메서드 없음 — SimplifiedArena의 핵심

- **위치**: 기획서 §9.3 line 1406 `damage := agent.EffectiveDPS * 0.2`
- **근거**: Agent에 `BaseDPS float64` 필드는 있으나, `EffectiveDPS`(풀 무기/패시브/시너지 보정 적용 DPS)는 존재하지 않음. 실제 DPS 계산은 `WeaponSystem.ProcessWeapons()`에서 무기별 개별 처리.
- **영향**: SimplifiedArena(×100+ 가속 모드)의 전투 로직이 동작 불가.
- **수정안**: `func EffectiveDPS(a *domain.Agent) float64` 구현 — 모든 WeaponSlot의 `BaseDPS * EvolutionMult * (1 + Fury*0.15) * CritMult` 합산.

### H-15: `NationalPersonality` 5축 시스템은 100% 신규 — 기존 PersonalityType(6종)과 무관

- **위치**: 기획서 §4.1 5-axis NationalPersonality
- **근거**: `training.go`의 `PersonalityType`(aggro, cautious, scholar, gambler, balanced, adaptive)은 개별 봇 행동 프리셋. 기획서의 NationalPersonality(Aggression, Expansion, Cooperation, Economy, Adaptability — float64 0~1 범위)는 완전히 다른 개념.
- **영향**: 195국 성격 프로필 데이터(§4.3)와 성격→전략 매핑 로직(§4.4) 전체가 신규 코드. 기존 코드 재사용 부분 없음.
- **수정안**: 기획서에 "NationalPersonality는 100% 신규 구현, 기존 PersonalityType과 독립" 명시. 195국 tuning 데이터는 별도 작업.

---

## 💡 Medium Priority Issues (설계 보완 권장)

### M-01: `NewArena()` 파라미터 없음 — 커스텀 설정 주입 불가

- **위치**: 기획서 §6.4 아레나 스케줄링, §9.2 ArenaScheduler
- **근거**: `game.NewArena()`는 **파라미터 0개**. 아레나 반지름, 봇 수, 틱레이트 등 모든 설정이 상수(`constants.go`)로 하드코딩. 시뮬레이션에서 아레나별 다른 설정 불가.
- **영향**: 소규모 테스트용 아레나(반지름 500, 봇 5체) vs 풀스케일(반지름 3000, 봇 30체) 분리 불가.
- **수정안**: `NewArenaWithConfig(cfg ArenaConfig)` 추가 또는 기존 `NewArena()` 유지 + 시뮬레이션은 상수 조작.

### M-02: MaxConcurrentArenas=50 — 195국 동시 시뮬레이션 제약

- **위치**: 기획서 §9.2 ArenaScheduler의 arenasCap
- **근거**: WorldManager의 `MaxConcurrentArenas` 기본값 50. 195국 전체를 동시 아레나로 실행하면 한계 초과.
- **영향**: 기획서의 아레나 스케줄러가 이미 이 제약을 고려(배치 라운드 로빈)하지만, 피크 시 병목 가능.
- **수정안**: 기획서의 ArenaScheduler 설계는 적절. SimEngine 생성 시 `MaxConcurrentArenas=50` 유지하되, 기획서에 배치 크기 제약 명시 권장.

### M-03: `game.sh`에 `simulate` 서브커맨드 없음

- **위치**: 기획서 §10 CLI 인터페이스
- **근거**: 현재 game.sh는 `dev|server|build|balance|loadtest|stop|help` 만 지원. `simulate` 서브커맨드는 새로 추가 필요.
- **영향**: 구현 시 CLI 엔트리 포인트 추가 필요.
- **수정안**: `game.sh simulate`를 `balance` 패턴과 동일하게 추가. `cmd/simulate/main.go` 작성 + `game.sh` 에 `simulate)` case 추가.

### M-04: 새로운 바이옴/장애물 시스템이 시뮬레이션 계획에 미반영

- **위치**: 기획서 전체 — 지형 효과 미언급
- **근거**: v16 Phase 5에서 추가된 바이옴(6종: Plains~Volcanic) + 장애물(8종: Rock~Altar)이 이동속도·시야에 영향. BiomeMap의 SpeedModifier(0.5~1.0×), VisionModifier(0.5~1.0×)가 전투 결과에 유의미한 영향.
- **영향**: 통계적 전투 근사(§6.5)에서 지형 효과를 무시하면 정확도 하락.
- **수정안**: SimBattleApproximation에 `terrainAdvantage` 보정 계수 추가. 국가별 바이옴 분포에 따른 방어 보너스 고려.

### M-05: HeightmapGenerator의 시드 기반 재현성 — 시뮬레이션 장점

- **위치**: 기획서 §9 아레나 모드
- **근거**: `GenerateHeightmap(seed int64, radius float64, biomeMap)` — 시드 기반이므로 동일 시드에서 동일 지형 재현 가능. 시뮬레이션 재현성에 유리.
- **영향**: 기획서에서 이 특성을 활용하면 A/B 테스트, 전략 비교에 유용.
- **수정안**: 기획서 §9에 시드 관리 전략 추가 (국가별 고정 시드 vs 라운드별 랜덤 시드).

### M-06: Redis가 WorldManager에서 선택적이나 Sovereignty에서 필수적

- **위치**: 기획서 §6 시뮬레이션 인프라
- **근거**: `NewWorldManager(cfg)` — Redis 미사용 가능. 하지만 `SovereigntyEngine`은 `RestoreFromRedis(ctx)` + `ProcessBattleResult()`에서 Redis 저장. 시뮬레이션에서 Redis 없이 Sovereignty 사용 시 저장 실패 가능.
- **영향**: 헤드리스 시뮬레이션에서 Redis 의존성 회피 필요.
- **수정안**: `SovereigntyEngine`에 `InMemoryMode bool` 옵션 추가하여 Redis 스킵. 또는 SimEngine이 자체 SimSovereignty 래퍼 사용.

### M-07: Agent.Mass (v10 레거시) 여전히 존재 — 시뮬레이션 물리 모델 확인 필요

- **위치**: 기획서 §6.5 전투력 계산
- **근거**: `domain.Agent`에 `Mass float64`가 여전히 존재 (v10 뱀 세그먼트 시절 잔재). 현재 전투에서 실제 사용 여부 불명확.
- **영향**: 시뮬레이션 전투력 계산에서 Mass를 포함할지 판단 필요.
- **수정안**: 실제 전투 로직에서 Mass 사용 여부 확인 후, 미사용이면 기획서에서 제외.

### M-08: `SimAgentLite` 타입이 코드베이스에 없음 — SimplifiedArena 전용 타입 필요

- **위치**: 기획서 §9.3 line 1392 `type SimplifiedArena struct { agents []*SimAgentLite }`
- **근거**: `SimAgentLite`는 기획서에서만 참조되며 실제 코드에 없음. `domain.Agent`는 60+ 필드로 SimplifiedArena에서 사용하기에 과중.
- **영향**: ×100+ 가속 모드의 경량 전투 시뮬레이션에 필요한 타입 미정의.
- **수정안**: `simulation/types.go`에 `SimAgentLite{Position, HP, DPS, Faction, Level, Alive}` 정의. `domain.Agent`에서 프로젝션 함수 제공.

### M-09: `CountryState.SovereignFaction` comma-ok 패턴 오류 — pseudocode 문법 불일치

- **위치**: 기획서 §6.5 line 845 `if sovereign, ok := country.SovereignFaction; ok {`
- **근거**: `SovereignFaction`은 `string` 타입. Go의 comma-ok 패턴은 map lookup에만 사용. 올바른 코드는 `if country.SovereignFaction != "" {`.
- **영향**: pseudocode 수준 오류. 구현 시 수정 필요.
- **수정안**: 기획서 pseudocode 수정.

### M-10: `ResourceBundle` 패키지 경계 — `meta` 내부 타입을 strategy에서 import

- **위치**: 기획서 §7.2 `SituationAssessment.ResourceBalance.Oil`
- **근거**: `ResourceBundle{Gold, Oil, Minerals, Food, Tech, Influence}`는 `meta/faction.go`에 정의. strategy 패키지에서 import 가능하나, 패키지 의존 방향 주의 필요.
- **영향**: `simulation/strategy/` → `meta/` 의존은 허용되지만, 역방향 의존이 생기면 순환 위험.
- **수정안**: 단방향 의존 유지 확인. 필요 시 `domain`에 `ResourceSnapshot` 인터페이스 추가.

### M-11: Agent.Gold(인게임 화폐)와 국가 GDP 간 브릿지 부재

- **위치**: 기획서 §8.1~§8.3 경제 자동화
- **근거**: `domain.Agent.Gold int`(인게임 화폐)와 `meta/economy.go`의 국가 GDP는 별개 시스템. 에이전트가 벌어들인 Gold가 국가 경제에 반영되는 경로 없음.
- **영향**: 시뮬레이션의 경제 모델이 매크로(국가 GDP)만 다루고 마이크로(에이전트 Gold)를 무시하면 경제 시뮬레이션 정확도 하락.
- **수정안**: 에포크 종료 시 `AgentGoldTotal → CountryGDP 기여` 공식 추가 (기획서에 명시 권장).

---

## 📌 Low Priority Issues (참고 사항)

### L-01: 기획서 에포크 10분 vs 실제 Room 라운드 5분 — 용어 혼란

- **위치**: 기획서 부록 line 1749
- **근거**: EpochManager는 10분 사이클(Peace→War→Shrink→End→Transition), Room 라운드는 `RoundDurationSec=300`(5분). 기획서가 "10분 에포크"로 통일 표기하나 실제 구현은 두 시간 단위 공존.
- **수정안**: 기획서에 "에포크 = EpochManager 10분 사이클, 라운드 = Room 5분 전투" 용어 명확화.

### L-02: 195국 성격 프로필 tuning 데이터 — 검증 불가

- **위치**: 기획서 §4.3 국가별 5축 성격 값
- **근거**: USA(0.8, 0.9, 0.5, 0.7, 0.8), CHN(0.6, 0.8, 0.4, 0.9, 0.7) 등 수치가 합리적이나, 실제 게임 밸런스 테스트 전까지 정확도 검증 불가.
- **수정안**: 플레이테스트 플래그 부착. 초기값은 현행 유지, 시뮬레이션 결과 기반 반복 조정.

### L-03: `CountrySeed.Adjacency` vs `CountryState.Adjacent` 필드명 불일치

- **위치**: 팩션 형성 알고리즘 (§5.2~§5.3)
- **근거**: Seed 데이터는 `Adjacency []string`, 런타임 State는 `Adjacent []string`. 기능적 동일하나 필드명이 다름.
- **수정안**: 코드 일관성을 위해 하나로 통일하거나, 기획서에서 어느 필드를 사용할지 명시.

### L-04: 기획서 "16 tactical commands" 수치 미검증

- **위치**: 기획서 부록 line 1754
- **근거**: `AgentCommandRouter`의 실제 커맨드 수와 기획서의 "16 types" 주장 간 정확한 대조 미완료.
- **수정안**: `agent_api.go`의 실제 커맨드 열거 후 기획서 수치 갱신.

---

## 🔧 Recommended Actions (우선순위별 수정 계획)

### Phase A: 핵심 인프라 수정 (Critical 이슈 해결)

| 순서 | 대상 | 작업 | 이슈 |
|-----|------|------|------|
| A1 | `game/arena.go` | `Arena.ProcessOneTick()` public 메서드 추가 | C-01, C-03 |
| A2 | `game/room.go` | `Room.ProcessOneTick()` public 메서드 추가 | C-01, C-03 |
| A3 | `world/world_manager.go` | `DeploySimAgent()` 메서드 추가 | C-02 |
| A4 | `world/country_arena.go` | `AddSimAgent()` + `GetBotManager()` 추가 | C-02, H-07 |
| A5 | `domain/types.go` | `Agent.FactionID string` 필드 추가 | C-04 |
| A6 | `game/bot.go` | `SetBotBuildPath()`, `SetBotCombatStyle()` 추가 | C-06 |
| A7 | `domain/types.go` | `BattleResult` 타입 승격 (world→domain) | C-07 |
| A8 | `game/agent.go` | `CombatPower(a *Agent) float64` 함수 구현 | C-08 |
| A9 | 기획서 §6.5 | v14 HP+Weapon 전투 모델 사용 명시 | C-09 |

### Phase B: 시간 가속 + 전투 모델 지원 (High 이슈 해결)

| 순서 | 대상 | 작업 | 이슈 |
|-----|------|------|------|
| B1 | `meta/economy.go` | `ManualTick()` 메서드 추가 (Start 없이 호출) | H-08 |
| B2 | `meta/war.go` | `AdvancePhase(warID)` 수동 전환 추가 | H-03 |
| B3 | `world/sovereignty.go` | `ForceTransfer(iso3, factionID)` 추가 | H-05 |
| B4 | `game/bot.go` | `BotManager.SetTrainingStore(ts)` 주입 추가 | H-06 |
| B5 | `game/build_path.go` | v14 Weapon+Passive 빌드패스 추가 (5종+) | H-11 |
| B6 | `game/agent.go` | `EffectiveDPS(a *Agent) float64` 함수 구현 | H-14 |
| B7 | 기획서 §3, §6.5 | MaxLevel=20, 시너지 20종 반영 | H-12, H-13 |

### Phase C: 시뮬레이션 엔진 구현

| 순서 | 대상 | 작업 | 이슈 |
|-----|------|------|------|
| C1 | `cmd/simulate/main.go` | CLI 엔트리 포인트 작성 | M-03 |
| C2 | `game.sh` | `simulate` 서브커맨드 추가 | M-03 |
| C3 | `simulation/engine.go` | SimulationEngine 오케스트레이터 | 전체 |
| C4 | `simulation/types.go` | SimAgentLite, SimState 등 경량 타입 | M-08 |
| C5 | `simulation/strategy/` | 4-Layer AI + NationalPersonality(100% 신규) | H-15 |
| C6 | `simulation/clock.go` | SimClock, ArenaScheduler | C-03 |
| C7 | `simulation/combat.go` | 통계적 전투 근사 (v14 모델 기반) | C-08, H-14 |

### Phase D: 기획서 수정사항

| 대상 | 수정 내용 |
|------|----------|
| §1.5 시스템 관계도 | meta 시스템이 WorldManager 하위가 아님을 명시 (C-05) |
| §6.2 메인 루프 | `e.world.TickActiveArenas()` → `SimEngine.TickArenas()` 직접 관리 |
| §6.3 시드 프로세스 | `e.world.DeployAgent()` → `countryArena.AddSimAgent()` |
| §6.3 경제 초기화 | `e.world.Economy().InitializeAll()` → 195국 개별 루프 |
| §6.5 전투 근사 | **v14 HP+Weapon 전투 모델 명시** + 바이옴/지형 보정 계수 + `CombatPower()` 공식 |
| §6.5 SovereignFaction | comma-ok 문법 수정 → `!= ""` 비교 (M-09) |
| §3.1 빌드 시스템 | 시너지 20종 (v10 10종 + v14 10종) + v14 빌드패스 추가 |
| §3.4 레벨링 | v14 MaxLevel=20, WeaponEvolution(Lv1-5) 반영 |
| §7.5 DiplomacyAI | `ProposeAlliance()` → `ProposeTreaty(DiplomacyAlliance, ...)` |
| §9.1 SimClock | Arena 외부 틱 방식으로 설계 변경 (내부 타이머 불사용) |
| §9.3 SimplifiedArena | `SimAgentLite` 타입 정의 + `EffectiveDPS()` 함수 사용 |
| 전체 | `e.world.Factions()` → `e.factions.` 직접 참조 |
| 전체 | `e.world.Economy()` → `e.economy.` 직접 참조 |

---

## ✅ Positive Findings (활용 가능한 기반)

### P-01: `cmd/balance/main.go` 헤드리스 시뮬레이션 패턴 검증 완료

- **근거**: 기존 밸런스 도구가 `Arena + BotManager`를 네트워킹 없이 실행. 1000라운드 × 30봇 시뮬레이션 안정 동작. 이벤트 핸들러 콜백 패턴(`arena.EventHandler = func(...)`)도 검증됨.
- **활용**: SimulationEngine의 아레나 실행 패턴을 balance.go에서 직접 차용 가능. `go arena.Run(ctx)` + `bm.UpdateBots()` 패턴 재사용.

### P-02: EpochManager가 틱 기반으로 시뮬레이션 친화적

- **근거**: `EpochManager.Tick(tick)` — 외부에서 틱을 주입하는 유일한 컴포넌트. 내부 타이머 없음, 외부 의존성 없음, 완전 결정론적.
- **활용**: 시뮬레이션 시간 가속과 완벽 호환. 모든 컴포넌트가 이 패턴을 따르면 이상적.

### P-03: FactionManager.CreateFaction() API 정확히 일치

- **근거**: `CreateFaction(id, name, tag, color, leaderID string)` — 기획서와 **시그니처 100% 일치**. 팩션 생성 로직 수정 불필요.
- **활용**: 팩션 자동 형성(§5) 구현 시 기존 API 그대로 사용.

### P-04: NewWorldManager() API 정확히 일치

- **근거**: `NewWorldManager(cfg WorldConfig)` — 기획서 시그니처와 일치. Redis는 선택적.
- **활용**: SimEngine에서 WorldManager를 Redis 없이 생성 가능.

### P-05: Arena + BotManager 자체 완결형 (네트워킹 불필요)

- **근거**: Arena와 BotManager는 WebSocket, HTTP, Redis 등 외부 인프라 없이 독립 실행 가능. 순수 게임 로직만 포함.
- **활용**: 시뮬레이션에서 네트워크 계층 완전 배제 가능. 메모리 사용량 대폭 절감.

### P-06: CountryArena 팩션 스코어링 시스템 완비

- **근거**: `AddFactionScore()`, `GetBattleResults()`, `GetDetailedBattleResults()`, `DetermineWinningFaction()` — 팩션 기반 전투 결과 집계가 이미 구현되어 있음. 20% 방어자 보너스도 포함.
- **활용**: 통계적 전투 근사(§6.5)의 결과 처리에 활용 가능.

### P-07: HeightmapGenerator 시드 기반 재현성

- **근거**: `GenerateHeightmap(seed int64, radius, biomeMap)` — 동일 시드에서 동일 지형 보장. 3-layer Perlin octave + Voronoi 바이옴.
- **활용**: 시뮬레이션 재현성(같은 초기 조건에서 같은 결과)에 직접 기여. A/B 테스트, 전략 비교에 유용.

### P-08: 이벤트 핸들러 콜백 패턴 확장 용이

- **근거**: `Arena.EventHandler func(events []ArenaEvent)` + `Room.OnEvents RoomEventCallback` — 콜백 체인 방식. SimEngine이 이벤트 핸들러를 등록하면 전투 이벤트 수집 가능.
- **활용**: 시뮬레이션 메트릭 수집(킬/데스, 레벨업, 시너지 발동 등)에 바로 활용.

### P-09: DiplomacyEngine 쿼리 API 풍부

- **근거**: `AreAllied()`, `AreAtWar()`, `HasNonAggressionPact()`, `HasTradeAgreement()`, `HasSanction()`, `GetActiveTreaties()` — 외교 상태 조회 API가 충분.
- **활용**: DiplomacyAI(§7.5)의 의사결정에 필요한 정보 접근 모두 가능.

### P-10: 아레나 풀링 시스템 구현 완료

- **근거**: WorldManager의 `arenaPool []*CountryArena` — 아레나 생성/해제 오버헤드를 줄이는 오브젝트 풀링. `Reinitialize()` 메서드로 재사용.
- **활용**: 195국 순환 시뮬레이션에서 아레나 GC 부담 최소화.

---

## 📊 API 매칭 점수표

| 서브시스템 | 기획서 API 수 | 일치 | 부분일치 | 불일치 | Match Rate |
|-----------|-------------|------|---------|-------|-----------|
| WorldManager | 6 | 1 | 1 | 4 | 17% |
| FactionManager | 3 | 3 | 0 | 0 | 100% |
| EconomyEngine | 4 | 2 | 1 | 1 | 50% |
| DiplomacyEngine | 3 | 0 | 2 | 1 | 0% |
| WarManager | 3 | 2 | 0 | 1 | 67% |
| SovereigntyEngine | 2 | 0 | 1 | 1 | 0% |
| BotManager | 3 | 1 | 0 | 2 | 33% |
| Arena/Room | 4 | 1 | 0 | 3 | 25% |
| domain types | 5 | 3 | 0 | 2 | 60% |
| **API 소계** | **33** | **13** | **5** | **15** | **39%** |

| 전투/레벨 모델 | 검증 항목 | 일치 | 부분일치 | 불일치 | 상세 |
|---------------|---------|------|---------|-------|------|
| CombatPower() | 1 | 0 | 0 | 1 | 메서드 부재 |
| EffectiveDPS | 1 | 0 | 0 | 1 | 메서드 부재 |
| 전투 모델 선택 | 1 | 0 | 0 | 1 | v10 vs v14 미결정 |
| 빌드패스 (v14) | 1 | 0 | 0 | 1 | v10만 존재 |
| 레벨 시스템 | 1 | 0 | 1 | 0 | MaxLevel 12→20 |
| 시너지 수 | 1 | 0 | 1 | 0 | 10→20 |
| PersonalityType | 1 | 0 | 0 | 1 | 6종 이산 vs 5축 float |
| SimAgentLite | 1 | 0 | 0 | 1 | 타입 부재 |
| **전투 소계** | **8** | **0** | **2** | **6** | **0%** |

> **종합 API 매치율: 32%** (41 항목 중 13 일치 + 7 부분일치)
>
> 기획서는 기존 인프라의 **구조적 기반**(Arena, WorldManager, meta 시스템)을 정확히 파악했으나,
> **전투 메커닉스 레벨**(v10/v14 이중 모델, 무기 진화, 패시브 스택)의 세부 사항을 충분히 반영하지 못했다.
> Phase A(9항목) + Phase B(7항목) = **16개 수정**으로 구현 가능 수준 도달.

---

## 📈 코드베이스 규모

| 패키지 | 파일 수 | LOC | 비고 |
|--------|--------|-----|------|
| `internal/game/` | 65 | 25,011 | 전투 엔진 (Arena, Agent, Weapon, Bot) |
| `internal/world/` | 8 | 3,667 | 195국 관리 (WorldManager, Sovereignty) |
| `internal/meta/` | 18 | 10,797 | 메타 시스템 (Economy, Diplomacy, War, Faction) |
| `internal/domain/` | ~8 | ~2,500 | 공유 타입 (Agent 60+ fields, Events) |
| **기존 합계** | **~99** | **~42,000** | |
| `internal/simulation/` | 0 | 0 | **신규 패키지 필요** |
| `internal/strategy/` | 0 | 0 | **신규 패키지 필요** |
| `cmd/simulate/` | 0 | 0 | **신규 CLI 필요** |

---

## 🎯 결론

**시뮬레이션 시스템 구현 가능성: ✅ 가능 (조건부)**

### 근거

1. **Go 빌드 상태**: `go build ./...` SUCCESS — 코드베이스 안정
2. **검증된 헤드리스 패턴**: `cmd/balance/main.go` (707줄)가 Arena+BotManager 무한 시뮬 가능 증명
3. **견고한 기반**: 42K LOC의 게임/월드/메타 시스템이 195국 인프라 제공
4. **EpochManager 틱 기반**: 유일하게 외부 틱 주입 가능한 컴포넌트 — 시뮬레이션 모범 패턴

### 핵심 수정 범위 (4대 블로커)

1. **Arena/Room 외부 틱 API** (C-01, C-03) — 전체 시뮬레이션의 기초. 이것 없이는 시간 가속 불가.
2. **전투 모델 확정 + CombatPower()** (C-08, C-09) — 통계적 전투 근사의 기초. v14 모델 표준화 필수.
3. **에이전트 배치 API** (C-02, H-07) — 시뮬레이션 시드 프로세스의 기초.
4. **시간 가속 지원** (H-03, H-08) — WarManager/EconomyEngine의 wall-clock 바인딩 해제.

### 작업량 추정

| 구분 | 비율 | 설명 |
|------|-----|------|
| 신규 코드 (기존 미수정) | ~35% | SimEngine, StrategyAI, CLI, SimClock |
| 기존 API 오케스트레이션 | ~25% | FactionManager, DiplomacyEngine 등 연결 |
| 기존 코드 소규모 수정 | ~25% | 16개 메서드 추가 (모두 additive, 기존 동작 미변경) |
| 기존 코드 중규모 수정 | ~15% | EconomyEngine ManualTick, WarManager 단계 전환 추출 |

### 리스크 평가

- **LOW 리스크**: 모든 수정이 additive (기존 API에 새 public 메서드만 추가, 기존 동작 불변)
- **MEDIUM 리스크**: EconomyEngine/WarManager 내부 goroutine 리팩토링 (auto-tick → manual-tick 분리)
- **HIGH 리스크 수정 없음**: 기존 서버 동작을 변경하는 수정 불필요

이 4대 블로커 해결 후, 기획서 §3~§8의 AI 전략 레이어(NationalPersonality, FactionFormation, DiplomacyAI, WarStrategyAI, EconomyAI)는 기존 API를 충분히 활용하여 구현 가능하다.
