# Snake Arena v4 — 상세 시스템 아키텍처

> **기반**: PLAN.md v4.0 (Gameplay Enhancement Update)
> **범위**: C4 Level 2-3, 상세 데이터 모델, 네트워크 프로토콜, 시퀀스 다이어그램
> **작성일**: 2026-02-28

---

## 1. 아키텍처 개요 (C4 Level 2)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Arena Server (Node.js)                     │
│                                                                 │
│  ┌───────────┐   ┌──────────────┐   ┌────────────────────┐     │
│  │ Arena     │──▶│ CollisionSys │   │ StateSerializer    │     │
│  │ (오케스트)│   │ + ghost skip │   │ + activeEffects    │     │
│  │           │   └──────────────┘   │ + orbType extended │     │
│  │ gameLoop: │                      └────────────────────┘     │
│  │  botAI    │   ┌──────────────┐   ┌────────────────────┐     │
│  │  move     │──▶│ OrbManager   │   │ Broadcaster        │     │
│  │  spatial  │   │ + 특수 오브   │   │ (state/death/kill) │     │
│  │  collide  │   │   스폰 확률  │   └────────────────────┘     │
│  │  collect  │   └──────────────┘                               │
│  │  effects  │   ┌──────────────────┐                           │
│  │  leaderbd │──▶│ BotManager       │                           │
│  └───────────┘   │ + BotBehaviors   │                           │
│                  │ + 3 difficulty    │                           │
│  ┌───────────┐   │ + behavior tree  │                           │
│  │ SnakeEntity│  └──────────────────┘                           │
│  │ + effects │                                                  │
│  │ + cooldown│   ┌──────────────┐                               │
│  └───────────┘   │ SpatialHash  │                               │
│                  └──────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                           │ Socket.IO (state 20Hz)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Web Client (Next.js)                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ renderer/                                                │    │
│  │  background.ts  — 존 시스템 + 파티클 + 그라디언트        │    │
│  │  entities.ts    — 패턴 렌더 + 머리 모양 + 꼬리 이펙트   │    │
│  │                   + 특수 오브 비주얼 + 효과 시각화       │    │
│  │  ui.ts          — 효과 HUD + 존 미니맵                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────────┐          │
│  │ useSocket │  │ useGameLoop  │  │ useInput        │          │
│  └───────────┘  └──────────────┘  └─────────────────┘          │
│  ┌───────────┐  ┌──────────────┐                               │
│  │ camera.ts │  │ interpolation│                               │
│  └───────────┘  └──────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1 변경 범위 요약

| 모듈 | 신규/수정 | 변경 강도 |
|------|----------|----------|
| `shared/types/game.ts` | 수정 | ★★★ (타입 확장, 전체 영향) |
| `shared/types/events.ts` | 수정 | ★★ (네트워크 데이터 확장) |
| `shared/constants/game.ts` | 수정 | ★★ (스킨 24종, 밸런스 상수) |
| `server/game/Arena.ts` | 수정 | ★★★ (효과 처리 + magnet 루프) |
| `server/game/Snake.ts` | 수정 | ★★ (activeEffects, cooldowns) |
| `server/game/OrbManager.ts` | 수정 | ★★ (특수 오브 스폰) |
| `server/game/CollisionSystem.ts` | 수정 | ★ (ghost 분기 1개) |
| `server/game/StateSerializer.ts` | 수정 | ★★ (effects 직렬화) |
| `server/game/BotManager.ts` | 전면 교체 | ★★★★ |
| `server/game/BotBehaviors.ts` | **신규** | ★★★★ |
| `web/lib/renderer/background.ts` | 전면 교체 | ★★★ |
| `web/lib/renderer/entities.ts` | 수정 | ★★★★ (패턴+머리+꼬리+오브) |
| `web/lib/renderer/ui.ts` | 수정 | ★★ |

## 2. 상세 데이터 모델

### 2.1 타입 확장 (shared/types/game.ts)

```typescript
// ── OrbType 확장 ──
export type OrbType = 'natural' | 'death' | 'boost_trail'
  | 'magnet' | 'speed' | 'ghost' | 'mega';

// ── 파워업 효과 타입 ──
export type EffectType = 'magnet' | 'speed' | 'ghost';

export interface ActiveEffect {
  type: EffectType;
  expiresAt: number;  // tick when effect expires
}

// ── 효과 쿨다운 (ghost 악용 방지) ──
export interface EffectCooldown {
  type: EffectType;
  availableAt: number;  // tick when orb can be picked up again
}

// ── Snake 인터페이스 확장 ──
export interface Snake {
  // ... 기존 필드 유지 ...
  activeEffects: ActiveEffect[];    // 현재 활성 효과
  effectCooldowns: EffectCooldown[]; // 쿨다운 중인 효과
}

// ── SnakeSkin 확장 ──
export interface SnakeSkin {
  id: number;
  primaryColor: string;
  secondaryColor: string;
  pattern: 'solid' | 'striped' | 'gradient' | 'dotted';
  eyeStyle: 'default' | 'angry' | 'cute' | 'cool';
  accentColor?: string;
  headShape?: 'round' | 'diamond' | 'arrow';
  tailEffect?: 'none' | 'spark' | 'trail' | 'fade';
}
```

### 2.2 Orb 인터페이스 (변경 없음, OrbType만 확장)

기존 `Orb` 인터페이스 그대로 사용. `type` 필드가 새로운 OrbType 값을 가지게 됨.
특수 오브의 `value` 필드: mega=30, 나머지(magnet/speed/ghost)=0 (mass 증가 없이 효과만).

### 2.3 봇 상태 확장 (BotState)

```typescript
export type BotDifficulty = 'easy' | 'medium' | 'hard';
export type BotBehavior = 'survive' | 'hunt' | 'gather' | 'wander';

export interface BotState {
  id: string;
  difficulty: BotDifficulty;
  // 행동 상태
  behavior: BotBehavior;
  targetId: string | null;     // hunt/gather 대상 ID
  // 기존 유지
  wanderAngle: number;
  wanderTimer: number;
  boostTimer: number;
  // 신규
  stuckTimer: number;          // 같은 위치에 머무른 tick 수
  lastPosition: { x: number; y: number };
}
```

### 2.4 서버 SnakeEntity 확장

```typescript
class SnakeEntity {
  data: Snake;                   // activeEffects, effectCooldowns 포함
  trailCounter: number;

  // 신규 메서드
  addEffect(type: EffectType, durationTicks: number, currentTick: number): void;
  removeExpiredEffects(currentTick: number): void;
  hasEffect(type: EffectType): boolean;
  canPickupEffect(type: EffectType, currentTick: number): boolean;
}
```

## 3. 네트워크 프로토콜 확장

### 3.1 SnakeNetworkData 확장

```typescript
export interface SnakeNetworkData {
  i: string;              // id
  n: string;              // name
  h: number;              // heading
  m: number;              // mass
  b: boolean;             // boosting
  k: number;              // skin id
  p: [number, number][];  // segments [[x,y],...]
  // 신규
  e?: number[];           // activeEffects — [effectType, remainingTicks, ...]
                          // effectType: 0=magnet, 1=speed, 2=ghost
                          // 페어로 전송: [0, 100, 2, 60] = magnet 100틱 남음, ghost 60틱 남음
}
```

**대역폭 영향**: 효과 활성 시에만 `e` 필드 추가 (평균 +0~8 bytes/snake). 효과 없으면 필드 생략.

### 3.2 OrbNetworkData 확장

```typescript
export interface OrbNetworkData {
  x: number;
  y: number;
  v: number;              // value
  c: number;              // color index
  t: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  // 기존: 0=natural, 1=death, 2=trail
  // 신규: 3=magnet, 4=speed, 5=ghost, 6=mega
}
```

**맵핑 테이블**:
| OrbType | Network `t` | color idx | value |
|---------|-------------|-----------|-------|
| natural | 0 | random 0-11 | 1-5 |
| death | 1 | from snake | 3-5 |
| boost_trail | 2 | from snake | 2 |
| magnet | 3 | 고정: 12 (보라) | 0 |
| speed | 4 | 고정: 13 (노란) | 0 |
| ghost | 5 | 고정: 14 (청록) | 0 |
| mega | 6 | 고정: 15 (골드) | 30 |

### 3.3 StateSerializer 변경

```typescript
// serializeSnake — e 필드 조건부 추가
private serializeSnake(snake: SnakeEntity): SnakeNetworkData {
  const data: SnakeNetworkData = {
    i: snake.data.id,
    n: snake.data.name,
    h: Math.round(snake.data.heading * 100) / 100,
    m: snake.data.mass,
    b: snake.data.boosting,
    k: snake.data.skin.id,
    p: snake.data.segments.map(s => [
      Math.round(s.x * 10) / 10,
      Math.round(s.y * 10) / 10,
    ] as [number, number]),
  };

  // 활성 효과가 있을 때만 직렬화
  if (snake.data.activeEffects.length > 0) {
    const effectMap = { magnet: 0, speed: 1, ghost: 2 } as const;
    data.e = snake.data.activeEffects.flatMap(e => [
      effectMap[e.type],
      e.expiresAt - currentTick,  // 남은 틱 수
    ]);
  }

  return data;
}

// getStateForPlayer — orb type 매핑 확장
const orbTypeMap: Record<OrbType, number> = {
  natural: 0, death: 1, boost_trail: 2,
  magnet: 3, speed: 4, ghost: 5, mega: 6,
};
```

## 4. 시퀀스 다이어그램 — 핵심 흐름

### 4.1 특수 오브 수집 → 효과 적용 시퀀스

```
Player ─[input]──▶ Arena.gameLoop()
                     │
                     ├── 1. snake.update(config)
                     │      └── ghost 상태면: speed = boostSpeed (무료)
                     │
                     ├── 2. spatialHash 재구성
                     │
                     ├── 3. collisionSystem.detectAll()
                     │      └── ghost 상태 뱀의 body segments 무시
                     │         (head-to-head 충돌은 여전히 유효)
                     │
                     ├── 4. arena.collectOrbs()
                     │      ├── normal/death/trail → snake.addMass(orb.value)
                     │      ├── mega → snake.addMass(30)
                     │      └── magnet/speed/ghost:
                     │           ├── canPickupEffect(type, tick) 체크
                     │           │   └── false면 무시 (쿨다운 중)
                     │           └── snake.addEffect(type, duration, tick)
                     │
                     ├── 5. arena.processEffects()   ← 신규 단계
                     │      ├── removeExpiredEffects(tick)
                     │      │   └── 만료 시 쿨다운 등록
                     │      └── magnet 효과 처리:
                     │           └── 200px 내 orb → snake 방향으로 이동
                     │
                     ├── 6. leaderboard 업데이트
                     └── 7. orbManager.maintainNaturalOrbs(tick)
                            └── 확률적 특수 오브 스폰 포함
```

### 4.2 봇 AI 의사결정 시퀀스

```
Arena.gameLoop()
  └── botManager.update(arena)
        └── for each bot:
              botState = bots.get(id)
              snake = arena.getSnakeById(id)

              PRIORITY SELECTOR:
              ┌─ P0: Survive ────────────────────────────┐
              │  IF distFromCenter > radius * 0.8         │
              │    → targetAngle = toward center          │
              │  ELIF dangerousSnake within 120px         │
              │    → targetAngle = away from threat       │
              │    → boost = true (if mass > threshold)   │
              └──────────────────────────────────────────┘
                           │ (not triggered)
              ┌─ P1: Hunt (Medium/Hard only) ────────────┐
              │  IF snake.mass > 50 AND                   │
              │     vulnerable target within 400px        │
              │    Hard: predict target path, cut off     │
              │    Medium: simple chase, boost to close   │
              └──────────────────────────────────────────┘
                           │ (not triggered)
              ┌─ P2: Gather ─────────────────────────────┐
              │  IF powerup orb within 500px (Hard only)  │
              │    → seek powerup                         │
              │  ELIF death orb cluster within 400px      │
              │    → seek highest value orb               │
              │  ELSE                                     │
              │    → seek nearest orb within 300px        │
              └──────────────────────────────────────────┘
                           │ (no orbs nearby)
              ┌─ P3: Wander ─────────────────────────────┐
              │  IF stuckTimer > 60                       │
              │    → random direction change              │
              │  ELSE                                     │
              │    → gradual wander angle drift           │
              └──────────────────────────────────────────┘

              arena.applyInput(botId, targetAngle, boost, 0)
```

### 4.3 맵 존 렌더링 시퀀스 (클라이언트)

```
GameCanvas.render()
  └── drawBackground(ctx, cam, w, h, arenaRadius)
        │
        ├── 1. 카메라 뷰포트 → 존 판별
        │      distFromCenter = sqrt(cam.x² + cam.y²)
        │      zone = distFromCenter < radius*0.35 ? 'safe'
        │           : distFromCenter < radius*0.75 ? 'battle'
        │           : 'danger'
        │
        ├── 2. 존별 배경 색상 그라디언트 적용
        │      ctx.fillStyle = radialGradient(zoneColors)
        │
        ├── 3. 존별 그리드 색상으로 그리드 렌더링
        │
        ├── 4. drawParticles(ctx, cam, particles)
        │      └── 30~50개 패럴랙스 파티클
        │          position.x -= cam.dx * 0.5 (반속도 스크롤)
        │
        └── 5. drawZoneTransitions(ctx, cam, arenaRadius)
               └── 존 경계에 부드러운 컬러 페이드
```

## 5. 컴포넌트 상세 설계 (C4 Level 3)

### 5.1 Arena.ts 변경 상세

```typescript
// gameLoop()에 추가할 단계
// ★ 검증 수정(H-4): processEffects()를 collectOrbs() 이전으로 이동
//    → magnet pull로 끌어당긴 오브를 같은 tick에서 수집 가능
private gameLoop(): void {
  // ... 기존 0~5 단계 유지 (botAI→move→spatial→collide) ...

  // 5.5 효과 처리 ← 신규 (magnet pull, 효과 만료)
  this.processEffects();

  // 6. Orb 수집 (기존, 로직 확장)
  this.collectOrbs();

  // 7. Leaderboard ← 기존
  // 8. Orb 유지 ← 기존 (spawnNaturalOrb 내부에서 특수 오브 확률 처리)
}

// collectOrbs() 변경
private collectOrbs(): void {
  for (const snake of this.snakes.values()) {
    if (!snake.isAlive) continue;

    // magnet 효과: 수집 반경 확대
    const magnetActive = snake.hasEffect('magnet');
    const effectiveRadius = magnetActive
      ? this.config.collectRadius + 200
      : this.config.collectRadius;

    const nearbyOrbs = this.spatialHash.queryOrbs(snake.head, effectiveRadius);
    for (const orb of nearbyOrbs) {
      const distSq = distanceSq(snake.head, orb.position);
      if (distSq < effectiveRadius * effectiveRadius) {
        this.processOrbCollection(snake, orb);
      }
    }
  }
}

// 신규: 오브 수집 처리
private processOrbCollection(snake: SnakeEntity, orb: Orb): void {
  switch (orb.type) {
    case 'natural':
    case 'death':
    case 'boost_trail':
    case 'mega':
      snake.addMass(orb.value);
      break;
    case 'magnet':
    case 'speed':
    case 'ghost':
      if (snake.canPickupEffect(orb.type, this.tick)) {
        const duration = EFFECT_DURATION[orb.type]; // ticks
        snake.addEffect(orb.type, duration, this.tick);
      }
      break;
  }
  this.orbManager.removeOrb(orb.id);
}

// 신규: 효과 처리
private processEffects(): void {
  for (const snake of this.snakes.values()) {
    if (!snake.isAlive) continue;
    snake.removeExpiredEffects(this.tick);

    // Magnet 효과: 주변 오브를 뱀 방향으로 끌어당기기
    if (snake.hasEffect('magnet')) {
      const nearbyOrbs = this.spatialHash.queryOrbs(snake.head, 200);
      for (const orb of nearbyOrbs) {
        const dx = snake.head.x - orb.position.x;
        const dy = snake.head.y - orb.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
          const pullSpeed = 3; // px/tick
          orb.position.x += (dx / dist) * pullSpeed;
          orb.position.y += (dy / dist) * pullSpeed;
        }
      }
    }
  }
}
```

### 5.2 Snake.ts 변경 상세

```typescript
class SnakeEntity {
  data: Snake;
  trailCounter: number;

  // 신규 메서드들
  addEffect(type: EffectType, durationTicks: number, currentTick: number): void {
    // 같은 타입 중복 방지 (갱신)
    this.data.activeEffects = this.data.activeEffects.filter(e => e.type !== type);
    this.data.activeEffects.push({
      type,
      expiresAt: currentTick + durationTicks,
    });
  }

  removeExpiredEffects(currentTick: number): void {
    const expired = this.data.activeEffects.filter(e => e.expiresAt <= currentTick);
    for (const e of expired) {
      // 쿨다운 등록 (ghost: 200 ticks = 10초)
      const cooldown = EFFECT_COOLDOWN[e.type];
      if (cooldown > 0) {
        this.data.effectCooldowns = this.data.effectCooldowns.filter(c => c.type !== e.type);
        this.data.effectCooldowns.push({
          type: e.type,
          availableAt: currentTick + cooldown,
        });
      }
    }
    this.data.activeEffects = this.data.activeEffects.filter(e => e.expiresAt > currentTick);
    // 만료된 쿨다운도 정리
    this.data.effectCooldowns = this.data.effectCooldowns.filter(
      c => c.availableAt > currentTick
    );
  }

  hasEffect(type: EffectType): boolean {
    return this.data.activeEffects.some(e => e.type === type);
  }

  canPickupEffect(type: EffectType, currentTick: number): boolean {
    return !this.data.effectCooldowns.some(
      c => c.type === type && c.availableAt > currentTick
    );
  }

  // update() 변경: speed 효과 처리
  update(config: ArenaConfig): void {
    // ... 기존 각도 조향 ...

    // 부스트 처리 변경
    const hasSpeedEffect = this.hasEffect('speed');
    if (this.data.boosting && (this.data.mass > config.minBoostMass || hasSpeedEffect)) {
      this.data.speed = config.boostSpeed;
      if (!hasSpeedEffect) {
        // speed 효과 없으면 기존대로 mass 소모
        this.data.mass -= config.boostCostPerTick;
      }
      this.trailCounter++;
    } else {
      this.data.speed = config.baseSpeed;
      this.data.boosting = false;
      this.trailCounter = 0;
    }

    // ... 기존 이동/세그먼트 로직 ...
  }
}
```

### 5.3 CollisionSystem.ts 변경 상세

```typescript
detectAll(
  snakes: Map<string, SnakeEntity>,
  spatialHash: SpatialHash,
  config: ArenaConfig,
): DeathEvent[] {
  const deaths: DeathEvent[] = [];

  for (const snake of snakes.values()) {
    if (!snake.isAlive) continue;
    const head = snake.head;

    // 경계 충돌 (ghost 효과 무관 — 경계는 항상 유효)
    if (distanceFromOrigin(head) >= config.radius) {
      deaths.push({ snakeId: snake.data.id });
      continue;
    }

    // ★ 검증 수정(H-5): ghost 효과 시 head-body만 skip, head-to-head는 유지
    // continue가 아닌 조건부 분기 — head-to-head 충돌이 아래에서 정상 처리됨
    if (!snake.hasEffect('ghost')) {
      // 머리 vs 다른 뱀 세그먼트 (기존 로직 그대로)
      const nearby = spatialHash.querySegments(head, config.headRadius * 2);
      for (const entry of nearby) {
        if (entry.snakeId === snake.data.id) continue;
        // ... 기존 충돌 판정 ...
      }
    }
  }

  // Head-to-head (ghost 상태여도 적용 — 머리 충돌은 항상 유지)
  // ... 기존 로직 그대로 ...
}
```

### 5.4 OrbManager.ts 변경 상세

```typescript
// spawnNaturalOrb() → spawnOrb()으로 확장
private spawnOrb(type?: OrbType): Orb {
  // 타입 미지정 시 확률 기반 결정
  if (!type) {
    const roll = Math.random() * 100;
    if (roll < 2) type = 'mega';       // 2%
    else if (roll < 5) type = 'ghost';  // 3%
    else if (roll < 10) type = 'magnet'; // 5%
    else if (roll < 18) type = 'speed'; // 8%
    else type = 'natural';              // 82%
  }

  const isSpecial = ['magnet', 'speed', 'ghost', 'mega'].includes(type);

  const orb: Orb = {
    id: this.nextId++,
    position: randomPositionInCircle(this.config.radius, ORB.SPAWN_PADDING),
    value: this.getOrbValue(type),
    color: this.getOrbColor(type),
    type,
    createdAt: 0,
    lifetime: isSpecial ? 600 : undefined,  // 특수 오브: 30초 후 소멸
  };
  this.orbs.set(orb.id, orb);
  return orb;
}

private getOrbValue(type: OrbType): number {
  switch (type) {
    case 'mega': return 30;
    case 'magnet': case 'speed': case 'ghost': return 0;
    default: return ORB.NATURAL_VALUE_MIN +
      Math.floor(Math.random() * (ORB.NATURAL_VALUE_MAX - ORB.NATURAL_VALUE_MIN + 1));
  }
}

private getOrbColor(type: OrbType): number {
  switch (type) {
    case 'magnet': return 12;  // 보라
    case 'speed': return 13;   // 노란
    case 'ghost': return 14;   // 청록
    case 'mega': return 15;    // 골드
    default: return Math.floor(Math.random() * ORB.COLOR_COUNT);
  }
}
```

## 6. 봇 AI 행동 트리 상세 설계

### 6.1 BotBehaviors.ts — 함수형 행동 노드

```typescript
// 행동 결과 타입
interface BotAction {
  targetAngle: number;
  boost: boolean;
}

// ── P0: 생존 ──
export function behaveSurvive(
  snake: Snake, config: ArenaConfig, nearbySnakes: Snake[]
): BotAction | null {
  const head = snake.segments[0];
  const distFromCenter = Math.sqrt(head.x * head.x + head.y * head.y);

  // 경계 회피 (반경 80% 이상이면 중앙으로)
  if (distFromCenter > config.radius * 0.8) {
    return { targetAngle: Math.atan2(-head.y, -head.x), boost: false };
  }

  // 위협 회피 (큰 뱀이 120px 내에 있으면)
  for (const other of nearbySnakes) {
    if (other.id === snake.id || !other.alive) continue;
    const otherHead = other.segments[0];
    const dx = head.x - otherHead.x;
    const dy = head.y - otherHead.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 120 && other.mass > snake.mass * 0.7) {
      return {
        targetAngle: Math.atan2(dy, dx),
        boost: snake.mass > config.minBoostMass + 5,
      };
    }
  }

  return null; // 생존 위협 없음 → 다음 행동으로
}

// ── P1: 사냥 (Medium/Hard) ──
export function behaveHunt(
  snake: Snake, difficulty: BotDifficulty,
  nearbySnakes: Snake[], config: ArenaConfig
): BotAction | null {
  if (difficulty === 'easy') return null;
  if (snake.mass < 50) return null;  // 작으면 사냥 안 함

  // 취약 타겟 탐색 (자신의 1/3 이하 mass, 400px 내)
  const head = snake.segments[0];
  let bestTarget: Snake | null = null;
  let bestDist = 400;

  for (const other of nearbySnakes) {
    if (other.id === snake.id || !other.alive) continue;
    if (other.mass > snake.mass * 0.33) continue;
    const dist = distance(head, other.segments[0]);
    if (dist < bestDist) {
      bestDist = dist;
      bestTarget = other;
    }
  }

  if (!bestTarget) return null;

  const targetHead = bestTarget.segments[0];

  if (difficulty === 'hard') {
    // Hard: 경로 예측 — 타겟의 heading 전방으로 이동
    const predictDist = 80;
    const predictX = targetHead.x + Math.cos(bestTarget.heading) * predictDist;
    const predictY = targetHead.y + Math.sin(bestTarget.heading) * predictDist;
    return {
      targetAngle: Math.atan2(predictY - head.y, predictX - head.x),
      boost: bestDist < 200,
    };
  }

  // Medium: 단순 추격
  return {
    targetAngle: Math.atan2(targetHead.y - head.y, targetHead.x - head.x),
    boost: bestDist < 150 && snake.mass > config.minBoostMass + 10,
  };
}

// ── P2: 수집 ──
export function behaveGather(
  snake: Snake, difficulty: BotDifficulty,
  nearestOrb: Position | null,
  nearestPowerUp: Position | null,
  nearestDeathOrb: Position | null,
): BotAction | null {
  const head = snake.segments[0];

  // Hard: 파워업 우선
  if (difficulty === 'hard' && nearestPowerUp) {
    return {
      targetAngle: Math.atan2(nearestPowerUp.y - head.y, nearestPowerUp.x - head.x),
      boost: false,
    };
  }

  // death 오브 우선 (큰 보상)
  if (nearestDeathOrb) {
    return {
      targetAngle: Math.atan2(nearestDeathOrb.y - head.y, nearestDeathOrb.x - head.x),
      boost: false,
    };
  }

  // 가장 가까운 오브
  if (nearestOrb) {
    return {
      targetAngle: Math.atan2(nearestOrb.y - head.y, nearestOrb.x - head.x),
      boost: false,
    };
  }

  return null;
}

// ── P3: 배회 ──
export function behaveWander(bot: BotState): BotAction {
  bot.wanderTimer++;
  if (bot.wanderTimer > 40 + Math.random() * 60) {
    bot.wanderAngle += (Math.random() - 0.5) * Math.PI * 0.8;
    bot.wanderTimer = 0;
  }
  return { targetAngle: bot.wanderAngle, boost: false };
}
```

### 6.2 BotManager.updateBotAI() — 행동 트리 통합

```typescript
private updateBotAI(botId: string, bot: BotState, arena: Arena): void {
  const snake = arena.getSnakeById(botId);
  if (!snake || !snake.isAlive) return;

  const head = snake.head;
  const config = arena.getConfig();

  // 컨텍스트 수집
  const nearbySnakes = arena.getNearbySnakes(botId, head, 400);
  const nearestOrb = arena.findNearestOrb(head, 300);
  const nearestPowerUp = arena.findNearestPowerUpOrb(head, 500);
  const nearestDeathOrb = arena.findNearestOrbByType(head, 400, 'death');

  // 우선순위 기반 행동 선택
  const action =
    behaveSurvive(snake.data, config, nearbySnakes) ??
    behaveHunt(snake.data, bot.difficulty, nearbySnakes, config) ??
    behaveGather(snake.data, bot.difficulty, nearestOrb, nearestPowerUp, nearestDeathOrb) ??
    behaveWander(bot);

  // stuck 감지 (같은 위치에 60 tick 이상)
  const dx = head.x - bot.lastPosition.x;
  const dy = head.y - bot.lastPosition.y;
  if (dx * dx + dy * dy < 4) {
    bot.stuckTimer++;
    if (bot.stuckTimer > 60) {
      action.targetAngle = Math.random() * Math.PI * 2;
      bot.stuckTimer = 0;
    }
  } else {
    bot.stuckTimer = 0;
    bot.lastPosition = { x: head.x, y: head.y };
  }

  arena.applyInput(botId, normalizeAngle(action.targetAngle), action.boost, 0);
}
```

### 6.3 Arena 신규 헬퍼 메서드

```typescript
// 봇 AI용 추가 조회 메서드
getNearbySnakes(excludeId: string, center: Position, radius: number): Snake[];
findNearestPowerUpOrb(center: Position, radius: number): Position | null;
findNearestOrbByType(center: Position, radius: number, type: OrbType): Position | null;
```

## 7. 렌더링 파이프라인 확장

### 7.1 entities.ts — 패턴별 뱀 렌더링

```
drawSnakes() 렌더링 파이프라인:

for each snake:
  1. screenPoints = segments.map(worldToScreen)

  2. 패턴 분기:
     switch (skin.pattern):
       'solid':    drawSolidBody(3중 레이어 — 현재 로직)
       'striped':  drawStripedBody(3세그먼트마다 color swap)
       'gradient': drawGradientBody(head→tail alpha/color 전이)
       'dotted':   drawDottedBody(solid + dot 오버레이)

  3. 머리 렌더링:
     switch (skin.headShape ?? 'round'):
       'round':   arc() — 현재 로직
       'diamond': drawDiamondHead(heading 방향 다이아몬드)
       'arrow':   drawArrowHead(heading 방향 삼각형)

  4. 눈 렌더링:
     drawEyes(headShape 별 눈 위치 보정)

  5. 꼬리 이펙트:
     switch (skin.tailEffect ?? 'none'):
       'none':  (아무것도 안 함)
       'spark': drawSparkTail(꼬리 끝 2-3개 파티클)
       'trail': drawTrailTail(마지막 3 세그먼트 반투명 복제)
       'fade':  drawFadeTail(alpha 1.0→0.3)

  6. 활성 효과 시각화:
     if hasEffect('ghost'):
       ctx.globalAlpha = 0.4 (전체 뱀 반투명)
     if hasEffect('speed'):
       drawSpeedLines(머리 주변 속도선)
     if hasEffect('magnet'):
       drawMagnetField(보라 원형 필드)
```

### 7.2 패턴 렌더링 함수 상세

```typescript
// striped: primary/secondary 교대
function drawStripedBody(ctx, pts, primaryColor, secondaryColor, thickness): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const color = Math.floor(i / 3) % 2 === 0 ? primaryColor : secondaryColor;
    // 세그먼트별 원 + 연결 라인
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pts[i].x, pts[i].y, thickness, 0, Math.PI * 2);
    ctx.fill();
  }
}

// gradient: head→tail 점진 변화
function drawGradientBody(ctx, pts, primaryColor, secondaryColor, thickness): void {
  for (let i = 0; i < pts.length; i++) {
    const t = i / (pts.length - 1);  // 0(head) → 1(tail)
    const color = lerpColor(primaryColor, secondaryColor, t);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pts[i].x, pts[i].y, thickness, 0, Math.PI * 2);
    ctx.fill();
  }
}

// dotted: solid body + dot 오버레이
function drawDottedBody(ctx, pts, primaryColor, secondaryColor, thickness): void {
  // 1. solid body (primary)
  drawSolidBody(ctx, pts, primaryColor, thickness);
  // 2. dot 오버레이 (매 4세그먼트마다)
  ctx.fillStyle = secondaryColor;
  for (let i = 0; i < pts.length; i += 4) {
    ctx.beginPath();
    ctx.arc(pts[i].x, pts[i].y, thickness * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

### 7.3 머리 모양 렌더링

```typescript
function drawDiamondHead(ctx, headPt, heading, radius): void {
  ctx.save();
  ctx.translate(headPt.x, headPt.y);
  ctx.rotate(heading);
  ctx.beginPath();
  ctx.moveTo(radius * 1.3, 0);       // 앞 꼭짓점 (뾰족)
  ctx.lineTo(0, radius * 0.8);       // 좌
  ctx.lineTo(-radius * 0.5, 0);      // 뒤
  ctx.lineTo(0, -radius * 0.8);      // 우
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawArrowHead(ctx, headPt, heading, radius): void {
  ctx.save();
  ctx.translate(headPt.x, headPt.y);
  ctx.rotate(heading);
  ctx.beginPath();
  ctx.moveTo(radius * 1.5, 0);       // 화살표 팁
  ctx.lineTo(-radius * 0.3, radius);  // 좌하
  ctx.lineTo(0, 0);                   // 중앙 오목
  ctx.lineTo(-radius * 0.3, -radius); // 우상
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
```

### 7.4 특수 오브 렌더링

```typescript
// drawOrbs() 확장 — 특수 오브 분기
function drawSpecialOrb(ctx, sx, sy, r, orbType, tick): void {
  switch (orbType) {
    case 3: // magnet — 보라 + 회전 자기장 링
      ctx.strokeStyle = 'rgba(147, 51, 234, 0.5)';
      ctx.lineWidth = 1.5;
      const magnetAngle = (tick * 0.05) % (Math.PI * 2);
      ctx.beginPath();
      ctx.arc(sx, sy, r * 2.5, magnetAngle, magnetAngle + Math.PI * 1.5);
      ctx.stroke();
      break;

    case 4: // speed — 노란 + 번개 글로우
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 8;
      // 메인 오브 (기존 렌더링에 글로우 추가)
      ctx.shadowBlur = 0;
      break;

    case 5: // ghost — 반투명 + 펄스
      const ghostAlpha = 0.4 + Math.sin(tick * 0.1) * 0.2;
      ctx.globalAlpha = ghostAlpha;
      break;

    case 6: // mega — 골드 + 회전 + 크기 2x
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate((tick * 0.03) % (Math.PI * 2));
      // 별 모양 (5각)
      drawStar(ctx, 0, 0, r * 2, 5);
      ctx.restore();
      break;
  }
}
```

### 7.5 background.ts — 존 시스템

```typescript
// 존 색상 정의
const ZONE_COLORS = {
  safe:   { bg: '#152230', grid: 'rgba(30, 48, 64, 0.6)' },
  battle: { bg: '#0F1923', grid: 'rgba(26, 42, 58, 0.4)' },
  danger: { bg: '#1A0A0A', grid: 'rgba(255, 60, 60, 0.15)' },
} as const;

// 파티클 시스템 (경량)
interface BackgroundParticle {
  x: number; y: number;
  size: number;
  alpha: number;
  speed: number;  // drift speed
  angle: number;
}

// 초기화 시 30~50개 생성, 월드 좌표 기준
// drawParticles(): 카메라의 50% 속도로 패럴랙스
// 화면 밖 파티클 → 반대쪽에서 재생성 (오브젝트 풀링 불필요, 배열 재사용)
```

### 7.6 ui.ts — 효과 HUD

```
┌─────────────────────────────────┐
│  효과 HUD (하단 중앙)            │
│                                 │
│  [⚡ 3.2s] [👻 1.8s] [🧲 4.1s] │
│  (아이콘 + 남은 시간 바)         │
│  바 색상: speed=노란, ghost=청록 │
│           magnet=보라            │
└─────────────────────────────────┘
```

효과 HUD는 현재 클라이언트의 자기 뱀에만 표시. SnakeNetworkData.e 배열에서
남은 틱 수를 초 변환 (remainingTicks / tickRate).

## 8. 밸런스 상수 & 설정값

### 8.1 효과 밸런스 상수

```typescript
// shared/constants/game.ts에 추가

export const EFFECT_CONFIG = {
  magnet: {
    durationTicks: 100,   // 5초 @ 20Hz
    cooldownTicks: 0,     // 쿨다운 없음
    pullRadius: 200,      // px
    pullSpeed: 3,         // px/tick
    spawnChance: 0.05,    // 5%
    orbColor: 12,
  },
  speed: {
    durationTicks: 80,    // 4초 @ 20Hz
    cooldownTicks: 0,     // 쿨다운 없음
    spawnChance: 0.08,    // 8%
    orbColor: 13,
  },
  ghost: {
    durationTicks: 60,    // 3초 @ 20Hz
    cooldownTicks: 200,   // 10초 쿨다운
    spawnChance: 0.03,    // 3%
    orbColor: 14,
  },
  mega: {
    value: 30,            // mass +30
    spawnChance: 0.02,    // 2%
    orbColor: 15,
    lifetime: 600,        // 30초 후 소멸
  },
} as const;
```

### 8.2 특수 오브 색상 (ORB_COLORS 확장)

```typescript
// shared/constants/colors.ts — 기존 12색 + 4색 추가

export const ORB_COLORS = [
  // 0-11: 기존 자연 오브 색상 유지
  '#FF4444', '#00D4FF', '#39FF14', '#FF1493',
  '#FFD700', '#FF6B00', '#9B59B6', '#00FFFF',
  '#FF6B6B', '#00CED1', '#FF00FF', '#ADFF2F',
  // 12-15: 특수 오브 전용
  '#9333EA',  // 12: magnet (보라)
  '#FACC15',  // 13: speed (노란)
  '#06B6D4',  // 14: ghost (청록)
  '#F59E0B',  // 15: mega (골드)
];

// ★ 검증 수정(H-9): entities.ts의 drawOrbs()에서
// 기존: ORB_COLORS[colorIdx % ORB_COLORS.length] → 인덱스 12가 0으로 매핑됨
// 수정: ORB_COLORS[colorIdx] ?? ORB_COLORS[0] → 특수 오브 색상 정상 표시
```

### 8.3 봇 난이도 분배

```typescript
export const BOT_DIFFICULTY_DISTRIBUTION = {
  easy: 0.4,    // 40% — 8/20 봇
  medium: 0.4,  // 40% — 8/20 봇
  hard: 0.2,    // 20% — 4/20 봇
} as const;
```

### 8.4 스킨 24종 구성

```
기존 12종 (id 0-11): solid 패턴, round 머리, none 꼬리 — 변경 없음

신규 12종 (id 12-23):
  12: striped  + diamond + spark  (fire red/orange)
  13: striped  + arrow   + trail  (electric blue/cyan)
  14: gradient + diamond + fade   (neon green/lime)
  15: gradient + round   + spark  (hot pink/magenta)
  16: dotted   + arrow   + trail  (gold/orange)
  17: dotted   + diamond + fade   (purple/pink)
  18: striped  + round   + spark  (cyan/blue)
  19: gradient + arrow   + trail  (coral/red)
  20: dotted   + round   + fade   (teal/green)
  21: striped  + diamond + trail  (magenta/purple)
  22: gradient + diamond + spark  (lime/green)
  23: dotted   + arrow   + fade   (orange/gold)
```

### 8.5 존 기반 오브 밀도 (서버 측)

```typescript
// OrbManager.spawnNaturalOrb() — 스폰 위치 가중치
// 외곽(75-100%): 40% 확률
// 중간(35-75%):  40% 확률
// 중앙(0-35%):   20% 확률
//
// 구현: randomPositionInCircle에 가중 랜덤 반경 추가
function weightedRandomRadius(maxRadius: number): number {
  const roll = Math.random();
  if (roll < 0.2) {
    // Safe zone (0-35%): 20% 확률
    return Math.random() * maxRadius * 0.35;
  } else if (roll < 0.6) {
    // Battle zone (35-75%): 40% 확률
    return maxRadius * 0.35 + Math.random() * maxRadius * 0.4;
  } else {
    // Danger zone (75-100%): 40% 확률
    return maxRadius * 0.75 + Math.random() * maxRadius * 0.25;
  }
}
```

## 9. ADR (Architecture Decision Records)

### ADR-004: 효과 시스템 — 서버 권위적 + 클라이언트 시각화

```
Status: Accepted

Context:
  파워업 효과(magnet/speed/ghost)를 서버와 클라이언트 어디서 처리할지.
  클라이언트 처리 = 빠르지만 치팅 가능.
  서버 처리 = 안전하지만 네트워크 데이터 증가.

Decision:
  모든 효과 로직은 서버에서 처리 (server-authoritative).
  클라이언트는 SnakeNetworkData.e 배열로 효과 상태를 수신하여 시각화만.

Consequences:
  ✅ 치팅 불가 (ghost 무한 사용 등)
  ✅ 기존 아키텍처(server-auth) 일관성 유지
  ❌ 효과 시작/종료에 ~50ms 지연 (네트워크 RTT)
  ❌ SnakeNetworkData 약간 증가 (효과 활성 시 +8 bytes)

Mitigation:
  효과 e 필드는 조건부 전송 (효과 없으면 생략)
  클라이언트에서 남은 시간 카운트다운은 로컬 타이머로 보간
```

### ADR-005: 봇 AI — 함수형 행동 트리 vs 클래스 기반

```
Status: Accepted

Context:
  봇 AI를 행동 트리로 업그레이드할 때 구현 패턴 선택.
  Option A: 클래스 기반 BehaviorTree (Node, Selector, Sequence 클래스)
  Option B: 함수형 (함수 + null 반환으로 fallthrough)

Decision:
  함수형 방식 채택 (null coalescing으로 우선순위 체인).
  behaveSurvive() ?? behaveHunt() ?? behaveGather() ?? behaveWander()

Consequences:
  ✅ 기존 코드 스타일 일관성 (프로젝트에 클래스 패턴 최소)
  ✅ 오버헤드 제로 (객체 생성 없음)
  ✅ 디버깅 간편 (함수 단위 테스트)
  ❌ 복잡한 행동 조합 시 깊은 중첩 가능 (현재 수준에선 문제 없음)
```

### ADR-006: 맵 존 — 클라이언트 전용 비주얼

```
Status: Accepted

Context:
  존 시스템을 서버/클라이언트 어디서 관리할지.
  서버 관리: 존별 다른 게임 규칙 가능하지만 복잡도 증가.
  클라이언트 관리: 순수 비주얼, 서버 변경 최소.

Decision:
  존은 클라이언트 전용 비주얼. 서버는 존을 모름.
  오브 밀도만 반경 기반 가중치로 서버에서 처리
  (weightedRandomRadius — 외곽일수록 오브 밀도 높음).

Consequences:
  ✅ 서버 코드 변경 최소 (반경 가중치 함수 1개만 추가)
  ✅ 클라이언트에서 존 색상/파티클 자유롭게 튜닝 가능
  ✅ 네트워크 프로토콜 변경 없음
  ❌ 존별 다른 게임 규칙(예: danger zone에서 속도 감소) 불가
     → 필요 시 서버에 zone awareness 추가 가능 (확장 여지)
```

### ADR-007: 스킨 확장 — Optional 필드 전략

```
Status: Accepted

Context:
  SnakeSkin에 headShape, tailEffect, accentColor를 추가할 때
  기존 12종 스킨과의 하위 호환성 문제.

Decision:
  신규 필드 전부 optional (?:)로 추가.
  undefined일 때의 기본값: headShape='round', tailEffect='none', accentColor=undefined.
  렌더러에서 (skin.headShape ?? 'round') 패턴으로 처리.

Consequences:
  ✅ 기존 12종 스킨 코드 변경 불필요
  ✅ 네트워크에서 skinId만 전송 (스킨 데이터는 양쪽에 DEFAULT_SKINS 배열로 존재)
  ✅ 점진적 마이그레이션 가능
  ❌ 모든 렌더링 코드에서 ?? 기본값 처리 필요
```

---

## 10. 구현 체크리스트

### Phase 1: 특수 오브 + 스킨 패턴 (병렬)

**Feature 1 — 특수 오브 (서버)**
- [ ] `shared/types/game.ts` — OrbType, ActiveEffect, EffectCooldown, Snake 확장
- [ ] `shared/constants/game.ts` — EFFECT_CONFIG 추가
- [ ] `shared/constants/colors.ts` — ORB_COLORS 4색 추가
- [ ] `shared/types/events.ts` — SnakeNetworkData.e, OrbNetworkData.t 확장
- [ ] `server/game/Snake.ts` — addEffect, removeExpiredEffects, hasEffect, canPickupEffect
- [ ] `server/game/OrbManager.ts` — spawnOrb 확률 분기, getOrbValue, getOrbColor
- [ ] `server/game/Arena.ts` — processOrbCollection, processEffects, collectOrbs 확장
- [ ] `server/game/CollisionSystem.ts` — ghost 분기
- [ ] `server/game/StateSerializer.ts` — e 필드, orb type 매핑

**Feature 1 — 특수 오브 (클라이언트)**
- [ ] `web/lib/renderer/entities.ts` — drawSpecialOrb, ghost/speed/magnet 시각화
- [ ] `web/lib/renderer/ui.ts` — 효과 HUD (아이콘 + 타이머 바)

**Feature 4 — 스킨 패턴**
- [ ] `shared/types/game.ts` — SnakeSkin 확장 (accentColor, headShape, tailEffect)
- [ ] `shared/constants/game.ts` — DEFAULT_SKINS 24종
- [ ] `web/lib/renderer/entities.ts` — drawStripedBody, drawGradientBody, drawDottedBody
- [ ] `web/lib/renderer/entities.ts` — drawDiamondHead, drawArrowHead
- [ ] `web/lib/renderer/entities.ts` — drawSparkTail, drawTrailTail, drawFadeTail

### Phase 2: 봇 AI

- [ ] `server/game/BotBehaviors.ts` — 신규 파일 (behaveSurvive/Hunt/Gather/Wander)
- [ ] `server/game/BotManager.ts` — BotState 확장, updateBotAI 전면 교체
- [ ] `server/game/BotManager.ts` — 난이도 분배, spawnBot 수정
- [ ] `server/game/Arena.ts` — getNearbySnakes, findNearestPowerUpOrb 헬퍼

### Phase 3: 맵 존

- [ ] `web/lib/renderer/background.ts` — 존 색상 시스템, drawZoneTransitions
- [ ] `web/lib/renderer/background.ts` — drawParticles (패럴랙스)
- [ ] `web/lib/renderer/ui.ts` — 미니맵 존 링
- [ ] `server/game/OrbManager.ts` — weightedRandomRadius (오브 밀도 가중치)

---

*Generated by DAVINCI /da:system — 2026-02-28*
*Deepens: PLAN.md v4.0 → 상세 아키텍처*
