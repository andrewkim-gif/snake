'use client';

/**
 * ARDamageNumbers — 3D 플로팅 데미지 넘버 (PERF-8 최적화)
 *
 * v19 최적화:
 * - Sprite 풀: 사전 할당 MAX_NUMBERS개 (useFrame 내 new 금지)
 * - 텍스처 캐시: 동일 amount+crit+type → 캐시 히트
 * - 인플레이스 업데이트: filter() 제거 → alive 카운트 관리
 */

import { useRef, useCallback, memo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ARDamageType } from '@/lib/3d/ar-types';
import { DAMAGE_TYPE_COLORS } from '@/lib/3d/ar-types';

const MAX_NUMBERS = 50;
const FLOAT_SPEED = 3;
const LIFETIME = 1.0;
const FADE_START = 0.5;

// 풀 슬롯 (사전 할당)
interface DmgSlot {
  active: boolean;
  x: number;
  z: number;
  y: number;
  amount: number;
  critCount: number;
  dmgType: ARDamageType;
  age: number;
}

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

let nextDmgId = 0;

export function addDamageNumber(
  numbersRef: React.MutableRefObject<DamageNumber[]>,
  x: number,
  z: number,
  amount: number,
  critCount: number,
  dmgType: ARDamageType
) {
  nextDmgId++;
  const ox = (Math.random() - 0.5) * 0.5;
  const oz = (Math.random() - 0.5) * 0.5;

  numbersRef.current.push({
    id: nextDmgId,
    x: x + ox,
    z: z + oz,
    y: 1.5,
    amount,
    critCount,
    dmgType,
    age: 0,
    alive: true,
  });

  // 인플레이스 제한
  if (numbersRef.current.length > MAX_NUMBERS) {
    numbersRef.current.splice(0, numbersRef.current.length - MAX_NUMBERS);
  }
}

function ARDamageNumbersInner({ numbersRef }: ARDamageNumbersProps) {
  const groupRef = useRef<THREE.Group>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // 텍스처 캐시: "amount_crit_type" → Texture
  const texCacheRef = useRef<Map<string, THREE.Texture>>(new Map());
  // Sprite 풀
  const poolRef = useRef<THREE.Sprite[]>([]);
  const poolMatsRef = useRef<THREE.SpriteMaterial[]>([]);
  const poolInited = useRef(false);

  // 풀 초기화 (한 번만)
  useEffect(() => {
    if (poolInited.current) return;
    poolInited.current = true;

    const sprites: THREE.Sprite[] = [];
    const mats: THREE.SpriteMaterial[] = [];
    for (let i = 0; i < MAX_NUMBERS; i++) {
      const mat = new THREE.SpriteMaterial({
        transparent: true,
        depthTest: false,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.scale.set(1, 0.5, 1);
      sprites.push(sprite);
      mats.push(mat);
    }
    poolRef.current = sprites;
    poolMatsRef.current = mats;

    // group에 추가
    const group = groupRef.current;
    if (group) {
      for (const s of sprites) group.add(s);
    }

    return () => {
      for (const m of mats) m.dispose();
      // 텍스처 캐시 정리
      for (const t of texCacheRef.current.values()) t.dispose();
      texCacheRef.current.clear();
    };
  }, []);

  const getCanvas = useCallback(() => {
    if (!canvasRef.current && typeof document !== 'undefined') {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 128;
      canvasRef.current.height = 64;
    }
    return canvasRef.current;
  }, []);

  // 캐시된 텍스처 가져오기
  const getCachedTexture = useCallback(
    (amount: number, critCount: number, dmgType: ARDamageType): THREE.Texture | null => {
      const displayAmount = Math.round(amount);
      const key = `${displayAmount}_${critCount}_${dmgType}`;

      const cached = texCacheRef.current.get(key);
      if (cached) return cached;

      const canvas = getCanvas();
      if (!canvas) return null;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const isCrit = critCount > 0;
      const color = isCrit ? '#FF4444' : (DAMAGE_TYPE_COLORS[dmgType] || '#FFFFFF');
      const fontSize = isCrit ? (critCount > 1 ? 36 : 28) : 20;
      const text = isCrit && critCount > 1 ? `${displayAmount}!!` : `${displayAmount}`;

      ctx.clearRect(0, 0, 128, 64);
      ctx.font = `bold ${fontSize}px "Rajdhani", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(text, 64, 32);
      ctx.fillStyle = color;
      ctx.fillText(text, 64, 32);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;

      // 캐시 크기 제한 (LRU 간단 구현: 200개 초과 시 절반 제거)
      if (texCacheRef.current.size > 200) {
        let count = 0;
        for (const [k, t] of texCacheRef.current) {
          if (count++ < 100) {
            t.dispose();
            texCacheRef.current.delete(k);
          } else break;
        }
      }

      texCacheRef.current.set(key, texture);
      return texture;
    },
    [getCanvas]
  );

  useFrame((_, delta) => {
    const numbers = numbersRef.current;
    const pool = poolRef.current;
    const mats = poolMatsRef.current;
    if (!groupRef.current || pool.length === 0) return;

    // 인플레이스 필터 + 업데이트 (새 배열 할당 제거)
    let writeIdx = 0;
    for (let i = 0; i < numbers.length; i++) {
      const num = numbers[i];
      num.age += delta;
      num.y += FLOAT_SPEED * delta;
      if (num.age < LIFETIME) {
        numbers[writeIdx++] = num;
      }
    }
    numbers.length = writeIdx;

    // 풀 업데이트
    for (let i = 0; i < MAX_NUMBERS; i++) {
      const sprite = pool[i];
      const mat = mats[i];

      if (i < numbers.length) {
        const num = numbers[i];
        sprite.visible = true;
        sprite.position.set(num.x, num.y, num.z);

        // 텍스처 (한 번만 설정 — age < delta 이면 새 숫자)
        if (num.age < delta * 2) {
          const tex = getCachedTexture(num.amount, num.critCount, num.dmgType);
          if (tex) mat.map = tex;
          mat.needsUpdate = true;
        }

        // 스케일
        const baseScale = num.critCount > 0 ? (num.critCount > 1 ? 2.0 : 1.5) : 1.0;
        const ageRatio = num.age / LIFETIME;
        const popScale = ageRatio < 0.1 ? 1.0 + (1.0 - ageRatio / 0.1) * 0.3 : 1.0;
        const scale = baseScale * popScale;
        sprite.scale.set(scale, scale * 0.5, 1);

        // 페이드
        mat.opacity = ageRatio > FADE_START
          ? Math.max(0, 1.0 - (ageRatio - FADE_START) / (1.0 - FADE_START))
          : 1.0;
      } else {
        sprite.visible = false;
      }
    }
  });

  return <group ref={groupRef} />;
}

export const ARDamageNumbers = memo(ARDamageNumbersInner);
