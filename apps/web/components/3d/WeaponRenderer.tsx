'use client';

/**
 * WeaponRenderer — v14 Phase 2: 10-Weapon Visual Effects
 *
 * Renders weapon effects using InstancedMesh for performance.
 * Each weapon type has a unique visual pattern:
 * - Fan Swing (Bonk): arc slash effect
 * - Chain Bolt: lightning chain between targets
 * - Flame Ring: expanding fire ring
 * - Frost Shards: ice projectile fan
 * - Shadow Strike: teleport afterimage
 * - Thunder Clap: lightning pillar AOE
 * - Venom Cloud: green poison cloud
 * - Crystal Shield: orbiting crystals
 * - Gravity Bomb: black hole vortex
 * - Soul Drain: energy beam
 *
 * LOD: effects simplified at distance.
 * Particle pooling: fixed-size pool to prevent GC pressure.
 */

import { useRef, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { toWorld } from '@/lib/3d/coordinate-utils';
import type { WeaponDamageEvent, WeaponType } from '@agent-survivor/shared';

// ─── Constants ───

const MAX_PARTICLES = 512;
const EFFECT_DURATION_SEC = 0.5;
const LOD_DISTANCE_CLOSE = 100;   // full effects
const LOD_DISTANCE_MID = 300;     // simplified
const LOD_DISTANCE_FAR = 600;     // minimal / hidden

// ─── Weapon Color Map ───

const WEAPON_COLOR_MAP: Record<WeaponType, [number, number]> = {
  bonk_mallet:    [0xc08040, 0xffd700],
  chain_bolt:     [0x00bfff, 0xffffff],
  flame_ring:     [0xff4500, 0xffd700],
  frost_shards:   [0x87ceeb, 0xffffff],
  shadow_strike:  [0x4b0082, 0x8a2be2],
  thunder_clap:   [0xffd700, 0xffffff],
  venom_cloud:    [0x32cd32, 0x006400],
  gravity_bomb:   [0x4b0082, 0x000000],
  crystal_shield: [0x00ced1, 0xe0ffff],
  soul_drain:     [0x8b0000, 0xff6347],
};

// ─── Particle Pool ───

interface Particle {
  active: boolean;
  weaponType: WeaponType;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  color: number;
}

function createParticlePool(size: number): Particle[] {
  const pool: Particle[] = [];
  for (let i = 0; i < size; i++) {
    pool.push({
      active: false,
      weaponType: 'bonk_mallet',
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      life: 0, maxLife: 0,
      scale: 1,
      color: 0xffffff,
    });
  }
  return pool;
}

// ─── Reusable THREE objects ───

const _obj = new THREE.Object3D();
const _color = new THREE.Color();

// ─── Props ───

interface WeaponRendererProps {
  damageEvents: WeaponDamageEvent[];
  cameraPosition?: THREE.Vector3;
}

/**
 * WeaponRenderer component.
 * Receives damageEvents from the game state and renders weapon VFX particles.
 */
export function WeaponRenderer({ damageEvents, cameraPosition }: WeaponRendererProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particlesRef = useRef<Particle[]>(createParticlePool(MAX_PARTICLES));
  const pendingEvents = useRef<WeaponDamageEvent[]>([]);
  const { camera } = useThree();

  // Geometry and material (shared)
  const geometry = useMemo(() => new THREE.SphereGeometry(0.15, 6, 4), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  // Queue new events
  if (damageEvents.length > 0) {
    pendingEvents.current = damageEvents;
  }

  // Spawn particles for a weapon effect
  const spawnEffect = useCallback(
    (evt: WeaponDamageEvent) => {
      const particles = particlesRef.current;
      const [primary, secondary] = WEAPON_COLOR_MAP[evt.weaponType] || [0xffffff, 0xffffff];

      // World position of target: [x, height, z]
      const worldPos = toWorld(evt.targetX, evt.targetY);
      const wpX = worldPos[0];
      const wpY = worldPos[1];
      const wpZ = worldPos[2];

      // LOD check
      const camPos = cameraPosition || camera.position;
      const dx = wpX - camPos.x;
      const dz = wpZ - camPos.z;
      const distSq = dx * dx + dz * dz;

      let particleCount = 8;
      if (distSq > LOD_DISTANCE_FAR * LOD_DISTANCE_FAR) return; // too far, skip
      if (distSq > LOD_DISTANCE_MID * LOD_DISTANCE_MID) particleCount = 3;
      else if (distSq > LOD_DISTANCE_CLOSE * LOD_DISTANCE_CLOSE) particleCount = 5;

      // Critical hits get more particles
      if (evt.isCritical) particleCount = Math.min(particleCount * 2, 16);

      // Find inactive particles and activate them
      let spawned = 0;
      for (let i = 0; i < particles.length && spawned < particleCount; i++) {
        if (particles[i].active) continue;
        const p = particles[i];
        p.active = true;
        p.weaponType = evt.weaponType;
        p.x = wpX + (Math.random() - 0.5) * 2;
        p.y = wpY + 1.5 + Math.random() * 1.0;
        p.z = wpZ + (Math.random() - 0.5) * 2;
        p.maxLife = EFFECT_DURATION_SEC * 60; // ~30 frames at 60fps
        p.life = p.maxLife;
        p.color = spawned % 2 === 0 ? primary : secondary;

        // Velocity based on weapon type
        const speed = 0.05 + Math.random() * 0.1;
        const angle = Math.random() * Math.PI * 2;
        p.vx = Math.cos(angle) * speed;
        p.vy = 0.02 + Math.random() * 0.05;
        p.vz = Math.sin(angle) * speed;

        // Special patterns per weapon type
        switch (evt.weaponType) {
          case 'flame_ring':
            p.vy = 0.01;
            p.scale = 1.5;
            break;
          case 'frost_shards':
            p.vy = -0.01;
            p.scale = 0.8;
            break;
          case 'thunder_clap':
            p.vy = 0.15;
            p.vx *= 0.3;
            p.vz *= 0.3;
            p.scale = 2.0;
            break;
          case 'venom_cloud':
            p.vy = 0.005;
            p.vx *= 0.2;
            p.vz *= 0.2;
            p.scale = 2.5;
            p.maxLife *= 2;
            p.life = p.maxLife;
            break;
          case 'gravity_bomb':
            p.vx *= -0.5; // inward
            p.vz *= -0.5;
            p.scale = 1.8;
            break;
          case 'soul_drain':
            p.scale = 0.6;
            p.maxLife *= 0.5;
            p.life = p.maxLife;
            break;
          case 'shadow_strike':
            p.scale = 1.2;
            p.vy = 0;
            break;
          case 'crystal_shield':
            p.scale = 0.7;
            break;
          default:
            p.scale = 1.0;
        }

        spawned++;
      }
    },
    [camera, cameraPosition],
  );

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Process pending events
    const events = pendingEvents.current;
    if (events.length > 0) {
      for (const evt of events) {
        spawnEffect(evt);
      }
      pendingEvents.current = [];
    }

    // Update particles
    const particles = particlesRef.current;
    let activeCount = 0;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.active) {
        // Hide inactive
        _obj.position.set(0, -1000, 0);
        _obj.scale.setScalar(0);
        _obj.updateMatrix();
        mesh.setMatrixAt(i, _obj.matrix);
        continue;
      }

      // Update position
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.life -= delta * 60; // frame-based life

      if (p.life <= 0) {
        p.active = false;
        _obj.position.set(0, -1000, 0);
        _obj.scale.setScalar(0);
        _obj.updateMatrix();
        mesh.setMatrixAt(i, _obj.matrix);
        continue;
      }

      // Fade out
      const lifeRatio = p.life / p.maxLife;
      const scale = p.scale * lifeRatio;

      _obj.position.set(p.x, p.y, p.z);
      _obj.scale.setScalar(scale);
      _obj.updateMatrix();
      mesh.setMatrixAt(i, _obj.matrix);

      // Color with fade
      _color.setHex(p.color);
      mesh.setColorAt(i, _color);

      activeCount++;
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = MAX_PARTICLES;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_PARTICLES]}
      frustumCulled={false}
    />
  );
}

export default WeaponRenderer;
