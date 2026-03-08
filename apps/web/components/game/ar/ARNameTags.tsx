'use client';

/**
 * ARNameTags — 스프라이트 기반 이름태그 (v19 성능 최적화)
 *
 * Html DOM overlay 제거 → CanvasTexture Sprite 전환
 * - 단일 useFrame으로 모든 스프라이트 업데이트
 * - 텍스처 캐시: 같은 이름/레벨/팩션 → 캐시 히트
 * - 스프라이트 풀: MAX_TAGS개 사전 할당
 */

import { useRef, useEffect, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ARPlayerNet } from '@/lib/3d/ar-types';
import type { ARInterpolationState } from '@/lib/3d/ar-interpolation';
import { MC_BASE_Y } from '@/lib/3d/mc-types';
import { getArenaTerrainHeight } from '@/lib/3d/mc-noise';

// ── 상수 ────────────────────────────────────────────

const MAX_TAGS = 30;
const TAG_HEIGHT = 2.5;
const TAG_SCALE_X = 2.4;
const TAG_SCALE_Y = 0.8;

const ALLY_COLOR = '#4488FF';
const ENEMY_COLOR = '#FF4444';
const DEAD_COLOR = '#888888';
const HP_GREEN = '#44FF44';
const HP_YELLOW = '#FFAA00';
const HP_RED = '#FF4444';

// ── Props ────────────────────────────────────────────

interface ARNameTagsProps {
  players: ARPlayerNet[];
  myId: string;
  myFactionId: string;
  interpRef: React.RefObject<ARInterpolationState | null>;
  heightOffset?: number;
  /** 아레나 시드 (지형 높이 쿼리용) */
  arenaSeed: number;
  /** 지형 높이 편차 (기본 3) */
  flattenVariance?: number;
}

// ── 텍스처 생성 ────────────────────────────────────────

const _texCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
if (_texCanvas) {
  _texCanvas.width = 256;
  _texCanvas.height = 80;
}

const _texCache = new Map<string, THREE.Texture>();

function getTagTexture(
  name: string,
  level: number,
  factionId: string,
  hpRatio: number,
  isAlly: boolean,
): THREE.Texture {
  // HP를 10% 단위로 양자화하여 캐시 히트율 향상
  const hpBucket = Math.round(hpRatio * 10);
  const key = `${name}_${level}_${factionId}_${hpBucket}_${isAlly ? 1 : 0}`;

  const cached = _texCache.get(key);
  if (cached) return cached;

  if (!_texCanvas) return new THREE.Texture();

  const ctx = _texCanvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  const w = 256;
  const h = 80;
  ctx.clearRect(0, 0, w, h);

  const nameColor = isAlly ? ALLY_COLOR : ENEMY_COLOR;

  // 이름 + 레벨
  ctx.font = 'bold 22px Rajdhani, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 텍스트 외곽선
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.lineWidth = 4;
  const nameText = `${name}  Lv.${level}`;
  ctx.strokeText(nameText, w / 2, 22);
  ctx.fillStyle = nameColor;
  ctx.fillText(nameText, w / 2, 22);

  // 팩션 이름
  if (factionId) {
    ctx.font = '16px Rajdhani, sans-serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.8;
    ctx.strokeText(`[${factionId}]`, w / 2, 44);
    ctx.fillStyle = nameColor;
    ctx.fillText(`[${factionId}]`, w / 2, 44);
    ctx.globalAlpha = 1.0;
  }

  // HP 바 배경
  const barX = w / 2 - 50;
  const barY = 56;
  const barW = 100;
  const barH = 8;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(barX, barY, barW, barH);

  // HP 바 전경
  const hpColor = hpRatio > 0.5 ? HP_GREEN : hpRatio > 0.25 ? HP_YELLOW : HP_RED;
  ctx.fillStyle = hpColor;
  ctx.fillRect(barX, barY, barW * hpRatio, barH);

  const texture = new THREE.CanvasTexture(_texCanvas);
  texture.needsUpdate = true;

  // 캐시 크기 제한 (150개 초과 시 절반 제거)
  if (_texCache.size > 150) {
    let count = 0;
    for (const [k, t] of _texCache) {
      if (count++ < 75) {
        t.dispose();
        _texCache.delete(k);
      } else break;
    }
  }

  _texCache.set(key, texture);
  return texture;
}

// ── 컴포넌트 ────────────────────────────────────────

function ARNameTagsInner({
  players,
  myId,
  myFactionId,
  interpRef,
  heightOffset = TAG_HEIGHT,
  arenaSeed,
  flattenVariance = 3,
}: ARNameTagsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const poolRef = useRef<THREE.Sprite[]>([]);
  const poolMatsRef = useRef<THREE.SpriteMaterial[]>([]);
  const poolInited = useRef(false);

  // 스프라이트 풀 초기화 (한 번만)
  useEffect(() => {
    if (poolInited.current) return;
    poolInited.current = true;

    const sprites: THREE.Sprite[] = [];
    const mats: THREE.SpriteMaterial[] = [];

    for (let i = 0; i < MAX_TAGS; i++) {
      const mat = new THREE.SpriteMaterial({
        transparent: true,
        depthTest: false,
        sizeAttenuation: true,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.scale.set(TAG_SCALE_X, TAG_SCALE_Y, 1);
      sprite.renderOrder = 999;
      sprites.push(sprite);
      mats.push(mat);
    }

    poolRef.current = sprites;
    poolMatsRef.current = mats;

    const group = groupRef.current;
    if (group) {
      for (const s of sprites) group.add(s);
    }

    return () => {
      for (const m of mats) m.dispose();
      for (const t of _texCache.values()) t.dispose();
      _texCache.clear();
    };
  }, []);

  // 매 프레임 스프라이트 풀 업데이트 (단일 useFrame)
  useFrame(() => {
    const pool = poolRef.current;
    const mats = poolMatsRef.current;
    if (!groupRef.current || pool.length === 0) return;

    let slotIdx = 0;
    const interp = interpRef.current;

    for (let i = 0; i < players.length && slotIdx < MAX_TAGS; i++) {
      const p = players[i];
      // 사망/자기 자신 스킵
      if (!p.alive || p.id === myId) continue;

      const sprite = pool[slotIdx];
      const mat = mats[slotIdx];

      // 위치 (보간 적용 — zero-alloc: entity.renderX 직접 읽기)
      let px = p.pos.x;
      let pz = p.pos.z;
      if (interp) {
        const entity = interp.entities.get(p.id);
        if (entity) { px = entity.renderX; pz = entity.renderZ; }
      }
      // 지형 높이 — 그룹이 MC_BASE_Y에 있으므로 로컬 Y 변환
      const terrainY = getArenaTerrainHeight(px, pz, arenaSeed, flattenVariance);
      const localY = terrainY - MC_BASE_Y + heightOffset;
      sprite.position.set(px, localY, pz);
      sprite.visible = true;

      // 텍스처 업데이트 (캐시 기반)
      const isAlly = p.factionId === myFactionId && p.factionId !== '';
      const hpRatio = p.maxHp > 0 ? p.hp / p.maxHp : 0;
      const tex = getTagTexture(p.name, p.level, p.factionId, hpRatio, isAlly);
      if (mat.map !== tex) {
        mat.map = tex;
        mat.needsUpdate = true;
      }

      slotIdx++;
    }

    // 남은 슬롯 숨기기
    for (let i = slotIdx; i < MAX_TAGS; i++) {
      pool[i].visible = false;
    }
  });

  return <group ref={groupRef} />;
}

const ARNameTags = memo(ARNameTagsInner);
export default ARNameTags;
