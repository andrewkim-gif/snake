'use client';

/**
 * GlobeCountryNameLabels — Billboard country name labels with occlusion, screen-center fade, hover animation.
 * Extracted from GlobeView.tsx (Phase 0 modular refactor).
 *
 * v33 Phase 3 optimizations:
 * - SharedTickRef에서 cameraDist/cameraDir 읽기 → 중복 계산 제거
 * - dirty flag: 카메라 이동량 < 임계값 + 호버 변화 없으면 라벨 업데이트 스킵
 * - 뒷면 라벨 early exit 강화 (dot 체크 후 즉시 다음으로)
 */

import { useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

import { GLOBE_RADIUS, type CountryGeo } from '@/lib/globe-geo';
import { getArchetypeForISO3 } from '@/lib/landmark-data';
import { getArchetypeHeight } from '@/lib/landmark-geometries';
import { getHoveredIso3 } from '@/components/3d/GlobeInteractionLayer';
import type { SharedTickData } from '@/components/lobby/GlobeView';

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

// v33 Phase 3: dirty flag 임계값 (카메라 이동량)
const CAMERA_MOVE_THRESHOLD = 0.0005;

// ─── CountryLabels Component ───

export interface GlobeCountryNameLabelsProps {
  countries: CountryGeo[];
  sharedTickRef: React.RefObject<SharedTickData>;
}

export function GlobeCountryNameLabels({ countries, sharedTickRef }: GlobeCountryNameLabelsProps) {
  const { camera } = useThree();
  const refs = useRef<(THREE.Group | null)[]>([]);
  const hoverProgress = useRef<Float32Array>(new Float32Array(0));

  // v33 Phase 3: dirty flag — 이전 카메라 방향 저장
  const prevCamDirRef = useRef(new THREE.Vector3(0, 0, 1));
  const prevHovIsoRef = useRef<string | null>(null);
  // 프레임 건너뛰기 카운터 (dirty가 아닐 때 N프레임마다만 업데이트)
  const skipCountRef = useRef(0);

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

  useFrame(() => {
    if (hoverProgress.current.length !== countries.length) {
      hoverProgress.current = new Float32Array(countries.length);
    }

    // v33 Phase 3: SharedTickRef에서 cameraDist/cameraDir 읽기
    const tick = sharedTickRef.current;
    const camDist = tick.cameraDist;
    const camDir = tick.cameraDir;

    const zoomFade = 1 - THREE.MathUtils.clamp(
      (camDist - LABEL_CAM_FADE) / (LABEL_CAM_HIDE - LABEL_CAM_FADE), 0, 1,
    );
    if (zoomFade <= 0) {
      refs.current.forEach((g) => { if (g) g.visible = false; });
      return;
    }

    // v33 Phase 3: dirty flag — 카메라 이동량 + 호버 변화 체크
    const hovIso = getHoveredIso3();
    const camDelta = prevCamDirRef.current.distanceToSquared(camDir);
    const hoverChanged = hovIso !== prevHovIsoRef.current;

    // 호버 애니메이션 진행 중인지 확인 (어떤 라벨이든 0 < p < 1이면 아직 진행 중)
    let hoverAnimating = false;
    for (let i = 0; i < hoverProgress.current.length; i++) {
      const p = hoverProgress.current[i];
      if (p > 0.01 && p < 0.99) { hoverAnimating = true; break; }
    }

    const isDirty = camDelta > CAMERA_MOVE_THRESHOLD || hoverChanged || hoverAnimating;

    if (!isDirty) {
      // 변화 없으면 3프레임에 1번만 업데이트 (60fps→20fps 라벨 갱신)
      skipCountRef.current++;
      if (skipCountRef.current < 3) return;
    }
    skipCountRef.current = 0;
    prevCamDirRef.current.copy(camDir);
    prevHovIsoRef.current = hovIso;

    const t = THREE.MathUtils.clamp((camDist - 150) / 350, 0, 1);
    const baseScale = THREE.MathUtils.lerp(1.1, 0.8, t);

    refs.current.forEach((g, i) => {
      if (!g) return;

      // v33 Phase 3: 뒷면 라벨 — dot 체크 후 즉시 숨김 (이후 계산 스킵)
      const dot = normals[i].dot(camDir);
      if (dot <= 0.05) {
        if (g.visible) g.visible = false;
        // 호버 진행률도 감쇠 (뒷면으로 넘어간 호버 라벨 정리)
        if (hoverProgress.current[i] > 0) {
          hoverProgress.current[i] *= 0.85;
          if (hoverProgress.current[i] < 0.01) hoverProgress.current[i] = 0;
        }
        return;
      }

      g.visible = true;
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
