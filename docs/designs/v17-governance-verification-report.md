# v17 거버넌스 모델 검증 보고서

> **검증 대상**: `docs/designs/v17-superpower-agent-system-plan.md` (1,539줄)
> **검증 관점**: 국가 정책 결정 권한 (누가 정책을 설정/변경할 수 있는가?)
> **검증일**: 2026-03-07
> **심각도**: 🚨 Critical — 기존 거버넌스 시스템과의 통합 누락

---

## 요약

v17 계획은 SuperPower 2의 5개 도메인(경제/외교/군사/정치/전투) 시스템을 AI World War에 통합하는 훌륭한 비전을 제시하지만, **기존에 구축된 다층 거버넌스/권한 시스템을 거의 무시**하고 있다. v17 SDK v2의 API 설계는 마치 "누구든 API를 호출하면 즉시 정책이 반영되는" 구조로 되어 있어, 기존의 팩션 역할 체계, 주권/패권 시스템, UN 안보리, 온체인 거버넌스(쿼드라틱 투표) 등과 충돌한다.

**핵심 질문**: "아무나 국가의 정책을 반영하거나 정하면 안 되잖아?"
**답**: 맞다. 기존 시스템에는 최소 **4개 권한 레이어**가 있으며, v17은 이를 반영해야 한다.

---

## 1. 기존 거버넌스/권한 시스템 맵

현재 AI World War에는 **4개 레이어**의 권한 제어가 구축되어 있다.

### Layer 1: 팩션 역할 체계 (`meta/faction.go`)

```
supreme_leader (rank 4) ─── 팩션 해산, 리더 이전
council        (rank 3) ─── 정책 변경, UN 투표, 재정 인출
commander      (rank 2) ─── 멤버 관리, 군사 배치
member         (rank 1) ─── 기본 활동, 재정 입금
```

**`HasPermission(factionID, userID, minRole)`**: 유저의 실제 역할 rank ≥ 요구 역할 rank인지 확인.

| 행동 | 필요 권한 |
|------|----------|
| 경제 정책 변경 | Council+ (rank ≥ 3) |
| UN 안보리 제안/투표 | Council+ |
| 멤버 승진 | Council+ (대상보다 높아야 함) |
| 멤버 퇴출 | Commander+ (대상보다 높아야 함) |
| 재정 인출 | Council+ |
| 팩션 해산 | Supreme Leader only |

### Layer 2: 주권/패권 시스템 (`game/sovereignty.go`)

```
지배 (연속) ──[24시간]──▶ 주권 ──[+7일]──▶ 패권
                                            │
                                            ▼
                                      CanSetPolicy() = true
```

- **주권 (Sovereignty)**: 24시간 연속 지배 → 주권 달성 → SovereigntyLevel 증가
- **패권 (Hegemony)**: 주권 후 추가 7일 연속 → 패권 달성 → 정책 설정 가능
- **CanSetPolicy(nationality)**: 패권 보유 국가 OR 14일 유예 기간 내 전 패권국만 true
- **핵심**: 주권만으로는 정책 설정 불가. 패권(7일 추가)까지 도달해야 함

### Layer 3: 경제 정책 인증 체인 (`meta/policy.go`)

```go
func UpdatePolicy(iso3, userID string, policy PolicyType, value float64) error {
    // Gate 1: 팩션 소속 확인
    factionID := factionManager.GetUserFaction(userID)
    if factionID == "" → ❌ "you must be in a faction"

    // Gate 2: 해당 국가의 주권 팩션인지 + 주권 Lv.3+
    if econ.SovereignFaction != factionID → ❌ "your faction does not control {iso}"
    if econ.SovereigntyLevel < 3 → ❌ "sovereignty level {n} < 3 required"

    // Gate 3: 역할 확인 (Council+)
    if !HasPermission(factionID, userID, RoleCouncil) → ❌ "requires Council+ permission"

    // 통과: 정책 변경 실행
}
```

**4중 게이트**: 팩션 소속 → 주권 팩션 일치 → 주권 Lv.3+ → Council+ 역할

### Layer 4: 온체인 거버넌스 (`contracts/src/GovernanceModule.sol`)

```
제안 생성 (1000+ 토큰 보유) ──▶ 쿼드라틱 투표 (3일) ──▶ 확정 ──▶ 서버 실행
                                     │
                                     ▼
                              투표력 = √(투입 토큰)
```

- **제안 자격**: 해당 국가 토큰 1,000개 이상 보유
- **투표 메커니즘**: 쿼드라틱 투표 — 투표력 = √(투입 토큰수), 자금력 독점 방지
- **투표 기간**: 3일 (관리자 설정 가능)
- **확정**: forVotes > againstVotes → Passed (※ quorum 5% 미적용 — 미완성 기능)
- **실행**: onlyOwner (게임 서버 관리자 키)

### Layer 5: UN 안보리 (`meta/council.go`)

```
상임이사국 (S-tier 8개국): USA, CHN, RUS, IND, BRA, JPN, DEU, GBR → 거부권 보유
비상임이사국 (A-tier): 투표 가능, 거부권 없음
옵서버: 투표 불가
```

- **결의안 제안**: 상임/비상임 좌석 보유 팩션의 Council+ 멤버만
- **투표**: 상임/비상임만 가능
- **거부권**: 상임이사국이 반대 = 즉시 부결 (vetoed)
- **효과**: nuclear_ban(72h), free_trade(48h), peacekeeping(48h), economic_sanction(7d), climate_accord(72h)

## 2. v17 계획의 권한 모델 갭 분석

### 2.1 v17 현재 권한 설계 (Section 9.4)

v17 계획서의 인증/Rate Limiting 섹션 (9.4)에 명시된 권한:

```yaml
전투 API: 기본 권한 (모든 에이전트)
경제/정치 API: 해당 국가 지배 팩션 소속 + 거버넌스 권한 필요
외교 API: 팩션 리더 또는 Council 이상 권한
군사 API: Commander 이상 권한
```

### 2.2 누락된 권한 게이트 (Critical)

| 기존 권한 레이어 | v17에서의 언급 | 갭 심각도 |
|-----------------|--------------|----------|
| 팩션 역할 체계 (4-tier) | "Council 이상" 정도만 언급 | ⚠️ High — 역할별 세분화 부재 |
| 주권 레벨 (Lv.3+ 요건) | ❌ 없음 | 🚨 Critical — 주권 없이 정책 변경 가능 |
| 패권 시스템 (7일 누적) | ❌ 없음 | 🚨 Critical — CanSetPolicy() 무시 |
| 온체인 거버넌스 (쿼드라틱 투표) | ❌ 완전 누락 | 🚨 Critical — 민주적 의사결정 부재 |
| UN 안보리 결의안 | ❌ 완전 누락 | ⚠️ High — 글로벌 정책 게이트 부재 |
| 정책 유예 기간 (14일) | ❌ 없음 | ⚠️ High — 패권 상실 시 정책 전환 처리 없음 |

### 2.3 구체적 충돌 사례

**사례 1: AI 에이전트가 세율 변경**
```
v17 설계: agent.economy.setTaxPolicy({ pit: 0.35 })
          → MetaREST POST /api/v2/economy/tax
          → 즉시 반영?

실제 필요한 검증 체인:
  ① 에이전트의 유저가 팩션에 소속되어 있는가?
  ② 그 팩션이 해당 국가의 주권 팩션인가?
  ③ 주권 레벨이 3 이상인가?
  ④ 유저가 Council 이상 역할인가?
  ⑤ CanSetPolicy() — 패권을 보유하고 있는가?
  ⑥ (옵션) 온체인 거버넌스 투표를 거쳐야 하는가?
```

**사례 2: AI 에이전트가 정부 형태 변경**
```
v17 설계: agent.politics.changeGovernment('democracy')
          → POST /api/v2/politics/government
          → 즉시 반영?

실제 필요:
  ① Layer 1-5 전체 통과
  ② 현 정부 형태 → 새 정부 형태 전환 조건 충족 (쿠데타? 선거? 혁명?)
  ③ 지지율 기반 조건 (민주주의→독재: 쿠데타 조건, 독재→민주주의: 혁명 조건)
  ④ 온체인 투표? (정부 형태 변경은 국가 토큰 홀더의 동의 필요?)
  ⑤ UN 결의안 영향? (계엄/독재 전환 시 peacekeeping 결의 위반?)
```

**사례 3: AI 에이전트가 전쟁 선포**
```
v17 설계: agent.diplomacy.declareWar('CHN')
          → POST /api/v2/diplomacy/war/declare
          → 즉시 실행?

실제 필요:
  ① 팩션 Council+ 역할
  ② peacekeeping 결의안이 활성 중이면 전쟁 선포 불가
  ③ DR이 일정 이하여야 전쟁 선포 가능 (우호국에 선전포고 방지)
  ④ 동맹 조약 위반 체크 (같은 동맹 내 국가 공격 시 조약 위반)
  ⑤ 온체인 거버넌스 투표? (전쟁 선포는 국가 중대 결정)
```

### 2.4 이중 정책 시스템 충돌

현재 **세 가지 정책 시스템**이 병렬 존재:

| 시스템 | 파일 | 정책 항목 | 권한 |
|--------|------|----------|------|
| v11 경제 정책 | `meta/policy.go` | 4 슬라이더 (tax_rate, trade_openness, military_spend, tech_invest) | 팩션+주권Lv3+Council |
| v14 국가 정책 | `game/sovereignty.go` | CanSetPolicy → 패권 기반 | 패권 보유 |
| v17 확장 정책 | (계획) | 3층 세금(PIT+자원세+GTM) + 8종 예산 + 국유화/민영화 + 국내법 | ??? |

**문제**: v17은 v11의 4개 경제 슬라이더를 대체하는지, 확장하는지 불명확. v14의 패권 기반 CanSetPolicy()와의 관계도 정의되지 않음.

## 3. SDK v2 API 엔드포인트별 권한 요구사항

v17의 모든 POST API에 대해 기존 시스템 기준으로 필요한 권한을 매핑한다.

### 3.1 경제 API

| 엔드포인트 | v17 계획 | 실제 필요 권한 | 갭 |
|-----------|---------|--------------|-----|
| `POST /economy/tax` | "거버넌스 권한" | 팩션 소속 + 주권 팩션 + SovLv3+ + Council+ + CanSetPolicy() | 🚨 5단계 중 1단계만 언급 |
| `POST /economy/budget` | "거버넌스 권한" | 위와 동일 | 🚨 |
| `POST /economy/trade/propose` | "거버넌스 권한" | Council+ + 상대국과 DR ≥ 특정값 | ⚠️ DR 요건 누락 |
| `POST /economy/ownership` | "거버넌스 권한" | Council+ + CanSetPolicy() + (잠재적) 온체인 투표 | 🚨 민영화/국유화는 중대 결정 |

### 3.2 외교 API

| 엔드포인트 | v17 계획 | 실제 필요 권한 | 갭 |
|-----------|---------|--------------|-----|
| `POST /diplomacy/treaty/propose` | "Council 이상" | Council+ + DR 요건 충족 (조약별 상이) | ⚠️ DR 임계값 체크 누락 |
| `POST /diplomacy/treaty/{id}/join` | 미언급 | Council+ + DR 요건 + (다자조약) 기존 멤버 승인 | 🚨 다자조약 가입 절차 없음 |
| `POST /diplomacy/war/declare` | "Council 이상" | Council+ + peacekeeping 미활성 + DR < 임계값 + 동맹 미위반 | ⚠️ UN 결의 체크 누락 |
| `POST /diplomacy/sanction` | 미언급 | UN 안보리 결의안 통과 필요 (economic_sanction) | 🚨 UN 안보리 연동 완전 누락 |

### 3.3 군사 API

| 엔드포인트 | v17 계획 | 실제 필요 권한 | 갭 |
|-----------|---------|--------------|-----|
| `POST /military/produce` | "Commander 이상" | Commander+ + 예산/자원 충분 + (정부 형태 수정자) | ⚠️ 자원 체크 언급 없음 |
| `POST /military/deploy` | "Commander 이상" | Commander+ + 전쟁 상태 or 자국 방어 | ⚠️ 평화 시 해외 배치 제한 없음 |
| `POST /military/nuke/launch` | "Commander 이상" | Council+ (Commander로는 부족) + nuclear_ban 미활성 + DR 페널티 고지 | 🚨 핵 발사를 Commander에게 허용하면 안 됨 |
| `POST /military/tech/invest` | "Commander 이상" | Council+ + 예산 할당 내 + (핵 연구 시 DR -55 경고) | ⚠️ |

### 3.4 정치 API

| 엔드포인트 | v17 계획 | 실제 필요 권한 | 갭 |
|-----------|---------|--------------|-----|
| `POST /politics/government` | "거버넌스 권한" | Supreme Leader+ + 전환 조건 충족 + (온체인 투표?) | 🚨 가장 중대한 결정에 권한 미정의 |
| `POST /politics/law` | "거버넌스 권한" | Council+ + CanSetPolicy() + (일부 법률은 온체인 투표?) | 🚨 |
| `POST /politics/martial-law` | "거버넌스 권한" | Supreme Leader only + 지지율/위기 조건 | 🚨 계엄은 최고 권한만 가능 |
| `POST /politics/un/vote` | "거버넌스 권한" | Council+ + UN 안보리 좌석 보유 팩션 | ⚠️ 좌석 조건 누락 |

### 3.5 LLM 통합 API

| 엔드포인트 | v17 계획 | 실제 필요 권한 | 갭 |
|-----------|---------|--------------|-----|
| `POST /agent/llm/decide` | "1시간 1회" | **모든 결정을 각각의 권한 체크 통과** | 🚨 일괄 실행은 각 액션별 개별 권한 검증 필요 |

**문제점**: LLM의 `decide` 응답에 `economy.tax_changes`, `diplomacy.war_declarations`, `politics.government_change`가 모두 포함될 수 있는데, 각각의 권한 수준이 다르다. Council 멤버가 `politics.government_change`를 시도하면 거부되어야 하지만, 같은 배치의 `economy.tax_changes`는 허용되어야 한다. **부분 실행 로직**이 필요하다.

## 4. 통합 거버넌스 모델 제안

### 4.1 권한 계층 통합 (5-Layer Auth Chain)

모든 v17 API 호출은 다음 5개 레이어를 **순차적으로** 통과해야 한다:

```
┌─────────────────────────────────────────────────────────────────┐
│                    v17 통합 권한 체인                              │
│                                                                   │
│  요청 진입                                                        │
│    │                                                              │
│    ▼                                                              │
│  ① JWT 인증 + 팩션 소속 확인                                      │
│    │  → 미소속: "you must be in a faction"                        │
│    ▼                                                              │
│  ② 팩션 역할 체크 (API별 최소 역할)                                │
│    │  → 역할 부족: "requires {minRole}+ permission"               │
│    ▼                                                              │
│  ③ 주권/패권 체크 (정책 변경 API만)                                │
│    │  → 주권 없음: "your faction does not control {country}"      │
│    │  → 주권 Lv 부족: "sovereignty level {n} < {required}"       │
│    │  → 패권 없음: "hegemony required for policy changes"         │
│    ▼                                                              │
│  ④ 조건부 체크 (API별 상이)                                        │
│    │  → DR 요건 미충족, UN 결의 위반, 자원 부족 등                  │
│    ▼                                                              │
│  ⑤ 온체인 거버넌스 (중대 결정만)                                    │
│    │  → 투표 진행 중: "proposal pending, awaiting vote"            │
│    │  → 투표 부결: "proposal rejected by token holders"            │
│    ▼                                                              │
│  ✅ 실행                                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 API별 권한 매트릭스 (최종)

#### 즉시 실행 가능 (거버넌스 투표 불필요)

| API | 최소 역할 | 주권/패권 | 조건부 체크 |
|-----|----------|----------|-----------|
| 세금 변경 (PIT/자원세/GTM) | Council | SovLv3 + 패권 | 범위 내 (0~50%) |
| 예산 배분 변경 | Council | SovLv3 + 패권 | 합계 = 100% |
| 무역 제안 | Council | 주권 | DR ≥ -20 (상대국) |
| 조약 제안 (양자) | Council | 주권 | DR ≥ 조약별 임계값 |
| 다자조약 가입 | Council | 주권 | DR ≥ 조약별 임계값 + 기존 멤버 과반 동의 |
| 유닛 생산 | Commander | — | 자원 + 예산 충분 |
| 유닛 배치/소환 | Commander | — | 전쟁 상태 or 자국 |
| 기술 투자 | Council | SovLv3 | 예산 할당 내 |
| 국내법 변경 (소규모) | Council | SovLv3 + 패권 | 법률 종류별 제한 |
| UN 투표 | Council | — | UN 좌석 보유 |
| 전쟁 선포 | Council | 주권 | peacekeeping 미활성 + DR < -30 |
| 평화 제안 | Council | 주권 | 전쟁 중 |

#### 거버넌스 투표 필요 (중대 결정)

| API | 최소 역할 | 거버넌스 | 조건부 체크 |
|-----|----------|---------|-----------|
| 정부 형태 변경 | Supreme Leader | 쿼드라틱 투표 (3일) | 전환 조건 + 쿠데타/선거/혁명 경로 |
| 국유화/민영화 | Council | 쿼드라틱 투표 (3일) | 경제 영향 고지 |
| 핵무기 발사 | Supreme Leader | 쿼드라틱 투표 (1일, 긴급) | nuclear_ban 미활성 + DR 페널티 고지 |
| 계엄 선포 | Supreme Leader | 즉시 (위기 시) | 지지율 < 20% or 침공 중 |
| 국내법 변경 (중대) | Council | 쿼드라틱 투표 (3일) | child_labor, nuke_research 등 |

### 4.3 온체인 거버넌스 통합 방안

```
두 가지 거버넌스 경로:

┌──────────────────────────────────────────────────────────────┐
│  경로 A: "일상 정책" (즉시 실행)                               │
│  ──────────────────────────                                   │
│  세금 ±5%, 예산 재배분, 무역 제안 등                           │
│  → 팩션 역할 체크만으로 충분                                    │
│  → 온체인 투표 불필요 (게임 속도 유지)                          │
│                                                               │
│  경로 B: "중대 결정" (투표 필요)                                │
│  ──────────────────────────                                   │
│  정부 변경, 핵 사용, 국유화, 아동노동법 등                     │
│  → 서버가 "proposal" 생성 → 온체인 쿼드라틱 투표 → 결과 실행   │
│  → 투표 기간: 일반 3일, 긴급 1일 (전쟁/침공 시)                │
│  → 국가 토큰 홀더 참여 (게임 외부 거버넌스)                     │
└──────────────────────────────────────────────────────────────┘
```

**중대 결정의 기준**:
- 정부 형태 변경: 전체 시스템 수정자가 바뀜
- 핵무기 사용: 글로벌 DR -55 + 파괴적 영향
- 국유화/민영화: 경제 구조 대전환
- 특정 국내법: child_labor, nuke_research, death_penalty 등 DR 영향 大
- 계엄 선포: 예외적으로 즉시 가능 (위기 대응)

### 4.4 정책 시스템 통합 (v11 + v14 + v17)

```
v11 경제 정책 (4 슬라이더)
    │
    ▼  [흡수/확장]
v17 경제 정책 v2
    ├── 세금: PIT (v11 tax_rate 대체) + 자원세 + GTM
    ├── 예산: 8종 (v11 military_spend + tech_invest → 예산 내 카테고리로)
    ├── 무역: v11 trade_openness → 무역 정책 + 양자/다자 조약으로 대체
    └── 기타: 국유화/민영화, 국내법 (NEW)

v14 패권 시스템 (CanSetPolicy)
    │
    ▼  [유지 + 확장]
v17 정책 접근 제어
    ├── 일상 정책: SovLv3 + Council (기존 v11 수준 유지)
    ├── 중대 정책: 패권(CanSetPolicy) + 온체인 투표
    └── 패권 유예: 14일 (기존 유지) — 유예 중 일상 정책만 가능

온체인 거버넌스 (GovernanceModule.sol)
    │
    ▼  [확장]
v17 거버넌스
    ├── proposalType 확장: tax(0), trade(1), defense(2), treasury(3), government(4), law(5), nuke(6)
    ├── 긴급 투표 모드: votingDuration 1일 (계엄/침공 시)
    └── quorum 적용: 실제로 5% quorum 체크 활성화
```

## 5. 권장 조치 사항

### 🚨 Critical (즉시 반영 필요)

**C-1: v17 계획서 Section 9.4 권한 모델 전면 재작성**
- 현재 1줄짜리 "거버넌스 권한 필요"를 → 5-Layer Auth Chain으로 교체
- 모든 POST API에 대해 필요 역할 + 주권/패권 요건 + 조건부 체크 명시
- LLM 일괄 결정 (`/agent/llm/decide`)의 부분 실행 로직 설계

**C-2: SDK v2 API에 권한 체크 통합**
- `EconomyDomain.setTaxPolicy()`는 내부적으로 서버가 5-Layer 검증 수행
- SDK 측에서는 사전 검증용 `canSetPolicy()`, `getMyPermissions()` 헬퍼 제공
- 권한 부족 시 명확한 에러 메시지 반환 (어떤 레이어에서 실패했는지)

**C-3: 정책 시스템 통합 전략 명확화**
- v11의 4 슬라이더 → v17 세금/예산으로 **마이그레이션** (병렬 존재 금지)
- `UpdatePolicy()` 함수를 v17 `UpdateEconomyPolicy()` 로 리팩토링
- v14 `CanSetPolicy()`는 중대 결정 게이트로 **유지 + 확장**

**C-4: 온체인 거버넌스 통합**
- `GovernanceModule.sol`에 `proposalType` 확장 (government, law, nuke 추가)
- `quorumBasisPoints` 실제 적용 (현재 미검증 버그 수정)
- 서버 ↔ 스마트 컨트랙트 연동 흐름 설계 (proposal 생성 → 투표 → 결과 콜백)

### ⚠️ High (Phase 1-2에 반영)

**H-1: 핵 발사 권한 상향**
- v17: Commander 이상 → **Supreme Leader + 온체인 긴급 투표(1일)**로 변경
- 핵 발사의 글로벌 DR -55 영향은 너무 파괴적 — 최고 수준 권한 필요

**H-2: UN 안보리 연동 설계**
- v17의 제재 API (`/diplomacy/sanction`)는 UN 안보리 결의안 통과 후에만 가능
- `peacekeeping` 결의 활성 시 전쟁 선포 API 자동 차단
- `nuclear_ban` 결의 활성 시 핵 발사 API 자동 차단

**H-3: AI 에이전트의 권한 제한 설계**
- AI 에이전트는 팩션 내 역할을 배정받음 (기본: Commander)
- Supreme Leader 역할의 AI 에이전트만 중대 결정 가능
- LLM 에이전트의 `available_actions`에 **현재 권한으로 실행 가능한 액션만** 포함

### 💡 Medium (Phase 3-4에 반영)

**M-1: 거버넌스 투표 UI 확장**
- 기존 `components/governance/` (ProposalList, VoteInterface)를 v17 proposalType 확장
- 현재 mock 데이터 → 실제 스마트 컨트랙트 연동

**M-2: 정책 변경 감사 로그 확장**
- `PolicyChangeRecord` (기존)를 v17의 모든 도메인으로 확장
- 누가 언제 무엇을 변경했는지 추적 가능
- AI 에이전트의 결정도 동일한 감사 로그에 기록

**M-3: 팩션 내 위임 시스템**
- Council이 특정 도메인의 일상 결정을 Commander에게 위임 가능
- 예: "경제 정책은 AI 어드바이저에게 위임" → Commander 역할의 AI도 세금 변경 가능
- 위임 범위 제한 (세금 ±5% 이내 등)

## 6. 심각도 요약 매트릭스

| # | 이슈 | 심각도 | 영향 범위 | 관련 파일 |
|---|------|--------|----------|----------|
| C-1 | 권한 모델 전면 재작성 필요 | 🚨 Critical | v17 Section 9.2, 9.4 전체 | `v17-superpower-agent-system-plan.md` |
| C-2 | SDK v2 API 권한 체크 통합 | 🚨 Critical | SDK Section 8.2 전체 | 신규: `economy.ts`, `diplomacy.ts` 등 |
| C-3 | 3중 정책 시스템 통합 전략 | 🚨 Critical | v11 `policy.go` + v17 `economy_v2.go` | `meta/policy.go`, `meta/economy_v2.go` |
| C-4 | 온체인 거버넌스 통합 | 🚨 Critical | 스마트 컨트랙트 ↔ 서버 연동 | `GovernanceModule.sol`, 서버 콜백 |
| H-1 | 핵 발사 권한 Commander→Supreme Leader | ⚠️ High | v17 Section 9.2 군사 API | 서버 `military_routes.go` |
| H-2 | UN 안보리 결의안 연동 | ⚠️ High | v17 Section 9.2 외교/군사 API | `meta/council.go` ↔ v17 API |
| H-3 | AI 에이전트 역할 기반 액션 제한 | ⚠️ High | SDK Section 8.3 LLM 브리핑 | `available_actions` 필터링 |
| M-1 | 거버넌스 투표 UI 확장 | 💡 Medium | 프론트엔드 Phase 9 | `components/governance/*` |
| M-2 | 전 도메인 감사 로그 확장 | 💡 Medium | 서버 Phase 4 | `PolicyChangeRecord` 확장 |
| M-3 | 팩션 내 권한 위임 시스템 | 💡 Medium | 서버+SDK Phase 4-5 | `meta/faction.go` 확장 |

---

## 7. 결론

v17 SuperPower Agent Intelligence System은 게임의 깊이를 획기적으로 확장하는 비전이지만, **기존의 정교한 거버넌스 시스템(팩션 역할, 주권/패권, UN 안보리, 온체인 투표)을 통합하지 않으면 "누구든 API만 호출하면 독재자처럼 정책을 바꿀 수 있는" 게임이 된다**.

이 검증 보고서의 핵심 메시지:

1. **"아무나 정책을 바꾸면 안 된다"** → 기존 5-Layer Auth Chain을 v17 모든 API에 적용
2. **일상 정책 vs 중대 결정** 이원화 → 게임 속도 유지하면서 중요한 결정은 민주적 검증
3. **3중 정책 시스템 정리** → v11/v14를 v17로 흡수 통합, 마이그레이션 경로 명확화
4. **AI 에이전트도 권한 제한** → 팩션 내 역할에 따라 `available_actions` 동적 필터링
5. **온체인 거버넌스 활성화** → `GovernanceModule.sol`의 미완성 기능(quorum) 수정 + 확장

**다음 단계**: v17 계획서(`v17-superpower-agent-system-plan.md`)의 Section 9.2(API 설계)와 Section 9.4(인증)를 이 보고서의 권한 매트릭스로 업데이트.
