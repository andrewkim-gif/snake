/**
 * biome-landmark-tints.ts — v29 Phase 1: 바이옴별 랜드마크 시각 상수
 *
 * 6개 바이옴(temperate/arid/tropical/arctic/mediterranean/urban)별
 * 건물 색조(tint), 환경 안개(fog), 야간 발광(nightEmissive),
 * 풍화(weathering), 명암 대비(diffuseBoost) 정의
 *
 * Phase 2에서 셰이더 uniform/attribute로 전달됨
 */

import * as THREE from 'three';
import type { BiomeType } from '@/components/game/iso/types';

// ─── 바이옴 틴트 인터페이스 ───

export interface BiomeLandmarkTint {
  /** 건물 색조 — 알베도와 소프트 믹스 */
  tint: THREE.Color;
  /** 환경 안개색 — 거리 기반 블렌딩 */
  fog: THREE.Color;
  /** 밤 발광 강도 (0-1) — urban이 가장 밝음 */
  nightEmissive: number;
  /** 풍화 강도 (0-1) — arid가 가장 높음 */
  weathering: number;
  /** 명암 대비 조정 — 양수=밝게, 음수=부드럽게 */
  diffuseBoost: number;
}

// ─── 바이옴 인덱스 (셰이더 attribute용) ───

/** 바이옴 → 정수 인덱스 (aBiomeIdx attribute로 전달) */
export const BIOME_INDEX: Record<BiomeType, number> = {
  temperate: 0,
  arid: 1,
  tropical: 2,
  arctic: 3,
  mediterranean: 4,
  urban: 5,
};

// ─── 바이옴별 틴트 테이블 ───

export const BIOME_LANDMARK_TINTS: Record<BiomeType, BiomeLandmarkTint> = {
  temperate: {
    tint: new THREE.Color(0xC8C4B8),          // neutral stone
    fog: new THREE.Color(0x8BA4B8),            // cool mist
    nightEmissive: 0.5,
    weathering: 0.12,
    diffuseBoost: 0.0,
  },
  arid: {
    tint: new THREE.Color(0xE0D0A8),          // light sand
    fog: new THREE.Color(0xC4A872),            // dust haze
    nightEmissive: 0.3,
    weathering: 0.18,
    diffuseBoost: 0.1,
  },
  tropical: {
    tint: new THREE.Color(0x98C098),          // deeper green
    fog: new THREE.Color(0x7BA68C),            // humid mist
    nightEmissive: 0.45,
    weathering: 0.15,
    diffuseBoost: -0.05,
  },
  arctic: {
    tint: new THREE.Color(0xC0D4F0),          // stronger blue
    fog: new THREE.Color(0xB0C4D8),            // snow fog
    nightEmissive: 0.2,
    weathering: 0.08,
    diffuseBoost: 0.15,
  },
  mediterranean: {
    tint: new THREE.Color(0xD8C8B0),          // warmer neutral
    fog: new THREE.Color(0xA0B8C8),            // sea haze
    nightEmissive: 0.55,
    weathering: 0.10,
    diffuseBoost: 0.05,
  },
  urban: {
    tint: new THREE.Color(0xB0B4B8),          // slight cool
    fog: new THREE.Color(0x909090),            // smog
    nightEmissive: 0.9,
    weathering: 0.05,
    diffuseBoost: 0.0,
  },
};

// ─── 헬퍼 ───

/**
 * 바이옴 타입으로 틴트 데이터 조회
 * @param biome 바이옴 타입
 * @returns 해당 바이옴의 시각 상수
 */
export function getBiomeLandmarkTint(biome: BiomeType): BiomeLandmarkTint {
  return BIOME_LANDMARK_TINTS[biome];
}
