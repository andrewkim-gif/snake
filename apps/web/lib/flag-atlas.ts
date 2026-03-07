/**
 * FlagAtlasLoader — 195개국 국기 텍스처 아틀라스 (v15 Phase 2)
 *
 * flagcdn.com CDN에서 80x60 국기 PNG를 비동기 로드하여
 * 2048x2048 Canvas 아틀라스로 합성 → Three.js CanvasTexture 반환.
 *
 * 폴백 체인: CDN 이미지 → iso2ToFlag() 이모지 drawText → 단색 사각형
 */

import * as THREE from 'three';
import { iso2ToFlag } from '@/lib/country-data';

// ─── Types ───

export interface FlagAtlasResult {
  /** 아틀라스 CanvasTexture (2048x2048) */
  texture: THREE.CanvasTexture;
  /** iso2 → [u, v, w, h] 정규화 UV 좌표 */
  getUV: (iso2: string) => [u: number, v: number, w: number, h: number];
  /** 성공적으로 로드된 국기 수 */
  loaded: number;
  /** 전체 국기 수 */
  total: number;
}

// ─── Constants ───

const ATLAS_W = 2048;
const ATLAS_H = 2048;
const FLAG_W = 80;
const FLAG_H = 60;
const COLS = Math.floor(ATLAS_W / FLAG_W); // 25
/** 동시 CDN 로드 수 제한 */
const CONCURRENCY = 10;
/** CDN URL 템플릿 */
const CDN_URL = (iso2: string) => `https://flagcdn.com/w80/${iso2.toLowerCase()}.png`;
/** 이미지 로드 타임아웃 (ms) */
const LOAD_TIMEOUT = 5000;

// ─── 유틸 ───

/** 이미지 프로미스 (타임아웃 포함) */
function loadImage(url: string, timeout: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => {
      img.src = '';
      reject(new Error(`Timeout loading ${url}`));
    }, timeout);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Failed to load ${url}`));
    };
    img.src = url;
  });
}

/** 동시성 제한 비동기 실행 */
async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
  onDone?: () => void,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      results[idx] = await tasks[idx]();
      onDone?.();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ─── FlagAtlasLoader ───

export class FlagAtlasLoader {
  private uvMap = new Map<string, [number, number, number, number]>();

  /**
   * 195개국 국기 로드 → 2048x2048 아틀라스 합성 → CanvasTexture 반환
   * @param iso2List - 로드할 ISO2 코드 배열
   * @param onProgress - 진행 콜백 (loaded count)
   */
  async loadAll(
    iso2List: string[],
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<FlagAtlasResult> {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_W;
    canvas.height = ATLAS_H;
    const ctx = canvas.getContext('2d')!;

    // 배경: 투명
    ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);

    let loadedCount = 0;
    const total = iso2List.length;

    // 각 국기를 로드하는 태스크 배열
    const tasks = iso2List.map((iso2, index) => async () => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const dx = col * FLAG_W;
      const dy = row * FLAG_H;

      try {
        // CDN에서 국기 이미지 로드
        const img = await loadImage(CDN_URL(iso2), LOAD_TIMEOUT);
        ctx.drawImage(img, dx, dy, FLAG_W, FLAG_H);
      } catch {
        // 폴백 1: 이모지 국기
        this.drawEmojiFallback(ctx, iso2, dx, dy);
      }

      // UV 매핑 저장 (Three.js UV: 좌하단 원점, Y 반전)
      const u = dx / ATLAS_W;
      const v = 1 - (dy + FLAG_H) / ATLAS_H;
      const w = FLAG_W / ATLAS_W;
      const h = FLAG_H / ATLAS_H;
      this.uvMap.set(iso2.toUpperCase(), [u, v, w, h]);

      loadedCount++;
      return { iso2, success: true };
    });

    // 동시 10개씩 병렬 로드
    await parallelLimit(tasks, CONCURRENCY, () => {
      onProgress?.(loadedCount, total);
    });

    // CanvasTexture 생성
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    return {
      texture,
      getUV: (iso2: string) => this.uvMap.get(iso2.toUpperCase()) ?? [0, 0, 0, 0],
      loaded: loadedCount,
      total,
    };
  }

  /** 이모지 국기 폴백 → Canvas drawText */
  private drawEmojiFallback(
    ctx: CanvasRenderingContext2D,
    iso2: string,
    dx: number,
    dy: number,
  ): void {
    const emoji = iso2ToFlag(iso2);

    // 배경: 다크 사각형
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(dx, dy, FLAG_W, FLAG_H);

    if (emoji) {
      // 이모지 렌더링
      ctx.font = '36px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(emoji, dx + FLAG_W / 2, dy + FLAG_H / 2);
    } else {
      // 폴백 2: ISO2 텍스트
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#888888';
      ctx.fillText(iso2.toUpperCase(), dx + FLAG_W / 2, dy + FLAG_H / 2);
    }
  }
}

// ─── 싱글턴 인스턴스 + React Hook 지원 ───

let _cachedResult: FlagAtlasResult | null = null;
let _loadingPromise: Promise<FlagAtlasResult> | null = null;

/**
 * 싱글턴 로더: 최초 1회만 로드, 이후 캐시 반환
 */
export async function loadFlagAtlas(
  iso2List: string[],
  onProgress?: (loaded: number, total: number) => void,
): Promise<FlagAtlasResult> {
  if (_cachedResult) return _cachedResult;
  if (_loadingPromise) return _loadingPromise;

  const loader = new FlagAtlasLoader();
  _loadingPromise = loader.loadAll(iso2List, onProgress);
  _cachedResult = await _loadingPromise;
  _loadingPromise = null;
  return _cachedResult;
}

/** 캐시 초기화 (디버그/테스트용) */
export function clearFlagAtlasCache(): void {
  if (_cachedResult) {
    _cachedResult.texture.dispose();
    _cachedResult = null;
  }
  _loadingPromise = null;
}
