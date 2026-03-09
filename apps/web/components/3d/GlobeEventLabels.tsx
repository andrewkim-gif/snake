'use client';

/**
 * GlobeEventLabels — v28 Globe Event Labels (3D 뉴스 브리핑 라벨)
 *
 * 지구본 위 주요 이벤트를 해당 국가에 뉴스 브리핑 스타일 라벨로 표시.
 * 구현:
 *   - CanvasTexture 아틀라스 (8슬롯 순환 버퍼) + InstancedMesh Billboard
 *   - Leader Line: centroid → 라벨 위치 (surface normal 방향 오프셋)
 *   - 아크 키워드 태그: 아크 중간점에 이벤트 유형 키워드 표시
 *   - 수명 10초 (fade-in 0.3s → 유지 ~9s → fade-out 0.7s)
 *   - Backface 은닉 + LOD 3단계
 *
 * 디자인: NewsFeed 태그와 동일한 시각 언어 (EFFECT_COLORS 통일 색상)
 */

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { createArcPoints } from '@/lib/effect-utils';
import {
  EFFECT_COLORS,
  RENDER_ORDER,
  ARC_HEIGHT,
  LOD_DISTANCE,
} from '@/lib/effect-constants';
import type { GlobalEventData } from '@/components/3d/GlobeEventPulse';
import type { WarEffectData } from '@/components/3d/GlobeWarEffects';
import type { TradeRouteData } from '@/hooks/useSocket';
import type { AllianceData } from '@/components/3d/GlobeAllianceBeam';
import type { SanctionData } from '@/components/3d/GlobeSanctionBarrier';
import type { SpyOpData } from '@/components/3d/GlobeSpyTrail';

// ─── Constants ───

const MAX_LABELS = 8;       // 최대 동시 이벤트 라벨
const MAX_ARC_TAGS = 12;    // 최대 동시 아크 키워드 태그
const LABEL_LIFE = 10_000;  // 라벨 수명 (ms)
const FADE_IN = 300;        // ms
const FADE_OUT = 700;       // ms

/** 라벨 아틀라스 슬롯 크기 */
const SLOT_W = 400;
const SLOT_H = 28;
const ATLAS_W = SLOT_W;
const ATLAS_H = SLOT_H * MAX_LABELS;

/** 아크 태그 아틀라스 */
const TAG_W = 72;
const TAG_H = 22;
const TAG_ATLAS_W = TAG_W;
const TAG_ATLAS_H = TAG_H * MAX_ARC_TAGS;

/** 라벨 Billboard 월드 크기 */
const LABEL_WORLD_W = 9;
const LABEL_WORLD_H = LABEL_WORLD_W * (SLOT_H / SLOT_W);

/** 아크 태그 Billboard 월드 크기 */
const TAG_WORLD_W = 3.5;
const TAG_WORLD_H = TAG_WORLD_W * (TAG_H / TAG_W);

/** 라벨 고도 (구 표면 위 오프셋) */
const LABEL_ALT = 7;        // +7 units above surface
const ELBOW_ALT = 4.5;      // 꺾임점 고도

/** 뒷면 오클루전 임계값 */
const BACKFACE_THRESHOLD = 0.05;

const DEFAULT_GLOBE_RADIUS = 100;

// ─── 이벤트 타입 → 태그 텍스트 + 색상 매핑 ───

type EventEffectKey = 'war' | 'alliance' | 'trade' | 'resource' | 'spy' | 'sanction' | 'nuke' | 'epoch';

/** 뉴스 이벤트 타입 → 이펙트 키 변환 */
function eventTypeToEffectKey(type: string): EventEffectKey {
  switch (type) {
    case 'war_declared':
    case 'battle_start':
      return 'war';
    case 'treaty_signed':
      return 'alliance';
    case 'economy_event':
      return 'trade';
    case 'sovereignty_change':
    case 'battle_end':
      return 'resource';
    case 'season_event':
      return 'epoch';
    case 'global_event':
    default:
      return 'spy';
  }
}

/** 이펙트 키 → 태그 텍스트 */
const EFFECT_TAG_TEXT: Record<EventEffectKey, string> = {
  war: 'WAR',
  alliance: 'ALLY',
  trade: 'TRADE',
  resource: 'MINE',
  spy: 'INTEL',
  sanction: 'SANCT',
  nuke: 'NUKE',
  epoch: 'EPOCH',
};

/** 이펙트 키 → hex 색상 */
function effectKeyToHex(key: EventEffectKey): string {
  return EFFECT_COLORS[key]?.hex ?? EFFECT_COLORS.spy.hex;
}

// ─── 아크 이펙트 타입 → 키워드 매핑 ───

type ArcEffectType = 'war' | 'trade' | 'alliance' | 'sanction' | 'spy';

const ARC_TAG_TEXT: Record<ArcEffectType, string> = {
  war: 'WAR',
  trade: 'TRADE',
  alliance: 'ALLY',
  sanction: 'SANCT',
  spy: 'INTEL',
};

// ─── GC-prevention temp objects ───

const _obj = new THREE.Object3D();
const _camDir = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _tempVec = new THREE.Vector3();

// ─── Internal data types ───

interface ActiveLabel {
  id: string;
  slotIndex: number;
  effectKey: EventEffectKey;
  /** surface normal 방향 (= centroid 단위벡터) */
  normal: THREE.Vector3;
  /** centroid 구면 위치 */
  centroidPos: THREE.Vector3;
  /** 라벨 위치 (centroid + normal * LABEL_ALT) */
  labelPos: THREE.Vector3;
  /** 생성 시각 (ms) */
  birthTime: number;
  /** countryISO (중복 방지용) */
  countryCode: string;
}

interface ActiveArcTag {
  id: string;
  slotIndex: number;
  arcType: ArcEffectType;
  /** 아크 중간점 위치 */
  midpoint: THREE.Vector3;
  /** surface normal at midpoint */
  normal: THREE.Vector3;
  /** 생성 시각 (ms) */
  birthTime: number;
}

// ─── Shaders ───

const labelVertexShader = /* glsl */ `
  attribute float rowIndex;
  attribute float alphaVal;
  varying vec2 vUv;
  varying float vAlpha;
  uniform float totalRows;

  void main() {
    float rowStart = 1.0 - (rowIndex + 1.0) / totalRows;
    float rowEnd   = 1.0 - rowIndex / totalRows;
    vUv = vec2(uv.x, mix(rowStart, rowEnd, uv.y));
    vAlpha = alphaVal;

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const labelFragmentShader = /* glsl */ `
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

// ─── Props ───

export interface GlobeEventLabelsProps {
  /** 글로벌 이벤트 배열 (countryCode 포함) */
  globalEvents: GlobalEventData[];
  /** ISO3 → [lat, lng] centroid 맵 */
  countryCentroids: Map<string, [number, number]>;
  /** 글로브 반경 */
  globeRadius?: number;
  /** 전쟁 아크 데이터 (아크 키워드 태그용) */
  wars?: WarEffectData[];
  /** 교역 아크 데이터 */
  tradeRoutes?: TradeRouteData[];
  /** 동맹 아크 데이터 */
  alliances?: AllianceData[];
  /** 제재 아크 데이터 */
  sanctions?: SanctionData[];
  /** 첩보 아크 데이터 */
  spyOps?: SpyOpData[];
}

// ─── Canvas Atlas Rendering ───

/** 이벤트 라벨 아틀라스 슬롯 렌더링 */
function renderLabelSlot(
  ctx: CanvasRenderingContext2D,
  slotIndex: number,
  tagText: string,
  headline: string,
  colorHex: string,
  dpr: number,
): void {
  const y = slotIndex * SLOT_H * dpr;
  const w = SLOT_W * dpr;
  const h = SLOT_H * dpr;

  // 배경 클리어
  ctx.clearRect(0, y, w, h);

  // 배경
  ctx.fillStyle = 'rgba(9, 9, 11, 0.85)';
  ctx.fillRect(0, y, w, h);

  // 테두리
  ctx.strokeStyle = colorHex + '40';
  ctx.lineWidth = 1 * dpr;
  ctx.strokeRect(0.5 * dpr, y + 0.5 * dpr, w - 1 * dpr, h - 1 * dpr);

  // 태그 텍스트 (좌측)
  const fontSize = 10 * dpr;
  ctx.font = `bold ${fontSize}px "Space Grotesk", "Rajdhani", monospace`;
  ctx.fillStyle = colorHex;
  ctx.textBaseline = 'middle';
  const tagStr = `  ${tagText}  `;
  ctx.fillText(tagStr, 4 * dpr, y + h / 2);

  // 헤드라인 텍스트 (우측)
  const tagWidth = ctx.measureText(tagStr).width;
  ctx.fillStyle = '#ECECEF';
  ctx.font = `${fontSize}px "Space Grotesk", "Rajdhani", sans-serif`;
  // 텍스트가 넘치면 잘라내기
  const maxHeadlineW = w - tagWidth - 12 * dpr;
  let displayHeadline = headline;
  if (ctx.measureText(displayHeadline).width > maxHeadlineW) {
    while (displayHeadline.length > 3 && ctx.measureText(displayHeadline + '...').width > maxHeadlineW) {
      displayHeadline = displayHeadline.slice(0, -1);
    }
    displayHeadline += '...';
  }
  ctx.fillText(displayHeadline, tagWidth + 8 * dpr, y + h / 2);
}

/** 아크 키워드 태그 아틀라스 슬롯 렌더링 */
function renderArcTagSlot(
  ctx: CanvasRenderingContext2D,
  slotIndex: number,
  keyword: string,
  colorHex: string,
  dpr: number,
): void {
  const y = slotIndex * TAG_H * dpr;
  const w = TAG_W * dpr;
  const h = TAG_H * dpr;

  ctx.clearRect(0, y, w, h);

  // 배경
  ctx.fillStyle = 'rgba(9, 9, 11, 0.8)';
  ctx.fillRect(0, y, w, h);

  // 테두리
  ctx.strokeStyle = colorHex + '60';
  ctx.lineWidth = 1 * dpr;
  ctx.strokeRect(0.5 * dpr, y + 0.5 * dpr, w - 1 * dpr, h - 1 * dpr);

  // 키워드 텍스트 (중앙 정렬)
  const fontSize = 9 * dpr;
  ctx.font = `bold ${fontSize}px "Space Grotesk", "Rajdhani", monospace`;
  ctx.fillStyle = colorHex;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(keyword, w / 2, y + h / 2);
  ctx.textAlign = 'start'; // reset
}

// ─── Component ───

export function GlobeEventLabels({
  globalEvents,
  countryCentroids,
  globeRadius = DEFAULT_GLOBE_RADIUS,
  wars = [],
  tradeRoutes = [],
  alliances = [],
  sanctions = [],
  spyOps = [],
}: GlobeEventLabelsProps) {
  const { camera } = useThree();

  // ─── Refs ───
  const labelMeshRef = useRef<THREE.InstancedMesh>(null!);
  const tagMeshRef = useRef<THREE.InstancedMesh>(null!);
  const lineGroupRef = useRef<THREE.Group>(null!);

  const activeLabelsRef = useRef<ActiveLabel[]>([]);
  const activeArcTagsRef = useRef<ActiveArcTag[]>([]);
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const processedArcIdsRef = useRef<Set<string>>(new Set());
  const slotPoolRef = useRef<number[]>(Array.from({ length: MAX_LABELS }, (_, i) => i));
  const arcSlotPoolRef = useRef<number[]>(Array.from({ length: MAX_ARC_TAGS }, (_, i) => i));

  // Leader line refs
  const linesRef = useRef<THREE.Line[]>([]);
  const lineMaterialsRef = useRef<THREE.LineBasicMaterial[]>([]);

  // ─── DPR ───
  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2);

  // ─── Label Atlas (CanvasTexture) ───
  const { labelAtlasTex, labelCtx } = useMemo(() => {
    if (typeof document === 'undefined') return { labelAtlasTex: null, labelCtx: null };
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_W * dpr;
    canvas.height = ATLAS_H * dpr;
    const ctx = canvas.getContext('2d')!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.flipY = true;
    return { labelAtlasTex: tex, labelCtx: ctx };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Arc Tag Atlas (CanvasTexture) ───
  const { tagAtlasTex, tagCtx } = useMemo(() => {
    if (typeof document === 'undefined') return { tagAtlasTex: null, tagCtx: null };
    const canvas = document.createElement('canvas');
    canvas.width = TAG_ATLAS_W * dpr;
    canvas.height = TAG_ATLAS_H * dpr;
    const ctx = canvas.getContext('2d')!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.flipY = true;
    return { tagAtlasTex: tex, tagCtx: ctx };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Label ShaderMaterial ───
  const labelMaterial = useMemo(() => {
    if (!labelAtlasTex) return null;
    return new THREE.ShaderMaterial({
      uniforms: {
        atlas: { value: labelAtlasTex },
        totalRows: { value: MAX_LABELS },
      },
      vertexShader: labelVertexShader,
      fragmentShader: labelFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [labelAtlasTex]);

  // ─── Arc Tag ShaderMaterial ───
  const tagMaterial = useMemo(() => {
    if (!tagAtlasTex) return null;
    return new THREE.ShaderMaterial({
      uniforms: {
        atlas: { value: tagAtlasTex },
        totalRows: { value: MAX_ARC_TAGS },
      },
      vertexShader: labelVertexShader,
      fragmentShader: labelFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [tagAtlasTex]);

  // ─── Label InstancedMesh geometry + attributes ───
  const labelGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(LABEL_WORLD_W, LABEL_WORLD_H);
    const rowIndex = new Float32Array(MAX_LABELS).fill(0);
    const alphaVal = new Float32Array(MAX_LABELS).fill(0);
    geo.setAttribute('rowIndex', new THREE.InstancedBufferAttribute(rowIndex, 1));
    geo.setAttribute('alphaVal', new THREE.InstancedBufferAttribute(alphaVal, 1));
    return geo;
  }, []);

  const tagGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(TAG_WORLD_W, TAG_WORLD_H);
    const rowIndex = new Float32Array(MAX_ARC_TAGS).fill(0);
    const alphaVal = new Float32Array(MAX_ARC_TAGS).fill(0);
    geo.setAttribute('rowIndex', new THREE.InstancedBufferAttribute(rowIndex, 1));
    geo.setAttribute('alphaVal', new THREE.InstancedBufferAttribute(alphaVal, 1));
    return geo;
  }, []);

  // ─── 새 이벤트 라벨 추가 ───
  const addLabel = useCallback((event: GlobalEventData) => {
    if (!event.countryCode || !countryCentroids.has(event.countryCode)) return;
    if (processedEventIdsRef.current.has(event.id)) return;

    const labels = activeLabelsRef.current;

    // 같은 국가 기존 라벨 제거
    const existingIdx = labels.findIndex(l => l.countryCode === event.countryCode);
    if (existingIdx !== -1) {
      const existing = labels[existingIdx];
      slotPoolRef.current.push(existing.slotIndex);
      removeLeaderLine(existing.id);
      labels.splice(existingIdx, 1);
    }

    // 풀이 비어있으면 가장 오래된 라벨 제거
    if (slotPoolRef.current.length === 0) {
      const oldest = labels.shift();
      if (oldest) {
        slotPoolRef.current.push(oldest.slotIndex);
        removeLeaderLine(oldest.id);
      }
    }

    const slotIndex = slotPoolRef.current.shift()!;
    const effectKey = eventTypeToEffectKey(event.type);
    const colorHex = effectKeyToHex(effectKey);
    const tagText = EFFECT_TAG_TEXT[effectKey];

    // 아틀라스에 렌더링
    if (labelCtx) {
      renderLabelSlot(labelCtx, slotIndex, tagText, event.message, colorHex, dpr);
      if (labelAtlasTex) labelAtlasTex.needsUpdate = true;
    }

    // 위치 계산
    const centroid = countryCentroids.get(event.countryCode!)!;
    const centroidPos = latLngToVector3(centroid[0], centroid[1], globeRadius + 0.5);
    const normal = centroidPos.clone().normalize();
    const labelPos = centroidPos.clone().add(normal.clone().multiplyScalar(LABEL_ALT));

    const label: ActiveLabel = {
      id: event.id,
      slotIndex,
      effectKey,
      normal,
      centroidPos,
      labelPos,
      birthTime: Date.now(),
      countryCode: event.countryCode!,
    };

    labels.push(label);
    processedEventIdsRef.current.add(event.id);

    // Leader line 생성
    createLeaderLine(label, colorHex);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCentroids, globeRadius, dpr]);

  // ─── Leader Line 관리 ───
  const createLeaderLine = useCallback((label: ActiveLabel, colorHex: string) => {
    if (!lineGroupRef.current) return;

    const elbowPos = label.centroidPos.clone().add(
      label.normal.clone().multiplyScalar(ELBOW_ALT),
    );

    const points = [label.labelPos.clone(), elbowPos, label.centroidPos.clone()];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = RENDER_ORDER.EVENT_LABEL_LINE;
    (line as any).__labelId = label.id;
    lineGroupRef.current.add(line);
    linesRef.current.push(line);
    lineMaterialsRef.current.push(mat);
  }, []);

  const removeLeaderLine = useCallback((labelId: string) => {
    if (!lineGroupRef.current) return;
    const idx = linesRef.current.findIndex(l => (l as any).__labelId === labelId);
    if (idx !== -1) {
      const line = linesRef.current[idx];
      lineGroupRef.current.remove(line);
      line.geometry.dispose();
      lineMaterialsRef.current[idx].dispose();
      linesRef.current.splice(idx, 1);
      lineMaterialsRef.current.splice(idx, 1);
    }
  }, []);

  // ─── 아크 키워드 태그 빌드 ───
  const buildArcTags = useCallback(() => {
    const tags: ActiveArcTag[] = [];
    const usedSlots: number[] = [];
    const pool = [...Array.from({ length: MAX_ARC_TAGS }, (_, i) => i)];
    const processed = new Set<string>();

    const addArcTag = (
      id: string,
      fromISO: string,
      toISO: string,
      arcType: ArcEffectType,
      heightKey: keyof typeof ARC_HEIGHT,
    ) => {
      if (processed.has(id) || pool.length === 0) return;
      const fromC = countryCentroids.get(fromISO);
      const toC = countryCentroids.get(toISO);
      if (!fromC || !toC) return;

      const fromPos = latLngToVector3(fromC[0], fromC[1], globeRadius + 0.5);
      const toPos = latLngToVector3(toC[0], toC[1], globeRadius + 0.5);

      // 아크 중간점 계산 (t=0.5)
      const arcPoints = createArcPoints(fromPos, toPos, globeRadius, ARC_HEIGHT[heightKey], 16);
      const midIdx = Math.floor(arcPoints.length / 2);
      const midpoint = arcPoints[midIdx].clone();
      const normal = midpoint.clone().normalize();

      const slotIndex = pool.shift()!;
      usedSlots.push(slotIndex);
      processed.add(id);

      // 아틀라스 렌더링
      if (tagCtx) {
        const keyword = ARC_TAG_TEXT[arcType];
        const colorHex = EFFECT_COLORS[arcType]?.hex ?? EFFECT_COLORS.spy.hex;
        renderArcTagSlot(tagCtx, slotIndex, keyword, colorHex, dpr);
      }

      tags.push({
        id,
        slotIndex,
        arcType,
        midpoint: midpoint.add(normal.clone().multiplyScalar(1.5)), // 아크 약간 위
        normal,
        birthTime: Date.now(),
      });
    };

    // 전쟁 (WarEffectData uses attacker/defender)
    for (const w of wars) {
      addArcTag(`war_${w.attacker}_${w.defender}`, w.attacker, w.defender, 'war', 'war');
    }
    // 교역
    for (const t of tradeRoutes) {
      addArcTag(`trade_${t.from}_${t.to}_${t.timestamp}`, t.from, t.to, 'trade', 'trade');
    }
    // 동맹
    for (const a of alliances) {
      addArcTag(`ally_${a.from}_${a.to}`, a.from, a.to, 'alliance', 'alliance');
    }
    // 제재
    for (const s of sanctions) {
      addArcTag(`sanct_${s.from}_${s.to}`, s.from, s.to, 'sanction', 'sanction');
    }
    // 첩보
    for (const sp of spyOps) {
      addArcTag(`spy_${sp.from}_${sp.to}`, sp.from, sp.to, 'spy', 'spy');
    }

    if (tagAtlasTex) tagAtlasTex.needsUpdate = true;
    activeArcTagsRef.current = tags;
    arcSlotPoolRef.current = pool;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wars, tradeRoutes, alliances, sanctions, spyOps, countryCentroids, globeRadius, dpr]);

  // ─── 새 이벤트 감지 → 라벨 추가 ───
  const prevEventCountRef = useRef(0);

  useEffect(() => {
    if (globalEvents.length <= prevEventCountRef.current) {
      prevEventCountRef.current = globalEvents.length;
      return;
    }

    // 새로 추가된 이벤트들 처리
    const newEvents = globalEvents.slice(prevEventCountRef.current);
    for (const evt of newEvents) {
      addLabel(evt);
    }
    prevEventCountRef.current = globalEvents.length;
  }, [globalEvents, addLabel]);

  // ─── 아크 태그 재빌드 (아크 데이터 변경 시) ───
  useEffect(() => {
    buildArcTags();
  }, [buildArcTags]);

  // ─── 매 프레임: 수명 관리 + Billboard + 뒷면 은닉 ───
  useFrame(() => {
    const now = Date.now();
    const labelMesh = labelMeshRef.current;
    const tagMesh = tagMeshRef.current;
    if (!labelMesh || !tagMesh) return;

    // 카메라 방향
    _camDir.copy(camera.position).normalize();
    const camDist = camera.position.length();

    // LOD: far → 모두 숨김
    if (camDist > LOD_DISTANCE.MID_TO_FAR) {
      labelMesh.count = 0;
      tagMesh.count = 0;
      // leader lines 숨기기
      for (const mat of lineMaterialsRef.current) mat.opacity = 0;
      return;
    }

    // ── 이벤트 라벨 업데이트 ──
    const labels = activeLabelsRef.current;
    const rowIndexAttr = labelGeo.getAttribute('rowIndex') as THREE.InstancedBufferAttribute;
    const alphaAttr = labelGeo.getAttribute('alphaVal') as THREE.InstancedBufferAttribute;

    // 만료된 라벨 제거
    for (let i = labels.length - 1; i >= 0; i--) {
      const age = now - labels[i].birthTime;
      if (age > LABEL_LIFE) {
        slotPoolRef.current.push(labels[i].slotIndex);
        removeLeaderLine(labels[i].id);
        processedEventIdsRef.current.delete(labels[i].id);
        labels.splice(i, 1);
      }
    }

    let labelCount = 0;
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const age = now - label.birthTime;

      // Opacity (fade-in/out)
      let opacity: number;
      if (age < FADE_IN) {
        opacity = age / FADE_IN; // easeOut은 생략 (단순 linear으로 충분)
      } else if (age > LABEL_LIFE - FADE_OUT) {
        opacity = (LABEL_LIFE - age) / FADE_OUT;
      } else {
        opacity = 1;
      }

      // Backface 은닉
      const dot = label.normal.dot(_camDir);
      if (dot < BACKFACE_THRESHOLD) opacity = 0;

      // LOD: mid → 크기 축소 (태그만)
      const scale = camDist > LOD_DISTANCE.CLOSE_TO_MID ? 0.6 : 1;

      // Billboard: 라벨이 카메라를 향하도록
      _obj.position.copy(label.labelPos);
      _obj.quaternion.copy(camera.quaternion);
      _obj.scale.set(scale, scale, 1);
      _obj.updateMatrix();
      labelMesh.setMatrixAt(labelCount, _obj.matrix);

      rowIndexAttr.setX(labelCount, label.slotIndex);
      alphaAttr.setX(labelCount, Math.max(0, opacity));

      // Leader line opacity 동기화
      const lineIdx = linesRef.current.findIndex(l => (l as any).__labelId === label.id);
      if (lineIdx !== -1) {
        lineMaterialsRef.current[lineIdx].opacity = Math.max(0, opacity);
      }

      labelCount++;
    }

    labelMesh.count = labelCount;
    if (labelCount > 0) {
      labelMesh.instanceMatrix.needsUpdate = true;
      rowIndexAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
    }

    // ── 아크 키워드 태그 업데이트 ──
    const arcTags = activeArcTagsRef.current;
    const tagRowAttr = tagGeo.getAttribute('rowIndex') as THREE.InstancedBufferAttribute;
    const tagAlphaAttr = tagGeo.getAttribute('alphaVal') as THREE.InstancedBufferAttribute;

    let tagCount = 0;
    for (let i = 0; i < arcTags.length; i++) {
      const tag = arcTags[i];

      // Backface 은닉
      const dot = tag.normal.dot(_camDir);
      let opacity = dot < BACKFACE_THRESHOLD ? 0 : 1;

      // LOD: mid → 약간 축소
      const scale = camDist > LOD_DISTANCE.CLOSE_TO_MID ? 0.7 : 1;

      // Billboard
      _obj.position.copy(tag.midpoint);
      _obj.quaternion.copy(camera.quaternion);
      _obj.scale.set(scale, scale, 1);
      _obj.updateMatrix();
      tagMesh.setMatrixAt(tagCount, _obj.matrix);

      tagRowAttr.setX(tagCount, tag.slotIndex);
      tagAlphaAttr.setX(tagCount, opacity);

      tagCount++;
    }

    tagMesh.count = tagCount;
    if (tagCount > 0) {
      tagMesh.instanceMatrix.needsUpdate = true;
      tagRowAttr.needsUpdate = true;
      tagAlphaAttr.needsUpdate = true;
    }
  });

  // ─── Cleanup ───
  useEffect(() => {
    return () => {
      labelGeo.dispose();
      tagGeo.dispose();
      labelMaterial?.dispose();
      tagMaterial?.dispose();
      labelAtlasTex?.dispose();
      tagAtlasTex?.dispose();
      for (const line of linesRef.current) line.geometry.dispose();
      for (const mat of lineMaterialsRef.current) mat.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!labelMaterial || !tagMaterial) return null;

  return (
    <group>
      {/* 이벤트 브리핑 라벨 (InstancedMesh) */}
      <instancedMesh
        ref={labelMeshRef}
        args={[labelGeo, labelMaterial, MAX_LABELS]}
        renderOrder={RENDER_ORDER.EVENT_LABEL_TAG}
        frustumCulled={false}
      />

      {/* 아크 키워드 태그 (InstancedMesh) */}
      <instancedMesh
        ref={tagMeshRef}
        args={[tagGeo, tagMaterial, MAX_ARC_TAGS]}
        renderOrder={RENDER_ORDER.ARC_KEYWORD_TAG}
        frustumCulled={false}
      />

      {/* Leader Lines */}
      <group ref={lineGroupRef} />
    </group>
  );
}
