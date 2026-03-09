'use client';

/**
 * FlagSprite — 에이전트 머리 위 국기 + 이름 Billboard 라벨 (v14 Phase 1: S09)
 *
 * 기능:
 *   1. 에이전트 머리 위 국기 이모지 + 이름 라벨 표시 (Billboard)
 *   2. 아군 식별: 같은 국적 = 초록, 적 = 빨강, 자신 = 골드
 *   3. CanvasTexture 아틀라스 (1장) + InstancedMesh + UV 오프셋 셰이더
 *   4. 텍스처는 에이전트 변경 시에만 재생성 (GC 최소화)
 *
 * 구현:
 *   - 아틀라스: 1024 x (MAX_AGENTS * ROW_H) 캔버스
 *   - 각 에이전트 = 아틀라스의 한 행 (128 x 32)
 *   - 셰이더: instanceId → UV row offset
 *   - useFrame: 위치 + billboard 회전만 업데이트
 */

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { toWorld, getAgentScale } from '@/lib/3d/coordinate-utils';
import { iso2ToFlag, getCountryByISO3 } from '@/lib/country-data';
import type { AgentNetworkData } from '@agent-survivor/shared';

// ─── Constants ───

const MAX_AGENTS = 60;
const ROW_W = 256;
const ROW_H = 40;
const ATLAS_W = ROW_W;
const ATLAS_H = ROW_H * MAX_AGENTS;
/** 라벨 월드 크기 */
const LABEL_WORLD_W = 2.0;
const LABEL_WORLD_H = LABEL_WORLD_W * (ROW_H / ROW_W);
/** 머리 위 오프셋 (Y축, 스케일 곱하기 전) */
const Y_OFFSET = 1.15;

// ─── 색상 정의 ───

const ALLY_COLOR = '#44DD44';
const ENEMY_COLOR = '#FF6666';
const SELF_COLOR = '#FFD700';
const BOT_COLOR = '#999999';
const DEFAULT_COLOR = '#CCCCCC';

// ─── 재사용 임시 객체 ───

const _obj = new THREE.Object3D();

// ─── Props ───

interface FlagSpriteProps {
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
  playerIdRef: React.MutableRefObject<string | null>;
  playerNationality: string;
}

// ─── Component ───

export function FlagSprite({ agentsRef, playerIdRef, playerNationality }: FlagSpriteProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const meshRefCb = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (mesh) { mesh.count = 0; meshRef.current = mesh; }
  }, []);
  const { camera } = useThree();

  // 아틀라스 캔버스 + 텍스처
  const { canvas, texture, ctx } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = ATLAS_W;
    c.height = ATLAS_H;
    const context = c.getContext('2d')!;
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { canvas: c, texture: tex, ctx: context };
  }, []);

  // UV 어트리뷰트 (인스턴스별 row index)
  const uvOffsetAttr = useMemo(() => {
    return new Float32Array(MAX_AGENTS); // row index 0..59
  }, []);

  // 에이전트별 캐시 키 (name + nat + 색상 타입)
  const prevKeysRef = useRef<string[]>(new Array(MAX_AGENTS).fill(''));

  // Geometry: UV를 인스턴스 인덱스 기반으로 조정하는 커스텀 PlaneGeometry
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(LABEL_WORLD_W, LABEL_WORLD_H);
    return geo;
  }, []);

  // Material: 커스텀 셰이더로 인스턴스별 UV row 오프셋
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        atlas: { value: texture },
        totalRows: { value: MAX_AGENTS },
      },
      vertexShader: /* glsl */ `
        attribute float rowIndex;
        varying vec2 vUv;
        uniform float totalRows;

        void main() {
          // UV: x는 0..1, y는 rowIndex/totalRows..(rowIndex+1)/totalRows
          float rowStart = rowIndex / totalRows;
          float rowEnd = (rowIndex + 1.0) / totalRows;
          vUv = vec2(uv.x, mix(rowStart, rowEnd, uv.y));

          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D atlas;
        varying vec2 vUv;

        void main() {
          vec4 texColor = texture2D(atlas, vUv);
          if (texColor.a < 0.05) discard;
          gl_FragColor = texColor;
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [texture]);

  // 정리
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    };
  }, [geometry, material, texture]);

  // 아틀라스의 특정 행에 라벨 렌더링
  const drawLabel = useCallback((
    rowIdx: number,
    name: string,
    nationality: string,
    color: string,
  ) => {
    const yStart = rowIdx * ROW_H;

    // 행 클리어
    ctx.clearRect(0, yStart, ROW_W, ROW_H);

    // 배경: 둥근 사각형 반투명
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    const pad = 2;
    const rx = 6;
    ctx.beginPath();
    ctx.roundRect(pad, yStart + pad, ROW_W - pad * 2, ROW_H - pad * 2, rx);
    ctx.fill();

    // 국기 이모지
    const country = getCountryByISO3(nationality);
    const flagEmoji = country ? iso2ToFlag(country.iso2) : '';
    let textX = 10;

    if (flagEmoji) {
      ctx.font = '18px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(flagEmoji, 8, yStart + ROW_H / 2);
      textX = 32;
    }

    // 이름
    ctx.font = 'bold 15px "Inter", -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;

    const displayName = name.length > 14 ? name.slice(0, 13) + '..' : name;
    ctx.fillText(displayName, textX, yStart + ROW_H / 2 + 1);
  }, [ctx]);

  // ─── useFrame: 위치 + billboard + 텍스처 업데이트 ───
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const agents = agentsRef.current;
    const playerId = playerIdRef.current;
    const myNat = playerNationality;
    const prevKeys = prevKeysRef.current;

    let needsTextureUpdate = false;
    let visibleIdx = 0;

    // rowIndex InstancedBufferAttribute 설정 (lazy init)
    if (!mesh.geometry.getAttribute('rowIndex')) {
      const rowBuf = new THREE.InstancedBufferAttribute(uvOffsetAttr, 1);
      mesh.geometry.setAttribute('rowIndex', rowBuf);
    }

    for (const agent of agents) {
      if (visibleIdx >= MAX_AGENTS) break;

      const { i: id, n: name, x, y, m, nat: agentNat, bot: isBot } = agent;

      const nationality = agentNat || '';
      const isSelf = id === playerId;
      const isAlly = !isSelf && myNat !== '' && nationality !== '' && nationality === myNat;

      // 색상 결정
      const color = isSelf ? SELF_COLOR
        : isBot ? BOT_COLOR
        : isAlly ? ALLY_COLOR
        : nationality ? ENEMY_COLOR
        : DEFAULT_COLOR;

      // 캐시 키로 아틀라스 업데이트 필요 여부 판단
      const key = `${name}|${nationality}|${color}`;
      if (prevKeys[visibleIdx] !== key) {
        drawLabel(visibleIdx, name, nationality, color);
        prevKeys[visibleIdx] = key;
        needsTextureUpdate = true;
      }

      // rowIndex 어트리뷰트 업데이트
      uvOffsetAttr[visibleIdx] = visibleIdx;

      // Billboard 위치 계산
      const [worldX, , worldZ] = toWorld(x, y, 0);
      const scale = getAgentScale(m);

      _obj.position.set(worldX, Y_OFFSET * scale, worldZ);
      _obj.quaternion.copy(camera.quaternion);
      _obj.scale.set(scale * 0.7, scale * 0.7, 1);
      _obj.updateMatrix();
      mesh.setMatrixAt(visibleIdx, _obj.matrix);

      visibleIdx++;
    }

    // 나머지 숨기기
    for (let i = visibleIdx; i < MAX_AGENTS; i++) {
      _obj.position.set(0, -9999, 0);
      _obj.scale.setScalar(0);
      _obj.updateMatrix();
      mesh.setMatrixAt(i, _obj.matrix);
      prevKeys[i] = '';
    }

    mesh.count = visibleIdx;
    mesh.instanceMatrix.needsUpdate = true;

    // rowIndex 어트리뷰트 업데이트
    const rowAttr = mesh.geometry.getAttribute('rowIndex') as THREE.InstancedBufferAttribute;
    if (rowAttr) {
      rowAttr.needsUpdate = true;
    }

    // 텍스처 업데이트
    if (needsTextureUpdate) {
      texture.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRefCb}
      args={[geometry, material, MAX_AGENTS]}
      frustumCulled={false}
      renderOrder={999}
    />
  );
}
