# PLAN: $AWW 토큰 게임 통합 (Phase 0-2) — v3

> v30 — $AWW 토큰을 AI World War 게임에 실질적으로 연동하는 기획
> 작성일: 2026-03-09 | **개정일: 2026-03-09 (v3: 토큰 Sink + 100만 에이전트 시뮬레이션 추가)**
> 검증 보고서: `docs/designs/v30-verification-report.md` (67개 이슈 발견, 16 Critical)

## 1. 개요

$AWW 토큰이 CROSS Mainnet에 배포되었고 Forge Pool에서 거래가 시작되었다.
현재 게임 서버에는 BuybackEngine, DefenseOracle, TokenRewardManager가 **완전히 코딩**되어 있지만,
실제로 **아무것도 동작하지 않는** 상태다:

- `Queue*` 메서드를 호출하는 곳이 없어 보상 큐가 항상 비어있음
- `defenseOracle.Start()`가 호출되지 않아 가격 폴링이 안 됨
- BuybackEngine에 HTTP 엔드포인트가 없어 클라이언트가 데이터를 못 가져옴
- 클라이언트가 `token_reward` WebSocket 이벤트를 수신하지 않음
- 토큰 잔고가 전부 하드코딩 (프로필: 0, 거버넌스: 10000)
- **[검증 추가]** Ramp webhook에 HMAC 인증 없음 — 무제한 크레딧 위조 가능
- **[검증 추가]** CROSSx 지갑 콜백 핸들링 미구현 — 지갑 연결 불가능
- **[검증 추가]** BuybackEngine이 보상 금액을 GDP 세수로 오인하는 의미론 오류
- **[검증 추가]** 서버 재시작 시 모든 토큰 경제 데이터(바이백/보상/오라클) 소멸

**목표**: 보안 기반 확보 → 기존 dead code 활성화 → **토큰 Sink 메커니즘 도입** → 실시간 가격 연동으로 토큰 유틸리티 부여

**v3 추가**: 토큰을 "받기만" 하는 구조에서 **"쓰는 이유"가 있는 구조**로 전환.
5가지 Sink (거버넌스 소각, 전쟁 비용, 국가 부스트, 시즌 스테이킹, 주권 경매) 도입.

**배포 정보**:
- $AWW 토큰: `0xfD486ba056dFa2d8625a8bB74e4f207F70ab8CD7`
- Forge Pool: `https://x.crosstoken.io/forge/token/0xfD486ba056dFa2d8625a8bB74e4f207F70ab8CD7`
- CROSS Mainnet: chainId 8851
- Ramp Project ID: `c2c35439917404673b895bccc888902e`

## 2. 현재 상태 진단

### 서버 (Go) — 코드 완성, 미연결 + 버그

| 시스템 | 파일 | 상태 | 문제점 |
|--------|------|------|--------|
| TokenRewardManager | `game/token_rewards.go` | 완성 | `Queue*` 호출부 없음 (dead code), Hegemony/Sovereignty/War 보상에 계정 레벨 체크 누락 |
| BuybackEngine | `blockchain/buyback.go` | **버그** | HTTP 엔드포인트 없음, **세금 리셋 후 RPC 실패 시 자금 소실** (line 128), 보상 금액을 GDP 세수로 오인 |
| DefenseOracle | `blockchain/defense_oracle.go` | 완성 | `Start()` 미호출, **`RegisterCountry()` 호출부 없음**, 방어 버프 캡(30%)이 상위 티어 무의미화, shutdown 미처리 |
| Ramp Webhook | `blockchain/ramp/webhook.go` | **위험** | 인메모리 잔고, **HMAC 미구현**, 주문 중복 처리(idempotency 없음) |
| 30초 배포 루프 | `main.go:874-890` | 동작 중 | 큐가 비어서 할 일 없음, backpressure 없음 |
| Economy Engine | `meta/economy.go` | 설계결함 | 비주권 국가 GDP 영원히 0, 자원 분배 합계 >100%, sovereign share 80% 팩션 이중입금, GDP는 누적이 아닌 틱당 스냅샷 |

### 클라이언트 (Next.js) — UI 완성, 가짜 데이터 + 구조 결함

| 컴포넌트 | 파일 | 상태 | 문제점 |
|----------|------|------|--------|
| BuybackBurnHistory | `economy/tokens/components.tsx` | 완성 | 빈 배열 하드코딩 |
| WalletConnectButton | `components/blockchain/` | **미완성** | mock 모드만 동작, **CROSSx 콜백 핸들러 없음** (연결 영원히 불가), connecting 상태 해제 안 됨 |
| StakingPanel | `components/blockchain/` | **No-op** | CountryPanel에서 import되나 전체 플로우가 무동작 (API 호출 없음, 콜백 미전달), **treasury 주소가 null address** |
| CountryTokenInfo | `components/blockchain/` | 완성 | GDP 기반 가짜 데이터, defenseMultiplier 단위 혼동 |
| TokenBalanceList | `components/blockchain/` | 완성 | 잔고 전부 "0", 온체인 balanceOf 조회 없음 |
| VoteInterface | `components/governance/` | **위험** | `userTokenBalance=10000` 하드코딩 ×2곳, 인증 없이 아무나 투표 |
| 토큰 대시보드 | `economy/tokens/page.tsx` | 완성 | GDP=Market Cap 직접 매핑, staking ratio 임의 공식, TIER 상수 서버와 불일치 가능 |
| 지갑 상태 | `profile/page.tsx` 등 | **결함** | 지갑 상태가 페이지별 로컬 useState — 네비게이션 시 소멸, 글로벌 Context 없음 |
| 프로필 | `profile/page.tsx` | **결함** | playerId `'local-user'` 하드코딩, 보상 이력 섹션 없음 |

### 미구현 연결부 (확장)

| 서버 → 클라이언트 | 상태 |
|-------------------|------|
| WS `token_reward` 이벤트 | 서버 발송 O, **클라이언트 수신 X** |
| WS `get_token_rewards` 요청 | 서버 핸들러 O, **클라이언트 호출 X** |
| REST `GET /api/v14/rewards/{id}` | 서버 라우트 O (인증 없음), **클라이언트 fetch X** |
| BuybackEngine 데이터 | 서버 메서드 O, **HTTP 라우트 X, 클라이언트 X** |
| DefenseOracle 데이터 | 서버 메서드 O, **HTTP 라우트 X, 클라이언트 X** |
| Forge Pool $AWW 가격 | **아무것도 없음** |
| **[검증 추가]** 플레이어-지갑 연결 | **아무것도 없음** (gameID ↔ walletAddress 매핑 없음) |
| **[검증 추가]** 거버넌스 인증 | 투표/제안 API에 Bearer 토큰 전송 안 됨 |
| **[검증 추가]** 소켓 재연결 시 토큰 상태 복구 | 미구현 (보상 알림 유실) |

### 블록체인/스마트 컨트랙트 현황

| 컨트랙트 | 상태 | 문제점 |
|----------|------|--------|
| AWWToken.sol | **배포 완료** (0xfD48...) | — |
| NationalToken.sol | 미배포 | C/D 티어 배포 스크립트 누락 |
| NationalTokenFactory.sol | 미배포 | forge 의존성 미설치 (`contracts/lib/` 비어있음) |
| NationalTreasury.sol | 미배포 | **ReentrancyGuard 없음**, mint 무제한 (인플레 캡 없음) |
| DefenseOracle.sol | 미배포 | Go 오라클과 circuit breaker 임계값 불일치 (30% vs 50%) |
| GovernanceModule.sol | 미배포 | `transfer()` 사용 — `safeTransfer()` 필요 |
| 배포 스크립트 | 작성됨 | Foundry 의존성 미설치, Batch2 스크립트 누락 |
| **`.env` 파일** | .gitignore 적용 | Git 추적 안 됨 (확인 완료). `.env.example`만 추적 중 |

## 3. 기술 방향

- **블록체인**: CROSS Mainnet (chainId 8851), $AWW ERC20 토큰
- **가격 피드**: Forge Pool API 직접 호출 → 실패 시 GDP 기반 시뮬레이션 가격 폴백
- **지갑 연동**: CROSSx Deep Linking (`crossx://` 스킴) — **콜백 핸들러 미구현, Phase 0에서 수정**
- **지갑 상태**: **글로벌 WalletProvider (zustand) 신규 구현** — 앱 전체 공유
- **인증**: Phase 1-2에서는 서버 내 세션 기반 playerID, Phase 3+에서 지갑 기반 인증
- **데이터 영속성**: Phase 1에서 인메모리 (서버 재시작 시 소멸 감수), Phase 2에서 Supabase 연동
- **서버**: Go (기존 meta/blockchain 패키지 활용)
- **클라이언트**: Next.js 15 + TypeScript (기존 컴포넌트 활용)
- **핵심 원칙**: **보안 먼저** → dead code 활성화 → 실시간 연동

## 4. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                        CROSS Mainnet                            │
│  $AWW Token ─── Forge Pool ─── Explorer                        │
│  (0xfD48...)     (가격/거래)     (TX 조회)                       │
└───────┬────────────┬────────────────────────────────────────────┘
        │            │
        │ JSON-RPC   │ HTTP (가격 API)
        │ (optional) │ (Forge 가격 폴링)
        │            │
┌───────┴────────────┴────────────────────────────────────────────┐
│                      Go 서버 (Railway)                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐         │
│  │ TokenReward  │  │ Buyback      │  │ Defense       │         │
│  │ Manager      │  │ Engine       │  │ Oracle        │         │
│  │ (보상 큐잉)  │  │ (GDP세수→매수)│  │ (가격→버프)   │         │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘         │
│         │                 │                   │                 │
│  ┌──────┴─────────────────┴───────────────────┴───────┐        │
│  │         REST + WebSocket + HMAC Auth                │        │
│  │ /api/rewards/*  /api/buyback/*  /api/defense/*      │        │
│  │ /api/ramp/* (HMAC)  /api/token/price                │        │
│  │ WS: token_reward, token_rewards_update              │        │
│  └─────────────────────┬───────────────────────────────┘        │
└────────────────────────┼────────────────────────────────────────┘
                         │
                    HTTPS / WSS
                         │
┌────────────────────────┼────────────────────────────────────────┐
│               Next.js 클라이언트 (Vercel)                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐        │
│  │        WalletProvider (zustand — 글로벌 상태)        │        │
│  │  address | chainId | balance | connect/disconnect    │        │
│  └──────┬──────────────┬────────────────┬──────────────┘        │
│         │              │                │                       │
│  ┌──────┴───────┐ ┌────┴────────┐ ┌────┴─────────┐            │
│  │ 토큰 대시보드│ │ 보상 알림   │ │ 프로필       │            │
│  │ (실시간 가격)│ │ (WS 수신)  │ │ (잔고/보상)  │            │
│  └──────────────┘ └─────────────┘ └──────────────┘            │
│         │              │                │                       │
│  ┌──────┴───────┐ ┌────┴────────┐ ┌────┴─────────┐            │
│  │ Forge Pool   │ │ Buyback/Burn│ │ Defense Buff │            │
│  │ 가격 위젯   │ │ 히스토리    │ │ 시각화       │            │
│  └──────────────┘ └─────────────┘ └──────────────┘            │
│                                                                 │
│  ┌──────────────────────────────────────┐                      │
│  │ 거버넌스 (서버 잔고 조회 → 투표 가중) │                      │
│  └──────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

**데이터 흐름 (v3 Flywheel — Sink 포함)**:
```
[Earn] 전투 승리/경제 틱 → TokenRewardManager 큐잉 → 30초마다 분배 → WS 알림
[Buyback] Economy Tick GDP → BuybackEngine: GDP 세수 5% → $AWW 시뮬 매수 (※ 보상 금액 아님!)
[Price] Forge Pool 가격 (5분 폴링) → DefenseOracle → 방어력 버프 업데이트
[Sink 1] 거버넌스 투표 → 투표 토큰 10% 소각 + 가중 투표
[Sink 2] 전쟁 선포 → $AWW 500~2000 소각 → 전쟁 개시
[Sink 3] GDP 부스트 → $AWW 50% 소각 + 50% treasury 락 → 1시간 GDP 부스트
[Sink 4] 시즌 스테이킹 → $AWW 시즌 락업 → 보상 배수 1.25~2.5x
[Sink 5] 주권 경매 → $AWW 80% 소각 + 20% treasury → 즉시 주권 획득
```

> **⚠️ 이전 기획 오류 수정**: BuybackEngine의 입력은 "보상 금액"이 아니라 "경제 틱 GDP 세수"여야 한다.
> `DistributePendingRewards`에서 BuybackEngine을 호출하는 것이 아니라, `processCountryTick`에서 GDP 기반으로 직접 호출해야 한다.

## 5. 리스크

| # | 리스크 | 심각도 | 영향 | 완화 전략 |
|---|--------|--------|------|----------|
| R1 | **Ramp webhook 무인증** | 🚨 Critical | 무제한 크레딧 위조 가능 | **Phase 0-1**: HMAC-SHA256 서명 검증 구현 |
| R2 | **NationalTreasury 재진입 취약점** | 🚨 Critical | 스테이킹 자금 탈취 가능 | **배포 전**: ReentrancyGuard 추가 |
| R4 | Forge Pool API 공식 문서 없음 | ⚠️ High | 가격 피드 불가 | GDP 기반 시뮬레이션 가격을 기본 모드로. Forge는 optional 보너스 |
| R5 | `CROSS_RPC_URL` 미설정 시 | ⚠️ High | 바이백/오라클 시뮬만 동작 | 시뮬레이션 모드를 "공식 기본 모드"로. RPC는 선택적 강화 |
| R6 | 국가 토큰 미배포 (195개) | Medium | 국가별 보상 실제 전송 불가 | Phase 1-2에서는 "포인트" 서버 내 추적, 추후 토큰화 |
| R7 | **서버 재시작 시 토큰 데이터 전부 소멸** | ⚠️ High | 바이백/보상/오라클 히스토리 초기화 | Phase 2-10: Supabase 영속화 (최소 보상 이력) |
| R8 | Queue* 연결 시 보상 인플레이션 | Medium | 과도한 토큰 발행 | Phase 1-1: 계정 레벨 체크 + Phase 1-11: 큐 상한(1000) + 일일 캡 |
| R9 | **BuybackEngine 의미론 오류** | ⚠️ High | 경제 모델 왜곡 | Phase 1-10: 호출 경로 수정 (보상→GDP 세수) |
| R10 | float64로 토큰 금액 처리 | Medium | 장기적 정밀도 손실 | Phase 3+에서 big.Int 또는 decimal 전환 |
| R11 | **CROSSx 콜백 미구현** | ⚠️ High | 지갑 연결 물리적 불가 | Phase 0-5: 콜백 핸들러 또는 mock 포인트 시스템 공식화 |
| R12 | 컨트랙트 단일 EOA 소유 | Medium | 키 분실 시 컨트랙트 제어 불가 | Phase 3+에서 멀티시그 전환 |
| R13 | **Sink 과도 → 디플레이션 과다** | Medium | 신규 유저 진입 장벽 | 전쟁/부스트 비용 동적 조정 (GDP 연동), 시즌별 파라미터 튜닝 |
| R14 | 주권 경매 담합/과점 | Medium | 상위 팩션이 모든 국가 독점 | 팩션당 동시 경매 참여 3국 제한, 보유 국가 수에 따른 입찰 가중 |
| R15 | 전쟁 비용이 소규모 팩션에 불공정 | ⚠️ High | 자본력 있는 팩션만 전쟁 가능 | 팩션 규모별 차등 비용 (소팩션 50% 할인), 방어 전쟁은 무료 유지 |

## 6. 토큰 Sink 메커니즘 — "왜 $AWW를 사야 하는가"

### 문제 진단

현재 기획(v2까지)은 토큰을 **받는 방법**만 존재하고 **쓰는 방법**이 없습니다.
이 구조에서는 보상 수령 → 즉시 매도 → 가격 하락 → 보상 가치 감소의 악순환이 발생합니다.

### Sink 1: 거버넌스 투표 소각 (Phase 2)

투표 시 사용한 토큰의 **10%가 영구 소각**됩니다.

```
투표 가중치 = sqrt(사용 토큰)  (기존 quadratic voting 유지)
소각량 = 사용 토큰 × 0.10
반환량 = 사용 토큰 × 0.90 (투표 종료 후)

예시: 1000 $AWW 투표 → 가중치 31.6, 100 $AWW 소각, 900 반환
```

**효과**: 거버넌스 참여가 활발할수록 공급 감소. 중요한 안건일수록 더 많은 토큰 소각.

### Sink 2: 전쟁 선포 $AWW 비용 (Phase 1)

기존 전쟁 선포 비용(300 Influence + 500 Oil)에 **$AWW 소각 비용** 추가.

```
소규모 전쟁 (1국 vs 1국):   500 $AWW 소각
대규모 전쟁 (다국적 연합):  2,000 $AWW 소각
경제 전쟁 (무역 봉쇄):      1,000 $AWW 소각
```

**효과**: 무분별한 전쟁 방지 + 전략적 자원 관리. 전쟁 빈도에 비례하여 토큰 소각.

### Sink 3: 국가 GDP 부스트 (Phase 2)

$AWW를 특정 국가에 **투입**하면 일시적 GDP 부스트 효과.

```
투입량 → GDP 부스트 (1시간 지속):
  100 $AWW  → +5% GDP
  500 $AWW  → +15% GDP
  1000 $AWW → +25% GDP (상한)

투입된 토큰: 50% 소각 + 50% 해당 국가 treasury 락
쿨다운: 국가당 4시간
```

**효과**: 팩션 전략의 핵심 — "전쟁 전에 핵심 국가 GDP 올려서 방어력 강화". 토큰에 직접적 게임 유틸리티 부여.

### Sink 4: 시즌 보상 스테이킹 배수 (Phase 2)

$AWW 스테이킹 양에 비례하여 **시즌 종료 보상 배수** 증가.

```
스테이킹 티어 → 보상 배수:
  0 $AWW           → 1.0x (기본)
  500 $AWW         → 1.25x
  2,000 $AWW       → 1.5x
  5,000 $AWW       → 2.0x
  10,000+ $AWW     → 2.5x (상한)

시즌 락업: 스테이킹 후 시즌 종료까지 출금 불가
조기 출금 패널티: 스테이킹 금액의 20% 소각
```

**효과**: 대량 매도 압력 흡수 (시즌 4주 동안 락업). 장기 보유 인센티브.

### Sink 5: 비주권 국가 주권 경매 (Phase 2)

171개 비주권 국가의 **주권을 $AWW 경매**로 획득.

```
경매 메커니즘:
  - 48시간 영국식 경매 (ascending bid)
  - 최소 입찰: 국가 티어별 — S: 10,000 / A: 5,000 / B: 2,000 / C: 500 / D: 200 $AWW
  - 입찰 증분: 이전 입찰의 10% 이상
  - 낙찰 토큰: 80% 소각 + 20% Protocol Treasury

낙찰 효과:
  - 팩션이 해당 국가 주권 즉시 획득 (Sovereignty Level 1)
  - 24시간 domination 없이 직접 획득하는 "지름길"
  - 기존 domination 경로도 유지 (무료 but 시간 소모)
```

**효과**: 영토 확장의 "프리미엄 경로". 경쟁적 입찰이 가격을 발견하며 대량 소각 유도.

### Flywheel 완성

```
┌──────────────────────────────────────────────────────────────────┐
│                    완성된 $AWW Flywheel                           │
│                                                                    │
│   게임 플레이 ──→ 토큰 보상 (Earn)                                │
│        ↑              ↓                                           │
│        │     ┌── 전략적 소비 (Spend) ──┐                          │
│        │     │ • 전쟁 선포 비용         │                          │
│        │     │ • 국가 GDP 부스트        │                          │
│        │     │ • 거버넌스 투표          │                          │
│        │     │ • 주권 경매              │                          │
│        │     └──────────┬──────────────┘                          │
│        │                ↓                                          │
│        │        토큰 소각 (Burn)                                   │
│        │         + 시즌 락업                                       │
│        │                ↓                                          │
│        │         공급 감소                                         │
│        │                ↓                                          │
│        │     바이백 (GDP 세수 5%)                                  │
│        │                ↓                                          │
│        │        가격 상승 압력                                     │
│        │                ↓                                          │
│        └──── 보상 가치 증가 ← 플레이어 유입 ← 토큰 가치 인식     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. 100만 에이전트 경제 시뮬레이션

### 시뮬레이션 전제

| 파라미터 | 값 | 근거 |
|----------|-----|------|
| 에이전트 수 | 1,000,000 | 목표 MAU |
| 동시 접속 (DAU) | 200,000 (20%) | 일반 게임 DAU/MAU 비율 |
| 평균 세션 | 2시간/일 | 모바일 게임 평균 |
| 팩션 수 | ~50 활성 팩션 | 현재 설계 |
| 주권 국가 | 195개 중 ~80개 점령 | 초기 시뮬 |
| 시즌 길이 | 4주 (28일) | 기존 설계 |
| $AWW 총 공급 | 1,000,000,000 | 배포 완료 |
| 에코시스템 배분 (유통) | 400,000,000 (40%) | P2E + 스테이킹 |

### A. 토큰 발행 (Emission) — 시즌 1개 (28일)

#### 1) Domination 보상 (주요 소스)

```
평가 주기: 6에포크 = 1시간마다
1일 평가: 24회
28일 평가: 672회

DAU 200,000명 × 평균 세션 2시간 = 400,000 player-hours/일
평가 1회당 활성 플레이어: ~33,333명 (200K / 6 시간대 분산)

평균 NationScore/평가: 50점 (kills 2회 + assists 1회 + level 3 + survival 5분)
평가당 보상: 50 × 0.01 = 0.5 토큰/인 (국가 토큰)
Defense Oracle 감쇠: × 0.85 (평균 15% 감소)

일일 Domination 발행:
  33,333명 × 0.5 × 0.85 × 24회 = 340,000 국가 토큰/일

28일 시즌: ~9,520,000 국가 토큰
```

#### 2) Sovereignty 보상

```
주권 보유자: ~80국 × 1명 = 80명
일일: 80 × 5.0 = 400 국가 토큰/일
28일: 11,200 국가 토큰 (무시할 수준)
```

#### 3) Hegemony AWW 보상 (마스터 토큰)

```
Hegemony 국가: ~20개 (7일 연속 주권 유지)
주당 AWW 발행: 20국 × (100/50명 + 10) × 50명 = 12,000 $AWW/주
28일: ~48,000 $AWW
```

#### 4) War Victory 보상

```
전쟁 빈도: 주당 ~100건 (50 팩션 × 주 2회 공격)
전쟁당 참여자: ~500명 (승리 팩션)
평균 warScore: 100점 → 보상 2.0 토큰/인

주당: 100 × 500 × 2.0 = 100,000 국가 토큰
28일: ~400,000 국가 토큰
```

#### 시즌 총 발행량 요약

| 보상 유형 | 28일 발행량 | 토큰 종류 |
|-----------|------------|-----------|
| Domination | 9,520,000 | 국가 토큰 |
| War Victory | 400,000 | 국가 토큰 |
| Sovereignty | 11,200 | 국가 토큰 |
| Hegemony | 48,000 | **$AWW** |
| **총 국가 토큰** | **~9,931,200** | 195국 분산 |
| **총 $AWW** | **~48,000** | 마스터 토큰 |

### B. 토큰 소각/소비 (Sink) — 시즌 1개 (28일)

#### Sink 1: 거버넌스 투표 소각

```
활성 거버넌스 참여자: DAU의 5% = 10,000명
주당 안건: ~20건 (195국 중 활성 80국)
안건당 평균 투표 토큰: 100 $AWW

주당 소각: 20건 × 10,000명 × 100 × 0.10 소각율 = ...
→ 현실적 수정: 안건당 투표자 200명, 인당 평균 50 $AWW
→ 주당: 20 × 200 × 50 × 0.10 = 20,000 $AWW
28일: ~80,000 $AWW
```

#### Sink 2: 전쟁 선포 비용

```
전쟁 빈도: 주당 ~100건
평균 비용: (500 × 0.7 + 2000 × 0.2 + 1000 × 0.1) / 1 = 850 $AWW

주당: 100 × 850 = 85,000 $AWW
28일: ~340,000 $AWW
```

#### Sink 3: 국가 GDP 부스트

```
부스트 사용: 전쟁 전 핵심 국가에 집중
주당 부스트 횟수: ~200회 (전쟁 100건 × 양측 주요 국가)
평균 투입: 300 $AWW/회 (50% 소각 = 150)

주당 소각: 200 × 150 = 30,000 $AWW
28일: ~120,000 $AWW
```

#### Sink 4: 시즌 스테이킹

```
스테이킹 참여자: MAU의 10% = 100,000명
평균 스테이킹: 500 $AWW

총 락업: 100,000 × 500 = 50,000,000 $AWW (유통량의 12.5%)
조기 출금 (10% 이탈): 10,000 × 500 × 0.20 = 1,000,000 $AWW 소각
시즌 종료 정상 출금: 잔여 45,000,000 $AWW 반환
```

#### Sink 5: 주권 경매

```
비주권 국가 경매: 28일 동안 ~30국 경매 (171국 중)
평균 낙찰가 (티어 가중): 1,500 $AWW

총 경매 수입: 30 × 1,500 = 45,000 $AWW
소각 (80%): 36,000 $AWW
```

#### 시즌 총 소각/락업 요약

| Sink | 28일 소각량 ($AWW) | 유형 |
|------|-------------------|------|
| 거버넌스 투표 | 80,000 | 영구 소각 |
| 전쟁 선포 | 340,000 | 영구 소각 |
| GDP 부스트 | 120,000 | 50% 소각 + 50% 락 |
| 스테이킹 조기 출금 | 1,000,000 | 영구 소각 |
| 주권 경매 | 36,000 | 80% 소각 |
| **시즌 총 영구 소각** | **~1,576,000 $AWW** | |
| **시즌 락업 (일시)** | **~50,000,000 $AWW** | 시즌 종료 시 반환 |

### C. 바이백 압력 — GDP 세수

```
주권 국가 80개 평균 GDP:
  S티어(8국): GDP ~500,000,000 gold
  A티어(15국): GDP ~200,000,000
  B티어(25국): GDP ~50,000,000
  C티어(25국): GDP ~10,000,000
  D티어(7국): GDP ~2,000,000

총 세계 GDP: ~12,000,000,000 gold/틱 (추정)
바이백 세수: 12B × 5% = 600,000,000 gold/틱
시뮬 환산: 600M gold / 100 = 6,000,000 토큰 equiv/틱

일일: 6M × 24틱 = 144,000,000 토큰 등가 바이백 압력
28일: ~4,032,000,000 토큰 등가
```

> **참고**: 이 수치는 시뮬레이션 모드(1:100 비율) 기반입니다. 실제 Forge DEX 가격과 연동되면 실제 달러 가치로 전환됩니다.

### D. 전쟁 번 (Treasury 소각)

```
전쟁 패배 시 treasury 1% 소각
월 전쟁 400건 × 50% 패배 = 200건
평균 treasury: 5,000,000 국가 토큰

월 번: 200 × 5M × 0.01 = 10,000,000 국가 토큰 소각
```

### E. 경제 균형 요약 (28일 시즌)

```
┌─────────────────────────────────────────────────────────────┐
│                   시즌 토큰 흐름 요약                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  📈 발행 (Emission)                                           │
│     $AWW:        48,000/시즌                                  │
│     국가 토큰:   9,931,200/시즌                                │
│                                                               │
│  🔥 소각 (Burn)                                               │
│     $AWW:        1,576,000/시즌 (Sink 1-5 합계)               │
│     국가 토큰:   10,000,000/시즌 (전쟁 번)                     │
│                                                               │
│  🔒 락업 (Lock)                                               │
│     $AWW:        50,000,000/시즌 (스테이킹)                    │
│                                                               │
│  💰 바이백 (Buy Pressure)                                     │
│     GDP 세수 5%: 월 ~4B gold equiv                            │
│                                                               │
│  📊 순 흐름                                                    │
│     $AWW: 발행 48K - 소각 1.58M = ▼ -1,528,000 (디플레이션!) │
│     국가: 발행 9.9M - 번 10M = ▼ -68,800 (약 균형)           │
│                                                               │
│  ⭐ 핵심 인사이트                                              │
│     Sink가 Emission의 33배 → 강한 디플레이션 압력              │
│     → 토큰 구매 수요가 보상만으로는 충족 불가                   │
│     → Forge Pool/Ramp에서 구매 동기 발생                       │
│     → 유통량의 12.5%가 시즌 동안 락업                          │
└─────────────────────────────────────────────────────────────┘
```

### F. 100만 에이전트 시나리오에서 $AWW 구매 이득

| 구매자 유형 | 동기 | 예상 수요 (시즌당) |
|------------|------|-------------------|
| **팩션 리더** | 전쟁 선포 + 주권 경매 + GDP 부스트 | 50 팩션 × ~10,000 $AWW = 500,000 |
| **거버넌스 참여자** | 투표 가중치 확보 (소각 감수) | 10,000명 × ~200 $AWW = 2,000,000 |
| **보상 배수 추구자** | 시즌 스테이킹 2.5배 배수 | 100,000명 × ~500 $AWW = 50,000,000 |
| **투기 트레이더** | 디플레이션 + 바이백 가격 상승 기대 | 변동 |
| **영토 확장** | 주권 경매 입찰 경쟁 | 30국 × ~1,500 $AWW = 45,000 |
| **총 예상 구매 수요** | | **~52,545,000 $AWW/시즌** |

**결론**: 100만 에이전트 환경에서 시즌당 **약 5,250만 $AWW의 구매 수요**가 발생하며,
이는 에코시스템 배분(4억)의 약 13%에 해당합니다.
10시즌(~10개월) 이내에 에코시스템 배분의 상당 부분이 소각/락업될 수 있습니다.

---

## 구현 로드맵

### Phase 0: 보안 + 인프라 기반 — "기획 실행 전 필수"

> ⚠️ **블로커**: 이 Phase를 완료하지 않으면 Phase 1-2를 실행해도 보안 사고 위험.

| Task | 설명 | 수정 파일 |
|------|------|-----------|
| 0-1. Ramp HMAC 인증 | Ramp webhook 핸들러에 HMAC-SHA256 서명 검증 추가. `X-Ramp-Signature` 헤더 → `hmac.Equal()` 비교. 실패 시 403 반환 | `server/internal/blockchain/ramp/webhook.go` |
| 0-2. Ramp 주문 idempotency | OrderID 기반 중복 처리 방지. 처리된 OrderID를 맵에 기록, 재전송 시 200+기존결과 반환 | `server/internal/blockchain/ramp/webhook.go` |
| 0-3. 글로벌 WalletProvider | zustand 기반 지갑 상태 스토어 생성. `address`, `chainId`, `isConnected`, `connect()`, `disconnect()`. localStorage 영속화. 앱 전체 공유 | `apps/web/stores/wallet-store.ts` (신규), `apps/web/app/layout.tsx` |
| 0-4. 지갑 연결 수정 | WalletConnectButton: (A) CROSSx 콜백 URL 핸들링 구현 또는 (B) mock 포인트 시스템을 공식 모드로 전환. `connecting` 상태 타임아웃(5s) + 언마운트 클린업 | `apps/web/components/blockchain/WalletConnectButton.tsx`, `apps/web/stores/wallet-store.ts` |
| 0-5. DefenseOracle RegisterCountry | main.go에서 195개국 일괄 `RegisterCountry()` 호출 추가. oracle Start() 전에 실행 | `server/cmd/server/main.go` |
| 0-6. BuybackEngine 세금 리셋 버그 수정 | `AccumulatedTax = 0`을 RPC 호출 성공 확인 후로 이동. 실패 시 세금 보존 | `server/internal/blockchain/buyback.go` |

- **design**: N
- **verify**: `/api/ramp/order-result` 미인증 요청 시 403, 동일 OrderID 재전송 시 중복 처리 안 됨, 지갑 연결 후 페이지 이동해도 상태 유지, RegisterCountry 호출 로그 확인, BuybackEngine 세금 리셋이 성공 후에만 동작

---

### Phase 1: 기존 코드 활성화 — "Dead Code를 살려라"

> 새 코드 최소화. 이미 작성된 시스템들을 연결만 해서 동작시킨다.
> **[검증 반영]** BuybackEngine 호출 경로 수정, 계정 레벨 체크, 큐 상한 추가.

| Task | 설명 | 수정 파일 |
|------|------|-----------|
| 1-1. 보상 큐 연결 | 게임 이벤트에서 TokenRewardManager의 `Queue*` 호출 추가. Domination: epoch 종료 시, Sovereignty: 경제 틱 시, WarVictory: 전쟁 종료 시. **모든 Queue* 호출에 `MinAccountLevelForTokens` 체크 추가** (기존 Domination만 체크 → 4종 전부) | `server/cmd/server/main.go`, `server/internal/meta/season.go`, `server/internal/meta/war.go`, `server/internal/game/token_rewards.go` |
| 1-2. DefenseOracle 시작 + 생명주기 | `defenseOracle.Start(ctx)` 호출을 errgroup에 통합. **shutdown 시 `defenseOracle.Stop()` 호출 추가**. `CROSS_RPC_URL` 없으면 시뮬레이션 모드 | `server/cmd/server/main.go` |
| 1-3. DefenseOracle 시뮬레이션 | RPC 없을 때 GDP 기반 방어력 계산 폴백. GDP → 가상 시장가치 → defenseTier 매핑. **방어 버프 캡 30% → 티어 테이블과 일치하도록 상향 조정 (또는 티어 테이블 축소)** | `server/internal/blockchain/defense_oracle.go` |
| 1-4. 바이백/번 HTTP 엔드포인트 | BuybackEngine의 GetBuybackHistory, GetBurnHistory, GetStats + DefenseOracle의 GetAllStates, GetStats를 REST로 노출. **최소한 playerId 파라미터 검증 미들웨어 추가** | `server/cmd/server/router.go`, `server/internal/blockchain/buyback.go` |
| 1-5. 보상 → 전투 버프 연결 | `ApplyDefenseOracleToRewards()` 실제 호출 연결 (DistributePendingRewards 내부) | `server/internal/game/token_rewards.go` |
| 1-6. WS token_reward 클라이언트 핸들러 | `useSocket.ts`에 `token_reward`, `token_rewards_update` 이벤트 수신 추가. **GameData/UiState 인터페이스에 tokenRewards 필드 추가. 소켓 재연결 시 `get_token_rewards` 요청으로 미수신분 복구** | `apps/web/hooks/useSocket.ts` |
| 1-7. 보상 알림 토스트 UI | 토큰 보상 수신 시 화면 하단 토스트 알림 ("+5.0 $KOR tokens"). 글로벌 WalletProvider 활용 | `apps/web/components/game/TokenRewardToast.tsx` (신규), `apps/web/app/(hub)/layout.tsx` |
| 1-8. api-client 보상/바이백 함수 + 타입 | `fetchRewards()`, `fetchBuybackHistory()`, `fetchBurnHistory()`, `fetchDefenseMultipliers()` 추가. **TokenReward, BuybackEntry, BurnEntry, DefenseMultiplierData TypeScript 인터페이스 정의** | `apps/web/lib/api-client.ts` |
| 1-9. BuybackBurnHistory 실데이터 연결 | 하드코딩 빈 배열 → fetchBuybackHistory/fetchBurnHistory 호출로 교체 | `apps/web/app/(hub)/economy/tokens/page.tsx` |
| 1-10. BuybackEngine 호출 경로 수정 (**신규**) | **BuybackEngine.ProcessEconomicTick 호출을 DistributePendingRewards에서 제거 → economy.go의 processCountryTick에서 GDP 기반으로 직접 호출**. 보상 금액이 아닌 실제 GDP 세수가 바이백 입력이 되도록 수정 | `server/internal/game/token_rewards.go`, `server/internal/meta/economy.go`, `server/cmd/server/main.go` |
| 1-11. 보상 큐 상한 + backpressure (**신규**) | pendingRewards 슬라이스 상한 1000개 설정. 초과 시 가장 오래된 보상부터 드롭 + 경고 로그. 일일 플레이어당 보상 캡 설정 | `server/internal/game/token_rewards.go` |
| 1-12. 전쟁 선포 $AWW 비용 (**v3 Sink**) | 전쟁 선포 시 $AWW 포인트 소각 비용 추가. 소규모 500, 대규모 2000, 경제전쟁 1000. 기존 Influence+Oil 비용에 추가. 잔고 부족 시 선포 불가. 소각된 토큰은 totalBurned에 기록 | `server/internal/meta/war.go`, `server/internal/game/token_rewards.go` |

- **design**: N (기존 UI 활용, 토스트만 신규)
- **verify**: 서버 빌드 성공, 전투 종료 시 `token_reward` WS 이벤트 수신 확인, `/api/buyback/history` 200 응답, 토큰 대시보드 BuybackBurnHistory 패널에 데이터 표시, 소켓 재연결 후 보상 상태 복구 확인, processCountryTick에서 BuybackEngine 호출 확인, 전쟁 선포 시 $AWW 잔고 차감 및 소각 기록 확인

---

### Phase 2: 가격 연동 + 대시보드 실시간화 + 거버넌스 연결

> $AWW의 실시간 가격을 게임 전반에 반영. 토큰 보유의 실질적 가치를 체감시킨다.
> **[검증 반영]** 거버넌스 하드코딩 제거, 지갑 게이트, 비주권 GDP dirty 마킹, Forge 폴백.

| Task | 설명 | 수정 파일 |
|------|------|-----------|
| 2-1. Forge 가격 피드 서버 | Forge Pool에서 $AWW 가격을 5분 폴링. REST 엔드포인트 `GET /api/token/price`. **Forge API 미존재 시 폴백: GDP 기반 시뮬레이션 가격 (Forge 의존 제거)** | `server/internal/blockchain/forge_price.go` (신규), `server/cmd/server/router.go` |
| 2-2. DefenseOracle Forge 연동 | Forge 가격을 DefenseOracle에 피드. RPC 없이도 동작. 시뮬 가격 폴백 자동 전환 | `server/internal/blockchain/defense_oracle.go`, `server/internal/blockchain/forge_price.go` |
| 2-3. 토큰 가격 위젯 | 대시보드 상단에 $AWW 실시간 가격 + 24h 변동 + Forge Pool 링크. 가격 불가 시 "Price unavailable" 표시 | `apps/web/app/(hub)/economy/tokens/page.tsx`, `apps/web/lib/api-client.ts` |
| 2-4. Market Cap 실데이터 전환 | GDP 직접매핑 → `GDP × $AWW가격` 기반 시가총액. 가격 미존재 시 기존 GDP 매핑 유지 | `apps/web/app/(hub)/economy/tokens/page.tsx` |
| 2-5. Defense Buff 실시간 반영 | DefenseBuffVisualization을 서버 DefenseOracle 데이터로 교체. **범례를 실제 캡과 일치하도록 수정** | `apps/web/app/economy/tokens/components.tsx`, `apps/web/lib/api-client.ts` |
| 2-6. 프로필 보상 이력 | 프로필 페이지에 토큰 보상 이력 섹션 추가. **playerId를 세션 기반으로 해결 (0-4의 WalletProvider에서 address 또는 서버 할당 ID 사용)** | `apps/web/app/(hub)/profile/page.tsx` |
| 2-7. 보상 이력 REST API 연결 | `GET /api/v14/rewards/{playerId}` 호출. 프로필 + 인게임 HUD에서 누적 보상 표시 | `apps/web/lib/api-client.ts`, `apps/web/app/(hub)/profile/page.tsx` |
| 2-8. 바이백 시뮬레이션 강화 | BuybackEngine 시뮬레이션에 Forge 가격 반영. 1 gold = price × 100 tokens 대신 실제/시뮬 가격 기반 | `server/internal/blockchain/buyback.go` |
| 2-9. Economy Tick → 비주권 GDP + dirty 마킹 | 비주권 국가에 기본 GDP 부여 + **`dirtyCountries` 마킹도 추가 (DB 저장 누락 방지)** | `server/internal/meta/economy.go` |
| 2-10. 데이터 영속화 (Supabase) | Ramp 잔고 + 보상 이력을 Supabase에 저장. 서버 재시작 시 복구 | `server/internal/blockchain/ramp/webhook.go`, `server/internal/game/token_rewards.go` |
| 2-11. 거버넌스 토큰 잔고 연결 (**신규**) | `userTokenBalance=10000` 하드코딩 제거. 서버 포인트 잔고 API 조회 또는 WalletProvider 지갑 주소 기반 조회. **투표/제안 API에 인증 추가** | `apps/web/app/(hub)/governance/page.tsx`, `apps/web/components/world/CountryPanel.tsx`, `apps/web/lib/api-client.ts`, `server/cmd/server/router.go` |
| 2-12. CountryPanel TOKEN 탭 지갑 게이트 (**신규**) | 지갑 미연결 시 Stake/Unstake 버튼 대신 "Connect Wallet" 표시. StakingPanel에 null address 대신 실제 treasury 주소(또는 placeholder) 전달 | `apps/web/components/world/CountryPanel.tsx`, `apps/web/components/blockchain/StakingPanel.tsx` |
| 2-13. 환경변수 정리 배포 | Railway에 Forge API URL 또는 `CROSS_RPC_URL` 설정. Vercel 환경 정합성 확인 | Railway/Vercel 설정 |
| 2-14. 거버넌스 투표 소각 (**v3 Sink**) | 투표 시 사용 토큰의 10% 영구 소각. `postCouncilVote`에 소각 로직 추가. 서버: 투표 처리 시 `tokensUsed * 0.10` 차감 → BurnHistory 기록. 클라이언트: 투표 확인 모달에 "10% 소각" 안내 표시 | `server/cmd/server/router.go`, `apps/web/components/governance/VoteInterface.tsx` |
| 2-15. 국가 GDP 부스트 (**v3 Sink**) | `POST /api/country/{iso}/boost` — $AWW 포인트를 투입하여 1시간 GDP 부스트. 100→+5%, 500→+15%, 1000→+25%(상한). 50% 소각 + 50% treasury 락. 국가당 4시간 쿨다운. 부스트 상태를 economy tick에서 적용 | `server/internal/meta/economy.go`, `server/cmd/server/router.go`, `apps/web/components/world/CountryPanel.tsx` |
| 2-16. 시즌 보상 스테이킹 (**v3 Sink**) | $AWW 포인트 스테이킹 → 시즌 보상 배수. 500→1.25x, 2000→1.5x, 5000→2.0x, 10000→2.5x. 시즌 종료까지 출금 불가. 조기 출금 시 20% 소각 패널티. 스테이킹 잔고 API + 클라이언트 UI | `server/internal/game/token_rewards.go`, `server/cmd/server/router.go`, `apps/web/app/(hub)/economy/tokens/page.tsx` |
| 2-17. 비주권 국가 주권 경매 (**v3 Sink**) | 48시간 영국식 경매. 최소 입찰: S 10000, A 5000, B 2000, C 500, D 200 $AWW. 증분 10%+. 낙찰 80% 소각 + 20% treasury. 낙찰 팩션 Sovereignty Level 1 즉시 부여. 경매 목록/입찰 API + 클라이언트 경매 UI | `server/internal/meta/auction.go` (신규), `server/cmd/server/router.go`, `apps/web/app/(hub)/economy/auction/page.tsx` (신규) |

- **design**: Y (가격 위젯 UI, 보상 이력 UI, 거버넌스 잔고 표시, 지갑 게이트 UI, **GDP 부스트 버튼, 스테이킹 패널, 경매 페이지**)
- **verify**: $AWW 가격 대시보드 표시 (또는 "unavailable" 폴백), Market Cap 가격 기반 변동, DefenseBuff 서버 데이터 일치 + 범례 정확, 프로필 보상 이력 조회 가능, 거버넌스에서 실제 토큰 잔고 기반 투표, CountryPanel 지갑 미연결 시 게이트 표시, 비주권 국가 GDP > 0, Ramp 잔고 서버 재시작 후 유지, **거버넌스 투표 시 10% 소각 확인, GDP 부스트 후 1시간 GDP 증가 확인, 스테이킹 후 보상 배수 적용 확인, 경매 입찰/낙찰/소각 흐름 정상 동작**

## 상세 설계 노트

### Phase 0-1: Ramp HMAC 인증 상세

CROSS Ramp 플랫폼은 webhook 전송 시 HMAC-SHA256 서명을 `X-Ramp-Signature` 헤더에 포함한다.

```go
func (h *RampWebhookHandler) verifySignature(r *http.Request, body []byte) bool {
    signature := r.Header.Get("X-Ramp-Signature")
    if signature == "" { return false }
    mac := hmac.New(sha256.New, []byte(h.webhookSecret))
    mac.Write(body)
    expected := hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(signature), []byte(expected))
}
```

`webhookSecret`은 환경변수 `RAMP_WEBHOOK_SECRET`에서 로드.

### Phase 0-3: WalletProvider 상세

```typescript
// apps/web/stores/wallet-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WalletStore {
  address: string | null;
  chainId: number;
  isConnected: boolean;
  connect: (address: string, chainId: number) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      address: null,
      chainId: 0,
      isConnected: false,
      connect: (address, chainId) =>
        set({ address, chainId, isConnected: true }),
      disconnect: () =>
        set({ address: null, chainId: 0, isConnected: false }),
    }),
    { name: 'aww-wallet' }
  )
);
```

모든 페이지에서 `useWalletStore()` 훅으로 접근.
WalletConnectButton은 이 스토어의 `connect()`/`disconnect()`를 호출.
기존 페이지별 `useState<WalletState>` 전부 제거.

### Phase 1-1: 보상 큐 연결 상세 (수정)

현재 `QueueDominationRewards`, `QueueSovereigntyReward`, `QueueWarVictoryReward`가 정의만 되어 있고 호출부가 없다.

**[검증 반영] 모든 Queue* 호출에 계정 레벨 체크 추가**:
```go
// 기존: QueueDominationRewards만 MinAccountLevelForTokens 체크
// 수정: 4종 전부 체크
func (m *TokenRewardManager) QueueSovereigntyReward(playerID, iso string) {
    if m.accountMgr != nil {
        level := m.accountMgr.GetAccountLevel(playerID)
        if level < m.cfg.MinAccountLevelForTokens {
            return  // 레벨 미달, 보상 스킵
        }
    }
    // ... 기존 로직
}
```

**Domination (epoch 종료 시)**:
```
epoch_end 이벤트 핸들러에서:
  nationScores := 각 국가별 점수 집계
  for iso, score := range nationScores:
    dominantFaction := GetSovereignFaction(iso)
    players := GetFactionPlayers(dominantFaction)
    rewards := tokenRewardMgr.CalcDominationRewards(iso, score, players)
    for _, r := range rewards:
      tokenRewardMgr.QueueReward(r)
```

**Sovereignty (경제 틱 시)**:
```
processCountryTick()에서 SovereignFaction이 있는 국가:
  sovereignPlayer := GetSovereign(iso)
  tokenRewardMgr.QueueSovereigntyReward(sovereignPlayer, iso)
```

**War Victory (전쟁 종료 시)**:
```
war.Resolve()에서 승리 팩션:
  for _, player := range winnerFaction.Members:
    tokenRewardMgr.QueueWarVictoryReward(player, warScore)
  buybackEngine.ExecuteWarVictoryBurn(loserCountry, loserTreasury)
```

### Phase 1-4: 바이백/번 HTTP 엔드포인트 상세

서버에 추가할 라우트:
```
GET /api/buyback/history?limit=50    → BuybackEngine.GetBuybackHistory(limit)
GET /api/buyback/burns?limit=50      → BuybackEngine.GetBurnHistory(limit)
GET /api/buyback/stats               → BuybackEngine.GetStats()
GET /api/defense/multipliers         → DefenseOracle.GetAllStates()
GET /api/defense/stats               → DefenseOracle.GetStats()
GET /api/token/price                 → ForgePrice.GetCurrentPrice() (Phase 2)
```

### Phase 1-10: BuybackEngine 호출 경로 수정 상세 (**신규**)

**현재 (잘못된) 호출 체인**:
```
DistributePendingRewards()
  → for each reward event (예: "player X earned 100 KOR tokens")
    → buybackEngine.ProcessEconomicTick(countryISO, event.Amount)
    → 여기서 event.Amount (보상 토큰 수)를 GDP 세수로 잘못 취급
```

**수정 후 (올바른) 호출 체인**:
```
economy.go processCountryTick()
  → GDP 계산 후:
    gdpRevenue := econ.GDP  // 실제 GDP 값
    if buybackEngine != nil {
      buybackEngine.ProcessEconomicTick(iso, float64(gdpRevenue))
    }

token_rewards.go DistributePendingRewards()
  → BuybackEngine 호출 제거
  → 보상 분배만 담당
```

### Phase 2-1: Forge 가격 피드 상세 (수정)

Forge Pool은 CROSS 체인의 bonding curve DEX이다. 가격을 가져오는 방법:

**방법 A: Forge API 직접 호출** (추천)
```
GET https://x.crosstoken.io/api/forge/token/{address}/price
→ { price: number, volume24h: number, change24h: number, marketCap: number }
```

**방법 B: CROSS RPC**
```
aww_getTokenPrice({ address: "0xfD48..." })
→ { price: number, ... }
```

**방법 C: GDP 기반 시뮬레이션 가격** (**Forge 미존재 시 기본 모드**)
```go
// 글로벌 GDP 총합 기반으로 AWW 가격 시뮬레이션
totalWorldGDP := economyEngine.GetTotalWorldGDP()
simulatedPrice := float64(totalWorldGDP) / AWW_TOTAL_SUPPLY * PRICE_FACTOR
```
→ 게임 경제 활동에 따라 가격이 자연스럽게 변동하는 효과.

서버에서 5분마다 폴링 → 캐시 → REST 엔드포인트로 노출.
Forge 성공 시 실제 가격 사용, 실패 시 시뮬레이션 가격 자동 폴백.

### Phase 2-9: 비주권 국가 기본 GDP (수정)

현재 `processCountryTick`은 `SovereignFaction == ""`인 국가를 완전히 스킵한다.
이 때문에 171개국이 영원히 GDP=0이다.

**수정 방향**: 비주권 국가에도 기본 GDP 계산 + **dirtyCountries 마킹**.
```go
// 기존: if econ.SovereignFaction == "" { continue }
// 수정: 비주권 국가는 GDP만 계산 (분배 스킵)
if econ.SovereignFaction == "" {
    econ.GDP = ee.calculateGDP(econ)
    ee.dirtyCountries[iso] = true  // ← 추가: DB 저장 보장
    continue  // 자원 분배, 세금, 보상은 스킵
}
```

### Phase 2-11: 거버넌스 토큰 잔고 연결 상세 (**신규**)

**현재 (하드코딩)**:
```typescript
// governance/page.tsx:169
<VoteInterface userTokenBalance={10000} ... />
// CountryPanel.tsx:554
<VoteInterface userTokenBalance={10000} ... />
```

**수정 방향**: 서버에서 포인트 잔고 조회
```typescript
// 1. api-client.ts에 추가
export async function fetchPlayerTokenBalance(playerId: string): Promise<number> {
  const data = await apiFetch<{ balance: number }>(`/api/v14/token-balance/${playerId}`);
  return data?.balance ?? 0;
}

// 2. 거버넌스 페이지에서 실제 잔고 사용
const { data: tokenBalance } = useApiData(
  () => fetchPlayerTokenBalance(playerId), { refreshInterval: 30000 }
);
<VoteInterface userTokenBalance={tokenBalance ?? 0} ... />
```

서버 엔드포인트 `GET /api/v14/token-balance/{playerId}`:
- Phase 1-2에서는 서버 내 포인트 잔고 반환 (보상 누적)
- Phase 3+에서 온체인 balanceOf 조회로 전환

### Phase 1-12: 전쟁 선포 $AWW 비용 상세 (**v3 Sink**)

기존 전쟁 선포 비용에 $AWW 포인트 소각을 추가합니다.

```go
// server/internal/meta/war.go — DeclareWar 함수 수정
func (wm *WarManager) DeclareWar(attackerFaction, defenderISO string, warType WarType) error {
    // 기존: Influence 300 + Oil 500 체크
    // 추가: $AWW 포인트 체크
    awwCost := map[WarType]float64{
        WarTypeStandard:  500,   // 소규모
        WarTypeCoalition: 2000,  // 대규모
        WarTypeEconomic:  1000,  // 경제 전쟁
    }[warType]

    leader := wm.factions.GetLeader(attackerFaction)
    balance := wm.tokenRewards.GetPlayerBalance(leader, "AWW")
    if balance < awwCost {
        return ErrInsufficientAWW
    }

    // 소각 처리
    wm.tokenRewards.BurnTokens(leader, "AWW", awwCost)
    wm.buybackEngine.RecordBurn("war_declaration", attackerFaction, awwCost)

    // 기존 전쟁 선포 로직 계속...
}
```

**중요**: 방어 전쟁(피공격)은 비용이 없습니다. 공격 측만 비용을 지불합니다.

### Phase 2-14: 거버넌스 투표 소각 상세 (**v3 Sink**)

```go
// 서버: 투표 처리 시 소각 로직
const GovernanceVoteBurnRate = 0.10

func (cm *CouncilManager) CastVote(playerID, proposalID string, support bool, tokens float64) error {
    burnAmount := tokens * GovernanceVoteBurnRate
    returnAmount := tokens - burnAmount

    // 소각 기록
    cm.tokenRewards.BurnTokens(playerID, "AWW", burnAmount)
    cm.buybackEngine.RecordBurn("governance_vote", proposalID, burnAmount)

    // 투표 가중치는 원래 토큰 기준 (소각 전)
    weight := math.Sqrt(tokens)  // quadratic voting
    // ...
}
```

클라이언트 투표 확인 모달:
```
"100 $AWW로 투표하시겠습니까?
 → 투표 가중치: 10.0
 → 소각: 10 $AWW (10%)
 → 반환: 90 $AWW (투표 종료 후)"
```

### Phase 2-15: 국가 GDP 부스트 상세 (**v3 Sink**)

```go
// server/internal/meta/economy.go — 부스트 상태 관리
type GDPBoost struct {
    ISO3      string
    Percent   float64   // +5%, +15%, +25%
    ExpiresAt time.Time
    BurnedAWW float64
    LockedAWW float64
}

var boostTiers = []struct{ MinAWW, Pct float64 }{
    {1000, 0.25},
    {500, 0.15},
    {100, 0.05},
}

func (ee *EconomyEngine) ApplyBoost(iso string, playerID string, awwAmount float64) error {
    // 쿨다운 체크 (4시간)
    // 티어 결정
    // 50% 소각 + 50% treasury 락
    // 부스트 만료 시간 설정 (1시간)
}

// processCountryTick에서 부스트 적용
func (ee *EconomyEngine) calculateGDP(econ *CountryEconomy) int64 {
    gdp := /* 기존 계산 */
    if boost := ee.getActiveBoost(econ.ISO3); boost != nil {
        gdp = int64(float64(gdp) * (1 + boost.Percent))
    }
    return gdp
}
```

### Phase 2-16: 시즌 스테이킹 상세 (**v3 Sink**)

```go
type SeasonStake struct {
    PlayerID   string
    Amount     float64
    StakedAt   time.Time
    SeasonID   string
    Multiplier float64 // 1.25, 1.5, 2.0, 2.5
}

var stakeTiers = []struct{ MinAWW float64; Mult float64 }{
    {10000, 2.5},
    {5000, 2.0},
    {2000, 1.5},
    {500, 1.25},
}

// 조기 출금: 20% 소각 패널티
func (sm *StakingManager) EarlyWithdraw(playerID string) (returned, burned float64) {
    stake := sm.stakes[playerID]
    burned = stake.Amount * 0.20
    returned = stake.Amount - burned
    sm.tokenRewards.BurnTokens(playerID, "AWW", burned)
    sm.tokenRewards.CreditTokens(playerID, "AWW", returned)
    delete(sm.stakes, playerID)
    return
}

// 시즌 종료: 전액 반환 + 보상 배수 적용
func (sm *StakingManager) SeasonEnd() {
    for playerID, stake := range sm.stakes {
        sm.tokenRewards.CreditTokens(playerID, "AWW", stake.Amount)
        // 보상 배수는 DistributePendingRewards에서 참조
    }
}
```

### Phase 2-17: 주권 경매 상세 (**v3 Sink**)

```go
// server/internal/meta/auction.go (신규)
type SovereigntyAuction struct {
    ID          string
    ISO3        string
    MinBid      float64   // 티어별 최소 입찰
    CurrentBid  float64
    BidderFaction string
    StartTime   time.Time
    EndTime     time.Time // StartTime + 48h
    Status      string    // "active" | "ended" | "settled"
}

var auctionMinBids = map[string]float64{
    "S": 10000, "A": 5000, "B": 2000, "C": 500, "D": 200,
}

// 입찰: 이전 입찰의 110% 이상
func (am *AuctionManager) PlaceBid(auctionID, factionID string, amount float64) error {
    auction := am.auctions[auctionID]
    if amount < auction.CurrentBid * 1.10 {
        return ErrBidTooLow
    }
    // 이전 입찰자에게 반환
    if auction.BidderFaction != "" {
        am.tokenRewards.CreditTokens(previousLeader, "AWW", auction.CurrentBid)
    }
    // 새 입찰자에서 차감
    am.tokenRewards.DebitTokens(newLeader, "AWW", amount)
    auction.CurrentBid = amount
    auction.BidderFaction = factionID
    return nil
}

// 경매 정산
func (am *AuctionManager) SettleAuction(auctionID string) {
    auction := am.auctions[auctionID]
    burnAmount := auction.CurrentBid * 0.80
    treasuryAmount := auction.CurrentBid * 0.20

    am.tokenRewards.BurnTokens(/*leader*/, "AWW", burnAmount)
    am.buybackEngine.RecordBurn("sovereignty_auction", auction.ISO3, burnAmount)

    // 주권 즉시 부여
    am.sovereignty.GrantSovereignty(auction.ISO3, auction.BidderFaction, 1)
}
```

클라이언트: `/economy/auction` 페이지 — 활성 경매 목록, 입찰 UI, 남은 시간, 최고 입찰 표시.

---

## 검증 보고서 대응 요약

| 검증 이슈 | 심각도 | 대응 Task | 상태 |
|-----------|--------|-----------|------|
| Ramp HMAC 미구현 | 🚨 | 0-1 | ✅ 신규 추가 |
| Ramp 주문 중복 처리 | 🚨 | 0-2 | ✅ 신규 추가 |
| CROSSx 콜백 미구현 | 🚨 | 0-4 | ✅ 신규 추가 |
| BuybackEngine 세금 리셋 버그 | 🚨 | 0-6 | ✅ 신규 추가 |
| RegisterCountry 누락 | 🚨 | 0-5 | ✅ 신규 추가 |
| BuybackEngine 의미론 오류 | ⚠️ | 1-10 | ✅ 신규 추가 |
| 보상 큐 무제한 성장 | ⚠️ | 1-11 | ✅ 신규 추가 |
| 계정 레벨 체크 누락 | ⚠️ | 1-1 수정 | ✅ 기존 Task 강화 |
| DefenseOracle shutdown 누락 | ⚠️ | 1-2 수정 | ✅ 기존 Task 강화 |
| 방어 버프 캡/티어 불일치 | ⚠️ | 1-3 수정 | ✅ 기존 Task 강화 |
| 소켓 재연결 토큰 복구 | ⚠️ | 1-6 수정 | ✅ 기존 Task 강화 |
| 거버넌스 하드코딩 10000 | 🚨 | 2-11 | ✅ 신규 추가 |
| CountryPanel 지갑 게이트 | ⚠️ | 2-12 | ✅ 신규 추가 |
| 비주권 GDP dirty 마킹 | ⚠️ | 2-9 수정 | ✅ 기존 Task 강화 |
| 글로벌 WalletProvider | ⚠️ | 0-3 | ✅ 신규 추가 |
| GameData 토큰 필드 | Medium | 1-6 수정 | ✅ 기존 Task 강화 |
| 토큰 TypeScript 인터페이스 | Medium | 1-8 수정 | ✅ 기존 Task 강화 |
| StakingPanel 진단 오류 수정 | Low | 진단표 | ✅ 수정 |
| Forge API 불확실성 | ⚠️ | 2-1 수정 | ✅ GDP 폴백 추가 |

**v3 토큰 Sink 추가**:

| Sink 메커니즘 | Phase-Task | 예상 시즌 소각 ($AWW) |
|-------------|-----------|---------------------|
| 전쟁 선포 비용 | 1-12 | 340,000 |
| 거버넌스 투표 소각 | 2-14 | 80,000 |
| GDP 부스트 | 2-15 | 120,000 |
| 시즌 스테이킹 패널티 | 2-16 | 1,000,000 |
| 주권 경매 | 2-17 | 36,000 |
| **합계** | | **~1,576,000 $AWW/시즌** |

**미대응 (Phase 3+ 이후)**:
- NationalTreasury ReentrancyGuard → 배포 전 수정
- GovernanceModule safeTransfer → 배포 전 수정
- float64 정밀도 → big.Int 전환
- 컨트랙트 멀티시그 → Gnosis Safe 전환
- 온체인 이벤트 인덱서 → The Graph 또는 커스텀
- 플레이어-지갑 DB 테이블 → Supabase users 테이블 확장
