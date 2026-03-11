/**
 * character-config.ts — 9 클래스별 3D 캐릭터 색상/장비 변형 (S14)
 *
 * CLASS_DATA의 color를 기반으로 각 클래스의 3D 모델 색상을 정의.
 * 클래스 선택 시 createBaseCharacterGeometry()에 전달할 CharacterColors 매핑.
 *
 * 9 Classes: neo, tank, cypher, morpheus, niobe, oracle, trinity, mouse, dozer
 */

import type { PlayerClass } from '../types';
import type { CharacterColors } from './character-models';

// ============================================
// 클래스별 3D 색상 설정
// ============================================

/** 클래스별 3D 캐릭터 색상 매핑 */
export const CLASS_3D_COLORS: Record<PlayerClass, CharacterColors> = {
  neo: {
    head: '#1f2120',    // 검은 머리
    body: '#f8fafc',    // 흰 셔츠
    legs: '#1e293b',    // 네이비 바지
    arms: '#f8fafc',    // 셔츠와 동일
    accent: '#00FF41',  // 매트릭스 그린
  },
  tank: {
    head: '#2c1810',    // 갈색 머리
    body: '#8B0000',    // 다크 레드 아머
    legs: '#3d3d3d',    // 다크 그레이 팬츠
    arms: '#8B0000',    // 아머와 동일
    accent: '#dc2626',  // 레드 액센트
  },
  cypher: {
    head: '#1a1a2e',    // 다크 블루 머리
    body: '#2d1b1b',    // 다크 브라운 코트
    legs: '#1a1a1a',    // 블랙 팬츠
    arms: '#2d1b1b',    // 코트와 동일
    accent: '#dc2626',  // 레드 액센트
  },
  morpheus: {
    head: '#3d2b1f',    // 갈색 피부
    body: '#1a1a2e',    // 다크 네이비 수트
    legs: '#1a1a2e',    // 수트와 동일
    arms: '#1a1a2e',    // 수트와 동일
    accent: '#d4af37',  // 골드 액센트
  },
  niobe: {
    head: '#2d1b2e',    // 다크 퍼플 머리
    body: '#4a2060',    // 퍼플 전투복
    legs: '#2d1040',    // 다크 퍼플 팬츠
    arms: '#4a2060',    // 전투복과 동일
    accent: '#a855f7',  // 퍼플 액센트
  },
  oracle: {
    head: '#e0d0c0',    // 밝은 베이지 (노인 머리)
    body: '#1e3a5f',    // 블루 로브
    legs: '#1e3a5f',    // 로브와 동일
    arms: '#1e3a5f',    // 로브와 동일
    accent: '#3b82f6',  // 블루 액센트
  },
  trinity: {
    head: '#1a1a2e',    // 다크 머리
    body: '#0a0a0a',    // 블랙 슈트
    legs: '#0a0a0a',    // 블랙 팬츠
    arms: '#0a0a0a',    // 슈트와 동일
    accent: '#ec4899',  // 핑크 액센트
  },
  mouse: {
    head: '#4a3a2a',    // 브라운 머리
    body: '#3a5a2a',    // 올리브 그린 자켓
    legs: '#2a2a1a',    // 다크 올리브 팬츠
    arms: '#3a5a2a',    // 자켓과 동일
    accent: '#eab308',  // 옐로 액센트
  },
  dozer: {
    head: '#2c1a10',    // 다크 브라운 머리
    body: '#5a3010',    // 브라운 전투조끼
    legs: '#3d2a1a',    // 브라운 팬츠
    arms: '#5a3010',    // 전투조끼와 동일
    accent: '#f97316',  // 오렌지 액센트
  },
};

// ============================================
// 클래스별 장비 장식 설정 (향후 확장용)
// ============================================

/** 클래스별 장비/장식 특성 */
export interface ClassEquipmentConfig {
  /** 클래스 ID */
  classId: PlayerClass;
  /** 머리 위 장식 (모자, 선글라스 등) - 향후 .glb로 교체 */
  headAccessory: 'none' | 'sunglasses' | 'helmet' | 'hood' | 'bandana' | 'headset';
  /** 몸통 장식 타입 */
  bodyType: 'shirt' | 'armor' | 'coat' | 'suit' | 'robe' | 'vest' | 'jacket';
  /** 무기 장비 위치 */
  weaponHand: 'right' | 'left' | 'both' | 'none';
  /** 글로우 이펙트 색상 (null이면 없음) */
  glowColor: string | null;
  /** 캐릭터 스케일 배율 (tank=크게, mouse=작게) */
  scaleMult: number;
}

/** 9 클래스별 장비 설정 */
export const CLASS_EQUIPMENT: Record<PlayerClass, ClassEquipmentConfig> = {
  neo: {
    classId: 'neo',
    headAccessory: 'sunglasses',
    bodyType: 'shirt',
    weaponHand: 'right',
    glowColor: '#00FF41',
    scaleMult: 1.0,
  },
  tank: {
    classId: 'tank',
    headAccessory: 'helmet',
    bodyType: 'armor',
    weaponHand: 'both',
    glowColor: null,
    scaleMult: 1.15,
  },
  cypher: {
    classId: 'cypher',
    headAccessory: 'none',
    bodyType: 'coat',
    weaponHand: 'right',
    glowColor: '#dc2626',
    scaleMult: 1.0,
  },
  morpheus: {
    classId: 'morpheus',
    headAccessory: 'sunglasses',
    bodyType: 'suit',
    weaponHand: 'left',
    glowColor: '#d4af37',
    scaleMult: 1.1,
  },
  niobe: {
    classId: 'niobe',
    headAccessory: 'bandana',
    bodyType: 'vest',
    weaponHand: 'right',
    glowColor: '#a855f7',
    scaleMult: 0.95,
  },
  oracle: {
    classId: 'oracle',
    headAccessory: 'none',
    bodyType: 'robe',
    weaponHand: 'none',
    glowColor: '#3b82f6',
    scaleMult: 1.05,
  },
  trinity: {
    classId: 'trinity',
    headAccessory: 'sunglasses',
    bodyType: 'suit',
    weaponHand: 'both',
    glowColor: '#ec4899',
    scaleMult: 0.95,
  },
  mouse: {
    classId: 'mouse',
    headAccessory: 'headset',
    bodyType: 'jacket',
    weaponHand: 'right',
    glowColor: '#eab308',
    scaleMult: 0.9,
  },
  dozer: {
    classId: 'dozer',
    headAccessory: 'helmet',
    bodyType: 'vest',
    weaponHand: 'both',
    glowColor: '#f97316',
    scaleMult: 1.12,
  },
};

// ============================================
// 유틸리티 함수
// ============================================

/**
 * getClassColors — 클래스 ID로 3D 색상 가져오기
 */
export function getClassColors(playerClass: PlayerClass): CharacterColors {
  return CLASS_3D_COLORS[playerClass] ?? CLASS_3D_COLORS.neo;
}

/**
 * getClassEquipment — 클래스 ID로 장비 설정 가져오기
 */
export function getClassEquipment(playerClass: PlayerClass): ClassEquipmentConfig {
  return CLASS_EQUIPMENT[playerClass] ?? CLASS_EQUIPMENT.neo;
}

/**
 * getClassScale — 클래스별 스케일 배율
 */
export function getClassScale(playerClass: PlayerClass): number {
  return CLASS_EQUIPMENT[playerClass]?.scaleMult ?? 1.0;
}

/**
 * getClassGlowColor — 클래스별 글로우 이펙트 색상 (null이면 없음)
 */
export function getClassGlowColor(playerClass: PlayerClass): string | null {
  return CLASS_EQUIPMENT[playerClass]?.glowColor ?? null;
}
