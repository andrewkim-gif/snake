/**
 * game/rendering/constants.ts - 렌더링 공통 상수
 */

// ===== Matrix/AI Theme Colors =====
export const matrixGreen = '#00FF41';
export const matrixDarkGreen = '#003B00';
export const matrixLightGreen = '#39FF14';

// ===== Tech/Cyber Colors =====
export const cyberBlue = '#00D4FF';
export const cyberPurple = '#8B5CF6';
export const cyberPink = '#EC4899';
export const cyberCyan = '#06B6D4';
export const cyberGold = '#F59E0B';
export const cyberRed = '#EF4444';
export const cyberOrange = '#F97316';

// ===== AI/Robot Colors =====
export const robotGray = '#6B7280';
export const robotDarkGray = '#374151';
export const robotLightGray = '#9CA3AF';
export const robotMetal = '#71717A';
export const robotChrome = '#D4D4D8';

// ===== Warning/Alert Colors =====
export const warningRed = '#DC2626';
export const warningYellow = '#FBBF24';
export const warningOrange = '#F97316';
export const criticalRed = '#7F1D1D';

// ===== Blood/Hit Effects =====
export const bloodRed = '#8B0000';
export const bloodDark = '#4A0000';
export const hitWhite = '#FFFFFF';
export const hitFlash = 'rgba(255,255,255,0.8)';

// ===== Singularity Theme =====
export const singularityPurple = '#7C3AED';
export const singularityBlue = '#3B82F6';
export const singularityVoid = '#0F172A';

// ===== Boss-Specific Colors =====
export const jiraBlue = '#0052CC';
export const slackPurple = '#611f69';
export const googleColors = {
  blue: '#4285F4',
  red: '#EA4335',
  yellow: '#FBBC05',
  green: '#34A853',
};

// ===== Character Rendering Constants (80% 스케일) =====
export const HEAD_SIZE = 19;  // 24 * 0.8 = 19
export const HEAD_Y = -HEAD_SIZE + 2; // -17
export const EYE_X = 5;  // 6 * 0.8 = 5
export const EYE_Y = HEAD_Y + HEAD_SIZE * 0.6;
export const BODY_WIDTH = 14;  // 18 * 0.8 = 14
export const BODY_HEIGHT = 18;  // 22 * 0.8 = 18

// ===== Animation Constants =====
export const DEFAULT_WALK_SPEED = 80;
export const DEFAULT_HOVER_SPEED = 300;
export const DEFAULT_HOVER_AMPLITUDE = 3;

// ===== Size Limits =====
export const MAX_PARTICLE_SIZE = 30;
export const MIN_PARTICLE_SIZE = 2;
export const DEFAULT_ENEMY_SIZE = 24;
export const DEFAULT_BOSS_SIZE = 60;
