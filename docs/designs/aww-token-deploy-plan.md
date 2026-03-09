# PLAN: $AWW 마스터 토큰 CROSS Forge 배포

> **Date**: 2026-03-09
> **Status**: Draft
> **Author**: da:plan
> **Next**: 기획 승인 → 실행

---

## 1. 개요

AI World War 게임의 마스터 거버넌스 토큰 **$AWW**를 CROSS Forge 플랫폼에 배포한다.
기존 `forge_token_deploy` CLI 도구를 활용하여 CROSS Console API를 통해 원클릭 배포하고,
배포된 토큰을 게임 토큰 이코노미의 기축 통화로 연동한다.

### 배경
- v11 설계에 듀얼 토큰 이코노미 ($AWW + 195개 국가 토큰) 완성
- 스마트 컨트랙트, Go 서버, React UI 모두 코드 완성 상태
- **실제 온체인 배포가 0건** — 이번에 첫 실물 토큰 배포

### 핵심 목표
1. $AWW 토큰을 CROSS Forge에 실배포
2. Forge Pool 생성하여 거래 활성화
3. 게임 서버/클라이언트에 배포된 토큰 주소 연동
4. 토큰 이코노미 파이프라인 (Defense Oracle → Buyback → Staking) 실동작 검증

---

## 2. 요구사항

### 기능 요구사항
- [FR-1] `forge_token_deploy` CLI로 $AWW 토큰 CROSS 체인 배포
- [FR-2] 배포된 토큰 주소를 게임 환경변수/설정에 반영
- [FR-3] 클라이언트 WalletConnect → $AWW 잔액 조회 동작 확인
- [FR-4] Forge Pool 생성 → 거래 링크 활성화

### 비기능 요구사항
- [NFR-1] 배포 과정 문서화 (재현 가능)
- [NFR-2] API 키 보안 관리 (.env, gitignore 확인)
- [NFR-3] 토큰 이미지 PNG 형식, 512x512 이상 권장

---

## 3. 기술 방향

### 배포 인프라
- **체인**: CROSS Mainnet (EVM-compatible)
- **배포 도구**: `forge_token_deploy/deploy-token.js` (이미 완성)
- **API**: CROSS Console MCP Builder API (`POST /api/client/mcp/builder`)
- **인증**: CLIENT_KEY:CLIENT_SECRET (API-Key 헤더)

### $AWW 토큰 스펙

| 항목 | 값 |
|------|-----|
| **이름** | AI World War |
| **심볼** | AWW |
| **설명** | AI World War master governance token. Powers the global war economy across 195 nations. |
| **이미지** | 토큰 로고 PNG (Gemini 생성 or 기존 에셋 활용) |
| **소유자** | 사용자 제공 지갑 주소 |
| **프로젝트명** | AIWorldWar |

### Forge 배포 vs 기존 Foundry 컨트랙트 비교

| 항목 | Forge 배포 (이번) | Foundry 컨트랙트 (기존 코드) |
|------|-------------------|------------------------------|
| **방식** | CROSS Console API 원클릭 | forge script + DeployAll.s.sol |
| **토큰 유형** | 표준 ERC-20 (Forge 플랫폼 관리) | 커스텀 ERC-20 (Burnable, Permit, Vesting) |
| **Supply** | Forge 기본 (플랫폼 결정) | 1B 고정 + 팀 베스팅 |
| **추가 기능** | Forge Pool 거래, DEX 즉시 등록 | Treasury, Oracle, Governance 연동 |
| **적합 용도** | **MVP 토큰 이코노미 검증** | 프로덕션 본배포 |

> **전략**: Forge로 먼저 MVP 배포 → 토큰 이코노미 파이프라인 검증 → 이후 Foundry 커스텀 컨트랙트로 본배포 마이그레이션

---

## 4. CROSS Console API 키 발급 가이드

### Step 1: CROSS Console 접속
```
https://console.crosstoken.io
```

### Step 2: 계정 생성/로그인
- 이메일 또는 CROSSx 지갑으로 로그인
- 프로젝트 생성: "AIWorldWar"

### Step 3: API 키 발급
1. Console → **Settings** → **API Keys**
2. **Create New Key** 클릭
3. Key Name: `aww-token-deploy`
4. Permissions: `token:deploy`, `token:read`
5. 생성된 `CLIENT_KEY`와 `CLIENT_SECRET` 복사

### Step 4: .env 설정
```bash
# forge_token_deploy/.env
CLIENT_KEY=발급받은_클라이언트_키
CLIENT_SECRET=발급받은_시크릿_키
```

> ⚠️ `.env` 파일은 절대 git에 커밋하지 않습니다. `.gitignore`에 포함되어 있는지 확인 필요.

---

## 5. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────┐
│                    배포 파이프라인                         │
│                                                         │
│  [1] forge_token_deploy CLI                             │
│       │                                                 │
│       ▼                                                 │
│  [2] CROSS Console API ──→ $AWW 토큰 온체인 배포          │
│       │                                                 │
│       ▼                                                 │
│  [3] Token Address 획득                                  │
│       │                                                 │
│       ├──→ [4a] 게임 서버 환경변수 반영                    │
│       │         (AWW_TOKEN_ADDRESS)                      │
│       │                                                 │
│       ├──→ [4b] 클라이언트 crossx-config.ts 반영           │
│       │         (contractAddresses.awwToken)             │
│       │                                                 │
│       └──→ [4c] Forge Pool 생성 (수동, 프론트엔드)         │
│                  → 거래 링크 활성화                        │
│                                                         │
│  [5] 검증: WalletConnect → 잔액 조회 → Defense Oracle     │
└─────────────────────────────────────────────────────────┘
```

---

## 6. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| API 키 미발급/인증 실패 | 배포 불가 | Console 접속 확인, 키 유효성 테스트 |
| 토큰 심볼 AWW 중복 | 배포 실패 | 대안 심볼 준비 (AIWW, AWW1) |
| Forge 토큰 Supply 불일치 | 이코노미 수치 안 맞음 | MVP용으로 수치 조정, 본배포 시 Foundry 사용 |
| .env 유출 | API 키 탈취 | .gitignore 확인, 키 rotation 정책 |
| 토큰 이미지 미준비 | 배포 시 placeholder | Gemini로 로고 생성 또는 기존 에셋 활용 |

---

## 구현 로드맵
<!-- ★ da:work Stage 0 파싱 대상 -->

### Phase 1: 배포 환경 준비
| Task | 설명 |
|------|------|
| API 키 설정 | CROSS Console에서 API 키 발급 → `.env` 파일 생성 |
| 의존성 설치 | `cd forge_token_deploy && npm install` |
| .gitignore 확인 | `.env` 파일이 gitignore에 포함되어 있는지 검증 |
| 토큰 이미지 준비 | $AWW 토큰 로고 PNG 생성 (Gemini 또는 기존 에셋) |

- **design**: N (환경 설정)
- **verify**: `npm install` 성공, `.env` 파일 존재, 이미지 URL 접근 가능

### Phase 2: $AWW 토큰 Forge 배포
| Task | 설명 |
|------|------|
| CLI 배포 실행 | `node deploy-token.js "AI World War" "AWW" "..." "이미지URL" "지갑주소" "AIWorldWar"` |
| 배포 결과 기록 | 토큰 주소, 거래 링크를 문서에 기록 |
| Explorer 확인 | CROSS Explorer에서 토큰 컨트랙트 확인 |

- **design**: N (CLI 실행)
- **verify**: 토큰 주소 반환, Explorer에서 토큰 확인 가능

### Phase 3: 게임 연동 설정
| Task | 설명 |
|------|------|
| 서버 환경변수 | `AWW_TOKEN_ADDRESS` 환경변수에 배포된 주소 설정 |
| 클라이언트 설정 | `crossx-config.ts`의 `contractAddresses.awwToken`에 주소 반영 |
| 상수 파일 업데이트 | 배포된 토큰 정보를 shared constants에 추가 |

- **design**: N (설정 반영)
- **verify**: 서버/클라이언트 빌드 성공, 주소 참조 정상

### Phase 4: Forge Pool 생성 및 거래 활성화
| Task | 설명 |
|------|------|
| Forge Pool 생성 | CROSS Forge 프론트엔드에서 풀 생성 (수동) |
| 거래 링크 검증 | `https://x.crosstoken.io/forge/token/{주소}` 접속 확인 |
| 초기 유동성 제공 | 풀에 초기 유동성 공급 (금액 결정 필요) |

- **design**: N (프론트엔드 수동 작업)
- **verify**: 거래 링크 접근 가능, 풀에 유동성 존재

### Phase 5: 토큰 이코노미 파이프라인 검증
| Task | 설명 |
|------|------|
| WalletConnect 테스트 | CROSSx 연결 → $AWW 잔액 표시 확인 |
| Defense Oracle 테스트 | 시가총액 → 방어 버프 계산 파이프라인 동작 확인 |
| 토큰 대시보드 | Economy 페이지에서 $AWW 정보 표시 확인 |

- **design**: N (검증 중심)
- **verify**: 잔액 조회 성공, Oracle 버프 계산 정상, 대시보드 렌더링

---

## 배포 커맨드 (Phase 2 실행 시)

```bash
# 1. 의존성 설치
cd /Users/andrew.kim/Desktop/snake/forge_token_deploy
npm install

# 2. 토큰 배포
node deploy-token.js \
  "AI World War" \
  "AWW" \
  "AI World War master governance token. Powers the global war economy across 195 nations with defense buffs, staking rewards, and quadratic governance." \
  "토큰이미지URL" \
  "사용자지갑주소" \
  "AIWorldWar"
```

---

## 향후 계획 (본배포 로드맵)

| 단계 | 내용 | 시기 |
|------|------|------|
| **MVP (이번)** | Forge로 $AWW 배포 + 기본 이코노미 검증 | 즉시 |
| **Phase 10a** | Foundry로 커스텀 $AWW 본배포 (Burnable, Vesting, Permit) + S-tier 8개국 토큰 | 게임 안정화 후 |
| **Phase 10b** | A+B tier 60개국 토큰 배포 | 2주+ 안정 운영 후 |
| **Phase 10c** | C+D tier 127개국 토큰 배포 | Season 2+ |

---

## 체크리스트

- [ ] CROSS Console API 키 발급
- [ ] `.env` 파일 생성 및 설정
- [ ] `npm install` 실행
- [ ] 토큰 이미지 준비 (PNG, 512x512+)
- [ ] 지갑 주소 확인
- [ ] `deploy-token.js` 실행 → 토큰 주소 획득
- [ ] Explorer에서 토큰 확인
- [ ] 게임 설정 파일에 토큰 주소 반영
- [ ] Forge Pool 생성
- [ ] WalletConnect → 잔액 조회 테스트
