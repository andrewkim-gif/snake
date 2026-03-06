#!/usr/bin/env node
import "dotenv/config";

// ============================================
// CrossToken 토큰 배포 CLI (MCP, 프론트엔드 연동용)
// 
// 환경변수:
//   CLIENT_KEY    - API 인증 클라이언트 키
//   CLIENT_SECRET - API 인증 클라이언트 시크릿
//
// 사용법:
//   node deploy-token.js <토큰명> <심볼> <토큰설명> <이미지URL> <유저지갑> <프로젝트명>
//
// 예시:
//   node deploy-token.js "MyToken" "MTK" "A fun token" "https://example.com/token.png" "0x1234..." "MyProject"
// ============================================

const ENV = {
  API_BASE: "https://cross-console-api.crosstoken.io",
  TRADE_URL: "https://x.crosstoken.io/forge/token",
};

async function deployToken(clientKey, clientSecret, tokenName, tokenSymbol, tokenDescription, imageUrl, owner, projectName) {
  console.log("\n=== CrossToken 토큰 배포 시작 ===\n");
  console.log(`토큰명: ${tokenName}`);
  console.log(`심볼: ${tokenSymbol}`);
  console.log(`토큰설명: ${tokenDescription}`);
  console.log(`이미지: ${imageUrl}`);
  console.log(`유저지갑: ${owner}`);
  console.log(`프로젝트명: ${projectName}\n`);

  console.log("Step 1: Client MCP Builder API 호출");
  const payload = {
    owner: owner,
    project_name: projectName,
    token: { name: tokenName, symbol: tokenSymbol, image_url: imageUrl },
    token_description: tokenDescription,
  };

  const response = await fetch(`${ENV.API_BASE}/api/client/mcp/builder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `API-Key ${clientKey}:${clientSecret}`,
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  const result = await response.json();
  if (result.code !== 200) {
    throw new Error(`API Error: ${result.message}`);
  }

  const tokenAddress = result.data.token_address;
  console.log(`✓ Token Address: ${tokenAddress}\n`);

  const tradeLink = `${ENV.TRADE_URL}/${tokenAddress}`;

  const output = {
    tokenAddress,
    tradeLink,
  };

  console.log("========================================");
  console.log("       토큰 배포 완료!");
  console.log("========================================");
  console.log(`토큰 이름: ${tokenName} (${tokenSymbol})`);
  console.log(`토큰 주소: ${tokenAddress}`);
  console.log(`거래 링크: ${tradeLink} (포지 풀 생성 후 유효)`);
  console.log("========================================");
  console.log(JSON.stringify(output, null, 2));
  console.log("\n⚠️  포지 풀 생성은 프론트엔드에서 유저가 직접 진행해야 합니다.");
  console.log("⚠️  거래 링크는 포지 풀 생성 후에 접근 가능합니다.\n");
  console.log("========================================\n");

  return output;
}

function printUsage() {
  console.log(`
CrossToken 토큰 배포 CLI

환경변수:
  CLIENT_KEY    - API 인증 클라이언트 키
  CLIENT_SECRET - API 인증 클라이언트 시크릿

사용법:
  node deploy-token.js <토큰명> <심볼> <토큰설명> <이미지URL> <유저지갑> <프로젝트명>

예시:
  node deploy-token.js "MyToken" "MTK" "A fun token" "https://example.com/token.png" "0x1234..." "MyProject"

인자:
  토큰명      - 토큰의 이름 (예: "MyToken")
  심볼        - 토큰 심볼 (예: "MTK")
  토큰설명    - 토큰 설명 (예: "A fun community token")
  이미지URL   - 토큰 이미지 URL (PNG 형식)
  유저지갑    - 토큰 소유자 지갑 주소
  프로젝트명  - 프로젝트 이름 (예: "MyProject")

출력:
  토큰 주소와 거래 링크를 출력합니다.
  포지 풀 생성은 프론트엔드에서 유저가 직접 진행합니다.
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const clientKey = process.env.CLIENT_KEY;
  const clientSecret = process.env.CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    console.error("오류: CLIENT_KEY, CLIENT_SECRET 환경변수가 설정되지 않았습니다.");
    console.error("  .env 파일에 다음을 추가하세요:");
    console.error("  CLIENT_KEY=your-client-key");
    console.error("  CLIENT_SECRET=your-client-secret");
    process.exit(1);
  }

  const positionalArgs = args.filter(arg => arg.trim() !== "");
  
  if (positionalArgs.length < 6) {
    printUsage();
    process.exit(1);
  }

  const [tokenName, tokenSymbol, tokenDescription, imageUrl, owner, projectName] = positionalArgs;

  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) {
    console.error("오류: 유저지갑 주소가 유효하지 않습니다.");
    process.exit(1);
  }

  try {
    await deployToken(clientKey, clientSecret, tokenName, tokenSymbol, tokenDescription, imageUrl, owner, projectName);
  } catch (error) {
    console.error("\n오류 발생:", error.message);
    process.exit(1);
  }
}

main();
