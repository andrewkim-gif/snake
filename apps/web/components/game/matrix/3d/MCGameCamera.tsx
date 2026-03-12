'use client';

/**
 * MCGameCamera — OrbitControls 기반 3인칭 카메라 (MatrixScene /new 전용)
 *
 * drei OrbitControls 활용:
 * - 좌클릭 드래그: 카메라 궤도 회전 (자연스러운 damping)
 * - 마우스 휠: 줌 인/아웃
 * - WASD: 카메라가 바라보는 방향 기준 캐릭터 이동
 * - OrbitControls.target = 캐릭터 위치 → 매 프레임 동기화
 * - 가감속: 부드러운 연속 이동
 *
 * 좌표: 2D(x,y) → 3D(x, h, y) — 부호 반전 없음
 */

import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { getMCTerrainHeight } from '@/lib/matrix/rendering3d/mc-terrain-height';

// ============================================
// 상수
// ============================================

// 이동
const WALK_SPEED = 8.0;
const FLY_SPEED = 16.0;
const ACCEL_FACTOR = 8;   // 부드러운 가속 (낮을수록 부드러움)
const DECEL_FACTOR = 6;   // 부드러운 감속

// 물리
const GRAVITY = 25;
const JUMP_VELOCITY = 8;
const MAX_FALL_VELOCITY = 38.4;

// 카메라
const MIN_DISTANCE = 12;
const MAX_DISTANCE = 40;
const DEFAULT_DISTANCE = 22;
const MIN_POLAR = Math.PI * 0.15;  // 거의 위에서 내려다봄 (27°)
const MAX_POLAR = Math.PI * 0.40;  // 지면 위 안전 각도 (72°) — 0.48은 지형 클리핑 발생
const CAM_LOOK_HEIGHT = 1.5;       // 캐릭터 몸 중앙 바라봄
const DAMPING_FACTOR = 0.06;       // OrbitControls damping (더 부드럽게)

// 더블 Space
const DOUBLE_TAP_THRESHOLD = 300;

// 스폰
const SPAWN_X = 8;
const SPAWN_Z = 8;

// ============================================
// Props
// ============================================

export interface MCGameCameraProps {
  playerRef: React.MutableRefObject<{
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    height3d?: number;
  }>;
}

// ============================================
// Component
// ============================================

export default function MCGameCamera({ playerRef }: MCGameCameraProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const prevTimeRef = useRef(performance.now());

  // 플레이어 3D 위치 (발 위치)
  const playerPosRef = useRef(new THREE.Vector3(SPAWN_X, 0, SPAWN_Z));
  const currentVelRef = useRef(new THREE.Vector3()); // 가감속 적용된 현재 속도
  const targetVelRef = useRef(new THREE.Vector3());

  // 물리 상태
  const groundedRef = useRef(true);
  const yVelRef = useRef(0);
  const flyingRef = useRef(false);
  const lastSpacePressRef = useRef(0);

  // 임시 벡터 (매 프레임 재사용)
  const tmpForward = useRef(new THREE.Vector3());
  const tmpRight = useRef(new THREE.Vector3());

  // getTerrainY → 공유 getMCTerrainHeight 사용 (프레임 캐시 + 쌍선형 보간)
  const getTerrainY = useCallback((x: number, z: number): number => {
    return getMCTerrainHeight(x, z);
  }, []);

  // 초기 스폰
  useEffect(() => {
    const terrainY = getTerrainY(SPAWN_X, SPAWN_Z) + 1;
    playerPosRef.current.set(SPAWN_X, terrainY, SPAWN_Z);

    // 카메라 초기 위치: 뒤 위에서 (DEFAULT_DISTANCE 반영)
    camera.position.set(SPAWN_X + 8, terrainY + 14, SPAWN_Z + DEFAULT_DISTANCE);

    // OrbitControls target도 지형 높이에 맞춤
    if (controlsRef.current) {
      controlsRef.current.target.set(SPAWN_X, terrainY + CAM_LOOK_HEIGHT, SPAWN_Z);
    }
  }, [camera, getTerrainY]);

  // ============================================
  // 키보드
  // ============================================

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    // 채팅/입력 필드에서는 무시
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    keysRef.current.add(e.code);

    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
      e.preventDefault();
    }

    if (e.code === 'Space') {
      const now = performance.now();
      const elapsed = now - lastSpacePressRef.current;
      lastSpacePressRef.current = now;

      if (elapsed < DOUBLE_TAP_THRESHOLD) {
        flyingRef.current = !flyingRef.current;
        yVelRef.current = 0;
        if (!flyingRef.current) groundedRef.current = false;
      } else if (!flyingRef.current && groundedRef.current) {
        yVelRef.current = JUMP_VELOCITY;
        groundedRef.current = false;
      }
    }
  }, []);

  const onKeyUp = useCallback((e: KeyboardEvent) => {
    keysRef.current.delete(e.code);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [onKeyDown, onKeyUp]);

  // ============================================
  // useFrame
  // ============================================

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const now = performance.now();
    const delta = Math.min((now - prevTimeRef.current) / 1000, 0.1);
    prevTimeRef.current = now;

    const keys = keysRef.current;
    const pos = playerPosRef.current;
    const speed = flyingRef.current ? FLY_SPEED : WALK_SPEED;

    // --- 1. 카메라 → 타겟 방향으로 forward/right 계산 ---
    // OrbitControls.target → camera 방향의 수평 성분
    tmpForward.current.set(
      controls.target.x - camera.position.x,
      0,
      controls.target.z - camera.position.z,
    );
    // 안전 체크: 직상방 시점에서 forward가 0벡터가 되면 기본 방향 사용
    if (tmpForward.current.lengthSq() < 0.0001) {
      tmpForward.current.set(0, 0, -1);
    } else {
      tmpForward.current.normalize();
    }

    tmpRight.current.crossVectors(tmpForward.current, camera.up).normalize();

    // WASD → 목표 이동 벡터
    const tv = targetVelRef.current;
    tv.set(0, 0, 0);
    if (keys.has('KeyW')) tv.add(tmpForward.current);
    if (keys.has('KeyS')) tv.sub(tmpForward.current);
    if (keys.has('KeyA')) tv.sub(tmpRight.current);
    if (keys.has('KeyD')) tv.add(tmpRight.current);

    if (tv.lengthSq() > 0) tv.normalize().multiplyScalar(speed);

    // --- 2. 가감속 ---
    const cur = currentVelRef.current;
    const factor = tv.lengthSq() > 0 ? ACCEL_FACTOR : DECEL_FACTOR;
    cur.lerp(tv, 1 - Math.exp(-factor * delta));
    if (cur.lengthSq() < 0.001) cur.set(0, 0, 0);

    // 이전 위치 저장 (카메라 오프셋 유지용)
    const prevX = pos.x;
    const prevY = pos.y;
    const prevZ = pos.z;

    // 수평 이동
    pos.x += cur.x * delta;
    pos.z += cur.z * delta;

    // --- 3. 수직 물리 ---
    if (flyingRef.current) {
      if (keys.has('Space')) pos.y += FLY_SPEED * delta;
      if (keys.has('ShiftLeft') || keys.has('ShiftRight')) pos.y -= FLY_SPEED * delta;
      groundedRef.current = false;
    } else {
      if (!groundedRef.current) {
        yVelRef.current -= GRAVITY * delta;
        if (yVelRef.current < -MAX_FALL_VELOCITY) yVelRef.current = -MAX_FALL_VELOCITY;
      }
      if (yVelRef.current !== 0) pos.y += yVelRef.current * delta;

      const terrainY = getTerrainY(pos.x, pos.z) + 1;
      if (pos.y <= terrainY) {
        pos.y = terrainY;
        yVelRef.current = 0;
        groundedRef.current = true;
      } else if (groundedRef.current && yVelRef.current === 0) {
        const diff = terrainY - pos.y;
        if (Math.abs(diff) <= 1.5) {
          pos.y += diff * (1 - Math.exp(-15 * delta));
        } else if (diff < -1.5) {
          groundedRef.current = false;
        }
      }
    }

    // 안전장치
    if (pos.y < -50) {
      pos.y = getTerrainY(pos.x, pos.z) + 1;
      yVelRef.current = 0;
      groundedRef.current = true;
    }

    // --- 4. OrbitControls target + camera 동기화 ---
    // 플레이어 이동량만큼 카메라도 함께 이동 (궤도 유지)
    const dx = pos.x - prevX;
    const dz = pos.z - prevZ;
    const dy = pos.y - prevY;

    controls.target.x += dx;
    controls.target.y = pos.y + CAM_LOOK_HEIGHT;
    controls.target.z += dz;

    camera.position.x += dx;
    camera.position.y += dy; // 점프/지형 변화 시 카메라도 따라감
    camera.position.z += dz;

    // --- 4.5. 카메라 지형 충돌 보정 ---
    // 카메라가 지형 아래로 내려가면 distance를 늘려서 카메라를 위로 밀어올림
    // OrbitControls 내부 상태와 호환되는 유일한 안전한 방법
    const camTerrainY = getTerrainY(camera.position.x, camera.position.z) + 2.5;
    if (camera.position.y < camTerrainY) {
      // 현재 polar angle에서 필요한 최소 distance 계산
      const polar = controls.getPolarAngle();
      const cosPolar = Math.cos(polar);
      // target.y - distance * cosPolar = camTerrainY → distance = (target.y - camTerrainY) / cosPolar
      if (cosPolar > 0.01) {
        const neededDist = (controls.target.y - camTerrainY) / cosPolar;
        if (neededDist > controls.getDistance()) {
          // distance를 최소 필요 거리로 확장 (MAX_DISTANCE 이내)
          const safeDist = Math.min(neededDist + 1, MAX_DISTANCE);
          // OrbitControls의 minDistance를 일시적으로 높여 강제 적용
          controls.minDistance = safeDist;
        }
      }
    } else {
      // 안전 → 원래 minDistance 복구
      controls.minDistance = MIN_DISTANCE;
    }

    // --- 5. player ref 동기화 ---
    playerRef.current.position.x = pos.x;
    playerRef.current.position.y = pos.z;
    playerRef.current.height3d = pos.y; // 3D Y 좌표 (점프 포함)
    playerRef.current.velocity.x = cur.x;
    playerRef.current.velocity.y = cur.z;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={DAMPING_FACTOR}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      minPolarAngle={MIN_POLAR}
      maxPolarAngle={MAX_POLAR}
      target={[SPAWN_X, 32 + CAM_LOOK_HEIGHT, SPAWN_Z]}
      keyEvents={false}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      }}
    />
  );
}
