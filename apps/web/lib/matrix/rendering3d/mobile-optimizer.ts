/**
 * mobile-optimizer.ts — 모바일 최적화 유틸리티 (S46)
 *
 * Phase 8: Optimization
 * 1. 모바일 감지 → 자동 Tier2/Tier3
 * 2. devicePixelRatio cap = 1
 * 3. Particle count 감소, Shadow 해상도 축소
 *
 * 모바일 감지 기준:
 * - Touch 지원 + 화면 폭 < 1024px
 * - iOS Safari / Android Chrome UA
 * - navigator.maxTouchPoints > 0
 */

import {
  type QualityTierLevel,
  type QualityLadderPreset,
  QUALITY_PRESETS,
  qualityLadder,
} from './quality-ladder';

// ============================================
// Constants
// ============================================

/** 모바일 화면 폭 임계값 (px) */
const MOBILE_WIDTH_THRESHOLD = 1024;

/** 저사양 모바일 RAM 임계값 (GB, navigator.deviceMemory) */
const LOW_MEMORY_THRESHOLD = 4;

/** 저사양 CPU 코어 수 임계값 */
const LOW_CPU_THRESHOLD = 4;

// ============================================
// Types
// ============================================

/** 모바일 디바이스 정보 */
export interface MobileDeviceInfo {
  /** 모바일 여부 */
  isMobile: boolean;
  /** 태블릿 여부 */
  isTablet: boolean;
  /** iOS 여부 */
  isIOS: boolean;
  /** Android 여부 */
  isAndroid: boolean;
  /** 저사양 디바이스 여부 */
  isLowEnd: boolean;
  /** devicePixelRatio */
  dpr: number;
  /** 화면 폭 (px) */
  screenWidth: number;
  /** 디바이스 메모리 (GB, 0=알 수 없음) */
  deviceMemory: number;
  /** CPU 코어 수 (0=알 수 없음) */
  cpuCores: number;
  /** 권장 품질 티어 */
  recommendedTier: QualityTierLevel;
}

// ============================================
// 모바일 감지
// ============================================

/**
 * detectMobileDevice — 모바일 디바이스 감지 + 성능 프로파일링
 */
export function detectMobileDevice(): MobileDeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isIOS: false,
      isAndroid: false,
      isLowEnd: false,
      dpr: 1,
      screenWidth: 1920,
      deviceMemory: 8,
      cpuCores: 8,
      recommendedTier: 'tier1',
    };
  }

  const ua = navigator.userAgent;
  const screenWidth = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;

  // Touch 감지
  const hasTouch = 'ontouchstart' in window
    || navigator.maxTouchPoints > 0
    || (navigator as any).msMaxTouchPoints > 0;

  // OS 감지
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && hasTouch);
  const isAndroid = /Android/.test(ua);

  // 모바일/태블릿 감지
  const isMobileUA = /Mobile|Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTabletUA = /iPad|Android(?!.*Mobile)|Tablet/i.test(ua);

  const isMobile = (hasTouch && screenWidth < MOBILE_WIDTH_THRESHOLD) || isMobileUA;
  const isTablet = isTabletUA || (hasTouch && screenWidth >= MOBILE_WIDTH_THRESHOLD && screenWidth < 1366);

  // 성능 정보
  const deviceMemory = (navigator as any).deviceMemory ?? 0;
  const cpuCores = navigator.hardwareConcurrency ?? 0;

  // 저사양 판단
  const isLowEnd =
    (deviceMemory > 0 && deviceMemory < LOW_MEMORY_THRESHOLD) ||
    (cpuCores > 0 && cpuCores < LOW_CPU_THRESHOLD) ||
    (isIOS && dpr >= 3) || // iPhone Plus/Max 등 고DPI 저성능
    (isAndroid && screenWidth < 400); // 저해상도 Android

  // 권장 품질 티어
  let recommendedTier: QualityTierLevel = 'tier1';
  if (isLowEnd) {
    recommendedTier = 'tier3';
  } else if (isMobile) {
    recommendedTier = 'tier2';
  } else if (isTablet) {
    recommendedTier = 'tier2';
  }

  return {
    isMobile,
    isTablet,
    isIOS,
    isAndroid,
    isLowEnd,
    dpr,
    screenWidth,
    deviceMemory,
    cpuCores,
    recommendedTier,
  };
}

// ============================================
// 모바일 최적화 적용
// ============================================

/** 모바일 최적화 오버라이드 */
export interface MobileOptimizationOverrides {
  /** DPR 최대값 (모바일: 1) */
  maxDpr: number;
  /** 파티클 수 배율 (0.3~1.0) */
  particleMultiplier: number;
  /** Shadow map 해상도 */
  shadowMapSize: number;
  /** Shadow 활성화 */
  enableShadows: boolean;
  /** Terrain object 표시 거리 */
  terrainObjectDistance: number;
  /** 최대 동시 데미지 넘버 */
  maxDamageNumbers: number;
}

/**
 * getMobileOptimizations — 모바일 디바이스 정보 기반 최적화 오버라이드
 */
export function getMobileOptimizations(deviceInfo: MobileDeviceInfo): MobileOptimizationOverrides {
  const preset = QUALITY_PRESETS[deviceInfo.recommendedTier];

  // 모바일은 추가적으로 DPR=1 강제
  const maxDpr = deviceInfo.isMobile ? 1 : preset.maxDpr;

  // 저사양: 파티클 추가 감소
  const particleMultiplier = deviceInfo.isLowEnd
    ? preset.particleMultiplier * 0.5
    : preset.particleMultiplier;

  // 모바일: shadow 비활성화
  const enableShadows = deviceInfo.isMobile ? false : preset.enableShadows;
  const shadowMapSize = deviceInfo.isMobile ? 512 : preset.shadowMapSize;

  // 모바일: terrain object 거리 축소
  const terrainObjectDistance = deviceInfo.isMobile
    ? Math.min(preset.terrainObjectDistance, 600)
    : preset.terrainObjectDistance;

  // 모바일: 데미지 넘버 축소
  const maxDamageNumbers = deviceInfo.isMobile
    ? Math.min(preset.maxDamageNumbers, 15)
    : preset.maxDamageNumbers;

  return {
    maxDpr,
    particleMultiplier,
    shadowMapSize,
    enableShadows,
    terrainObjectDistance,
    maxDamageNumbers,
  };
}

/**
 * applyMobileOptimizations — Quality Ladder에 모바일 최적화 적용
 *
 * 앱 초기화 시 한 번 호출하여 모바일이면 자동으로 적절한 티어 설정.
 */
export function applyMobileOptimizations(): MobileDeviceInfo {
  const deviceInfo = detectMobileDevice();

  if (deviceInfo.isMobile || deviceInfo.isTablet) {
    // 모바일/태블릿: 권장 티어로 자동 설정
    qualityLadder.setTier(deviceInfo.recommendedTier);
  }

  return deviceInfo;
}

// ============================================
// WebGL 지원 감지
// ============================================

/**
 * checkWebGLSupport — WebGL 지원 여부 확인
 *
 * WebGL 미지원 시 2D fallback 필요
 */
export function checkWebGLSupport(): {
  supported: boolean;
  version: number; // 0=미지원, 1=WebGL1, 2=WebGL2
  maxTextureSize: number;
  renderer: string;
} {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { supported: false, version: 0, maxTextureSize: 0, renderer: '' };
  }

  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    if (gl2) {
      const debugInfo = gl2.getExtension('WEBGL_debug_renderer_info');
      return {
        supported: true,
        version: 2,
        maxTextureSize: gl2.getParameter(gl2.MAX_TEXTURE_SIZE),
        renderer: debugInfo ? gl2.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
      };
    }

    const gl1 = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl1) {
      const glCtx = gl1 as WebGLRenderingContext;
      const debugInfo = glCtx.getExtension('WEBGL_debug_renderer_info');
      return {
        supported: true,
        version: 1,
        maxTextureSize: glCtx.getParameter(glCtx.MAX_TEXTURE_SIZE),
        renderer: debugInfo ? glCtx.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
      };
    }

    return { supported: false, version: 0, maxTextureSize: 0, renderer: '' };
  } catch {
    return { supported: false, version: 0, maxTextureSize: 0, renderer: '' };
  }
}

export default {
  detectMobileDevice,
  getMobileOptimizations,
  applyMobileOptimizations,
  checkWebGLSupport,
};
