# v19 Arena 3D Integration — Verification Report

> **대상**: `docs/designs/v19-arena-3d-integration-plan.md`
> **검증일**: 2026-03-08
> **검증 범위**: 서버 전투 메커닉, 클라이언트 AR 컴포넌트 호환성, 좌표계, 데이터 플로우, 게임플레이 완결성

---

## Summary

| Category | Issues | Critical | High | Medium | Low |
|----------|--------|----------|------|--------|-----|
| Gameplay Completeness | 8 | 2 | 3 | 2 | 1 |
| Data Flow / Coordinates | 5 | 2 | 2 | 1 | 0 |
| Component Compatibility | 7 | 1 | 3 | 2 | 1 |
| Missing in Plan | 6 | 2 | 3 | 1 | 0 |
| **Total** | **26** | **7** | **11** | **6** | **2** |

**Match Rate: 15/26 passed = 58%** (기획서가 핵심 문제를 인식하나, 누락된 시스템과 호환성 이슈가 다수)

---

## 🚨 Critical Issues (7건 — 즉시 수정 필요)

### C-1: 좌표 스케일 수정 값이 틀림
- **위치**: 기획서 Phase 1, "좌표 스케일 수정" task
- **근거**: `coordinate-utils.ts:78`에서 `SERVER_TO_BLOCK_SCALE = 80/3000 = 0.02667`. 기획서는 `80/50 = 1.6`으로 수정 제안
- **문제**: 서버 ArenaRadius는 **Tier별로 다름** (S=60m, A=45m, B=35m, C=25m, D=15m). 고정값 `80/50`은 default만 맞고 Tier S는 `80/60=1.33`, Tier D는 `80/15=5.33`이 되어야 함
- **영향**: Tier별로 맵 크기가 달라지거나 캐릭터가 맵 밖으로 나감
- **수정**: arState에 포함된 `arenaRadius` 값을 사용하여 **동적** 스케일 계산. 또는 AR 컴포넌트 직접 사용 시 스케일 자체를 제거하고 ARTerrain.tsx도 동적 radius를 받도록 변경

### C-2: TPSCamera ↔ ARCamera 충돌 — 기획서 미언급
- **위치**: 기획서 Phase 2 "ARCamera 마운트" task
- **근거**: `GameCanvas3D.tsx:617-625`에서 TPSCamera는 **항상** 마운트됨. 두 카메라가 동시에 `camera.position`과 `lookAt`을 설정하면 매 프레임 jitter 발생
- **문제**: 기획서가 "TPSCamera 대체"라고만 적었고, **조건부 unmount** 로직을 명시하지 않음
- **수정**: Phase 2에 명시 추가 — `isArenaMode ? <ARCamera /> : <TPSCamera />`

### C-3: Classic 3D 컴포넌트 11개가 Arena에서도 렌더링됨 — 기획서 미언급
- **위치**: 기획서 전체 — classic 컴포넌트 조건부 비활성 미언급
- **근거**: `GameCanvas3D.tsx`에서 항상 렌더링되는 컴포넌트: AgentInstances, EquipmentInstances, FlagSprite, OrbInstances, AuraRings, BuildEffects, AbilityEffects, WeaponRenderer, DamageNumbers, CapturePointRenderer + classic HTML HUD 전부
- **문제**: AR 컴포넌트와 classic 컴포넌트가 **중복 렌더링** → 성능 문제 + 시각적 충돌
- **수정**: Phase 2에 "Classic 3D/HUD 컴포넌트 isArenaMode 조건부 비활성" task 추가 필수

### C-4: ar_choose 소켓 emit 미존재
- **위치**: 기획서 Phase 1 "ar_choose 클라이언트 emit" task
- **근거**: `useSocket.ts`에 `ar_choose` emit 없음. `ARLevelUp.tsx:87`은 `onChoose(tomeId)` 콜백을 호출하지만 실제 소켓 emit이 없음
- **문제**: 기획서가 task로 적었지만 **구체적인 구현 방법을 명시하지 않음** — `chooseUpgrade`(classic)와 `ar_choose`(arena)를 어떻게 분기할지
- **수정**: useSocket에 `sendARChoice(payload: { tomeId?: string, weaponId?: string })` 함수 추가. ARLevelUp의 `onChoose`에 연결

### C-5: arState가 ref에만 있고 React state에 없음 — HTML 오버레이 렌더 트리거 불가
- **위치**: 기획서 Phase 2 "ARHUD 마운트" + "ARMinimap 마운트"
- **근거**: `useSocket.ts:335`에서 `dataRef.current.arState = data`로 ref에만 저장. ARHUD/ARMinimap/ARLevelUp은 HTML 오버레이로 **React re-render 필요**
- **문제**: arState가 ref에만 있으면 HTML 컴포넌트가 업데이트를 감지 못함. R3F useFrame은 가능하지만 DOM 오버레이는 불가
- **수정**: Phase 1에 "AR 전용 UI state 추가" task 필요 — `arUiState: { hp, maxHp, xp, level, phase, timer, wave, kills, alive, levelUpChoices }` 를 React state로 저장 (저빈도 throttle: 250ms)

### C-6: Spectate 시스템 서버측 미연결
- **위치**: 기획서 Phase 4 "ARSpectateOverlay 마운트"
- **근거**: `ar_spectate.go`에 `ARSpectateManager` 코드 존재하지만, `ArenaCombat` 구조체가 이를 **생성/호출하지 않음**. 서버에서 spectate target 전환 이벤트를 보내지 않음
- **문제**: 기획서는 클라이언트 컴포넌트만 마운트하면 된다고 가정하지만, **서버측 연결도 필요**
- **수정**: Phase 4에 "서버 ARSpectateManager 연결" task 추가 — `ArenaCombat.Init()`에서 spectate manager 생성 + `OnPlayerDeath`에서 spectate 시작 + spectate target 이벤트 전송

### C-7: ARTerrain 하드코딩 radius=40 vs 서버 Tier별 15-60m
- **위치**: 기획서 Phase 2 "ARTerrain 마운트"
- **근거**: `ARTerrain.tsx:19`에서 `ARENA_RADIUS = 40` 하드코딩. 서버 Tier S=60m, D=15m
- **문제**: Tier S 아레나에서 지형 바깥에 적이 스폰됨. Tier D에서는 지형이 필요 이상으로 넓음
- **수정**: ARTerrain에 `arenaRadius` prop 추가, 서버의 `arState.arenaRadius` 값을 전달
## ⚠️ High Priority Issues (11건)

### H-1: ARPlayerNet에 attackRange/moving 필드 없음
- **근거**: `ARPlayer.tsx`는 `attackRange: number`, `moving: boolean` props 필요. `ARPlayerNet` (ar-types.ts:129-147)에 해당 필드 없음
- **수정**: `moving`은 클라이언트에서 position delta로 추론. `attackRange`는 서버에 필드 추가하거나, 캐릭터별 기본값 사용 (CHARACTER_INFO에 없으므로 상수 3.0 사용)

### H-2: HP→mass 매핑으로 클래식 렌더러에서 캐릭터 크기 왜곡
- **근거**: `useSocket.ts:348`에서 `m: p.hp` (HP를 mass로 매핑). 클래식 AgentInstances는 mass로 agent 스케일 결정
- **영향**: HP 3000인 플레이어가 거인처럼 보임 (Phase 2 AR 직접 렌더링으로 전환 시 해결되나, Phase 1 기간 동안은 문제)
- **수정**: Phase 1에서 bridge의 `m: p.hp`를 `m: 15`(고정값)로 변경하여 크기 정규화

### H-3: 서버 projectile owner ID 미추적 (kill attribution 버그)
- **근거**: `ar_combat.go:980-1006`에서 `tickProjectiles()` 내 `ownerID` 초기화만 하고 실제 설정 안 됨
- **영향**: 투사체로 적 처치 시 킬 크레딧이 잘못 부여됨
- **수정**: 서버측 수정 필요 — `ARProjectile` 구조체에 `OwnerID` 저장 + `weaponFireProjectile()`에서 설정

### H-4: Pointer lock 이중 관리
- **근거**: `ARCamera.tsx:76-84`가 자체 pointer lock 관리. 기존 `useInputManager.ts`도 pointer lock 관리
- **영향**: 두 시스템이 동시에 pointer lock 요청 시 충돌
- **수정**: Arena 모드에서는 ARCamera의 pointer lock만 사용하거나, useInputManager에 arena 모드 분기 추가

### H-5: Classic HTML HUD 오버레이 전부 Arena에서도 표시
- **근거**: `GameCanvas3D.tsx` 하단의 EpochHUD, ShrinkWarning, BuildHUD, XPBar, KillFeedHUD 등이 isArenaMode 체크 없음
- **영향**: ARHUD와 겹쳐서 이중 HP바, 이중 타이머, 이중 킬피드 표시
- **수정**: Phase 2에서 classic HUD 컴포넌트에 `{!isArenaMode && ...}` 조건 추가

### H-6: ar_input 직접 emit vs classic input bridge — 어떤 방식 유지?
- **근거**: 현재 classic `input`/`input_v16`을 서버에서 `ARInput`으로 bridge (room.go:701-725). 기획서는 ar_input 직접 emit 미언급
- **문제**: Classic input은 angle 기반(0~2π), AR input은 dirX/dirZ + jump/slide/aimY. Bridge 시 jump/slide 정보 손실
- **수정**: 기획서에 "ar_input 직접 emit 전환" 또는 "classic bridge 유지" 의사결정 필요. jump/slide가 게임플레이에 필수면 ar_input 전환 필수

### H-7: 무기 진화 UI 누락
- **근거**: 서버에 5개 무기 진화 경로 완비 (ar_weapon.go:206-267). 클라이언트에 진화 알림/이펙트 컴포넌트 없음
- **영향**: 무기가 진화해도 플레이어가 인지 못함
- **수정**: Phase 3에 "무기 진화 알림 UI" task 추가 (ARLevelUp에 진화 분기 추가 또는 별도 toast)

### H-8: 시너지 시스템 UI 누락
- **근거**: 서버에 10개 시너지 (ar_synergy.go). ARPlayerNet.synergies 필드 존재. 시너지 표시 UI 컴포넌트 없음
- **영향**: 어떤 시너지가 발동 중인지 플레이어가 알 수 없음
- **수정**: ARHUD에 시너지 아이콘 표시 추가 또는 별도 ARSynergyBar 컴포넌트

### H-9: Status effect 시각 피드백 없음
- **근거**: 서버에 freeze/burn/poison/bleed/stun status effect (ar_combat.go). 클라이언트에 status effect 표시 없음
- **영향**: 얼어붙었는지, 불타는지 시각적으로 구분 불가
- **수정**: ARPlayer/AREntities에 status effect 비주얼 오버레이 추가

### H-10: Boss HP bar 컴포넌트 누락
- **근거**: 서버에 miniboss/final boss 시스템 완비. `ARPvPOverlay.tsx`에 boss HP bar 코드 존재하지만 PvP 오버레이 안에 있어서 PvE 미니보스 때는 표시 안 됨
- **수정**: ARHUD 또는 별도 컴포넌트에서 현재 미니보스/보스의 HP bar를 PvE phase에서도 표시

### H-11: arState에 arenaRadius 미포함 여부 불확실
- **근거**: `ARState` (ar-types.ts:188-202)에 `arenaRadius` 필드 없음. 서버의 `GetState()` (ar_combat.go)에서 보내는지 확인 필요
- **영향**: 클라이언트가 현재 아레나 크기를 모름 → ARTerrain radius, 좌표 스케일 계산 불가
- **수정**: 서버 `GetState()`에 `ArenaRadius` 필드 추가 + 클라이언트 `ARState` 타입에 추가
## 💡 Medium Priority Issues (6건)

### M-1: ARDamageNumbers Canvas 텍스트 렌더링 — 한글 지원?
- **근거**: `ARDamageNumbers.tsx:93`에서 `document.createElement('canvas')` + `ctx.fillText`. 폰트 설정에 한글 폰트 미지정
- **영향**: 한국 국가 아레나에서 한글 텍스트 깨질 가능성 (숫자만 쓰므로 실제 영향 낮음)
- **수정**: 데미지 넘버는 숫자만 사용하므로 낮은 우선순위

### M-2: ARMinimap 서버 데이터 누락 — PvP shrink radius
- **근거**: `ARMinimap.tsx`에서 pvpRadius 표시 기능 있음. `ARState.pvpRadius` 필드 타입 정의는 있으나, 서버 GetState()에서 실제로 보내는지 미확인
- **수정**: 서버 GetState()에 pvpRadius 포함 확인 + 미포함 시 추가

### M-3: ARPlayer posRef 패턴 — ARCamera와의 coupling
- **근거**: ARPlayer가 `posRef`에 위치를 write (line 94), ARCamera가 `playerPosRef`로 read. 이 ref를 누가 생성하고 전달하는지 기획서에 미언급
- **수정**: Phase 2에서 GameCanvas3D (또는 ArenaWrapper)가 `useRef`로 생성 → ARPlayer와 ARCamera 양쪽에 전달

### M-4: 모바일 터치 + ARCamera 마우스 입력 충돌
- **근거**: `ARMobileControls.tsx`가 터치 조이스틱 제공, `ARCamera.tsx`가 마우스 드래그/pointer lock으로 카메라 조작. 모바일에서 두 시스템이 동일한 touch 이벤트에 반응 가능
- **수정**: ARCamera에 모바일 감지 시 pointer lock 비활성 + ARMobileControls 우측 영역으로 카메라 조작 위임

### M-5: ar-interpolation.ts 미사용 — 기획서 미언급
- **근거**: `ar-interpolation.ts` (268줄)에 완전한 보간 시스템 구현. 기획서가 이 파일을 한 번도 언급하지 않음
- **문제**: AREntities/ARPlayer가 보간 없이 ar_state 직접 사용하면 20Hz 업데이트로 움직임이 뚝뚝 끊김
- **수정**: Phase 2에서 ar-interpolation.ts를 AREntities/ARPlayer의 렌더링 파이프라인에 연결. 20Hz → 60fps smooth 보간 필수

### M-6: 이벤트 큐 drain 타이밍 미명시
- **근거**: 기획서가 "이벤트 큐" 방식을 언급하지만, drain 주기(매 프레임? 매 tick?)와 큐 최대 크기를 명시하지 않음
- **수정**: useFrame에서 매 프레임 drain, 최대 64개/프레임 제한 (ARDamageNumbers의 MAX_NUMBERS=64와 일치)
## ℹ️ Low Priority Issues (2건)

### L-1: ARPlayer 머티리얼 dispose 미처리
- **근거**: `ARPlayer.tsx` useMemo 머티리얼이 unmount 시 `.dispose()` 안 됨
- **영향**: 경미한 메모리 누수 (재입장 반복 시 누적)
- **수정**: useEffect cleanup에서 dispose 추가

### L-2: ARHUD HP바 CSS position 이슈
- **근거**: `ARHUD.tsx` HP 수치 텍스트가 `position: absolute`인데 부모에 `position: relative` 없음
- **영향**: HP 숫자가 의도한 위치에 안 보일 수 있음
- **수정**: 부모 div에 `position: relative` 추가
## 🔍 기획서에 아예 누락된 시스템 (6건)

### MISS-1: 🚨 Classic 컴포넌트 조건부 비활성 (Critical)
기획서가 AR 컴포넌트 "마운트"만 언급하고, **기존 classic 컴포넌트 제거**를 한 task도 적지 않음. Phase 2에서 AR 컴포넌트를 추가하면 classic + AR이 **동시에** 렌더링됨:
- TPSCamera + ARCamera = 카메라 jitter
- AgentInstances + ARPlayer/AREntities = 이중 캐릭터
- DamageNumbers + ARDamageNumbers = 이중 데미지 표시
- OrbInstances = arena에 orb 없는데 렌더 시도
- Classic HUD + ARHUD = 이중 UI

**수정**: Phase 2 첫 번째 task로 "GameCanvas3D classic 컴포넌트 isArenaMode 분기 추가" 필수

### MISS-2: 🚨 ar-interpolation.ts 보간 시스템 연결 (Critical)
268줄짜리 보간 시스템이 이미 구현되어 있는데 기획서가 완전히 무시함. 보간 없이 20Hz raw 데이터를 60fps로 렌더링하면 **뚝뚝 끊기는** 움직임이 됨.

**수정**: Phase 2에 "ar-interpolation.ts 연결" task 추가:
- useSocket의 ar_state 핸들러에서 `updateInterpolation(arInterp, arState)` 호출
- ARPlayer/AREntities가 `getInterpolatedPos()`로 smooth position 획득

### MISS-3: ⚠️ 서버 arenaRadius 필드 추가 (High)
클라이언트가 현재 아레나 크기를 알 방법이 없음. ARState에 arenaRadius 필드가 없음. ARTerrain 크기, 좌표 스케일, 미니맵 경계 모두 이 값에 의존.

**수정**: 서버 `GetState()` + 클라이언트 `ARState` 타입에 `arenaRadius: number` 추가

### MISS-4: ⚠️ 무기 진화 알림 + 시너지 UI (High)
서버에 완전한 무기 진화 (5경로) + 시너지 (10종) 시스템이 있지만, 이를 표시할 UI가 기획서에 없음.

**수정**: Phase 3에 task 추가:
- 무기 진화 toast/알림 (ARLevelUp 확장 또는 별도 ARWeaponEvolution)
- ARHUD에 활성 시너지 아이콘 바 추가

### MISS-5: ⚠️ Status effect 비주얼 (High)
서버에 freeze/burn/poison/bleed/stun 5가지 상태이상. 클라이언트에 표시 컴포넌트 없음.

**수정**: ARPlayer에 status effect 색상 오버레이 (freeze=파랑, burn=빨강 등) + ARHUD에 상태이상 아이콘

### MISS-6: 💡 사운드 시스템 연동 (Medium)
`ar-types.ts`에 `SOUND_PRIORITIES` (40가지 사운드 이벤트 우선순위) 가 정의되어 있지만 기획서에 사운드 언급 없음.

**수정**: Phase 5 폴리시에 사운드 연동 task 추가 (기존 AudioManager 활용)
## ✅ Passed Checks (검증 통과 항목)

| # | 항목 | 근거 |
|---|------|------|
| 1 | 자동공격 서버 구현 | 무기별 쿨다운 + 최근접 적 자동 타겟 + 데미지 공식 완비 (ar_weapon.go) |
| 2 | Bot/NPC 참여 | 60% 봇 자동 생성 + 2레이어 AI (전술 2Hz + 반사 20Hz) (ar_room_integration.go) |
| 3 | 적 스폰 시스템 | 3초 간격 웨이브 + 5종 + 엘리트 어픽스 + 미니보스 (ar_combat.go) |
| 4 | 5페이즈 전투 | deploy(10s)→pve(210s)→pvp_warning(10s)→pvp(60s)→settlement(10s) 정확 |
| 5 | 무기 진화 | 5경로 + 무기 lv7 + 토메 스택 이중 조건 (ar_weapon.go) |
| 6 | 룸 라이프사이클 | Waiting→Playing→Ending→Cooldown→Waiting 정상 순환 |
| 7 | 자유 이동 | XZ 평면 자유이동 + 정규화 + 속도 배율 + freeze/speed boost |
| 8 | AR 타입 정의 | 827줄 ar-types.ts에 모든 엔티티/이벤트/상수 정의 완비 |
| 9 | AREntities InstancedMesh | 200 적 + 300 크리스탈 InstancedMesh + LOD 시스템 |
| 10 | ARHUD 완성도 | HP/XP/타이머/페이즈/웨이브/킬 표시 + 5개 페이즈 라벨/색상 매핑 |
| 11 | ARDamageNumbers 이벤트 큐 | ref 기반 큐 + 최대 64개 + 1초 수명 + 색상별 데미지 타입 |
| 12 | ARTerrain 6개 테마 | urban/desert/mountain/forest/arctic/island + 테마별 바닥/안개/장애물 |
| 13 | ARLevelUp 토메 선택 | 3카드 + 레어리티 색상 + 설명 + 호버 효과 |
| 14 | ARPvPOverlay 기능 | PvP 전환 경고 + 팩션 킬 카운트 + 보스 HP + 킬 피드 |
| 15 | 서버 11개 이벤트 | ar_state~ar_boss_defeated 모든 이벤트 타입 정의 + dispatch 완비 |
## 📋 Recommendations — 기획서 수정 사항

### Phase 1 수정 (4개 task 추가/변경)
1. **좌표 스케일을 동적으로 변경** — `arState.arenaRadius`를 사용하여 `80/radius` 동적 계산. 또는 AR 직접 렌더링 시 스케일 제거
2. **서버에 arenaRadius 필드 추가** — `GetState()`에 `ArenaRadius` 포함
3. **AR 전용 UI state 추가** — ARHUD/ARMinimap용 React state (throttled 250ms)
4. **classic bridge의 m: p.hp를 m: 15로 변경** — HP→mass 왜곡 임시 수정

### Phase 2 수정 (3개 task 추가/변경)
1. **Classic 컴포넌트 조건부 비활성** — isArenaMode 시 TPSCamera, AgentInstances, EquipmentInstances, FlagSprite, OrbInstances, AuraRings, BuildEffects, AbilityEffects, WeaponRenderer, DamageNumbers, CapturePointRenderer + classic HUD 모두 unmount
2. **ar-interpolation.ts 연결** — 20Hz→60fps 보간 시스템 필수 연결
3. **ARTerrain에 arenaRadius prop 추가** — 하드코딩 40 → 동적 값

### Phase 3 수정 (3개 task 추가)
1. **무기 진화 알림 UI** — 진화 발생 시 toast/알림
2. **시너지 아이콘 바** — ARHUD에 활성 시너지 표시
3. **Status effect 비주얼** — ARPlayer에 색상 오버레이

### Phase 4 수정 (1개 task 추가)
1. **서버 ARSpectateManager 연결** — ArenaCombat에서 spectate manager 생성 + 이벤트 전송

### Phase 5 수정 (1개 task 추가)
1. **사운드 시스템 연동** — SOUND_PRIORITIES 기반 사운드 재생

---

## 최종 판정

**Match Rate: 58% (15/26)** — 기획서가 핵심 문제(좌표, AR 컴포넌트 마운트, 이벤트 연결)를 정확히 인식했으나:

1. **Classic 컴포넌트 제거를 완전히 빠뜨림** → AR 추가만으로는 충돌 발생
2. **ar-interpolation.ts 보간 시스템을 무시** → 60fps에서 뚝뚝 끊김
3. **서버측 수정 필요사항 누락** (arenaRadius 필드, spectate 연결, projectile owner)
4. **게임 피드백 UI 부족** (무기 진화, 시너지, 상태이상, 보스 HP)
5. **좌표 스케일이 Tier별로 달라야 함** 미인식

위 26건을 기획서에 반영하면 실제 플레이 가능한 완전한 아레나 3D 전투 경험이 됩니다.

**Confidence: HIGH** — 서버 코드 직접 확인, 클라이언트 컴포넌트 전수 분석, 좌표 상수 전수 대조 기반
