'use client';

/**
 * GlobeConflictIndicators — 3D 지구본 위 "분쟁중" 배지 표시 (v17)
 *
 * 책임: 활성 분쟁 국가(playing/countdown 상태) 위에 빨간 "분쟁중" 펄스 배지 표시
 *
 * 구현:
 *   - CanvasTexture 프리렌더: 256×48px "분쟁중" 배지 (1회)
 *   - InstancedMesh: 최대 50개, ShaderMaterial (billboard + pulse + glow)
 *   - 뒷면 오클루전: centroid normal · camDir < threshold → 숨김
 *   - 거리 기반 fade + 중심 페이드
 *
 * 최적화: Canvas 1회 렌더, GPU 단일 드로콜, ~50KB 메모리
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Constants ───

const MAX_BADGES = 50;
const BADGE_W = 256;
const BADGE_H = 48;

/** Billboard 월드 크기 */
const WORLD_W = 6.0;
const WORLD_H = WORLD_W * (BADGE_H / BADGE_W);

/** centroid 높이 오프셋 (구체 표면 위) */
const BADGE_ALT = 5.0;
/** 국가 라벨보다 위에 배치 */
const BADGE_UP_OFFSET = 3.5;

/** 뒷면 오클루전 임계값 */
const BACKFACE_THRESHOLD = 0.05;
/** 카메라 거리 최대 (배지 숨김) */
const CAM_HIDE_DIST = 400;
const CAM_FADE_START = 280;

// ─── Types ───

export interface GlobeConflictIndicatorsProps {
  /** iso3 → [lat, lng] centroid 좌표 맵 */
  countryCentroids: Map<string, [number, number]>;
  /** ISO3 set of countries with active conflicts */
  activeConflictCountries: Set<string>;
  /** 글로브 반경 (기본 100) */
  globeRadius?: number;
}

// ─── 좌표 변환 ───

function latLngToXYZ(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

// ─── 재사용 임시 객체 ───

const _obj = new THREE.Object3D();
const _camDir = new THREE.Vector3();
const _upVec = new THREE.Vector3();

// ─── Canvas 프리렌더: "분쟁중" 배지 (1회) ───

function createBadgeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = BADGE_W;
  canvas.height = BADGE_H;
  const ctx = canvas.getContext('2d')!;

  // 배경: 다크 레드 반투명 라운드 사각형
  const padX = 4;
  const padY = 4;
  ctx.fillStyle = 'rgba(140, 20, 20, 0.85)';
  ctx.beginPath();
  ctx.roundRect(padX, padY, BADGE_W - padX * 2, BADGE_H - padY * 2, 8);
  ctx.fill();

  // 테두리: 밝은 빨간
  ctx.strokeStyle = 'rgba(255, 80, 60, 0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 텍스트: "⚔ 분쟁중" (Bold 24px, 흰색)
  ctx.font = 'bold 22px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 텍스트 글로우
  ctx.shadowColor = 'rgba(255, 60, 30, 0.8)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('⚔ 분쟁중', BADGE_W / 2, BADGE_H / 2);

  // 글로우 리셋
  ctx.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// ─── Shader ───

const vertexShader = /* glsl */ `
  attribute float alphaVal;
  varying vec2 vUv;
  varying float vAlpha;

  void main() {
    vUv = uv;
    vAlpha = alphaVal;

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D badge;
  uniform float uTime;
  varying vec2 vUv;
  varying float vAlpha;

  void main() {
    vec4 texColor = texture2D(badge, vUv);
    if (texColor.a < 0.05) discard;

    // 1.5Hz 펄스 (부드러운 밝기 변화)
    float pulse = 0.7 + 0.3 * sin(uTime * 9.42); // 2π * 1.5 ≈ 9.42

    // 가장자리 글로우 (UV 기반 거리)
    vec2 center = vec2(0.5, 0.5);
    float edgeDist = length(vUv - center);
    vec3 glow = vec3(1.0, 0.3, 0.1) * smoothstep(0.5, 0.0, edgeDist) * 0.3;

    vec3 color = texColor.rgb * pulse + glow;
    float alpha = texColor.a * vAlpha * pulse;

    gl_FragColor = vec4(color, alpha);
  }
`;

// ─── Component ───

export function GlobeConflictIndicators({
  countryCentroids,
  activeConflictCountries,
  globeRadius = 100,
}: GlobeConflictIndicatorsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const { camera } = useThree();

  // 배지 텍스처 (1회 생성)
  const badgeTexture = useMemo(() => createBadgeTexture(), []);

  // per-instance alpha 버퍼
  const alphaBuf = useMemo(() => new Float32Array(MAX_BADGES).fill(1), []);

  // Geometry + Material
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(WORLD_W, WORLD_H);
  }, []);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        badge: { value: badgeTexture },
        uTime: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [badgeTexture]);

  // 정리
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      badgeTexture.dispose();
    };
  }, [geometry, material, badgeTexture]);

  // centroid 캐시: iso3 → { normal, pos }
  const centroidCache = useMemo(() => {
    const cache = new Map<string, { normal: THREE.Vector3; pos: THREE.Vector3 }>();
    const r = globeRadius + BADGE_ALT;
    countryCentroids.forEach(([lat, lng], iso3) => {
      const pos = latLngToXYZ(lat, lng, r);
      const normal = pos.clone().normalize();
      cache.set(iso3, { normal, pos });
    });
    return cache;
  }, [countryCentroids, globeRadius]);

  // ─── useFrame: 위치 + billboard + 애니메이션 ───
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // 셰이더 시간 업데이트
    material.uniforms.uTime.value = clock.getElapsedTime();

    const camDist = camera.position.length();

    // 카메라 거리 초과 시 전부 숨김
    if (camDist > CAM_HIDE_DIST || activeConflictCountries.size === 0) {
      mesh.count = 0;
      return;
    }

    // 전체 페이드
    const zoomFade = 1 - THREE.MathUtils.clamp(
      (camDist - CAM_FADE_START) / (CAM_HIDE_DIST - CAM_FADE_START), 0, 1,
    );

    // lazy init: alpha 어트리뷰트
    if (!mesh.geometry.getAttribute('alphaVal')) {
      mesh.geometry.setAttribute('alphaVal',
        new THREE.InstancedBufferAttribute(alphaBuf, 1));
    }

    _camDir.copy(camera.position).normalize();

    let visibleIdx = 0;

    for (const iso3 of activeConflictCountries) {
      if (visibleIdx >= MAX_BADGES) break;

      const cached = centroidCache.get(iso3);
      if (!cached) continue;

      // 뒷면 오클루전
      const dot = cached.normal.dot(_camDir);
      if (dot < BACKFACE_THRESHOLD) continue;

      // Billboard 위치 — 국가 라벨 위에 배치
      _obj.position.copy(cached.pos);
      _obj.quaternion.copy(camera.quaternion);

      // 카메라-로컬 상향 오프셋 (국가 이름 텍스트 위로)
      _upVec.set(0, BADGE_UP_OFFSET, 0).applyQuaternion(camera.quaternion);
      _obj.position.add(_upVec);

      // 거리 기반 스케일
      const distT = THREE.MathUtils.clamp((camDist - 150) / 250, 0, 1);
      const distScale = THREE.MathUtils.lerp(2.0, 0.8, distT);

      // 뒷면 페이드
      const dotFade = THREE.MathUtils.clamp((dot - BACKFACE_THRESHOLD) / 0.3, 0, 1);

      const scale = distScale * dotFade;
      _obj.scale.set(scale, scale, 1);
      _obj.updateMatrix();
      mesh.setMatrixAt(visibleIdx, _obj.matrix);

      // alpha
      alphaBuf[visibleIdx] = dotFade * zoomFade;

      visibleIdx++;
    }

    mesh.count = visibleIdx;
    mesh.instanceMatrix.needsUpdate = true;

    const alphaAttr = mesh.geometry.getAttribute('alphaVal') as THREE.InstancedBufferAttribute;
    if (alphaAttr) alphaAttr.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_BADGES]}
      frustumCulled={false}
      renderOrder={110}
    />
  );
}
