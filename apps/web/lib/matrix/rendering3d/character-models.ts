/**
 * character-models.ts — Voxel 캐릭터 3D 모델 생성 (S13)
 *
 * MagicaVoxel .glb 에셋이 없는 동안 사용하는
 * Three.js BoxGeometry 기반 3-head chibi 비율 placeholder 캐릭터.
 *
 * 구조: head(큰 정육면체) + body(직육면체) + legs(2개 작은 직육면체)
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 *
 * chibi 비율: 머리 = 몸통 높이의 ~1.2배 (3등신)
 */

import * as THREE from 'three';

// ============================================
// 캐릭터 크기 상수 (월드 단위)
// ============================================

/** 전체 캐릭터 높이 (~3.0 unit) */
export const CHARACTER_HEIGHT = 3.0;

/** 머리 크기 (정육면체) */
export const HEAD_SIZE = 1.2;

/** 몸통 크기 (width, height, depth) */
export const BODY_WIDTH = 1.0;
export const BODY_HEIGHT = 0.9;
export const BODY_DEPTH = 0.6;

/** 다리 크기 (각 다리) */
export const LEG_WIDTH = 0.4;
export const LEG_HEIGHT = 0.7;
export const LEG_DEPTH = 0.4;

/** 다리 사이 간격 */
export const LEG_GAP = 0.1;

/** 팔 크기 (각 팔) */
export const ARM_WIDTH = 0.3;
export const ARM_HEIGHT = 0.7;
export const ARM_DEPTH = 0.3;

// ============================================
// 파트 이름 상수
// ============================================

export const PART_NAMES = {
  HEAD: 'head',
  BODY: 'body',
  LEFT_LEG: 'leftLeg',
  RIGHT_LEG: 'rightLeg',
  LEFT_ARM: 'leftArm',
  RIGHT_ARM: 'rightArm',
} as const;

export type PartName = typeof PART_NAMES[keyof typeof PART_NAMES];

// ============================================
// 캐릭터 파트 인터페이스
// ============================================

/** 캐릭터 파트 참조 (애니메이션용) */
export interface CharacterParts {
  /** 전체 그룹 */
  group: THREE.Group;
  /** 머리 메쉬 */
  head: THREE.Mesh;
  /** 몸통 메쉬 */
  body: THREE.Mesh;
  /** 왼쪽 다리 메쉬 */
  leftLeg: THREE.Mesh;
  /** 오른쪽 다리 메쉬 */
  rightLeg: THREE.Mesh;
  /** 왼쪽 팔 메쉬 */
  leftArm: THREE.Mesh;
  /** 오른쪽 팔 메쉬 */
  rightArm: THREE.Mesh;
  /** 모든 메쉬 참조 배열 (색상 일괄 변경용) */
  allMeshes: THREE.Mesh[];
}

// ============================================
// 공유 Geometry (메모리 최적화)
// ============================================

let _headGeometry: THREE.BoxGeometry | null = null;
let _bodyGeometry: THREE.BoxGeometry | null = null;
let _legGeometry: THREE.BoxGeometry | null = null;
let _armGeometry: THREE.BoxGeometry | null = null;

/**
 * 공유 geometry 가져오기 (lazy init)
 * ★ 다리/팔 geometry는 translate로 피벗을 관절(상단)에 배치
 *   → rotation.x 적용 시 엉덩이/어깨 기준으로 자연스럽게 스윙
 */
export function getSharedGeometries() {
  if (!_headGeometry) {
    _headGeometry = new THREE.BoxGeometry(HEAD_SIZE, HEAD_SIZE, HEAD_SIZE);
  }
  if (!_bodyGeometry) {
    _bodyGeometry = new THREE.BoxGeometry(BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH);
  }
  if (!_legGeometry) {
    _legGeometry = new THREE.BoxGeometry(LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH);
    // 피벗을 다리 상단(엉덩이)에 배치 — geometry를 아래로 이동
    _legGeometry.translate(0, -LEG_HEIGHT / 2, 0);
  }
  if (!_armGeometry) {
    _armGeometry = new THREE.BoxGeometry(ARM_WIDTH, ARM_HEIGHT, ARM_DEPTH);
    // 피벗을 팔 상단(어깨)에 배치 — geometry를 아래로 이동
    _armGeometry.translate(0, -ARM_HEIGHT / 2, 0);
  }
  return {
    head: _headGeometry,
    body: _bodyGeometry,
    leg: _legGeometry,
    arm: _armGeometry,
  };
}

/** 공유 geometry 정리 (앱 언마운트 시) */
export function disposeSharedGeometries() {
  _headGeometry?.dispose();
  _bodyGeometry?.dispose();
  _legGeometry?.dispose();
  _armGeometry?.dispose();
  _headGeometry = null;
  _bodyGeometry = null;
  _legGeometry = null;
  _armGeometry = null;
}

// ============================================
// 기본 Material 생성
// ============================================

/** 캐릭터 파트별 기본 material 생성 */
export function createPartMaterial(color: string | number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.1,
    // voxel 느낌을 위한 flatShading
    flatShading: true,
  });
}

// ============================================
// 캐릭터 모델 생성
// ============================================

/** 기본 캐릭터 색상 */
export interface CharacterColors {
  /** 머리 색상 (hair color) */
  head: string;
  /** 몸통 색상 (body/outfit color) */
  body: string;
  /** 다리 색상 (pants color) */
  legs: string;
  /** 팔 색상 (보통 body와 동일) */
  arms: string;
  /** 액센트 색상 (eyes, belt 등 디테일 - 향후 확장) */
  accent: string;
}

/** 기본 캐릭터 색상 (NEO 기본값) */
export const DEFAULT_COLORS: CharacterColors = {
  head: '#1f2120',    // 검은 머리
  body: '#f8fafc',    // 흰 셔츠
  legs: '#1e293b',    // 네이비 바지
  arms: '#f8fafc',    // 셔츠와 동일
  accent: '#00FF41',  // 매트릭스 그린
};

/**
 * createBaseCharacterGeometry — 3-head chibi 비율 BoxGeometry 기반 캐릭터 생성
 *
 * @param colors - 파트별 색상 (선택, 기본 NEO 스타일)
 * @returns CharacterParts 객체 (group + 개별 파트 참조)
 *
 * 캐릭터 Y 구조 (아래→위):
 * - legs: y=0 ~ LEG_HEIGHT (0.7)
 * - body: y=LEG_HEIGHT ~ LEG_HEIGHT+BODY_HEIGHT (0.7 ~ 1.6)
 * - head: y=LEG_HEIGHT+BODY_HEIGHT ~ LEG_HEIGHT+BODY_HEIGHT+HEAD_SIZE (1.6 ~ 2.8)
 *
 * pivot은 발바닥 (y=0) 기준
 */
export function createBaseCharacterGeometry(
  colors: CharacterColors = DEFAULT_COLORS
): CharacterParts {
  const geometries = getSharedGeometries();
  const group = new THREE.Group();
  group.name = 'voxelCharacter';

  // Y 오프셋 계산 (발바닥 = y:0)
  // ★ 다리/팔은 geometry가 translate(-height/2)되어 피벗이 상단(관절)에 있음
  //   → mesh.position.y = 관절 높이 (엉덩이/어깨)
  const legJointY = LEG_HEIGHT;  // 엉덩이 관절 = 다리 상단
  const bodyCenterY = LEG_HEIGHT + BODY_HEIGHT / 2;
  const headCenterY = LEG_HEIGHT + BODY_HEIGHT + HEAD_SIZE / 2;
  const armJointY = LEG_HEIGHT + BODY_HEIGHT; // 어깨 관절 = 몸통 상단

  // === 머리 (head) ===
  const headMat = createPartMaterial(colors.head);
  const head = new THREE.Mesh(geometries.head, headMat);
  head.name = PART_NAMES.HEAD;
  head.position.set(0, headCenterY, 0);
  head.castShadow = true;
  group.add(head);

  // === 몸통 (body) ===
  const bodyMat = createPartMaterial(colors.body);
  const body = new THREE.Mesh(geometries.body, bodyMat);
  body.name = PART_NAMES.BODY;
  body.position.set(0, bodyCenterY, 0);
  body.castShadow = true;
  group.add(body);

  // === 왼쪽 다리 (leftLeg) — 피벗: 엉덩이 관절 ===
  const leftLegMat = createPartMaterial(colors.legs);
  const leftLeg = new THREE.Mesh(geometries.leg, leftLegMat);
  leftLeg.name = PART_NAMES.LEFT_LEG;
  leftLeg.position.set(-(LEG_WIDTH / 2 + LEG_GAP / 2), legJointY, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  // === 오른쪽 다리 (rightLeg) — 피벗: 엉덩이 관절 ===
  const rightLegMat = createPartMaterial(colors.legs);
  const rightLeg = new THREE.Mesh(geometries.leg, rightLegMat);
  rightLeg.name = PART_NAMES.RIGHT_LEG;
  rightLeg.position.set(LEG_WIDTH / 2 + LEG_GAP / 2, legJointY, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // === 왼쪽 팔 (leftArm) — 피벗: 어깨 관절 ===
  const leftArmMat = createPartMaterial(colors.arms);
  const leftArm = new THREE.Mesh(geometries.arm, leftArmMat);
  leftArm.name = PART_NAMES.LEFT_ARM;
  leftArm.position.set(-(BODY_WIDTH / 2 + ARM_WIDTH / 2), armJointY, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  // === 오른쪽 팔 (rightArm) — 피벗: 어깨 관절 ===
  const rightArmMat = createPartMaterial(colors.arms);
  const rightArm = new THREE.Mesh(geometries.arm, rightArmMat);
  rightArm.name = PART_NAMES.RIGHT_ARM;
  rightArm.position.set(BODY_WIDTH / 2 + ARM_WIDTH / 2, armJointY, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  const allMeshes = [head, body, leftLeg, rightLeg, leftArm, rightArm];

  return {
    group,
    head,
    body,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    allMeshes,
  };
}

/**
 * disposeCharacter — 캐릭터 material 정리
 * geometry는 공유되므로 dispose하지 않음 (disposeSharedGeometries에서 일괄 정리)
 */
export function disposeCharacter(parts: CharacterParts): void {
  for (const mesh of parts.allMeshes) {
    if (mesh.material instanceof THREE.Material) {
      mesh.material.dispose();
    }
  }
  // group에서 children 제거
  while (parts.group.children.length > 0) {
    parts.group.remove(parts.group.children[0]);
  }
}

/**
 * updateCharacterColors — 캐릭터 파트별 색상 업데이트
 * runtime skin 변경 시 사용
 */
export function updateCharacterColors(
  parts: CharacterParts,
  colors: CharacterColors
): void {
  const setColor = (mesh: THREE.Mesh, color: string) => {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.color.set(color);
  };

  setColor(parts.head, colors.head);
  setColor(parts.body, colors.body);
  setColor(parts.leftLeg, colors.legs);
  setColor(parts.rightLeg, colors.legs);
  setColor(parts.leftArm, colors.arms);
  setColor(parts.rightArm, colors.arms);
}
