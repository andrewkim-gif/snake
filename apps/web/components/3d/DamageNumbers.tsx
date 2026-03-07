'use client';

/**
 * DamageNumbers — v14 Phase 2: Floating Damage Number Display
 *
 * Renders floating damage numbers using InstancedMesh + sprite textures.
 * - Normal hit: white text
 * - Critical hit: gold + larger scale
 * - DOT (burn/poison): green text
 * - Heal (lifesteal): bright green text
 *
 * Uses a pool of pre-allocated number sprites for zero-GC rendering.
 * LOD: numbers fade/disappear at distance.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { toWorld } from '@/lib/3d/coordinate-utils';
import type { WeaponDamageEvent } from '@agent-survivor/shared';

// ─── Constants ───

const MAX_NUMBERS = 128;
const NUMBER_LIFETIME_SEC = 1.2;
const FLOAT_SPEED = 2.5; // units per second upward
const FADE_START = 0.6;  // start fading at 60% lifetime

// ─── Colors ───

const COLOR_NORMAL = 0xffffff;    // white
const COLOR_CRITICAL = 0xffd700;  // gold
const COLOR_DOT = 0x32cd32;       // lime green
const COLOR_HEAL = 0x00ff7f;      // spring green

// ─── Number Slot ───

interface NumberSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  damage: number;
  life: number;
  maxLife: number;
  color: number;
  scale: number;
  isCritical: boolean;
}

function createNumberPool(size: number): NumberSlot[] {
  const pool: NumberSlot[] = [];
  for (let i = 0; i < size; i++) {
    pool.push({
      active: false,
      x: 0, y: 0, z: 0,
      damage: 0,
      life: 0, maxLife: 0,
      color: COLOR_NORMAL,
      scale: 1,
      isCritical: false,
    });
  }
  return pool;
}

// ─── Reusable THREE objects ───

const _obj = new THREE.Object3D();
const _color = new THREE.Color();

// ─── Canvas Texture for Numbers ───

function createNumberTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('###', 64, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ─── Props ───

interface DamageNumbersProps {
  damageEvents: WeaponDamageEvent[];
  cameraPosition?: THREE.Vector3;
}

/**
 * DamageNumbers component.
 * Displays floating damage values at hit locations.
 */
export function DamageNumbers({ damageEvents, cameraPosition }: DamageNumbersProps) {
  const groupRef = useRef<THREE.Group>(null);
  const spritesRef = useRef<THREE.Sprite[]>([]);
  const slotsRef = useRef<NumberSlot[]>(createNumberPool(MAX_NUMBERS));
  const pendingRef = useRef<WeaponDamageEvent[]>([]);
  const { camera } = useThree();

  // Create sprites once
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Clean existing
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const sprites: THREE.Sprite[] = [];
    for (let i = 0; i < MAX_NUMBERS; i++) {
      const spriteMat = new THREE.SpriteMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: true,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.visible = false;
      sprite.scale.set(2, 1, 1);
      group.add(sprite);
      sprites.push(sprite);
    }
    spritesRef.current = sprites;

    return () => {
      sprites.forEach((s) => {
        (s.material as THREE.SpriteMaterial).dispose();
      });
    };
  }, []);

  // Queue events
  if (damageEvents.length > 0) {
    pendingRef.current = damageEvents;
  }

  useFrame((_state, delta) => {
    const slots = slotsRef.current;
    const sprites = spritesRef.current;
    if (sprites.length === 0) return;

    // Spawn from pending events
    const events = pendingRef.current;
    if (events.length > 0) {
      for (const evt of events) {
        // Find an inactive slot
        let slotIdx = -1;
        for (let i = 0; i < slots.length; i++) {
          if (!slots[i].active) {
            slotIdx = i;
            break;
          }
        }
        if (slotIdx < 0) continue; // pool exhausted

        const slot = slots[slotIdx];
        const worldPos = toWorld(evt.targetX, evt.targetY);
        const wpX = worldPos[0];
        const wpZ = worldPos[2];

        slot.active = true;
        slot.x = wpX + (Math.random() - 0.5) * 1.5;
        slot.y = 3.0 + Math.random() * 0.5;
        slot.z = wpZ + (Math.random() - 0.5) * 1.5;
        slot.damage = Math.round(evt.damage);
        slot.maxLife = NUMBER_LIFETIME_SEC;
        slot.life = NUMBER_LIFETIME_SEC;
        slot.isCritical = evt.isCritical;

        // Determine color and scale
        if (evt.isLifesteal && evt.healAmount && evt.healAmount > 0) {
          slot.color = COLOR_HEAL;
          slot.scale = 1.0;
          slot.damage = Math.round(evt.healAmount);
        } else if (evt.isDot) {
          slot.color = COLOR_DOT;
          slot.scale = 0.8;
        } else if (evt.isCritical) {
          slot.color = COLOR_CRITICAL;
          slot.scale = 1.6;
        } else {
          slot.color = COLOR_NORMAL;
          slot.scale = 1.0;
        }

        // Update sprite texture with the damage number
        const sprite = sprites[slotIdx];
        if (sprite) {
          updateSpriteTexture(sprite, slot.damage, slot.color, slot.isCritical);
          sprite.visible = true;
          sprite.position.set(slot.x, slot.y, slot.z);
          sprite.scale.set(slot.scale * 2, slot.scale * 1, 1);
          const mat = sprite.material as THREE.SpriteMaterial;
          mat.opacity = 1;
        }
      }
      pendingRef.current = [];
    }

    // Update active numbers
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const sprite = sprites[i];
      if (!sprite) continue;

      if (!slot.active) {
        sprite.visible = false;
        continue;
      }

      slot.life -= delta;
      if (slot.life <= 0) {
        slot.active = false;
        sprite.visible = false;
        continue;
      }

      // Float upward
      slot.y += FLOAT_SPEED * delta;
      sprite.position.set(slot.x, slot.y, slot.z);

      // Fade out
      const lifeRatio = slot.life / slot.maxLife;
      const mat = sprite.material as THREE.SpriteMaterial;
      if (lifeRatio < FADE_START) {
        mat.opacity = lifeRatio / FADE_START;
      } else {
        mat.opacity = 1;
      }

      // Critical bounce effect
      if (slot.isCritical && lifeRatio > 0.8) {
        const bounce = Math.sin((1 - lifeRatio) * Math.PI * 10) * 0.2;
        sprite.scale.set(
          (slot.scale + bounce) * 2,
          (slot.scale + bounce) * 1,
          1,
        );
      }

      // LOD distance check
      const camPos = cameraPosition || camera.position;
      const dx = slot.x - camPos.x;
      const dz = slot.z - camPos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 600 * 600) {
        sprite.visible = false;
      } else {
        sprite.visible = true;
      }
    }
  });

  return <group ref={groupRef} />;
}

/**
 * Updates a sprite's material map with the given damage number text.
 * Creates a canvas texture on the fly (pooled via material re-use).
 */
function updateSpriteTexture(
  sprite: THREE.Sprite,
  damage: number,
  color: number,
  isCritical: boolean,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, 128, 64);

  // Text styling
  const hexColor = '#' + color.toString(16).padStart(6, '0');
  const fontSize = isCritical ? 42 : 36;
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shadow
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeText(String(damage), 64, 32);

  // Fill
  ctx.fillStyle = hexColor;
  ctx.fillText(String(damage), 64, 32);

  // Critical marker
  if (isCritical) {
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#ff4444';
    ctx.fillText('CRIT!', 64, 10);
  }

  const mat = sprite.material as THREE.SpriteMaterial;
  if (mat.map) {
    mat.map.dispose();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  mat.map = tex;
  mat.needsUpdate = true;
}

export default DamageNumbers;
