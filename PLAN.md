# Snake Arena v4 — 대규모 게임플레이 개선 기획서

> **버전**: v4.0 (Gameplay Enhancement Update)
> **작성일**: 2026-02-28
> **상태**: Draft
> **기반**: v3 Brawl Stars UI 완료 상태에서 게임플레이 심화

---

## 1. 문제 분석 (AS-IS)

| 영역 | 현재 상태 | 핵심 문제 |
|------|----------|----------|
| **먹이/아이템** | natural, death, boost_trail 3종. 전부 단순 mass 증가 | 전략적 선택지 없음 |
| **봇 AI** | if-else 3단계 (경계회피→먹이추적→배회) + 단순 위협회피 | 예측 가능, 도전감 없음 |
| **맵 배경** | 단색 #0F1923 + 80px 그리드 라인만 | 공간감/몰입감 부족 |
| **스네이크** | 12스킨 전부 solid 패턴, 2색, pattern 필드 미활용 | 개성/다양성 부족 |

---

## 2. 개선 계획 — 4대 Feature

### Feature 1: 특수 오브 & 파워업 시스템

#### 1-1. 새로운 오브 타입 (OrbType 확장)

```
기존: 'natural' | 'death' | 'boost_trail'
추가: 'magnet' | 'speed' | 'ghost' | 'mega'
```

| 오브 | 색상/비주얼 | 효과 | 지속시간 | 스폰 확률 |
|------|-----------|------|---------|----------|
| **Magnet** | 보라 + 자기장 파티클 | 주변 200px 오브 자동 흡입 | 5초 | 5% |
| **Speed** | 노란 + 번개 이펙트 | mass 소모 없이 부스트 속도 | 4초 | 8% |
| **Ghost** | 반투명 청록 + 페이드 | 다른 뱀 몸통 통과 (머리 충돌 유지) | 3초 | 3% |
| **Mega** | 골드 + 크기 2x + 회전 | mass +30 (일반의 6배) | 즉시 | 2% |

#### 1-2. 서버 변경
- `OrbType` 타입 확장 (shared/types/game.ts)
- `OrbManager.spawnNaturalOrb()` — 확률 기반 특수 오브 스폰
- `Snake` 인터페이스에 `activeEffects: ActiveEffect[]` 추가
- `Arena.collectOrbs()` — 특수 오브 수집 시 효과 적용
- `Arena.gameLoop()` — tick 기반 효과 만료 처리
- `SnakeEntity.update()` — ghost/speed 효과 반영
- `CollisionSystem.detectAll()` — ghost 상태 뱀 몸통 충돌 무시

#### 1-3. 클라이언트 변경
- `entities.ts drawOrbs()` — 특수 오브 렌더링 (파티클, 회전, 글로우)
- `entities.ts drawSnakes()` — 활성 효과 시각 표시 (ghost 반투명, speed 잔상)
- `ui.ts` — 활성 효과 HUD 아이콘 + 남은 시간 바

#### 1-4. 새로운 타입
```typescript
interface ActiveEffect {
  type: 'magnet' | 'speed' | 'ghost';
  expiresAt: number; // tick
}
```

---

### Feature 2: 봇 AI 대폭 강화

#### 2-1. 우선순위 기반 행동 트리 (Behavior Tree)

현재 단순 if-else → **우선순위 기반 행동 트리**로 전환:

```
Root (Priority Selector)
├── [P0] Survive
│   ├── CheckBoundary → FleeToCenter
│   └── CheckDangerousSnake → Evade/CounterAttack
├── [P1] Hunt  ← 신규
│   ├── FindVulnerableTarget (작은 뱀, 벽 근처 뱀)
│   ├── CutOffPath (경로 차단 — 상대 앞으로 부스트)
│   └── CircleAndTrap (포위 — 큰 뱀이 작은 뱀 감싸기)
├── [P2] Gather
│   ├── SeekPowerUp (특수 오브 우선) ← 신규
│   ├── SeekHighValueOrb (death 오브 > natural)
│   └── SeekNearestOrb
└── [P3] Wander
    ├── ExploreUnvisitedArea ← 신규
    └── RandomWander
```

#### 2-2. 봇 난이도 등급 (3단계)

| 등급 | 비율 | 행동 특성 |
|------|------|----------|
| **Easy** | 40% | 현재 수준. 반응 느림, 공격 안 함, 먹이만 추적 |
| **Medium** | 40% | 적극적 먹이 추적, 위험 회피, 가끔 cut-off 공격 |
| **Hard** | 20% | 경로 예측, 포위 전략, 파워업 선점, 벽 킬 활용 |

#### 2-3. 주요 새 행동 패턴
- **경로 차단 (Cut-off)**: 타겟 heading 전방에 위치 → 충돌 유도
- **포위 (Circle)**: 큰 뱀이 작은 뱀 주위를 빠르게 회전
- **벽 몰이 (Wall Push)**: 상대를 경계 방향으로 압박
- **파워업 경쟁**: 특수 오브 스폰 시 적극 추적 (Hard 전용)
- **밀집 지역 인식**: 위험 밀집 지역 우회 판단

#### 2-4. 변경사항
- `BotManager.ts` — BotState에 `difficulty`, `behaviorState`, `target` 추가
- `BotManager.updateBotAI()` — 행동 트리 기반으로 전면 교체
- 신규 파일: `game/BotBehaviors.ts` — 행동 트리 노드 함수들

---

### Feature 3: 맵 비주얼 강화

#### 3-1. 존(Zone) 시스템 — 동심원 3개 존

```
[외곽 Danger Zone] — 반경 75%~100%
  배경: 어두운 레드 틴트 (#1A0A0A)
  그리드: 붉은 그리드 (rgba(255,60,60,0.15))
  오브 밀도: 높음 (고위험 고보상)

[중간 Battle Zone] — 반경 35%~75%
  배경: 기본 네이비 (#0F1923)
  그리드: 기본 (#1A2A3A)
  오브 밀도: 보통

[중앙 Safe Zone] — 반경 0%~35%
  배경: 밝은 네이비 (#152230)
  그리드: 밝은 (#1E3040)
  오브 밀도: 낮음 (안전하지만 성장 느림)
```

#### 3-2. 배경 비주얼 개선
- **별/파티클**: 느리게 떠다니는 빛 점들 (패럴랙스, 카메라의 50% 속도)
- **존 경계**: 부드러운 radial gradient 전환 (하드 라인 없이)
- **그리드 개선**: 존별 색상/알파 + 교차점 도트
- **장식 파티클**: 바닥 먼지/별 (30~50개, 줌 기반 LOD)

#### 3-3. 변경사항
- `background.ts drawBackground()` — 존 기반 배경 + 그라디언트
- `background.ts` — 새 함수: `drawParticles()`, `drawZoneTransitions()`
- `ui.ts` — 미니맵에 존 링 표시

---

### Feature 4: 스네이크 캐릭터 비주얼 강화

#### 4-1. 패턴 시스템 실제 구현

현재 `pattern` 필드가 존재하지만 전부 'solid'로만 사용중. 실제 렌더링 구현:

| 패턴 | 렌더링 방식 |
|------|-----------|
| **solid** | 현재 그대로 (단색 body + secondary 내부 라인) |
| **striped** | primary/secondary 교대 세그먼트 (3세그먼트마다 색 전환) |
| **gradient** | head→tail 그라디언트 (primary→secondary 점진 변화) |
| **dotted** | primary body + secondary 동그란 점 오버레이 |

#### 4-2. 스킨 속성 확장

```typescript
interface SnakeSkin {
  // 기존 유지
  id: number;
  primaryColor: string;
  secondaryColor: string;
  pattern: 'solid' | 'striped' | 'gradient' | 'dotted';
  eyeStyle: 'default' | 'angry' | 'cute' | 'cool';
  // 신규 (optional, 하위 호환)
  accentColor?: string;
  headShape?: 'round' | 'diamond' | 'arrow';
  tailEffect?: 'none' | 'spark' | 'trail' | 'fade';
}
```

#### 4-3. 머리 모양 변형
- **round** (기본): 현재 원형 머리
- **diamond**: 다이아몬드형 (이동 방향으로 뾰족, 공격적 느낌)
- **arrow**: 화살표형 (속도감 강조)

#### 4-4. 꼬리 이펙트
- **none**: 이펙트 없음 (기본)
- **spark**: 꼬리 끝에 작은 불꽃 파티클 (2-3개)
- **trail**: 이동 잔상 (반투명 세그먼트 3개 추가 렌더링)
- **fade**: 꼬리로 갈수록 투명도 증가 (alpha 1.0→0.3)

#### 4-5. 스킨 확장 (12 → 24종)
기존 12종 유지 + 12종 추가로 다양한 패턴/머리/꼬리 조합 제공.
추가 스킨은 striped, gradient, dotted 패턴 + diamond/arrow 머리 + spark/trail/fade 꼬리 조합.

#### 4-6. 변경사항
- `shared/types/game.ts SnakeSkin` — 신규 optional 필드 추가
- `shared/constants/game.ts DEFAULT_SKINS` — 24종으로 확장
- `entities.ts drawSmoothPath()` — 패턴별 분기 렌더링
- `entities.ts drawEyes()` — 머리 모양별 눈 위치 조정
- `entities.ts` — 새 함수: `drawHeadShape()`, `drawTailEffect()`

---

## 3. 구현 우선순위 & 의존관계

```
Phase 1 (기반, 병렬): Feature 1 (특수 오브) + Feature 4 (스킨 패턴)
  → 독립적, 병렬 구현 가능
  → 서버 + 클라이언트 양쪽 변경

Phase 2 (연동): Feature 2 (봇 AI)
  → Feature 1 의존 (봇이 특수 오브 인식 필요)

Phase 3 (비주얼): Feature 3 (맵 존)
  → 독립적, Feature 1과 약한 연동 (존별 오브 밀도)
```

---

## 4. 변경 파일 요약

| 파일 | 변경 유형 | Feature |
|------|----------|---------|
| `shared/types/game.ts` | OrbType 확장, ActiveEffect 추가, SnakeSkin 확장 | 1, 4 |
| `shared/constants/game.ts` | 스킨 24종, 오브/효과 설정값 추가 | 1, 4 |
| `server/game/Arena.ts` | collectOrbs 효과 로직, gameLoop 효과 만료 | 1 |
| `server/game/OrbManager.ts` | 특수 오브 스폰 확률 로직 | 1 |
| `server/game/Snake.ts` | activeEffects 필드, ghost/speed 처리 | 1 |
| `server/game/CollisionSystem.ts` | ghost 효과 시 몸통 충돌 무시 | 1 |
| `server/game/BotManager.ts` | 행동 트리 AI 전면 교체 | 2 |
| `server/game/BotBehaviors.ts` | **신규** — 행동 트리 노드 함수 | 2 |
| `web/lib/renderer/background.ts` | 존 시스템, 파티클, 그라디언트 | 3 |
| `web/lib/renderer/entities.ts` | 패턴 렌더링, 머리 모양, 꼬리 이펙트, 특수 오브 | 1, 4 |
| `web/lib/renderer/ui.ts` | 효과 HUD, 존 미니맵 | 1, 3 |
| `server/network/StateSerializer.ts` | activeEffects 직렬화 | 1 |

---

## 5. 리스크 & 완화

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 특수 오브 밸런스 파괴 | High | 짧은 지속시간 + 낮은 스폰율로 시작 후 조정 |
| 봇 AI CPU 부담 (20봇 × 행동트리) | Medium | 함수형 경량 구현, tick당 1봇씩 순회 |
| 파티클 렌더링 프레임 드롭 | Medium | 파티클 수 제한(50개) + 줌 기반 LOD |
| Ghost 효과 악용 | Medium | 3초 + 쿨다운 (10초간 재취득 불가) |
| 24종 스킨 메모리 | Low | 런타임 생성, 프리로드 불필요 |

---

## 6. 기술 방향 결정 (ADR)

| 결정 | 선택 | 근거 |
|------|------|------|
| 봇 AI 패턴 | 함수형 행동 트리 (클래스 X) | 기존 코드 일관성, 오버헤드 최소 |
| 파워업 동기화 | 서버 권위적 (server-authoritative) | 치팅 방지, 기존 아키텍처 유지 |
| 맵 존 | 클라이언트 전용 비주얼 | 서버는 존 모름, 오브 밀도만 반경 기반 |
| 스킨 확장 | optional 필드 추가 | 기존 12종 하위 호환성 완벽 유지 |
| 파티클 시스템 | 단순 배열 기반 (엔진 X) | Canvas 2D 범위 내, 경량 유지 |

---

**Next Step**: `/da:system`으로 상세 API 스펙, 시퀀스, 데이터 모델 설계 → `/da:dev`로 Phase별 구현

*Generated by DAVINCI /da:plan — 2026-02-28*
