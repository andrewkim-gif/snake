/**
 * categories.ts - Skill Category Definitions
 * 6 Categories for Hexagonal Skill Map
 *
 * Ported from app_ingame/config/skills/categories.ts
 * SkillCategory/CategoryMeta inlined from missing skill.types
 */

import { SkillCategory } from './definitions';

export interface CategoryMeta {
  id: SkillCategory;
  name: string;
  nameEn: string;
  description: string;
  color: string;
  icon: string;
  playstyle: string;
}

/**
 * 6대 스킬 카테고리 메타데이터
 * Hexagonal Layout: 상단부터 시계방향
 */
export const CATEGORY_META: Record<SkillCategory, CategoryMeta> = {
  CODE: {
    id: 'CODE',
    name: '코드',
    nameEn: 'Code',
    description: '직접적인 코딩 공격. 기본기에 충실한 근접/투사체 스킬',
    color: '#00FF41', // Matrix Green
    icon: 'Code',
    playstyle: '밸런스형 - 안정적인 데미지와 다양한 상황 대응',
  },
  DATA: {
    id: 'DATA',
    name: '데이터',
    nameEn: 'Data',
    description: '데이터 처리와 분석 기반 공격. 광역/지속 데미지 특화',
    color: '#06B6D4',
    icon: 'Database',
    playstyle: '광역형 - 넓은 범위의 적을 동시에 처리',
  },
  NETWORK: {
    id: 'NETWORK',
    name: '네트워크',
    nameEn: 'Network',
    description: '네트워크 프로토콜 기반 공격. 체인/연결 효과 특화',
    color: '#8B5CF6',
    icon: 'Network',
    playstyle: '연쇄형 - 적을 연결하고 체인 데미지 극대화',
  },
  SECURITY: {
    id: 'SECURITY',
    name: '보안',
    nameEn: 'Security',
    description: '방어와 보안 시스템. 실드/생존기 특화',
    color: '#EF4444',
    icon: 'Shield',
    playstyle: '방어형 - 높은 생존력과 반사/보호 효과',
  },
  AI: {
    id: 'AI',
    name: 'AI',
    nameEn: 'AI',
    description: '인공지능 기반 공격. 자동/유도/소환 특화',
    color: '#F59E0B',
    icon: 'Brain',
    playstyle: '자동형 - AI가 알아서 적을 추적하고 공격',
  },
  SYSTEM: {
    id: 'SYSTEM',
    name: '시스템',
    nameEn: 'System',
    description: '시스템 최적화와 버프. 패시브/강화 특화',
    color: '#10B981',
    icon: 'Cpu',
    playstyle: '버프형 - 스탯 강화와 패시브 효과로 전투력 증가',
  },
};

/** Hexagonal Layout 위치 정보 */
export const CATEGORY_POSITIONS: Record<SkillCategory, { angle: number; x: number; y: number }> = {
  CODE: { angle: 0, x: 0, y: -1 },
  DATA: { angle: 60, x: 0.866, y: -0.5 },
  NETWORK: { angle: 120, x: 0.866, y: 0.5 },
  SECURITY: { angle: 180, x: 0, y: 1 },
  AI: { angle: 240, x: -0.866, y: 0.5 },
  SYSTEM: { angle: 300, x: -0.866, y: -0.5 },
};

/** 카테고리 간 시너지 관계 (인접 카테고리) */
export const CATEGORY_ADJACENCY: Record<SkillCategory, SkillCategory[]> = {
  CODE: ['SYSTEM', 'DATA'],
  DATA: ['CODE', 'NETWORK'],
  NETWORK: ['DATA', 'SECURITY'],
  SECURITY: ['NETWORK', 'AI'],
  AI: ['SECURITY', 'SYSTEM'],
  SYSTEM: ['AI', 'CODE'],
};

/** 카테고리 대각선 관계 */
export const CATEGORY_OPPOSITES: Record<SkillCategory, SkillCategory> = {
  CODE: 'SECURITY',
  DATA: 'AI',
  NETWORK: 'SYSTEM',
  SECURITY: 'CODE',
  AI: 'DATA',
  SYSTEM: 'NETWORK',
};

/** 카테고리별 추천 시작 스킬 */
export const CATEGORY_STARTER_SKILLS: Record<SkillCategory, string[]> = {
  CODE: ['knife', 'whip', 'wand'],
  DATA: ['bible', 'pool', 'json_bomb'],
  NETWORK: ['bridge', 'ping', 'websocket'],
  SECURITY: ['garlic', 'firewall_surge', 'antivirus'],
  AI: ['lightning', 'neural_net', 'autopilot'],
  SYSTEM: ['focus', 'overclock', 'ram_upgrade'],
};

/** 카테고리 순서 (UI 표시용) */
export const CATEGORY_ORDER: SkillCategory[] = [
  'CODE', 'DATA', 'NETWORK', 'SECURITY', 'AI', 'SYSTEM'
];

/** 카테고리 아이콘 매핑 */
export const CATEGORY_ICONS: Record<SkillCategory, string> = {
  CODE: 'Code',
  DATA: 'Database',
  NETWORK: 'Network',
  SECURITY: 'Shield',
  AI: 'Brain',
  SYSTEM: 'Cpu',
};

export default CATEGORY_META;
