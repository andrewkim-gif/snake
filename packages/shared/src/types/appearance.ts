/**
 * CubelingAppearance — 큐블링 외형 타입 정의
 * 서버/클라이언트 공유 (Three.js 의존 없음)
 * 63비트 pack/unpack 유틸 포함
 */

// ─── 체형 열거형 ───

/** 큐블링 바디 타입 (4종) */
export type BodyType = 'standard' | 'slim' | 'chunky' | 'tall';

/** 바디 사이즈 */
export type BodySize = 'small' | 'medium' | 'large';

/** 얼굴 조합 키 (눈+입 스타일 인덱스) */
export type FaceKey = `${number}-${number}`;

// ─── 애니메이션 상태 ───

/** 큐블링 애니메이션 상태 열거 (10종) */
export enum AnimState {
  IDLE = 0,
  WALK = 1,
  BOOST = 2,
  ATTACK = 3,
  HIT = 4,
  DEATH = 5,
  SPAWN = 6,
  LEVELUP = 7,
  VICTORY = 8,
  COLLECT = 9,
}

// ─── 패턴 열거 ───

/** 의상 패턴 타입 */
export enum PatternType {
  SOLID = 0,
  STRIPED = 1,
  DOTTED = 2,
  GRADIENT = 3,
  CHECKER = 4,
  CAMO = 5,
  ZIGZAG = 6,
  HEART = 7,
}

// ─── 핵심 외형 인터페이스 ───

/**
 * CubelingAppearance — 큐블링 캐릭터 전체 외형 데이터
 * 7 레이어 커스터마이제이션 시스템
 */
export interface CubelingAppearance {
  // Layer 1: 체형
  bodyType: BodyType;       // 4종: standard, slim, chunky, tall
  bodySize: BodySize;       // 3종: small, medium, large

  // Layer 2: 피부
  skinTone: number;         // 0-11 (12 스킨톤)

  // Layer 3: 얼굴
  eyeStyle: number;         // 0-11 (12종)
  mouthStyle: number;       // 0-7 (8종)
  marking: number;          // 0-7 (없음, 줄무늬, 크리퍼 등)

  // Layer 4: 의상
  topColor: number;         // 0-11 (VIVID_PALETTE 인덱스)
  bottomColor: number;      // 0-11
  pattern: number;          // 0-7 (PatternType)

  // Layer 5: 헤어
  hairStyle: number;        // 0-15 (16종)
  hairColor: number;        // 0-15 (16색)

  // Layer 6: 장비
  hat: number;              // 0-8 (0=없음)
  weapon: number;           // 0-6 (0=없음)
  backItem: number;         // 0-5 (0=없음)
  footwear: number;         // 0-8 (0=없음)

  // Layer 7: 이펙트
  trailEffect: number;      // 0-7 (0=없음)
  auraEffect: number;       // 0-5 (0=없음)
  emote: number;            // 0-7 (0=없음)
  spawnEffect: number;      // 0-5 (0=없음)
}

/** 장비 슬롯 인터페이스 */
export interface EquipmentSlots {
  hat: number;
  weapon: number;
  backItem: number;
  footwear: number;
}

// ─── BodyType/BodySize → 인덱스 매핑 ───

const BODY_TYPE_INDEX: Record<BodyType, number> = {
  standard: 0,
  slim: 1,
  chunky: 2,
  tall: 3,
};

const INDEX_TO_BODY_TYPE: BodyType[] = ['standard', 'slim', 'chunky', 'tall'];

const BODY_SIZE_INDEX: Record<BodySize, number> = {
  small: 0,
  medium: 1,
  large: 2,
};

const INDEX_TO_BODY_SIZE: BodySize[] = ['small', 'medium', 'large'];

// ─── 비트 인코딩 (63 bits → 8 bytes) ───
//
// 필드별 비트 폭:
//   bodyType:2 + bodySize:2 + skinTone:4 + eyeStyle:4 + mouthStyle:3 + marking:3
//   + topColor:4 + bottomColor:4 + pattern:3
//   + hairStyle:4 + hairColor:4
//   + hat:4 + weapon:3 + backItem:3 + footwear:4
//   + trailEffect:3 + auraEffect:3 + emote:3 + spawnEffect:3
//   = 63 bits 총

/**
 * CubelingAppearance를 63비트 BigInt로 압축
 * 네트워크 전송 시 8바이트로 직렬화
 */
export function packAppearance(a: CubelingAppearance): bigint {
  let bits = 0n;
  let shift = 0;

  const write = (value: number, width: number) => {
    bits |= BigInt(value & ((1 << width) - 1)) << BigInt(shift);
    shift += width;
  };

  write(BODY_TYPE_INDEX[a.bodyType], 2);
  write(BODY_SIZE_INDEX[a.bodySize], 2);
  write(a.skinTone, 4);
  write(a.eyeStyle, 4);
  write(a.mouthStyle, 3);
  write(a.marking, 3);
  write(a.topColor, 4);
  write(a.bottomColor, 4);
  write(a.pattern, 3);
  write(a.hairStyle, 4);
  write(a.hairColor, 4);
  write(a.hat, 4);
  write(a.weapon, 3);
  write(a.backItem, 3);
  write(a.footwear, 4);
  write(a.trailEffect, 3);
  write(a.auraEffect, 3);
  write(a.emote, 3);
  write(a.spawnEffect, 3);

  return bits;
}

/**
 * 63비트 BigInt → CubelingAppearance 복원
 */
export function unpackAppearance(packed: bigint): CubelingAppearance {
  let shift = 0;

  const read = (width: number): number => {
    const mask = (1n << BigInt(width)) - 1n;
    const value = Number((packed >> BigInt(shift)) & mask);
    shift += width;
    return value;
  };

  return {
    bodyType: INDEX_TO_BODY_TYPE[read(2)] ?? 'standard',
    bodySize: INDEX_TO_BODY_SIZE[read(2)] ?? 'medium',
    skinTone: read(4),
    eyeStyle: read(4),
    mouthStyle: read(3),
    marking: read(3),
    topColor: read(4),
    bottomColor: read(4),
    pattern: read(3),
    hairStyle: read(4),
    hairColor: read(4),
    hat: read(4),
    weapon: read(3),
    backItem: read(3),
    footwear: read(4),
    trailEffect: read(3),
    auraEffect: read(3),
    emote: read(3),
    spawnEffect: read(3),
  };
}

/**
 * CubelingAppearance → 결정적 해시값 (32비트 정수)
 * 인게임 state broadcast에서 appearanceHash로 사용
 */
export function appearanceToHash(a: CubelingAppearance): number {
  const packed = packAppearance(a);
  // FNV-1a 스타일 간단 해시 (BigInt → 32비트)
  let hash = 0x811c9dc5;
  for (let i = 0; i < 8; i++) {
    const byte = Number((packed >> BigInt(i * 8)) & 0xFFn);
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0; // unsigned 32비트
}

/**
 * 얼굴 조합 키 생성 (눈+입 스타일)
 * HeadGroupManager에서 InstancedMesh 그룹핑에 사용
 */
export function getFaceKey(a: CubelingAppearance): FaceKey {
  return `${a.eyeStyle}-${a.mouthStyle}`;
}

/**
 * 기본 CubelingAppearance (프리셋 Pixel 기준)
 */
export function createDefaultAppearance(): CubelingAppearance {
  return {
    bodyType: 'standard',
    bodySize: 'medium',
    skinTone: 3,
    eyeStyle: 0,
    mouthStyle: 0,
    marking: 0,
    topColor: 4,    // Sky Blue
    bottomColor: 7, // Charcoal
    pattern: 0,     // Solid
    hairStyle: 0,
    hairColor: 7,
    hat: 0,
    weapon: 0,
    backItem: 0,
    footwear: 0,
    trailEffect: 0,
    auraEffect: 0,
    emote: 0,
    spawnEffect: 0,
  };
}
