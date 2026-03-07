# 보안 아키텍처 리뷰 리포트

**날짜**: 2026-03-07 | **대상**: `/Users/andrew.kim/Desktop/snake`

---

## 프로젝트 요약

| 항목 | 값 |
|------|-----|
| 언어 | Go 1.25 (서버) + TypeScript (프론트엔드) |
| 프레임워크 | chi/v5 + gorilla/websocket (서버), Next.js 15 + React 19 + R3F (프론트엔드) |
| 인증 | JWT (golang-jwt/v5) + API Key (SHA-256 해시) — **스텁 상태** |
| DB | PostgreSQL (lib/pq) + Redis (go-redis/v9) — **스키마만 존재, 미연결** |
| 배포 | Railway (Container) + Vercel (Serverless) |
| 활성 도메인 | Backend **Y** · Frontend **Y** · BaaS/DB **N** (미연결) · Web3 **Y** (contracts) · Infra **Y** |

## 공격 표면 맵

| 프로토콜 | 경로/이벤트 | 인증 | 비고 |
|----------|------------|------|------|
| HTTP GET | `/health` | 없음 | |
| HTTP GET | `/metrics` | 없음 | ← 서버 내부 지표 노출 |
| HTTP GET | `/rooms` | 없음 | |
| HTTP GET | `/ws` | 없음 | WebSocket 업그레이드 |
| HTTP PUT | `/api/agent/{id}/training` | 없음 | ← 누구나 설정 가능 |
| HTTP GET | `/api/agent/{id}/training` | 없음 | |
| HTTP PUT | `/api/agent/{id}/build-path` | 없음 | ← 누구나 설정 가능 |
| HTTP GET | `/api/agent/{id}/memory` | 없음 | |
| HTTP GET | `/api/player/{id}/progression` | 없음 | |
| HTTP GET | `/api/player/{id}/quests` | 없음 | |
| HTTP GET | `/api/leaderboard` | 없음 | |
| HTTP * | `/api/agents/*` | DualAuth | JWT 또는 API Key — **스텁 검증** |
| HTTP GET | `/ws/agents/live` | API Key (query) | ← **Dev fallback 항상 활성** |
| HTTP * | `/api/v11/*` | 없음 | 전체 v11 메타 라우트 |
| HTTP * | `/api/v14/*` | 없음 | 전체 v14 인게임 라우트 |
| WS | `agent_auth` | 없음 | ← API 키 검증 안 함 |
| WS | `input` | 없음 | 30Hz rate limit 적용 |
| WS | `join_room` / `leave_room` | 없음 | ← rate limit 없음 |
| WS | `declare_war` | 없음 | ← 인가 검증 없음 |
| WS | `switch_arena` / `get_*` | 없음 | ← rate limit 없음 |

## 아키텍처 차원 건강도 평가

| 차원 | 상태 | 핵심 발견사항 |
|------|------|---------------|
| A1 인증(Authentication) | **심각** | Agent 인증 체계 전면 무효 (WS/REST/Stream 모두 스텁) |
| A2 인가(Authorization) | **심각** | 전쟁 선포 인가 부재, v10/v11/v14 API 전체 미인증 |
| A3 데이터 흐름(Data Flow) | **주의** | LLM SSRF, Faction 음수값 악용, 에러 메시지 내부 정보 노출 |
| A4 입출력 경계(I/O Boundary) | **주의** | 입력 살균 함수 미적용, Appearance/BannerURL 미검증 |
| A5 시크릿 관리(Secret Mgmt) | **주의** | Gemini API Key .env.local, DB 기본 비번, contracts .gitignore 부재 |
| A6 외부 연동(External Integration) | **심각** | LLM Base URL SSRF, io.ReadAll 무제한, 외부 응답 미검증 |
| A7 에러/관측성(Error/Observability) | **주의** | /metrics 미인증, 에러 메시지 직접 반환, 보안 이벤트 미로깅 |
| A8 리소스/가용성(Resource/Availability) | **심각** | Rate Limiter 미적용, 무제한 인메모리 맵, 요청 본문 크기 미제한 |

## CRITICAL — 즉시 조치 필요

### F-001: Agent 인증 체계 전면 무효 — WebSocket, REST API, Stream 모두 스텁

**메타데이터:**
- 아키텍처 차원: A1 (Authentication)
- 심각도: **CRITICAL**
- 위치: `server/cmd/server/main.go:937-967`, `server/cmd/server/router.go:412-417`, `server/internal/ws/agent_stream.go:305-352`
- 근본 원인: **아키텍처** — 인증 인프라가 설계되었으나 검증 로직 미구현
- 참조: OWASP API2:2023, CWE-287 (Improper Authentication)

**구조적 이슈 설명:**

Agent 인증 시스템이 3개 경로(WebSocket, REST API, Agent Stream) 모두에서 실질적 검증 없이 통과하는 구조적 결함이 존재한다. 인증 미들웨어와 키 생성/해싱 로직은 완성되어 있으나, 실제 키 대조 검증이 스텁(stub) 상태로 남아 있어 **어떤 클라이언트든 임의의 Agent로 위장 가능**하다.

1. **WebSocket `agent_auth`**: `main.go:937-967`에서 `client.IsAgent = true` 설정 시 API 키를 저장만 하고 DB/메모리 대조 없음
2. **REST `/api/agents/*`**: `router.go:412-417`의 `apiKeyValidator`가 비어있지 않은 해시면 모두 수락
3. **Agent Stream `/ws/agents/live`**: `agent_stream.go:305-309`의 `CheckOrigin`이 항상 `true` 반환 + `ValidateAPIKey`가 `nil`이므로 dev fallback이 모든 환경에서 활성

**근거:**

```go
// router.go:412-417 — 스텁 검증기
apiKeyValidator := func(_ context.Context, keyHash string) (string, error) {
    if keyHash == "" { return "", fmt.Errorf("empty key hash") }
    return "api_user_" + keyHash[:8], nil  // ← 아무 키나 수락
}

// main.go:960 — 키 검증 없이 Agent 마킹
client.IsAgent = true
client.AgentID = payload.AgentID

// agent_stream.go:305-309 — 오리진 검증 없음
var agentStreamUpgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true },
}
```

**수정 권고 및 영향 분석:**

**1_변경_대상:**
- `router.go:412-417`: `apiKeyValidator`에 DB/Redis 기반 키 해시 조회 로직 구현
- `main.go:937-967`: `agent_auth` 이벤트에서 `apiKeyValidator` 호출하여 키 검증
- `agent_stream.go:305-309`: `agentStreamUpgrader.CheckOrigin`을 `security.ValidateWebSocketOrigin` 적용
- `agent_stream.go` 초기화: `NewAgentStreamHub()`에 `ValidateAPIKey` 함수 주입

**2_참조_추적:**
- `client.IsAgent` 플래그 참조: `agent_command`, `agent_choose_upgrade`, `observe_game` 이벤트 핸들러
- `apiKeyValidator` 참조: `auth.APIKeyAuth` 미들웨어 → `/api/agents/*` 전체 라우트
- `agentStreamUpgrader` 참조: `ServeAgentStream` 핸들러

**3_영향_범위:**
- 직접 영향: Agent 배포, 전략 설정, 배틀 로그 조회, Commander 모드 전체
- 간접 영향: Agent 실시간 스트림, Agent 게임 참여, 관전 모드

**4_부작용_위험:**
- 현재 테스트/개발에서 인증 없이 Agent를 사용 중일 경우, 검증 활성화 시 기존 워크플로 중단
- DB가 미연결 상태이므로 키 검증 구현 전에 DB 연결이 선행되어야 함

**5_동시_변경_필요사항:**
1. DB 연결 활성화 (`db.go` → `main.go` 초기화)
2. `api_keys` 테이블 마이그레이션 실행
3. 키 검증 함수 구현 (DB 조회 + 만료 확인)
4. 3개 경로에 검증 함수 주입
5. 기존 테스트 코드 업데이트

**6_수정_후_검증:**
- 보안 확인: 유효하지 않은 API 키로 Agent 인증 시도 → 거부 확인
- 보안 확인: 빈 API 키, 만료된 키, 형식 오류 키 → 모두 거부
- 회귀 테스트: 유효한 API 키로 Agent 배포/명령/스트림 → 정상 동작

---

### F-002: SSRF — 사용자 제어 LLM Base URL + 무제한 io.ReadAll

**메타데이터:**
- 아키텍처 차원: A6 (External Integration)
- 심각도: **CRITICAL**
- 위치: `server/internal/agent/llm_bridge.go:419-441` (SSRF), `llm_bridge.go:343,397,457` (io.ReadAll)
- 근본 원인: **코드** — 외부 URL 허용 목록 미적용 + 응답 크기 제한 미설정
- 참조: OWASP API10:2023 (SSRF), CWE-918

**구조적 이슈 설명:**

LLM 브릿지의 `callLlama` 함수가 `cfg.BaseURL`을 사용하여 HTTP POST 요청을 보내는데, 이 URL이 사용자 구성 가능할 경우 서버가 내부 네트워크의 임의 서비스에 요청을 보낼 수 있다. 또한 에러 응답에 대해 `io.ReadAll`을 크기 제한 없이 호출하여, 악의적 엔드포인트가 무한 응답을 보내면 서버 OOM이 발생한다.

**근거:**

```go
// llm_bridge.go:419-441
url := baseURL + "/chat/completions"
req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
// cfg.APIKey가 Authorization 헤더에 포함 → SSRF 대상에 키 노출

// llm_bridge.go:457
respBody, _ := io.ReadAll(resp.Body)  // ← 무제한 읽기
```

**수정 권고 및 영향 분석:**

**1_변경_대상:**
- `llm_bridge.go`: Base URL 허용 목록 (allowlist) 도입 — `https://api.together.xyz`, `https://api.openai.com` 등
- `llm_bridge.go:343,397,457`: `io.ReadAll` → `io.LimitReader(resp.Body, 4096)` 적용

**2_참조_추적:**
- `callLlama` 호출자: `LLMBridge.GetDecision` → Agent 자동 전투 의사결정
- `LLMConfig` 설정 경로: Agent REST API 또는 WebSocket을 통한 구성

**3_영향_범위:**
- 직접 영향: Agent AI 의사결정 시스템
- 간접 영향: LLM 에러 로깅, Agent 배틀 로그

**4_부작용_위험:**
- URL 허용 목록이 너무 엄격하면 새 LLM 프로바이더 추가 시 코드 변경 필요
- 에러 응답 잘림으로 디버깅 정보 손실 가능 (4KB면 충분)

**5_동시_변경_필요사항:**
- URL 허용 목록을 환경 변수 또는 설정 파일로 관리
- `callOpenAI` 함수에도 동일 패턴 적용

**6_수정_후_검증:**
- 보안 확인: 허용 목록 외 URL 설정 시 → 요청 거부 확인
- 보안 확인: 대용량 에러 응답 → 4KB로 잘림 확인
- 회귀 테스트: 정상 LLM API 호출 → 기존 동작 유지

---

### F-003: Faction Treasury 음수 값 입금으로 출금 인가 우회

**메타데이터:**
- 아키텍처 차원: A2 (Authorization) + A3 (Data Flow)
- 심각도: **CRITICAL**
- 위치: `server/internal/meta/faction.go` (deposit 핸들러)
- 근본 원인: **코드** — 입력 값 범위 검증 누락
- 참조: CWE-20 (Improper Input Validation)

**구조적 이슈 설명:**

Faction 시스템은 입금(Deposit)과 출금(Withdraw)의 권한을 분리했다. 출금은 SupremeLeader/Council 권한이 필요하지만, 입금은 일반 멤버도 가능하다. 그러나 입금 핸들러에서 `ResourceBundle`의 각 필드(Gold, Oil, Minerals 등)에 대한 **음수 값 검증이 없어**, 음수 입금을 통해 출금 권한 없이 자원을 빼낼 수 있다.

**근거:**

```go
// faction.go — deposit 핸들러
resources := ResourceBundle{
    Gold: req.Gold, Oil: req.Oil, Minerals: req.Minerals,
    Food: req.Food, Tech: req.Tech, Influence: req.Influence,
}
// ← 음수 검증 없음
if err := fm.DepositToTreasury(factionID, resources); err != nil { ... }
```

**수정 권고 및 영향 분석:**

**1_변경_대상:**
- `faction.go` deposit 핸들러: 모든 ResourceBundle 필드 `>= 0` 검증 추가
- 동일 패턴이 있는 모든 자원 핸들러에 동일 검증 적용

**2_참조_추적:**
- `DepositToTreasury` 호출자: HTTP deposit 핸들러
- `ResourceBundle` 사용처: deposit, withdraw, trade, war 자원 소비

**3_영향_범위:**
- 직접 영향: Faction 자금 관리 시스템
- 간접 영향: 무역, 전쟁 자원, 경제 시스템 전체

**4_부작용_위험:**
- 없음 — 양수 값만 허용하는 것은 비즈니스 로직과 일치

**5_동시_변경_필요사항:**
- `ResourceBundle`에 `Validate() error` 메서드 추가하여 모든 사용처에서 재사용

**6_수정_후_검증:**
- 보안 확인: 음수 값 입금 시도 → 400 Bad Request
- 회귀 테스트: 양수 값 입금 → 정상 동작

---

## HIGH — 48시간 내 조치

### F-004: v10/v11/v14 API 엔드포인트 대부분 인증 부재

**메타데이터:**
- 아키텍처 차원: A1 (Authentication) + A2 (Authorization)
- 심각도: **HIGH**
- 위치: `server/cmd/server/router.go` 전체 라우트 등록
- 근본 원인: **아키텍처** — 인증이 opt-in 방식 (개별 적용), opt-out 방식이 아님
- 참조: OWASP API2:2023, CWE-306 (Missing Authentication)

**구조적 이슈 설명:**

`/api/agents/*`만 `DualAuth` 미들웨어가 적용되고, 나머지 모든 API(`/api/agent/*`, `/api/player/*`, `/api/v11/*`, `/api/v14/*`)는 인증 없이 접근 가능하다. Agent 학습 프로필 설정(`PUT /api/agent/{id}/training`)은 누구나 임의 Agent의 설정을 변경할 수 있고, 플레이어 진행 상황, 퀘스트, 리더보드, v14 성능 통계(`/api/v14/perf`) 등이 모두 공개된다.

**근거:**
- `router.go`: `/api/v11/*` 그룹 — 인증 미들웨어 없음
- `router.go`: `/api/v14/*` 그룹 — 인증 미들웨어 없음
- `router.go:251-343`: Agent training PUT — 인증 없음
- `router.go:607-617`: `/api/v14/perf` — 틱 프로파일러 + 메모리 통계 노출

**수정 권고 및 영향 분석:**

**1_변경_대상:**
- 전체 라우터를 기본 인증 필수(opt-out) 구조로 전환
- 인증 면제 경로를 명시적 allowlist로 관리 (`/health`, `/ws`, `/rooms`)
- `/api/v14/perf`를 프로덕션에서 비활성화 또는 인증 필수로 변경

**2_참조_추적:**
- v11 라우트: Faction, War, Diplomacy, Trade, Council, Economy, Season 전체
- v14 라우트: 인게임 상태, 성능 통계, 에포크 시스템
- 프론트엔드: `fetch()` 호출 시 `Authorization: Bearer ${token}` 패턴 존재하나 토큰 발급 메커니즘 부재

**3_영향_범위:**
- 직접 영향: 모든 API 엔드포인트의 접근 제어
- 간접 영향: 프론트엔드 인증 플로우 구현 필요

**4_부작용_위험:**
- 프론트엔드에서 현재 인증 없이 API를 호출하므로, 인증 적용 시 프론트엔드 전면 수정 필요
- 인증 시스템(로그인/회원가입)이 먼저 구현되어야 함

**5_동시_변경_필요사항:**
1. DB 연결 활성화 (사용자 테이블)
2. 회원가입/로그인 API 구현
3. 프론트엔드 인증 플로우 (토큰 발급, 저장, 갱신)
4. 라우터 미들웨어 재구성

**6_수정_후_검증:**
- 보안 확인: 인증 없이 보호 API 호출 → 401 Unauthorized
- 보안 확인: allowlist 경로는 인증 없이 접근 가능
- 회귀 테스트: 인증 후 모든 API 정상 동작

---

### F-005: 전쟁 선포 인가 부재 + 입력 살균 함수 미적용

**메타데이터:**
- 아키텍처 차원: A2 (Authorization) + A4 (I/O Boundary)
- 심각도: **HIGH**
- 위치: `server/cmd/server/main.go:1230-1291` (전쟁), `server/internal/security/hardening.go:143-228` (살균 함수)
- 근본 원인: **코드** — 구현된 보안 함수의 호출 누락
- 참조: CWE-862 (Missing Authorization), CWE-20

**구조적 이슈 설명:**

1. **전쟁 선포**: WebSocket `declare_war` 이벤트에서 `payload.Attacker`와 `payload.Defender`를 클라이언트가 직접 지정하며, 선언자가 해당 국적에 소속되어 있는지 검증하지 않음. 아무 플레이어나 임의의 국가 간 전쟁을 선포 가능.
2. **살균 함수**: `SanitizeISO3()`, `SanitizeAgentName()`, `SanitizeFactionName()`이 `hardening.go`에 구현되어 있으나, 실제 요청 처리 경로에서 호출되지 않음. `JoinRoomPayload.Name`, `JoinCountryArenaPayload.Name` 등이 살균 없이 통과.

**근거:**

```go
// main.go:1230-1291 — 전쟁 선포
// payload.Attacker, payload.Defender를 클라이언트가 지정
// client와 Attacker 국적 간 소속 검증 없음

// Grep 결과: SanitizeISO3, SanitizeAgentName, SanitizeFactionName는
// hardening.go에서 정의만 되고 호출하는 코드 없음
```

**수정 권고 및 영향 분석:**

**1_변경_대상:**
- `main.go:1230`: `declare_war`에서 `client.Nationality == payload.Attacker` 검증 추가
- 모든 이벤트 핸들러에서 사용자 입력 필드에 살균 함수 적용:
  - `join_room`/`join_country_arena`: `SanitizeAgentName(name)`
  - ISO3 필드: `SanitizeISO3(countryISO)`
- `agent_routes.go:handleDeploy`: `SanitizeISO3(req.CountryISO)` 적용

**2_참조_추적:**
- `declare_war` 핸들러 → WarManager
- `join_room`/`join_country_arena` → Arena/WorldManager에 이름 전달 → 전체 클라이언트에 브로드캐스트

**3_영향_범위:**
- 직접: 전쟁 시스템 무결성, 플레이어 이름 표시
- 간접: XSS 방어 (이름이 다른 클라이언트에 렌더링됨)

**4_부작용_위험:**
- 살균으로 인해 기존 유효 이름이 잘리는 경우 발생 가능 (32자 제한)

**5_동시_변경_필요사항:**
- `client.Nationality` 필드가 정확히 설정되는지 확인 (join 시점)

**6_수정_후_검증:**
- 보안 확인: 타국 간 전쟁 선포 시도 → 거부
- 보안 확인: XSS 페이로드 이름 → 살균됨
- 회귀 테스트: 정상 이름/국적으로 참가 및 전쟁 선포 가능

---

### F-006: HTTP Rate Limiter 미적용 + 요청 본문 크기 미제한

**메타데이터:**
- 아키텍처 차원: A8 (Resource/Availability)
- 심각도: **HIGH**
- 위치: `server/internal/auth/middleware.go:185-299` (Rate Limiter), `server/internal/meta/*.go` (본문 크기)
- 근본 원인: **아키텍처** — 구현은 완료되었으나 미들웨어 체인에 미연결
- 참조: CWE-770 (Allocation without Limits), CWE-799

**구조적 이슈 설명:**

1. **Rate Limiter**: `auth/middleware.go`에 슬라이딩 윈도우 Rate Limiter가 완전히 구현되어 있으나, `router.go`에서 어떤 라우트에도 적용되지 않음.
2. **본문 크기**: `security.MaxBodyMiddleware`(1MB)가 최상위 미들웨어에 적용되어 있지만, `meta/` 하위의 v11 핸들러들은 자체 서브라우터에서 `json.NewDecoder(r.Body).Decode()` 호출 시 별도 크기 제한 없음. `MaxBodyMiddleware`가 서브라우터까지 전파되는지 확인 필요.

**근거:**
- `router.go`에서 `RateLimitMiddleware` import 또는 사용 없음
- `cache/channels.go`에 `RateLimitKey` 템플릿 정의 있으나 실제 Redis 기반 Rate Limiting 구현체 없음

**수정 권고 및 영향 분석:**

**1_변경_대상:**
- `router.go`: 인증 미필요 엔드포인트에 IP 기반 Rate Limiting 적용 (특히 `/api/v11/*`, `/api/v14/*`)
- 인증 필요 엔드포인트에 사용자 기반 Rate Limiting 적용
- LLM API 호출 경로에 별도 Rate Limiting (비용 제어)

**2_참조_추적:**
- `RateLimiter` → 모든 HTTP 라우트
- `RateLimitKey` → Redis 채널 패턴

**3_영향_범위:**
- 직접: 서버 가용성 + API 비용 제어
- 간접: 정상 사용자 트래픽에 영향 가능

**4_부작용_위험:**
- Rate limit 임계값이 너무 낮으면 정상 게임플레이 영향
- 인메모리 Rate Limiter는 Railway 컨테이너 단일 인스턴스에서는 유효하나 스케일아웃 시 무효

**5_동시_변경_필요사항:**
- Redis 연결 확인 후 Redis 기반 Rate Limiter 사용 권장

**6_수정_후_검증:**
- 보안 확인: 초당 100회 요청 → Rate Limit 응답 확인
- 회귀 테스트: 정상 속도 요청 → 통과

---

### F-007: 무제한 인메모리 맵 증가 — OOM 위험

**메타데이터:**
- 아키텍처 차원: A8 (Resource/Availability)
- 심각도: **HIGH**
- 위치: 다수 파일 (아래 표 참조)
- 근본 원인: **아키텍처** — TTL/용량 제한 없는 인메모리 저장 구조
- 참조: CWE-400 (Uncontrolled Resource Consumption)

**구조적 이슈 설명:**

서버가 DB 없이 전적으로 인메모리로 동작하며, 다수의 맵/슬라이스가 TTL이나 용량 제한 없이 무한 증가한다. 장기 실행 시 OOM이 불가피하며, 공격자가 Faction 생성, 전쟁 선포 등을 반복하면 가속화된다.

| 파일 | 맵/슬라이스 | 증가 패턴 |
|------|------------|-----------|
| `meta/war.go` | `wars`, `sieges` | 종료된 전쟁 미정리 |
| `meta/faction.go` | `factions`, `members`, `userFaction` | 생성 제한 없음 |
| `meta/achievement.go` | `records` | 플레이어당 무제한 |
| `meta/hall_of_fame.go` | `allEntries` | 시즌 누적 |
| `world/world_manager.go` | `playerCountry`, `spectatorCountry` | 연결당 1개 |
| `game/progression.go` | `progressions` | 플레이어당 1개 |

**수정 권고 및 영향 분석:**

**1_변경_대상:**
- 각 맵에 최대 용량(cap) + TTL 기반 만료(eviction) 로직 추가
- 종료된 전쟁/시즌 데이터를 주기적으로 정리하는 cleanup 고루틴 구현
- 장기적으로 DB 활성화하여 인메모리 의존도 제거

**2_참조_추적:**
- 모든 meta 매니저의 내부 맵

**3_영향_범위:**
- 직접: 서버 메모리 안정성
- 간접: 게임 전반의 데이터 영속성

**4_부작용_위험:**
- TTL이 너무 짧으면 활성 데이터 손실

**5_동시_변경_필요사항:**
- DB 활성화가 근본적 해결책

**6_수정_후_검증:**
- 보안 확인: 1000개 Faction 생성 후 메모리 사용량 안정 확인
- 회귀 테스트: 정상 게임플레이 중 데이터 유실 없음

---

### F-008: DB 보안 설정 부재 — 기본 비밀번호, SSL 비활성, RLS 없음

**메타데이터:**
- 아키텍처 차원: A5 (Secret Management) + A2 (Authorization)
- 심각도: **HIGH**
- 위치: `server/internal/db/db.go:30-32`, `server/internal/db/schema.sql`
- 근본 원인: **설정** — 프로덕션 강제 검사 범위 누락
- 참조: CWE-798 (Hardcoded Credentials), CWE-311

**구조적 이슈 설명:**

1. DB 비밀번호 기본값 `postgres` — `EnforceProductionSecrets()`에서 검사하지 않음
2. SSLMode 기본값 `disable` — 프로덕션에서도 암호화 없는 DB 연결 가능
3. `schema.sql`에 RLS(Row Level Security)가 없고, GRANT/REVOKE 설정 없음. 애플리케이션 사용자가 DB 슈퍼유저 권한으로 접속
4. `users` 테이블에 `api_keys TEXT[]` 필드가 존재하여 평문 키 저장 가능성 (별도 `api_keys` 테이블과 중복)

**수정 권고 및 영향 분석:**

**1_변경_대상:**
- `security/hardening.go:EnforceProductionSecrets()`에 `DB_PASSWORD` + `DB_SSLMODE` 검사 추가
- `db.go`: SSLMode 기본값을 `require`로 변경
- `schema.sql`: 애플리케이션 전용 DB 사용자 생성 + 테이블별 GRANT + 민감 테이블 RLS 추가
- `users` 테이블에서 `api_keys TEXT[]` 컬럼 제거

**2_참조_추적:**
- `EnforceProductionSecrets` → `main.go` 서버 시작
- `schema.sql` → 마이그레이션 파이프라인

**3_영향_범위:**
- 직접: DB 접근 보안
- 간접: 전체 데이터 무결성

**4_부작용_위험:**
- SSL 강제 시 로컬 개발 환경의 PostgreSQL이 SSL 미지원이면 연결 실패

**5_동시_변경_필요사항:**
- Railway PostgreSQL에서 SSL 인증서 설정 확인
- 마이그레이션 003 작성

**6_수정_후_검증:**
- 보안 확인: 기본 비밀번호로 프로덕션 시작 시 panic
- 보안 확인: SSL 없이 DB 연결 → 프로덕션에서 거부

---

## MEDIUM — 다음 스프린트

### F-009: JWT 토큰 폐기(Revocation) 메커니즘 부재

**메타데이터:**
- 아키텍처 차원: A1 (Authentication)
- 심각도: **MEDIUM**
- 위치: `server/internal/auth/jwt.go`
- 근본 원인: **아키텍처** — 토큰 블랙리스트/DB 확인 로직 미설계
- 참조: CWE-613

**구조적 이슈 설명:**
Access Token(24시간), Refresh Token(30일)이 발급 후 만료까지 폐기 불가. 로그아웃, 계정 탈퇴, 키 도난 시에도 토큰이 유효. Redis에 블랙리스트를 저장하거나 토큰 버전 관리가 필요.

**수정 권고 및 영향 분석:**

**1_변경_대상:** `jwt.go`에 Redis 기반 토큰 블랙리스트 추가
**2_참조_추적:** 모든 JWT 미들웨어 → `ValidateToken`
**3_영향_범위:** 로그아웃, 보안 이벤트 대응
**4_부작용_위험:** Redis 장애 시 블랙리스트 확인 불가 → 허용(fail-open) 또는 거부(fail-close) 정책 결정 필요
**5_동시_변경_필요사항:** Redis 연결 필수
**6_수정_후_검증:** 블랙리스트 등록 토큰 → 거부 확인

---

### F-010: CSP 설정 부족 — unsafe-eval 허용 + 프론트엔드 CSP 미설정

**메타데이터:**
- 아키텍처 차원: A4 (I/O Boundary)
- 심각도: **MEDIUM**
- 위치: `server/internal/security/hardening.go:56`, `apps/web/next.config.ts`
- 근본 원인: **설정**
- 참조: CWE-1021

**구조적 이슈 설명:**
서버 CSP에 `'unsafe-eval'`이 포함되어 있고, 프론트엔드(Vercel) 측 CSP 헤더가 설정되지 않음. `next.config.ts`와 `vercel.json`에 `X-Frame-Options`, `X-Content-Type-Options`는 있으나 CSP는 없음. 서버 CSP가 API 응답에만 적용되고 Vercel의 정적 페이지에는 적용되지 않는 구조.

**수정 권고 및 영향 분석:**

**1_변경_대상:** `next.config.ts` headers에 CSP 추가, 프로덕션에서 `unsafe-eval` 제거
**2_참조_추적:** `vercel.json` 헤더, `next.config.ts` 헤더
**3_영향_범위:** XSS 방어 전체
**4_부작용_위험:** R3F/Three.js가 `eval`을 사용할 경우 렌더링 중단 가능
**5_동시_변경_필요사항:** nonce 기반 스크립트 로딩 검토
**6_수정_후_검증:** CSP 위반 리포트 확인, 게임 정상 렌더링 확인

---

### F-011: WebSocket 이벤트 Rate Limiting 부분 적용

**메타데이터:**
- 아키텍처 차원: A8 (Resource/Availability)
- 심각도: **MEDIUM**
- 위치: `server/internal/ws/client.go:32-71`
- 근본 원인: **코드** — `input`/`respawn`/`ping`만 적용
- 참조: CWE-799

**구조적 이슈 설명:**
`input`(30Hz), `respawn`(0.5Hz), `ping`(5Hz)만 rate limit이 적용되고, `join_room`, `leave_room`, `declare_war`, `switch_arena`, `agent_auth`, 모든 `get_*` 이벤트는 무제한 호출 가능. 특히 `declare_war`는 서버 상태를 변경하는 이벤트임에도 rate limit이 없음.

**수정 권고 및 영향 분석:**

**1_변경_대상:** `client.go` rate limit 맵에 `join_room`(1Hz), `leave_room`(1Hz), `declare_war`(0.1Hz), `switch_arena`(0.5Hz), `get_*`(2Hz) 추가
**2_참조_추적:** `ws/protocol.go` 이벤트 라우터
**3_영향_범위:** WebSocket 안정성
**4_부작용_위험:** 정상 게임플레이에서 빈번한 방 이동 시 제한될 수 있음
**5_동시_변경_필요사항:** 없음
**6_수정_후_검증:** 초당 10회 `declare_war` → rate limit 응답

---

### F-012: /metrics 엔드포인트 + 에러 메시지를 통한 정보 노출

**메타데이터:**
- 아키텍처 차원: A7 (Error/Observability)
- 심각도: **MEDIUM**
- 위치: `server/cmd/server/router.go` (/metrics), `server/internal/api/agent_routes.go:232`
- 근본 원인: **설정** + **코드**
- 참조: CWE-200 (Information Exposure)

**구조적 이슈 설명:**
1. `/metrics`가 인증 없이 Prometheus 메트릭(플레이어 수, 틱 레이턴시, 메모리, 고루틴 등) 노출
2. `agent_routes.go:232`에서 내부 에러 메시지를 `writeError`로 클라이언트에 직접 반환
3. `agent_stream.go`에서 인증 실패 시 에러 메시지에 구현 세부 정보 포함

**수정 권고 및 영향 분석:**

**1_변경_대상:** `/metrics`에 인증 또는 내부 네트워크 바인딩, 에러 메시지 일반화
**2_참조_추적:** Prometheus 스크래퍼, 프론트엔드 에러 핸들링
**3_영향_범위:** 정찰 정보 차단
**4_부작용_위험:** 모니터링 시스템이 인증을 지원해야 함
**5_동시_변경_필요사항:** 없음
**6_수정_후_검증:** `/metrics` 미인증 접근 → 401, 에러 응답에 내부 정보 미포함

---

### F-013: contracts/ 및 forge_token_deploy/ .gitignore 부재

**메타데이터:**
- 아키텍처 차원: A5 (Secret Management)
- 심각도: **MEDIUM**
- 위치: `contracts/`, `forge_token_deploy/`
- 근본 원인: **프로세스**
- 참조: CWE-312

**구조적 이슈 설명:**
1. `contracts/`에 `.gitignore` 없음 — `forge script --broadcast` 실행 시 `broadcast/` 디렉토리에 서명된 트랜잭션 데이터 생성, 커밋 위험
2. `forge_token_deploy/`에 `.gitignore` 없음 — `dotenv/config`로 `CLIENT_KEY`/`CLIENT_SECRET` 사용하는데 `.env` 파일 보호 불확실

**수정 권고 및 영향 분석:**

**1_변경_대상:** 각 디렉토리에 `.gitignore` 추가 (`broadcast/`, `out/`, `cache/`, `.env`)
**2_참조_추적:** 없음
**3_영향_범위:** 시크릿 노출 방지
**4_부작용_위험:** 없음
**5_동시_변경_필요사항:** 없음
**6_수정_후_검증:** `git status`에서 해당 디렉토리 파일 무시 확인

---

## LOW — 인지 후 백로그 등록

### F-014: Gemini API Key가 .env.local에 존재

**메타데이터:**
- 아키텍처 차원: A5 (Secret Management)
- 심각도: **LOW** (git-ignored이며 NEXT_PUBLIC_ 미접두)
- 위치: `apps/web/.env.local:2`
- 근본 원인: **프로세스**

`.env.local`에 `GEMINI_API_KEY=AIzaSy...` 존재. `.gitignore`에 의해 커밋 제외되고 `NEXT_PUBLIC_` 접두사 없어 클라이언트 번들 미포함. 그러나 코드 어디에서도 참조되지 않으므로 불필요한 시크릿. **키 로테이션 후 제거 권장.**

---

### F-015: 에러 핸들링에서 스택 트레이스 미로깅 + math/rand 사용

**메타데이터:**
- 아키텍처 차원: A7 (Error/Observability)
- 심각도: **LOW**
- 위치: `game/arena.go:103`, `game/room.go:137`, `game/bot.go`, `game/orb.go`

1. Panic recovery에서 `recover()` 값만 로깅하고 스택 트레이스 미포함 → 프로덕션 디버깅 어려움
2. `math/rand`가 게임 로직에 사용됨 — 게임 목적으로는 적절하나 시드가 노출되면 예측 가능

## 건전한 아키텍처 패턴

| 패턴 | 위치 | 평가 |
|------|------|------|
| JWT 서명 알고리즘 검증 | `auth/jwt.go:83-86` | HMAC만 허용 — `alg:none` 공격 차단 |
| Refresh/Access 토큰 분리 | `auth/jwt.go:112` | Issuer 구분으로 혼용 방지 |
| API Key SHA-256 해싱 | `auth/apikey.go:62-65` | 평문 키 미저장 구조 |
| API Key crypto/rand 생성 | `auth/apikey.go:41-59` | 256비트 엔트로피 |
| 프로덕션 시크릿 강제 | `security/hardening.go:116-141` | JWT + CORS panic 검사 |
| WebSocket 메시지 크기 제한 | `ws/client.go:22-23` | 64KB 상한 |
| WS 이벤트별 Rate Limiting | `ws/client.go:32-71` | input/respawn/ping 제한 |
| Slow Client 퇴출 | `ws/hub.go:274-282` | 느린 소비자로 인한 메모리 고갈 방지 |
| Panic Recovery | `game/arena.go:103`, `game/room.go:137` | 단일 메시지로 서버 크래시 방지 |
| 요청 본문 1MB 제한 | `security/hardening.go:40-47` | 최상위 미들웨어 적용 |
| Docker 비루트 실행 | `server/Dockerfile` | `appuser` 사용, 멀티스테이지 빌드 |
| CORS 특정 오리진만 허용 | `router.go:151-158` | 와일드카드 차단, 프로덕션 검증 |
| WebSocket 오리진 검증 | `router.go:117` | `security.ValidateWebSocketOrigin` 적용 |
| .gitignore 포괄적 설정 | `.gitignore` | `.env*`, `.vercel/`, `node_modules/` 등 |
| 보안 헤더 설정 | `vercel.json` + `hardening.go` | X-Frame-Options, X-Content-Type, Referrer-Policy, Permissions-Policy |
| DB 연결 풀 제한 | `db/db.go:59-62` | MaxOpen 25, 생명주기 관리 |
| OpenZeppelin 계약 사용 | `contracts/src/` | ERC20, Ownable, Permit, Burnable |
| Context 기반 고루틴 관리 | `game/arena.go`, `game/room.go` | 깔끔한 종료 보장 |
| Mutex 일관 적용 | 전체 `meta/`, `game/`, `world/` | 공유 상태 보호 |
| Arena 풀링 + 50개 상한 | `world/world_manager.go` | 리소스 제어 |

## 개선 우선순위 로드맵

| 우선순위 | 발견사항 | 차원 | 근본 원인 | 예상 공수 | 기한 |
|----------|----------|------|-----------|-----------|------|
| **P0** | F-001 Agent 인증 전면 무효 | A1 | 아키텍처 | 8h | 오늘 |
| **P0** | F-002 SSRF + io.ReadAll | A6 | 코드 | 2h | 오늘 |
| **P0** | F-003 Faction 음수값 악용 | A2+A3 | 코드 | 1h | 오늘 |
| **P1** | F-004 API 인증 부재 | A1+A2 | 아키텍처 | 16h | 2일 |
| **P1** | F-005 전쟁 인가 + 살균 미적용 | A2+A4 | 코드 | 4h | 2일 |
| **P1** | F-006 Rate Limiter 미적용 | A8 | 아키텍처 | 4h | 2일 |
| **P1** | F-007 무제한 인메모리 맵 | A8 | 아키텍처 | 8h | 3일 |
| **P1** | F-008 DB 보안 설정 | A5+A2 | 설정 | 4h | 3일 |
| **P2** | F-009 JWT 폐기 메커니즘 | A1 | 아키텍처 | 4h | 다음 스프린트 |
| **P2** | F-010 CSP 보완 | A4 | 설정 | 2h | 다음 스프린트 |
| **P2** | F-011 WS Rate Limiting 확장 | A8 | 코드 | 2h | 다음 스프린트 |
| **P2** | F-012 /metrics 인증 + 에러 일반화 | A7 | 설정+코드 | 3h | 다음 스프린트 |
| **P2** | F-013 .gitignore 추가 | A5 | 프로세스 | 0.5h | 다음 스프린트 |
| **P3** | F-014 Gemini Key 로테이션 | A5 | 프로세스 | 0.5h | 백로그 |
| **P3** | F-015 스택 트레이스 로깅 | A7 | 코드 | 1h | 백로그 |

### 권장 실행 순서

```
Phase 1 (즉시): F-002, F-003 → 단독 코드 수정, 의존성 없음
Phase 2 (1-2일): F-001 → DB 연결 활성화 + 키 검증 구현 (F-004의 전제조건)
Phase 3 (2-3일): F-004, F-005 → 인증 체계 전면 구축 (F-001 완료 후)
Phase 4 (3-5일): F-006, F-007, F-008 → 가용성 + DB 보안
Phase 5 (다음 스프린트): F-009~F-013 → 방어 심층화
Phase 6 (백로그): F-014, F-015 → 운영 개선
```

---

*이 리포트는 정적 소스 코드 분석에 기반하며, 동적 테스트(DAST)나 침투 테스트를 대체하지 않습니다.*
*코드 수정은 이 리포트에서 수행하지 않으며, 개발자가 직접 또는 `/da:dev` 등 다른 명령으로 실행해야 합니다.*
