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
import { getCountryByISO3 } from '@/lib/country-data';
import type { FlagAtlasResult } from '@/lib/flag-atlas';
import type { CountryClientState } from '@/lib/globe-data';
import type { CountryDominationState } from '@/components/3d/GlobeDominationLayer';

// ─── Constants ───

const MAX_COUNTRIES = 200; // 195 + buffer
/** 라벨 아틀라스: 각 국가 = 1행 (LABEL_W x LABEL_H) */
const LABEL_W = 320;
const LABEL_H = 48;
const LABEL_ATLAS_W = LABEL_W;
const LABEL_ATLAS_H = LABEL_H * MAX_COUNTRIES;

/** 라벨 Billboard 월드 크기 */
const LABEL_WORLD_W = 5.0;
const LABEL_WORLD_H = LABEL_WORLD_W * (LABEL_H / LABEL_W);

/** LOD 거리 임계값 (카메라 거리) */
const LOD_CLOSE = 200;   // < 200: 국기 + 숫자 + 국명
const LOD_MID = 350;     // 200~350: 국기 + 숫자
// > 350: 숫자만

/** 뒷면 오클루전 임계값 */
const BACKFACE_THRESHOLD = 0.05;
/** 카메라 거리 최대 (라벨 숨김) */
const CAM_HIDE_DIST = 500;
const CAM_FADE_START = 400;

/** 원거리에서 상위 N개국만 표시 */
const FAR_TOP_N = 60;

/** centroid 높이 오프셋 (구체 표면 위) */
const LABEL_ALT = 3.5;

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

function latLngToXYZ(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

// ─── 재사용 임시 객체 (GC 방지) ───

const _obj = new THREE.Object3D();
const _camDir = new THREE.Vector3();
// ─── Shader ───

const vertexShader = /* glsl */ `
  attribute float rowIndex;
  attribute float alphaVal;
  varying vec2 vUv;
  varying float vAlpha;
  uniform float totalRows;

  void main() {
    // UV: x는 0..1, y는 rowIndex/totalRows..(rowIndex+1)/totalRows
    float rowStart = rowIndex / totalRows;
    float rowEnd = (rowIndex + 1.0) / totalRows;
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
}: GlobeCountryLabelsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const { camera } = useThree();

  // 라벨 엔트리 빌드 (centroid가 변경될 때만)
  const entries = useMemo<LabelEntry[]>(() => {
    const result: LabelEntry[] = [];
    const labelR = globeRadius + LABEL_ALT;

    countryCentroids.forEach(([lat, lng], iso3) => {
      const country = getCountryByISO3(iso3);
      if (!country) return;

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

  // ─── 라벨 행 렌더링 함수 ───
  const drawLabelRow = useCallback((
    rowIdx: number,
    entry: LabelEntry,
    activeAgents: number,
    maxAgents: number,
    dominantNationIso2: string | null,
    lodLevel: number, // 0=close, 1=mid, 2=far
  ) => {
    const yStart = rowIdx * LABEL_H;
    const ctx = labelCtx;

    // 행 클리어
    ctx.clearRect(0, yStart, LABEL_W, LABEL_H);

    // 배경: 다크 반투명 + 글로우 보더
    ctx.fillStyle = BG_COLOR;
    const pad = 1;
    const rx = 6;
    ctx.beginPath();
    ctx.roundRect(pad, yStart + pad, LABEL_W - pad * 2, LABEL_H - pad * 2, rx);
    ctx.fill();

    // 글로우 보더
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();

    let textX = 6;
    const centerY = yStart + LABEL_H / 2;

    // LOD 0, 1: 국기 표시
    if (lodLevel <= 1) {
      const flagIso2 = dominantNationIso2 || entry.iso2;
      const uv = flagAtlas.getUV(flagIso2);

      if (uv[2] > 0 && uv[3] > 0) {
        // flagAtlas에서 해당 국기 영역을 잘라 그리기
        const flagCanvas = flagAtlas.texture.image as HTMLCanvasElement;
        if (flagCanvas) {
          const srcX = uv[0] * flagCanvas.width;
          // Three.js UV v는 하단 기준이므로 캔버스 좌표로 변환
          const srcY = (1 - uv[1] - uv[3]) * flagCanvas.height;
          const srcW = uv[2] * flagCanvas.width;
          const srcH = uv[3] * flagCanvas.height;

          const flagSize = 28;
          const flagY = centerY - flagSize / 2;
          ctx.drawImage(flagCanvas, srcX, srcY, srcW, srcH, textX, flagY, flagSize * 1.33, flagSize);
          textX += flagSize * 1.33 + 5;
        }
      }
    }

    // 에이전트 수 텍스트
    const countText = `${activeAgents}/${maxAgents}`;
    ctx.font = 'bold 16px "ITC Avant Garde Gothic", "Century Gothic", "Avenir", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // 에이전트 수 색상: 가득 차면 레드, 반 이상이면 골드, 아니면 사이안
    const ratio = maxAgents > 0 ? activeAgents / maxAgents : 0;
    if (ratio >= 1) {
      ctx.fillStyle = '#FF4444';
    } else if (ratio >= 0.6) {
      ctx.fillStyle = GLOW_GOLD;
    } else {
      ctx.fillStyle = GLOW_CYAN;
    }
    ctx.fillText(countText, textX, centerY + 1);
    textX += ctx.measureText(countText).width + 6;

    // LOD 0: 국명 추가
    if (lodLevel === 0 && textX < LABEL_W - 20) {
      const displayName = entry.name.length > 16 ? entry.name.slice(0, 15) + '..' : entry.name;
      ctx.font = '12px "ITC Avant Garde Gothic", "Century Gothic", "Avenir", sans-serif';
      ctx.fillStyle = TEXT_COLOR;
      ctx.globalAlpha = 0.7;
      ctx.fillText(displayName, textX, centerY + 1);
      ctx.globalAlpha = 1.0;
    }
  }, [labelCtx, flagAtlas]);

  // ─── useFrame: 위치 + billboard + LOD + 텍스처 업데이트 ───
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || entries.length === 0) return;

    const camDist = camera.position.length();

    // 카메라 거리 초과 시 전부 숨김
    if (camDist > CAM_HIDE_DIST) {
      mesh.count = 0;
      return;
    }

    // 전체 페이드
    const zoomFade = 1 - THREE.MathUtils.clamp(
      (camDist - CAM_FADE_START) / (CAM_HIDE_DIST - CAM_FADE_START), 0, 1,
    );

    // LOD 레벨 결정
    const lodLevel = camDist < LOD_CLOSE ? 0 : camDist < LOD_MID ? 1 : 2;

    // lazy init: rowIndex + alpha 어트리뷰트
    if (!mesh.geometry.getAttribute('rowIndex')) {
      mesh.geometry.setAttribute('rowIndex',
        new THREE.InstancedBufferAttribute(rowIndexBuf, 1));
      mesh.geometry.setAttribute('alphaVal',
        new THREE.InstancedBufferAttribute(alphaBuf, 1));
    }

    _camDir.copy(camera.position).normalize();
    const prevKeys = prevKeysRef.current;

    let needsTextureUpdate = false;
    let visibleIdx = 0;

    // 원거리: activeAgents 기준 상위 N개만 (정렬은 비용이 커서 단순 필터)
    const isFarLOD = lodLevel === 2;

    for (let i = 0; i < entries.length; i++) {
      if (visibleIdx >= MAX_COUNTRIES) break;

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
      if (domState?.dominantNation) {
        const domCountry = getCountryByISO3(domState.dominantNation);
        dominantIso2 = domCountry?.iso2 ?? null;
      }

      // 캐시 키: LOD + 에이전트수 + 점유국 변경 시에만 재렌더
      const key = `${lodLevel}|${activeAgents}/${maxAgents}|${dominantIso2 ?? entry.iso2}`;
      if (prevKeys[visibleIdx] !== key) {
        drawLabelRow(visibleIdx, entry, activeAgents, maxAgents, dominantIso2, lodLevel);
        prevKeys[visibleIdx] = key;
        needsTextureUpdate = true;
      }

      // rowIndex 어트리뷰트
      rowIndexBuf[visibleIdx] = visibleIdx;

      // Billboard 위치
      _obj.position.copy(entry.centroidPos);
      _obj.quaternion.copy(camera.quaternion);

      // 스케일: 줌 + dot(정면 기반 페이드)
      const dotFade = THREE.MathUtils.clamp((dot - BACKFACE_THRESHOLD) / 0.3, 0, 1);
      const scale = 0.8 * dotFade;
      _obj.scale.set(scale, scale, 1);
      _obj.updateMatrix();
      mesh.setMatrixAt(visibleIdx, _obj.matrix);

      // alpha
      alphaBuf[visibleIdx] = dotFade * zoomFade;

      visibleIdx++;
    }

    // 나머지 숨기기
    for (let i = visibleIdx; i < MAX_COUNTRIES; i++) {
      prevKeys[i] = '';
    }

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
      ref={meshRef}
      args={[geometry, material, MAX_COUNTRIES]}
      frustumCulled={false}
      renderOrder={100}
    />
  );
}
