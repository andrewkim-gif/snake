'use client';

/**
 * GlobeCountryNameLabels — Billboard country name labels with occlusion, screen-center fade, hover animation.
 * Extracted from GlobeView.tsx (Phase 0 modular refactor).
 */

import { useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

import { GLOBE_RADIUS, type CountryGeo } from '@/lib/globe-geo';
import { getArchetypeForISO3 } from '@/lib/landmark-data';
import { getArchetypeHeight } from '@/lib/landmark-geometries';
import { getHoveredIso3 } from '@/components/3d/GlobeInteractionLayer';

// ─── Constants ───

const LANDMARK_SURFACE_ALT = 2.5;
const LABEL_NAME_GAP = 1.0;

// 라벨 호버 색상 (모듈 레벨 -- GC 방지)
const _labelBaseCol = new THREE.Color('#E8E0D4');
const _labelHoverCol = new THREE.Color('#4DA6D9');
const HOVER_SCALE_MUL = 1.6;

// 화면 중앙 기반 라벨 페이드 상수
const LABEL_SCREEN_FULL = 0.3;
const LABEL_SCREEN_HIDE = 1.1;
const LABEL_CAM_HIDE = 450;
const LABEL_CAM_FADE = 320;

// 스크린 프로젝션용 임시 벡터 (모듈 레벨 -- GC 방지)
const _proj = new THREE.Vector3();

// ─── CountryLabels Component ───

export interface GlobeCountryNameLabelsProps {
  countries: CountryGeo[];
}

export function GlobeCountryNameLabels({ countries }: GlobeCountryNameLabelsProps) {
  const { camera } = useThree();
  const refs = useRef<(THREE.Group | null)[]>([]);
  const hoverProgress = useRef<Float32Array>(new Float32Array(0));

  // 랜드마크 꼭대기 높이에 맞춘 라벨 위치 계산
  const labelPositions = useMemo(() => {
    return countries.map((c) => {
      const archetype = getArchetypeForISO3(c.iso3);
      const landmarkH = getArchetypeHeight(archetype);
      const labelR = GLOBE_RADIUS + LANDMARK_SURFACE_ALT + landmarkH + LABEL_NAME_GAP;
      const dir = c.centroid.clone().normalize();
      return dir.multiplyScalar(labelR);
    });
  }, [countries]);

  // 각 라벨의 법선 벡터
  const normals = useMemo(
    () => countries.map((c) => c.centroid.clone().normalize()),
    [countries],
  );

  const _cam = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (hoverProgress.current.length !== countries.length) {
      hoverProgress.current = new Float32Array(countries.length);
    }

    const camDist = camera.position.length();

    const zoomFade = 1 - THREE.MathUtils.clamp(
      (camDist - LABEL_CAM_FADE) / (LABEL_CAM_HIDE - LABEL_CAM_FADE), 0, 1,
    );
    if (zoomFade <= 0) {
      refs.current.forEach((g) => { if (g) g.visible = false; });
      return;
    }

    const t = THREE.MathUtils.clamp((camDist - 150) / 350, 0, 1);
    const baseScale = THREE.MathUtils.lerp(1.1, 0.8, t);

    const hovIso = getHoveredIso3();
    _cam.copy(camera.position).normalize();
    refs.current.forEach((g, i) => {
      if (!g) return;
      const dot = normals[i].dot(_cam);

      g.visible = dot > 0.05;
      if (!g.visible) return;

      g.quaternion.copy(camera.quaternion);

      _proj.copy(labelPositions[i]).project(camera);
      const screenDist = Math.sqrt(_proj.x * _proj.x + _proj.y * _proj.y);
      const raw = 1 - THREE.MathUtils.clamp(
        (screenDist - LABEL_SCREEN_FULL) / (LABEL_SCREEN_HIDE - LABEL_SCREEN_FULL), 0, 1,
      );
      const centerFade = raw * raw * (3 - 2 * raw);

      const isHovered = hovIso === countries[i].iso3;
      const target = isHovered ? 1 : 0;
      hoverProgress.current[i] += (target - hoverProgress.current[i]) * 0.12;
      if (hoverProgress.current[i] < 0.01) hoverProgress.current[i] = 0;
      if (hoverProgress.current[i] > 0.99) hoverProgress.current[i] = 1;

      const p = hoverProgress.current[i];

      const scaleFade = 0.5 + 0.5 * centerFade;
      const hoverMul = 1 + (HOVER_SCALE_MUL - 1) * p;
      g.scale.setScalar(baseScale * scaleFade * hoverMul);

      const textMesh = g.children[0] as any;
      if (textMesh) {
        const alpha = Math.max(centerFade * zoomFade, p);
        textMesh.fillOpacity = alpha;
        textMesh.outlineOpacity = alpha;
        if (textMesh.material?.color) {
          textMesh.material.color.lerpColors(_labelBaseCol, _labelHoverCol, p);
        }
      }
    });
  });

  return (
    <>
      {countries.map((c, i) => (
        <group
          key={c.iso3}
          position={labelPositions[i]}
          ref={(el) => { refs.current[i] = el; }}
        >
          <Text
            fontSize={1.5}
            color="#E8E0D4"
            anchorX="center"
            anchorY="top"
            outlineWidth={0.1}
            outlineColor="#111111"
            letterSpacing={0.06}
            fontWeight={700}
          >
            {c.name.toUpperCase()}
          </Text>
        </group>
      ))}
    </>
  );
}
