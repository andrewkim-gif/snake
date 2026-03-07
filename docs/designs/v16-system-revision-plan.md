# PLAN: v16 — 게임 시스템 통합 수정 (System Revision)

> **목적**: GAME-SYSTEM-GAPS-ANALYSIS.md에서 발견된 31개 이슈를 체계적으로 수정
> **입력**: `GAME-SYSTEM-GAPS-ANALYSIS.md` (31 이슈) + `GAME-SYSTEM-ANALYSIS.md` (현행 분석)
> **산출물**: v11/v14/v15 기획서의 **인플레이스 수정** + 통합 어펜딕스
> **작성일**: 2026-03-07
> **Status**: DRAFT

---

## 1. 개요

### 배경

v10→v11→v14→v15로 이어진 기획서가 **각각 독립적으로 작성**되면서 31개의 시스템 간 모순, 논리적 결함, 수치 불균형이 발생했다. 특히:

- v14가 v11의 Room/Tome 시스템을 교체했으나 v15가 구 시스템을 전제로 작성됨
- 인게임 Gold ↔ 온체인 토큰 사이 브릿지 메커니즘 미정의
- 거버넌스 타임라인(36시간)과 게임 속도(10분 에포크) 불일치
- 50명 팩션으로는 World Emperor(100국) 달성이 수학적으로 불가능

### 수정 원칙

1. **기존 문서를 직접 수정** — 새 기획서를 만들지 않고, 모순이 있는 원본 문서의 해당 섹션을 수정
2. **버전 관리**: 수정된 섹션에 `[v16-REV]` 태그 + 원본 텍스트 보존 (`<details>` 태그)
3. **v14를 정본으로**: v11과 v14가 충돌하면 v14의 시스템을 기준으로 v11을 업데이트
4. **점진적 수정**: Critical 이슈부터 해결하여, 어느 시점에서든 기획이 일관성 있게 유지

### 수정 범위

| 대상 문서 | 수정 섹션 수 | 관련 이슈 |
|-----------|-------------|----------|
| `v11-world-war-plan.md` | ~12 섹션 | VC-01~06, EF-01~05, GG-01~04, FF-01~04, SF-01~03 |
| `v14-system-architecture.md` | ~5 섹션 | VC-01, VC-03~05, CB-01~05 |
| `v15-agent-arena-plan.md` | ~4 섹션 | VC-01~02, AG-01~04 |
| `GAME-SYSTEM-ANALYSIS.md` | 최종 동기화 | 전체 수정 반영 |

---

## 2. 요구사항

### 기능 요구사항 (수정 항목)

- [FR-1] v14 EpochManager ↔ v15 Agent 연결 통합 아키텍처 확정
- [FR-2] AgentStrategy 인터페이스를 v14 무기 체계로 마이그레이션
- [FR-3] Gold→온체인 브릿지 메커니즘 정의 (GoldBridge 컨트랙트 명세)
- [FR-4] Death Spiral 방지 플로어 메커니즘 추가
- [FR-5] 거버넌스 타임라인을 에포크 단위로 재조정
- [FR-6] 통합 점수 공식 확정 (CP + Kill + Level)
- [FR-7] 팩션 인원 / World Emperor 조건 수학적 일관성 확보
- [FR-8] 2계층 AI 아키텍처 (반사 AI + 전략 AI) 정의
- [FR-9] 시즌 보상 Dynasty 효과 방지 메커니즘
- [FR-10] Capture Point 상세 규칙 정의

### 비기능 요구사항

- [NFR-1] 수정 후 기획서 간 모순 0건 (교차 검증 통과)
- [NFR-2] 모든 수치 공식에 구체적 파라미터 명시 (TBD 제거)
- [NFR-3] 수정 이력 추적 가능 (`[v16-REV]` 태그)
- [NFR-4] GAME-SYSTEM-ANALYSIS.md와 최종 동기화

---

## 3. 기술 방향

- **수정 방식**: 기존 마크다운 문서의 인플레이스 수정 (Edit tool)
- **이력 관리**: 수정 섹션에 원본 보존 (`<details><summary>v16 이전 원본</summary>...</details>`)
- **검증**: 수정 완료 후 교차 참조 검증 (키워드 일관성 체크)

---

## 4. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 수정이 새로운 모순 유발 | Critical | 수정 후 즉시 교차 검증 (Phase별 체크포인트) |
| 수치 밸런스 불확실 | High | 범위 기반 명세 (min~max), 시뮬 TBD 표기 |
| 문서 길이 폭발 | Medium | 원본 보존은 `<details>` 접기로 최소화 |
| v14 구현과 기획 괴리 | High | 기획 수정 시 v14 코드 참조하여 구현 가능성 확인 |

---

## 구현 로드맵

<!-- ★ da:work Stage 0이 이 섹션을 자동 파싱합니다 -->

### Phase 0: 아키텍처 통합 — 버전 간 모순 해소 (Sprint 0)

> 코드 한 줄 짜기 전에 **기획서 간 모순부터 해소**. 이 Phase가 끝나면 v11/v14/v15가 하나의 일관된 시스템을 기술.

| Task | 설명 | 수정 대상 | 관련 이슈 |
|------|------|-----------|----------|
| T0-1: EpochManager 통합 아키텍처 | v14 EpochManager를 정본으로 확정. v11의 Room state machine 참조를 전부 EpochManager로 교체. v15의 "Room 재사용" 전제를 CountryArena + EpochManager로 수정. | `v11-world-war-plan.md` §4, `v15-agent-arena-plan.md` §3~5 | VC-01 |
| T0-2: AgentStrategy v14 마이그레이션 | v11의 `AgentStrategy.build_priority` (Tome/Ability) → v14의 WeaponType/PassiveType/SynergyType으로 인터페이스 교체. v15 OpenClaw Skill 스키마도 동기화. | `v11-world-war-plan.md` §8(Agent API), `v15-agent-arena-plan.md` §4(Skill) | VC-02 |
| T0-3: Gold↔온체인 브릿지 명세 | v11 §15에 GoldBridge 메커니즘 신규 삽입: (1) 인게임 Gold 소모 증명 → (2) 서버가 에포크 단위 정산 → (3) Treasury가 DEX 바이백 실행. 교환 레이트, rate limit, 자금 흐름 명시. v14 NG-1을 "경제 파라미터 재계산 필요"로 수정. | `v11-world-war-plan.md` §15(토큰), `v14-system-architecture.md` §2(NG) | VC-03, EF-01 |
| T0-4: Death Spiral 방어 메커니즘 | v11 §15에 플로어 메커니즘 추가: 최소 방어 +5%, 3회 연속 피정복 시 "반란 이벤트" (방어 +20%, 1시간), Treasury Reserve 5% 자동 매수. | `v11-world-war-plan.md` §15.3~15.4 | EF-02 |
| T0-5: 점수 공식 통합 | v11의 생존 기반 점수를 v14 리스폰 데스매치에 맞게 수정: `epochScore = kills × 15 + capturePoints × 30 + damageDealt / 100 + (deathless ? 50 : 0)`. v10 "Base 100" 제거. | `v11-world-war-plan.md` §4.3, `v14-system-architecture.md` §4.1 | VC-04, VC-06 |
| T0-6: Defense Oracle 에포크 동기화 | v11 §15.3의 "5분 주기" → "에포크 시작 시 1회 스냅샷, 에포크 내 불변". v14 에포크 타임라인과 동기화 확인. | `v11-world-war-plan.md` §15.3, `v14-system-architecture.md` §4 | VC-05 |

- **design**: N (기획서 수정, UI 없음)
- **verify**: 수정된 6개 문서 섹션에서 "Room state machine", "preferred_tomes", "5분 전투" 키워드 0건 확인. Gold→바이백 경로에 TBD 0건 확인.

### Phase 1: 핵심 시스템 재설계 — 구조적 결함 수정

> 게임플레이의 **공정성과 지속 가능성**을 결정하는 5개 구조적 문제 해결.

| Task | 설명 | 수정 대상 | 관련 이슈 |
|------|------|-----------|----------|
| T1-1: 거버넌스 타임라인 리스케일 | 투표 24h + 타임락 12h → **투표 6h + 타임락 2h = 8h**. 긴급 투표(정족수 20%, 1시간) 신규 추가. 전쟁 선포를 거버넌스에서 분리 → 팩션 Council 다수결(5명 중 3명)로 이동. | `v11-world-war-plan.md` §10(거버넌스) | GG-01 |
| T1-2: Peace Phase 파밍 캡 | 에포크당 레벨 상한 Lv.3, Gold 상한 500. War Phase 킬/CP 보상 ×3 배율. Peace Phase 약한 PvP 허용(데미지 50%). 이 수치를 v14 EpochManager의 Phase별 파라미터로 정의. | `v14-system-architecture.md` §4.1(EpochManager), `v14-ingame-overhaul-plan.md` | CB-01 |
| T1-3: 팩션 인원 및 지배 조건 수정 | 팩션 상한 50→**200명** 확대. World Emperor 조건 100국→**50국** 하향. "동맹 연합 주권" 개념 도입: Military Alliance 내 영토 합산으로 대륙 보너스 판정. 최소 점령 인원: 3명→1명 가능, 단 3명 미만은 Sovereignty Lv.1 상한. | `v11-world-war-plan.md` §5(팩션), §6(외교), §11(명예의전당) | FF-01 |
| T1-4: 2계층 AI 아키텍처 정의 | (1) 서버 측 **TacticalExecutor** (50ms): 회피, 기본 공격, 오브 수집. (2) LLM **StrategicDirector** (2초): 빌드 선택, 포지셔닝, 타겟 우선순위, 전략 지시. TacticalExecutor가 전략 지시를 해석하여 행동으로 변환하는 인터페이스 정의. | `v11-world-war-plan.md` §8(Agent API), `v15-agent-arena-plan.md` §3(행동 루프) | AG-01 |
| T1-5: 시즌 보상 Dynasty 방지 | "다음 시즌 시작 보너스"를 **코스메틱 전용**(금색 이펙트, 칭호)으로 변경. 게임플레이 보너스는 감쇠: N+1 시즌 50% → N+2 시즌 25% → N+3 소멸. 매 시즌 팩션 시작 위치 랜덤 배정. | `v11-world-war-plan.md` §12(시즌), §11(명예의전당) | SF-01 |

- **design**: N (기획서 수정)
- **verify**: 거버넌스 타임라인 합계 ≤ 8시간 확인. 팩션 200명 × 1명/국가 = 최대 200국 > 50국(World Emperor) 수학적 가능 확인. 시즌 보상에 "게임플레이 보너스" 직접 언급 0건 확인.

### Phase 2: 밸런스 수치 튜닝

> 시뮬레이션/플레이테스트로 검증이 필요한 **수치 밸런스** 문제. 범위 기반 명세로 작성, 정확한 값은 밸런스 시뮬 후 확정.

| Task | 설명 | 수정 대상 | 관련 이슈 |
|------|------|-----------|----------|
| T2-1: 동적 아레나 밀도 | S등급 아레나를 참가자 수에 따라 동적 조절: `size = base_size × sqrt(agents / max_agents)`. 참가자 < 20이면 최대 4000×4000. 모든 에포크에 Shrink 적용(Peace 포함, 느린 속도). 오브 밀도 = 아레나 크기에 반비례. | `v11-world-war-plan.md` §3.2(등급), `v14-system-architecture.md` §4(Arena) | CB-02 |
| T2-2: 빌드 프리셋 및 복잡성 완화 | 프리셋 빌드 5종 제공(공격/방어/균형/기동/지원). "빌드 추천 AI": 현재 아레나 메타에 따라 카운터 빌드 제안. 시즌 밸런스 패치로 메타 시프트. | `v14-ingame-overhaul-plan.md`(빌드 섹션) | CB-03 |
| T2-3: 지형 보너스 상한 | 국가당 1개 테마만 적용. 보너스 상한: 단일 +15%, 스택 합산 최대 +25%. Siege 전투에서는 테마 보너스 비활성. 비보너스 플레이어에게 "적응" 버프(3분 경과 후 +5%). | `v11-world-war-plan.md` §4.4(아레나 테마) | CB-04 |
| T2-4: Final Rush 밸런스 | Final Rush 전용 규칙: (1) 전원 무기 Lv.3 고정, (2) XP ×3 배율, (3) 시작 레벨 Lv.10. 또는 "서든데스" 모드: Peace 없음, 즉시 PvP, 리스폰 불가(v10 스타일). 에포크 시간 3분의 Peace/War 비율 명시. | `v11-world-war-plan.md` §12(시즌 Week 4), `v14-system-architecture.md` §4 | SF-02 |
| T2-5: 에이전트 입력 빈도 조정 | 에이전트 입력 10Hz → **15Hz** 상향. 혼합 아레나에서 인간 입력 10Hz 제한 옵션 추가. 에이전트에 "예측 이동" 허용: heading + 속도 설정 → 서버가 곡선 보간. | `v11-world-war-plan.md` §8(Agent API), `v15-agent-arena-plan.md` §3 | AG-02 |

- **design**: N (기획서 수정, 수치 조정)
- **verify**: 아레나 밀도 공식에서 S등급 50명 시 원본 크기(6000²), 20명 시 축소(~3795²) 확인. 지형 보너스 최악 케이스 스택이 +25% 이하 확인.

### Phase 3: 경제 시스템 보강

> 토큰 경제의 **유동성, 공정성, 지속성**을 보장하는 추가 메커니즘.

| Task | 설명 | 수정 대상 | 관련 이슈 |
|------|------|-----------|----------|
| T3-1: 티어별 유동성 풀 구조 | 195개 토큰의 유동성 분산 해결: S등급 8국 = 독립 풀(8개), A+B 대륙별 묶음 풀(5개: 아시아/유럽/아프리카/아메리카/오세아니아), C+D = $AWW 단일 페어(1개). 총 LP 풀 ~14개. 최소 유동성 게이트: TVL < $1,000인 풀은 Defense Oracle 미적용. | `v11-world-war-plan.md` §15(토큰 이코노미) | EF-03 |
| T3-2: 무역 수수료 독점 방지 | 수수료 상한 15% → **10%**. 단일 팩션 요충지 최대 2개 제한. 3개 이상 점령 시 수수료 효율 50% 감소. "밀수 루트" 메커니즘: 요충지 우회 가능, Oil 추가 ×1.5 + 50% 시간 지연. | `v11-world-war-plan.md` §7(경제), §4.5(요충지) | EF-04 |
| T3-3: 자원 생산 캡 | 곱연산→합연산: `production = base × (1 + tier_bonus + sov_bonus + stake_bonus + tech_bonus)`. 최대 보너스 합산 ~+200% (×3배 상한). 인구 캡: `min(workers, populationCap)`, populationCap은 티어별 고정. | `v11-world-war-plan.md` §7.2(자원 생산) | EF-05 |
| T3-4: 소국 거버넌스 보호 | 1인당 투표력 상한 = 전체의 33%. 정족수를 "10%" 고정에서 "최소 유니크 지갑 5개 + 10%" 병행 조건으로 변경. D등급 국가에서 "1인 1표" 안건(토큰 무관) 옵션 추가. | `v11-world-war-plan.md` §10(거버넌스) | GG-02 |
| T3-5: 이원 거버넌스 권한 매트릭스 | 권한 매트릭스 공식화: 팩션 리더 = 군사/외교/배치, 토큰 홀더 = 세율/무역/정책. 충돌 시 해결 규칙: (1) 세율 — 리더 1회 거부권, (2) 전쟁 — 홀더 66% 반대 시 취소, (3) 무역 — 홀더 전권. | `v11-world-war-plan.md` §10(거버넌스) | GG-03 |
| T3-6: UN 거부권 제한 | 시즌당 거부권 **3회** 제한 (기존 무제한). 거부권 행사 비용: 500 Influence. Override Vote: 비상임이사국 80% 찬성 시 거부권 무효화. | `v11-world-war-plan.md` §10.5(UN) | GG-04 |

- **design**: N (기획서 수정)
- **verify**: 유동성 풀 총 수 ≤ 15개 확인. 자원 생산 최대 배율이 ×3 이하 확인. 권한 매트릭스에 "충돌 시 해결 규칙" 누락 0건 확인.

### Phase 4: 외교/팩션 메커니즘 보강

> 팩션 간 상호작용의 **악용 방지**와 **글로벌 공정성** 보장.

| Task | 설명 | 수정 대상 | 관련 이슈 |
|------|------|-----------|----------|
| T4-1: NAP 스팸 방지 | NAP 동시 활성 최대 **3개**. NAP는 **쌍방 합의** 필요 (일방 불가). 갱신 쿨다운: 만료 후 24시간 대기. NAP 비용 100→**300 Influence**로 상향. | `v11-world-war-plan.md` §6(외교) | FF-02 |
| T4-2: 항복 패널티 선형화 | 항복 = 영토 20% → **최소 1국 + 자원 배상**으로 변경. 배상: 공격 팩션이 소비한 Influence + Oil의 2배. 전쟁 지속 시간별 추가: 30분 이내 10%, 이후 10분당 +5% (최대 50%). 항복 후 48시간 "전쟁 취약" 상태. | `v11-world-war-plan.md` §6.4(항복) | FF-03 |
| T4-3: World War 시간대 로테이션 | 주말 이벤트를 3개 시간대 로테이션: 아시아(12:00 UTC), 유럽(18:00 UTC), 아메리카(02:00 UTC). 월 4회 중 모든 시간대 최소 1회 보장. 또는 48시간 롤링 윈도우. | `v11-world-war-plan.md` §12(시즌 이벤트) | FF-04 |
| T4-4: 빈 국가 부재 점령 방지 | 지배력 감쇠: 전투 없이 24시간 경과 → Sovereignty Lv. -1 (최소 Lv.0 = 미점령). NPC 반란: 무인 국가에 12시간마다 반란 이벤트 (방어 안 하면 소유권 상실). 유지 비용: 지배 국가 수에 비례 Gold/Oil 소모. | `v11-world-war-plan.md` §5(주권 레벨) | SF-03 |

- **design**: N (기획서 수정)
- **verify**: NAP 스팸 시나리오 재연: 10개 팩션에 NAP → 최대 3개만 가능 확인. 항복 최소 1국 규칙: 2국 팩션 항복 시 1국 상실 확인.

### Phase 5: 세부 규칙 확정 + 최종 동기화

> 후순위 Medium 이슈 해결 + GAME-SYSTEM-ANALYSIS.md 최종 동기화.

| Task | 설명 | 수정 대상 | 관련 이슈 |
|------|------|-----------|----------|
| T5-1: Capture Point 상세 규칙 | 에포크당 3개 포인트 (아레나 삼각형 배치). 30초 점령 유지 시 확보. 점수: 30점/포인트 (킬 15점의 2배). 동시 점령 시 인원 비례 속도. 점령 후 5분 비활성. CP→Faction Score 자동 반영 (이중 시스템 폐기). | `v14-system-architecture.md` §4, `v11-world-war-plan.md` §4.3 | CB-05, VC-06 |
| T5-2: 에이전트 배치 비용 공식 | `Oil_cost = base_cost(10) × hop_count × terrain_mult`. 해양 홉 ×1.5. 본국 = 0. 같은 대륙 ×1.0, 다른 대륙 ×1.5, 반대편 ×2.0. 최대 ×3.0 캡. 홉 계산 기준: Natural Earth adjacency. | `v11-world-war-plan.md` §4.3(배치), `v15-agent-arena-plan.md` §3 | AG-03 |
| T5-3: ELO ↔ 팩션 점수 역할 분리 | ELO = 에이전트 전용 아레나에서만 적용 (개인 평가). 팩션 전투 = 순수 팩션 점수만 (팀 기여도). 에이전트 전용 아레나 결과는 주권에 영향 없음. | `v15-agent-arena-plan.md` §5(ELO) | AG-04 |
| T5-4: GAME-SYSTEM-ANALYSIS.md 최종 동기화 | Phase 0~4의 모든 수정 사항을 종합 분석서에 반영. 변경된 수치, 공식, 메커니즘을 해당 섹션별로 업데이트. "v16 수정 반영" 주석 추가. | `GAME-SYSTEM-ANALYSIS.md` 전체 | 전체 |
| T5-5: 교차 검증 (Cross-Reference Check) | 수정된 4개 기획서 간 용어/수치/메커니즘 일관성 최종 확인. 불일치 항목 0건 달성. GAPS-ANALYSIS.md의 각 이슈에 "RESOLVED" 태그 추가. | 전체 기획서 | NFR-1 |

- **design**: N
- **verify**: `GAME-SYSTEM-GAPS-ANALYSIS.md`의 31개 이슈 전부에 "RESOLVED" 태그 확인. 기획서 간 "Room state machine", "preferred_tomes", "5분 전투" 키워드 0건. 모든 수치 공식에 TBD 0건.

---

## 수정 이슈 ↔ Phase 매핑 요약

```
Phase 0 (아키텍처 통합)    VC-01, VC-02, VC-03, VC-04, VC-05, VC-06(일부), EF-01, EF-02
Phase 1 (핵심 재설계)      GG-01, CB-01, FF-01, AG-01, SF-01
Phase 2 (밸런스 튜닝)      CB-02, CB-03, CB-04, SF-02, AG-02
Phase 3 (경제 보강)        EF-03, EF-04, EF-05, GG-02, GG-03, GG-04
Phase 4 (외교 보강)        FF-02, FF-03, FF-04, SF-03
Phase 5 (세부 확정)        CB-05, VC-06(통합), AG-03, AG-04, 최종 동기화
```

**총 31개 이슈 → 6 Phase, 26 Task**

---

## 작업 순서 및 의존관계

```
Phase 0 ──→ Phase 1 ──→ Phase 2
                │              │
                ▼              ▼
            Phase 3 ──→ Phase 4 ──→ Phase 5 (최종 동기화)
```

- Phase 0은 **필수 선행**: 모든 후속 Phase가 통합된 아키텍처를 전제
- Phase 1, 2는 Phase 0 이후 순차 진행 (Phase 1의 팩션 인원 변경이 Phase 2 밸런스에 영향)
- Phase 3, 4는 Phase 1 이후 **병렬 가능** (경제와 외교는 독립적)
- Phase 5는 모든 Phase 완료 후 최종 동기화
