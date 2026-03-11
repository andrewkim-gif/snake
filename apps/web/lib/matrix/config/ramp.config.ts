/**
 * Cross-Ramp Integration Configuration
 * 크레딧(Credits) <-> 토큰 교환 설정
 *
 * Ported from app_ingame/config/ramp.config.ts
 */

export const RAMP_CONFIG = {
  // Project ID (CROSS Ramp Console에서 발급)
  projectId: 'c2c35439917404673b895bccc888902e',

  // 환경 설정
  environment: 'mainnet' as const,

  // 환경별 URL
  urls: {
    testnet: {
      catalog: 'https://stg-ramp.crosstoken.io/catalog',
      api: 'https://stg-ramp.crosstoken.io/api',
    },
    mainnet: {
      catalog: 'https://ramp.crosstoken.io/catalog',
      api: 'https://ramp.crosstoken.io/api',
    },
  },

  // 게임 자산 정의
  assets: {
    credits: {
      id: 'credits',
      name: 'Credits',
      nameKo: '크레딧',
      iconUrl: '/assets/icons/credit-icon.png',
      // Mint: 크레딧 -> 토큰
      // Burn: 토큰 -> 크레딧
    },
  },

  // 교환 비율 (게임 설정, 실제 비율은 Nexus Console에서 관리)
  exchangeRates: {
    // 1 토큰 = 1000 크레딧 (예시)
    creditsPerToken: 1000,
  },

  // 팝업 설정
  popup: {
    width: 480,
    height: 720,
    name: 'cross-ramp-catalog',
  },
} as const;

/**
 * 현재 환경의 URL 가져오기
 */
export function getRampUrl(type: 'catalog' | 'api'): string {
  return RAMP_CONFIG.urls[RAMP_CONFIG.environment][type];
}

/**
 * Catalog URL 생성
 */
export function buildCatalogUrl(params: {
  sessionId: string;
  accessToken: string;
  lang?: string;
}): string {
  const url = new URL(getRampUrl('catalog'));
  url.searchParams.set('projectId', RAMP_CONFIG.projectId);
  url.searchParams.set('sessionId', params.sessionId);
  url.searchParams.set('accessToken', params.accessToken);
  url.searchParams.set('platform', 'web');
  url.searchParams.set('network', RAMP_CONFIG.environment);
  url.searchParams.set('timestamp', Date.now().toString());

  if (params.lang) {
    url.searchParams.set('lang', params.lang);
  }

  return url.toString();
}

/**
 * Ramp 팝업 열기
 */
export function openRampPopup(catalogUrl: string): Window | null {
  const { width, height, name } = RAMP_CONFIG.popup;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;

  return window.open(
    catalogUrl,
    name,
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

export type RampEnvironment = typeof RAMP_CONFIG.environment;
export type RampAssetId = keyof typeof RAMP_CONFIG.assets;
