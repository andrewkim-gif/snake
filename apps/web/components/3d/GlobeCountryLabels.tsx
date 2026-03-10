'use client';

/**
 * GlobeCountryLabels — 글로브 위 국기 + 에이전트 수 라벨 (v15 Phase 2)
 *
 * 책임: 각 국가 centroid에 점유국 국기 + "12/50" 에이전트 수를 통합 표시
 * - 이 컴포넌트가 글로브 위 국기 표시의 유일한 책임
 * - GlobeDominationLayer는 색상 오버레이만 담당
 *
 * 구현:
 *   - 통합 CanvasTexture 아틀라스: 국기(flagAtlas) + 텍스트("12/50", 국명)를 per-country 행에 합성
 *   - InstancedMesh Billboard: 195 instances, ShaderMaterial (인스턴스별 UV + opacity)
 *   - LOD: 근거리(국기+숫자+국명), 중거리(국기+숫자), 원거리(숫자만)
 *   - 뒷면 오클루전: centroid normal · camDir < 0.05 → 숨김
 *
 * 디자인: 다크/글로우 | Ethnocentric(display), ITC Avant Garde Gothic(body)
 */

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToXYZ } from '@/lib/globe-utils';
import { getCountryByISO3 } from '@/lib/country-data';
import { getArchetypeForISO3 } from '@/lib/landmark-data';
import { getArchetypeHeight } from '@/lib/landmark-geometries';
import type { FlagAtlasResult } from '@/lib/flag-atlas';
import type { CountryClientState } from '@/lib/globe-data';
import type { CountryDominationState } from '@/components/3d/GlobeDominationLayer';
import { useSharedTick } from '@/components/lobby/GlobeView';

// ─── Constants ───

const MAX_COUNTRIES = 200; // 195 + buffer
/** 라벨 아틀라스: 각 국가 = 1행 (LABEL_W x LABEL_H) — 국기+에이전트 보조 정보 */
const LABEL_W = 480;
const LABEL_H = 48;
const LABEL_ATLAS_W = LABEL_W;
const LABEL_ATLAS_H = LABEL_H * MAX_COUNTRIES;

/** 라벨 Billboard 월드 크기 */
const LABEL_WORLD_W = 7.5;
const LABEL_WORLD_H = LABEL_WORLD_W * (LABEL_H / LABEL_W);

/** LOD 거리 임계값 (카메라 거리) */
const LOD_CLOSE = 200;   // < 200: 국기 + 숫자 + 국명
const LOD_MID = 350;     // 200~350: 국기 + 숫자
// > 350: 숫자만

/** 뒷면 오클루전 임계값 */
const BACKFACE_THRESHOLD = 0.05;
/** 카메라 거리 최대 (라벨 숨김) */
const CAM_HIDE_DIST = 500;
const CAM_FADE_START = 320;

/** 원거리에서 상위 N개국만 표시 */
const FAR_TOP_N = 60;

/** 랜드마크 메시의 구면 위 기준 높이 (LandmarkMeshes.SURFACE_ALT) */
const LANDMARK_SURFACE_ALT = 2.5;
/** 국기+참여인원: 국가 이름과 같은 depth, 카메라 로컬 Y로 텍스트 위에 배치 */
const LABEL_TOP_GAP = 1.0;
/** 카메라 로컬 up 방향으로의 오프셋 (텍스트 위에 국기 배치) */
const LABEL_UP_OFFSET = 1.8;

/** 글로우 색상 */
const GLOW_CYAN = '#00E5FF';
const GLOW_GOLD = '#FFD700';
const TEXT_COLOR = '#E0E0E0';
const BG_COLOR = 'rgba(8, 10, 20, 0.75)';
const BORDER_COLOR = 'rgba(0, 229, 255, 0.25)';
// ─── Types ───

export interface GlobeCountryLabelsProps {
  /** iso3 → [lat, lng] centroid 좌표 맵 */
  countryCentroids: Map<string, [number, number]>;
  /** iso3 → CountryClientState (activeAgents, maxAgents 포함) */
  countryStates: Map<string, CountryClientState>;
  /** iso3 → CountryDominationState (점유국 정보) */
  dominationStates: Map<string, CountryDominationState>;
  /** FlagAtlasLoader 결과 (국기 텍스처 + UV 매핑) */
  flagAtlas: FlagAtlasResult;
  /** 글로브 반경 (기본 100) */
  globeRadius?: number;
  /** v15 Phase 6: 모바일 LOD — 최대 표시 라벨 수 (기본 200) */
  maxLabels?: number;
}

/** 내부 국가 라벨 데이터 */
interface LabelEntry {
  iso3: string;
  iso2: string;
  name: string;
  centroidNormal: THREE.Vector3; // 정규화된 centroid 방향
  centroidPos: THREE.Vector3;    // 구면 위 3D 좌표
}

// ─── 좌표 변환 ───
// latLngToXYZ → @/lib/globe-utils (v20 통합)

// ─── 재사용 임시 객체 (GC 방지) ───

const _obj = new THREE.Object3D();
const _camDir = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _camUp = new THREE.Vector3();
// ─── Shader ───

const vertexShader = /* glsl */ `
  attribute float rowIndex;
  attribute float alphaVal;
  varying vec2 vUv;
  varying float vAlpha;
  uniform float totalRows;

  void main() {
    // UV: flipY=true(기본값) → canvas y=0(상단)이 UV y=1.0에 매핑
    // canvas row i = y [i*H .. (i+1)*H] → UV y [1-(i+1)/N .. 1-i/N]
    float rowStart = 1.0 - (rowIndex + 1.0) / totalRows;
    float rowEnd   = 1.0 - rowIndex / totalRows;
    vUv = vec2(uv.x, mix(rowStart, rowEnd, uv.y));
    vAlpha = alphaVal;

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D atlas;
  varying vec2 vUv;
  varying float vAlpha;

  void main() {
    vec4 texColor = texture2D(atlas, vUv);
    if (texColor.a < 0.05) discard;
    texColor.a *= vAlpha;
    gl_FragColor = texColor;
  }
`;
// ─── Component ───

export function GlobeCountryLabels({
  countryCentroids,
  countryStates,
  dominationStates,
  flagAtlas,
  globeRadius = 100,
  maxLabels = MAX_COUNTRIES,
}: GlobeCountryLabelsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const meshRefCb = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (mesh) { mesh.count = 0; meshRef.current = mesh; }
  }, []);
  const { camera } = useThree();
  // v33 perf: SharedTickData에서 cameraDist, cameraDir 참조 (중복 length()/normalize() 제거)
  const sharedTickRef = useSharedTick();
  const prevLodRef = useRef(0);

  // 라벨 엔트리 빌드 (centroid가 변경될 때만)
  // 각 국가의 랜드마크 높이에 맞춰 라벨을 꼭대기에 배치
  const entries = useMemo<LabelEntry[]>(() => {
    const result: LabelEntry[] = [];

    countryCentroids.forEach(([lat, lng], iso3) => {
      const country = getCountryByISO3(iso3);
      if (!country) return;

      // 랜드마크 꼭대기 바로 위 — getArchetypeHeight는 이미 LANDMARK_SCALE 포함
      const archetype = getArchetypeForISO3(iso3);
      const landmarkH = getArchetypeHeight(archetype);
      const labelR = globeRadius + LANDMARK_SURFACE_ALT + landmarkH + LABEL_TOP_GAP;

      const pos = latLngToXYZ(lat, lng, labelR);
      const normal = pos.clone().normalize();

      result.push({
        iso3,
        iso2: country.iso2,
        name: country.name,
        centroidNormal: normal,
        centroidPos: pos,
      });
    });

    return result;
  }, [countryCentroids, globeRadius]);

  // 라벨 아틀라스 캔버스 + 텍스처
  const { labelCanvas, labelTexture, labelCtx } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = LABEL_ATLAS_W;
    c.height = LABEL_ATLAS_H;
    const context = c.getContext('2d')!;
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { labelCanvas: c, labelTexture: tex, labelCtx: context };
  }, []);

  // per-instance 어트리뷰트 버퍼
  const rowIndexBuf = useMemo(() => new Float32Array(MAX_COUNTRIES), []);
  const alphaBuf = useMemo(() => new Float32Array(MAX_COUNTRIES).fill(1), []);

  // 이전 라벨 키 캐시 (변경 감지)
  const prevKeysRef = useRef<string[]>(new Array(MAX_COUNTRIES).fill(''));

  // Geometry + Material
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(LABEL_WORLD_W, LABEL_WORLD_H);
  }, []);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        atlas: { value: labelTexture },
        totalRows: { value: MAX_COUNTRIES },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [labelTexture]);

  // 정리
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      labelTexture.dispose();
    };
  }, [geometry, material, labelTexture]);

  // ─── 국기 그리기 헬퍼 ───
  const drawFlag = useCallback((
    ctx: CanvasRenderingContext2D,
    iso2: string,
    x: number, y: number,
    w: number, h: number,
  ) => {
    const uv = flagAtlas.getUV(iso2);
    if (uv[2] <= 0 || uv[3] <= 0) return;
    const flagCanvas = flagAtlas.texture.image as HTMLCanvasElement;
    if (!flagCanvas) return;
    const srcX = uv[0] * flagCanvas.width;
    const srcY = (1 - uv[1] - uv[3]) * flagCanvas.height;
    const srcW = uv[2] * flagCanvas.width;
    const srcH = uv[3] * flagCanvas.height;
    ctx.drawImage(flagCanvas, srcX, srcY, srcW, srcH, x, y, w, h);
  }, [flagAtlas]);

  // ─── 에이전트 비율 색상 ───
  const agentColor = (active: number, max: number) => {
    const r = max > 0 ? active / max : 0;
    return r >= 1 ? '#FF4444' : r >= 0.6 ? GLOW_GOLD : GLOW_CYAN;
  };

  // ─── 라벨 행 렌더링 함수 (국가 이름은 CountryLabels가 담당, 여기는 보조 정보만) ───
  const drawLabelRow = useCallback((
    rowIdx: number,
    entry: LabelEntry,
    activeAgents: number,
    maxAgents: number,
    dominantNationIso2: string | null,
    dominantNationName: string | null,
    lodLevel: number, // 0=close, 1=mid, 2=far
  ) => {
    const yStart = rowIdx * LABEL_H;
    const ctx = labelCtx;
    ctx.clearRect(0, yStart, LABEL_W, LABEL_H);

    const FONT = '"ITC Avant Garde Gothic", "Century Gothic", "Avenir", sans-serif';
    const hPad = 12;
    const centerY = yStart + LABEL_H / 2;

    // 에이전트 텍스트: maxAgents가 있으면 "12/50", 없으면 "12"
    const countText = maxAgents > 0 ? `${activeAgents}/${maxAgents}` : `${activeAgents}`;

    if (lodLevel === 0) {
      // ═══ LOD 0 (close): 자국 국기 + 에이전트 수 + 점령국 정보 ═══
      const flagH = 26;
      const flagW = Math.round(flagH * 1.33);

      // 측정: 전체 컨텐츠 너비
      ctx.font = `bold 20px ${FONT}`;
      let totalW = flagW + 8 + ctx.measureText(countText).width;

      // 점령국 표시 너비
      let domText = '';
      if (dominantNationIso2 && dominantNationName) {
        domText = dominantNationName.length > 8
          ? dominantNationName.slice(0, 7) + '..'
          : dominantNationName;
        ctx.font = `11px ${FONT}`;
        totalW += 10 + 18 + 4 + ctx.measureText(domText).width;
      }

      // 배경 (컨텐츠 너비에 맞춤, 중앙 정렬)
      const bgW = totalW + hPad * 2;
      const bgX = (LABEL_W - bgW) / 2;
      ctx.fillStyle = BG_COLOR;
      ctx.beginPath();
      ctx.roundRect(bgX, yStart + 4, bgW, LABEL_H - 8, 6);
      ctx.fill();
      ctx.strokeStyle = BORDER_COLOR;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 그리기 시작점
      let drawX = (LABEL_W - totalW) / 2;

      // 자국 국기
      drawFlag(ctx, entry.iso2, drawX, centerY - flagH / 2, flagW, flagH);
      drawX += flagW + 8;

      // 에이전트 수 (activeAgents/maxAgents)
      ctx.font = `bold 20px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = agentColor(activeAgents, maxAgents);
      ctx.fillText(countText, drawX, centerY);
      drawX += ctx.measureText(countText).width;

      // 점령국 표시 (국기 + 이름, 골드)
      if (dominantNationIso2 && domText) {
        drawX += 10;
        drawFlag(ctx, dominantNationIso2, drawX, centerY - 8, 18, 13);
        drawX += 22;
        ctx.font = `11px ${FONT}`;
        ctx.fillStyle = GLOW_GOLD;
        ctx.fillText(domText, drawX, centerY);
      }

    } else if (lodLevel === 1) {
      // ═══ LOD 1 (mid): 자국 국기 + 에이전트 수 ═══
      const flagH = 20;
      const flagW = Math.round(flagH * 1.33);
      ctx.font = `bold 18px ${FONT}`;
      const totalW = flagW + 6 + ctx.measureText(countText).width;
      const bgW = totalW + hPad * 2;
      const bgX = (LABEL_W - bgW) / 2;

      ctx.fillStyle = BG_COLOR;
      ctx.beginPath();
      ctx.roundRect(bgX, yStart + 6, bgW, LABEL_H - 12, 5);
      ctx.fill();
      ctx.strokeStyle = BORDER_COLOR;
      ctx.lineWidth = 1;
      ctx.stroke();

      const drawX = (LABEL_W - totalW) / 2;
      drawFlag(ctx, entry.iso2, drawX, centerY - flagH / 2, flagW, flagH);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = agentColor(activeAgents, maxAgents);
      ctx.fillText(countText, drawX + flagW + 6, centerY);

    } else {
      // ═══ LOD 2 (far): 에이전트 수만 ═══
      ctx.font = `bold 16px ${FONT}`;
      const totalW = ctx.measureText(countText).width;
      const bgW = totalW + hPad * 2;
      const bgX = (LABEL_W - bgW) / 2;

      ctx.fillStyle = BG_COLOR;
      ctx.beginPath();
      ctx.roundRect(bgX, yStart + 8, bgW, LABEL_H - 16, 4);
      ctx.fill();
      ctx.strokeStyle = BORDER_COLOR;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = agentColor(activeAgents, maxAgents);
      ctx.fillText(countText, LABEL_W / 2, centerY);
    }
  }, [labelCtx, flagAtlas, drawFlag]);

  // ─── useFrame: 위치 + billboard + LOD + 텍스처 업데이트 ───
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || entries.length === 0) return;

    // v33 perf: SharedTickData에서 cameraDist 읽기 (Math.sqrt 제거)
    const camDist = sharedTickRef.current.cameraDist;

    // 카메라 거리 초과 시 전부 숨김
    if (camDist > CAM_HIDE_DIST) {
      mesh.count = 0;
      return;
    }

    // 전체 페이드
    const zoomFade = 1 - THREE.MathUtils.clamp(
      (camDist - CAM_FADE_START) / (CAM_HIDE_DIST - CAM_FADE_START), 0, 1,
    );

    // LOD 레벨 결정 (±20 히스테리시스 밴드로 전환 플리커 방지)
    const HYST = 20;
    const prev = prevLodRef.current;
    let lodLevel: number;
    if (prev === 0) {
      lodLevel = camDist > LOD_CLOSE + HYST ? (camDist > LOD_MID + HYST ? 2 : 1) : 0;
    } else if (prev === 1) {
      lodLevel = camDist < LOD_CLOSE - HYST ? 0 : (camDist > LOD_MID + HYST ? 2 : 1);
    } else {
      lodLevel = camDist < LOD_MID - HYST ? (camDist < LOD_CLOSE - HYST ? 0 : 1) : 2;
    }
    prevLodRef.current = lodLevel;

    // lazy init: rowIndex + alpha 어트리뷰트
    if (!mesh.geometry.getAttribute('rowIndex')) {
      mesh.geometry.setAttribute('rowIndex',
        new THREE.InstancedBufferAttribute(rowIndexBuf, 1));
      mesh.geometry.setAttribute('alphaVal',
        new THREE.InstancedBufferAttribute(alphaBuf, 1));
    }

    // v33 perf: SharedTickData에서 cameraDir 읽기 (normalize() 제거)
    const _camDir = sharedTickRef.current.cameraDir;
    const prevKeys = prevKeysRef.current;

    let needsTextureUpdate = false;
    let visibleIdx = 0;

    // 원거리: activeAgents 기준 상위 N개만 (정렬은 비용이 커서 단순 필터)
    const isFarLOD = lodLevel === 2;

    // v15 Phase 6: LOD 제한 — maxLabels와 MAX_COUNTRIES 중 작은 값 사용
    const labelLimit = Math.min(maxLabels, MAX_COUNTRIES);

    for (let i = 0; i < entries.length; i++) {
      if (visibleIdx >= labelLimit) break;

      const entry = entries[i];

      // 뒷면 오클루전
      const dot = entry.centroidNormal.dot(_camDir);
      if (dot < BACKFACE_THRESHOLD) continue;

      // 국가 상태
      const state = countryStates.get(entry.iso3);
      const activeAgents = state?.activeAgents ?? 0;
      const maxAgents = state?.maxAgents ?? 0;

      // 원거리: 에이전트 없으면 스킵
      if (isFarLOD && activeAgents === 0 && visibleIdx >= FAR_TOP_N) continue;

      // 점유국 정보
      const domState = dominationStates.get(entry.iso3);
      let dominantIso2: string | null = null;
      let dominantName: string | null = null;
      if (domState?.dominantNation) {
        const domCountry = getCountryByISO3(domState.dominantNation);
        dominantIso2 = domCountry?.iso2 ?? null;
        dominantName = domCountry?.name ?? null;
      }

      // 캐시 키: stable entry index i 사용 → 카메라 이동 시 국기 플리커 방지
      const key = `${lodLevel}|${activeAgents}/${maxAgents}|${dominantIso2 ?? ''}|${dominantName ?? ''}`;
      if (prevKeys[i] !== key) {
        drawLabelRow(i, entry, activeAgents, maxAgents, dominantIso2, dominantName, lodLevel);
        prevKeys[i] = key;
        needsTextureUpdate = true;
      }

      // rowIndex 어트리뷰트 — stable entry index로 아틀라스 행 매핑
      rowIndexBuf[visibleIdx] = i;

      // Billboard 위치 — 국가 이름과 같은 depth, 카메라 로컬 Y로 위에 배치
      _camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
      _obj.position.copy(entry.centroidPos).addScaledVector(_camUp, LABEL_UP_OFFSET);
      _obj.quaternion.copy(camera.quaternion);

      // 거리 기반 스케일: 가까울수록 크게 (150→2.8x, 500→1.2x) — 2배 크기 + 거리 감쇠
      const distT = THREE.MathUtils.clamp((camDist - 150) / 350, 0, 1);
      const distScale = THREE.MathUtils.lerp(2.8, 1.2, distT);

      // 뒷면 오클루전 페이드
      const dotFade = THREE.MathUtils.clamp((dot - BACKFACE_THRESHOLD) / 0.3, 0, 1);

      // 화면 중심 페이드: NDC 좌표 기반 smoothstep (중앙=1, 가장자리=0.3)
      _projVec.copy(entry.centroidPos).project(camera);
      const screenDist = Math.sqrt(_projVec.x * _projVec.x + _projVec.y * _projVec.y);
      const centerRaw = 1 - THREE.MathUtils.clamp((screenDist - 0.3) / 0.8, 0, 1);
      const centerFade = centerRaw * centerRaw * (3 - 2 * centerRaw);

      // 최종 스케일: 거리 × 뒷면 페이드 × 중심 가중치 (0.7~1.0)
      const scaleCenterMul = 0.7 + 0.3 * centerFade;
      const scale = distScale * dotFade * scaleCenterMul;
      _obj.scale.set(scale, scale, 1);
      _obj.updateMatrix();
      mesh.setMatrixAt(visibleIdx, _obj.matrix);

      // alpha: 뒷면 × 줌 × 중심 페이드 (가장자리 40% 최소)
      alphaBuf[visibleIdx] = dotFade * zoomFade * (0.4 + 0.6 * centerFade);

      visibleIdx++;
    }

    // stable index 사용: prevKeys는 entry index 기반이므로 별도 초기화 불필요

    mesh.count = visibleIdx;
    mesh.instanceMatrix.needsUpdate = true;

    // 어트리뷰트 업데이트
    const rowAttr = mesh.geometry.getAttribute('rowIndex') as THREE.InstancedBufferAttribute;
    const alphaAttr = mesh.geometry.getAttribute('alphaVal') as THREE.InstancedBufferAttribute;
    if (rowAttr) rowAttr.needsUpdate = true;
    if (alphaAttr) alphaAttr.needsUpdate = true;

    if (needsTextureUpdate) {
      labelTexture.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRefCb}
      args={[geometry, material, MAX_COUNTRIES]}
      frustumCulled={false}
      renderOrder={100}
    />
  );
}
