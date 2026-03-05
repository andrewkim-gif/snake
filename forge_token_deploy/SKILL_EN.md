---
name: forge-token-deployer
description: Deploy ERC20 tokens for Forge (clientKey authentication, frontend integration). Forge pool creation is handled by the user on the frontend.
---

# Forge Token Deployer Skill

Deploy tokens on the RampConsole platform using clientKey authentication.
Forge pool creation is handled separately by the user on the frontend.

## Quick Start

Use the CLI tool included in this skill folder to deploy tokens.

### 1. Set Environment Variables

Create a `.env` file with your client credentials:

```
CLIENT_KEY=your-client-key
CLIENT_SECRET=your-client-secret
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Token Deployment

```bash
node deploy-token.js <tokenName> <symbol> <tokenDescription> <imageURL> <userWallet> <projectName>
```

### Example

```bash
node deploy-token.js "MyToken" "MTK" "A fun token" "https://example.com/token.png" "0x1234..." "MyProject"
```

## Agent Execution Guide

When a user requests token deployment, follow these steps:

### Step 1: Collect Information from User

| Field | Description | Example |
|-------|-------------|---------|
| Token Name | Name of the token | "MyToken" |
| Symbol | Token symbol (uppercase recommended) | "MTK" |
| Token Description | Token description | "A fun community token" |
| Image URL | Token image URL (PNG format) | "https://example.com/token.png" |
| User Wallet | Token owner wallet address | "0x1234..." |
| Project Name | Project name | "MyProject" |

> CLIENT_KEY and CLIENT_SECRET must be pre-configured in the `.env` file.

### Step 2: Install Dependencies (First Time Only)

```bash
npm install
```

### Step 3: Run the Script

```bash
node deploy-token.js "TokenName" "SYMBOL" "Token Description" "ImageURL" "UserWallet" "ProjectName"
```

### Step 4: Deliver Results

After the script completes, the `deployToken` function returns the following object:

```javascript
{
  tokenAddress: string,    // Token contract address
  tradeLink: string,       // Trade link (valid after Forge pool is created)
}
```

Provide the following information to the user:
- `tokenAddress`: Token address
- `tradeLink`: Trade link (only accessible after Forge pool is created)
  - `https://x.crosstoken.io/forge/token/{tokenAddress}`
- Forge pool creation must be done by the user on the frontend.

## Output Example

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

## Technical Details

### Deployment Flow

```
1. Load CLIENT_KEY, CLIENT_SECRET from .env
2. Call Client MCP Builder API (/api/client/mcp/builder) → Get token address
3. Output results (token address, trade link)
```

> ⚠️ **Note**: This script only deploys the token. Forge pool creation must be done by the user on the frontend.

### Authentication

API calls are authenticated via `Authorization: API-Key {clientKey}:{clientSecret}` header.

### Configuration Values

| Item | Value |
|------|-------|
| API Base URL | `https://cross-console-api.crosstoken.io` |
| API Endpoint | `/api/client/mcp/builder` |
| Trade URL | `https://x.crosstoken.io/forge/token` |

## Notes

1. **Environment Variables Required**: `CLIENT_KEY` and `CLIENT_SECRET` must be set in `.env`
2. **Image Format**: Only PNG supported
3. **Symbol Uniqueness**: Existing symbols cannot be used (case-insensitive)
4. **Forge Pool Separate**: After token deployment, Forge pool creation is handled by the user on the frontend

## Folder Structure

```
├── SKILL.md           # Korean guide
├── SKILL_EN.md        # English guide (this file)
├── deploy-token.js    # Deployment CLI script
└── package.json       # Dependencies
```
