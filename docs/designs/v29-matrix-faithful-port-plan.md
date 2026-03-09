# PLAN: v29 — app_ingame 원본 충실 이식 (Faithful Port)

## Context

v28에서 app_ingame을 Matrix 모드로 이식했으나, **원본과 완전히 다른 결과물**이 나왔다.

### 현재 상태 (정밀 분석 결과)

**파일은 lib/matrix/에 복사되었으나, MatrixCanvas.tsx에서 대부분 연결하지 않음.**

| 카테고리 | lib/matrix에 파일 존재 | MatrixCanvas에서 import | 실제 호출 |
|----------|----------------------|------------------------|----------|
| `rendering/` 62파일 (31,754줄) | ✅ | **3개 함수만** (drawEnemy, drawProjectile, drawCatSprite) | 3개만 |
| `sprites/` 9파일 (2,119줄) | ✅ | ❌ **0개** — 스프라이트 시트 미사용 | ❌ |
| `tiles/` 5파일 (848줄) | ✅ | ❌ **0개** — 타일맵 미사용 | ❌ |
| `collision/` 3파일 (471줄) | ✅ | ❌ **0개** — 장애물 충돌 없음 | ❌ |
| `map/` 5파일 (1,505줄) | ✅ | ❌ **0개** — 바이옴/노이즈맵 없음 | ❌ |
| `isometric.ts` (236줄) | ✅ | ❌ **미사용** — 2D 직교 좌표만 사용 | ❌ |
| `systems/combat.ts` (2,481줄) | ✅ | ❌ **미import** — 데미지 인라인 처리 | ❌ |
| `systems/pickup.ts` (234줄) | ✅ | ❌ — 픽업 시스템 없음 | ❌ |
| `systems/ranged-enemy.ts` (259줄) | ✅ | ❌ — 원거리 적 AI 없음 | ❌ |
| `systems/spawn-controller.ts` (579줄) | ✅ | ❌ — 단순 타이머 스폰만 사용 | ❌ |
| `systems/spatial-hash.ts` (198줄) | ✅ | ❌ — 공간분할 없음 | ❌ |
| `systems/agent-chat.ts` (12줄 스텁) | ✅ | ❌ — 채팅 없음 | ❌ |
| `config/` 15파일 (5,872줄) | ✅ | **1개만** (arena.config) | 1개만 |
| `config/skills/` 7파일 (2,223줄) | ✅ | ❌ **0개** — 55스킬 정의 미사용 | ❌ |
| `config/classes.config.ts` | ✅ | ❌ — 9클래스 미사용, neo 고정 | ❌ |
| `config/weapons.config.ts` | ✅ | ❌ — 무기 설정 미사용 | ❌ |
| `config/enemies.config.ts` | ✅ | ❌ — 적 설정 미사용 | ❌ |

**MatrixCanvas.tsx 실제 연결 현황:**
- **연결됨 (6 시스템)**: movement, weapons, projectile, spawning, agent-combat, arena-mode
- **미연결 (6 시스템)**: combat, pickup, ranged-enemy, spawn-controller, spatial-hash, agent-chat
- **연결된 config**: arena.config **1개만** (15개 중)
- **레벨업**: 8개 하드코딩 (config/skills/ 55개 정의 미사용)
- **캐릭터**: 'neo' 고정 (config/classes.config.ts 9클래스 미사용)
- **배경**: 검은 그리드 drawGrid() (tiles/ + map/ + isometric.ts 미사용)
- **렌더링**: drawEnemy/drawProjectile/drawCatSprite 3개만 (rendering/ 62파일 중 극소수)

### v28 실패 근본 원인

1. **MatrixCanvas.tsx를 처음부터 새로 작성** → 원본 GameCanvas.tsx(5,195줄)의 25%(1,308줄)만 구현
2. **아키텍처 변경**: 원본은 App.tsx(hooks 오케스트레이터) + GameCanvas(순수 렌더링) 2-레이어 → v28은 MatrixCanvas 단일 파일에 모든 것을 넣음
3. **시스템 연결 누락**: 파일은 복사했으나 import/호출을 하지 않음
4. **하드코딩**: config 기반 시스템을 인라인 상수로 대체

### v29 목표

app_ingame의 GameCanvas.tsx(5,195줄)를 **원본 소스코드 그대로** 복사하여 MatrixCanvas.tsx를 교체.
import 경로만 `@/lib/matrix/`로 수정. 로직 변경/단순화/기능 제거 금지.

## Critical Files

### 원본 (app_ingame) — 이식 대상

**Tier 0: MatrixCanvas 전면 교체 (핵심)**
- `app_ingame/components/GameCanvas.tsx` (5,195줄) → MatrixCanvas.tsx **전면 교체**

**Tier 1: 오케스트레이터 + 핵심 훅 (MatrixCanvas가 의존)**
- `app_ingame/App.tsx` (2,085줄) → MatrixApp.tsx (로비/인증 제외 추출)
- `app_ingame/game/useGameRefs.ts` (301줄) — GameRefs 중앙 상태
- `app_ingame/game/useInput.ts` (113줄) — 키보드/터치 입력
- `app_ingame/hooks/useGameState.ts` (222줄) — 게임 상태 머신
- `app_ingame/hooks/useV3Systems.ts` (184줄) + useCombo(238줄) + useBreakTime(181줄) + useQuizChallenge(253줄)
- `app_ingame/hooks/useTileMap.ts` (451줄) — 아이소메트릭 타일맵
- `app_ingame/hooks/useArena.ts` (756줄) — 배틀로얄
- `app_ingame/hooks/useSkillBuild.ts` (585줄) — 스킬 빌드
- `app_ingame/hooks/useKeyboardShortcuts.ts` (260줄)

**Tier 2: 미이식 시스템 (파일 자체가 없음)**
- `app_ingame/game/systems/turret.ts` (1,174줄) — ❌ 미이식
- `app_ingame/game/systems/eliteMonster.ts` (340줄) — ❌ 미이식
- `app_ingame/game/systems/agentChat.ts` (344줄) — 12줄 스텁만 있음

**Tier 3: 미이식 설정 (파일 자체가 없음)**
- `config/turrets.config.ts` (510줄)
- `config/combo.config.ts` (268줄)
- `config/arena-agents.config.ts` (400줄)
- `config/agents.config.ts` (375줄)
- `config/skins.config.ts` (1,972줄)
- `config/breaktime.config.ts` (118줄)

**Tier 4: 부분 이식/변형 파일 (원본으로 교체 필요)**
- `config/skills/definitions.ts` — 289줄 → 원본 851줄 (15+ 스킬 잘림)
- `config/weapons.config.ts` — 399줄 → 원본 528줄
- `systems/agent-combat.ts` — 862줄 **완전 재작성** → 원본 527줄로 교체 (checkProjectileAgentCollision, applyPvPDamage 등 원본 함수 복원)
- `systems/helpers.ts` — collision/map/obstacles **스텁화** → 원본으로 교체 (isInsideObstacle, getObstacleAtGrid 등 실제 로직 복원)
- `constants.ts` — 251줄 인라인+빈스텁 → **원본 68줄 re-export 구조**로 교체 (WEAPON_DATA, WAVE_DEFINITIONS, ENEMY_TYPES 등 원본 참조)
- `systems/weapons.ts` — `enemy.hp` → `enemy.health` 속성명 변경됨 → 원본 확인 후 복원
- `systems/spawn-controller.ts` — ARENA_MONSTERS 구조 변경 → 원본 구조로 복원
- `systems/combat.ts` — soundManager API 시그니처 변경 → 원본 호환으로 복원

**Tier 5: 누락 의존성 (barrel export, 타입, 상수, 스텁)**
- `game/index.ts` (140줄) — barrel export (GameCanvas의 20+ 함수 import 대상)
- `game/systems/index.ts` (131줄) — barrel export (30+ 함수/타입 import 대상)
- `game/managers/SpriteManager.ts` (185줄) — sprites에서 사용
- `types.ts` 보완 — 27개 누락 타입 (GameState, PersistentUpgrades, V3 types 등)
- `constants.ts` 보완 — XP_THRESHOLDS, WEAPON_DATA, CLASS_DATA, getWaveForTime/Stage
- i18n 스텁 — useLanguage() 훅 (GameCanvas에서 import)
- audio 스텁 확장 — soundManager (GameCanvas에서 20+ SFX 호출)

### UI 컴포넌트 (원본 기반 교체)
- `app_ingame/components/UIOverlay.tsx` → MatrixHUD 교체
- `app_ingame/components/LevelUpModal.tsx` → MatrixLevelUp 교체 (config 기반 55스킬)
- `app_ingame/components/arena/ArenaHUD.tsx`
- `app_ingame/components/arena/ArenaResultScreen.tsx`

## Key Technical Decisions

### 1. 이식 전략: "Copy-Adapt" (복사 후 최소 수정)

**원칙**: 원본 소스코드를 **최대한 그대로** 복사하고, Next.js 호환에 **필요한 최소한의 수정**만 적용.

```
원본 파일 복사 → import 경로 수정 → 타입 호환 수정 → 완료
```

**수정 허용 범위:**
- import 경로: `../game/systems/` → `@/lib/matrix/systems/`
- 환경 의존: `soundManager` → optional chaining or stub
- React 버전 차이
- **금지**: 로직 변경, 시스템 단순화, 기능 제거

### 2. 아키텍처: 원본 App.tsx + GameCanvas.tsx 2-레이어 유지

```
MatrixApp.tsx (=App.tsx)          — 훅 오케스트레이터, 68 props 전달
  └─ MatrixCanvas.tsx (=GameCanvas.tsx) — 순수 게임 루프 (update 58단계 + draw 40단계)
```

### 3. 파일 상태 정리

**이미 lib/matrix에 파일 존재하며 원본과 동일 (수정 불필요):**
- rendering/ 62파일, sprites/ 9파일, tiles/ 5파일, collision/ 3파일, map/ 5파일
- systems: movement, weapons, projectile, spawning, pickup, ranged-enemy, spatial-hash, game-context (import 경로만 수정, 동일)
- systems: combat.ts — 72줄 diff (soundManager API, Particle→ExtendedParticle, null 체크)
- systems: spawn-controller.ts — 16줄 diff (ARENA_MONSTERS 구조 변경)
- systems: agent-combat.ts — ⚠️ **완전 재작성** (527→862줄, 원본 함수 삭제됨)
- systems: helpers.ts — ⚠️ **스텁화** (collision/map/obstacles 함수가 항상 false 반환)
- config: arena, enemies, items, obstacles, game, classes, skills/ (7파일) — 동일
- isometric.ts, rendering.ts, types.ts — 동일
- constants.ts — ⚠️ **구조 변경** (68줄 re-export hub → 251줄 인라인, WEAPON_DATA 빈 stats, WAVE_DEFINITIONS 6개만)

**핵심 문제**: 이 파일들이 MatrixCanvas.tsx에서 **import되지 않고 호출되지 않음**
→ MatrixCanvas.tsx를 원본 GameCanvas.tsx로 교체하면 자동으로 모두 연결됨

### 4. i18n: 스텁 훅으로 처리

원본 GameCanvas.tsx가 `useLanguage()` 호출 → 한국어 기본값 반환하는 스텁 생성
전체 i18n 시스템(5언어, 3,329줄)은 나중에 이식

### 5. Audio: 스텁 확장

원본 GameCanvas.tsx가 `soundManager.play()` 20+ 호출 → silent no-op 스텁
게임 로직에 영향 없음 (사운드는 side effect)

## 구현 로드맵

### Phase 1: 누락 파일 이식 + 의존성 보완
| Task | 설명 |
|------|------|
| turret.ts 이식 | `systems/turret.ts` (1,174줄) 복사 → import 경로 수정 |
| eliteMonster.ts 이식 | `systems/eliteMonster.ts` (340줄) 복사 |
| agentChat.ts 교체 | 12줄 스텁 → 원본 344줄 복사 |
| turrets.config 이식 | `config/turrets.config.ts` (510줄) 복사 |
| combo.config 이식 | `config/combo.config.ts` (268줄) 복사 |
| arena-agents.config 이식 | `config/arena-agents.config.ts` (400줄) 복사 |
| agents.config 이식 | `config/agents.config.ts` (375줄) 복사 |
| skins.config 이식 | `config/skins.config.ts` (1,972줄) 복사 |
| breaktime.config 이식 | `config/breaktime.config.ts` (118줄) 복사 |
| skills/definitions 교체 | 289줄 → 원본 851줄 교체 (15+ 스킬 복원) |
| weapons.config 교체 | 399줄 → 원본 528줄 교체 |
| agent-combat.ts 교체 | **862줄 재작성본 → 원본 527줄로 교체** (checkProjectileAgentCollision, applyPvPDamage 복원) |
| helpers.ts 교체 | **스텁화된 파일 → 원본으로 교체** (collision/map/obstacles 실제 로직 복원) |
| constants.ts 교체 | **251줄 인라인 → 원본 68줄 re-export 구조로 교체** (config에서 import하는 구조) |
| weapons.ts 복원 | `enemy.hp` → `enemy.health` 속성명 → 원본 `enemy.hp` 복원 |
| spawn-controller.ts 복원 | ARENA_MONSTERS 구조 → 원본 `ARENA_MONSTERS[stageNum]` 구조 복원 |
| combat.ts 복원 | soundManager API 시그니처 → 원본 `playHitSFX` 호출 복원 |
| SpriteManager 이식 | `game/managers/SpriteManager.ts` (185줄) 복사 |
| types.ts 보완 | 27개 누락 타입 추가 (GameState, V3 types, Boss types 등) |
| barrel exports 생성 | `lib/matrix/index.ts` + `systems/index.ts` (GameCanvas import 대상) |
| i18n 스텁 생성 | `lib/matrix/i18n.ts` — useLanguage() 한국어 기본값 |
| audio 스텁 확장 | `utils/audio.ts` 122줄 → soundManager.play() 20+ no-op 메서드 추가 |
| sfx 스텁 확장 | `utils/sfx.ts` 32줄 → sfxManager 기본 메서드 추가 |
| useInput 이식 | `game/useInput.ts` (113줄) 복사 |

- **design**: N
- **verify**: `npx tsc --noEmit` 0 에러, 모든 신규 파일 import 정상

### Phase 2: 핵심 훅 이식
| Task | 설명 |
|------|------|
| useGameRefs 이식 | `game/useGameRefs.ts` (301줄) → `lib/matrix/hooks/useGameRefs.ts` |
| useGameState 이식 | `hooks/useGameState.ts` (222줄) → import 경로 수정 |
| useCombo 이식 | `hooks/useCombo.ts` (238줄) → combo.config 의존 |
| useBreakTime 이식 | `hooks/useBreakTime.ts` (181줄) → breaktime.config 의존 |
| useQuizChallenge 이식 | `hooks/useQuizChallenge.ts` (253줄) → 스텁 or 이식 |
| useV3Systems 이식 | `hooks/useV3Systems.ts` (184줄) → useCombo + useBreakTime + useQuiz 통합 |
| useTileMap 이식 | `hooks/useTileMap.ts` (451줄) → tiles/ + map/ 연결 |
| useArena 이식 | `hooks/useArena.ts` (756줄) |
| useSkillBuild 이식 | `hooks/useSkillBuild.ts` (585줄) → skills/ config 연결 |
| useKeyboardShortcuts 이식 | `hooks/useKeyboardShortcuts.ts` (260줄) |

- **design**: N
- **verify**: 모든 훅 tsc 통과, import 체인 정상

### Phase 3: MatrixCanvas.tsx 전면 교체 (원본 GameCanvas.tsx 복사)
| Task | 설명 |
|------|------|
| 기존 MatrixCanvas 백업 | 현재 1,308줄 파일 → MatrixCanvas.v28.tsx로 이동 |
| GameCanvas.tsx 복사 | 원본 5,195줄을 MatrixCanvas.tsx로 복사 |
| import 경로 일괄 수정 | `../game/` → `@/lib/matrix/`, `../hooks/` → `@/lib/matrix/hooks/` 등 |
| `../constants` 경로 | → `@/lib/matrix/constants` |
| `../types` 경로 | → `@/lib/matrix/types` |
| `../i18n` 경로 | → `@/lib/matrix/i18n` (스텁) |
| `../utils/audio` 경로 | → `@/lib/matrix/utils/audio` (스텁) |
| 컴포넌트명 변경 | `GameCanvas` → `MatrixCanvas` (export명만) |
| 68 props 인터페이스 | GameCanvasProps → MatrixCanvasProps (내용 동일) |
| Web Worker 경로 | gameTimer.worker → `@/lib/matrix/workers/game-timer.worker` |

- **design**: N
- **verify**: tsc 0 에러, 캔버스 마운트 확인

### Phase 4: MatrixApp.tsx 생성 (원본 App.tsx 기반 오케스트레이터)
| Task | 설명 |
|------|------|
| App.tsx 핵심 추출 | 원본 2,085줄에서 게임플레이 부분만 추출 (로비/인증/Supabase 제외) |
| 훅 오케스트레이션 | useGameState, useGameRefs, useV3Systems, useTileMap, useArena, useSkillBuild |
| 68 props 바인딩 | 훅 반환값 → MatrixCanvas props 매핑 |
| 모달/오버레이 통합 | LevelUpModal, PauseMenu, ResultScreen 연결 |
| page.tsx 연결 | mode='matrix' → MatrixApp dynamic import |
| onExit 콜백 | 글로브 로비로 복귀 |

- **design**: N
- **verify**: 글로브 → Matrix 진입 → 게임 시작, ESC 일시정지, 레벨업 모달 작동

### Phase 5: UI 컴포넌트 원본 기반 교체
| Task | 설명 |
|------|------|
| LevelUpModal 이식 | 원본 기반 — config/skills/ 55개 스킬 연결, 가중 랜덤 |
| UIOverlay/HUD 이식 | 원본 기반 — HP/XP바, 무기 슬롯, 타이머, 미니맵 |
| ArenaHUD 이식 | 원본 기반 — 세이프존, 에이전트 수, 킬피드 |
| ResultScreen 이식 | 원본 기반 — 통계, 순위, 획득 무기 |

- **design**: Y (Matrix 녹색 테마 스타일링)
- **verify**: HUD 실시간 업데이트, 55개 스킬 선택, 9개 클래스 반영

### Phase 6: 통합 테스트 + 빌드 검증
| Task | 설명 |
|------|------|
| 전체 빌드 | `npx tsc --noEmit` + `next build` |
| 게임 루프 | 플레이어 이동(WASD), 적 스폰, 무기 발사, 데미지, XP, 레벨업 |
| 아이소메트릭 | 타일맵 + 바이옴 렌더링, Y-소팅, ISO 카메라 |
| 전체 시스템 | combat, pickup, rangedEnemy, spawnController, eliteMonster, turret, spatialHash |
| 렌더링 | 스프라이트 시트, 8방향, 파티클, 데미지 넘버, 라이트닝, 블라스트 |
| 성능 | 200+ 엔티티 60fps |
| 크래시 | 5분+ 안정 플레이 |

- **design**: N
- **verify**: tsc 0 에러, next build 성공, 원본과 동일한 게임플레이

## Verification
1. `npx tsc --noEmit` — 0 errors
2. `next build` — 성공
3. 글로브 → "Enter Matrix" → 게임 시작
4. **아이소메트릭 타일맵** 렌더링 (검은 그리드 ❌)
5. **스프라이트 시트** 캐릭터 렌더링 (8방향 애니메이션)
6. **9개 캐릭터 클래스** 선택 가능 (neo 고정 ❌)
7. **55개 스킬** 레벨업 선택 (하드코딩 8개 ❌)
8. **combat.ts** 데미지 파이프라인 작동 (인라인 ❌)
9. **spawnController** 웨이브/포메이션 스폰 (단순 타이머 ❌)
10. **엘리트 몬스터** + 크리스탈 드롭
11. **원거리 적** AI + 적 투사체
12. **픽업** 시스템 (치킨/마그넷/폭탄)
13. **상태이상** (독/빙결/감속) + statusEffects
14. **터렛** 배치 + 자동 사격
15. **콤보** 연속 킬 보너스 (V3 시스템)
16. **Y-소팅** 깊이 정렬 렌더링
17. **카메라 줌** 동적 조절
18. **ESC** 일시정지 → Resume/Exit
19. **게임 오버/생존** → 결과 화면
20. **60fps** 유지 (200+ 엔티티)
21. **크래시 없음** (5분+)
