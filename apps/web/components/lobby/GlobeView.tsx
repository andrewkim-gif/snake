'use client';

/**
 * GlobeView — Main globe orchestrator.
 * Assembles modular sub-components (EarthGroup, CountryLayer, etc.)
 * into the full 3D globe scene with Canvas wrapper.
 *
 * Phase 0 modular refactor: reduced from ~1,988 lines to ~300.
 */

import { useState, useEffect, useMemo, useRef, useCallback, Suspense, createContext, useContext } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import { loadGeoJSON } from '@/lib/globe-data';
import type { CountryClientState } from '@/lib/globe-data';
import {
  GLOBE_RADIUS,
  LABEL_R,
  xyzToGeo,
  buildCountryGeometries,
  type CountryGeo,
} from '@/lib/globe-geo';

// Earth + sky (v33: + computeSunDirection for unified sun computation)
import { EarthGroup, SunLight, Starfield, computeSunDirection } from '@/components/3d/EarthGroup';
// Country polygons + borders
import { CountryLayer } from '@/components/3d/CountryLayer';
// Interaction + SizeGate
import { GlobeInteraction, SizeGate } from '@/components/3d/GlobeInteractionLayer';
// Country name labels
import { GlobeCountryNameLabels } from '@/components/3d/GlobeCountryNameLabels';
// 3D title
import { GlobeTitle } from '@/components/3d/GlobeTitle';

// v14: Globe domination + war effects
import { GlobeDominationLayer } from '@/components/3d/GlobeDominationLayer';
import type { CountryDominationState } from '@/components/3d/GlobeDominationLayer';
import { GlobeWarEffects } from '@/components/3d/GlobeWarEffects';
import type { WarEffectData } from '@/components/3d/GlobeWarEffects';

// v15: Flag atlas + country labels
import { GlobeCountryLabels } from '@/components/3d/GlobeCountryLabels';
import { loadFlagAtlas } from '@/lib/flag-atlas';
import type { FlagAtlasResult } from '@/lib/flag-atlas';
import { COUNTRIES } from '@/lib/country-data';

// v15 Phase 4: Missile + Shockwave effects
import { GlobeMissileEffect } from '@/components/3d/GlobeMissileEffect';
import { GlobeShockwave } from '@/components/3d/GlobeShockwave';
import type { GlobeShockwaveHandle } from '@/components/3d/GlobeShockwave';

// v15 Phase 5: Trade routes + Event pulse
import { GlobeTradeRoutes } from '@/components/3d/GlobeTradeRoutes';
import { GlobeEventPulse } from '@/components/3d/GlobeEventPulse';
import type { TradeRouteData } from '@/hooks/useSocket';
import type { GlobalEventData } from '@/components/3d/GlobeEventPulse';

// v28: Globe event labels
import { GlobeEventLabels } from '@/components/3d/GlobeEventLabels';

// v24 Phase 2: Unified camera controller
import { CameraController } from '@/components/3d/CameraController';
import { CAMERA_PRIORITY } from '@/lib/effect-constants';
import { useGlobeLOD, useGlobeLODDistance } from '@/hooks/useGlobeLOD';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// v17: Intro camera animation
import { GlobeIntroCamera } from '@/components/3d/GlobeIntroCamera';

// v21 Phase 4: Bloom post-processing
import { EffectComposer, Bloom } from '@react-three/postprocessing';

// v33 Phase 5: AdaptiveQuality 시스템
import {
  useAdaptiveQuality,
  AdaptiveQualityContext,
  useAdaptiveQualityContext,
  type QualityPreset,
} from '@/hooks/useAdaptiveQuality';

// v20: Landmark sprites
import { GlobeLandmarks } from '@/components/3d/GlobeLandmarks';
// v17: Conflict indicators
import { GlobeConflictIndicators } from '@/components/3d/GlobeConflictIndicators';

// Tycoon: 군대 이동 시각화
import GlobeArmyMovement from '@/components/3d/GlobeArmyMovement';
import type { IArmyMovement } from '@/components/3d/GlobeArmyMovement';

// v23 Phase 5: Event effects
import { GlobeAllianceBeam } from '@/components/3d/GlobeAllianceBeam';
import type { AllianceData } from '@/components/3d/GlobeAllianceBeam';
import { GlobeSanctionBarrier } from '@/components/3d/GlobeSanctionBarrier';
import type { SanctionData } from '@/components/3d/GlobeSanctionBarrier';
import { GlobeResourceGlow } from '@/components/3d/GlobeResourceGlow';
import type { ResourceData } from '@/components/3d/GlobeResourceGlow';
import { GlobeSpyTrail } from '@/components/3d/GlobeSpyTrail';
import type { SpyOpData } from '@/components/3d/GlobeSpyTrail';
import { GlobeNukeEffect } from '@/components/3d/GlobeNukeEffect';
import type { NukeData } from '@/components/3d/GlobeNukeEffect';

// ─── v33 Phase 3: SharedTickRef — 매 프레임 공유 데이터 (useRef 기반, 리렌더 없음) ───

export interface SharedTickData {
  /** 카메라 원점 거리 */
  cameraDist: number;
  /** 카메라 방향 (정규화, 재사용 벡터) */
  cameraDir: THREE.Vector3;
  /** 프레임 델타 (초) */
  delta: number;
  /** 경과 시간 (초) */
  elapsed: number;
  /** 태양 방향 벡터 (정규화, 1회/프레임 계산) */
  sunDir: THREE.Vector3;
}

/** 기본 SharedTickData — 초기값 (GC 방지용 모듈 레벨 객체) */
function createSharedTickData(): SharedTickData {
  return {
    cameraDist: 300,
    cameraDir: new THREE.Vector3(0, 0, 1),
    delta: 0,
    elapsed: 0,
    sunDir: new THREE.Vector3(1, 0, 0),
  };
}

/**
 * SharedTickContext — useRef 기반 공유 tick 데이터.
 * React Context지만 값은 MutableRefObject이므로 리렌더를 유발하지 않음.
 */
export const SharedTickContext = createContext<React.RefObject<SharedTickData>>(
  { current: createSharedTickData() } as React.RefObject<SharedTickData>,
);

/** SharedTickRef 소비자 훅 */
export function useSharedTick(): React.RefObject<SharedTickData> {
  return useContext(SharedTickContext);
}

// ─── Module-scope fallback constants (GC prevention) ───

const EMPTY_DOM_MAP = new Map<string, CountryDominationState>();
const EMPTY_STATE_MAP = new Map<string, CountryClientState>();
const EMPTY_SET = new Set<string>();
const EMPTY_ARRAY: never[] = [];

const BG = '#030305';

// ─── Props ───

interface GlobeViewProps {
  countryStates?: Map<string, CountryClientState>;
  selectedCountry?: string | null;
  onCountryClick?: (iso3: string, name: string) => void;
  style?: React.CSSProperties;
  dominationStates?: Map<string, CountryDominationState>;
  wars?: WarEffectData[];
  countryCentroids?: Map<string, [number, number]>;
  onHover?: (iso3: string | null, name: string | null) => void;
  tradeRoutes?: TradeRouteData[];
  globalEvents?: GlobalEventData[];
  introActive?: boolean;
  onIntroComplete?: () => void;
  activeConflictCountries?: Set<string>;
  alliances?: AllianceData[];
  sanctions?: SanctionData[];
  resources?: ResourceData[];
  spyOps?: SpyOpData[];
  nukes?: NukeData[];
  onReady?: () => void;
  /** v37: 인게임 중 Globe 렌더링 일시정지 (Canvas 유지, RAF 중지) */
  paused?: boolean;
  /** v47: COBE 스타일 dotted globe 모드 */
  dottedMode?: boolean;
  /** 타이쿬 영토 데이터 — 있으면 레거시 dominationStates 대신 사용 */
  tycoonDominationStates?: Map<string, CountryDominationState>;
  /** 타이쿬 군대 이동 시각화 데이터 */
  tycoonArmyMovements?: IArmyMovement[];
}

// ─── AdaptiveOrbitControls ───

const MIN_DIST = 150;
const MAX_DIST = 500;
const ROTATE_SPEED_CLOSE = 0.2;
const ROTATE_SPEED_FAR = 0.8;
const DAMPING_CLOSE = 0.08;
const DAMPING_FAR = 0.05;

function AdaptiveOrbitControls() {
  const controlsRef = useRef<any>(null);
  const tickRef = useSharedTick();

  // v33 Phase 3: cameraDist를 SharedTickRef에서 읽어 중복 계산 제거
  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const dist = tickRef.current.cameraDist;
    const t = THREE.MathUtils.clamp((dist - MIN_DIST) / (MAX_DIST - MIN_DIST), 0, 1);
    const ease = 1 - (1 - t) * (1 - t);

    controls.rotateSpeed = THREE.MathUtils.lerp(ROTATE_SPEED_CLOSE, ROTATE_SPEED_FAR, ease);
    controls.dampingFactor = THREE.MathUtils.lerp(DAMPING_CLOSE, DAMPING_FAR, ease);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableZoom
      minDistance={MIN_DIST}
      maxDistance={MAX_DIST}
      enableDamping
      dampingFactor={DAMPING_FAR}
      rotateSpeed={ROTATE_SPEED_FAR}
      zoomSpeed={0.8}
    />
  );
}

// ─── v33 Phase 5: AdaptiveBloom — 품질 ref 기반 Bloom 조건부 렌더링 ───

function AdaptiveBloom({ qualityRef }: { qualityRef: React.RefObject<QualityPreset> }) {
  // v33+: EffectComposer의 enabled를 ref로 제어하여 GPU pass 자체를 스킵
  // intensity=0으로만 하면 KawaseBlur pass가 여전히 GPU에서 실행됨
  //
  // ⚠️ Bloom 객체를 직접 ref에 저장하면 KawaseBlurPass→Resolution→resizable 순환 참조로
  // Next.js dev 모드에서 JSON.stringify 에러 발생. ref callback으로 setter만 캐시한다.
  const composerSetEnabledRef = useRef<((v: boolean) => void) | null>(null);
  const bloomSetIntensityRef = useRef<((v: number) => void) | null>(null);

  const composerRefCallback = useCallback((composer: any) => {
    if (composer) {
      composerSetEnabledRef.current = (v: boolean) => { composer.enabled = v; };
    } else {
      composerSetEnabledRef.current = null;
    }
  }, []);

  const bloomRefCallback = useCallback((effect: any) => {
    if (effect) {
      bloomSetIntensityRef.current = (v: number) => { effect.intensity = v; };
    } else {
      bloomSetIntensityRef.current = null;
    }
  }, []);

  useFrame(() => {
    const enable = qualityRef.current.enableBloom;
    // EffectComposer 전체를 비활성화하여 GPU render pass 스킵
    composerSetEnabledRef.current?.(enable);
    // intensity도 설정 (재활성화 시 올바른 값 보장)
    bloomSetIntensityRef.current?.(enable ? 0.8 : 0);
  });

  return (
    <EffectComposer ref={composerRefCallback}>
      <Bloom
        ref={bloomRefCallback}
        luminanceThreshold={0.7}
        luminanceSmoothing={0.15}
        intensity={0.8}
        radius={0.5}
        mipmapBlur
      />
    </EffectComposer>
  );
}

// ─── v37: frameloop demand→always 전환 시 RAF 루프 재시작 킥 ───
function FrameloopKick({ paused }: { paused?: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const prevPausedRef = useRef(paused);
  useEffect(() => {
    // demand→always 전환 시에만 invalidate 호출 (RAF 루프 재시작)
    if (prevPausedRef.current && !paused) {
      invalidate();
    }
    prevPausedRef.current = paused;
  }, [paused, invalidate]);
  return null;
}

// ─── GlobeScene (Canvas inner) ───

function GlobeScene({
  onCountryClick,
  onHover,
  dominationStates,
  wars,
  countryStates,
  tradeRoutes,
  globalEvents,
  introActive,
  onIntroComplete,
  activeConflictCountries,
  alliances,
  sanctions,
  resources,
  spyOps,
  nukes,
  dottedMode,
  tycoonDominationStates,
  tycoonArmyMovements,
}: {
  onCountryClick?: (iso3: string, name: string) => void;
  onHover?: (iso3: string | null, name: string | null) => void;
  dominationStates: Map<string, CountryDominationState>;
  wars: WarEffectData[];
  countryStates: Map<string, CountryClientState>;
  activeConflictCountries: Set<string>;
  tradeRoutes: TradeRouteData[];
  globalEvents: GlobalEventData[];
  introActive?: boolean;
  onIntroComplete?: () => void;
  alliances: AllianceData[];
  sanctions: SanctionData[];
  resources: ResourceData[];
  spyOps: SpyOpData[];
  nukes: NukeData[];
  dottedMode?: boolean;
  tycoonDominationStates?: Map<string, CountryDominationState>;
  tycoonArmyMovements?: IArmyMovement[];
}) {
  const [countries, setCountries] = useState<CountryGeo[]>([]);
  const [flagAtlas, setFlagAtlas] = useState<FlagAtlasResult | null>(null);

  const globeGroupRef = useRef<THREE.Group>(null);
  const shockwaveRef = useRef<GlobeShockwaveHandle>(null);
  const cameraTargetRef = useRef<THREE.Vector3 | null>(null);
  const cameraPriorityRef = useRef<number>(1);

  // v33 Phase 3: SharedTickRef — 매 프레임 공유 데이터 (한 번만 계산)
  const sharedTickRef = useRef<SharedTickData>(createSharedTickData());

  // v33 Task 1: Single sun direction ref, computed once per frame, shared to EarthGroup + SunLight
  const sunDirRef = useRef(new THREE.Vector3(1, 0, 0));

  const { camera } = useThree();
  useFrame((_state, delta) => {
    // 태양 방향 계산 (1회/프레임)
    computeSunDirection(sunDirRef.current);

    // v33 Phase 3: 공유 tick 데이터 갱신 (1회/프레임)
    const tick = sharedTickRef.current;
    tick.cameraDist = camera.position.length();
    tick.cameraDir.copy(camera.position).normalize();
    tick.delta = delta;
    tick.elapsed = _state.clock.elapsedTime;
    tick.sunDir.copy(sunDirRef.current);
  });

  const handleCameraTarget = useCallback((position: THREE.Vector3, priority?: number) => {
    cameraTargetRef.current = position.clone();
    cameraPriorityRef.current = priority ?? CAMERA_PRIORITY.war;
  }, []);

  const lodConfig = useGlobeLOD();
  const distanceLODRef = useGlobeLODDistance();
  const reducedMotion = useReducedMotion();

  // v33 Phase 5: AdaptiveQuality — FPS 모니터링 + 자동 품질 조절
  const qualityRef = useAdaptiveQuality();

  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || navigator.maxTouchPoints > 0;
  }, []);

  // GeoJSON load
  useEffect(() => {
    loadGeoJSON()
      .then((data) => setCountries(buildCountryGeometries(data)))
      .catch(console.error);
    return () => {
      setCountries((prev) => {
        prev.forEach((c) => c.geometry.dispose());
        return [];
      });
    };
  }, []);

  // Flag atlas load
  useEffect(() => {
    const iso2List = COUNTRIES.map((c) => c.iso2);
    loadFlagAtlas(iso2List).then(setFlagAtlas).catch(console.error);
  }, []);

  // iso3 -> BufferGeometry map
  const countryGeoMap = useMemo(() => {
    const map = new Map<string, THREE.BufferGeometry>();
    for (const c of countries) map.set(c.iso3, c.geometry);
    return map;
  }, [countries]);

  // iso3 -> [lat, lng] centroid map
  const centroidsMap = useMemo(() => {
    const map = new Map<string, [number, number]>();
    for (const c of countries) {
      const [lon, lat] = xyzToGeo(c.centroid, LABEL_R);
      map.set(c.iso3, [lat, lon]);
    }
    return map;
  }, [countries]);

  const handleMissileImpact = useCallback((position: THREE.Vector3) => {
    shockwaveRef.current?.trigger(position);
  }, []);

  // ── 타이쿬 데이터 병합: tycoonDominationStates가 있으면 우선, 없으면 레거시 fallback ──
  const mergedDominationStates = useMemo(() => {
    if (tycoonDominationStates && tycoonDominationStates.size > 0) {
      // 타이쿬 데이터 우선, 레거시 데이터로 나머지 채움
      if (dominationStates.size === 0) return tycoonDominationStates;
      const merged = new Map(dominationStates);
      for (const [iso3, state] of tycoonDominationStates) {
        merged.set(iso3, state);
      }
      return merged;
    }
    return dominationStates;
  }, [dominationStates, tycoonDominationStates]);

  // ── 타이쿬 모드 판별: tycoon 데이터가 유의미하게 존재하면 레거시 전쟁 이펙트 비활성화 ──
  const tycoonMode = !!(tycoonDominationStates && tycoonDominationStates.size > 0);

  // 군대 이동 데이터 (빈 배열 fallback)
  const armyMovements = tycoonArmyMovements ?? EMPTY_ARRAY;

  return (
    <AdaptiveQualityContext.Provider value={qualityRef}>
    <SharedTickContext.Provider value={sharedTickRef}>
      {/* Intro camera */}
      {introActive && (
        <GlobeIntroCamera
          active={introActive}
          onComplete={onIntroComplete}
          globeGroupRef={globeGroupRef}
        />
      )}

      {/* Space lighting */}
      <ambientLight intensity={0.12} color="#1a2a4a" />
      <hemisphereLight args={['#334466', '#0a0e18', 0.25]} />
      <SunLight sunDirRef={sunDirRef} />
      <Starfield sharedTickRef={sharedTickRef} />

      {/* Globe group */}
      <group ref={globeGroupRef}>
        {/* v33 Phase 5: LOW 품질에서 구름 숨김 | v47: dotted mode */}
        <EarthGroup sunDirRef={sunDirRef} qualityRef={qualityRef} dottedMode={dottedMode} />
        <GlobeTitle />
        <CountryLayer countries={countries} dottedMode={dottedMode} />
        <GlobeCountryNameLabels countries={countries} sharedTickRef={sharedTickRef} />
        <GlobeInteraction onCountryClick={onCountryClick} onHover={onHover} />
      </group>

      {/* OrbitControls (disabled during intro) */}
      {!introActive && <AdaptiveOrbitControls />}

      {/* Camera controller */}
      <CameraController
        targetRef={cameraTargetRef}
        priorityRef={cameraPriorityRef}
        introActive={!!introActive}
        globeRadius={GLOBE_RADIUS}
      />

      {/* Domination overlay — 타이쿬 데이터 우선, 레거시 fallback */}
      {mergedDominationStates.size > 0 && (
        <GlobeDominationLayer
          dominationStates={mergedDominationStates}
          countryGeometries={countryGeoMap}
          globeRadius={GLOBE_RADIUS}
        />
      )}

      {/* War effects — tycoonMode에서는 레거시 전쟁 이펙트 비활성화 */}
      {!tycoonMode && wars.length > 0 && (
        <GlobeWarEffects
          wars={wars}
          countryCentroids={centroidsMap}
          globeRadius={GLOBE_RADIUS}
          onCameraTarget={handleCameraTarget}
          enableWarFog={lodConfig.enableWarFog}
        />
      )}

      {/* Missiles — tycoonMode에서는 비활성화 (서버가 더 이상 미사일 데이터를 보내지 않음) */}
      {!tycoonMode && wars.length > 0 && centroidsMap.size > 0 && (
        <GlobeMissileEffect
          wars={wars}
          countryCentroids={centroidsMap}
          globeRadius={GLOBE_RADIUS}
          onImpact={handleMissileImpact}
          maxMissiles={lodConfig.maxMissiles}
        />
      )}

      {/* 타이쿬 군대 이동 시각화 */}
      {armyMovements.length > 0 && (
        <GlobeArmyMovement
          movements={armyMovements}
          globeRadius={GLOBE_RADIUS}
        />
      )}

      {/* Shockwave — tycoonMode에서는 비활성화 */}
      {!tycoonMode && lodConfig.enableShockwave && (
        <GlobeShockwave ref={shockwaveRef} globeRadius={GLOBE_RADIUS} />
      )}

      {/* Flag + agent labels */}
      {flagAtlas && centroidsMap.size > 0 && (
        <GlobeCountryLabels
          countryCentroids={centroidsMap}
          countryStates={countryStates}
          dominationStates={dominationStates}
          flagAtlas={flagAtlas}
          globeRadius={GLOBE_RADIUS}
          maxLabels={lodConfig.maxLabels}
        />
      )}

      {/* Landmarks */}
      {centroidsMap.size > 0 && (
        <GlobeLandmarks
          countryCentroids={centroidsMap}
          globeRadius={GLOBE_RADIUS}
          maxLandmarks={lodConfig.maxLandmarks}
          landmarkDetail={lodConfig.landmarkDetail}
        />
      )}

      {/* Conflict indicators */}
      {centroidsMap.size > 0 && activeConflictCountries.size > 0 && (
        <Suspense fallback={null}>
          <GlobeConflictIndicators
            countryCentroids={centroidsMap}
            activeConflictCountries={activeConflictCountries}
            globeRadius={GLOBE_RADIUS}
          />
        </Suspense>
      )}

      {/* Trade routes */}
      {lodConfig.enableTradeRoutes && tradeRoutes.length > 0 && centroidsMap.size > 0 && (
        <GlobeTradeRoutes
          tradeRoutes={tradeRoutes}
          countryCentroids={centroidsMap}
          globeRadius={GLOBE_RADIUS}
          onCameraTarget={handleCameraTarget}
        />
      )}

      {/* Event pulse */}
      {lodConfig.enableEventPulse && globalEvents.length > 0 && centroidsMap.size > 0 && (
        <GlobeEventPulse
          globalEvents={globalEvents}
          countryCentroids={centroidsMap}
          globeRadius={GLOBE_RADIUS}
          onCameraTarget={handleCameraTarget}
        />
      )}

      {/* Event labels */}
      {centroidsMap.size > 0 && (
        <GlobeEventLabels
          globalEvents={globalEvents}
          countryCentroids={centroidsMap}
          globeRadius={GLOBE_RADIUS}
          wars={wars}
          tradeRoutes={tradeRoutes}
          alliances={alliances}
          sanctions={sanctions}
          spyOps={spyOps}
        />
      )}

      {/* Alliance beams */}
      {lodConfig.enableAllianceBeam && alliances.length > 0 && centroidsMap.size > 0 && (
        <GlobeAllianceBeam
          alliances={alliances}
          centroidsMap={centroidsMap}
          globeRadius={GLOBE_RADIUS}
        />
      )}

      {/* Sanction barriers — tycoonMode에서는 비활성화 */}
      {!tycoonMode && lodConfig.enableSanctionBarrier && sanctions.length > 0 && centroidsMap.size > 0 && (
        <GlobeSanctionBarrier
          sanctions={sanctions}
          centroidsMap={centroidsMap}
          globeRadius={GLOBE_RADIUS}
          distanceLODRef={distanceLODRef}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Resource glow */}
      {lodConfig.enableResourceGlow && resources.length > 0 && centroidsMap.size > 0 && (
        <GlobeResourceGlow
          resources={resources}
          centroidsMap={centroidsMap}
          globeRadius={GLOBE_RADIUS}
          distanceLODRef={distanceLODRef}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Spy trails — tycoonMode에서는 비활성화 */}
      {!tycoonMode && lodConfig.enableSpyTrail && spyOps.length > 0 && centroidsMap.size > 0 && (
        <GlobeSpyTrail
          spyOps={spyOps}
          centroidsMap={centroidsMap}
          globeRadius={GLOBE_RADIUS}
          distanceLODRef={distanceLODRef}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Nuke effects — tycoonMode에서는 비활성화 */}
      {!tycoonMode && lodConfig.enableNukeEffect && nukes.length > 0 && centroidsMap.size > 0 && (
        <GlobeNukeEffect
          nukes={nukes}
          centroidsMap={centroidsMap}
          globeRadius={GLOBE_RADIUS}
          onCameraTarget={handleCameraTarget}
        />
      )}

      {/* Bloom post-processing — v33 Phase 5: HIGH 품질에서만 활성화 */}
      {!isMobile && <AdaptiveBloom qualityRef={qualityRef} />}
    </SharedTickContext.Provider>
    </AdaptiveQualityContext.Provider>
  );
}

// ─── Main Export ───

export function GlobeView({
  countryStates,
  onCountryClick,
  style,
  dominationStates,
  wars,
  onHover,
  tradeRoutes,
  globalEvents,
  introActive,
  onIntroComplete,
  activeConflictCountries,
  alliances,
  sanctions,
  resources,
  spyOps,
  nukes,
  onReady,
  paused,
  dottedMode,
  tycoonDominationStates,
  tycoonArmyMovements,
}: GlobeViewProps) {
  const domStates = dominationStates ?? EMPTY_DOM_MAP;
  const warList = wars ?? EMPTY_ARRAY;
  const cStates = countryStates ?? EMPTY_STATE_MAP;
  const tradeList = tradeRoutes ?? EMPTY_ARRAY;
  const eventList = globalEvents ?? EMPTY_ARRAY;
  const conflictSet = activeConflictCountries ?? EMPTY_SET;
  const allianceList = alliances ?? EMPTY_ARRAY;
  const sanctionList = sanctions ?? EMPTY_ARRAY;
  const resourceList = resources ?? EMPTY_ARRAY;
  const spyOpList = spyOps ?? EMPTY_ARRAY;
  const nukeList = nukes ?? EMPTY_ARRAY;

  const cameraStartPos: [number, number, number] = introActive
    ? [0, 120, 480]
    : [0, 0, 300];

  return (
    <div style={{ width: '100%', height: '100%', background: BG, position: 'relative', ...style }}>
      <Canvas
        camera={{ position: cameraStartPos, fov: 50, near: 1, far: 1000 }}
        gl={{ antialias: true, alpha: false, toneMappingExposure: 1.0 }}
        dpr={[1, 2]}
        frameloop={paused ? 'demand' : 'always'}
        onCreated={({ gl }) => { gl.setClearColor(BG); onReady?.(); }}
      >
        <FrameloopKick paused={paused} />
        <SizeGate>
          <GlobeScene
            onCountryClick={onCountryClick}
            onHover={onHover}
            dominationStates={domStates}
            wars={warList}
            countryStates={cStates}
            tradeRoutes={tradeList}
            globalEvents={eventList}
            introActive={introActive}
            onIntroComplete={onIntroComplete}
            activeConflictCountries={conflictSet}
            alliances={allianceList}
            sanctions={sanctionList}
            resources={resourceList}
            spyOps={spyOpList}
            nukes={nukeList}
            dottedMode={dottedMode}
            tycoonDominationStates={tycoonDominationStates}
            tycoonArmyMovements={tycoonArmyMovements}
          />
        </SizeGate>
      </Canvas>
    </div>
  );
}
