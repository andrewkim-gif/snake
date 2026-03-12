# [SYSTEM] V42 — Block-Coordinate Skill & Combat System Architecture

> /da:system output — v42-skill-combat-plan.md 기반 상세 시스템 아키텍처
> Date: 2026-03-12

## Overview

MC 블록 좌표(1 block = 1 Three.js unit) 네이티브로 동작하는 전투/스킬 시스템.
기존 2D MatrixApp의 55종 스킬, 20+ 무기, 콤보, 엘리트, 레벨업 루프를
/new 페이지(MatrixScene.tsx)의 3D 월드에 통합한다.

**핵심 도파민 루프**: 킬 → XP → 레벨업 → 스킬 선택 → 파워업 → 더 강한 적

## Goals / Non-Goals

### Goals
- G1: 블록 좌표 네이티브 무기/투사체 시스템 (변환 레이어 없음)
- G2: 60fps 유지 (적 50 + 투사체 100 동시)
- G3: 기존 useSkillBuild/useCombo 훅 standalone 재사용
- G4: 기존 3D 무기 렌더러 6개 복사 후 수정 (원본 보존)
- G5: 레벨업 → 스킬 선택 → 무기 획득 루프 완성

### Non-Goals
- NG1: 기존 2D MatrixApp 수정 (원본 보존)
- NG2: 서버사이드 게임 상태 동기화 (클라이언트 전용)
- NG3: PvP/Arena 모드 통합 (이번 스코프 외)
- NG4: 골드/상점 시스템 (Phase 5+ 이후)

---

## Architecture

### System Context (C4 Level 1)

```
┌──────────────────────────────────────────────────────┐
│                    /new Page                          │
│  ┌────────────────────────────────────────────────┐  │
│  │            MatrixScene (R3F Canvas)             │  │
│  │  ┌──────────┐  ┌───────────┐  ┌────────────┐  │  │
│  │  │GameLogic │  │ 3D Render │  │  DOM HUD   │  │  │
│  │  │(useFrame)│  │  (Three)  │  │ (Overlays) │  │  │
│  │  └──────────┘  └───────────┘  └────────────┘  │  │
│  └────────────────────────────────────────────────┘  │
│  ┌─────────────┐ ┌──────────┐ ┌────────────────┐   │
│  │useSkillBuild│ │ useCombo │ │useBlockWeapons │   │
│  │  (기존 훅)   │ │ (기존 훅) │ │  (★ 신규 훅)   │   │
│  └─────────────┘ └──────────┘ └────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Container Diagram (C4 Level 2)

```
page.tsx (/new)
 ├── useSkillBuild(playerClass) → { generateLevelUpChoices, applyLevelUp, playerSkills }
 ├── useCombo() → { comboRef, registerKill, getMultipliers }
 ├── useBlockWeapons(playerRef, enemiesRef, projectilesRef, playerSkills) → tick(dt)
 ├── pausedRef: MutableRefObject<boolean>
 │
 ├── <MatrixScene gameRefs={refs} pausedRef={pausedRef} />
 │   ├── SceneContent
 │   │   ├── GameLogic ← pausedRef early return + useBlockWeapons.tick(dt) 호출
 │   │   ├── MCGameCamera / MCVoxelTerrain / VoxelCharacter
 │   │   ├── EnemyRenderer / PickupRenderer
 │   │   ├── BlockSkillWeapons3D   ← ★ 복사 수정 (WORLD_SCALE=1)
 │   │   ├── BlockRangedWeapons3D  ← ★ 복사 수정 (WORLD_SCALE=1)
 │   │   ├── BlockMeleeWeapons3D   ← ★ 복사 수정 (WORLD_SCALE=1)
 │   │   ├── SwingArc / DeathParticles
 │   │   └── WorldUI / DamageNumbers / EntityUI
 │   └── HUD Overlay (DOM)
 │       ├── GameHUD3D / Minimap3D / WeaponSlots3D
 │       └── MobileControls3D
 │
 └── DOM Overlays (Canvas 외부)
     ├── MatrixLevelUp       ← ★ 레벨업 카드 UI
     └── BranchSelectModal   ← ★ 분기 진화 선택 UI
```

### Component Design (C4 Level 3)

#### 3.1 useBlockWeapons Hook — 블록 좌표 무기 시스템 코어

```
파일: apps/web/lib/matrix/hooks/useBlockWeapons.ts
의존: types.ts, block-weapon-stats.ts, weapons.config.ts
```

```typescript
// 인터페이스 설계
interface UseBlockWeaponsProps {
  playerRef: MutableRefObject<Player>;
  enemiesRef: MutableRefObject<Enemy[]>;
  projectilesRef: MutableRefObject<Projectile[]>;
  playerSkills: Map<WeaponType, number>;  // useSkillBuild에서 주입
  damageNumbersRef: MutableRefObject<DamageNumber[]>;
  comboMultipliers: { xp: number; speed: number; damage: number };
}

interface UseBlockWeaponsReturn {
  /** useFrame 내에서 매 프레임 호출 — 무기 발사 + 투사체 업데이트 + 충돌 */
  tick: (dt: number) => void;
  /** 무기별 쿨다운 타이머 (WeaponSlots3D 표시용) */
  cooldownsRef: MutableRefObject<Partial<Record<WeaponType, number>>>;
}
```

**내부 구조 (tick 메서드)**:
```
tick(dt):
  1. weaponCooldowns 감소 (dt 만큼)
  2. 각 장착 무기에 대해:
     a. cooldown 도달 시 발사 패턴 실행
     b. 블록 스케일 스탯으로 투사체 생성
  3. 투사체 업데이트:
     a. position += velocity * dt (블록/초)
     b. life -= dt
     c. 적 충돌 검사 (원형: dist < proj.radius + enemy.radius)
     d. 히트 시: enemy.health -= damage * comboMultipliers.damage
     e. 관통(pierce) 감소, 넉백 적용
     f. DamageNumber 생성
  4. 만료/소진 투사체 제거
```

**무기 발사 패턴 (블록 좌표)**:

| WeaponType | 패턴 | 블록 스케일 핵심 수치 |
|------------|------|---------------------|
| whip | 부채꼴 즉발 히트 | area=4 blocks, duration=0.26s |
| wand | 가장 가까운 적 유도 | speed=9 b/s, area=0.4 blocks |
| knife | 플레이어 facing 직선 | speed=10 b/s, area=0.3 blocks |
| bow | 가장 가까운 적 관통 | speed=12 b/s, pierce=3 |
| garlic | 플레이어 중심 AOE | area=5.4 blocks, damage/tick |
| bible | 플레이어 공전 궤도 | orbitRadius=1.5 blocks, orbitSpeed=3 rad/s |

#### 3.2 block-weapon-stats.ts — 블록 스케일 변환

```
파일: apps/web/lib/matrix/config/block-weapon-stats.ts
의존: weapons.config.ts (WEAPON_DATA), types.ts (WeaponStats)
```

```typescript
/**
 * 픽셀 기반 WeaponStats → 블록 좌표 WeaponStats 변환
 *
 * 변환 공식 (da:verify 검증 완료):
 *   area      /= 10   (40px → 4 blocks)
 *   speed     /= 50   (450px/s → 9 blocks/s)
 *   knockback /= 10   (35px → 3.5 blocks)
 *   damage    — 변경 없음 (스케일 무관)
 *   cooldown  — 변경 없음 (시간 기반)
 *   duration  — 변경 없음 (시간 기반)
 *   amount    — 변경 없음 (개수)
 *   pierce    — 변경 없음 (횟수)
 */
export function toBlockStats(stats: WeaponStats): WeaponStats {
  return {
    ...stats,
    area: stats.area / 10,
    speed: stats.speed / 50,
    knockback: stats.knockback / 10,
  };
}

/**
 * 무기 타입 + 레벨 → 블록 좌표 스탯 조회
 * WEAPON_DATA[weaponType].stats[level-1]을 변환하여 반환
 */
export function getBlockWeaponStats(
  weaponType: WeaponType,
  level: number
): WeaponStats | null;

/**
 * 전체 무기 스탯 테이블 (블록 좌표, 레이지 캐시)
 */
export const BLOCK_WEAPON_CACHE: Map<string, WeaponStats>;
```

#### 3.3 3D 무기 렌더러 (복사 수정)

| 원본 파일 | 복사본 | 핵심 변경 |
|-----------|--------|----------|
| `weapons/SkillWeapons.tsx` | `weapons/BlockSkillWeapons.tsx` | `WORLD_SCALE=1`, Z부호 반전 제거, 지형 높이 적용 |
| `weapons/RangedWeapons.tsx` | `weapons/BlockRangedWeapons.tsx` | `WORLD_SCALE=1`, Z부호 반전 제거, 지형 높이 적용 |
| `weapons/MeleeWeapons.tsx` | `weapons/BlockMeleeWeapons.tsx` | `WORLD_SCALE=1`, Z부호 반전 제거, 지형 높이 적용 |

**공통 변경 사항**:
```typescript
// 기존 (2D 좌표 → 3D 변환)
const WORLD_SCALE = 1 / 50;
const Y_OFFSET = 0.4;
_pos.set(
  proj.position.x * WORLD_SCALE,
  Y_OFFSET,
  -proj.position.y * WORLD_SCALE  // Z부호 반전
);

// 블록 좌표 네이티브 (변경 후)
const WORLD_SCALE = 1;  // 1 block = 1 Three.js unit
_pos.set(
  proj.position.x,
  getMCTerrainHeight(proj.position.x, proj.position.y) + 1.5,  // 지형 위
  proj.position.y  // Z부호 반전 없음
);
```

#### 3.4 page.tsx 확장 — 훅 오케스트레이션

```
파일: apps/web/app/new/page.tsx
신규 의존: useSkillBuild, useCombo, useBlockWeapons, MatrixLevelUp
```

```typescript
function Scene3DPage() {
  // 게임 Refs (MatrixScene에 주입)
  const gameRefs = useGameRefs();

  // 일시정지 ref (레벨업 중 게임 멈춤)
  const pausedRef = useRef(false);

  // 스킬 빌드 시스템 (standalone 재사용)
  const skillBuild = useSkillBuild(gameRefs.player.current.playerClass);

  // 콤보 시스템 (standalone 재사용)
  const combo = useCombo();

  // 블록 좌표 무기 시스템
  const blockWeapons = useBlockWeapons({
    playerRef: gameRefs.player,
    enemiesRef: gameRefs.enemies,
    projectilesRef: gameRefs.projectiles,
    playerSkills: skillBuild.playerSkills,
    damageNumbersRef: gameRefs.damageNumbers,
    comboMultipliers: combo.getMultipliers(),
  });

  // 레벨업 감지 + 일시정지
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpChoices, setLevelUpChoices] = useState<LevelUpChoice[]>([]);

  // 레벨업 체크 (useEffect로 polling — ref 기반이므로 state 대신)
  // GameLogic 내부에서 pausedRef.current 체크하여 early return

  return (
    <div style={{ ... }}>
      <MatrixScene
        gameActive={true}
        gameRefs={gameRefs}
        pausedRef={pausedRef}
        blockWeaponsTick={blockWeapons.tick}
        onEnemyKill={(enemy) => {
          combo.registerKill();
          // XP 획득 + 레벨업 체크
        }}
      />

      {/* 레벨업 카드 선택 UI (DOM overlay) */}
      {showLevelUp && (
        <MatrixLevelUp
          choices={levelUpChoices}
          onSelect={(skill, branch?) => {
            skillBuild.applyLevelUp(skill, branch);
            pausedRef.current = false;
            setShowLevelUp(false);
          }}
        />
      )}
    </div>
  );
}
```

### Data Flow

#### 레벨업 시퀀스 다이어그램

```
GameLogic.useFrame(dt)
  │
  ├─ if (pausedRef.current) → return (게임 정지)
  │
  ├─ blockWeapons.tick(dt) → 무기 발사 + 투사체 이동 + 충돌
  │   └─ onHit(enemy, damage)
  │       ├─ enemy.health -= damage
  │       ├─ if (enemy.health <= 0)
  │       │   ├─ combo.registerKill()
  │       │   ├─ xpGain = baseXP * combo.getMultipliers().xp
  │       │   └─ player.xp += xpGain
  │       └─ damageNumbers.push(...)
  │
  ├─ XP 임계값 체크:
  │   if (player.xp >= player.nextLevelXp)
  │   ├─ player.level++
  │   ├─ player.nextLevelXp = XP_THRESHOLDS[player.level]
  │   ├─ pausedRef.current = true  ← 게임 일시정지
  │   ├─ choices = skillBuild.generateLevelUpChoices(...)
  │   └─ setShowLevelUp(true)  ← DOM 오버레이 표시
  │
  └─ 계속 (다음 프레임)

MatrixLevelUp.onSelect(skill)
  │
  ├─ skillBuild.applyLevelUp(skill)
  │   ├─ playerSkills.set(skill, nextLevel)
  │   └─ WEAPON_DATA[skill].stats[nextLevel-1] → toBlockStats() → player.weapons[skill]
  ├─ pausedRef.current = false  ← 게임 재개
  └─ setShowLevelUp(false)
```

#### 투사체 충돌 시퀀스

```
useBlockWeapons.tick(dt)
  │
  ├─ for (proj of projectiles):
  │   ├─ proj.position.x += proj.velocity.x * dt
  │   ├─ proj.position.y += proj.velocity.y * dt
  │   ├─ proj.life -= dt
  │   │
  │   ├─ for (enemy of enemies):
  │   │   ├─ dist = sqrt((px-ex)^2 + (py-ey)^2)
  │   │   ├─ if (dist < proj.radius + enemy.radius)
  │   │   │   ├─ if (!proj.hitEnemies.has(enemy.id))
  │   │   │   │   ├─ proj.hitEnemies.add(enemy.id)
  │   │   │   │   ├─ isCrit = random() < player.criticalChance
  │   │   │   │   ├─ dmg = proj.damage * (isCrit ? critMult : 1) * comboMult
  │   │   │   │   ├─ enemy.health -= dmg
  │   │   │   │   ├─ knockback 적용 (블록 단위)
  │   │   │   │   ├─ proj.pierce--
  │   │   │   │   └─ damageNumber 생성
  │   │   │   └─ (이미 히트한 적 — 스킵)
  │   │   └─ (범위 밖 — 스킵)
  │   │
  │   └─ if (proj.life <= 0 || proj.pierce <= 0) → 제거
  │
  └─ projectiles = projectiles.filter(alive)
```

---

## ADR (Architecture Decision Records)

### ADR-001: 블록 좌표 네이티브 시스템 (옵션 A 채택)

**Status**: Accepted

**Context**:
기존 2D 시스템은 픽셀 좌표(0~6000)로 동작하고, /new 3D 월드는 블록 좌표(0~120)를 사용한다.
변환 레이어를 통한 기존 코드 재사용 vs 블록 좌표 네이티브 재구축의 선택.

**Decision**:
블록 좌표 네이티브 시스템 구축 (옵션 A).
- 변환 공식: area/=10, speed/=50, knockback/=10
- damage/cooldown/duration은 스케일 무관이므로 변경 없음
- WEAPON_DATA의 스탯 테이블 자체는 재사용하되, toBlockStats()로 변환

**Consequences**:
- 투사체 position/velocity가 블록 단위로 직접 동작 → 정밀도/성능 ↑
- 지형 높이 쿼리(getMCTerrainHeight)와 자연스럽게 연동
- 기존 2D 코드와 독립 → 기존 시스템 영향 0

### ADR-002: Refs 기반 상태 관리

**Status**: Accepted

**Context**:
React state 업데이트는 리렌더링을 유발하여 60fps 게임 루프에 치명적.
기존 useGameRefs 패턴이 검증됨.

**Decision**:
모든 게임 런타임 상태를 MutableRefObject로 관리.
- playerRef, enemiesRef, projectilesRef — 매 프레임 직접 mutation
- React state는 UI 전용 (showLevelUp, levelUpChoices)
- pausedRef로 게임 루프 일시정지 제어

**Consequences**:
- 60fps에서 0 리렌더링 (useFrame 내부 mutation만)
- 레벨업 UI 표시 시에만 React state 업데이트 발생
- DevTools에서 상태 추적 어려움 → gameRefs 디버깅 유틸 필요

### ADR-003: 3D 렌더러 복사 전략 (원본 보존)

**Status**: Accepted

**Context**:
기존 3D 무기 렌더러(SkillWeapons, RangedWeapons, MeleeWeapons)는 WORLD_SCALE=1/50,
Z부호 반전(-y) 좌표 매핑을 사용. /new 월드는 WORLD_SCALE=1, Z부호 반전 없음.

**Decision**:
렌더러 파일 복사 후 수정 (원본 보존).
- `BlockSkillWeapons.tsx`, `BlockRangedWeapons.tsx`, `BlockMeleeWeapons.tsx` 생성
- 변경: WORLD_SCALE=1, Z반전 제거, 지형 높이 적용
- 원본 파일은 기존 2D 모드에서 계속 사용

**Consequences**:
- 기존 2D 모드 영향 0 (리그레션 리스크 제거)
- 코드 중복 발생 → 공통 로직 추출은 Phase 5+ 리팩토링에서

### ADR-004: useSkillBuild/useCombo Standalone 재사용

**Status**: Accepted

**Context**:
useSkillBuild은 React state(Map)로 스킬 레벨 관리, generateLevelUpChoices() 호출 시
현재 스킬 상태 기반으로 4개 선택지 생성. 좌표 무관 로직이므로 그대로 재사용 가능.
useCombo는 comboRef(MutableRefObject)로 상태 관리, registerKill() → 배율 반환.

**Decision**:
두 훅을 /new page.tsx에서 직접 마운트하여 standalone 사용.
- useSkillBuild: 레벨업 선택지 생성 + 스킬 레벨 관리
- useCombo: 킬 등록 + XP/데미지 배율 반환
- 좌표 의존성 없음 → 수정 없이 재사용

**Consequences**:
- 기존 검증된 밸런스 (55종 스킬, 11티어 콤보) 그대로 활용
- useBlockWeapons가 playerSkills 변경을 감지하여 새 무기 장착

---

## Detailed Component Specifications

### 5.1 useBlockWeapons — 무기 발사 패턴 상세

#### 근접 무기 (Melee)

**whip (전투 채찍)**:
```
발사 조건: cooldown 도달
히트 판정: 부채꼴 즉발 (angle ± 60°, radius = area blocks)
대상: 부채꼴 내 모든 적 (pierce=999)
넉백: facing 방향으로 knockback blocks
시각: SwingArc 이벤트 발행 (기존 재사용)
```

**garlic (방어 필드)**:
```
발사 조건: cooldown 도달
히트 판정: 플레이어 중심 원형 AOE (radius = area blocks)
대상: 원 안의 모든 적 (pierce=999)
데미지: damage/tick (tick = cooldown)
시각: BlockMeleeWeapons — glow ring
```

**bible (가디언 위성)**:
```
발사 조건: 첫 발사 시 궤도 투사체 amount개 생성
업데이트: orbitAngle += orbitSpeed * dt
위치: player.pos + (cos(angle), sin(angle)) * orbitRadius
히트: 궤도 투사체와 적 충돌 (원형)
지속: duration초 후 소멸 → cooldown 대기 → 재생성
```

#### 원거리 무기 (Ranged)

**wand (에너지 볼트)**:
```
발사: 가장 가까운 적 방향으로 유도탄
속도: speed blocks/s (9 b/s)
유도: 매 프레임 적 방향으로 steering (homingStrength=3)
히트: 원형 충돌 (radius = area blocks)
바운스: 히트 후 bounce → 다음 적 (진화 시)
```

**knife (전투 단검)**:
```
발사: 플레이어 facing 방향으로 amount개 (부채꼴 spread)
속도: speed blocks/s (10 b/s)
회전: rotationSpeed = 12 rad/s
히트: 원형 충돌 → 폭발 (진화 시 explosionRadius)
```

**bow (레일건)**:
```
발사: 가장 가까운 적 방향으로 직선
속도: speed blocks/s (12 b/s)
관통: pierce개 적 관통
히트: 원형 충돌 (얇은 화살)
```

### 5.2 투사체 Object Pool

```typescript
/**
 * 투사체 풀 — GC 최소화
 * 최대 200개 투사체 사전 할당, 재활용
 *
 * 설계 결정: 기존 Projectile[] 배열 기반 유지 (Object Pool 패턴)
 * - 투사체 만료 시 배열에서 filter 제거
 * - 새 투사체 생성 시 push
 * - 200개 초과 시 가장 오래된 투사체 강제 만료
 */
const MAX_PROJECTILES = 200;

function enforceProjectileLimit(projectiles: Projectile[]): void {
  if (projectiles.length > MAX_PROJECTILES) {
    // 수명이 가장 짧은(오래된) 투사체 우선 제거
    projectiles.sort((a, b) => a.life - b.life);
    projectiles.length = MAX_PROJECTILES;
  }
}
```

### 5.3 레벨업 시스템 통합

#### XP 흐름
```
적 처치 → baseXP (적 타입별)
  │
  ├─ comboMultiplier = combo.getMultipliers().xp (1.0 ~ 5.0)
  │
  ├─ xpGain = baseXP * comboMultiplier
  │
  ├─ player.xp += xpGain
  │
  └─ if (player.xp >= player.nextLevelXp)
      ├─ player.level++
      ├─ player.nextLevelXp = XP_THRESHOLDS[player.level] ?? (player.nextLevelXp * 1.1)
      │   // XP_THRESHOLDS 범위 초과 시 10% 증가
      ├─ pausedRef.current = true
      └─ showLevelUp()
```

#### XP 적 타입별 테이블 (블록 좌표 월드)
| 적 타입 | HP | XP 보상 | 비고 |
|---------|------|---------|------|
| glitch | 100 | 10 | 기본 졸개 |
| bot | 150 | 20 | 중급 |
| whale | 250 | 50 | 보스급 |
| elite_silver | 500 | 80 | 100킬마다 |
| elite_gold | 1000 | 150 | 200킬마다 |
| elite_diamond | 2000 | 300 | 300킬마다 |

#### 레벨업 UI 통합
```typescript
// MatrixLevelUp 필수 props
interface MatrixLevelUpProps {
  choices: LevelUpChoice[];        // useSkillBuild.generateLevelUpChoices() 결과
  onSelect: (skill: WeaponType, branch?: 'A' | 'B') => void;
  // 선택적 props
  playerLevel?: number;
  showBranchChoice?: boolean;      // Lv.11 도달 시
}
```

### 5.4 콤보 킬 시스템 통합

```
useCombo (기존 훅 재사용)
  │
  ├─ registerKill()
  │   ├─ combo.count++
  │   ├─ combo.timer = COMBO_CONFIG.decayTime (3초)
  │   ├─ checkTierUp() → 11단계 콤보 티어
  │   └─ return { tierUp, from, to, screenShake }
  │
  ├─ updateCombo(dt)
  │   ├─ combo.timer -= dt
  │   └─ if (timer <= 0) → resetCombo('timeout')
  │
  └─ getMultipliers()
      └─ { xp: 1~5, speed: 1~1.5, damage: 1~3 }

콤보 티어 배율 (COMBO_CONFIG.tiers):
  none(0) → bronze(3) → silver(5) → gold(10)
  → diamond(15) → platinum(20) → master(30)
  → grandmaster(50) → legend(75) → mythic(100)
  → transcendent(150)
```

### 5.5 Wave 난이도 시스템

```typescript
interface WaveConfig {
  /** 웨이브 시작 시간 (초) */
  startTime: number;
  /** 적 HP 배율 */
  hpMultiplier: number;
  /** 적 데미지 배율 */
  damageMultiplier: number;
  /** 적 속도 배율 */
  speedMultiplier: number;
  /** 스폰 간격 배율 (낮을수록 빠름) */
  spawnRateMultiplier: number;
  /** 활성 적 타입 */
  enemyTypes: EnemyType[];
  /** 페이즈 이름 */
  phaseName: 'SKIRMISH' | 'ENGAGEMENT' | 'SHOWDOWN';
}

// 시간 기반 Wave 프로그레션
const WAVE_PROGRESSION: WaveConfig[] = [
  { startTime: 0,   hpMult: 1.0, dmgMult: 1.0, spdMult: 1.0, spawnRate: 1.0,
    enemies: ['glitch'], phase: 'SKIRMISH' },
  { startTime: 60,  hpMult: 1.5, dmgMult: 1.2, spdMult: 1.1, spawnRate: 0.9,
    enemies: ['glitch', 'bot'], phase: 'SKIRMISH' },
  { startTime: 120, hpMult: 2.0, dmgMult: 1.5, spdMult: 1.2, spawnRate: 0.8,
    enemies: ['glitch', 'bot', 'malware'], phase: 'ENGAGEMENT' },
  { startTime: 240, hpMult: 3.0, dmgMult: 2.0, spdMult: 1.3, spawnRate: 0.7,
    enemies: ['bot', 'malware', 'whale'], phase: 'ENGAGEMENT' },
  { startTime: 420, hpMult: 5.0, dmgMult: 3.0, spdMult: 1.5, spawnRate: 0.5,
    enemies: ['malware', 'whale', 'sniper'], phase: 'SHOWDOWN' },
];
```

### 5.6 엘리트 몬스터 시스템

```typescript
interface EliteSpawnConfig {
  /** 필요 킬 수 */
  killThreshold: number;
  /** 엘리트 등급 */
  tier: EliteTier;
  /** HP 배율 */
  hpMultiplier: number;
  /** 데미지 배율 */
  damageMultiplier: number;
  /** 크기 배율 */
  sizeMultiplier: number;
  /** 드롭 아이템 */
  drops: PickupType[];
}

const ELITE_CONFIG: EliteSpawnConfig[] = [
  { killThreshold: 100, tier: 'silver',  hpMult: 5,  dmgMult: 2, sizeMult: 1.5,
    drops: ['chest', 'upgrade_material'] },
  { killThreshold: 200, tier: 'gold',    hpMult: 10, dmgMult: 3, sizeMult: 2.0,
    drops: ['chest', 'upgrade_material', 'bomb'] },
  { killThreshold: 300, tier: 'diamond', hpMult: 20, dmgMult: 5, sizeMult: 2.5,
    drops: ['chest', 'upgrade_material', 'bomb', 'magnet'] },
];
```

---

## Performance Budget

### 프레임 예산 (16.67ms @ 60fps)

| 시스템 | 예산 | 최적화 전략 |
|--------|------|------------|
| GameLogic.useFrame | 4ms | 투사체 O(n*m) 충돌 → spatial hash 고려 |
| useBlockWeapons.tick | 3ms | 투사체 200개 제한, 초기: 브루트포스 충돌 |
| 3D 렌더러 업데이트 | 3ms | InstancedMesh 배칭, count 동적 조절 |
| EnemyRenderer | 2ms | 50개 InstancedMesh |
| 나머지 (카메라/지형) | 4.67ms | 기존 최적화 유지 |

### 메모리 예산

| 리소스 | 제한 | 관리 |
|--------|------|------|
| 투사체 | 200개 | enforceProjectileLimit() 강제 만료 |
| 적 | 50개 | TARGET_ENEMY_COUNT 상한 |
| 데미지 넘버 | 100개 | life 기반 자동 만료 |
| 파티클 | 500개 | life 기반 자동 만료 |

### 충돌 검사 최적화 경로

```
Phase 1 (초기): O(n*m) 브루트포스
  - n = 투사체 (≤200), m = 적 (≤50)
  - 200*50 = 10,000 거리 계산/프레임
  - sqrt 회피: distSq 비교 (r1+r2)^2
  - 예상: ~0.5ms/프레임

Phase 2+ (필요 시): 공간 해싱
  - 블록 좌표 기반 격자 (cellSize = 4 blocks)
  - 같은 셀 + 인접 8셀만 검사
  - 예상: ~0.1ms/프레임
```

---

## File Structure (신규/수정 파일)

```
apps/web/
├── app/new/page.tsx                          # ★ 수정: 훅 오케스트레이션 + DOM 오버레이
├── lib/matrix/
│   ├── hooks/
│   │   └── useBlockWeapons.ts                # ★ 신규: 블록 좌표 무기 시스템 코어
│   ├── config/
│   │   └── block-weapon-stats.ts             # ★ 신규: 블록 스케일 변환 유틸
│   └── types.ts                              # 기존 (수정 없음)
├── components/game/matrix/
│   ├── MatrixScene.tsx                       # ★ 수정: pausedRef + blockWeaponsTick 연동
│   └── 3d/weapons/
│       ├── BlockSkillWeapons.tsx              # ★ 신규 (복사): 블록 좌표 스킬 무기 렌더러
│       ├── BlockRangedWeapons.tsx             # ★ 신규 (복사): 블록 좌표 원거리 렌더러
│       ├── BlockMeleeWeapons.tsx              # ★ 신규 (복사): 블록 좌표 근접 렌더러
│       ├── SkillWeapons.tsx                   # 기존 (보존)
│       ├── RangedWeapons.tsx                  # 기존 (보존)
│       └── MeleeWeapons.tsx                   # 기존 (보존)
```

---

## Phase-by-Phase Implementation Guide

### Phase 1: 블록 좌표 무기 시스템 코어

**산출물**:
1. `block-weapon-stats.ts` — toBlockStats(), getBlockWeaponStats()
2. `useBlockWeapons.ts` — tick(dt) 메서드 (발사 + 투사체 + 충돌)
3. `MatrixScene.tsx` 수정 — GameLogic 내 기존 25dmg auto-attack → useBlockWeapons.tick()
4. `page.tsx` 수정 — useBlockWeapons 마운트, gameRefs 주입

**검증 기준**:
- [ ] 무기 발사 시 projectilesRef에 투사체 생성 확인
- [ ] 적 충돌 시 enemy.health 감소
- [ ] 쿨다운 정상 작동 (연사 제한)
- [ ] 투사체 200개 제한 동작

### Phase 2: 3D 투사체 렌더링

**산출물**:
1. `BlockSkillWeapons.tsx` — SkillWeapons 복사 + WORLD_SCALE=1 + 지형 높이
2. `BlockRangedWeapons.tsx` — RangedWeapons 복사 + WORLD_SCALE=1 + 지형 높이
3. `BlockMeleeWeapons.tsx` — MeleeWeapons 복사 + WORLD_SCALE=1 + 지형 높이
4. SceneContent에 마운트

**검증 기준**:
- [ ] 투사체 position(블록)과 3D mesh position 일치 (오차 ±0.5 block)
- [ ] 투사체가 지형 높이 + 1.5 block 위에서 이동
- [ ] 적 20 + 투사체 50 동시 렌더링 시 60fps

### Phase 3: 레벨업 & 스킬 트리 연결

**산출물**:
1. `page.tsx` 확장 — useSkillBuild + useCombo 마운트
2. XP 임계값 체크 → 일시정지 → 레벨업 UI
3. MatrixLevelUp DOM overlay 마운트
4. 스킬 선택 → 무기 레벨 증가 → player.weapons 업데이트

**검증 기준**:
- [ ] XP 임계값 도달 시 게임 일시정지
- [ ] 4개 스킬 카드 표시
- [ ] 카드 선택 시 새 무기 발사 확인
- [ ] 게임 재개 후 정상 동작

### Phase 4: 콤보 & Wave 난이도

**산출물**:
1. 킬 시 combo.registerKill() 호출
2. Wave 프로그레션 (시간 기반 적 강화)
3. 엘리트 몬스터 스폰 (100/200/300킬)
4. 페이즈 전환 텍스트 배너

**검증 기준**:
- [ ] 콤보 티어 변화 시 XP/데미지 배율 증가
- [ ] 시간 경과에 따라 적 HP/데미지 스케일링
- [ ] 엘리트 처치 시 특수 드롭

### Phase 5: 분기 진화 & 폴리싱

**산출물**:
1. Lv.11 BranchSelectModal 연결
2. Lv.20 궁극기 해금 + 이펙트
3. PostProcessing (Bloom + Vignette)
4. 킬 이펙트 에스컬레이션

**검증 기준**:
- [ ] Lv.11 분기 선택 UI 동작
- [ ] Lv.20 궁극기 이펙트 발동
- [ ] Bloom 이펙트 정상 렌더링

---

## Scalability

### 투사체 확장 전략
- 현재: 200개 상한 (InstancedMesh 배칭)
- 확장: 500개까지 → WebGL instancing으로 draw call 1회
- 최종: WebGPU compute shader (r175+ Three.js)

### 적 확장 전략
- 현재: 50개 상한 (InstancedMesh)
- 확장: 100개 → spatial hash 충돌 검사 필수
- 최종: 200개 → LOD 시스템 (원거리 적 단순화)

---

## Reliability

### 에러 복구
- 투사체 NaN position → 즉시 제거 (isNaN 체크)
- 무기 스탯 조회 실패 → 기본값 폴백 (damage=10, speed=5)
- useSkillBuild 초기화 실패 → 빈 스킬맵으로 시작

### 게임 상태 일관성
- pausedRef.current = true 시 GameLogic 전체 스킵 (투사체 포함)
- 레벨업 중 적 이동/공격도 정지 (완전 일시정지)
- 사망 → 부활 시 모든 투사체 유지 (게임 연속성)

---

## Observability

### 디버깅 지원
```typescript
// GameHUD3D에 추가 표시 (개발 모드)
if (process.env.NODE_ENV === 'development') {
  // 투사체 수, 적 수, FPS, 콤보 티어
  debugInfo = {
    projectiles: projectilesRef.current.length,
    enemies: enemiesRef.current.length,
    fps: 1 / dt,
    comboTier: combo.comboRef.current.tier,
    playerLevel: player.level,
    weaponCount: Object.keys(player.weapons).length,
  };
}
```

---

## Interface Contracts

### MatrixSceneProps 확장

```typescript
// 기존
export interface MatrixSceneProps {
  gameActive: boolean;
  gameRefs?: GameRefs;
}

// v42 확장
export interface MatrixSceneProps {
  gameActive: boolean;
  gameRefs?: GameRefs;
  /** 레벨업 중 게임 일시정지 */
  pausedRef?: MutableRefObject<boolean>;
  /** 블록 좌표 무기 시스템 tick (GameLogic useFrame에서 호출) */
  blockWeaponsTick?: (dt: number) => void;
  /** 적 처치 콜백 (콤보/XP 처리) */
  onEnemyKill?: (enemy: Enemy, damageSource: WeaponType | 'auto') => void;
}
```

### 킬 카운터 관리 (엘리트 스폰용)

```typescript
// page.tsx에서 관리하는 킬 카운트 ref
const killCountRef = useRef(0);
const nextEliteThreshold = useRef(100);  // 첫 엘리트: 100킬

// onEnemyKill 콜백
const handleEnemyKill = useCallback((enemy: Enemy, source: WeaponType | 'auto') => {
  killCountRef.current++;
  const { tierUp } = combo.registerKill();

  // XP 획득
  const baseXP = getXPForEnemy(enemy);
  const xpGain = Math.floor(baseXP * combo.getMultipliers().xp);
  gameRefs.player.current.xp += xpGain;

  // 엘리트 스폰 체크
  if (killCountRef.current >= nextEliteThreshold.current) {
    const eliteConfig = ELITE_CONFIG.find(e => e.killThreshold === nextEliteThreshold.current);
    if (eliteConfig) {
      spawnElite(eliteConfig, gameRefs);
      nextEliteThreshold.current += 100; // 다음 엘리트 100킬 후
    }
  }

  // 레벨업 체크
  checkLevelUp();
}, []);
```

### 초기 무기 부여

```typescript
// 게임 시작 시 기본 무기 1개 부여 (캐릭터 클래스별)
const STARTING_WEAPONS: Record<PlayerClass, WeaponType> = {
  neo: 'whip',
  tank: 'garlic',
  cypher: 'wand',
  morpheus: 'bible',
  niobe: 'bow',
  oracle: 'lightning',
  trinity: 'knife',
  mouse: 'axe',
  dozer: 'punch',
};

// page.tsx 초기화 시
useEffect(() => {
  const startWeapon = STARTING_WEAPONS[playerClass ?? 'neo'];
  skillBuild.applyLevelUp(startWeapon);
}, []);
```

---

## Self-Verification Checklist

### 기획서(v42-skill-combat-plan.md) 대비 완성도

| # | 요구사항 | 아키텍처 커버리지 | 상태 |
|---|---------|-----------------|------|
| FR-01 | 무기 자동 발사 (최대 5개) | useBlockWeapons.tick() — playerSkills Map 순회 | OK |
| FR-02 | 투사체 시스템 | tick() 내 position/velocity/collision | OK |
| FR-03 | 레벨업 루프 | XP 체크 → pausedRef → MatrixLevelUp → applyLevelUp | OK |
| FR-04 | 스킬 트리 연결 | useSkillBuild standalone | OK |
| FR-05 | 3D 투사체 렌더링 | Block*Weapons.tsx 3개 (복사 수정) | OK |
| FR-06 | 콤보 킬 시스템 | useCombo.registerKill() → getMultipliers() | OK |
| FR-07 | Wave 난이도 | WAVE_PROGRESSION 5단계 + 적 타입 확장 | OK |
| FR-08 | 엘리트 몬스터 | ELITE_CONFIG 3단계 + killCount 트리거 | OK |
| FR-09 | 분기 진화 | BranchSelectModal Lv.11 + 궁극기 Lv.20 | OK |
| NFR-01 | 60fps | Performance budget 16.67ms 분배 | OK |
| NFR-02 | Object Pool | enforceProjectileLimit(200) | OK |
| NFR-03 | 모바일 | MobileControls3D 기존 활용 | OK |

### 일관성 검증

| 검증 항목 | 결과 |
|-----------|------|
| 블록 변환 공식 일관성 (area/10, speed/50, kb/10) | toBlockStats() 1곳에 중앙화 |
| Refs vs State 경계 명확성 | 런타임=Refs, UI=State (pausedRef, showLevelUp) |
| 기존 코드 영향 0 | 원본 렌더러/훅 수정 없음 (복사/재사용) |
| 좌표 매핑 일관성 | WORLD_SCALE=1, Z부호 반전 없음, 지형 높이 적용 |
| 파일 네이밍 규칙 | kebab-case: block-weapon-stats.ts, BlockSkillWeapons.tsx |

---

## Open Questions

1. **투사체 풀 크기**: 200개가 적정한가? 스킬 5개 동시 발사 시 부족할 수 있음 → Phase 1에서 검증
2. **충돌 검사 최적화 시점**: 브루트포스로 시작, fps 드롭 시 spatial hash 전환
3. **MatrixLevelUp 컴포넌트 직접 import 가능 여부**: 기존 2D 모드 의존성 확인 필요 → import 실패 시 경량 카드 UI 자체 구현
4. **블록 좌표 whip 범위**: area=4 blocks가 시각적으로 적절한지 플레이테스트 필요
5. **sword/punch 발사 패턴**: plan 초기 6종 이외 무기는 Phase 3+ 레벨업에서 획득 시 패턴 추가
