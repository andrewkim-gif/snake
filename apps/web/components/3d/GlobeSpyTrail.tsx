'use client';

/**
 * GlobeSpyTrail — v23 Phase 5 Task 4
 * 첩보 점선 트레일:
 * - 2국가 사이 은밀한 점선 아크 라인 (LineDashedMaterial, 낮은 opacity 0.3~0.5)
 * - 깜빡이는 눈 아이콘 (CanvasTexture로 눈 그리기 + Sprite, 깜빡 애니메이션)
 * - 보라/회색 색상 (#9966cc)
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { createArcPoints } from '@/lib/effect-utils';
import { ARC_HEIGHT, COLORS_BASE, RENDER_ORDER } from '@/lib/effect-constants';

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
}

// ─── Constants ───

const DEFAULT_RADIUS = 100;
const SPY_ARC_SEGMENTS = 48;
const EYE_CANVAS_SIZE = 64;

// ─── GC-prevention ───

const _tempVec = new THREE.Vector3();

// ─── Eye icon CanvasTexture factory ───

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
  eyeMaterial: THREE.SpriteMaterial;
  arcMidpoint: THREE.Vector3; // 아크 중점 (눈 위치)
  key: string;
}

// ─── Component ───

export function GlobeSpyTrail({
  spyOps,
  centroidsMap,
  globeRadius = DEFAULT_RADIUS,
  visible = true,
}: GlobeSpyTrailProps) {
  const groupRef = useRef<THREE.Group>(null);
  const dataRef = useRef<SpyRenderData[]>([]);

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
      d.eyeMaterial.dispose();
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

      // 눈 아이콘 (아크 중점에 Sprite)
      const midIdx = Math.floor(points.length / 2);
      const arcMidpoint = points[midIdx].clone();

      const eyeMaterial = new THREE.SpriteMaterial({
        map: getEyeTexture(),
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });

      const eyeSprite = new THREE.Sprite(eyeMaterial);
      eyeSprite.position.copy(arcMidpoint);
      eyeSprite.scale.set(3.0, 3.0, 1.0);
      eyeSprite.renderOrder = RENDER_ORDER.SPY_EYE;

      group.add(dashLine);
      group.add(eyeSprite);

      dataRef.current.push({
        dashLine,
        dashMaterial,
        eyeSprite,
        eyeMaterial,
        arcMidpoint,
        key: `${spy.from}_${spy.to}_${spy.timestamp}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spyOps, centroidsMap, globeRadius]);

  // 매 프레임: 라인 opacity 진동 + 눈 깜빡임
  useFrame(({ clock }) => {
    if (!visible) return;
    const elapsed = clock.getElapsedTime();

    for (const d of dataRef.current) {
      // 라인 opacity: 은밀하게 깜빡 (0.2~0.5)
      const lineOpacity = 0.25 + Math.sin(elapsed * 1.5) * 0.15;
      d.dashMaterial.opacity = lineOpacity;

      // 눈 깜빡임: 주기적으로 투명→불투명 (2초 주기, 빠른 깜빡)
      const blinkCycle = elapsed % 3.0;
      let eyeOpacity = 0.7;
      // 2.0~2.3초 구간에서 빠르게 깜빡 (close + open)
      if (blinkCycle > 2.0 && blinkCycle < 2.15) {
        eyeOpacity = 0.1; // 눈 감음
      } else if (blinkCycle > 2.15 && blinkCycle < 2.3) {
        eyeOpacity = 0.7; // 눈 뜸
      }
      d.eyeMaterial.opacity = eyeOpacity;

      // 눈 크기 미세 진동
      const eyeScale = 3.0 + Math.sin(elapsed * 2.0) * 0.3;
      d.eyeSprite.scale.set(eyeScale, eyeScale, 1.0);
    }
  });

  // cleanup
  useEffect(() => {
    return () => {
      for (const d of dataRef.current) {
        d.dashLine.geometry.dispose();
        d.dashMaterial.dispose();
        d.eyeMaterial.dispose();
      }
    };
  }, []);

  return <group ref={groupRef} visible={visible} />;
}
