# PLAN: v28 — app_ingame Matrix 게임 엔진 이식 (검증 반영 v2)

## Context

AI World War에 **Vampire Survivors 스타일 자동전투 서바이벌 게임**을 인게임 모드로 추가한다.
기존 `app_ingame` 프로젝트(116K줄)의 핵심 엔진을 Next.js 기반 AI World War에 이식하여,
글로브 로비에서 "Matrix 진입" 시 즉시 자동전투 서바이벌 게임플레이가 시작되도록 한다.

### 핵심 요구사항
1. **인게임 진입 = Matrix 진입**: 글로브에서 국가 클릭 → "THE MATRIX" 인트로 → 자동전투 서바이벌 시작
2. **로비 제거**: app_ingame의 Lobby UI 삭제, 모든 스킬/아이템 구매/활성화를 인게임 UI에서 처리
3. **핵심 시스템 완전 이식**: 게임 루프, 전투, 무기, 스킬, 스폰, 이동 AI, 아이소메트릭 렌더링
4. **9 AI 에이전트 대전**: Arena 모드의 PvP+PvE 배틀로얄

---

## 검증 결과 요약 (Critical Blockers Found)

### BLOCKER 1: `types.ts` 미존재 (67개 타입, 모든 파일 의존)
- `app_ingame/types.ts` 파일이 디스크에 없음
- **67개 타입/인터페이스/상수**가 이 파일에서 export 되어야 함
- Player, Enemy, Vector2, WeaponType, PlayerClass 등 모든 핵심 엔티티 정의
- 해결: import 분석 완료 → 67개 타입 전체 목록 확보 → 재구성

### BLOCKER 2: `utils/` 디렉토리 미존재 (5개 모듈, 38개 심볼)
| 모듈 | 심볼 수 | 사용 파일 수 | 이식 전략 |
|------|---------|-------------|----------|
| `utils/math` | 9개 함수 | 12 | 재구성 (순수 수학 함수) |
| `utils/audio` | 2 (soundManager, MENU_OSTS) | 45 | no-op stub 우선 |
| `utils/sfx` | 1 (sfxManager) | 2 | no-op stub 우선 |
| `utils/api` | 10 (서버 API) | 4 | AI World War API로 재작성 |
| `utils/supabase` | 16 (인증/저장) | 8 | AI World War 인프라 사용 |

### BLOCKER 3: 빌드 설정 미존재
- `tsconfig.json`, `package.json`, `vite.config.ts` 모두 없음
- 해결: AI World War의 Next.js 빌드 시스템 사용 (별도 빌드 불필요)

### 규모 재조정 (검증 후)

| 카테고리 | 원본 계획 | 실제 규모 | 배율 |
|----------|----------|----------|------|
| `game/rendering/` (디렉토리) | "2,390줄 1파일" | **33,040줄 68파일** | 13.8x |
| `game/rendering.ts` (facade) | 포함 | 2,390줄 | — |
| `game/sprites/` | 미포함 | 2,119줄 9파일 | 누락 |
| `game/tiles/` | 미포함 | 848줄 5파일 | 누락 |
| `game/map/` | 미포함 | 1,505줄 5파일 | 누락 |
| `game/collision/` | 미포함 | 471줄 3파일 | 누락 |
| `game/helpers.ts` | 미포함 | 424줄 | 누락 |
| `game/isometric.ts` | 245줄 | 245줄 | 정확 |
| **렌더링+보조 합계** | ~2,600줄 | **41,042줄 93파일** | 15.8x |

---

## 이식 전략

핵심 원칙: **코드 수정 최소화**. 원본 로직을 가능한 그대로 복사하고, import 경로만 수정한다.

### 디렉토리 구조 (apps/web 내)

```
apps/web/
├── lib/matrix/                    # 게임 엔진 코어
│   ├── types.ts                   # 67개 타입 (재구성)
│   ├── constants.ts               # GAME_CONFIG, ENEMY_TYPES 등
│   ├── helpers.ts                 # isObstacleAt 등
│   ├── isometric.ts               # 좌표 변환
│   ├── utils/
│   │   ├── math.ts                # 9개 수학 함수 (재구성)
│   │   ├── audio.ts               # soundManager (stub → 점진적 구현)
│   │   └── sfx.ts                 # sfxManager (stub)
│   ├── systems/
│   │   ├── game-context.ts        # GameRefs, GameCallbacks
│   │   ├── combat.ts              # 2,478줄
│   │   ├── weapons.ts             # 1,463줄
│   │   ├── movement.ts            # 1,483줄
│   │   ├── projectile.ts          # 831줄
│   │   ├── spawning.ts            # 326줄
│   │   ├── spawn-controller.ts    # 579줄
│   │   ├── spatial-hash.ts        # 198줄
│   │   ├── pickup.ts              # 234줄
│   │   ├── ranged-enemy.ts        # 259줄
│   │   ├── agent-combat.ts        # 527줄
│   │   └── elite-monster.ts       # 340줄
│   ├── config/
│   │   ├── game.config.ts
│   │   ├── weapons.config.ts      # 528줄
│   │   ├── classes.config.ts      # 120줄
│   │   ├── enemies.config.ts      # 788줄
│   │   ├── arena.config.ts        # 290줄
│   │   ├── items.config.ts        # 366줄
│   │   ├── obstacles.config.ts    # 334줄
│   │   └── skills/                # definitions, synergies, presets
│   ├── rendering/                 # 33,040줄 68파일 (구조 유지 복사)
│   │   ├── index.ts, types.ts, constants.ts, utils.ts
│   │   ├── bosses/                # 보스 렌더러
│   │   ├── enemies/               # 적 렌더러 (20파일)
│   │   ├── projectiles/weapons/   # 무기 렌더러
│   │   ├── characters/parts/      # 캐릭터 파트
│   │   ├── environment/terrain/   # 지형
│   │   ├── effects/, mapObjects/, turrets/, ui/
│   ├── rendering.ts               # 2,390줄 (facade)
│   ├── sprites/                   # 2,119줄 9파일
│   ├── tiles/                     # 848줄 5파일
│   ├── map/                       # 1,505줄 5파일
│   └── collision/                 # 471줄 3파일
│
├── components/game/matrix/        # Matrix 모드 UI
│   ├── MatrixCanvas.tsx           # 게임 루프 래퍼
│   ├── MatrixHUD.tsx              # 인게임 HUD
│   ├── MatrixLevelUp.tsx          # 레벨업 모달
│   ├── MatrixResult.tsx           # 결과 화면
│   ├── MatrixIntro.tsx            # 진입 연출
│   ├── MatrixPause.tsx            # 일시정지 메뉴
│   └── CircleTransition.tsx       # 화면 전환
```

### Import 경로 치환 규칙

| 원본 import | 이식 후 import |
|------------|---------------|
| `../../types` | `@/lib/matrix/types` |
| `../../constants` | `@/lib/matrix/constants` |
| `../../utils/math` | `@/lib/matrix/utils/math` |
| `../../utils/audio` | `@/lib/matrix/utils/audio` |
| `../../utils/sfx` | `@/lib/matrix/utils/sfx` |
| `../isometric` | `@/lib/matrix/isometric` |
| `../helpers` | `@/lib/matrix/helpers` |
| `./GameContext` | `@/lib/matrix/systems/game-context` |
| `./spatialHash` | `@/lib/matrix/systems/spatial-hash` |

복사 후 `sed` 일괄 치환으로 경로 수정 예정.

---

## Key Technical Decisions

### 1. 렌더링: HTML5 Canvas 2D (원본 유지)
Canvas 2D가 수백 엔티티 스프라이트 장르에 최적. Three.js/PixiJS 변환 불필요.

### 2. 게임 루프: rAF + Web Worker (원본 패턴)
- Web Worker: 60fps 로직 틱 (물리, 충돌, 무기 쿨다운)
- requestAnimationFrame: 렌더 프레임
- React 상태: Refs로 관리 → 0 re-render

### 3. 아이소메트릭 좌표계 (2:1 다이아몬드)
- `worldToScreen(x, y, z)`: screenX = x - y, screenY = (x + y) * 0.5 - z
- ISO_Y_SCALE = 0.5
- v27 PixiJS 아이소메트릭과 독립 시스템

### 4. Next.js 통합: dynamic import + ssr:false
```typescript
const MatrixCanvas = dynamic(
  () => import('@/components/game/matrix/MatrixCanvas'),
  { ssr: false }
);
```
IsoCanvas와 동일한 패턴.

### 5. 진입 플로우
```
Globe → 국가 클릭 → "Enter Matrix" 버튼
→ CircleTransition → mode='matrix'
→ MatrixIntro ("THE MATRIX" 글리치)
→ MatrixCanvas (게임 시작)
→ ESC → PauseMenu → "Exit to Lobby"
```

### 6. 오디오 전략
- Phase 0: soundManager/sfxManager를 no-op stub으로 구현 (모든 메서드 빈 함수)
- Phase 7: Web Audio API 기반 실제 구현 (에셋 이식 후)

### 7. 타입 재구성 전략 (67개 타입)
- **Tier 1 (Phase 0)**: 핵심 엔티티 20개 — Player, Enemy, Vector2, Projectile, Gem, Pickup, Blast, LightningBolt, DamageNumber, WeaponType, WeaponStats, EnemyType, PlayerClass, PickupType, StatusEffect, CriticalEffect, Obstacle, CollisionBox, BossSkillType, BossTier
- **Tier 2 (Phase 2)**: 게임 상태 15개 — GameState, GameMode, AppSettings, WaveNumber, SafeZone, ArenaConfig, ArenaResult, ArenaPhase, EliteTier, Entity, Agent, AIPersonality, EnemyProjectile, PersistentUpgrades, CharacterStats
- **Tier 3 (Phase 5+)**: 보조 시스템 32개 — ComboState/Tier/Effect, QuizChallenge/State, SingularityState/Result, EventLog, BreakTime, RouletteReward 등

### 8. 에셋 이식 전략
- `public/assets/cha/` — 9캐릭터 × 5이미지 (8방향 스프라이트)
- `public/assets/tile_n/` — A1-A12 + B1/C1/D1/E1 × 4방향 타일
- `public/assets/sfx/` — 효과음
- 복사 위치: `apps/web/public/matrix/`
- 최적화: PNG→WebP, 불필요 에셋 제거

---

## 구현 로드맵

### Phase 0: 누락 파일 재구성 + 프로젝트 기반
| Task | 설명 |
|------|------|
| 디렉토리 생성 | `lib/matrix/{systems,config/skills,rendering,sprites,tiles,map,collision,utils}`, `components/game/matrix/` |
| types.ts 재구성 (Tier 1) | 20개 핵심 타입: Player, Enemy, Vector2, Projectile, Gem, Pickup, Blast, LightningBolt, DamageNumber, WeaponType, WeaponStats, EnemyType, PlayerClass, PickupType, StatusEffect, CriticalEffect, Obstacle, CollisionBox, BossSkillType, BossTier |
| utils/math.ts 재구성 | 9개 함수: distance, normalize, distanceSquared, angleBetween, circlesOverlap, isWithinRange, lerp, randomRange, calcTieredBonus |
| utils/audio.ts stub | soundManager: playSFX, playBGM, stopBGM, setVolume, resetCombo 등 no-op 메서드 |
| utils/sfx.ts stub | sfxManager: play, preload 등 no-op 메서드 |
| constants.ts 이식 | GAME_CONFIG, ENEMY_TYPES, PICKUP_DATA, SPAWN_RADIUS 등 (config/index.ts + constants.ts 병합) |
| GameMode 확장 | SocketProvider.tsx에 `'matrix'` 추가, page.tsx에 mode 분기 |

- **design**: N
- **verify**: `npx tsc --noEmit` 통과, types.ts에서 20개 핵심 타입 export 확인

### Phase 1: 핵심 게임 시스템 이식 (코어 엔진 — 8,620줄)
| Task | 설명 |
|------|------|
| game-context.ts | GameRefs, GameCallbacks 인터페이스 (194줄) |
| spatial-hash.ts | SpatialHashGrid 클래스 (198줄) |
| helpers.ts | isObstacleAt, 유틸리티 함수 (424줄) |
| isometric.ts | worldToScreen, screenToWorld, ISO_Y_SCALE (245줄) |
| combat.ts | damageEnemy, hitEffects, statusEffects (2,478줄) |
| weapons.ts | fireWeapon 20종 디스패처 (1,463줄) |
| movement.ts | Auto Hunt AI + 수동 입력 (1,483줄) |
| projectile.ts | 투사체 물리/충돌 (831줄) |
| spawning.ts | 스폰 함수들 (326줄) |
| spawn-controller.ts | 웨이브/포메이션 시스템 (579줄) |
| pickup.ts | 아이템 픽업 처리 (234줄) |
| ranged-enemy.ts | 원거리 적 AI (259줄) |

- **design**: N
- **verify**: 모든 시스템 파일 tsc 에러 0, 상호 import 정상

### Phase 2: 설정 데이터 + 타입 확장 (3,200줄+)
| Task | 설명 |
|------|------|
| types.ts 확장 (Tier 2) | 15개 추가: GameState, GameMode, AppSettings, WaveNumber, SafeZone, ArenaConfig, ArenaResult, ArenaPhase, EliteTier, Entity, Agent, AIPersonality, EnemyProjectile, PersistentUpgrades, CharacterStats |
| weapons.config.ts | 20레벨 무기 프로그레션 (528줄) |
| classes.config.ts | 9개 캐릭터 클래스 (120줄) |
| enemies.config.ts | 150+ 적 타입 정의 (788줄) |
| arena.config.ts | 세이프존, AI 에이전트 설정 (290줄) |
| items.config.ts | 아이템 정의 (366줄) |
| obstacles.config.ts | 장애물 정의 (334줄) |
| skills/ 이식 | definitions, synergies, branches, presets |
| game.config.ts | GAME_CONFIG 전체 상수 |

- **design**: N
- **verify**: config import 정상, tsc 0 에러

### Phase 3: 렌더링 엔진 이식 (41,042줄 — 대규모 복사)
| Task | 설명 |
|------|------|
| rendering.ts facade | 메인 디스패처 (2,390줄): drawEnemy, drawProjectile, drawCatSprite |
| rendering/ 디렉토리 | 68파일 전체 구조 유지 복사 + import 경로 sed 일괄 치환 |
| sprites/ | 8방향 스프라이트 시스템 (2,119줄 9파일) |
| tiles/ | 타일맵 시스템 (848줄 5파일) |
| map/ | 바이옴 노이즈 맵 생성 (1,505줄 5파일) |
| collision/ | 충돌 시스템 (471줄 3파일) |
| 경로 검증 | 전체 파일 import 경로 정상 확인 |

- **design**: N
- **verify**: drawEnemy, drawProjectile, drawCatSprite 함수 정상 export, tsc 0 에러

### Phase 4: MatrixCanvas 게임 루프 + 진입 플로우
| Task | 설명 |
|------|------|
| MatrixCanvas.tsx | GameCanvas.tsx(5,195줄) 기반 Next.js 래퍼 — rAF + Worker + Refs |
| Web Worker | gameTimer.worker.ts 이식 |
| page.tsx 모드 추가 | mode 'matrix' 분기 + MatrixCanvas dynamic import |
| MatrixIntro.tsx | "THE MATRIX" 진입 연출 (글리치 텍스트 + 녹색 코드 레인) |
| CircleTransition.tsx | 원형 화면 전환 애니메이션 |
| 로딩 화면 | 에셋 프리로드 중 로딩 바 |
| 진입 버튼 | 글로브/아이소메트릭에서 "Enter Matrix" 버튼 |
| 에셋 복사 | 스프라이트/타일 이미지 → `public/matrix/` |

- **design**: Y (인트로 연출, 전환 애니메이션)
- **verify**: 글로브 → Matrix 진입 → 인트로 → 빈 맵에서 플레이어 이동, ESC 복귀

### Phase 5: 인게임 HUD + 레벨업 UI
| Task | 설명 |
|------|------|
| types.ts 확장 (Tier 3) | 보조 시스템 타입 32개 (Combo, Quiz, Singularity, EventLog 등) |
| MatrixHUD.tsx | HP바, 경험치바, 타이머, 킬수, 미니맵 |
| MatrixLevelUp.tsx | 4개 스킬 선택 카드 (가중 랜덤) |
| MatrixPause.tsx | Resume/Settings/Exit to Lobby |
| 스킬 인게임 구매 | 로비 기능 → 인게임 탭 UI (Build Phase 30초) |
| MatrixResult.tsx | 게임 오버/클리어 결과 화면 |

- **design**: Y (HUD 레이아웃, 레벨업 카드, 결과 화면)
- **verify**: HUD 실시간 업데이트, 레벨업 모달 작동, ESC 일시정지

### Phase 6: AI 에이전트 + 배틀로얄
| Task | 설명 |
|------|------|
| agent-combat.ts 이식 | AI 에이전트 전투 로직 (527줄) |
| arena 모드 통합 | 세이프존 축소, 존 밖 대미지, 5분 타이머 |
| 9 AI 에이전트 스폰 | 각각 클래스/무기 보유 |
| ArenaHUD 이식 | 세이프존 표시, 생존 에이전트 수, 스코어보드 |
| 결과 스크린 | 순위/킬/생존시간 |

- **design**: N
- **verify**: 9 AI 에이전트 전투, 세이프존 축소, 최종 1인 생존 → 결과

### Phase 7: 보조 시스템 + 폴리싱
| Task | 설명 |
|------|------|
| elite-monster.ts 이식 | 엘리트 몬스터 + 특수 능력 (340줄) |
| turret.ts 이식 | 터렛 배치/자동 사격 (1,174줄) |
| 사운드 구현 | stub → Web Audio API 실제 구현 |
| 성능 최적화 | LOD 튜닝, 파티클 상한, 오브젝트 풀링 |
| 에셋 최적화 | PNG→WebP, 불필요 에셋 제거, Vercel 크기 최적화 |
| 빌드 검증 | tsc + Vercel 빌드 테스트 |

- **design**: N
- **verify**: 엘리트/터렛 작동, 60fps 유지 (200+ 엔티티), tsc 0 에러

---

## 이식 규모 요약

| 카테고리 | 줄 수 | 파일 수 | Phase |
|----------|-------|---------|-------|
| 타입 재구성 (신규) | ~800 | 1 | 0, 2, 5 |
| 유틸리티 재구성 (신규) | ~200 | 3 | 0 |
| 코어 시스템 (복사+수정) | 8,620 | 12 | 1 |
| 설정 데이터 (복사+수정) | 3,200+ | 10+ | 2 |
| 렌더링 엔진 (복사+경로치환) | 41,042 | 93 | 3 |
| GameCanvas 래퍼 (신규) | ~2,000 | 1 | 4 |
| UI 컴포넌트 (신규) | ~3,000 | 7 | 4, 5 |
| 보조 시스템 (복사+수정) | 2,041 | 3 | 6, 7 |
| **합계** | **~61,000** | **~130** | — |

### 이식 방법별 분류
- **구조 유지 복사 + import 경로 치환**: 렌더링 41K줄 + 코어 8.6K줄 + 설정 3.2K줄 = **~53K줄**
- **재구성 (신규 작성)**: types.ts 800줄 + utils 200줄 = **~1K줄**
- **신규 개발**: MatrixCanvas + UI 7개 = **~5K줄**

---

## Verification

1. `npx tsc --noEmit` — 0 errors (각 Phase 완료 시)
2. `./game.sh` 재시작 → 글로브 로비 정상
3. 글로브 → "Enter Matrix" → CircleTransition → MatrixIntro → 게임 시작
4. 플레이어 이동 (WASD/조이스틱) + Auto Hunt AI 작동
5. 적 스폰 → 자동 무기 발사 → 데미지 + 넉백 + 경험치 젬 수집
6. 레벨업 → 4개 스킬 선택 → 무기 추가/강화
7. 세이프존 축소 → 존 밖 대미지 → 9 AI 에이전트 대전
8. 게임 오버/생존 → 결과 화면 → "Exit to Lobby" → 글로브 복귀
9. ESC → 일시정지 메뉴 → Resume/Exit 정상
10. 60fps 유지 (200 적 + 투사체 + 파티클)

---

## 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| types.ts 재구성 오류 | 전체 빌드 실패 | import 분석 67개 타입 전체 목록 확보 완료, 타입은 사용처 코드에서 역추론 가능 |
| 렌더링 41K줄 경로 수정 | 대량 import 오류 | sed 일괄 치환 스크립트 작성, 치환 후 tsc 즉시 검증 |
| soundManager 의존성 (45파일) | 런타임 에러 | no-op stub 우선 → 모든 호출부 에러 없이 통과 |
| GameCanvas.tsx 5.2K줄 Next.js 호환 | SSR/hydration 이슈 | dynamic import + ssr:false, useEffect 내 Canvas 초기화 |
| 에셋 용량 (스프라이트/타일/SFX) | Vercel 배포 크기 초과 | PNG→WebP, SFX 앨범아트 제거, 불필요 에셋 제거 |
| Web Worker Next.js 호환 | Worker 로딩 실패 | next-worker 패턴 또는 inline blob worker |
| 순환 의존성 | import 오류 | 원본이 이미 DAG 구조이므로 경로 치환만으로 해결 |
| 원본 코드 변경 (app_ingame 업데이트) | 이식본과 분기 | 이식 시점 git hash 기록, 차후 diff 기반 머지 |
