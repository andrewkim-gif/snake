'use client';

/**
 * GlobeConflictIndicators — 3D 지구본 표면에 전투 아이콘 표시 (v17, v24 Phase 4 통일)
 *
 * 구현:
 *   - Gemini 생성 아이콘 텍스처 (conflict-icon-256.png) — 교차 검 + 폭발
 *   - 2-Layer InstancedMesh:
 *     Layer 1: 아이콘 (표면 부착, 천천히 회전)
 *     Layer 2: 글로우 링 (확장/수축 펄스)
 *   - 뒷면 오클루전 + 거리 기반 fade
 *   - v24: EFFECT_COLORS.war 색상, SURFACE_ALT.HIGH 고도, RENDER_ORDER 체계 적용
 *
 * 최적화: GPU 2 드로콜, ~100KB 메모리
 */

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToXYZ } from '@/lib/globe-utils';
import { SURFACE_ALT, RENDER_ORDER, EFFECT_COLORS } from '@/lib/effect-constants';

// ─── Constants ───

const MAX_ICONS = 50;

/** 아이콘 월드 크기 (정사각형) */
const ICON_SIZE = 5.0;

/** centroid 높이 오프셋 — v24: SURFACE_ALT.HIGH (+1.5) */
const CONFLICT_ALT = SURFACE_ALT.HIGH;

/** 글로우 링 크기 (아이콘보다 큼) */
const RING_SIZE = 10.0;

/** 뒷면 오클루전 임계값 */
const BACKFACE_THRESHOLD = 0.05;
/** 카메라 거리 범위 */
const CAM_HIDE_DIST = 400;
const CAM_FADE_START = 280;

// ─── Types ───

export interface GlobeConflictIndicatorsProps {
  countryCentroids: Map<string, [number, number]>;
  activeConflictCountries: Set<string>;
  globeRadius?: number;
}

// ─── 좌표 변환 ───
// latLngToXYZ → @/lib/globe-utils (v20 통합)

// ─── 재사용 임시 객체 ───

const _obj = new THREE.Object3D();
const _camDir = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _axis = new THREE.Vector3();

// ─── Icon Shader (표면 부착 + 회전 + 펄스) ───

const iconVertexShader = /* glsl */ `
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

const iconFragmentShader = /* glsl */ `
  uniform sampler2D uIcon;
  uniform float uTime;
  uniform vec3 uWarColor;
  varying vec2 vUv;
  varying float vAlpha;

  void main() {
    vec4 texColor = texture2D(uIcon, vUv);

    // 검은 배경을 투명으로 처리 (luminance threshold)
    float lum = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
    if (lum < 0.04) discard;

    // 1.2Hz 펄스 (레티클 느낌 — 안정적이지만 살짝 깜빡)
    float pulse = 0.85 + 0.15 * sin(uTime * 7.54);

    // v24: 전쟁 적색 통일 색상으로 틴팅
    vec3 boosted = texColor.rgb * uWarColor * 2.0;

    vec3 color = boosted * pulse;

    // 원형 마스크 (가장자리를 부드럽게)
    float dist = length(vUv - vec2(0.5));
    float circleMask = smoothstep(0.5, 0.42, dist);

    float alpha = vAlpha * circleMask * (pulse * 0.7 + 0.3);
    gl_FragColor = vec4(color, alpha);
  }
`;

// ─── Ring Shader (확장/수축 글로우 링) ───

const ringVertexShader = /* glsl */ `
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

const ringFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uWarColor;
  varying vec2 vUv;
  varying float vAlpha;

  void main() {
    vec2 center = vec2(0.5, 0.5);
    float dist = length(vUv - center) * 2.0; // 0~1 범위

    // 펄스 링: 중심에서 확장되는 동심원
    float ringPhase = fract(uTime * 0.5);   // 2초 주기 확장
    float ring1 = smoothstep(0.02, 0.0, abs(dist - ringPhase * 1.0)) * (1.0 - ringPhase);

    float ringPhase2 = fract(uTime * 0.5 + 0.5); // 1초 offset
    float ring2 = smoothstep(0.02, 0.0, abs(dist - ringPhase2 * 1.0)) * (1.0 - ringPhase2);

    float rings = ring1 + ring2;

    // 중심 글로우
    float centerGlow = smoothstep(0.4, 0.0, dist) * 0.3;

    // 외곽 페이드 (원 바깥 제거)
    float circleMask = smoothstep(1.0, 0.9, dist);

    // v24: 전쟁 적색 통일 색상 (EFFECT_COLORS.war 기반 그라데이션)
    vec3 color = mix(
      uWarColor * 0.8,        // 중심: 약간 어두운 전쟁색
      uWarColor * 1.2,        // 외곽: 밝은 전쟁색
      dist
    );

    float alpha = (rings * 0.8 + centerGlow) * circleMask * vAlpha;

    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color * 1.5, alpha);
  }
`;

// ─── Component ───

export function GlobeConflictIndicators({
  countryCentroids,
  activeConflictCountries,
  globeRadius = 100,
}: GlobeConflictIndicatorsProps) {
  // ★ ref callback으로 count=0 즉시 설정 (useEffect는 첫 렌더 후라 1프레임 지연)
  const iconMeshRef = useRef<THREE.InstancedMesh>(null!);
  const ringMeshRef = useRef<THREE.InstancedMesh>(null!);
  const iconRefCb = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (mesh) { mesh.count = 0; iconMeshRef.current = mesh; }
  }, []);
  const ringRefCb = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (mesh) { mesh.count = 0; ringMeshRef.current = mesh; }
  }, []);
  const { camera } = useThree();

  // Gemini 생성 아이콘 텍스처
  const iconTexture = useLoader(
    THREE.TextureLoader,
    '/assets/generated/conflict/tactical-reticle-256.png'
  );

  useEffect(() => {
    if (iconTexture) {
      iconTexture.minFilter = THREE.LinearFilter;
      iconTexture.magFilter = THREE.LinearFilter;
      iconTexture.colorSpace = THREE.SRGBColorSpace;
    }
  }, [iconTexture]);

  // per-instance alpha 버퍼 (아이콘 + 링 공유)
  const alphaBuf = useMemo(() => new Float32Array(MAX_ICONS).fill(1), []);

  // Geometry
  const iconGeo = useMemo(() => new THREE.PlaneGeometry(ICON_SIZE, ICON_SIZE), []);
  const ringGeo = useMemo(() => new THREE.PlaneGeometry(RING_SIZE, RING_SIZE), []);

  // v24: 전쟁 적색 기반 색상 (EFFECT_COLORS.war hex → normalized RGB)
  const warColorVec = useMemo(() => new THREE.Color(EFFECT_COLORS.war.hex), []);

  // Materials
  const iconMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uIcon: { value: iconTexture },
      uTime: { value: 0 },
      uWarColor: { value: warColorVec },
    },
    vertexShader: iconVertexShader,
    fragmentShader: iconFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [iconTexture, warColorVec]);

  const ringMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWarColor: { value: warColorVec },
    },
    vertexShader: ringVertexShader,
    fragmentShader: ringFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [warColorVec]);

  // 정리
  useEffect(() => {
    return () => {
      iconGeo.dispose();
      ringGeo.dispose();
      iconMat.dispose();
      ringMat.dispose();
    };
  }, [iconGeo, ringGeo, iconMat, ringMat]);

  // centroid 캐시
  const centroidCache = useMemo(() => {
    const cache = new Map<string, { normal: THREE.Vector3; pos: THREE.Vector3 }>();
    const r = globeRadius + CONFLICT_ALT;
    countryCentroids.forEach(([lat, lng], iso3) => {
      const pos = latLngToXYZ(lat, lng, r);
      const normal = pos.clone().normalize();
      cache.set(iso3, { normal, pos });
    });
    return cache;
  }, [countryCentroids, globeRadius]);

  // ─── useFrame ───
  useFrame(({ clock }) => {
    const iconMesh = iconMeshRef.current;
    const ringMesh = ringMeshRef.current;
    if (!iconMesh || !ringMesh) return;

    const t = clock.getElapsedTime();
    iconMat.uniforms.uTime.value = t;
    ringMat.uniforms.uTime.value = t;

    const camDist = camera.position.length();

    if (camDist > CAM_HIDE_DIST || activeConflictCountries.size === 0) {
      iconMesh.count = 0;
      ringMesh.count = 0;
      return;
    }

    const zoomFade = 1 - THREE.MathUtils.clamp(
      (camDist - CAM_FADE_START) / (CAM_HIDE_DIST - CAM_FADE_START), 0, 1,
    );

    // lazy init alpha attribute
    if (!iconMesh.geometry.getAttribute('alphaVal')) {
      iconMesh.geometry.setAttribute('alphaVal',
        new THREE.InstancedBufferAttribute(alphaBuf, 1));
    }
    if (!ringMesh.geometry.getAttribute('alphaVal')) {
      ringMesh.geometry.setAttribute('alphaVal',
        new THREE.InstancedBufferAttribute(new Float32Array(alphaBuf), 1));
    }

    _camDir.copy(camera.position).normalize();

    let idx = 0;

    for (const iso3 of activeConflictCountries) {
      if (idx >= MAX_ICONS) break;

      const cached = centroidCache.get(iso3);
      if (!cached) continue;

      // 뒷면 오클루전
      const dot = cached.normal.dot(_camDir);
      if (dot < BACKFACE_THRESHOLD) continue;

      // ─── 아이콘: 구체 표면에 부착 (법선 방향 lookAt) ───
      _obj.position.copy(cached.pos);

      // 법선 방향으로 lookAt (표면에 평행하게 놓임)
      _lookTarget.copy(cached.pos).add(cached.normal);
      _obj.lookAt(_lookTarget);

      // 법선 축 기준으로 천천히 회전 (개별 아이콘마다 다른 속도)
      const rotSpeed = 0.3 + (iso3.charCodeAt(0) % 10) * 0.05;
      _q.setFromAxisAngle(cached.normal, t * rotSpeed);
      _obj.quaternion.premultiply(_q);

      // 거리 기반 스케일
      const distT = THREE.MathUtils.clamp((camDist - 150) / 250, 0, 1);
      const distScale = THREE.MathUtils.lerp(1.5, 0.6, distT);
      const dotFade = THREE.MathUtils.clamp((dot - BACKFACE_THRESHOLD) / 0.3, 0, 1);
      const scale = distScale * dotFade;

      _obj.scale.set(scale, scale, 1);
      _obj.updateMatrix();
      iconMesh.setMatrixAt(idx, _obj.matrix);

      // ─── 글로우 링: 같은 위치, 약간 더 크게 ───
      // 링은 회전 없이 표면에 평행
      _obj.position.copy(cached.pos);
      _lookTarget.copy(cached.pos).add(cached.normal);
      _obj.lookAt(_lookTarget);

      // 링 스케일 펄스
      const ringPulse = 1.0 + 0.15 * Math.sin(t * 3.0);
      const ringScale = scale * ringPulse;
      _obj.scale.set(ringScale, ringScale, 1);
      _obj.updateMatrix();
      ringMesh.setMatrixAt(idx, _obj.matrix);

      // alpha
      alphaBuf[idx] = dotFade * zoomFade;

      idx++;
    }

    iconMesh.count = idx;
    ringMesh.count = idx;
    iconMesh.instanceMatrix.needsUpdate = true;
    ringMesh.instanceMatrix.needsUpdate = true;

    const iconAlpha = iconMesh.geometry.getAttribute('alphaVal') as THREE.InstancedBufferAttribute;
    if (iconAlpha) {
      iconAlpha.needsUpdate = true;
    }
    const ringAlpha = ringMesh.geometry.getAttribute('alphaVal') as THREE.InstancedBufferAttribute;
    if (ringAlpha) {
      // 링은 alpha를 공유하되 alpha 값 복사
      for (let i = 0; i < idx; i++) {
        (ringAlpha.array as Float32Array)[i] = alphaBuf[i] * 0.6; // 링은 좀 더 투명
      }
      ringAlpha.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* 글로우 링 (아이콘 뒤에 렌더) */}
      <instancedMesh
        ref={ringRefCb}
        args={[ringGeo, ringMat, MAX_ICONS]}
        frustumCulled={false}
        renderOrder={RENDER_ORDER.CONFLICT_RING}
      />
      {/* 전투 아이콘 */}
      <instancedMesh
        ref={iconRefCb}
        args={[iconGeo, iconMat, MAX_ICONS]}
        frustumCulled={false}
        renderOrder={RENDER_ORDER.CONFLICT_ICON}
      />
    </group>
  );
}
