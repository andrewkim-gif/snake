'use client';

/**
 * AbilityEffects — 어빌리티 발동 시각 이펙트
 * 6종 어빌리티 발동 시 고유 파티클/메시 이펙트 렌더링
 *
 * 어빌리티 종류:
 *   venom_aura:      초록 파티클 링 (에이전트 반경 60px, 저밀도)
 *   shield_burst:    파란 반구 확장 (scale 0→1, 0.3초) → 페이드
 *   lightning_strike: 노란 실린더 (타겟 연결) + 플래시
 *   speed_dash:      파란 트레일 강화 + 바닥 스피드라인
 *   mass_drain:      보라 빔 + 타겟→시전자 파티클
 *   gravity_well:    보라 소용돌이 + 중심으로 빨려드는 파티클
 *
 * 구현 방식:
 *   - 어빌리티별 InstancedMesh 풀링 (MAX_EFFECTS=30)
 *   - 이펙트 수명 관리 (0.5~2초)
 *   - state 패킷의 ab 필드 또는 ability_triggered 이벤트로 활성화
 *
 * 성능: 어빌리티별 InstancedMesh 1~2개, priority 0, frustumCulled=false
 *
 * CRITICAL: useFrame priority 0 — auto-render 유지!
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { toWorld } from '@/lib/3d/coordinate-utils';
import type { AgentNetworkData } from '@agent-survivor/shared';

// ─── Constants ───

const MAX_EFFECTS = 30;       // 동시 최대 이펙트 수
const MAX_PARTICLES = 120;    // 빔/파티클용 풀 크기
const HALF_PI = Math.PI / 2;

// ─── Ability Effect Types ───

export type AbilityEffectType =
  | 'venom_aura'
  | 'shield_burst'
  | 'lightning_strike'
  | 'speed_dash'
  | 'mass_drain'
  | 'gravity_well';

// ─── Active Effect Tracking ───

interface ActiveAbilityEffect {
  agentId: string;
  type: AbilityEffectType;
  x: number;           // 시전자 게임좌표 X
  y: number;           // 시전자 게임좌표 Y
  targetX: number;     // 타겟 게임좌표 X (lightning, mass_drain)
  targetY: number;     // 타겟 게임좌표 Y
  life: number;        // 남은 수명 (초)
  maxLife: number;      // 최대 수명 (초)
  level: number;       // 어빌리티 레벨 (1~4)
  active: boolean;
}

function createEffect(): ActiveAbilityEffect {
  return {
    agentId: '',
    type: 'venom_aura',
    x: 0, y: 0,
    targetX: 0, targetY: 0,
    life: 0, maxLife: 1,
    level: 1,
    active: false,
  };
}

// ─── 어빌리티별 수명 (초) ───

const ABILITY_DURATIONS: Record<AbilityEffectType, number> = {
  venom_aura: 2.0,
  shield_burst: 0.5,
  lightning_strike: 0.4,
  speed_dash: 1.5,
  mass_drain: 1.0,
  gravity_well: 2.0,
};

// ─── 재사용 임시 객체 (GC 방지) ───

const _obj = new THREE.Object3D();
const _color = new THREE.Color();

// ─── Props ───

interface AbilityEffectsProps {
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  elapsedRef: React.MutableRefObject<number>;
}

// ─── Component ───

export function AbilityEffects({ agentsRef, elapsedRef }: AbilityEffectsProps) {
  // ─── Effect pool ───
  const effectPoolRef = useRef<ActiveAbilityEffect[]>([]);

  useEffect(() => {
    const pool: ActiveAbilityEffect[] = [];
    for (let i = 0; i < MAX_EFFECTS; i++) {
      pool.push(createEffect());
    }
    effectPoolRef.current = pool;
  }, []);

  // ─── 이전 프레임 activeAbility 상태 추적 (중복 emit 방지) ───
  const prevAbilitiesRef = useRef<Map<string, string>>(new Map());

  // ─── Geometry + Material (한 번만 생성) ───

  // Venom Aura: 초록 링 (반경 60px)
  const venomGeo = useMemo(() => new THREE.RingGeometry(50, 65, 24), []);
  const venomMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#33FF33',
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

  // Shield Burst: 파란 반구
  const shieldGeo = useMemo(() => new THREE.SphereGeometry(40, 16, 8, 0, Math.PI * 2, 0, HALF_PI), []);
  const shieldMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#4488FF',
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

  // Lightning Strike: 노란 실린더 (볼트)
  const lightningGeo = useMemo(() => new THREE.CylinderGeometry(2, 2, 1, 6), []);
  const lightningMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#FFDD00',
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  }), []);

  // Speed Dash: 스피드라인 (바닥 얇은 실린더)
  const dashGeo = useMemo(() => new THREE.CylinderGeometry(1.5, 1.5, 30, 4), []);
  const dashMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#44CCFF',
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  }), []);

  // Mass Drain: 보라 빔 (thin cylinder)
  const drainGeo = useMemo(() => new THREE.CylinderGeometry(1, 3, 1, 6), []);
  const drainMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#AA44FF',
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  }), []);

  // Gravity Well: 보라 토러스 소용돌이
  const gravityGeo = useMemo(() => new THREE.TorusGeometry(50, 5, 8, 24), []);
  const gravityMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#8833CC',
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

  // Particle 풀: 작은 큐브 (범용 파티클)
  const particleGeo = useMemo(() => new THREE.BoxGeometry(3, 3, 3), []);
  const particleMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  }), []);

  // ─── InstancedMesh Refs ───
  const venomRef = useRef<THREE.InstancedMesh>(null!);
  const shieldRef = useRef<THREE.InstancedMesh>(null!);
  const lightningRef = useRef<THREE.InstancedMesh>(null!);
  const dashRef = useRef<THREE.InstancedMesh>(null!);
  const drainRef = useRef<THREE.InstancedMesh>(null!);
  const gravityRef = useRef<THREE.InstancedMesh>(null!);
  const particleRef = useRef<THREE.InstancedMesh>(null!);

  // ─── 클린업 ───
  useEffect(() => {
    return () => {
      venomGeo.dispose();
      venomMat.dispose();
      shieldGeo.dispose();
      shieldMat.dispose();
      lightningGeo.dispose();
      lightningMat.dispose();
      dashGeo.dispose();
      dashMat.dispose();
      drainGeo.dispose();
      drainMat.dispose();
      gravityGeo.dispose();
      gravityMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
    };
  }, [venomGeo, venomMat, shieldGeo, shieldMat, lightningGeo, lightningMat,
      dashGeo, dashMat, drainGeo, drainMat, gravityGeo, gravityMat,
      particleGeo, particleMat]);

  // ─── 이펙트 활성화 함수 ───
  const activateEffect = (
    agentId: string,
    type: AbilityEffectType,
    x: number, y: number,
    targetX: number, targetY: number,
    level: number
  ) => {
    const pool = effectPoolRef.current;
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].active) continue;
      const eff = pool[i];
      eff.active = true;
      eff.agentId = agentId;
      eff.type = type;
      eff.x = x;
      eff.y = y;
      eff.targetX = targetX;
      eff.targetY = targetY;
      eff.level = level;
      eff.maxLife = ABILITY_DURATIONS[type];
      eff.life = eff.maxLife;
      return;
    }
  };

  // ─── useFrame: 상태 감지 + 이펙트 업데이트 + 렌더링 ───
  useFrame((_, delta) => {
    const agents = agentsRef.current;
    const elapsed = elapsedRef.current;
    const pool = effectPoolRef.current;
    const dt = Math.min(delta, 0.1);

    // 1. Detect new ability activations from agent state (ab field)
    const currentAbilities = new Map<string, string>();
    for (const agent of agents) {
      if (!agent.a) continue;
      const ab = agent.ab;
      if (ab) {
        currentAbilities.set(agent.i, ab);
        const prev = prevAbilitiesRef.current.get(agent.i);
        if (prev !== ab) {
          // New ability activation detected
          activateEffect(
            agent.i,
            ab as AbilityEffectType,
            agent.x, agent.y,
            agent.tx ?? agent.x,
            agent.ty ?? agent.y,
            agent.abl ?? 1
          );
        }
      }
    }
    prevAbilitiesRef.current = currentAbilities;

    // 2. Update active effects: decrement life, update positions from agent
    for (const eff of pool) {
      if (!eff.active) continue;
      eff.life -= dt;
      if (eff.life <= 0) {
        eff.active = false;
        continue;
      }
      // Update position to follow the agent
      const agent = agents.find(a => a.i === eff.agentId);
      if (agent && agent.a) {
        eff.x = agent.x;
        eff.y = agent.y;
      }
    }

    // 3. Render each ability type via its InstancedMesh
    let venomIdx = 0;
    let shieldIdx = 0;
    let lightningIdx = 0;
    let dashIdx = 0;
    let drainIdx = 0;
    let gravityIdx = 0;
    let particleIdx = 0;

    const venomMesh = venomRef.current;
    const shieldMesh = shieldRef.current;
    const lightningMesh = lightningRef.current;
    const dashMesh = dashRef.current;
    const drainMesh = drainRef.current;
    const gravityMesh = gravityRef.current;
    const particleMesh = particleRef.current;

    if (!venomMesh || !shieldMesh || !lightningMesh || !dashMesh || !drainMesh || !gravityMesh || !particleMesh) return;

    for (const eff of pool) {
      if (!eff.active) continue;
      const lifeRatio = Math.max(0, eff.life / eff.maxLife);
      const [wx, , wz] = toWorld(eff.x, eff.y, 0);
      const levelMult = 1 + (eff.level - 1) * 0.15; // 레벨별 이펙트 크기 보너스

      switch (eff.type) {
        // ──────────────────────────────────────────────────
        // 1. Venom Aura: 초록 파티클 링 (에이전트 반경 60px, 저밀도)
        // ──────────────────────────────────────────────────
        case 'venom_aura': {
          if (venomIdx >= MAX_EFFECTS) break;
          // 바닥 독 링: 에이전트 발 아래, 수평 배치, 펄스 회전
          const venomPulse = 1 + Math.sin(elapsed * 3 + venomIdx * 1.5) * 0.12;
          const venomScale = venomPulse * lifeRatio * levelMult;
          _obj.position.set(wx, 2, wz);
          _obj.rotation.set(-HALF_PI, 0, elapsed * 0.8);
          _obj.scale.setScalar(venomScale);
          _obj.updateMatrix();
          venomMesh.setMatrixAt(venomIdx, _obj.matrix);
          venomIdx++;

          // 독 파티클: 링 위를 공전하는 작은 큐브 (4개, 레벨당 +1)
          const venomParticleCount = Math.min(4 + eff.level, 7);
          for (let p = 0; p < venomParticleCount && particleIdx < MAX_PARTICLES; p++) {
            const vAngle = elapsed * 2 + p * (Math.PI * 2 / venomParticleCount);
            const vr = 57 * lifeRatio * levelMult;
            const bubbleY = 3 + Math.sin(elapsed * 5 + p * 1.3) * 6 + Math.abs(Math.sin(elapsed * 8 + p)) * 3;
            _obj.position.set(
              wx + Math.cos(vAngle) * vr,
              bubbleY,
              wz + Math.sin(vAngle) * vr,
            );
            _obj.rotation.set(elapsed * 3 + p, elapsed * 2, 0);
            const vps = (2.5 + Math.sin(elapsed * 4 + p) * 0.8) * lifeRatio;
            _obj.scale.set(vps, vps, vps);
            _obj.updateMatrix();
            particleMesh.setMatrixAt(particleIdx, _obj.matrix);
            _color.setHex(p % 2 === 0 ? 0x33FF33 : 0x22CC22);
            particleMesh.setColorAt(particleIdx, _color);
            particleIdx++;
          }
          break;
        }

        // ──────────────────────────────────────────────────
        // 2. Shield Burst: 파란 반구 SphereGeometry -> scale 0->1 (0.3초) -> 페이드
        // ──────────────────────────────────────────────────
        case 'shield_burst': {
          if (shieldIdx >= MAX_EFFECTS) break;
          // 확장 반구: 0→1.5 확대 후 페이드
          const expandT = 1 - lifeRatio; // 0→1 over lifetime
          const shieldScale = Math.pow(expandT, 0.5) * 1.5 * levelMult; // 빠르게 확장, 느리게 종료
          _obj.position.set(wx, 0, wz);
          _obj.rotation.set(0, elapsed * 3, 0);
          _obj.scale.setScalar(Math.max(0.01, shieldScale));
          _obj.updateMatrix();
          shieldMesh.setMatrixAt(shieldIdx, _obj.matrix);
          shieldIdx++;

          // 보호막 방출 파티클 (초기에 강한 파란 파티클 6개)
          if (expandT < 0.5) {
            const burstCount = Math.min(6, MAX_PARTICLES - particleIdx);
            for (let p = 0; p < burstCount && particleIdx < MAX_PARTICLES; p++) {
              const bAngle = (p / burstCount) * Math.PI * 2 + elapsed * 0.5;
              const bRadius = shieldScale * 40;
              _obj.position.set(
                wx + Math.cos(bAngle) * bRadius,
                8 + Math.sin(elapsed * 6 + p * 2) * 8,
                wz + Math.sin(bAngle) * bRadius,
              );
              _obj.rotation.set(0, 0, 0);
              const bps = (3 + Math.random() * 2) * (1 - expandT * 2);
              _obj.scale.set(bps, bps, bps);
              _obj.updateMatrix();
              particleMesh.setMatrixAt(particleIdx, _obj.matrix);
              _color.setHex(p % 3 === 0 ? 0x66BBFF : 0x4488FF);
              particleMesh.setColorAt(particleIdx, _color);
              particleIdx++;
            }
          }
          break;
        }

        // ──────────────────────────────────────────────────
        // 3. Lightning Strike: 노란 CylinderGeometry (타겟 연결) + 화면 전체 플래시
        // ──────────────────────────────────────────────────
        case 'lightning_strike': {
          if (lightningIdx >= MAX_EFFECTS) break;
          const [twx, , twz] = toWorld(eff.targetX, eff.targetY, 0);

          // 메인 볼트: 하늘에서 타겟으로 수직 낙하 + 시전자→타겟 수평 연결
          // 수직 볼트 (타겟 상공→타겟)
          const vertFlicker = 0.8 + Math.random() * 0.8;
          const vertHeight = 120 * lifeRatio;
          _obj.position.set(twx + (Math.random() - 0.5) * 5, vertHeight / 2, twz + (Math.random() - 0.5) * 5);
          _obj.rotation.set(0, 0, 0);
          _obj.scale.set(vertFlicker * lifeRatio * levelMult, vertHeight, vertFlicker * lifeRatio * levelMult);
          _obj.updateMatrix();
          lightningMesh.setMatrixAt(lightningIdx, _obj.matrix);
          lightningIdx++;

          // 수평 볼트 (시전자→타겟 연결)
          if (lightningIdx < MAX_EFFECTS) {
            const ldx = twx - wx;
            const ldz = twz - wz;
            const lDist = Math.sqrt(ldx * ldx + ldz * ldz);
            const lAngle = Math.atan2(ldz, ldx);
            const horzFlicker = 0.6 + Math.random() * 0.6;
            _obj.position.set((wx + twx) / 2, 25 + Math.random() * 8, (wz + twz) / 2);
            _obj.rotation.set(0, -lAngle, HALF_PI);
            _obj.scale.set(horzFlicker * lifeRatio, Math.max(1, lDist), horzFlicker * lifeRatio);
            _obj.updateMatrix();
            lightningMesh.setMatrixAt(lightningIdx, _obj.matrix);
            lightningIdx++;
          }

          // 타겟 위치 임팩트 파티클 (불꽃)
          const impactCount = Math.min(5, MAX_PARTICLES - particleIdx);
          for (let p = 0; p < impactCount && particleIdx < MAX_PARTICLES; p++) {
            const spAngle = Math.random() * Math.PI * 2;
            const spDist = Math.random() * 18;
            _obj.position.set(
              twx + Math.cos(spAngle) * spDist,
              3 + Math.random() * 25 * lifeRatio,
              twz + Math.sin(spAngle) * spDist,
            );
            _obj.rotation.set(Math.random(), Math.random(), 0);
            const sp = (2 + Math.random() * 3) * lifeRatio;
            _obj.scale.set(sp, sp, sp);
            _obj.updateMatrix();
            particleMesh.setMatrixAt(particleIdx, _obj.matrix);
            _color.setHex(p % 2 === 0 ? 0xFFEE44 : 0xFFDD00);
            particleMesh.setColorAt(particleIdx, _color);
            particleIdx++;
          }
          break;
        }

        // ──────────────────────────────────────────────────
        // 4. Speed Dash: 기존 trail 강화 + 바닥 스피드라인
        // ──────────────────────────────────────────────────
        case 'speed_dash': {
          const agent = agents.find(a => a.i === eff.agentId);
          const heading = agent ? agent.h : 0;
          // 바닥 스피드라인 (에이전트 뒤로 5개, 레벨에 따라 증가)
          const lineCount = Math.min(3 + eff.level, 6);
          for (let s = 0; s < lineCount && dashIdx < MAX_EFFECTS * 3; s++) {
            const offset = (s + 1) * 12;
            const spread = (Math.sin(elapsed * 8 + s * 2.1) * 0.5) * 15;
            const lineX = wx - Math.cos(heading) * offset + Math.cos(heading + HALF_PI) * spread;
            const lineZ = wz - Math.sin(heading) * offset + Math.sin(heading + HALF_PI) * spread;
            _obj.position.set(lineX, 0.5, lineZ);
            _obj.rotation.set(0, -heading, HALF_PI);
            const lineScale = lifeRatio * (1 - s / (lineCount + 1)) * levelMult;
            _obj.scale.set(lineScale * 0.8, 1.2, lineScale);
            _obj.updateMatrix();
            dashMesh.setMatrixAt(dashIdx, _obj.matrix);
            dashIdx++;
          }

          // 바람 파티클 (에이전트 주위로 흩어지는 2개)
          for (let p = 0; p < 2 && particleIdx < MAX_PARTICLES; p++) {
            const windOff = (elapsed * 5 + p * 3.14) % 6;
            const windX = wx - Math.cos(heading) * windOff * 10 + (Math.sin(elapsed * 7 + p) * 12);
            const windZ = wz - Math.sin(heading) * windOff * 10 + (Math.cos(elapsed * 7 + p) * 12);
            _obj.position.set(windX, 4 + Math.sin(elapsed * 3 + p) * 4, windZ);
            _obj.rotation.set(0, 0, 0);
            const wps = 2 * lifeRatio * (1 - windOff / 6);
            _obj.scale.set(wps, wps, wps);
            _obj.updateMatrix();
            particleMesh.setMatrixAt(particleIdx, _obj.matrix);
            _color.set('#44CCFF');
            particleMesh.setColorAt(particleIdx, _color);
            particleIdx++;
          }
          break;
        }

        // ──────────────────────────────────────────────────
        // 5. Mass Drain: 보라 빔 (thin cylinder) + 타겟→시전자 파티클 이동
        // ──────────────────────────────────────────────────
        case 'mass_drain': {
          if (drainIdx >= MAX_EFFECTS) break;
          const [ttx, , ttz] = toWorld(eff.targetX, eff.targetY, 0);
          const bdx = ttx - wx;
          const bdz = ttz - wz;
          const beamDist = Math.sqrt(bdx * bdx + bdz * bdz);
          const beamMidX = (wx + ttx) / 2;
          const beamMidZ = (wz + ttz) / 2;
          const beamAngle = Math.atan2(bdz, bdx);

          // 메인 빔: 펄스 두께
          const beamPulse = 1 + Math.sin(elapsed * 8) * 0.3;
          _obj.position.set(beamMidX, 15, beamMidZ);
          _obj.rotation.set(0, -beamAngle, HALF_PI);
          _obj.scale.set(beamPulse * lifeRatio * levelMult, Math.max(1, beamDist), beamPulse * lifeRatio * levelMult);
          _obj.updateMatrix();
          drainMesh.setMatrixAt(drainIdx, _obj.matrix);
          drainIdx++;

          // 타겟→시전자 이동 파티클 (3~4개, 빔 위를 따라 이동)
          const drainPCount = Math.min(3 + Math.floor(eff.level / 2), 5);
          for (let p = 0; p < drainPCount && particleIdx < MAX_PARTICLES; p++) {
            const t = ((elapsed * 2.5 + p * (1 / drainPCount)) % 1); // 0→1 루프 (각자 다른 위상)
            const px = ttx + (wx - ttx) * t;
            const pz = ttz + (wz - ttz) * t;
            const arcY = 15 + Math.sin(t * Math.PI) * 12; // 빔 아크를 따라
            _obj.position.set(
              px + Math.sin(elapsed * 10 + p * 2) * 4,
              arcY,
              pz + Math.cos(elapsed * 10 + p * 2) * 4,
            );
            _obj.rotation.set(elapsed + p, 0, 0);
            const dps = (2 + (1 - t) * 2) * lifeRatio;
            _obj.scale.set(dps, dps, dps);
            _obj.updateMatrix();
            particleMesh.setMatrixAt(particleIdx, _obj.matrix);
            _color.setHex(p % 2 === 0 ? 0xAA44FF : 0xCC66FF);
            particleMesh.setColorAt(particleIdx, _color);
            particleIdx++;
          }
          break;
        }

        // ──────────────────────────────────────────────────
        // 6. Gravity Well: 보라 TorusGeometry 소용돌이 + 중심으로 빨려드는 파티클
        // ──────────────────────────────────────────────────
        case 'gravity_well': {
          if (gravityIdx >= MAX_EFFECTS) break;
          // 외부 토러스: 빠른 회전, 수축
          const wellScale = lifeRatio * (1 + Math.sin(elapsed * 4) * 0.12) * levelMult;
          _obj.position.set(wx, 4, wz);
          _obj.rotation.set(HALF_PI, 0, elapsed * 2.5);
          _obj.scale.setScalar(wellScale);
          _obj.updateMatrix();
          gravityMesh.setMatrixAt(gravityIdx, _obj.matrix);
          gravityIdx++;

          // 내부 토러스 (더 작고 빠르게 반대방향 회전)
          if (gravityIdx < MAX_EFFECTS) {
            const innerScale = wellScale * 0.55;
            _obj.position.set(wx, 8, wz);
            _obj.rotation.set(HALF_PI + 0.3, 0, -elapsed * 3.5);
            _obj.scale.setScalar(innerScale);
            _obj.updateMatrix();
            gravityMesh.setMatrixAt(gravityIdx, _obj.matrix);
            gravityIdx++;
          }

          // 빨려드는 파티클 (5개, 나선 궤도)
          const gravPCount = Math.min(5 + eff.level, 8);
          for (let p = 0; p < gravPCount && particleIdx < MAX_PARTICLES; p++) {
            const spiralT = (elapsed * 1.2 + p * (Math.PI * 2 / gravPCount)) % (Math.PI * 2);
            const spiralRadius = 80 * lifeRatio * (0.3 + 0.7 * Math.abs(Math.sin(elapsed * 0.8 + p * 0.7)));
            const spiralY = 3 + Math.sin(elapsed * 3 + p * 1.4) * 5;
            _obj.position.set(
              wx + Math.cos(spiralT) * spiralRadius,
              spiralY,
              wz + Math.sin(spiralT) * spiralRadius,
            );
            _obj.rotation.set(elapsed * 2 + p, 0, elapsed);
            const gps = (2 + Math.sin(elapsed * 5 + p) * 1) * lifeRatio;
            _obj.scale.set(gps, gps, gps);
            _obj.updateMatrix();
            particleMesh.setMatrixAt(particleIdx, _obj.matrix);
            _color.setHex(p % 3 === 0 ? 0x8833CC : (p % 3 === 1 ? 0xAA55DD : 0x6622AA));
            particleMesh.setColorAt(particleIdx, _color);
            particleIdx++;
          }
          break;
        }
      }
    }

    // Update instance counts + needsUpdate
    venomMesh.count = venomIdx;
    shieldMesh.count = shieldIdx;
    lightningMesh.count = lightningIdx;
    dashMesh.count = dashIdx;
    drainMesh.count = drainIdx;
    gravityMesh.count = gravityIdx;
    particleMesh.count = particleIdx;

    if (venomIdx > 0) venomMesh.instanceMatrix.needsUpdate = true;
    if (shieldIdx > 0) shieldMesh.instanceMatrix.needsUpdate = true;
    if (lightningIdx > 0) lightningMesh.instanceMatrix.needsUpdate = true;
    if (dashIdx > 0) dashMesh.instanceMatrix.needsUpdate = true;
    if (drainIdx > 0) drainMesh.instanceMatrix.needsUpdate = true;
    if (gravityIdx > 0) gravityMesh.instanceMatrix.needsUpdate = true;
    if (particleIdx > 0) {
      particleMesh.instanceMatrix.needsUpdate = true;
      if (particleMesh.instanceColor) {
        particleMesh.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {/* Venom Aura: 초록 링 */}
      <instancedMesh
        ref={venomRef}
        args={[venomGeo, venomMat, MAX_EFFECTS]}
        frustumCulled={false}
      />
      {/* Shield Burst: 파란 반구 */}
      <instancedMesh
        ref={shieldRef}
        args={[shieldGeo, shieldMat, MAX_EFFECTS]}
        frustumCulled={false}
      />
      {/* Lightning Strike: 노란 볼트 */}
      <instancedMesh
        ref={lightningRef}
        args={[lightningGeo, lightningMat, MAX_EFFECTS]}
        frustumCulled={false}
      />
      {/* Speed Dash: 스피드라인 */}
      <instancedMesh
        ref={dashRef}
        args={[dashGeo, dashMat, MAX_EFFECTS * 3]}
        frustumCulled={false}
      />
      {/* Mass Drain: 보라 빔 */}
      <instancedMesh
        ref={drainRef}
        args={[drainGeo, drainMat, MAX_EFFECTS]}
        frustumCulled={false}
      />
      {/* Gravity Well: 보라 토러스 */}
      <instancedMesh
        ref={gravityRef}
        args={[gravityGeo, gravityMat, MAX_EFFECTS]}
        frustumCulled={false}
      />
      {/* 범용 파티클 (venom/lightning/drain/gravity 파티클) */}
      <instancedMesh
        ref={particleRef}
        args={[particleGeo, particleMat, MAX_PARTICLES]}
        frustumCulled={false}
      />
    </group>
  );
}
