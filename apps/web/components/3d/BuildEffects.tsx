'use client';

/**
 * BuildEffects — Agent 빌드 타입별 시각 이펙트
 * 각 Agent의 dominant build type에 따라 글로우/파티클/트레일 표시
 *
 * 빌드별 이펙트:
 *   berserker: 빨간 글로우 링 (Damage 빌드 — 공격적 붉은 오라)
 *   speedster: 잔상 고스트 이펙트 (Speed 빌드 — 반투명 파란 잔상)
 *   tank:      파란 보호막 글로우 (Armor 빌드 — 구형 방어막)
 *   farmer:    초록 글로우 (XP 빌드 — 성장 에너지)
 *   balanced:  이펙트 없음
 *
 * 구현 방식:
 *   - berserker: InstancedMesh (빨간 반투명 RingGeometry, 펄스 스케일)
 *   - speedster: InstancedMesh (반투명 박스, 이전 위치에 잔상 3개)
 *   - tank:      InstancedMesh (파란 반투명 SphereGeometry, 느린 회전)
 *   - farmer:    InstancedMesh (초록 반투명 CircleGeometry, 위아래 부유)
 *
 * 성능: 빌드별 InstancedMesh 1개씩 총 4 draw calls, priority 0
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { toWorld } from '@/lib/3d/coordinate-utils';
import type { AgentNetworkData } from '@snake-arena/shared';

// ─── Constants ───

const MAX_AGENTS = 60;
const HALF_PI = Math.PI / 2;

// 잔상용 이전 위치 캐시 (Agent ID → 최근 3개 위치)
interface TrailState {
  positions: [number, number][];  // [(x, y), ...] 최근 3개
  lastUpdate: number;
}

const trailCache = new Map<string, TrailState>();
const TRAIL_COUNT = 3;
const TRAIL_UPDATE_INTERVAL = 0.08; // 80ms 간격으로 잔상 업데이트

// ─── 재사용 임시 객체 (GC 방지) ───

const _obj = new THREE.Object3D();

// ─── Props ───

interface BuildEffectsProps {
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  elapsedRef: React.MutableRefObject<number>;
}

// ─── Component ───

export function BuildEffects({ agentsRef, elapsedRef }: BuildEffectsProps) {
  // ─── Refs: 빌드별 InstancedMesh ───
  const berserkerRef = useRef<THREE.InstancedMesh>(null!);
  const speedsterRef = useRef<THREE.InstancedMesh>(null!);
  const tankRef = useRef<THREE.InstancedMesh>(null!);
  const farmerRef = useRef<THREE.InstancedMesh>(null!);

  // ─── Geometry + Material (한 번만 생성) ───
  const { berserkerGeo, speedsterGeo, tankGeo, farmerGeo } = useMemo(() => ({
    // berserker: 빨간 글로우 링 (반경 40, 두께 5)
    berserkerGeo: new THREE.RingGeometry(35, 45, 24),
    // speedster: 잔상용 작은 박스 (Agent 크기의 60%)
    speedsterGeo: new THREE.BoxGeometry(5, 20, 3),
    // tank: 파란 보호막 구체 (반경 30)
    tankGeo: new THREE.SphereGeometry(30, 16, 12),
    // farmer: 초록 글로우 원 (반경 35)
    farmerGeo: new THREE.CircleGeometry(35, 20),
  }), []);

  const { berserkerMat, speedsterMat, tankMat, farmerMat } = useMemo(() => ({
    berserkerMat: new THREE.MeshBasicMaterial({
      color: '#FF2222',
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    speedsterMat: new THREE.MeshBasicMaterial({
      color: '#44AAFF',
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    }),
    tankMat: new THREE.MeshBasicMaterial({
      color: '#4488FF',
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    farmerMat: new THREE.MeshBasicMaterial({
      color: '#33DD55',
      transparent: true,
      opacity: 0.10,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  }), []);

  // ─── 클린업 ───
  useEffect(() => {
    return () => {
      berserkerGeo.dispose();
      speedsterGeo.dispose();
      tankGeo.dispose();
      farmerGeo.dispose();
      berserkerMat.dispose();
      speedsterMat.dispose();
      tankMat.dispose();
      farmerMat.dispose();
      trailCache.clear();
    };
  }, [berserkerGeo, speedsterGeo, tankGeo, farmerGeo, berserkerMat, speedsterMat, tankMat, farmerMat]);

  // ─── useFrame: 매 프레임 빌드별 이펙트 matrix 업데이트 ───
  useFrame(() => {
    const agents = agentsRef.current;
    const elapsed = elapsedRef.current;

    const berserkerMesh = berserkerRef.current;
    const speedsterMesh = speedsterRef.current;
    const tankMesh = tankRef.current;
    const farmerMesh = farmerRef.current;

    if (!berserkerMesh || !speedsterMesh || !tankMesh || !farmerMesh) return;

    let bIdx = 0; // berserker 인스턴스 인덱스
    let sIdx = 0; // speedster 인스턴스 인덱스 (잔상 3개씩)
    let tIdx = 0; // tank 인스턴스 인덱스
    let fIdx = 0; // farmer 인스턴스 인덱스

    for (const agent of agents) {
      if (!agent.a) continue; // 죽은 Agent는 스킵

      const bt = agent.bt ?? 'balanced';
      if (bt === 'balanced') continue; // balanced는 이펙트 없음

      const [wx, , wz] = toWorld(agent.x, agent.y, 0);

      switch (bt) {
        case 'berserker': {
          if (bIdx >= MAX_AGENTS) break;
          // 빨간 글로우 링: 발 아래, 수평 배치, 펄스 스케일
          const pulse = 1 + Math.sin(elapsed * 4 + bIdx * 1.3) * 0.15;
          _obj.position.set(wx, 1, wz);
          _obj.rotation.set(-HALF_PI, 0, elapsed * 0.5); // 느린 회전
          _obj.scale.setScalar(pulse);
          _obj.updateMatrix();
          berserkerMesh.setMatrixAt(bIdx, _obj.matrix);
          bIdx++;
          break;
        }

        case 'speedster': {
          // 잔상: 이전 위치에 반투명 박스 3개
          let trail = trailCache.get(agent.i);
          if (!trail) {
            trail = { positions: [], lastUpdate: 0 };
            trailCache.set(agent.i, trail);
          }

          // 주기적으로 현재 위치를 잔상 캐시에 추가
          if (elapsed - trail.lastUpdate > TRAIL_UPDATE_INTERVAL) {
            trail.positions.unshift([agent.x, agent.y]);
            if (trail.positions.length > TRAIL_COUNT) {
              trail.positions.length = TRAIL_COUNT;
            }
            trail.lastUpdate = elapsed;
          }

          // 잔상 렌더링 (최대 3개, 오래될수록 투명)
          for (let t = 0; t < trail.positions.length; t++) {
            if (sIdx >= MAX_AGENTS * TRAIL_COUNT) break;
            const [tx, ty] = trail.positions[t];
            const [twx, , twz] = toWorld(tx, ty, 0);

            // 오래된 잔상일수록 작고 높이가 다름
            const age = (t + 1) / (TRAIL_COUNT + 1);
            const scale = 1.0 - age * 0.3;

            _obj.position.set(twx, 10 * scale, twz);
            _obj.rotation.set(0, -agent.h, 0);
            _obj.scale.set(scale, scale, scale);
            _obj.updateMatrix();
            speedsterMesh.setMatrixAt(sIdx, _obj.matrix);
            sIdx++;
          }
          break;
        }

        case 'tank': {
          if (tIdx >= MAX_AGENTS) break;
          // 파란 보호막 구체: Agent 주위, 느린 펄스
          const shieldPulse = 1 + Math.sin(elapsed * 2 + tIdx * 0.7) * 0.08;
          _obj.position.set(wx, 15, wz);
          _obj.rotation.set(0, elapsed * 0.3, 0); // 느린 회전
          _obj.scale.setScalar(shieldPulse);
          _obj.updateMatrix();
          tankMesh.setMatrixAt(tIdx, _obj.matrix);
          tIdx++;
          break;
        }

        case 'farmer': {
          if (fIdx >= MAX_AGENTS) break;
          // 초록 글로우: 발 아래, 수평, 위아래 부유
          const floatY = 0.5 + Math.sin(elapsed * 2.5 + fIdx * 1.1) * 2;
          _obj.position.set(wx, floatY, wz);
          _obj.rotation.set(-HALF_PI, 0, elapsed * 0.2);
          _obj.scale.setScalar(1.0 + Math.sin(elapsed * 3 + fIdx) * 0.1);
          _obj.updateMatrix();
          farmerMesh.setMatrixAt(fIdx, _obj.matrix);
          fIdx++;
          break;
        }
      }
    }

    // 사라진 Agent의 잔상 캐시 정리 (매 5초마다)
    if (Math.floor(elapsed) % 5 === 0 && Math.floor(elapsed) !== Math.floor(elapsed - 0.016)) {
      const activeIds = new Set(agents.map(a => a.i));
      for (const [id] of trailCache) {
        if (!activeIds.has(id)) trailCache.delete(id);
      }
    }

    // Instance count + needsUpdate
    berserkerMesh.count = bIdx;
    speedsterMesh.count = sIdx;
    tankMesh.count = tIdx;
    farmerMesh.count = fIdx;

    if (bIdx > 0) berserkerMesh.instanceMatrix.needsUpdate = true;
    if (sIdx > 0) speedsterMesh.instanceMatrix.needsUpdate = true;
    if (tIdx > 0) tankMesh.instanceMatrix.needsUpdate = true;
    if (fIdx > 0) farmerMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Berserker: 빨간 글로우 링 */}
      <instancedMesh
        ref={berserkerRef}
        args={[berserkerGeo, berserkerMat, MAX_AGENTS]}
        frustumCulled={false}
      />
      {/* Speedster: 파란 잔상 박스 (Agent당 최대 3개) */}
      <instancedMesh
        ref={speedsterRef}
        args={[speedsterGeo, speedsterMat, MAX_AGENTS * TRAIL_COUNT]}
        frustumCulled={false}
      />
      {/* Tank: 파란 보호막 구체 */}
      <instancedMesh
        ref={tankRef}
        args={[tankGeo, tankMat, MAX_AGENTS]}
        frustumCulled={false}
      />
      {/* Farmer: 초록 글로우 원 */}
      <instancedMesh
        ref={farmerRef}
        args={[farmerGeo, farmerMat, MAX_AGENTS]}
        frustumCulled={false}
      />
    </group>
  );
}
