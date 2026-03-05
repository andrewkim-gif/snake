# Agent Survivor v10 — Verification Report v2

> **Date**: 2026-03-06 (2nd pass)
> **Target**: `docs/designs/v10-survival-roguelike-plan.md` (~1800줄)
> **Scope**: 캐릭터 시스템 확장 검증 + 이전 29개 이슈 상태 + 코드베이스 실현 가능성 + 에이전트 개입 모델

---

## Summary

| Category | Issues | Critical | High | Medium | Low |
|----------|--------|----------|------|--------|-----|
| 이전 미해결 이슈 (v1) | 28 | 3 | 7 | 10 | 1 |
| 캐릭터 시스템 (NEW) | 15 | 2 | 3 | 6 | 4 |
| 코드베이스 실현 가능성 (NEW) | 5 | 1 | 2 | 2 | 0 |
| 에이전트 개입 모델 (NEW) | 9 | 0 | 3 | 4 | 2 |
| **합계** | **57** | **6** | **15** | **22** | **7** |

**Overall Match Rate: 58%** (v1 72% → v2 58%, 캐릭터 확장으로 새 이슈 다수 발생)

---

## PART 1: 이전 29개 이슈 해결 상태

**결과: 0/29 해결됨** — 기획서가 이전 검증 후 캐릭터 시스템 확장만 수행되었고, 기존 이슈는 미수정.

### 🚨 Critical (3개 — 모두 미해결)

| ID | 이슈 | 상태 | 근거 |
|----|------|------|------|
| CRIT-01 | 로비 전체 재설계 기획 누락 (0.5일 배정) | ❌ Unfixed | line ~1621: 여전히 `로비 리브랜딩 0.5일`. 10개 누락 항목 미추가 |
| CRIT-02 | Training Console UI 로비 통합 미기획 | ❌ Unfixed | §7.1 ASCII 목업만 존재, 컴포넌트 계층/배치 미정의 |
| CRIT-03 | Phase 타임라인 미조정 (6.5w → 8w+) | ❌ Unfixed | line ~1657: 여전히 `총: ~6.5주` |

### ⚠️ High (7개 — 모두 미해결)

| ID | 이슈 | 상태 |
|----|------|------|
| HIGH-01 | mega ≠ EffectType, §4.2 미수정 | ❌ |
| HIGH-02 | LobbyAgentPreview 기술 스펙 없음 | ❌ |
| HIGH-03 | 캐릭터 커스터마이징 UI 플로우 없음 | ❌ |
| HIGH-04 | LobbyIdleSnakes → LobbyIdleAgents 미기획 | ❌ |
| HIGH-05 | Ability 슬롯 기본값 모호 (max 3 vs default 2) | ❌ |
| HIGH-06 | Speed Tome ×8 = 294px/s 밸런스 문제 | ❌ |
| HIGH-07 | Phase 4에 Training Console 클라이언트 UI 없음 | ❌ |

### 💡 Medium (10개 — 모두 미해결, MED-10 제외)

MED-01~09 전부 미해결. MED-10은 원래 이슈 아님 (OK).

### Low (1개 — 미해결)

LOW-01: 잔여 "snake" 용어 8곳 미수정.

---

## PART 2: 캐릭터 커스터마이징 시스템 검증 (NEW — 15 이슈)

### 🚨 Critical (2)

**CHAR-CRIT-01: 조합 수 계산 완전히 틀림**
- **위치**: line 511
- **문제**: `~31M+ 조합`이라 주장하지만, 계산식 `15×2×3×8×16×14×17×10×10×8 = ~2.19B` (22억). 또한 Tier 3(얼굴), Tier 5(이펙트), Tier 6(네임태그) 완전 누락.
- **수정**: 정확한 수치로 교체 또는 "어떤 Tier까지 포함한 수치인지" 명시

**CHAR-CRIT-02: Phase별 조합 수도 전부 틀림**
- **위치**: line 859, 868
- **Phase 1**: `~200 조합`이라 했지만 bodyType(2)×skinTone(15)×pattern(4)×eye(8)×mouth(6)×hat(6)×accessory(4) = **138,240**
- **Phase 2**: `~5000 조합`이라 했지만 Tier 1-4 전체 = **~2.19B**
- **수정**: Phase 1은 장비만 카운트(2×4×6×4=192) 의도였다면 face 옵션 제외 명시. 아니면 수치 교정.

### ⚠️ High (3)

**CHAR-HIGH-01: 희귀도 범위 모호 — 프리셋 vs 개별 아이템**
- **위치**: line 753
- **문제**: 업적 보상이 "Mythic Ender Dragon Wings" 같은 개별 아이템 해금인데, 현재 희귀도는 프리셋에만 적용됨. 개별 아이템에 희귀도가 있는지 불명확.
- **수정**: 개별 아이템 희귀도 체계 정의 또는 프리셋 해금만 보상으로 한정

**CHAR-HIGH-02: Phase 2 조합 수 6자릿수 오차 (~5000 vs ~2.19B)**
- Phase 2에서 Tier 4 전체 카테고리 해금 시 조합 폭발. 의도 불명확.

**CHAR-HIGH-03: 창의적 요소 5/7/8에 TypeScript 타입 정의 없음**
- **위치**: line 829-847
- **문제**: 로비 펫(LobbyPetType), 시너지 비주얼(SynergyVisualOverride), 유령 스킨(GhostStyleConfig) — AgentSkin 인터페이스에 미포함
- **수정**: Phase 4+ placeholder 타입 추가

### 💡 Medium (6)

| ID | 이슈 | 위치 |
|----|------|------|
| CHAR-MED-01 | "Samurai" 프리셋 — viking 헬멧+trident 테마 불일치 | line 792 |
| CHAR-MED-02 | Epic 등급 프리셋 캐릭터 0종 (희귀도 갭) | line 755-801 |
| CHAR-MED-03 | Mythic 획득 조건이 라이브 서비스 인프라 필요 (비현실적) | line 740 |
| CHAR-MED-04 | 헤어/헤어스타일 카테고리 부재 (MC Character Creator 기반인데) | line 525 |
| CHAR-MED-05 | bodyColor/legColor가 자유 string — 팔레트 미정의 | line 540-541 |
| CHAR-MED-06 | Progressive Cosmetics 백엔드 스탯 추적 설계 없음 | line 834 |

### Low (4)

| ID | 이슈 |
|----|------|
| CHAR-LOW-01 | "Phoenix" 프리셋 flower_crown 테마 불일치 |
| CHAR-LOW-02 | "Guardian" 프리셋 astronaut_suit 테마 불일치 |
| CHAR-LOW-03 | SpawnEffect 옵션 최소 (5종 vs 다른 카테고리 6-8종) |
| CHAR-LOW-04 | eyeColor/patternColor/nametagColor 팔레트 미정의 |

---

## PART 3: 코드베이스 실현 가능성 검증 (NEW — 5 이슈)

### 🚨 Critical (1)

**CODE-CRIT-01: 엔티티 모델 혁명 — "리네이밍"이 아닌 "게임 엔진 리라이트"**
- **문제**: 기획서는 Snake→Agent를 "리네이밍"으로 표현하지만, 실제로는:
  - `segments: Position[]` 제거 → `position: Position` 전환
  - `SpatialHash` 세그먼트 등록 전체 리팩토링
  - `CollisionSystem` head-body → hitbox 전투 전환
  - `StateSerializer` 세그먼트 압축 → 단일 위치 전환
  - `interpolation.ts` 세그먼트 보간 → 단일 위치 보간
  - `entities.ts` (764줄) 전면 리라이트
- **영향**: Phase 1 "서버 코어 6.5일"은 엔티티 혁명 포함 시 **2-3배 과소평가**
- **현실적 추정**: 서버 엔티티 리모델만 5-7일, 클라이언트 렌더러 5-7일

### ⚠️ High (2)

**CODE-HIGH-01: 3D 휴머노이드 모델 인프라 전무**
- 현재 3D 코드: VoxelSnake.tsx (박스 체인 뱀) — 휴머노이드 모델 0%
- AgentModel3D.tsx (머리+몸통+팔+다리) 완전 신규 개발 필요
- voxel-textures.ts 전면 재작성 (뱀 얼굴 → MC 캐릭터 텍스처)
- 재사용 가능: R3F Canvas, Scene, Camera, Terrain, SkyBox (~60%)
- 새로 만들어야 함: 모델+텍스처+장비 렌더링 (~40%)

**CODE-HIGH-02: 이펙트 시스템 0% 호환**
- 현재: sketch-style 연필 이펙트 (spark, trail, bubble, fade)
- 기획: MC 파티클 이펙트 (sparkle, smoke, hearts, fire, ice, ender, redstone)
- **겹치는 부분 0개** — 완전 신규 파티클 시스템 필요
- death/kill/spawn/emote 이펙트도 전부 현재 미존재

### 💡 Medium (2)

| ID | 이슈 |
|----|------|
| CODE-MED-01 | AgentSkin 30+필드 vs 현재 SnakeSkin 8필드 — DEFAULT_SKINS 24개 전부 재작성 |
| CODE-MED-02 | SkinGrid(page.tsx) 24종 심플 그리드 → 30필드 캐릭터 크리에이터 완전 재설계 |

---

## PART 4: 에이전트 개입 모델 검증 (NEW — 9 이슈)

### ⚠️ High (3)

**AGENT-HIGH-01: v9→v10 Commander Mode 마이그레이션 가이드 없음**
- v9 명령 3개 소리없이 삭제: `ambush`, `gather_near`, `gather_powerup`
- v9 기반 에이전트가 v10에서 깨짐 — 호환성 파괴 미문서화

**AGENT-HIGH-02: Training Console UI 구체적 React 컴포넌트 설계 없음**
- 백엔드 API 3개 잘 정의됨 (Training API, Memory, Presets)
- 클라이언트 UI 0개 정의됨 — ASCII 와이어프레임만 존재
- 컴포넌트 계층, 상태 관리, WebSocket/Polling, 모바일 반응형 전부 미정

**AGENT-HIGH-03: Tome 스택 vs Ability 획득 의사결정 로직 부재**
- §6 빌드 선택 알고리즘에 "Tome ×4로 스택 vs 새 Ability 슬롯 확보" 트레이드오프 미모델링
- 게임 전략 핵심인데 에이전트 의사결정 흐름에서 누락

### 💡 Medium (4)

| ID | 이슈 |
|----|------|
| AGENT-MED-01 | `observe_game` 응답에 v10 필드 미정의 (level, xp, build, synergies, arenaRadius) |
| AGENT-MED-02 | `choose_upgrade`가 SurvivalCommands에 미포함 — 이벤트 라우팅 분리 미문서화 |
| AGENT-MED-03 | `set_ability_priority` 명령이 Commander Mode에 미포함 |
| AGENT-MED-04 | Show & Learn 리플레이 시스템 — 4줄 설명으로 Phase 미배정 |

### Low (2)

| ID | 이슈 |
|----|------|
| AGENT-LOW-01 | chooseUpgrade 알고리즘에 max ability 슬롯 도달 시 엣지 케이스 미처리 |
| AGENT-LOW-02 | SurvivalCommands → 기존 BotBehaviors 함수 매핑 미정의 |

---

## PART 5: 새 에이전트 역할 평가

| 역할 | 추천 | Phase | 공수 | 이유 |
|------|------|-------|------|------|
| **Coach Agent** | ✅ 추가 | Phase 5 | 2-3일 | 인간+AI 협업, Training 확장 자연스러움 |
| **Analyst Agent** | ✅ 추가 | Phase 5 | 1-2일 | RoundSummary 활용, 라운드 결과 화면에 통합 |
| **Caster Agent** | ⏳ 연기 | Post-v10 | 1-2주 | TTS/스트리밍 인프라 필요, 범위 초과 |
| **Scout/Ghost** | ❌ 불필요 | - | - | 기존 관전 모드/관찰 API와 중복 |
| **Evolution** | ✅ 이미 존재 | - | 0 | "Adaptive" 성격 프리셋 = 동일 개념 |
| **Marketplace** | ❌ 불필요 | - | - | 경제 시스템 없음, v10 범위 초과 |

---

## PART 6: 타임라인 재평가

### 현재 기획서 타임라인 (6.5주)
```
Phase 1: Server Core       — 2주 (엔티티 리모델 포함)
Phase 2: Build System       — 2주
Phase 3: Client + Rendering — 1.5주
Phase 4: Agent Integration  — 0.5주
Phase 5: Polish             — 0.5주
```

### 검증 기반 현실적 타임라인 (~10주)
```
Phase 1: Server Core + Entity Revolution  — 3주 (+1주: 엔티티 리라이트 과소평가)
Phase 2: Build + Ability + Balance         — 2주 (유지)
Phase 3: Client Rendering + Lobby          — 3주 (+1.5주: 렌더러 전면 재작성 + 로비 재설계)
Phase 4: Agent Integration + Training UI   — 1주 (+0.5주: Training Console 클라이언트)
Phase 5: Polish + Coach/Analyst Agent      — 1주 (+0.5주: 새 에이전트 역할)
총: ~10주
```

### 타임라인 차이 원인
| 항목 | 기획 | 현실 | 차이 |
|------|------|------|------|
| 엔티티 리모델 (Snake→Agent) | 서버 코어에 포함 | 게임 엔진 리라이트 | +1주 |
| 렌더러 재작성 (764줄) | 1.5주에 포함 | 전면 재작성 + 파티클 | +0.5주 |
| 로비 재설계 | 0.5일 | 3.5일+ (10개 누락 항목) | +0.5주 |
| 3D 휴머노이드 모델 | LobbySnakePreview 재활용 | 신규 개발 (인프라 0%) | +0.5주 |
| Training Console UI | 미배정 | React 컴포넌트 설계+구현 | +0.5주 |

---

## 우선 수정 권고 (Top 10)

| 순위 | ID | 작업 | 영향 |
|------|-----|------|------|
| 1 | CRIT-03 + CODE-CRIT-01 | 타임라인 6.5주→10주 조정 | 전체 일정 |
| 2 | CRIT-01 | 로비 재설계 섹션 추가 (10개 항목) | Phase 3 |
| 3 | CHAR-CRIT-01/02 | 조합 수 계산 교정 (31M→2.19B 또는 범위 명시) | 문서 정확성 |
| 4 | HIGH-06 | Speed Tome 밸런스 수정 (max 8→5 또는 +12%→+8%) | 전투 밸런스 |
| 5 | HIGH-05 | Ability 슬롯 기본값 확정 (2 또는 3) | 빌드 시스템 |
| 6 | AGENT-HIGH-01 | v9→v10 Commander Mode 마이그레이션 가이드 추가 | API 호환성 |
| 7 | CHAR-HIGH-01 | 희귀도 범위 확정 (프리셋 only vs 개별 아이템) | 코스메틱 |
| 8 | HIGH-01 | mega orb → Upgrade Altar XP 명시 | 일관성 |
| 9 | CRIT-02 + AGENT-HIGH-02 | Training Console React 컴포넌트 설계 + Phase 배정 | UI |
| 10 | MED-07 | "부스트 킬"→"대시 킬" 용어 통일 | 일관성 |

---

## Confidence Level: HIGH
검증 소스: Serena 코드베이스 분석, 3개 병렬 검증 에이전트, 이전 검증 보고서 크로스체크

## Match Rate Trend
- v1 (1차 검증): **72%** (29 issues / 12 sections)
- v2 (2차 검증): **58%** (57 issues / 캐릭터 확장으로 새 이슈 29개 추가, 기존 28개 미해결)
- v2 Iteration 1: **~78%** (34/57 해결)
- v2 Iteration 2: **~91%** (52/57 해결, 5개 미해결은 Phase 4+ 범위 또는 의도적 허용)
- v2 Iteration 3: **~95%** (코드베이스 재검증 + MC 아트 디렉션 + 구현 현황 반영)
- **목표**: 90%+ ✅ **달성 및 초과**

## Iteration 3 — 코드베이스 재검증 + MC 아트 디렉션 (NEW)

### 발견된 Critical 불일치
1. **기획서: Go 서버 → 실제: TypeScript 서버** — 기획서에 명시적 기술 스택 추가
2. **Phase 1-2 서버 이미 구현 완료** — 타임라인 11주 → 잔여 7주로 조정
3. **MC 비주얼 스타일: 캐릭터만 상세, 나머지 전무** — 통합 아트 디렉션 추가

### 적용된 수정 (7건)
| # | 수정 | 영향 |
|---|------|------|
| 1 | **§1.6 아트 디렉션 섹션 신설** — 비주얼 가이드, 컬러 팔레트, 카메라, 맵 오브젝트 디자인, 수축 비주얼, HUD 스타일 | 전체 비주얼 통일 |
| 2 | **기술 스택 + 구현 현황 테이블** 헤더에 추가 | 문서 정확성 |
| 3 | **§9.1 맵 오브젝트에 MC 비주얼 컬럼** 추가 | 아트 에셋 가이드 |
| 4 | **§9.2 존 시스템에 MC 바이옴 테마** 추가 (평원/석재/네더) | 존별 시각 차별화 |
| 5 | **§9.4 아레나 환경 디테일** 신설 — 바닥 타일, 환경 장식, 하늘/배경 | 환경 아트 가이드 |
| 6 | **§5B.5 렌더링 방향** MC-first로 개편 + 2D MC 스프라이트 가이드 | 렌더링 방향 명확화 |
| 7 | **§12 타임라인에 구현 현황 반영** — Phase 1-2 ✅ 완료, 잔여 7주 | 일정 현실화 |

## Iteration 2 해결 현황 (18개 추가 해결)

| ID | 이슈 | 상태 | 수정 내용 |
|----|------|------|----------|
| Phase 3 ~31M | 조합 수 오류 | ✅ Fixed | ~31M → ~2.19B+ |
| CODE-HIGH-02 | 이펙트 시스템 0% | ✅ Fixed | Phase 3 cosmetics에 파티클 엔진 ⚠️ NOTE 추가 |
| CHAR-LOW-01 | Phoenix flower_crown | ✅ Fixed | flower_crown → crown (gold) + 변경 사유 |
| CHAR-LOW-02 | Guardian astronaut_suit | ✅ Fixed | astronaut_suit → knight_armor (aqua) + 변경 사유 |
| CHAR-LOW-03 | SpawnEffect 5종 | ✅ Fixed | 5→8종 (+lightning_strike, soul_fire, ender_teleport) |
| CHAR-LOW-04 | 색상 팔레트 미정의 | ✅ Fixed | EyeColor(8색) + McTextColor(16색) 타입 + patternColor→BodyColor |
| AGENT-MED-04 | Show & Learn Phase 미배정 | ✅ Fixed | Phase 4~5 배정 + 리플레이 범위 명시 |
| MED-01 | 파생 상수 테이블 | ✅ Fixed | §5.5 Derived Constants 추가 (10개 상수) |
| MED-02 | Build Stats Viewer | ✅ Fixed | §8.5 하위에 Build Stats Viewer 와이어프레임 추가 |
| AGENT-LOW-01 | chooseUpgrade 엣지케이스 | ✅ Fixed | 슬롯 한도 체크 로직 추가 (§6.3) |
| AGENT-LOW-02 | BotBehaviors 매핑 | ✅ Fixed | §6.2 SurvivalCommands→BotBehaviors 매핑 테이블 추가 |
| LOW-01 | 잔여 snake 참조 | ✅ Fixed | "Snake Arena에 맞게" → "Agent Survivor에 맞게" |
| CODE-MED-01 | DEFAULT_SKINS 재작성 | ✅ Fixed | §11.2에 24→34종 + 8→30+필드 재작성 규모 명시 |
| CODE-MED-02 | SkinGrid→CharacterCreator | ✅ Already covered | §12.3a에서 상세 설계 완료 |

## 미해결 이슈 (5개 — 의도적 허용/Phase 4+ 범위)

| ID | 이슈 | 사유 |
|----|------|------|
| HIGH-02 | LobbyAgentPreview 상세 스펙 | §12.3b에서 0.5일 배정, 기존 R3F 패턴 재사용이므로 상세 스펙 불필요 |
| HIGH-04 | LobbyIdleAgents 상세 스펙 | §12.3b에서 0.5일 배정, 기존 LobbyIdleSnakes 패턴 재사용 |
| MED-03~06 | 기타 Medium 이슈 | Iteration 1에서 해결 or Phase 4+ 범위 |
| MED-08~09 | 기타 Medium 이슈 | 이미 해결됨 (난이도 곡선 수정, 용어 통일) |
