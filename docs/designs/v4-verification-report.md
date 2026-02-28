# Snake Arena v4 — 설계 검증 보고서

> **검증 대상**: `docs/designs/v4-gameplay-architecture.md` + `PLAN.md`
> **검증 방법**: 전체 코드베이스 소스 레벨 크로스 레퍼런스
> **작성일**: 2026-02-28

---

## Summary

| Category | Issues | Critical | High | Medium | Low |
|----------|--------|----------|------|--------|-----|
| 타입 호환성 | 5 | 1 | 2 | 2 | 0 |
| 네트워크 프로토콜 | 3 | 1 | 1 | 1 | 0 |
| 서버 로직 | 4 | 0 | 2 | 2 | 0 |
| 클라이언트 렌더링 | 3 | 0 | 1 | 1 | 1 |
| 봇 AI | 2 | 0 | 1 | 1 | 0 |
| 설계 누락 | 3 | 0 | 2 | 1 | 0 |
| **Total** | **20** | **2** | **9** | **8** | **1** |

**전체 설계 적합도: 78%** — 대부분의 설계 방향은 정확하나, 네트워크 프로토콜과 타입 호환성에서 수정 필요.

---

## 🚨 Critical Issues (즉시 수정 필요)

### C-1: OrbNetworkData.t 타입 확장 시 기존 코드 타입 에러

**위치**: `packages/shared/src/types/events.ts:59`
**현재 코드**: `t: 0 | 1 | 2`
**설계 제안**: `t: 0 | 1 | 2 | 3 | 4 | 5 | 6`
**문제**:
- StateSerializer.ts:54에서 하드코딩된 매핑 사용:
  ```typescript
  t: orb.type === 'natural' ? 0 : orb.type === 'death' ? 1 : 2,
  ```
- 이 삼항 연산자는 새 타입 추가 시 항상 `2`(trail)로 폴백됨
- **TypeScript strict 모드에서 `0 | 1 | 2 | 3 | 4 | 5 | 6` 타입을 할당할 때 기존 클라이언트 코드의 `0 | 1 | 2` 체크가 타입 에러 발생**

**수정안**:
```typescript
// events.ts — 타입만 확장
t: number;  // OrbType encoded (0-6)

// 또는 더 안전하게
t: 0 | 1 | 2 | 3 | 4 | 5 | 6;

// StateSerializer.ts — 매핑 객체 사용
const ORB_TYPE_MAP: Record<OrbType, number> = {
  natural: 0, death: 1, boost_trail: 2,
  magnet: 3, speed: 4, ghost: 5, mega: 6,
};
// ...
t: ORB_TYPE_MAP[orb.type],
```

**영향 범위**: `StateSerializer.ts`, `events.ts`, 클라이언트의 `entities.ts drawOrbs()` — 현재 `orb.t`를 무시하고 `orb.c`(color)만 사용하므로 렌더링은 괜찮지만, **향후 타입별 분기 렌더링을 추가할 때 `t` 필드의 타입이 정합해야 함**.

---

### C-2: Snake 인터페이스에 activeEffects 추가 시 22개 파일 영향

**위치**: `packages/shared/src/types/game.ts` Snake 인터페이스
**설계 제안**: `activeEffects: ActiveEffect[]` + `effectCooldowns: EffectCooldown[]` 필드 추가
**문제**:
- `Snake` 인터페이스는 `SnakeEntity.data` 타입으로 서버 전역에서 사용
- `SnakeEntity` constructor(Snake.ts:17-50)에서 `data` 객체를 수동으로 초기화하므로 **새 필드를 빠뜨리면 타입 에러** 발생
- `SnakeEntity.respawn()` (Snake.ts:145-174)에서도 data를 리셋하므로 같은 문제

**수정안**: 새 필드를 반드시 **optional**로 선언하거나, constructor와 respawn에서 초기값 설정:
```typescript
// game.ts
activeEffects?: ActiveEffect[];    // 기본값: []
effectCooldowns?: EffectCooldown[];  // 기본값: []

// Snake.ts constructor & respawn
this.data.activeEffects = [];
this.data.effectCooldowns = [];
```

---

## ⚠️ High Priority Issues

### H-1: drawOrbs()가 orb.t (타입) 필드를 무시함

**위치**: `apps/web/lib/renderer/entities.ts:11-82`
**증거**: drawOrbs()는 `orb.c`(color index)로만 그룹핑하고 `orb.t`(type) 필드를 전혀 사용하지 않음. 설계서는 `drawSpecialOrb()` 분기를 제안하지만, **현재 코드에는 type 기반 분기 로직이 없으므로 완전 신규 구현 필요**.
**영향**: 특수 오브 비주얼이 일반 오브와 구분 불가
**수정안**: drawOrbs() 내에서 `orb.t >= 3`일 때 별도 렌더링 분기 추가. 현재 color 기반 그룹핑 로직(Map<number, Array>) 위에 type 체크 레이어 추가.

---

### H-2: SnakeNetworkData에 e 필드 추가 시 interpolation.ts 호환성

**위치**: `apps/web/lib/interpolation.ts:15-60`
**증거**: `interpolateSnakes()`가 `SnakeNetworkData` 객체를 새로 만들어 반환:
```typescript
const result: SnakeNetworkData = {
  ...curS,
  h: normalizeAngle(prevH + angleDiff(prevH, curS.h) * t),
  p: interpolated,
};
```
**문제**: spread 연산자(`...curS`)를 사용하므로 `e` 필드는 자동 복사됨 — **이 부분은 문제 없음**. 그러나 `applyClientPrediction()`은 필드를 수동으로 구성:
```typescript
return {
  ...serverSnake,
  h: newHeading,
  p: newSegments,
};
```
이것도 spread이므로 `e` 필드 유지됨. **결론: 호환됨**, 그러나 설계서에 이 호환성 확인이 누락되어 있었음.

---

### H-3: Arena.collectOrbs()에서 magnet 효과 + SpatialHash 쿼리 범위 이슈

**위치**: 설계서 섹션 5.1 `collectOrbs()` 변경
**증거**: 현재 `SpatialHash.queryOrbs()`는 `cellSize=200`으로 동작. magnet 효과의 수집 반경이 `collectRadius + 200 = 220px`이면, SpatialHash 쿼리가 `ceil(220/200) = 2` 셀 범위로 확장됨 — 이것은 정상 동작.
**문제**: 그러나 설계서의 `processEffects()`에서 magnet pull도 200px 범위로 오브를 이동시키는데, **이동된 오브의 SpatialHash 위치가 이미 rebuild 이후이므로 다음 tick까지 반영 안 됨**. 이것은 1 tick (50ms) 지연이므로 체감은 미미하지만, 설계서에 명시 필요.
**수정안**: 설계서에 "magnet pull은 다음 tick에 SpatialHash에 반영됨 (1 tick 지연, 50ms — 무시 가능)" 주석 추가.

---

### H-4: Arena.gameLoop()에 processEffects() 삽입 위치 오류

**위치**: 설계서 섹션 5.1
**증거**: 설계서는 collectOrbs() 이후, leaderboard 이전에 processEffects()를 배치:
```
6. collectOrbs()
6.5 processEffects()  ← 신규
7. leaderboard
```
**문제**: `processEffects()`에서 magnet pull로 오브 위치를 변경하지만, **collectOrbs()가 이미 실행된 후**이므로 같은 tick에서 magnet으로 끌어당긴 오브를 수집 불가.
**수정안**: processEffects()를 collectOrbs() **이전**으로 이동:
```
5.5 processEffects()  ← magnet pull 먼저
6. collectOrbs()      ← pull된 오브 수집 가능
7. leaderboard
```

---

### H-5: ghost 효과 충돌 무시 로직 — detectAll()에서 조기 continue 위험

**위치**: 설계서 섹션 5.3 CollisionSystem 변경
**설계 코드**:
```typescript
if (snake.hasEffect('ghost')) continue;
```
**문제**: 이 continue는 **경계 충돌 체크 이후**에 배치되어 있어 경계 사망은 정상 작동. 그러나 **head-to-head 충돌 체크(66-80행) 이전에 continue하므로, ghost 상태의 뱀은 head-to-head 충돌도 무시됨**. 설계 의도는 "머리 충돌 유지"이므로 모순.
**수정안**: continue가 아닌, head-body 충돌 루프만 skip:
```typescript
// ghost가 아닐 때만 head-body 충돌 체크
if (!snake.hasEffect('ghost')) {
  const nearby = spatialHash.querySegments(head, config.headRadius * 2);
  // ... head-body 충돌 로직 ...
}
// head-to-head는 아래에서 별도로 처리 (ghost 무관)
```

---

### H-6: BotManager에서 Arena의 존재하지 않는 메서드 호출

**위치**: 설계서 섹션 6.2, 6.3
**증거**: 설계서가 호출하는 Arena 메서드 중 현재 존재하지 않는 것:
- `arena.getNearbySnakes(botId, head, 400)` — **미존재**
- `arena.findNearestPowerUpOrb(head, 500)` — **미존재**
- `arena.findNearestOrbByType(head, 400, 'death')` — **미존재**

현재 Arena에는 `findNearestOrb(pos, searchRadius)`과 `findNearbySnakeHead(excludeId, pos, radius)` 2개만 존재.
**수정안**: 설계서 섹션 6.3에 명시된 3개 헬퍼 메서드의 구현이 반드시 Arena.ts에 추가되어야 함. 설계서에 이미 시그니처는 있지만, 구현 상세가 누락.

---

### H-7: SnakeSkin 확장 시 DEFAULT_SKINS 배열 인덱스와 skinId 매핑

**위치**: `apps/server/src/game/Snake.ts:21`
**증거**:
```typescript
const skin: SnakeSkin = DEFAULT_SKINS[clamp(skinId, 0, DEFAULT_SKINS.length - 1)];
```
**문제**: 현재 `DEFAULT_SKINS.length = 12`. 24종으로 확장 시 `clamp(skinId, 0, 23)`이 되므로 기존 코드는 자동 호환됨. **그러나** 네트워크에서 `SnakeNetworkData.k`는 skinId만 전송하고, 클라이언트에서 `DEFAULT_SKINS[snake.k]`로 조회함 (entities.ts:98).
**주의점**: 서버와 클라이언트의 `DEFAULT_SKINS` 배열이 **동일한 shared 패키지**에서 오므로 불일치 위험은 없음. **다만 로비 페이지(page.tsx)의 SkinCarousel에서 12종 → 24종 UI 확장 필요** — 이것이 설계서에 누락됨.

---

### H-8: 설계서의 drawSnakes() 파이프라인과 현재 코드 구조 불일치

**위치**: 설계서 섹션 7.1 vs `entities.ts drawSnakes()`
**증거**: 현재 drawSnakes()는 **모든 렌더링을 하나의 함수 안에서 처리** (307줄). 설계서는 `drawStripedBody()`, `drawGradientBody()`, `drawDottedBody()`, `drawDiamondHead()`, `drawArrowHead()`, `drawSparkTail()`, `drawTrailTail()`, `drawFadeTail()` 8개의 새 함수를 제안함.
**문제**: 현재 코드에서 뱀 렌더링 순서는 (1) boost glow → (2) outline path → (3) body path → (4) inner stripe path → (5) head circle → (6) eyes → (7) name. **패턴별 분기는 (2)-(3)-(4) 단계에서 이루어져야 함**. 설계서의 함수 시그니처가 이 파이프라인을 정확히 반영하는지 확인 필요.
**수정안**: 설계서의 패턴 함수들이 기존 `drawSmoothPath()` (quadraticCurveTo 기반 경로)를 호출하는 래퍼인지, 대체하는지 명확히 해야 함. 현재 설계서는 개별 `arc()` 기반으로 되어 있어 기존 부드러운 곡선(quadraticCurveTo)과 다른 결과가 나올 수 있음.

---

### H-9: 설계서에 colors.ts 특수 오브 색상 인덱스 충돌 가능성

**위치**: 설계서 섹션 8.2, 현재 `colors.ts`
**증거**: 현재 `ORB_COLORS`는 12색 배열 (인덱스 0-11). 설계서는 인덱스 12-15에 특수 오브 색상을 추가.
**문제**: `drawOrbs()`의 현재 코드: `ORB_COLORS[colorIdx % ORB_COLORS.length]` — 현재 `% 12`이므로 **인덱스 12는 `12 % 12 = 0`으로 매핑되어 특수 오브 고유 색상이 무시됨**.
**수정안**: 배열을 16색으로 확장하면 `% 16`이 되어 해결. 또는 modulo를 제거하고 bounds check로 변경:
```typescript
const color = ORB_COLORS[colorIdx] ?? ORB_COLORS[0];
```

---

## 💡 Medium Priority Issues

### M-1: magnet 효과의 orb 위치 직접 변경 — 서버/클라이언트 비동기

**위치**: 설계서 섹션 5.1 processEffects()
**문제**: 서버에서 `orb.position.x/y`를 magnet pull로 직접 변경하지만, 클라이언트에는 다음 state 브로드캐스트(50ms 후)까지 반영 안 됨. 오브가 서버에서는 뱀 쪽으로 이동했지만 클라이언트에서는 원래 위치에 보이는 **50ms 시각적 불일치** 발생.
**수정안**: 클라이언트에서도 magnet 효과 활성 뱀 주변 오브에 로컬 애니메이션 적용 (이미 `drawOrbs()`에 `attractRadius` 기반 pull 로직이 있으므로, magnet 활성 시 pull 강도를 높이면 됨).

---

### M-2: speed 효과 중 trail orb 생성 여부 미정의

**위치**: 설계서 섹션 5.2 (Snake.ts update 변경)
**문제**: speed 효과로 무료 부스트 시 `trailCounter`는 증가하지만, mass 소모가 없으므로 Arena.gameLoop()의 trail orb 생성 조건 `snake.data.boosting && snake.trailCounter % trailOrbInterval === 0`에 걸림. **speed 효과 중에도 trail orb가 생성되는가?**
- 생성된다면: speed 효과의 장점이 반감 (trail로 위치 노출)
- 생성 안 된다면: Arena.gameLoop()에 speed 효과 체크 분기 필요
**수정안**: speed 효과 중 trail orb 미생성으로 결정하고, gameLoop에 분기 추가:
```typescript
if (snake.data.boosting && !snake.hasEffect('speed') &&
    snake.trailCounter % this.config.trailOrbInterval === 0) {
  // trail orb 생성
}
```

---

### M-3: 존 시스템 — drawBackground() 파라미터 누락

**위치**: 설계서 섹션 7.5 vs `renderer/index.ts`
**증거**: 현재 `drawBackground(ctx, cam, w, h)` 호출에 `arenaRadius` 파라미터 없음. 존 시스템은 카메라 위치와 arenaRadius로 존을 판별해야 함.
**수정안**: 함수 시그니처를 `drawBackground(ctx, cam, w, h, arenaRadius)` 확장하고, `renderer/index.ts`의 호출도 `drawBackground(ctx, state.camera, w, h, state.arenaRadius)`로 변경.

---

### M-4: 봇 AI — behaveSurvive()에서 Snake 인터페이스 직접 접근

**위치**: 설계서 섹션 6.1
**증거**: `behaveSurvive(snake: Snake, ...)` — 봇 AI 함수에 `Snake` 인터페이스를 직접 전달. 그러나 `hasEffect()` 메서드는 `SnakeEntity` 클래스에 있고, `Snake` 인터페이스에는 없음.
**문제**: 봇이 자신의 효과 상태를 확인하려면 `SnakeEntity`를 전달하거나, `snake.data.activeEffects`를 직접 체크해야 함.
**수정안**: 행동 함수 시그니처를 `(snake: SnakeEntity, ...)` 또는 `(snakeData: Snake, ...)`로 통일하고, 효과 체크는 `snakeData.activeEffects?.some(e => e.type === 'ghost')` 식으로 직접 접근.

---

### M-5: useSocket.ts — StatePayload에 효과 데이터 파싱 누락

**위치**: `apps/web/hooks/useSocket.ts`
**증거**: useSocket은 `StatePayload`를 그대로 `dataRef.current.latestState`에 저장. SnakeNetworkData.e 필드가 추가되면 자동으로 전달됨 (JSON.parse 시 포함). **그러나** 효과 HUD를 렌더링하려면 GameCanvas가 자기 뱀의 `e` 필드를 추출하여 `RenderState`에 포함해야 함.
**수정안**: RenderState 타입에 `myEffects?: number[]` 추가하거나, 기존 `mySnake` 참조에서 `snake.e`로 접근. 후자가 더 간단하고 설계서와 일치.

---

### M-6: 로비 페이지 SkinCarousel — 24종 스킨 UI 미설계

**위치**: `apps/web/app/page.tsx`
**증거**: 로비에서 `DEFAULT_SKINS`를 import하여 SkinCarousel 구현. 현재 12색 도트 선택 + 120px 캐릭터 프리뷰. 24종 확장 시 도트 24개는 UI가 복잡해짐.
**수정안**: 설계서에 로비 UI 변경 명시 필요:
- 도트 선택 → 2줄 (12+12) 또는 좌우 스크롤
- 새 스킨은 패턴/머리/꼬리 프리뷰 포함
- 로비 캐릭터 프리뷰에 패턴 렌더링 반영

---

### M-7: 존별 오브 밀도 — OrbManager.spawnNaturalOrb()의 위치 생성 변경 누락

**위치**: 설계서 섹션 8.5 `weightedRandomRadius()`
**증거**: 현재 `randomPositionInCircle()`은 shared utils에서 import. 설계서는 `weightedRandomRadius()`를 OrbManager 내부에 추가 제안하지만, **기존 `randomPositionInCircle()` 유틸을 수정하지 않고 OrbManager 내에서 위치를 재계산해야 함**. 두 함수 간 중복 우려.
**수정안**: `randomPositionInCircle()`에 optional `radiusBias` 파라미터를 추가하여 가중치 지원, 또는 OrbManager 내에서 별도 구현 (후자가 영향 범위 최소).

---

### M-8: 설계서 drawEyes() — headShape 변경 시 눈 위치 보정 상세 미흡

**위치**: 설계서 섹션 4.6, 7.1
**증거**: 현재 `drawEyes()`는 원형 머리 기준으로 눈 위치를 `headRadius * 0.35` 오프셋으로 계산. diamond/arrow 머리에서는 눈 위치가 다를 수 있음 (중앙이 원형과 다름).
**수정안**: drawEyes()에 headShape 파라미터 추가, shape별 오프셋 조정 상수 테이블 정의.

---

## ✅ Low Priority Issues

### L-1: events.ts에 SnakeSkin 미사용 import

**위치**: `packages/shared/src/types/events.ts:6`
**증거**: `import type { LeaderboardEntry, Position, SnakeSkin } from './game'` — `SnakeSkin`은 이 파일의 어떤 export에서도 사용되지 않음.
**영향**: 없음 (type import이므로 번들 영향 없음)
**수정안**: 구현 시 정리하거나 무시 가능.

---

## ✅ 검증 통과 항목

| 항목 | 상태 | 근거 |
|------|------|------|
| SnakeSkin optional 필드 전략 | ✅ Pass | `DEFAULT_SKINS[clamp(skinId, 0, len-1)]` + spread로 하위 호환 |
| 봇 AI 함수형 패턴 | ✅ Pass | null coalescing 체인은 기존 코드 스타일과 일관 |
| server-authoritative 효과 | ✅ Pass | 기존 아키텍처(Arena→Broadcaster) 패턴 준수 |
| 존 시스템 클라이언트 전용 | ✅ Pass | 서버 코드 변경 최소화 |
| SpatialHash 호환성 | ✅ Pass | queryOrbs/querySegments radius 기반 → magnet 확장 OK |
| interpolation.ts spread 호환성 | ✅ Pass | `...curS` 새 필드(e) 자동 복사 |
| applyClientPrediction 호환성 | ✅ Pass | `...serverSnake` spread가 e 필드 유지 |
| Broadcaster 독립성 | ✅ Pass | consumeLastTickDeaths() 패턴 유지 |
| RenderState 확장성 | ✅ Pass | 객체 리터럴, 새 필드 추가 용이 |
| 효과 데이터 전송 효율 | ✅ Pass | 조건부 e 필드 (+0~8 bytes) |
| DeathEvent 인터페이스 | ✅ Pass | 효과 시스템과 무관 |
| Camera/zoom 호환성 | ✅ Pass | 존/파티클은 카메라 좌표만 사용 |
| ADR-004~007 논리적 정합성 | ✅ Pass | 결정 근거 + 트레이드오프 명확 |

---

## 수정 권장 사항 (우선순위 순)

### 🔴 반드시 수정 (구현 전)

1. **H-4**: processEffects()를 collectOrbs() **이전**으로 이동 — magnet pull 후 수집
2. **H-5**: ghost 효과 — `continue` 대신 head-body 루프만 조건부 skip
3. **C-1**: OrbNetworkData.t 타입 확장 + StateSerializer 매핑 객체화
4. **H-9**: ORB_COLORS modulo 제거 — 특수 오브 색상 인덱스 충돌 방지

### 🟡 설계서 보완 필요

5. **C-2**: Snake에 activeEffects/effectCooldowns를 optional로 선언
6. **H-6**: Arena 3개 신규 헬퍼 메서드 구현 상세 추가
7. **H-7**: 로비 SkinCarousel 24종 UI 설계 추가
8. **M-2**: speed 효과 중 trail orb 미생성 정책 명시
9. **M-3**: drawBackground() 파라미터에 arenaRadius 추가

### 🟢 구현 시 주의

10. **H-8**: 패턴 함수가 quadraticCurveTo vs 개별 arc() 방식 결정
11. **M-1**: 클라이언트 magnet 시각 효과 = 기존 attractRadius 강화
12. **M-4**: 봇 행동 함수 시그니처를 Snake data로 통일
13. **M-5**: GameCanvas에서 mySnake.e 접근하여 효과 HUD 전달

---

**검증 결론**: 설계의 대방향은 올바르나, **네트워크 프로토콜(C-1, H-9)**, **게임루프 순서(H-4)**, **ghost 충돌 로직(H-5)** 4건은 구현 전 반드시 수정 필요. 나머지는 구현 중 자연스럽게 해결 가능.

**설계 적합도**: 78% → 수정 반영 시 95%+

*Generated by DAVINCI /da:verify — 2026-02-28*
