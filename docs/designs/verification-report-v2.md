# Snake Arena — Architecture Verification Report v2.0

> **Date**: 2026-02-27
> **Scope**: PLAN.md v2.0 vs System Architecture Documents v2.0
> **Methodology**: Requirement-by-requirement traceability matrix

---

## Executive Summary

| Category | Total Checks | Pass | Fail | Warning | Match Rate |
|----------|-------------|------|------|---------|------------|
| Game Mechanics (F-01~F-10) | 10 | 9 | 0 | 1 | 95% |
| Non-Functional (NFR) | 8 | 7 | 0 | 1 | 93% |
| Data Model | 6 | 6 | 0 | 0 | 100% |
| Network Protocol | 5 | 5 | 0 | 0 | 100% |
| Security | 6 | 5 | 0 | 1 | 92% |
| Infrastructure | 4 | 4 | 0 | 0 | 100% |
| ADR Consistency | 7 | 6 | 0 | 1 | 93% |
| **TOTAL** | **46** | **42** | **0** | **4** | **95%** |

**Overall Match Rate: 95%** (0 Critical, 0 High, 4 Medium warnings)

---

## 1. Game Mechanics Verification (F-01 ~ F-10)

### F-01: 연속 이동 시스템 ✅ PASS

| PLAN Requirement | Architecture Doc | Status |
|------------------|-----------------|--------|
| 연속 좌표 (float x,y) | `Position { x: number; y: number }` in types | ✅ |
| 각도 기반 회전 | `heading`, `targetAngle` in Snake type | ✅ |
| turn_rate 제한 | `TURN_RATE: 0.06 rad/tick` in ArenaConfig | ✅ |
| segment_spacing | `segmentSpacing: 8 units` in ArenaConfig | ✅ |
| 마우스/터치 추적 | `useInput.ts: mousemove→angle` in client L3 | ✅ |

**Evidence**: architecture.md §5 (Physics Engine), ADR-010, game-state-types.ts `Snake.heading/targetAngle`

### F-02: 실시간 멀티플레이어 ✅ PASS

| PLAN Requirement | Architecture Doc | Status |
|------------------|-----------------|--------|
| 50-100명 동시 아레나 | `maxPlayers: 100` in ArenaConfig | ✅ |
| 서버 상태 동기화 | `broadcastState()` in game tick sequence | ✅ |
| 영구 아레나 | ADR-005 "Persistent Arena" | ✅ |

### F-03: Orb 시스템 ✅ PASS

| PLAN Requirement | Architecture Doc | Status |
|------------------|-----------------|--------|
| 자연 Orb 생성 | `naturalOrbTarget: 2000` in config | ✅ |
| 3가지 Orb 타입 | `OrbType = 'natural' \| 'death' \| 'boost_trail'` | ✅ |
| Orb 수집 메카닉 | `collectOrbs()` in tick loop step 8 | ✅ |
| 성장률 | `Static: +1~2, Death: +3~5` in PLAN (types have `value: number`) | ✅ |

### F-04: 충돌 시스템 ✅ PASS

| PLAN Requirement | Architecture Doc | Status |
|------------------|-----------------|--------|
| 머리↔몸통 충돌 | `checkHeadVsBody()` in Collision.ts | ✅ |
| 경계 충돌 = 사망 | `checkHeadVsBound()` in Collision.ts | ✅ |
| 자기 몸 무시 | "skip own segments" in collision pipeline | ✅ |
| Spatial Hash | ADR-009, `SpatialHash.ts` cell=200, grid=60x60 | ✅ |

### F-05: 사망/Orb 분해 ✅ PASS

| PLAN Requirement | Architecture Doc | Status |
|------------------|-----------------|--------|
| 몸체 → Orb 분해 | `processDeaths() → orbManager.decomposeSnake()` | ✅ |
| mass의 80% 변환 | `deathOrbRatio: 0.8` in ArenaConfig | ✅ |
| 수집 가능 | Death orbs appear in spatial hash, collectible | ✅ |

### F-06: 부스트 메카닉 ✅ PASS

| PLAN Requirement | Architecture Doc | Status |
|------------------|-----------------|--------|
| 속도 2배 | `BASE_SPEED(200) → BOOST_SPEED(400)` | ✅ |
| mass 소모 | `boostCostPerTick: 0.5` (10 mass/s) | ✅ |
| trail orb | `trailOrbInterval: 3 ticks, value: 2` | ✅ |
| 최소 mass 제한 | `minBoostMass: 15` | ✅ |
| 활성화: 클릭/스페이스 | Socket event `input.b` (boost flag) | ✅ |

### F-07: 리더보드 (인게임) ✅ PASS

| PLAN Requirement | Architecture Doc | Status |
|------------------|-----------------|--------|
| 실시간 상위 10명 | `LeaderboardEntry[]` sent every 5th tick | ✅ |
| 이름 + 점수 | `n: string, s: number, me: boolean` | ✅ |

### F-08: 카메라 시스템 ✅ PASS

| PLAN Requirement | Architecture Doc | Status |
|------------------|-----------------|--------|
| 뱀 머리 추적 | `useCamera.ts: follow head (lerp)` | ✅ |
| 동적 줌 | `dynamic zoom (mass-based)` in client L3 | ✅ |
| worldToScreen 변환 | `worldToScreen(), screenToWorld()` | ✅ |

### F-09: 미니맵 ⚠️ WARNING

| PLAN Requirement | Architecture Doc | Status |
|------------------|-----------------|--------|
| 전체 맵 위치 표시 | `MiniMap.tsx` in client component list | ✅ |
| 큰 뱀 위치 표시 | Not specified in network protocol | ⚠️ |

**Issue**: `state` 이벤트에서 미니맵 데이터(전체 아레나의 큰 뱀 위치)를 보내는 프로토콜이 정의되지 않음. 뷰포트 컬링 기반이므로 뷰포트 밖의 큰 뱀 위치를 알 수 없음.

**Recommendation**: 별도 `minimap` 이벤트 추가 (1Hz, 상위 10명 뱀의 대략적 위치만 전송) 또는 leaderboard에 위치 힌트 포함.

### F-10: 즉시 리스폰 ✅ PASS

| PLAN Requirement | Architecture Doc | Status |
|------------------|-----------------|--------|
| 클릭 한 번 리스폰 | `respawn` event + `DeathScreen.tsx` | ✅ |
| 작은 뱀으로 재시작 | `initialMass: 10, 10 segments` in join flow | ✅ |

---

## 2. Non-Functional Requirements Verification

### NFR-01: Server Tick Rate ✅

- PLAN: 20Hz (50ms)
- Architecture: `Arena Engine (20Hz)`, `tickRate: 20`
- Deployment: tick monitoring with alert at >40ms

### NFR-02: Client FPS ✅

- PLAN: 60 FPS desktop
- Architecture: `rAF 60fps loop` in useGameLoop.ts
- Rendering: Adaptive quality (skip glow if FPS <45)

### NFR-03: Input Latency ✅

- PLAN: <50ms
- Architecture: Client prediction, immediate local rendering
- Socket: `input` event throttled to 30Hz

### NFR-04: Max Players ✅

- PLAN: 100/arena
- Architecture: `maxPlayers: 100` in ArenaConfig
- Collision: Spatial hash handles 7,000 entities efficiently

### NFR-05: Bandwidth ⚠️ WARNING

- PLAN: ~50-100 KB/s per player
- Architecture: ~62KB/s calculated (3.1KB/tick × 20Hz)
- **Issue**: 62KB/s is within range but at the upper end. With more visible snakes (dense areas), could exceed 100KB/s.
- **Recommendation**: Consider segment downsampling for distant snakes (send every 3rd segment).

### NFR-06: Bundle Size ✅

- PLAN: <300KB gzip
- Deployment: target <300KB, no heavy frameworks

### NFR-07: Reconnect ✅

- PLAN: 5초 이내
- Socket: `reconnectionDelay: 1000, reconnectionAttempts: 5`

### NFR-08: Server Memory ✅

- PLAN: <512MB for 100 players
- Deployment: 512MB RAM per Railway instance

---

## 3. Data Model Verification

| Check | PLAN Requirement | Types File | Status |
|-------|-----------------|------------|--------|
| Position | float x,y | `Position { x: number; y: number }` | ✅ |
| Snake segments | 연속 좌표 배열 | `segments: Position[]` | ✅ |
| Snake mass | 총 질량 | `mass: number` | ✅ |
| Snake heading | radian 각도 | `heading: number` | ✅ |
| Orb types | natural/death/trail | `OrbType` union type | ✅ |
| ArenaConfig | 모든 설정값 | 15 fields, matches PLAN values | ✅ |

---

## 4. Network Protocol Verification

| Check | PLAN Requirement | Socket Events | Status |
|-------|-----------------|---------------|--------|
| Input: angle + boost | angle(radian) + boost flag | `input { a, b, s }` | ✅ |
| State: viewport-culled | 뷰포트 내 엔티티만 | `state { s[], o[], l? }` | ✅ |
| Death notification | 점수/킬/킬러 | `death { score, kills, killer }` | ✅ |
| Respawn | 즉시 리스폰 | `respawn/respawned` events | ✅ |
| Rate limiting | 30/s | `input: 30/sec` in policy table | ✅ |

---

## 5. Security Verification

| Check | PLAN Requirement | Threat Model | Status |
|-------|-----------------|-------------|--------|
| Server-Authoritative | 모든 로직 서버 처리 | T-02,03,04,05 all mitigated | ✅ |
| 입력 검증 | 각도만 전송 | `validateInput()` in threat model | ✅ |
| Rate Limiting | 30/s | D-01 mitigation, policy table | ✅ |
| Anti-Speed-Hack | 속도 제한 | T-03 server-controlled speed | ✅ |
| Anti-Maphack | 뷰포트 컬링 | I-01 viewport culling | ✅ |
| Head-to-Head collision | PLAN says nothing | ⚠️ Not addressed | ⚠️ |

**Issue**: PLAN §2.4 specifies only head↔body collision for death. The architecture correctly implements this, but the threat model doesn't address the edge case of simultaneous head-to-head collisions (두 뱀 머리가 동시에 충돌). snake.io에서는 둘 다 사망.

**Recommendation**: Architecture collision section에 head-to-head 규칙 명시 (both die, both decompose to orbs).

---

## 6. Infrastructure Verification

| Check | PLAN Requirement | Deployment Doc | Status |
|-------|-----------------|---------------|--------|
| Vercel (FE) | Next.js 배포 | Vercel config specified | ✅ |
| Railway (BE) | WebSocket 서버 | Railway config + health check | ✅ |
| Supabase | Auth + DB | Schema + RLS policies | ✅ |
| CI/CD | 자동 배포 | GitHub Actions pipeline | ✅ |

---

## 7. ADR Consistency Verification

| ADR | Status | Consistent with PLAN? |
|-----|--------|----------------------|
| ADR-004 (Viewport Sync) | Revised | ✅ Matches viewport culling requirement |
| ADR-005 (Arena Lifecycle) | Superseded | ✅ Correctly supersedes Room model |
| ADR-006 (Rendering) | Revised | ✅ Smooth curves, adaptive quality |
| ADR-007 (Monorepo) | Maintained | ✅ Turborepo structure unchanged |
| ADR-008 (Auth) | Maintained | ✅ Anonymous-first matches PLAN |
| ADR-009 (Spatial Hash) | New | ✅ Matches collision optimization need |
| ADR-010 (Cont. Movement) | New | ⚠️ See note below |

**ADR-010 Warning**: `TURN_RATE: 0.06 rad/tick` at 20Hz = 1.2 rad/s = ~69°/s. This may feel too sluggish for fast-paced gameplay. snake.io allows somewhat faster turning. Consider making this a tunable config value during playtesting.

---

## 8. Cross-Document Consistency

| Check | Documents Compared | Status |
|-------|-------------------|--------|
| Arena radius value | PLAN(6000) vs types(6000) vs config(6000) | ✅ Consistent |
| Speed values | PLAN(200/400) vs types(200/400) vs ADR-010(200/400) | ✅ Consistent |
| Tick rate | PLAN(20Hz) vs arch(20Hz) vs deploy(20Hz) | ✅ Consistent |
| Orb types | PLAN(3 types) vs types(3 types) vs socket(0\|1\|2) | ✅ Consistent |
| Player count | PLAN(100) vs types(100) vs deploy(100) | ✅ Consistent |
| Turn rate | types(0.06) vs ADR-010(0.06) vs arch(0.06) | ✅ Consistent |
| Death orb ratio | PLAN(80%) vs types(0.8) vs arch(mass*0.8) | ✅ Consistent |

---

## 9. Issues Summary

### ⚠️ Medium Priority (4 issues)

| # | Issue | Location | Recommendation |
|---|-------|----------|----------------|
| V2-01 | 미니맵 데이터 프로토콜 미정의 | socket-events.md | 별도 `minimap` 이벤트 추가 (1Hz, 상위 뱀 위치) |
| V2-02 | 밀집 지역 대역폭 초과 가능 | architecture.md §7 | Distant snake 세그먼트 다운샘플링 추가 |
| V2-03 | Head-to-head 충돌 규칙 미명시 | architecture.md §6 | 양쪽 모두 사망 규칙 명시 |
| V2-04 | TURN_RATE 밸런싱 필요 | ADR-010 | 플레이테스트 후 조정 가능하도록 config화 |

### ✅ No Critical or High Issues

---

## 10. Conclusion

**Match Rate: 95%** — PLAN.md v2.0과 System Architecture v2.0 간 높은 일관성 확인.

v1 검증(87%)에서 v2 검증(95%)으로 **8%p 개선**. 근본적인 게임 컨셉 변경(grid→continuous)이 모든 문서에 일관되게 반영됨.

4개 Medium 이슈는 모두 구현 단계에서 해결 가능한 수준이며, 아키텍처 재설계 없이 보완 가능.

**Next Step**: `/da:dev`로 v2 기반 전면 재구현 시작 가능.

---

*Generated by DAVINCI /da:verify v2.0*
*Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>*
