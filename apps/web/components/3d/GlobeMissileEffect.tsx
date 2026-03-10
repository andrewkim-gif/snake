'use client';

/**
 * GlobeMissileEffect — v23 Phase 2
 * Missile trajectories from attacker to defender on the 3D globe.
 * - Procedural 3D missile mesh (cone nose + cylinder body)
 * - InstancedMesh for max 10 simultaneous missiles with tangent alignment
 * - Smoke trail: InstancedMesh billboard PlaneGeometry particles
 * - Triggers shockwave callback on impact
 */

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { latLngToVector3 } from '@/lib/globe-utils';
import { getArcPointGCFree } from '@/lib/effect-utils';
import { ARC_HEIGHT } from '@/lib/effect-constants';
import type { DistanceLODConfig } from '@/hooks/useGlobeLOD';

// ─── Types ───

export interface MissileData {
  id: string;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startTime: number;
  duration: number;
  active: boolean;
}

export interface GlobeMissileEffectProps {
  wars: Array<{
    warId: string;
    state: 'preparation' | 'active' | 'ended';
    attacker: string;
    defender: string;
  }>;
  countryCentroids: Map<string, [number, number]>;
  globeRadius?: number;
  onImpact?: (position: THREE.Vector3, warId: string) => void;
  visible?: boolean;
  /** 모바일 LOD — 동시 미사일 최대 수 (기본 10) */
  maxMissiles?: number;
  /** v33 Phase 4: 카메라 거리 LOD 설정 */
  distanceLOD?: DistanceLODConfig;
}

// ─── Constants ───

const MAX_MISSILES = 10;
const MISSILE_DURATION = 1.8;
const MISSILE_LAUNCH_INTERVAL = 2.5;
const SMOKE_PARTICLES_PER_MISSILE = 7;
const TOTAL_SMOKE = MAX_MISSILES * SMOKE_PARTICLES_PER_MISSILE;

// ─── Colors ───

const NOSE_COLOR = new THREE.Color(0xff3333);   // v24: 통일 전쟁 적색 노즈콘
const BODY_COLOR = new THREE.Color(0xcccccc);   // 밝은 회색 바디

// ─── Module-scope temp objects (GC 방지, NFR-4) ───

const _dummy = new THREE.Object3D();
const _smokeDummy = new THREE.Object3D();
const _tempVec = new THREE.Vector3();
const _tempVec2 = new THREE.Vector3();
const _tempVec3 = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _rotMatrix = new THREE.Matrix4();
const _smokeColor = new THREE.Color();
const _impactPos = new THREE.Vector3();

// ─── Procedural Missile3D Geometry ───

function createMissileGeometry(): THREE.BufferGeometry {
  // 노즈콘: ConeGeometry (반지름 0.3, 높이 1.5, 8 세그먼트)
  const nose = new THREE.ConeGeometry(0.3, 1.5, 8);
  // 콘의 중심이 0이므로, 위로 이동하여 바디 위에 배치
  // 바디 높이 0.8의 절반 = 0.4, 노즈 높이 1.5의 절반 = 0.75
  nose.translate(0, 0.4 + 0.75, 0); // y = 1.15

  // 바디: CylinderGeometry (반지름 0.15, 높이 0.8, 8 세그먼트)
  const body = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
  // 바디 중심은 0 (그대로)

  // 색상 어트리뷰트 추가 (노즈=빨강, 바디=회색)
  const noseColors = new Float32Array(nose.attributes.position.count * 3);
  for (let i = 0; i < nose.attributes.position.count; i++) {
    noseColors[i * 3] = NOSE_COLOR.r;
    noseColors[i * 3 + 1] = NOSE_COLOR.g;
    noseColors[i * 3 + 2] = NOSE_COLOR.b;
  }
  nose.setAttribute('color', new THREE.BufferAttribute(noseColors, 3));

  const bodyColors = new Float32Array(body.attributes.position.count * 3);
  for (let i = 0; i < body.attributes.position.count; i++) {
    bodyColors[i * 3] = BODY_COLOR.r;
    bodyColors[i * 3 + 1] = BODY_COLOR.g;
    bodyColors[i * 3 + 2] = BODY_COLOR.b;
  }
  body.setAttribute('color', new THREE.BufferAttribute(bodyColors, 3));

  // 두 지오메트리 합치기
  const merged = mergeGeometries([nose, body], false);

  // 정리
  nose.dispose();
  body.dispose();

  if (!merged) {
    // 폴백: 단순 콘
    return new THREE.ConeGeometry(0.3, 2.0, 8);
  }

  // 미사일 기본 방향: Y+ (cone은 Y+를 향함)
  // useFrame에서 lookAt 방향으로 회전시킴
  return merged;
}

// ─── Smoke Trail Texture (작은 원형 그라디언트) ───

function createSmokeTexture(): THREE.CanvasTexture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  gradient.addColorStop(0, 'rgba(200, 200, 200, 1.0)');
  gradient.addColorStop(0.4, 'rgba(180, 180, 180, 0.6)');
  gradient.addColorStop(0.7, 'rgba(150, 150, 150, 0.2)');
  gradient.addColorStop(1, 'rgba(100, 100, 100, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// ─── Missile state tracking ───

interface MissileState {
  active: boolean;
  warId: string;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startTime: number;
  arcHeight: number;
}

// ─── Component ───

export function GlobeMissileEffect({
  wars,
  countryCentroids,
  globeRadius = 100,
  onImpact,
  visible = true,
  maxMissiles = MAX_MISSILES,
  distanceLOD,
}: GlobeMissileEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const clockRef = useRef(0);
  const lastLaunchRef = useRef<Map<string, number>>(new Map());
  // v33 Phase 4: far LOD에서 프레임 스킵용 카운터
  const frameCountRef = useRef(0);
  const missilesRef = useRef<MissileState[]>(
    Array.from({ length: MAX_MISSILES }, () => ({
      active: false,
      warId: '',
      startPos: new THREE.Vector3(),
      endPos: new THREE.Vector3(),
      startTime: 0,
      arcHeight: 0,
    })),
  );

  // Camera reference for billboard smoke
  const { camera } = useThree();

  // ─── Missile head: Procedural 3D mesh ───
  const missileGeometry = useMemo(() => createMissileGeometry(), []);
  const missileMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    [],
  );

  // ─── Smoke trail: InstancedMesh + PlaneGeometry billboard ───
  const smokeGeometry = useMemo(() => new THREE.PlaneGeometry(0.5, 0.5), []);
  const smokeTexture = useMemo(() => createSmokeTexture(), []);
  const smokeMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      map: smokeTexture,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    [smokeTexture],
  );

  // ★ ref callback으로 count=0 즉시 설정 (useEffect는 첫 렌더 후라 1프레임 지연)
  const headInstancedRef = useRef<THREE.InstancedMesh>(null);
  const smokeInstancedRef = useRef<THREE.InstancedMesh>(null);
  const headRefCb = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (mesh) { mesh.count = 0; headInstancedRef.current = mesh; }
  }, []);
  const smokeRefCb = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (mesh) { mesh.count = 0; smokeInstancedRef.current = mesh; }
  }, []);

  // Get position for country from centroids
  const getPos = useCallback(
    (iso3: string): THREE.Vector3 | null => {
      const c = countryCentroids.get(iso3);
      if (!c) return null;
      return latLngToVector3(c[0], c[1], globeRadius * 1.02);
    },
    [countryCentroids, globeRadius],
  );

  // Launch a new missile (LOD-limited by maxMissiles prop)
  const launchMissile = useCallback(
    (warId: string, start: THREE.Vector3, end: THREE.Vector3, time: number) => {
      const missiles = missilesRef.current;
      const limit = Math.min(maxMissiles, MAX_MISSILES);
      for (let i = 0; i < limit; i++) {
        if (!missiles[i].active) {
          const dist = start.distanceTo(end);
          missiles[i].active = true;
          missiles[i].warId = warId;
          missiles[i].startPos.copy(start);
          missiles[i].endPos.copy(end);
          missiles[i].startTime = time;
          missiles[i].arcHeight = dist * ARC_HEIGHT.missile;
          return;
        }
      }
    },
    [maxMissiles],
  );

  useFrame((_, delta) => {
    const headMesh = headInstancedRef.current;
    const smokeMesh = smokeInstancedRef.current;
    if (!headMesh || !smokeMesh) return;

    // v33 Phase 4: 활성 전쟁이 없고 모든 미사일 비활성이면 스킵 (closure 회피)
    const missiles = missilesRef.current;
    let hasWork = false;
    for (let i = 0; i < wars.length; i++) {
      if (wars[i].state === 'active') { hasWork = true; break; }
    }
    if (!hasWork) {
      for (let i = 0; i < missiles.length; i++) {
        if (missiles[i].active) { hasWork = true; break; }
      }
    }
    if (!hasWork) return;
    // v33 Phase 4: far LOD에서 매 2프레임마다 1회 업데이트 (미사일은 빈도 높게)
    frameCountRef.current++;
    if (distanceLOD?.distanceTier === 'far' && frameCountRef.current % 2 !== 0) return;

    clockRef.current += delta;
    const now = clockRef.current;
    // v33 Phase 4: far LOD에서 연기 파티클 스킵 여부 (루프 밖에서 1회 계산)
    const _showSmoke = distanceLOD?.showParticles ?? true;

    // ─── Launch missiles for active wars ───
    for (const war of wars) {
      if (war.state !== 'active') continue;
      const lastLaunch = lastLaunchRef.current.get(war.warId) ?? -Infinity;
      if (now - lastLaunch >= MISSILE_LAUNCH_INTERVAL) {
        const atkPos = getPos(war.attacker);
        const defPos = getPos(war.defender);
        if (atkPos && defPos) {
          const dir = Math.random() > 0.5;
          launchMissile(war.warId, dir ? atkPos : defPos, dir ? defPos : atkPos, now);
          lastLaunchRef.current.set(war.warId, now);
        }
      }
    }

    // ─── Update missile positions + smoke trail ───
    for (let i = 0; i < MAX_MISSILES; i++) {
      const m = missiles[i];

      if (!m.active) {
        // 미사일 숨기기
        _dummy.position.set(0, 0, -9999);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        headMesh.setMatrixAt(i, _dummy.matrix);

        // 연기 파티클 숨기기
        for (let j = 0; j < SMOKE_PARTICLES_PER_MISSILE; j++) {
          const sIdx = i * SMOKE_PARTICLES_PER_MISSILE + j;
          _smokeDummy.position.set(0, 0, -9999);
          _smokeDummy.scale.setScalar(0);
          _smokeDummy.updateMatrix();
          smokeMesh.setMatrixAt(sIdx, _smokeDummy.matrix);
          // 투명하게
          _smokeColor.setRGB(0, 0, 0);
          smokeMesh.setColorAt(sIdx, _smokeColor);
        }
        continue;
      }

      const elapsed = now - m.startTime;
      const t = elapsed / MISSILE_DURATION;

      if (t >= 1.0) {
        // 착탄!
        m.active = false;
        _impactPos.copy(m.endPos);
        onImpact?.(_impactPos.clone(), m.warId);

        _dummy.position.set(0, 0, -9999);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        headMesh.setMatrixAt(i, _dummy.matrix);

        // 연기도 숨기기
        for (let j = 0; j < SMOKE_PARTICLES_PER_MISSILE; j++) {
          const sIdx = i * SMOKE_PARTICLES_PER_MISSILE + j;
          _smokeDummy.position.set(0, 0, -9999);
          _smokeDummy.scale.setScalar(0);
          _smokeDummy.updateMatrix();
          smokeMesh.setMatrixAt(sIdx, _smokeDummy.matrix);
        }
        continue;
      }

      // ─── Missile head: 현재 위치 ───
      getArcPointGCFree(m.startPos, m.endPos, t, m.arcHeight, _tempVec);

      // ─── Tangent 방향 계산 (다음 위치 - 현재 위치) ───
      const tNext = Math.min(t + 0.02, 1.0);
      getArcPointGCFree(m.startPos, m.endPos, tNext, m.arcHeight, _tempVec2);
      _forward.subVectors(_tempVec2, _tempVec).normalize();

      // 미사일 방향 정렬: 기본 방향 Y+를 forward로 회전
      _quat.setFromUnitVectors(_up, _forward);

      _dummy.position.copy(_tempVec);
      _dummy.quaternion.copy(_quat);
      // 약간의 맥동 효과
      const pulse = 1.0 + 0.15 * Math.sin(now * 12);
      _dummy.scale.setScalar(pulse);
      _dummy.updateMatrix();
      headMesh.setMatrixAt(i, _dummy.matrix);

      // ─── Smoke trail: 미사일 뒤에 빌보드 파티클 ───
      for (let j = 0; j < SMOKE_PARTICLES_PER_MISSILE; j++) {
        const sIdx = i * SMOKE_PARTICLES_PER_MISSILE + j;
        // v33 Phase 4: far LOD에서 연기 파티클 스킵 (미사일 헤드만 표시)
        if (!_showSmoke) {
          _smokeDummy.position.set(0, 0, -9999);
          _smokeDummy.scale.setScalar(0);
          _smokeDummy.updateMatrix();
          smokeMesh.setMatrixAt(sIdx, _smokeDummy.matrix);
          continue;
        }
        const tailT = Math.max(0, t - (j + 1) * 0.035);

        getArcPointGCFree(m.startPos, m.endPos, tailT, m.arcHeight, _tempVec3);

        // 크기: 뒤로 갈수록 증가 (0.3 → 0.8)
        const sizeFactor = 0.3 + (j / (SMOKE_PARTICLES_PER_MISSILE - 1)) * 0.5;
        // 투명도: 뒤로 갈수록 감소 (0.6 → 0.0)
        const alpha = Math.max(0, 0.6 - (j / (SMOKE_PARTICLES_PER_MISSILE - 1)) * 0.6);

        _smokeDummy.position.copy(_tempVec3);
        // 빌보드: 카메라 방향을 향하도록 quaternion 복사
        _smokeDummy.quaternion.copy(camera.quaternion);
        _smokeDummy.scale.setScalar(sizeFactor);
        _smokeDummy.updateMatrix();
        smokeMesh.setMatrixAt(sIdx, _smokeDummy.matrix);

        // 회색-흰색 컬러 (alpha는 color로 시뮬레이션 - 어두워지게)
        const gray = 0.6 + 0.4 * alpha;
        _smokeColor.setRGB(gray * alpha, gray * alpha, gray * alpha);
        smokeMesh.setColorAt(sIdx, _smokeColor);
      }
    }

    // ★ count 복원 (useEffect에서 count=0으로 시작했을 수 있음)
    headMesh.count = MAX_MISSILES;
    smokeMesh.count = TOTAL_SMOKE;
    headMesh.instanceMatrix.needsUpdate = true;
    smokeMesh.instanceMatrix.needsUpdate = true;
    if (smokeMesh.instanceColor) {
      smokeMesh.instanceColor.needsUpdate = true;
    }
  });

  // Cleanup
  useEffect(() => {
    return () => {
      missileGeometry.dispose();
      missileMaterial.dispose();
      smokeGeometry.dispose();
      smokeMaterial.dispose();
      smokeTexture.dispose();
    };
  }, [missileGeometry, missileMaterial, smokeGeometry, smokeMaterial, smokeTexture]);

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      {/* 미사일 헤드 — 3D 원뿔+원기둥 InstancedMesh */}
      <instancedMesh
        ref={headRefCb}
        args={[missileGeometry, missileMaterial, MAX_MISSILES]}
        frustumCulled={false}
      />
      {/* 연기 트레일 — 빌보드 PlaneGeometry InstancedMesh */}
      <instancedMesh
        ref={smokeRefCb}
        args={[smokeGeometry, smokeMaterial, TOTAL_SMOKE]}
        frustumCulled={false}
      />
    </group>
  );
}

export default GlobeMissileEffect;
