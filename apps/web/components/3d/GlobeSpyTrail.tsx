'use client';

/**
 * GlobeSpyTrail — v24 Phase 6 최적화
 * 첩보 점선 트레일:
 * - 2국가 사이 은밀한 점선 아크 라인 (LineDashedMaterial, 낮은 opacity 0.3~0.5)
 * - 깜빡이는 눈 아이콘 (CanvasTexture + Sprite, 깜빡 애니메이션)
 *
 * v24 Phase 6 변경:
 * - SpriteMaterial clone 최적화: 공유 텍스처 + 단일 material (모든 눈 동시 깜빡)
 * - 3-tier distance LOD 지원 (far: 아크만, mid/close: 아이콘 표시)
 * - prefers-reduced-motion: 깜빡임/크기진동 비활성화
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { createArcPoints } from '@/lib/effect-utils';
import { ARC_HEIGHT, COLORS_BASE, RENDER_ORDER, REDUCED_MOTION } from '@/lib/effect-constants';
import type { DistanceLODConfig } from '@/hooks/useGlobeLOD';

// ─── Types ───

export interface SpyOpData {
  from: string;    // ISO3 — 첩보 발동국
  to: string;      // ISO3 — 첩보 대상국
  timestamp: number;
}

export interface GlobeSpyTrailProps {
  spyOps: SpyOpData[];
  centroidsMap: Map<string, [number, number]>;
  globeRadius?: number;
  visible?: boolean;
  /** v24 Phase 6: 카메라 거리 LOD 설정 */
  distanceLOD?: DistanceLODConfig;
  /** v24 Phase 6: prefers-reduced-motion */
  reducedMotion?: boolean;
}

// ─── Constants ───

const DEFAULT_RADIUS = 100;
const SPY_ARC_SEGMENTS = 48;
const EYE_CANVAS_SIZE = 64;

// ─── Eye icon CanvasTexture factory (모듈 스코프 — 전체 공유) ───

let _eyeTexture: THREE.CanvasTexture | null = null;

function getEyeTexture(): THREE.CanvasTexture {
  if (_eyeTexture) return _eyeTexture;

  const canvas = document.createElement('canvas');
  canvas.width = EYE_CANVAS_SIZE;
  canvas.height = EYE_CANVAS_SIZE;
  const ctx = canvas.getContext('2d')!;

  const cx = EYE_CANVAS_SIZE / 2;
  const cy = EYE_CANVAS_SIZE / 2;

  // 투명 배경
  ctx.clearRect(0, 0, EYE_CANVAS_SIZE, EYE_CANVAS_SIZE);

  // 눈 외곽 (아몬드 형태)
  ctx.beginPath();
  ctx.moveTo(8, cy);
  ctx.quadraticCurveTo(cx, 8, EYE_CANVAS_SIZE - 8, cy);
  ctx.quadraticCurveTo(cx, EYE_CANVAS_SIZE - 8, 8, cy);
  ctx.closePath();
  ctx.fillStyle = 'rgba(153, 85, 204, 0.6)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(153, 85, 204, 0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 눈동자 (검은 원)
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(60, 30, 80, 0.9)';
  ctx.fill();

  // 하이라이트
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 3, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fill();

  _eyeTexture = new THREE.CanvasTexture(canvas);
  _eyeTexture.needsUpdate = true;
  return _eyeTexture;
}

// ─── Internal render data ───

interface SpyRenderData {
  dashLine: THREE.Line;
  dashMaterial: THREE.LineDashedMaterial;
  eyeSprite: THREE.Sprite;
  arcMidpoint: THREE.Vector3; // 아크 중점 (눈 위치)
  key: string;
}

// ─── Component ───

export function GlobeSpyTrail({
  spyOps,
  centroidsMap,
  globeRadius = DEFAULT_RADIUS,
  visible = true,
  distanceLOD,
  reducedMotion = false,
}: GlobeSpyTrailProps) {
  const groupRef = useRef<THREE.Group>(null);
  const dataRef = useRef<SpyRenderData[]>([]);

  // v24 Phase 6: 공유 SpriteMaterial (clone 제거)
  const sharedEyeMaterial = useMemo(
    () => new THREE.SpriteMaterial({
      map: getEyeTexture(),
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
    [],
  );

  // spyOps 변경 시 재구축
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // 기존 정리
    for (const d of dataRef.current) {
      group.remove(d.dashLine);
      group.remove(d.eyeSprite);
      d.dashLine.geometry.dispose();
      d.dashMaterial.dispose();
      // eyeMaterial은 공유이므로 개별 dispose 하지 않음
    }
    dataRef.current = [];

    for (const spy of spyOps) {
      const fromC = centroidsMap.get(spy.from);
      const toC = centroidsMap.get(spy.to);
      if (!fromC || !toC) continue;

      const startPos = latLngToVector3(fromC[0], fromC[1], globeRadius + 0.8);
      const endPos = latLngToVector3(toC[0], toC[1], globeRadius + 0.8);
      const points = createArcPoints(startPos, endPos, globeRadius, ARC_HEIGHT.spy, SPY_ARC_SEGMENTS);

      // 보라색 점선 라인
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const dashMaterial = new THREE.LineDashedMaterial({
        color: COLORS_BASE.spy.clone(),
        dashSize: 1.5,
        gapSize: 2.0,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });

      const dashLine = new THREE.Line(lineGeo, dashMaterial);
      dashLine.computeLineDistances();
      dashLine.renderOrder = RENDER_ORDER.ARC_SPY;

      // 눈 아이콘 (아크 중점에 Sprite — 공유 material 사용)
      const midIdx = Math.floor(points.length / 2);
      const arcMidpoint = points[midIdx].clone();

      const eyeSprite = new THREE.Sprite(sharedEyeMaterial);
      eyeSprite.position.copy(arcMidpoint);
      eyeSprite.scale.set(3.0, 3.0, 1.0);
      eyeSprite.renderOrder = RENDER_ORDER.SPY_EYE;

      group.add(dashLine);
      group.add(eyeSprite);

      dataRef.current.push({
        dashLine,
        dashMaterial,
        eyeSprite,
        arcMidpoint,
        key: `${spy.from}_${spy.to}_${spy.timestamp}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spyOps, centroidsMap, globeRadius]);

  // 매 프레임: 라인 opacity 진동 + 눈 깜빡임 (LOD + reduced motion 반영)
  useFrame(({ clock }) => {
    if (!visible) return;
    const elapsed = clock.getElapsedTime();
    const showIcons = distanceLOD?.showIcons ?? true;

    if (reducedMotion) {
      // 정적 표시
      sharedEyeMaterial.opacity = REDUCED_MOTION.staticOpacity;
      for (const d of dataRef.current) {
        d.dashMaterial.opacity = REDUCED_MOTION.staticOpacity * 0.5;
        d.eyeSprite.visible = showIcons;
        d.eyeSprite.scale.set(3.0, 3.0, 1.0);
      }
      return;
    }

    // 눈 깜빡임: 공유 material로 전체 동시 깜빡 (draw call 1회)
    const blinkCycle = elapsed % 3.0;
    let eyeOpacity = 0.7;
    if (blinkCycle > 2.0 && blinkCycle < 2.15) {
      eyeOpacity = 0.1; // 눈 감음
    } else if (blinkCycle > 2.15 && blinkCycle < 2.3) {
      eyeOpacity = 0.7; // 눈 뜸
    }
    sharedEyeMaterial.opacity = eyeOpacity;

    // 눈 크기 미세 진동 + LOD 아이콘 토글
    const eyeScale = 3.0 + Math.sin(elapsed * 2.0) * 0.3;

    for (const d of dataRef.current) {
      // 라인 opacity: 은밀하게 깜빡 (0.2~0.5)
      const lineOpacity = 0.25 + Math.sin(elapsed * 1.5) * 0.15;
      d.dashMaterial.opacity = lineOpacity;

      // 눈 스케일 + LOD 가시성
      d.eyeSprite.scale.set(eyeScale, eyeScale, 1.0);
      d.eyeSprite.visible = showIcons;
    }
  });

  // cleanup
  useEffect(() => {
    return () => {
      for (const d of dataRef.current) {
        d.dashLine.geometry.dispose();
        d.dashMaterial.dispose();
      }
      sharedEyeMaterial.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <group ref={groupRef} visible={visible} />;
}
