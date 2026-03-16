---
name: forge-token-deployer
description: Forge 용 ERC20 토큰 배포 (clientKey 인증, 프론트엔드 연동용). 포지 풀 생성은 프론트엔드에서 유저가 직접 진행.
---

# Forge Token Deployer Skill

clientKey 인증을 통해 RampConsole 플랫폼에 토큰을 배포합니다.
포지(Forge) 풀 생성은 프론트엔드에서 유저가 직접 진행합니다.

## 빠른 시작

이 스킬 폴더에 포함된 CLI 도구를 사용하여 토큰을 배포합니다.

### 1. 환경변수 설정

`.env` 파일을 생성하고 클라이언트 인증 정보를 설정합니다:

```
CLIENT_KEY=your-client-key
CLIENT_SECRET=your-client-secret
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 토큰 배포 실행

```bash
node deploy-token.js <토큰명> <심볼> <토큰설명> <이미지URL> <유저지갑> <프로젝트명>
```

### 예시

```bash
node deploy-token.js "MyToken" "MTK" "A fun token" "https://example.com/token.png" "0x1234..." "MyProject"
```

## 에이전트 실행 가이드

사용자가 토큰 배포를 요청하면 다음 순서로 진행합니다:

### Step 1: 사용자로부터 정보 수집

| 필드 | 설명 | 예시 |
|------|------|------|
| 토큰명 | 토큰의 이름 | "MyToken" |
| 심볼 | 토큰 심볼 (대문자 권장) | "MTK" |
| 토큰설명 | 토큰 설명 | "A fun community token" |
| 이미지URL | 토큰 이미지 URL (PNG) | "https://example.com/token.png" |
| 유저지갑 | 토큰 소유자 지갑 주소 | "0x1234..." |
| 프로젝트명 | 프로젝트 이름 | "MyProject" |

> CLIENT_KEY, CLIENT_SECRET은 `.env` 파일에 사전 설정되어 있어야 합니다.

### Step 2: 의존성 설치 (최초 1회)

```bash
npm install
```

### Step 3: 스크립트 실행

```bash
node deploy-token.js "토큰명" "심볼" "토큰설명" "이미지URL" "유저지갑" "프로젝트명"
```

### Step 4: 결과 전달

스크립트 완료 후 `deployToken` 함수는 다음 객체를 반환합니다:

```javascript
{
  tokenAddress: string,    // 토큰 컨트랙트 주소
  tradeLink: string,       // 거래 링크 (포지 풀 생성 후 유효)
}
```

사용자에게 다음 정보를 전달합니다:
- `tokenAddress`: 토큰 주소
- `tradeLink`: 거래 링크 (포지 풀 생성 후에야 접근 가능)
  - `https://x.crosstoken.io/forge/token/{토큰주소}`
- 포지 풀 생성은 프론트엔드에서 유저가 직접 진행해야 합니다.

## 출력 예시

```
========================================
       토큰 배포 완료!
========================================
토큰 이름: MyToken (MTK)
토큰 주소: 0xe4216e459728D8669fba7d80EEF3748F4cD34D91
거래 링크: https://x.crosstoken.io/forge/token/0xe4216e459728D8669fba7d80EEF3748F4cD34D91 (포지 풀 생성 후 유효)
========================================

⚠️  포지 풀 생성은 프론트엔드에서 유저가 직접 진행해야 합니다.
⚠️  거래 링크는 포지 풀 생성 후에 접근 가능합니다.
```

## 기술 상세

### 배포 플로우

```
1. .env에서 CLIENT_KEY, CLIENT_SECRET 로드
2. Client MCP Builder API (/api/client/mcp/builder) 호출 → 토큰 주소 획득
3. 결과 출력 (토큰 주소, 거래 링크)
```

> ⚠️ **주의**: 이 스크립트는 토큰 배포만 수행합니다. 포지 풀 생성은 프론트엔드에서 유저가 직접 진행해야 합니다.

### 인증

API 호출 시 `Authorization: API-Key {clientKey}:{clientSecret}` 헤더로 인증합니다.

### 설정값

| 항목 | 값 |
|------|-----|
| API Base URL | `https://cross-console-api.crosstoken.io` |
| API Endpoint | `/api/client/mcp/builder` |
| Trade URL | `https://x.crosstoken.io/forge/token` |

## 주의사항

1. **환경변수 필수**: `.env` 파일에 `CLIENT_KEY`, `CLIENT_SECRET` 설정 필요
2. **이미지 형식**: PNG만 지원
3. **심볼 중복**: 이미 존재하는 심볼은 사용 불가 (case-insensitive)
4. **포지 풀 별도**: 토큰 배포 후 포지 풀 생성은 프론트엔드에서 유저가 직접 진행

## 폴더 구조

```
├── SKILL.md           # 이 파일 (사용 가이드)
├── SKILL_EN.md        # 영문 가이드
├── deploy-token.js    # 배포 CLI 스크립트
└── package.json       # 의존성 정의
```
