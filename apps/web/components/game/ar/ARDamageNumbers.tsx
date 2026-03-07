'use client';

/**
 * ARDamageNumbers — 3D 플로팅 데미지 넘버
 *
 * 적이 피격될 때 데미지 숫자가 위로 떠오르며 사라진다.
 * - 일반 히트: 흰색 작은 텍스트
 * - 크리티컬: 빨간색 큰 텍스트 + 스케일 펀치
 * - 속성별 색상: fire=주황, frost=하늘, lightning=노랑, poison=초록
 */

import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ARDamageType } from '@/lib/3d/ar-types';
import { DAMAGE_TYPE_COLORS } from '@/lib/3d/ar-types';

const MAX_NUMBERS = 64;
const FLOAT_SPEED = 3; // units per second upward
const LIFETIME = 1.0; // seconds
const FADE_START = 0.5; // start fading at this fraction of lifetime

export interface DamageNumber {
  id: number;
  x: number;
  z: number;
  y: number;
  amount: number;
  critCount: number;
  dmgType: ARDamageType;
  age: number;
  alive: boolean;
}

interface ARDamageNumbersProps {
  numbersRef: React.MutableRefObject<DamageNumber[]>;
}

// 싱글톤 ID 카운터
let nextDmgId = 0;

/**
 * 외부에서 데미지 넘버를 추가하는 헬퍼 함수
 */
export function addDamageNumber(
  numbersRef: React.MutableRefObject<DamageNumber[]>,
  x: number,
  z: number,
  amount: number,
  critCount: number,
  dmgType: ARDamageType
) {
  nextDmgId++;

  // 위치 약간 랜덤 오프셋
  const ox = (Math.random() - 0.5) * 0.5;
  const oz = (Math.random() - 0.5) * 0.5;

  const num: DamageNumber = {
    id: nextDmgId,
    x: x + ox,
    z: z + oz,
    y: 1.5, // 적 머리 위에서 시작
    amount,
    critCount,
    dmgType,
    age: 0,
    alive: true,
  };

  numbersRef.current.push(num);

  // 최대 개수 넘으면 오래된 것 제거
  if (numbersRef.current.length > MAX_NUMBERS) {
    numbersRef.current = numbersRef.current.slice(-MAX_NUMBERS);
  }
}

/**
 * ARDamageNumbers 컴포넌트
 * Billboard sprite 기반 데미지 숫자 렌더링
 */
export function ARDamageNumbers({ numbersRef }: ARDamageNumbersProps) {
  const groupRef = useRef<THREE.Group>(null);
  const spritesRef = useRef<THREE.Sprite[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureMapRef = useRef<Map<string, THREE.Texture>>(new Map());

  // Canvas for text rendering (reusable)
  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      if (typeof document !== 'undefined') {
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.width = 128;
        canvasRef.current.height = 64;
      }
    }
    return canvasRef.current;
  }, []);

  // Generate texture for a damage number
  const getTexture = useCallback(
    (amount: number, critCount: number, dmgType: ARDamageType): THREE.Texture | null => {
      const canvas = getCanvas();
      if (!canvas) return null;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const displayAmount = Math.round(amount);
      const isCrit = critCount > 0;
      const color = isCrit ? '#FF4444' : (DAMAGE_TYPE_COLORS[dmgType] || '#FFFFFF');
      const fontSize = isCrit ? (critCount > 1 ? 36 : 28) : 20;
      const text = isCrit && critCount > 1 ? `${displayAmount}!!` : `${displayAmount}`;

      ctx.clearRect(0, 0, 128, 64);
      ctx.font = `bold ${fontSize}px "Rajdhani", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(text, 64, 32);

      // Fill
      ctx.fillStyle = color;
      ctx.fillText(text, 64, 32);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    },
    [getCanvas]
  );

  // Per-frame update
  useFrame((_, delta) => {
    const numbers = numbersRef.current;
    const group = groupRef.current;
    if (!group) return;

    // Remove expired numbers
    numbersRef.current = numbers.filter((n) => n.alive);

    // Update each number
    for (const num of numbersRef.current) {
      num.age += delta;
      num.y += FLOAT_SPEED * delta;

      if (num.age >= LIFETIME) {
        num.alive = false;
      }
    }

    // Update sprite positions (we use group children directly)
    // Remove excess children
    while (group.children.length > numbersRef.current.length) {
      const child = group.children[group.children.length - 1];
      group.remove(child);
      if (child instanceof THREE.Sprite && child.material instanceof THREE.SpriteMaterial) {
        child.material.dispose();
        if (child.material.map) {
          child.material.map.dispose();
        }
      }
    }

    // Add/update sprites
    for (let i = 0; i < numbersRef.current.length; i++) {
      const num = numbersRef.current[i];
      let sprite: THREE.Sprite;

      if (i < group.children.length) {
        sprite = group.children[i] as THREE.Sprite;
      } else {
        // Create new sprite
        const tex = getTexture(num.amount, num.critCount, num.dmgType);
        const mat = new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          depthTest: false,
        });
        sprite = new THREE.Sprite(mat);
        group.add(sprite);
      }

      // Position
      sprite.position.set(num.x, num.y, num.z);

      // Scale: crits are larger
      const baseScale = num.critCount > 0 ? (num.critCount > 1 ? 2.0 : 1.5) : 1.0;
      // Pop effect: start big, shrink slightly
      const ageRatio = num.age / LIFETIME;
      const popScale = ageRatio < 0.1 ? 1.0 + (1.0 - ageRatio / 0.1) * 0.3 : 1.0;
      const scale = baseScale * popScale;
      sprite.scale.set(scale, scale * 0.5, 1);

      // Fade out
      if (sprite.material instanceof THREE.SpriteMaterial) {
        const fadeRatio = ageRatio > FADE_START ? 1.0 - (ageRatio - FADE_START) / (1.0 - FADE_START) : 1.0;
        sprite.material.opacity = Math.max(0, fadeRatio);
      }
    }
  });

  return <group ref={groupRef} />;
}
