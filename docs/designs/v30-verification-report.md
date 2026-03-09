# v30 AWW 토큰 통합 기획 검증 보고서

> 검증일: 2026-03-09
> 대상: `docs/designs/v30-aww-token-integration-plan.md`
> 검증 범위: 서버(Go) + 클라이언트(Next.js) + 블록체인(Solidity/CROSS) 전체

## 요약

| 카테고리 | 이슈 수 | Critical | High | Medium | Low |
|----------|---------|----------|------|--------|-----|
| 서버 로직 | 21 | 4 | 7 | 7 | 3 |
| 클라이언트 | 33 | 7 | 10 | 12 | 4 |
| 보안/블록체인 | 13 | 5 | 4 | 4 | 0 |
| **합계** | **67** | **16** | **21** | **23** | **7** |

**v30 기획이 커버하는 이슈**: 15개 (22%)
**v30 기획이 놓친 이슈**: 52개 (78%)

---

## 🚨 Phase 0: 기획 실행 전 반드시 해결할 블로커 (기획서에 없는 것들)

v30 기획을 실행하기 전에, 아래 3가지를 먼저 해결하지 않으면 보안 사고가 발생한다.

### B1. Git에 노출된 Credentials 즉시 제거 ❗️

| 파일 | 노출 내용 |
|------|----------|
| `forge_token_deploy/.env` | CrossToken API CLIENT_KEY + CLIENT_SECRET |
| `.env` (root) | Supabase keys, DB password, OpenRouter API key |
| `app_ingame/.env` | MySQL credentials, API keys |

**조치**: `.gitignore`에 추가 + `git rm --cached` + 모든 키 로테이션

### B2. Ramp Webhook HMAC 검증 구현 ❗️

`/api/ramp/order-result`에 인증이 전혀 없다. 현재 상태로 누구나:
```
POST /api/ramp/order-result
{"status":"success","action":"mint","amount":999999,"walletAddress":"0x..."}
```
→ 무제한 크레딧 발행 가능. **Phase 1 실행 전에 반드시 HMAC-SHA256 서명 검증 추가.**

### B3. NationalTreasury.sol에 ReentrancyGuard 추가 ❗️

`unstake()` 함수에서 state 변경 후 `safeTransfer` + `mint` 외부 호출. OpenZeppelin `ReentrancyGuard` 없음.
`GovernanceModule.sol`은 `transfer()` 대신 `safeTransfer()` 사용 필요.
→ **배포 전 필수 수정**

---

## 서버 (Go) — 기획이 놓친 이슈 16개

### 🚨 Critical

**C1. BuybackEngine: 세금 0으로 리셋 후 트랜잭션 실패 → 자금 소실**
- `buyback.go:128` — `AccumulatedTax = 0` 한 후에 RPC 호출. 호출 실패 시 세금 증발.
- v30 커버: ❌ **실제 자금 손실 버그**

**C2. DefenseOracle: RegisterCountry() 호출부 없음**
- `defense_oracle.go:101-111` — Start()를 호출해도 `isoList`가 비어서 폴링 무효.
- v30 커버: ⚠️ Task 1-2가 Start()만 언급, RegisterCountry 누락

**C3. Ramp 주문 중복 처리 (idempotency 없음)**
- `webhook.go:151-199` — OrderID 중복 체크 없음. Ramp 재전송 시 크레딧 이중 발행.
- v30 커버: ❌

### ⚠️ High

**H1. ProcessEconomicTick 의미 혼동: 보상 금액을 GDP 세수로 처리**
- `buyback.go:100-115` — `DistributePendingRewards`가 보상 금액을 넘기는데, BuybackEngine은 이를 GDP 세수로 취급하여 5% 적용. 보상 100 tokens → 5 세금 → 500 매수? 의미론 오류.
- v30 커버: ❌

**H2. 실패한 블록체인 트랜잭션 재시도/DLQ 없음**
- `buyback.go:219-246` — RPC 실패 시 빈 records 반환, 세금은 이미 0으로 리셋 (C1). 재시도 없음.
- v30 커버: ❌

**H3. 토큰 보상 엔드포인트 인증 없음**
- `router.go:797-810` — `/api/v14/rewards/{playerId}` 인증 미들웨어 없이 노출. 아무나 playerId 추측으로 보상 이력 조회 가능.
- v30 커버: ❌ (오히려 buyback/defense 엔드포인트도 같은 그룹에 추가 예정)

**H4. Hegemony/Sovereignty/WarVictory 보상에 계정 레벨 체크 없음**
- `token_rewards.go:285-370` — Domination만 `MinAccountLevelForTokens` 체크. 나머지 3종은 신규 유저도 보상 수령 가능.
- v30 커버: ❌

**H5. 국가별 주권 지분(sovereign share) 80% 팩션 재무로 이중 입금**
- `economy.go:577-583` — faction(50%) + sovereign(30%) 모두 `econ.SovereignFaction` 재무에 입금. 리더 개인 잔고가 아닌 팩션 재무에 80% 집중.
- v30 커버: ❌

**H6. DefenseOracle의 방어 버프 캡(30%)이 상위 티어를 무의미하게 만듦**
- `defense_oracle.go:356-371` — 5.0x 티어(5만 bp)도 30% 캡 적용. $10M과 $100M 마켓캡 국가의 실제 버프 동일.
- v30 커버: ❌

**H7. DefenseOracle shutdown 처리 없음**
- `main.go:950-959` — shutdown에서 economyEngine, seasonEngine 등은 Stop() 호출하지만, defenseOracle.Stop()은 없음. 고루틴 누수.
- v30 커버: ❌

### 💡 Medium

**M1. GDP는 "누적"이 아니라 매 틱 재계산 스냅샷**
- `economy.go:608-610` — `calculateGDP()`가 현재 생산율 × 가격으로 계산. 시간 경과에 따른 축적 아님.
- v30 기획은 GDP를 Market Cap의 기반으로 사용하지만, GDP는 "이번 틱의 생산 가치"일 뿐.
- v30 커버: ❌

**M2. ManualTick으로 동일 국가 이중 처리 가능**
- `economy.go:873-895` — ManualTick 후 전역 Tick()이 같은 국가 재처리. 자원 이중 생산 위험.
- v30 커버: ❌

**M3. 자원 분배 합계 > 100% (세금 골드 별도 추가)**
- `economy.go:567-605` — faction(50%)+sovereign(30%)+participant(20%) + 세금 골드(세율 × 전체 생산). 총합 100%+ 초과.
- v30 커버: ❌

**M4. 보상 큐 무제한 성장 (backpressure 없음)**
- `token_rewards.go` — `pendingRewards` 슬라이스에 상한 없음. RPC 지연 시 메모리 계속 증가.
- v30 커버: ⚠️ 리스크에 "일일 캡" 언급했으나 구체적 메커니즘 없음

**M5. 비주권 국가 GDP 계산 시 dirtyCountries 마킹 누락**
- `economy.go:523-525` — SovereignFaction이 있을 때만 dirty 마킹. v30 Task 2-9에서 비주권 GDP 계산 추가하면, 그 값이 DB에 저장 안 됨.
- v30 커버: ❌

**M6. GetDefenseState가 내부 포인터 반환 (aliasing)**
- `defense_oracle.go:128-132` — 호출자가 오라클 내부 상태를 잠금 없이 변경 가능.
- v30 커버: ❌

**M7. Circuit breaker가 smoothed 값이 아닌 raw 값으로 비교**
- `defense_oracle.go:213` — 급락 후 정상 회복 시에도 circuit breaker 발동 가능.
- v30 커버: ❌

## 클라이언트 (Next.js) — 기획이 놓친 이슈 24개

### 🚨 Critical

**CC1. CROSSx 콜백 핸들링 미구현 — 지갑 연결 불가능**
- `WalletConnectButton.tsx:41-42` — `openCrossx()` deep link 실행 후 콜백 URL 핸들러 없음. `window.addEventListener('message')` 없음. URL 파라미터 파싱 없음. CROSSx 앱이 있어도 지갑 연결 영원히 불가.
- `connecting: true` 설정 후 해제 안 됨 → 버튼 영원히 "Connecting..." 상태 고정.
- v30 기획: "CROSSx Deep Linking — 이미 구현됨"이라고 했으나 **근본적으로 미완성**.
- v30 커버: ❌

**CC2. 거버넌스 `userTokenBalance=10000` 하드코딩 — 투표 무의미**
- `governance/page.tsx:169`, `CountryPanel.tsx:554` — 모든 유저가 10000 토큰 보유. $AWW 구매자와 비구매자 차이 없음.
- v30 커버: ❌

**CC3. StakingPanel 전체 플로우가 No-op**
- `StakingPanel.tsx:52-73` — Stake 버튼 클릭 → 1.5초 스피너 → 아무 일도 안 됨. API 호출 없음, 트랜잭션 없음, 상태 변경 없음.
- v30 커버: ❌

**CC4. Treasury 주소가 null address (0x0000...)**
- `CountryPanel.tsx:499` — StakingPanel에 전달되는 `treasuryAddress`가 이더리움 null 주소. 실제 트랜잭션 시 토큰이 burn 주소로 전송됨.
- v30 커버: ❌

### ⚠️ High

**CH1. 소켓 재연결 시 토큰 상태 복구 없음**
- `useSocket.ts` — 재연결 후 `token_reward` 미수신분을 요청하는 로직 없음. 네트워크 불안정 시 보상 알림 유실.
- v30 커버: ❌

**CH2. 거버넌스 투표에 인증 없음**
- `api-client.ts:171-189` — `postCouncilVote()`, `postCouncilProposal()` 모두 Bearer token 미전송. 아무나 아무 플레이어 대신 투표 가능.
- v30 커버: ❌

**CH3. 지갑 상태가 페이지 로컬 — 네비게이션 시 소멸**
- `profile/page.tsx:74` — `useState<WalletState|null>(null)`. Context/Provider 없음. 페이지 이동하면 연결 해제. 다시 "Connect" 클릭 필요.
- v30 커버: ❌

**CH4. 프로필 playerId 하드코딩 'local-user'**
- `profile/page.tsx:77,80` — 모든 유저가 동일 프로필. 보상 이력도 동일 playerId로 조회될 것.
- v30 커버: ❌ (Task 2-6이 보상 이력 추가하지만 playerId 이슈는 미해결)

**CH5. 모든 토큰 잔고 하드코딩 '0'**
- `CountryPanel.tsx:56-69`, `profile/page.tsx:88-101` — balance, stakedBalance, pendingReward 모두 '0'. 온체인 balanceOf 조회 메커니즘 전무.
- v30 커버: ❌ (보상 이력만 추가, 잔고 파이프라인은 미해결)

**CH6. CountryPanel TOKEN 탭에 지갑 연결 게이트 없음**
- `CountryPanel.tsx` — 지갑 미연결 상태에서도 Stake/Unstake 버튼 표시. 클릭 시 아무 반응 없음 → UX 혼란.
- v30 커버: ❌

**CH7. TIER_SUPPLY/TIER_DEFENSE 서버와 불일치 가능**
- `tokens/page.tsx:28-43` — 클라이언트 하드코딩 상수. 서버 DefenseOracle과 동기화 메커니즘 없음.
- v30 커버: ⚠️ Task 2-5에서 서버 데이터로 교체 예정이나 과도기 불일치 미해결

**CH8. defenseMultiplier 단위 혼동 (1.0 vs 10000 bp)**
- `profile/page.tsx:98` — `defenseMultiplier: 1.0` 전달. `defenseMultiplierToPercent()`는 basis points(10000=0%) 기대. (1.0 - 10000) / 100 → 음수 → 0% 표시. 우연히 정상처럼 보이지만 의미론 오류.
- v30 커버: ❌

### 💡 Medium

**CM1. api-client가 모든 에러를 null로 삼킴**
- `api-client.ts:38-40` — 네트워크 에러, 401, 404, 500, 429 모두 `null` 반환. UI에서 "에러"와 "데이터 없음" 구분 불가.
- v30 커버: ❌

**CM2. GameData 인터페이스에 토큰 필드 없음**
- `useSocket.ts:127-149` — 토큰 이벤트 핸들러 추가 시 GameData/UiState 확장 필요. v30은 핸들러 추가만 언급.
- v30 커버: ❌

**CM3. 토큰 데이터용 TypeScript 인터페이스 미정의**
- TokenReward, BuybackEntry, BurnEntry, DefenseMultiplierData 등 api-client.ts에 정의 필요.
- v30 커버: ⚠️ Task 1-8에서 암묵적으로 포함되나 명시 안 됨

**CM4. Mock 지갑 타임아웃 클린업 없음 (메모리 릭)**
- `WalletConnectButton.tsx:44-57` — `setTimeout` 후 언마운트 시 state 업데이트 시도. `useEffect` 클린업 없음.
- v30 커버: ❌

**CM5. 대시보드 30초 폴링 — 토큰 경제에 부적합**
- `tokens/page.tsx:50-57` — 가격 변동이 실시간 반영 안 됨. WebSocket push 필요.
- v30 커버: ❌

**CM6. Staking ratio 계산이 임의 공식**
- `tokens/page.tsx:87-88` — `10 + min((GDP/1M)×2, 20)`. 실제 스테이킹 데이터와 무관.
- v30 커버: ❌

**CM7. Defense buff 범례가 실제 공식과 불일치**
- `tokens/components.tsx:447-448` — 범례 "$100M+: +400%" 표시하지만 실제 캡은 +30%.
- v30 커버: ❌

**CM8. Disconnect 시 서버 통보 없음**
- `WalletConnectButton.tsx:30-35` — 로컬 state만 null로. 서버 세션/지갑 연결 해제 알림 없음.
- v30 커버: ❌

**CM9. Claim 버튼 콜백 미전달**
- `StakingPanel.tsx:317-330` — `onClaimRewards?.()` 호출하지만 CountryPanel이 콜백 미전달. 클릭 무반응.
- v30 커버: ❌

**CM10. handleWithdraw가 console.log만**
- `governance/page.tsx:89-91` — 토큰 인출 기능 미구현.
- v30 커버: ❌

## 보안/블록체인 — 기획이 놓친 이슈 12개

### 🚨 Critical

**SC1. Git에 라이브 시크릿 노출** (= B1, 중복이지만 보안 카테고리에서 재강조)

**SC2. NationalTreasury ReentrancyGuard 없음** (= B3)

**SC3. GovernanceModule이 `transfer()` 사용 — safeTransfer 필요**
- `GovernanceModule.sol:118, 162` — ERC20 `transfer/transferFrom`이 false 반환 시 silent fail. SafeERC20 라이브러리 미사용.

**SC4. NationalTreasury의 mint 무제한 — 인플레이션 캡 없음**
- `NationalTreasury.sol` — `unstake()`에서 보상으로 `nationalToken.mint()` 호출. 공급량 상한 없음. 서버 + 스테이킹 보상 모두 무제한 발행 가능.

**SC5. Testnet 설정 없음 — 개발/테스트가 메인넷에서 실행**
- 모든 코드가 CROSS Mainnet(8851) 지향. 테스트넷 RPC, 테스트넷 컨트랙트 주소 설정 없음. 개발 중 실수로 메인넷 트랜잭션 발생 가능.

### ⚠️ High

**SH1. 플레이어-지갑 연결 없음**
- 게임은 `playerID`로 식별, 블록체인은 `0x address`로 식별. 두 ID를 연결하는 DB 테이블/구조체 전무.
- v30이 보상을 "분배"하려면 이 연결이 필수인데 기획에 없음.

**SH2. float64로 토큰 금액 처리 — 정밀도 손실**
- `buyback.go`, `token_rewards.go` — 모든 금액이 float64. 18-decimal ERC20에서 ~9007 토큰 이상이면 정밀도 소실. 누적 오차로 장기적 회계 불일치.

**SH3. 컨트랙트 소유권이 단일 EOA**
- 모든 컨트랙트가 `Ownable`로 단일 주소 소유. 멀티시그, 타임락, 거버넌스 소유권 이전 없음.

**SH4. Forge API 존재 불확실**
- v30 Phase 2-1이 `https://x.crosstoken.io/api/forge/token/{address}/price`를 가정하지만, 이 API의 존재가 미확인. 리스크 테이블에 인정했지만 폴백이 "스크래핑"뿐.

### 💡 Medium

**SM1. 트랜잭션 재전송 보호 없음**
- Go RPC 클라이언트에 nonce 추적, idempotency key, 트랜잭션 중복 방지 없음.

**SM2. Foundry 의존성 미설치 — 컨트랙트 컴파일 불가**
- `contracts/lib/` 비어있음. `forge install` 미실행. 테스트 불가.

**SM3. 블록체인 작업 모니터링/메트릭 없음**
- `metrics.go`에 블록체인 관련 카운터/히스토그램 없음. buyback 실행, RPC 지연, circuit breaker 알림 없음.

**SM4. DeployNationalTokensBatch2 스크립트 누락**
- C/D 티어 국가 토큰(~127개국) 배포 스크립트가 참조되지만 파일 없음.

## 아키텍처 관점 — 기획에서 다루지 않은 구조적 문제

### A1. "토큰 보상 → 실제 전송" 파이프라인이 존재하지 않음

v30 기획은 Queue* → Distribute → BuybackEngine 흐름을 그렸지만, **실제로 플레이어 지갑에 토큰이 전송되는 경로가 없다.**

```
현재: Queue → Distribute → WS 알림 → 끝 (서버 내 포인트일 뿐)
필요: Queue → Distribute → 온체인 mint/transfer → WS 확인 → 잔고 업데이트
```

기획은 "Phase 1-2에서는 포인트 개념"이라고 했지만, 포인트가 실제 토큰으로 변환되는 Phase 3+ 경로가 정의되지 않았다.

### A2. 글로벌 지갑 Context 필요

현재 지갑 상태가 각 페이지 `useState`로 분산:
- `profile/page.tsx:74` — 프로필 전용
- `WalletConnectButton` — 버튼 내부

필요한 것:
```
WalletProvider (Context API or zustand)
  ├── address, chainId, balance
  ├── connect() / disconnect()
  ├── isConnected derived state
  └── 앱 전체에서 공유
```

### A3. 유저 인증 시스템 부재

토큰 이코노미의 핵심은 "이 유저가 누구인가"인데:
- 게임: `playerID` = `local-user` 하드코딩
- 블록체인: `walletAddress` = mock random 생성
- 거버넌스: 인증 없이 누구나 투표
- API: Bearer token 인프라 존재하지만 거의 미사용

Phase 1-2를 "포인트 시스템"으로 운영하더라도, 최소한 세션 기반 playerID는 필요.

### A4. 이벤트 인덱서 부재

온체인 이벤트(Transfer, Stake, Unstake, BuybackExecuted, TokensBurned)를 대시보드에 표시하려면 인덱서가 필요. 현재:
- BuybackEngine: 인메모리 `records` 슬라이스 → 서버 재시작 시 소멸
- DefenseOracle: 인메모리 `states` 맵 → 서버 재시작 시 소멸
- TokenRewardManager: 인메모리 `rewardHistory` → 서버 재시작 시 소멸

**모든 토큰 경제 데이터가 서버 재시작 시 소멸한다.**

### A5. BuybackEngine의 ProcessEconomicTick 의미론 오류 (상세)

현재 호출 체인:
```
DistributePendingRewards()
  → for each pending reward (e.g., "player X earned 100 KOR tokens")
    → buybackEngine.ProcessEconomicTick(countryISO, event.Amount)
```

하지만 BuybackEngine.ProcessEconomicTick은:
```go
func (b *BuybackEngine) ProcessEconomicTick(iso, gdpRevenue float64)
// gdpRevenue에 BuybackTaxRate(5%) 적용
// → "GDP 세수의 5%로 토큰 매수" 의도
```

**문제**: `event.Amount`(보상 토큰 수)를 `gdpRevenue`(GDP 세수)로 전달.
보상 100 토큰 → "GDP 세수 100" 취급 → 5% = 5 → 시뮬레이션: 500 토큰 매수.
경제적 의미가 완전히 뒤틀려있다.

**올바른 연결**: economy tick에서 `econ.GDP`를 직접 BuybackEngine에 전달해야 함.

## 기획 개선 권고사항

### 1. Phase 0 신설 — "보안 + 인프라 기반" (기획 실행 전 필수)

| Task | 설명 | 수정 파일 |
|------|------|-----------|
| 0-1 | `.env` 파일 `.gitignore` 추가 + 노출 키 로테이션 | `.gitignore`, forge_token_deploy/.env 등 |
| 0-2 | Ramp webhook HMAC-SHA256 검증 구현 | `ramp/webhook.go` |
| 0-3 | 글로벌 WalletProvider Context 생성 (zustand or Context API) | `apps/web/providers/WalletProvider.tsx` (신규) |
| 0-4 | 플레이어-지갑 연결 테이블/맵 구현 (최소 인메모리 맵 → 이후 DB) | `server/internal/game/player_wallet.go` (신규) |
| 0-5 | DefenseOracle에 RegisterCountry() 일괄 호출 추가 | `main.go` |

### 2. Phase 1 수정사항

| 기존 Task | 추가/변경 사항 |
|-----------|----------------|
| 1-1 (보상 큐 연결) | Hegemony/Sovereignty/WarVictory에도 `MinAccountLevelForTokens` 체크 추가 |
| 1-2 (DefenseOracle 시작) | `RegisterCountry()` 일괄 호출 + errgroup 통합 + shutdown 호출 추가 |
| 1-4 (HTTP 엔드포인트) | 최소한 playerId 검증 미들웨어 추가 (자기 보상만 조회) |
| 1-5 (보상→버프 연결) | Defense buff 캡 30% → 티어 테이블과 일치하도록 조정 |
| 1-9 (BuybackBurn 실데이터) | BuybackEngine의 ProcessEconomicTick 호출을 economy tick에서 직접 호출로 변경 (보상 금액이 아닌 GDP 세수 전달) |
| 신규 1-10 | BuybackEngine: 세금 리셋을 RPC 성공 후로 이동 (C1 버그 수정) |
| 신규 1-11 | 보상 큐 상한(1000개) + backpressure 메커니즘 |

### 3. Phase 2 수정사항

| 기존 Task | 추가/변경 사항 |
|-----------|----------------|
| 2-3 (가격 위젯) | Forge API 미존재 시 폴백: GDP-based 시뮬레이션 가격 (Forge 의존 제거) |
| 2-6 (프로필 보상) | playerId 이슈 선결: 세션 기반 ID 또는 지갑 기반 ID |
| 2-9 (비주권 GDP) | `dirtyCountries` 마킹도 함께 추가 (DB 저장 누락 방지) |
| 신규 2-11 | 거버넌스 `userTokenBalance` 하드코딩 제거 → 서버 API 또는 지갑 잔고 조회 |
| 신규 2-12 | CountryPanel TOKEN 탭: 지갑 미연결 시 "Connect Wallet" 게이트 표시 |
| 신규 2-13 | CROSSx 콜백 URL 핸들러 구현 (또는 mock 모드를 공식 포인트 시스템으로 전환) |

### 4. 기획서 자체 수정 필요사항

| 항목 | 현재 | 수정 |
|------|------|------|
| "CROSSx Deep Linking — 이미 구현됨" | 미완성 (콜백 없음) | "stub만 존재, 콜백 핸들링 미구현" |
| "StakingPanel — 어디서도 import 안 됨" | CountryPanel.tsx에서 import됨 | "CountryPanel에서 import되나 all no-op" |
| Flywheel 다이어그램 | "보상 → BuybackEngine" | "economy tick GDP → BuybackEngine (보상 아님)" |
| 리스크 "Ramp 잔고 인메모리" | "Phase 2에서 Supabase 영속화" | 구체적 Task 번호 부여 필요 |
| 리스크 "HMAC 미구현" | 진단에만 언급 | Phase 0 블로커로 승격 |

---

## 검증 결론

v30 기획은 **핵심 문제(dead code 활성화)**를 정확히 진단하고, 서버-클라이언트 연결의 우선순위를 올바르게 잡았다. 그러나:

1. **보안 블로커 3건**을 실행 전에 해결해야 함 (자격증명 노출, HMAC, reentrancy)
2. **BuybackEngine 의미론 오류**가 경제 시스템의 근간을 왜곡 — 보상 금액이 아닌 GDP 세수가 바이백 입력이어야 함
3. **클라이언트 지갑 인프라**가 기획 가정보다 훨씬 미완성 — 글로벌 Context, 콜백 핸들링, 플레이어-지갑 연결이 선행되어야 함
4. **거버넌스 인증 + 잔고**가 완전히 누락 — 토큰 보유의 실제 의미를 부여하려면 거버넌스부터 연결해야

**권장 실행 순서**: Phase 0 (보안) → Phase 1 (수정된 버전) → Phase 2 (수정된 버전)

**기획 적합도 (Match Rate)**: 48/100
- 핵심 방향 정확: +30점
- 서버 활성화 계획 충실: +18점
- 보안 블로커 미포함: -20점
- 클라이언트 인프라 과소평가: -15점
- 경제 의미론 오류 미발견: -10점
- 거버넌스/인증 누락: -5점
