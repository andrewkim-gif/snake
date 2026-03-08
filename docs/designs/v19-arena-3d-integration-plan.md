# v19 Arena 3D Integration — 완전 통합 기획서

> **상태**: 서버 95% 완성, 클라이언트 0% 통합 → 이 기획서로 100% 연결
> **목표**: 17개 AR 컴포넌트 + 11개 AR 이벤트를 GameCanvas3D에 완전 통합
> **검증**: `docs/designs/v19-arena-verification-report.md` — 26건 발견, 전체 반영 완료

---

## 1. 현황 진단

### 1.1 작동 중인 파이프라인 (Classic Bridge)
```
Server ar_state (20Hz) → useSocket.ts bridge → StatePayload (classic format)
  → GameLoop interpolation → AgentInstances (classic 3D renderer)
```
- 플레이어 위치만 classic 형식으로 변환
- enemies[], xpCrystals[], projectiles[], items[], phase, wave, factionScores 전부 **버려짐**
- 좌표 스케일: `80/3000 = 0.02667` → Arena 좌표(0~50m)와 불일치 → **중앙에 뭉침**

### 1.2 단절된 시스템 (17 컴포넌트, 전부 orphan)

| # | 컴포넌트 | 파일 | 역할 | 우선순위 |
|---|---------|------|------|---------|
| 1 | ARHUD | `ar/ARHUD.tsx` | HP/XP/타이머/페이즈/웨이브/킬 | P0 |
| 2 | AREntities | `ar/AREntities.tsx` | 적+XP크리스탈 InstancedMesh | P0 |
| 3 | ARPlayer | `ar/ARPlayer.tsx` | 로컬 플레이어 복셀 캐릭터 | P0 |
| 4 | ARCamera | `ar/ARCamera.tsx` | 3인칭 추적 카메라 | P0 |
| 5 | ARTerrain | `ar/ARTerrain.tsx` | 국가 테마 지형 | P0 |
| 6 | ARMinimap | `ar/ARMinimap.tsx` | 아레나 미니맵 (HTML) | P0 |
| 7 | ARDamageNumbers | `ar/ARDamageNumbers.tsx` | 3D 플로팅 데미지 | P1 |
| 8 | ARNameTags | `ar/ARNameTags.tsx` | 팩션 이름표 | P1 |
| 9 | ARLevelUp | `ar/ARLevelUp.tsx` | 토메 선택 팝업 | P1 |
| 10 | ARPvPOverlay | `ar/ARPvPOverlay.tsx` | PvP 페이즈 UI | P1 |
| 11 | ARMobileControls | `ar/ARMobileControls.tsx` | 모바일 조이스틱 | P1 |
| 12 | ARSpectateOverlay | `ar/ARSpectateOverlay.tsx` | 관전 모드 UI | P2 |
| 13 | ARCharacterSelect | `ar/ARCharacterSelect.tsx` | 캐릭터 선택 화면 | P2 |
| 14 | ARBattleRewards | `ar/ARBattleRewards.tsx` | 전투 보상 요약 | P2 |
| 15 | ARProfile | `ar/ARProfile.tsx` | 플레이어 프로필 | P3 |
| 16 | ARQuestPanel | `ar/ARQuestPanel.tsx` | 퀘스트 표시 | P3 |
| 17 | ARSeasonPass | `ar/ARSeasonPass.tsx` | 시즌패스 표시 | P3 |

### 1.3 단절된 AR 이벤트 (서버 발신 → 클라이언트 미수신)

| 이벤트 | 서버 발신 | 클라이언트 수신 | 연결 컴포넌트 |
|--------|----------|----------------|-------------|
| `ar_state` | 20Hz | ✅ bridge only | — (arState 미사용) |
| `ar_damage` | 히트 시 | ❌ | ARDamageNumbers |
| `ar_level_up` | 레벨업 시 | ❌ | ARLevelUp |
| `ar_kill` | 적 처치 시 | ❌ | ARHUD kill count |
| `ar_phase_change` | 페이즈 전환 | ❌ | ARHUD, ARPvPOverlay |
| `ar_battle_end` | 전투 종료 | ❌ | ARBattleRewards |
| `ar_miniboss_death` | 미니보스 처치 | ❌ | ARDamageNumbers |
| `ar_elite_explosion` | 엘리트 자폭 | ❌ | ARDamageNumbers |
| `ar_pvp_kill` | PvP 처치 | ❌ | ARPvPOverlay |
| `ar_boss_spawn` | 보스 출현 | ❌ | ARHUD |
| `ar_boss_defeated` | 보스 격파 | ❌ | ARBattleRewards |

### 1.4 클라이언트 미발신 이벤트

| 이벤트 | 용도 | 현재 상태 |
|--------|------|----------|
| `ar_input` | 아레나 이동 입력 | 서버에서 classic input→ARInput 브리지 중 |
| `ar_choose` | 토메/무기 선택 | ❌ 미구현 |

---

## 2. 핵심 버그

### BUG-1: 좌표 스케일 불일치 (중앙 뭉침 현상)
- **원인**: `SERVER_TO_BLOCK_SCALE = 80/3000 = 0.02667`
- **문제**: Arena combat 좌표는 meter 단위 (Tier별 15~60m), classic은 pixel 단위 (3000px)
- **결과**: pos.x=25 × 0.02667 = 0.67 → 모든 에이전트가 원점 근처에 집중
- **Tier별 실제 반경**: S=60m, A=45m, B=35m, C=25m, D=15m
- **수정**: AR 컴포넌트 직접 사용 시 스케일 변환 제거 (meter를 Three.js 단위로 직접 사용). Classic bridge 경유 시 동적 스케일 `80/arState.arenaRadius` 적용

### BUG-2: ar_state 데이터 95% 폐기
- **원인**: bridge가 players[]만 AgentNetworkData로 변환
- **폐기 데이터**: enemies[], xpCrystals[], projectiles[], items[], phase, timer, wave, pvpRadius, factionScores
- **결과**: 적/크리스탈/투사체/아이템 안 보임, 타이머/페이즈 표시 안 됨

### BUG-3: arState 저장 후 미사용
- **원인**: `dataRef.current.arState = data` 저장하지만 어떤 컴포넌트도 읽지 않음
- **결과**: 17개 AR 컴포넌트가 데이터 접근 불가

### BUG-4: arState가 ref에만 있고 React state에 없음
- **원인**: HTML 오버레이 (ARHUD, ARMinimap, ARLevelUp)는 React re-render가 필요하나 ref 변경은 re-render를 트리거하지 않음
- **수정**: AR 전용 UI state를 React state로 저빈도 업데이트 (250ms throttle)

### BUG-5: 서버 arenaRadius 미전송
- **원인**: `ARState` 타입에 arenaRadius 필드 없음. 클라이언트가 현재 아레나 크기를 모름
- **영향**: ARTerrain 크기, 미니맵 경계, 좌표 스케일 모두 하드코딩에 의존
- **수정**: 서버 GetState()에 ArenaRadius 추가 + 클라이언트 ARState 타입에 추가

### BUG-6: 서버 Spectate 시스템 미연결
- **원인**: `ar_spectate.go`에 ARSpectateManager 코드 존재하나 ArenaCombat에서 생성/호출 안 함
- **영향**: 사망 후 관전 불가
- **수정**: ArenaCombat.Init()에서 spectate manager 생성, OnPlayerDeath에서 spectate 시작

### BUG-7: Projectile kill attribution 미구현
- **원인**: `ar_combat.go:980-1006` tickProjectiles()에서 ownerID 빈 문자열 → 킬 크레딧 잘못 부여
- **수정**: ARProjectile 구조체에 OwnerID 저장, weaponFireProjectile()에서 설정

---

## 3. 아키텍처 결정

### 결정 1: AR 전용 렌더링 분기 (Classic Bridge 제거)
Arena 모드에서는 classic bridge를 제거하고 AR 컴포넌트가 직접 arState를 소비한다.

```
Before:  ar_state → bridge → StatePayload → GameLoop → AgentInstances
After:   ar_state → arStateRef → AREntities + ARPlayer + ARHUD + ARMinimap (직접 소비)
```

### 결정 2: GameCanvas3D 내부 arena 분기
새 파일(ArenaCanvas3D) 대신 기존 GameCanvas3D 내부에 `isArenaMode` 분기를 확장한다.
이미 `isArenaMode` prop과 분기가 있으므로 확장이 자연스럽다.

### 결정 3: arState를 zustand store 또는 ref로 공유
`useSocket.ts`의 `dataRef.current.arState`를 AR 컴포넌트들이 읽도록 한다.
- 3D 컴포넌트 (R3F useFrame 내): `dataRef.current.arState` 직접 접근 (ref 기반, no re-render)
- HTML 오버레이 컴포넌트 (ARHUD, ARMinimap): React state로 일부 데이터 전파 (저빈도 업데이트)

### 결정 4: AR 이벤트 전용 store
`ar_damage`, `ar_level_up`, `ar_kill` 등은 이벤트 큐 방식으로 처리한다.
- `useSocket.ts`에서 이벤트 수신 → `arEventQueue` 배열에 push
- 컴포넌트가 useFrame에서 큐를 drain

---

## 4. 기술 스택

| 항목 | 기술 | 이유 |
|------|------|------|
| 3D 렌더링 | React Three Fiber v9 + drei | 기존 사용 중 |
| 상태 공유 | dataRef (MutableRefObject) | useFrame 호환, 리렌더 방지 |
| HTML 오버레이 | React state (저빈도) | ARHUD, ARMinimap은 DOM 렌더링 |
| 이벤트 큐 | Array ref + drain pattern | 데미지 넘버, 킬 피드 등 |
| 좌표계 | AR 직접 사용 (meter 단위) | 스케일 변환 제거 |

---

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| AR 컴포넌트 코드 품질 미검증 | 런타임 에러 | Phase별 빌드+E2E 검증 |
| Classic bridge 제거 시 회귀 | 기존 클래식 모드 깨짐 | isArenaMode 분기로 classic 무영향 |
| 200+ 엔티티 렌더링 성능 | FPS 저하 | InstancedMesh 기반 AREntities + LOD 시스템 |
| AR 컴포넌트 props 불일치 | 타입 에러 | ar-types.ts 기준으로 통일. attackRange/moving은 클라이언트 추론 |
| TPSCamera↔ARCamera 동시 마운트 | 카메라 jitter | isArenaMode 배타적 분기 (검증 보고서 C-2) |
| Classic+AR HUD 중복 | 이중 UI 표시 | Phase 2에서 classic HUD 조건부 비활성 (검증 보고서 C-3) |
| Pointer lock 이중 관리 | 입력 충돌 | Arena 모드: ARCamera 전용, 모바일: pointer lock 비활성 (검증 보고서 H-4) |
| 20Hz → 60fps 끊김 | 뚝뚝한 움직임 | ar-interpolation.ts 보간 시스템 연결 필수 (검증 보고서 MISS-2) |
| Tier별 arenaRadius 차이 | 지형 크기 불일치 | 서버 arenaRadius 전송 + ARTerrain 동적 radius (검증 보고서 C-7) |

---

## 구현 로드맵

<!-- da:work Stage 0 파싱 대상 -->

### Phase 1: 서버 보완 + 데이터 파이프라인
| Task | 설명 |
|------|------|
| 서버: arenaRadius 필드 추가 | GetState()에 ArenaRadius float64 추가 → 클라이언트 ARState 타입에도 arenaRadius: number 추가 |
| 서버: projectile ownerID 수정 | ARProjectile에 OwnerID 저장 + weaponFireProjectile()에서 설정 |
| 서버: ARSpectateManager 연결 | ArenaCombat.Init()에서 spectate manager 생성, OnPlayerDeath에서 spectate 시작 + spectate target 이벤트 전송 |
| classic bridge HP→mass 수정 | useSocket.ts ar_state bridge에서 `m: p.hp` → `m: 15` (고정값, HP가 에이전트 크기에 영향 방지) |
| AR 전용 UI state 추가 | useSocket에 `arUiState` React state 추가: hp, maxHp, xp, level, phase, timer, wave, kills, alive, levelUpChoices (250ms throttle) |
| arState ref 공개 | useSocket에서 `arStateRef`를 외부 접근 가능하게 export (또는 gameDataRef를 통해) |
| AR 이벤트 큐 시스템 | useSocket에 `arEventQueue: AREvent[]` ref 추가 + drain util (매 프레임 drain, 최대 64/프레임) |
| 10개 AR 이벤트 리스너 추가 | ar_damage, ar_level_up, ar_kill, ar_phase_change, ar_battle_end, ar_miniboss_death, ar_elite_explosion, ar_pvp_kill, ar_boss_spawn, ar_boss_defeated |
| ar_choose 클라이언트 emit | useSocket에 sendARChoice({ tomeId?, weaponId? }) 추가 |

- **design**: N
- **verify**: go build 성공, TypeScript 빌드 성공, E2E에서 ar_state.arenaRadius 수신 확인

### Phase 2: Classic 분기 + 코어 AR 컴포넌트 마운트 (P0 — 6개)
| Task | 설명 |
|------|------|
| Classic 3D 컴포넌트 조건부 비활성 | isArenaMode 시 TPSCamera, AgentInstances, EquipmentInstances, FlagSprite, OrbInstances, AuraRings, BuildEffects, AbilityEffects, WeaponRenderer, DamageNumbers, CapturePointRenderer 모두 `{!isArenaMode && ...}`로 감싸기 |
| Classic HTML HUD 조건부 비활성 | isArenaMode 시 EpochHUD, ShrinkWarning, BuildHUD, XPBar, KillFeedHUD 등 classic HUD 전부 비활성 |
| ar-interpolation.ts 연결 | useSocket ar_state 핸들러에서 `updateInterpolation(arInterp, arState)` 호출. ARPlayer/AREntities가 `getInterpolatedPos()`로 smooth 60fps position 획득 |
| ARTerrain 마운트 | isArenaMode 시 MCTerrain 대신 ARTerrain. **arenaRadius prop 추가** (하드코딩 40 → 서버 arState.arenaRadius) |
| ARPlayer 마운트 | 로컬 플레이어 복셀 캐릭터. moving은 position delta로 추론. attackRange는 기본 3.0 사용. posRef를 생성하여 ARCamera에 전달 |
| AREntities 마운트 | 적 + XP크리스탈 InstancedMesh (arState.enemies/xpCrystals → ar-interpolation 보간) |
| ARCamera 마운트 | 3인칭 추적 카메라 (playerPosRef 연결). **TPSCamera와 동시 마운트 금지** — isArenaMode 분기로 배타적 사용 |
| ARHUD 마운트 | HP/XP/타이머/페이즈/웨이브/킬 HTML 오버레이. **arUiState에서 데이터 수신** (ref가 아닌 React state) |
| ARMinimap 마운트 | 아레나 미니맵 (arState 기반 — 플레이어/적/아이템/경계 + arenaRadius 표시) |

- **design**: N
- **verify**: 빌드 성공, classic 모드 regression 없음, /arena에서 지형+캐릭터+적+HUD+미니맵 렌더링 + 60fps smooth 움직임 확인

### Phase 3: 전투 피드백 AR 컴포넌트 (P1 — 8개)
| Task | 설명 |
|------|------|
| ARDamageNumbers 마운트 | 3D 플로팅 데미지 (ar_damage → arEventQueue → addDamageNumber → 렌더링) |
| ARNameTags 마운트 | 팩션 이름표 (같은 팩션=파랑, 다른 팩션=빨강). ar-interpolation 보간 위치 사용 |
| ARLevelUp 마운트 | 레벨업 토메 선택 팝업 (ar_level_up → arUiState.levelUpChoices → 선택 → sendARChoice emit) |
| ARPvPOverlay 마운트 | PvP 페이즈 경고 + 팩션 킬 카운트 + **미니보스/보스 HP bar** (PvE+PvP 양쪽에서 표시) |
| ARMobileControls 마운트 | 모바일 터치 조이스틱. **ARCamera pointer lock과 충돌 방지** — 모바일 시 pointer lock 비활성, 우측 터치로 카메라 |
| 무기 진화 알림 UI | 서버의 5개 진화 경로 발동 시 toast 알림 (ARLevelUp 확장 또는 별도 컴포넌트) |
| 시너지 아이콘 바 | ARHUD에 활성 시너지 표시 (ARPlayerNet.synergies 기반, 10종 아이콘) |
| Status effect 비주얼 | ARPlayer/AREntities에 freeze(파랑)/burn(빨강)/poison(초록)/bleed/stun 색상 오버레이 |

- **design**: N
- **verify**: 빌드 성공, 데미지 넘버 표시, 레벨업→토메 선택→ar_choose emit 확인, PvP 전환 UI + 보스 HP 표시, 모바일 조작 정상

### Phase 4: 게임 흐름 AR 컴포넌트 (P2 — 3개)
| Task | 설명 |
|------|------|
| ARCharacterSelect 마운트 | deploy 페이즈에서 캐릭터 선택 (8종) → sendARChoice emit. deploy 10초 타이머 연동 |
| ARSpectateOverlay 마운트 | 사망 후 관전 UI. **서버 ARSpectateManager와 연동** — spectate target 이벤트 수신 + 좌우 전환 입력 전송 |
| ARBattleRewards 마운트 | ar_battle_end 이벤트에서 보상 요약 (토큰, XP, 퀘스트). 로비 복귀 버튼 |

- **design**: N
- **verify**: 빌드 성공, 캐릭터 선택→전투→사망→관전(타겟 전환)→전투 종료→보상 전체 플로우 동작

### Phase 5: 메타게임 AR 컴포넌트 (P3 — 3개) + 폴리시
| Task | 설명 |
|------|------|
| ARProfile 마운트 | 프로필 레벨, 통계, 업적 표시 |
| ARQuestPanel 마운트 | 일일/주간/시즌 퀘스트 진행 |
| ARSeasonPass 마운트 | 시즌패스 레벨/보상 트랙 |
| Classic bridge 정리 | isArenaMode 시 classic StatePayload 변환 제거 (AR 직접 렌더링으로 완전 전환) |
| 사운드 시스템 연동 | SOUND_PRIORITIES (40이벤트) 기반 사운드 재생. 기존 AudioManager 활용 |
| ARPlayer 머티리얼 dispose | useEffect cleanup에서 geometry/material dispose 추가 |
| ARHUD CSS 수정 | HP바 부모에 position: relative 추가 |
| E2E 전체 검증 | 아레나 풀 플로우 E2E 테스트: 접속→캐릭터선택→전투→레벨업→PvP→사망→관전→보상 |

- **design**: N
- **verify**: 빌드 성공, classic 모드 regression 없음, 전체 17개 AR 컴포넌트 렌더링 확인, E2E 통과, 60fps
