'use client';

/**
 * HitParticleSystem.tsx — 피격/사망 파티클 시스템 (v47 Phase 2)
 *
 * InstancedMesh 기반 파티클 풀 (PlaneGeometry + AdditiveBlending, max 200)
 * - Hit 파티클: hitFlashMap 변경 감지 → 적 위치에 5-8개 분산 (0.3-0.5s)
 * - Death burst: deathEventsRef 소비 → 15-25개 방사형 폭발 (0.5-0.8s)
 * - 무기별 색상: physical=white-yellow, magic=blue-cyan, poison=green
 * - CPU-driven: useFrame에서 위치/크기/투명도 업데이트
 * - Billboard: 매 프레임 카메라 방향으로 회전
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, height, y) — MC FPS 좌표
 */

import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Enemy } from '@/lib/matrix/types';
import { getMCTerrainHeight } from '@/lib/matrix/rendering3d/mc-terrain-height';

// ============================================
// 상수
// ============================================

/** 최대 파티클 수 (풀 크기) */
const MAX_PARTICLES = 200;

/** 영점 스케일 매트릭스 (비활성 파티클 숨김) */
const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

/** 중력 가속도 */
const GRAVITY = -20;

// Hit 파티클 설정
const HIT_COUNT_MIN = 5;
const HIT_COUNT_MAX = 8;
const HIT_SPEED_MIN = 3;
const HIT_SPEED_MAX = 7;
const HIT_SCALE_MIN = 0.12;
const HIT_SCALE_MAX = 0.28;
const HIT_LIFE_MIN = 0.3;
const HIT_LIFE_MAX = 0.5;

// Death 파티클 설정
const DEATH_COUNT_MIN = 15;
const DEATH_COUNT_MAX = 25;
const DEATH_SPEED_MIN = 4;
const DEATH_SPEED_MAX = 10;
const DEATH_SCALE_MIN = 0.2;
const DEATH_SCALE_MAX = 0.45;
const DEATH_LIFE_MIN = 0.5;
const DEATH_LIFE_MAX = 0.8;

// 무기별 파티클 색상 매핑 (physical=white-yellow, magic=blue-cyan, poison=green)
const COLOR_PHYSICAL: [number, number, number][] = [
  [1.0, 1.0, 0.85],   // 밝은 흰색
  [1.0, 0.92, 0.65],  // 연한 노란색
  [1.0, 0.82, 0.45],  // 황금색
  [0.95, 0.88, 0.55],  // 따뜻한 노란색
];

const COLOR_MAGIC: [number, number, number][] = [
  [0.3, 0.7, 1.0],   // 하늘색
  [0.2, 0.85, 1.0],  // 밝은 시안
  [0.4, 0.5, 1.0],   // 연한 파란색
  [0.15, 0.75, 0.9], // 청록색
];

const COLOR_POISON: [number, number, number][] = [
  [0.2, 1.0, 0.3],   // 밝은 초록색
  [0.3, 0.9, 0.2],   // 연두색
  [0.1, 0.8, 0.4],   // 에메랄드
  [0.35, 1.0, 0.15], // 라임색
];

// 임시 연산 객체 (GC 방지)
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();
const _lookTarget = new THREE.Vector3();

// ============================================
// 파티클 상태
// ============================================

interface HitParticle {
  active: boolean;
  x: number;      // 3D X
  y: number;      // 3D Y (높이)
  z: number;      // 3D Z
  vx: number;     // X 속도
  vy: number;     // Y 속도 (높이)
  vz: number;     // Z 속도
  life: number;   // 남은 수명 (초)
  maxLife: number; // 최대 수명
  size: number;   // 기본 스케일
  r: number;      // 색상 R
  g: number;      // 색상 G
  b: number;      // 색상 B
}

// ============================================
// Death 이벤트 (DeathParticles.tsx에서 가져옴)
// ============================================

/** 사망 이벤트 구조 — DeathParticles의 DeathEvent와 동일 */
interface HitDeathEvent {
  position: { x: number; y: number };
  color: string;
  isBoss: boolean;
  isElite?: boolean;
  eliteTier?: string;
}

// ============================================
// Props
// ============================================

export interface HitParticleSystemProps {
  /** 적 배열 ref */
  enemiesRef: React.MutableRefObject<Enemy[]>;
  /** 적별 hit flash 타이머 (enemyId → 남은 시간) */
  hitFlashMapRef: React.MutableRefObject<Map<string, number>>;
  /** 사망 이벤트 큐 ref (DeathParticles와 공유) */
  deathEventsRef: React.MutableRefObject<HitDeathEvent[]>;
}

// ============================================
// HitParticleSystem Component
// ============================================

export function HitParticleSystem({
  enemiesRef,
  hitFlashMapRef,
  deathEventsRef,
}: HitParticleSystemProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();

  // 파티클 풀 (ring buffer — 오래된 파티클을 덮어씀)
  const poolRef = useRef<HitParticle[]>([]);
  const nextIdxRef = useRef(0);

  // hitFlashMap 이전 프레임 스냅샷 (새 히트 감지용)
  const prevHitIdsRef = useRef<Set<string>>(new Set());

  // death 이벤트 분리 큐 (deathEventsRef를 peek만 하고 소비하지 않음)
  // → deathEventsRef는 DeathParticles가 소비하므로, 같은 이벤트를 peek해서 사용
  const lastDeathCountRef = useRef(0);

  // 풀 초기화 (useMemo — 한 번만)
  useMemo(() => {
    const pool: HitParticle[] = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      pool.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 0.3,
        size: 0.15,
        r: 1, g: 1, b: 1,
      });
    }
    poolRef.current = pool;
  }, []);

  // Material (AdditiveBlending — 밝게 빛나는 파티클)
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, []);

  // Geometry (작은 PlaneGeometry — billboard로 사용)
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(1, 1);
  }, []);

  // ============================================
  // useFrame: 히트 감지 + death burst + 파티클 업데이트
  // ============================================

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dt = Math.min(delta, 0.05);
    const pool = poolRef.current;
    const enemies = enemiesRef.current;
    const hitFlashMap = hitFlashMapRef.current;
    const prevHitIds = prevHitIdsRef.current;
    const camPos = camera.position;

    // === 1. 히트 파티클 스폰 (새 hitFlash 엔트리 감지) ===
    for (const [enemyId] of hitFlashMap.entries()) {
      if (!prevHitIds.has(enemyId)) {
        // 새로운 히트 — 적 위치에서 파티클 스폰
        const enemy = enemies.find(e => e.id === enemyId);
        if (enemy) {
          spawnHitParticles(pool, nextIdxRef, enemy.position.x, enemy.position.y);
        }
      }
    }

    // 스냅샷 업데이트
    prevHitIds.clear();
    for (const [id] of hitFlashMap.entries()) {
      prevHitIds.add(id);
    }

    // === 2. Death burst 스폰 (deathEventsRef peek) ===
    // deathEventsRef는 DeathParticles가 shift()로 소비하므로,
    // 우리는 이벤트가 추가된 순간에만 peek해서 파티클을 스폰.
    // 접근: deathEvents 배열의 현재 길이를 추적하여 새 이벤트 감지
    const deathEvents = deathEventsRef.current;
    const currentDeathCount = deathEvents.length;
    if (currentDeathCount > lastDeathCountRef.current) {
      // 새로운 사망 이벤트가 추가됨 — 마지막으로 본 이후의 이벤트만 처리
      for (let i = lastDeathCountRef.current; i < currentDeathCount; i++) {
        const event = deathEvents[i];
        if (event) {
          spawnDeathBurst(
            pool,
            nextIdxRef,
            event.position.x,
            event.position.y,
            event.color,
            event.isBoss,
          );
        }
      }
    }
    lastDeathCountRef.current = currentDeathCount;
    // DeathParticles가 shift()로 비우면 카운터 리셋
    if (currentDeathCount === 0) {
      lastDeathCountRef.current = 0;
    }

    // === 3. 파티클 물리 + 렌더링 업데이트 ===
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = pool[i];

      if (!p.active) {
        mesh.setMatrixAt(i, ZERO_MATRIX);
        continue;
      }

      // 수명 감소
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        mesh.setMatrixAt(i, ZERO_MATRIX);
        continue;
      }

      // 물리 업데이트
      p.x += p.vx * dt;
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // 바닥 바운스 (지면 아래로 내려가지 않도록)
      if (p.y < 0.1) {
        p.y = 0.1;
        p.vy = Math.abs(p.vy) * 0.15;
        if (Math.abs(p.vy) < 0.3) p.vy = 0;
      }

      // 공기 저항
      p.vx *= 0.96;
      p.vz *= 0.96;

      // 수명 비율 (1→0)
      const lifeRatio = p.life / p.maxLife;

      // 스케일: quadratic ease-out 축소
      const s = p.size * lifeRatio * lifeRatio;

      // Billboard — 카메라를 향하도록 회전
      _pos.set(p.x, p.y, p.z);
      _lookTarget.copy(camPos);
      _matrix.identity();
      _matrix.lookAt(_pos, _lookTarget, THREE.Object3D.DEFAULT_UP);
      _scale.set(s, s, s);
      _matrix.scale(_scale);
      _matrix.setPosition(p.x, p.y, p.z);

      mesh.setMatrixAt(i, _matrix);

      // 색상: additive blend이므로 밝기 감소 = 투명해짐
      const brightness = lifeRatio * lifeRatio; // quadratic fade
      _color.setRGB(
        p.r * brightness * 2.0,
        p.g * brightness * 2.0,
        p.b * brightness * 2.0,
      );
      mesh.setColorAt(i, _color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_PARTICLES]}
      frustumCulled={false}
    />
  );
}

// ============================================
// 파티클 스폰 유틸리티
// ============================================

/**
 * Hit 파티클 스폰 — 적 위치에 5-8개 분산
 * 무기별 색상: 기본은 physical (white-yellow)
 */
function spawnHitParticles(
  pool: HitParticle[],
  nextIdxRef: React.MutableRefObject<number>,
  worldX: number,
  worldY: number,
) {
  const count = HIT_COUNT_MIN +
    Math.floor(Math.random() * (HIT_COUNT_MAX - HIT_COUNT_MIN + 1));

  const terrainH = getMCTerrainHeight(worldX, worldY);
  const baseY = terrainH + 1.5; // 적 중심 높이

  // 색상 팔레트 선택 (물리/마법/독 중 랜덤 가중치)
  // 대부분의 무기가 물리이므로 70% physical, 20% magic, 10% poison
  const roll = Math.random();
  const palette = roll < 0.7 ? COLOR_PHYSICAL : roll < 0.9 ? COLOR_MAGIC : COLOR_POISON;

  for (let i = 0; i < count; i++) {
    const idx = nextIdxRef.current % MAX_PARTICLES;
    nextIdxRef.current++;
    const p = pool[idx];

    // 방사형 분산 각도 + 랜덤
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 1.2;
    const elevAngle = Math.random() * Math.PI * 0.5 + 0.1; // 위쪽 편향
    const speed = HIT_SPEED_MIN + Math.random() * (HIT_SPEED_MAX - HIT_SPEED_MIN);

    p.active = true;
    p.x = worldX + (Math.random() - 0.5) * 0.6;
    p.y = baseY + (Math.random() - 0.5) * 0.5;
    p.z = worldY + (Math.random() - 0.5) * 0.6;
    p.vx = Math.cos(angle) * Math.cos(elevAngle) * speed;
    p.vy = Math.sin(elevAngle) * speed + 1.5;
    p.vz = Math.sin(angle) * Math.cos(elevAngle) * speed;
    p.life = HIT_LIFE_MIN + Math.random() * (HIT_LIFE_MAX - HIT_LIFE_MIN);
    p.maxLife = p.life;
    p.size = HIT_SCALE_MIN + Math.random() * (HIT_SCALE_MAX - HIT_SCALE_MIN);

    // 팔레트에서 색상 선택 + 약간 변형
    const [r, g, b] = palette[Math.floor(Math.random() * palette.length)];
    p.r = Math.min(1, r + (Math.random() - 0.5) * 0.12);
    p.g = Math.min(1, g + (Math.random() - 0.5) * 0.12);
    p.b = Math.min(1, b + (Math.random() - 0.5) * 0.12);
  }
}

/**
 * Death burst 파티클 스폰 — 15-25개 방사형 폭발
 */
function spawnDeathBurst(
  pool: HitParticle[],
  nextIdxRef: React.MutableRefObject<number>,
  worldX: number,
  worldY: number,
  enemyColor: string,
  isBoss: boolean,
) {
  const baseCount = DEATH_COUNT_MIN +
    Math.floor(Math.random() * (DEATH_COUNT_MAX - DEATH_COUNT_MIN + 1));
  const count = isBoss ? Math.min(baseCount + 8, 35) : baseCount;

  const terrainH = getMCTerrainHeight(worldX, worldY);
  const baseHeight = terrainH + 1.5;

  // 적 색상 파싱
  _color.set(enemyColor);
  const baseR = _color.r;
  const baseG = _color.g;
  const baseB = _color.b;

  for (let i = 0; i < count; i++) {
    const idx = nextIdxRef.current % MAX_PARTICLES;
    nextIdxRef.current++;
    const p = pool[idx];

    // 방사형 폭발 — 360도 균등 분포
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const elevAngle = Math.random() * Math.PI * 0.7 - Math.PI * 0.1;
    const speed = DEATH_SPEED_MIN + Math.random() * (DEATH_SPEED_MAX - DEATH_SPEED_MIN);
    const bossMult = isBoss ? 1.4 : 1.0;

    p.active = true;
    p.x = worldX + (Math.random() - 0.5) * 1.2;
    p.y = baseHeight + (Math.random() - 0.5) * 0.8;
    p.z = worldY + (Math.random() - 0.5) * 1.2;
    p.vx = Math.cos(angle) * Math.cos(elevAngle) * speed * bossMult;
    p.vy = Math.sin(elevAngle) * speed * bossMult + 3;
    p.vz = Math.sin(angle) * Math.cos(elevAngle) * speed * bossMult;
    p.life = DEATH_LIFE_MIN + Math.random() * (DEATH_LIFE_MAX - DEATH_LIFE_MIN);
    p.maxLife = p.life;
    p.size = DEATH_SCALE_MIN + Math.random() * (DEATH_SCALE_MAX - DEATH_SCALE_MIN);
    if (isBoss) p.size *= 1.3;

    // 적 색상 기반 + 밝은 하이라이트 혼합
    const brightMix = Math.random() * 0.35;
    p.r = Math.min(1, baseR * (1 - brightMix) + brightMix + (Math.random() - 0.5) * 0.15);
    p.g = Math.min(1, baseG * (1 - brightMix) + brightMix + (Math.random() - 0.5) * 0.15);
    p.b = Math.min(1, baseB * (1 - brightMix) + brightMix + (Math.random() - 0.5) * 0.15);
  }
}

export default HitParticleSystem;
