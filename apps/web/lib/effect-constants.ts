/**
 * effect-constants.ts -- v24 Globe Effects Overhaul: Unified Design Tokens
 *
 * "Holographic War Room" 통일 디자인 시스템의 단일 진실 소스(SSOT).
 * 13개 3D 이펙트 + 7개 2D 오버레이가 참조하는 모든 시각 파라미터를 정의한다.
 *
 * 기존 팔레트 매핑:
 *   sketch-ui.ts SK.red    (#EF4444) -> war    (#FF3333) : HDR 호환 밝은 적색
 *   sketch-ui.ts SK.blue   (#6366F1) -> alliance (#3388FF) : 더 채도 높은 시안블루
 *   sketch-ui.ts SK.green  (#10B981) -> trade   (#33CC66) : 밝은 에메랄드
 *   sketch-ui.ts SK.gold   (#F59E0B) -> resource (#CCAA33) : 따뜻한 앰버
 *   GlobeAllianceBeam BEAM_HDR (#4488ff) -> alliance (#3388FF) : 미세 조정
 *   GlobeSpyTrail SPY_COLOR (#9966cc) -> spy      (#9955CC) : 미세 조정
 *   GlobeSanctionBarrier SANCTION_COLOR (#cc3333) -> sanction (#CC6633) : 전쟁 적색과 분리
 *   NewsFeed war_declared  (#FF0000) -> war (#FF3333) : 3D 이펙트와 동기화
 *   NewsFeed treaty_signed (#3B82F6) -> alliance (#3388FF) : 3D 이펙트와 동기화
 *   NewsFeed economy_event (#CC9933) -> resource (#CCAA33) : 3D 이펙트와 동기화
 *   map-style.ts sovereigntyColors : 지배권 색상은 별도 유지 (이펙트 색상과 용도가 다름)
 *   globe-data.ts factionColorPalette : 팩션 색상은 별도 유지
 */

import * as THREE from 'three';

// ===================================================================
// 1. Event Color Language (plan Section 3.1)
// ===================================================================

/**
 * 8개 이벤트 유형별 통일 색상.
 * hex: 기본 색상, hdr: Bloom 배수, css: 2D 오버레이용.
 */
export const EFFECT_COLORS = {
  /** 전쟁/공격 -- 위험 적색 */
  war:       { hex: '#FF3333', hdr: 2.5, css: 'rgba(255, 51, 51, 1)' },
  /** 동맹/외교 -- 전술 청색 */
  alliance:  { hex: '#3388FF', hdr: 2.5, css: 'rgba(51, 136, 255, 1)' },
  /** 교역/경제 -- 에너지 녹색 */
  trade:     { hex: '#33CC66', hdr: 2.0, css: 'rgba(51, 204, 102, 1)' },
  /** 자원/채굴 -- 금광 황색 */
  resource:  { hex: '#CCAA33', hdr: 2.5, css: 'rgba(204, 170, 51, 1)' },
  /** 첩보/스파이 -- 암자색 */
  spy:       { hex: '#9955CC', hdr: 2.0, css: 'rgba(153, 85, 204, 1)' },
  /** 제재/차단 -- 경고 오렌지 */
  sanction:  { hex: '#CC6633', hdr: 2.0, css: 'rgba(204, 102, 51, 1)' },
  /** 핵/대량살상 -- 백열 백색→오렌지 (시작 색) */
  nuke:      { hex: '#FFAA33', hdr: 3.0, css: 'rgba(255, 170, 51, 1)' },
  /** 핵 감쇠 후 색 */
  nukeDecay: { hex: '#666666', hdr: 1.0, css: 'rgba(102, 102, 102, 1)' },
  /** 시대/에포크 전환 -- 금색 */
  epoch:     { hex: '#FFCC44', hdr: 2.5, css: 'rgba(255, 204, 68, 1)' },
} as const;

/** 이벤트 유형 키 타입 (nukeDecay 제외) */
export type EffectEventType = Exclude<keyof typeof EFFECT_COLORS, 'nukeDecay'>;

// ===================================================================
// 2. Pre-constructed THREE.Color instances (module scope, GC 방지)
// ===================================================================

/**
 * HDR 배수가 적용된 THREE.Color 인스턴스.
 * Bloom 후처리와 호환되며, 프레임 루프에서 할당 없이 참조 가능.
 *
 * 사용법: material.color.copy(COLORS_3D.war)
 */
export const COLORS_3D = {
  war:      new THREE.Color(EFFECT_COLORS.war.hex).multiplyScalar(EFFECT_COLORS.war.hdr),
  alliance: new THREE.Color(EFFECT_COLORS.alliance.hex).multiplyScalar(EFFECT_COLORS.alliance.hdr),
  trade:    new THREE.Color(EFFECT_COLORS.trade.hex).multiplyScalar(EFFECT_COLORS.trade.hdr),
  resource: new THREE.Color(EFFECT_COLORS.resource.hex).multiplyScalar(EFFECT_COLORS.resource.hdr),
  spy:      new THREE.Color(EFFECT_COLORS.spy.hex).multiplyScalar(EFFECT_COLORS.spy.hdr),
  sanction: new THREE.Color(EFFECT_COLORS.sanction.hex).multiplyScalar(EFFECT_COLORS.sanction.hdr),
  nuke:     new THREE.Color(EFFECT_COLORS.nuke.hex).multiplyScalar(EFFECT_COLORS.nuke.hdr),
  nukeDecay: new THREE.Color(EFFECT_COLORS.nukeDecay.hex).multiplyScalar(EFFECT_COLORS.nukeDecay.hdr),
  epoch:    new THREE.Color(EFFECT_COLORS.epoch.hex).multiplyScalar(EFFECT_COLORS.epoch.hdr),
} as const;

/**
 * HDR 미적용 기본 THREE.Color (라인/대시 등 Bloom 비적용 용도).
 */
export const COLORS_BASE = {
  war:      new THREE.Color(EFFECT_COLORS.war.hex),
  alliance: new THREE.Color(EFFECT_COLORS.alliance.hex),
  trade:    new THREE.Color(EFFECT_COLORS.trade.hex),
  resource: new THREE.Color(EFFECT_COLORS.resource.hex),
  spy:      new THREE.Color(EFFECT_COLORS.spy.hex),
  sanction: new THREE.Color(EFFECT_COLORS.sanction.hex),
  nuke:     new THREE.Color(EFFECT_COLORS.nuke.hex),
  epoch:    new THREE.Color(EFFECT_COLORS.epoch.hex),
} as const;

// ===================================================================
// 3. Unified Arc Heights (plan Section 3.2)
// ===================================================================

/**
 * 이벤트 유형별 아크 높이 계수.
 * 값: globeRadius 기준이 아니라 두 점 사이 거리(dist) 기준 비율.
 * 공식: controlPoint = midpoint + normal * (dist * ARC_HEIGHT[type])
 *
 * 기존값 -> 신규값:
 *   trade:    0.15 -> 0.35 (교역 라인도 뚜렷하게)
 *   spy:      0.20 -> 0.25 (은밀함 유지하되 상향)
 *   sanction: 0.25 -> 0.30 (낮고 무거운 느낌)
 *   war:      0.25 -> 0.45 (공격적으로 높게)
 *   alliance: 0.30 -> 0.50 (가장 높고 우아하게)
 *   missile:  0.35 -> 0.60 (가장 극적인 포물선)
 */
export const ARC_HEIGHT = {
  trade:    0.35,
  spy:      0.25,
  sanction: 0.30,
  war:      0.45,
  alliance: 0.50,
  missile:  0.60,
} as const;

// ===================================================================
// 4. Unified Surface Altitude (plan Section 3.3)
// ===================================================================

/**
 * 표면 고도 3단계.
 * 값: globeRadius에 더하는 오프셋 (단위: 동일 스케일).
 *
 * 기존 상태: 0.3 ~ 2.0+ 범위에 7가지 값이 제각각 사용됨.
 * 통일 후: 3단계로 정리.
 *
 *   GROUND (+0.5): 표면 부착형 — 글로우 링, 충격파, 지배 오버레이
 *   LOW    (+1.0): 저공형 — 교역 카고, 스파이 점선, 제재 X마크, 아크 기점
 *   HIGH   (+1.5): 고공형 — 충돌 아이콘, 이벤트 펄스, 랜드마크 스프라이트
 */
export const SURFACE_ALT = {
  GROUND: 0.5,
  LOW:    1.0,
  HIGH:   1.5,
} as const;

// ===================================================================
// 5. Unified renderOrder (plan Section 3.4)
// ===================================================================

/**
 * 8개 레이어 renderOrder 범위.
 * z-fighting과 깜빡임 방지를 위해 체계적으로 배정.
 *
 * 기존 상태: 3~110 범위에 비체계적 배정.
 */
export const RENDER_ORDER = {
  // Layer 1: 지배 레이어 (1-9)
  DOMINATION:        5,

  // Layer 2: 표면 이펙트 (10-19)
  SURFACE_GLOW:     10,   // ResourceGlow ring, Shockwave
  SURFACE_RING:     12,   // SanctionBarrier ring

  // Layer 3: 아크 라인 (20-29)
  ARC_TRADE:        20,
  ARC_SPY:          21,
  ARC_SANCTION:     22,
  ARC_WAR:          23,
  ARC_ALLIANCE:     24,

  // Layer 4: 비행 오브젝트 (30-39)
  CARGO:            30,   // Trade cargo meshes
  MISSILE_SMOKE:    31,
  MISSILE_HEAD:     32,
  PARTICLES:        33,   // Alliance particles, ResourceGlow particles

  // Layer 5: 폭발 (40-49)
  NUKE_SHOCKWAVE:   40,
  NUKE_PILLAR:      41,
  NUKE_CLOUD:       42,
  WAR_FIREWORKS:    43,

  // Layer 6: 아이콘 (50-59)
  SANCTION_XMARK:   50,
  SPY_EYE:          51,
  CONFLICT_RING:    52,
  CONFLICT_ICON:    53,
  EVENT_PULSE:      55,

  // Layer 7: 랜드마크 (90-99)
  LANDMARK_MESH:    95,
  LANDMARK_SPRITE:  98,

  // Layer 8: 라벨 (100)
  COUNTRY_LABEL:   100,

  // Layer 9: 이벤트 라벨 (110-119) — v28 Globe Event Labels
  EVENT_LABEL_LINE:  110,   // Leader line
  EVENT_LABEL_TAG:   112,   // Event briefing label
  ARC_KEYWORD_TAG:   115,   // Arc midpoint keyword tag
} as const;

// ===================================================================
// 6. Unified Animation Timing (plan Section 3.5)
// ===================================================================

/**
 * 애니메이션 타이밍 상수 (초 단위).
 * 각 항목에 대응하는 easing 함수는 effect-utils.ts에 정의.
 */
export const TIMING = {
  /** 펄스/글로우 루프 범위 (sin wave) */
  PULSE_LOOP:   { min: 1.5, max: 3.0 },
  /** 이벤트 등장 (easeOutCubic) */
  EVENT_ENTER:  0.300,
  /** 이벤트 퇴장 (easeInQuad) */
  EVENT_EXIT:   0.500,
  /** 아크 라인 생성 (easeOutQuart) */
  ARC_CREATE:   0.800,
  /** 카메라 이동 (easeInOutCubic) */
  CAMERA_MOVE:  2.000,
  /** 카메라 쉐이크 (linear decay) */
  CAMERA_SHAKE: 0.400,
} as const;

// ===================================================================
// 7. Camera Event Priority (plan Section FR-2)
// ===================================================================

/**
 * 카메라 이벤트 우선순위 (높을수록 우선).
 * 높은 우선순위 이벤트가 현재 카메라 애니메이션을 중단 가능.
 */
export const CAMERA_PRIORITY = {
  nuke:     5,
  war:      4,
  epoch:    3,
  alliance: 2,
  trade:    1,
} as const;

export type CameraEventType = keyof typeof CAMERA_PRIORITY;

// ===================================================================
// 8. Arc Segment Counts (LOD dependent)
// ===================================================================

/**
 * LOD별 아크 세그먼트 수.
 * close: 풀 디테일, mid: 절반, far: 최소.
 */
export const ARC_SEGMENTS = {
  HIGH:   64,   // close LOD
  MEDIUM: 32,   // mid LOD
  LOW:    16,   // far LOD
} as const;

// ===================================================================
// 9. LOD Distance Thresholds (v24 Phase 6: 3-tier camera-distance LOD)
// ===================================================================

/**
 * 카메라 거리 기반 3단계 LOD 임계값.
 * 히스테리시스 버퍼(20 단위)로 경계 근처 빠른 전환 방지.
 *
 *   close (< 200): 풀 디테일 — 모든 파티클, 64-segment 아크, 모든 아이콘
 *   mid (200-350): 중간 — 파티클 50%, 32-segment 아크, 카고 비표시
 *   far (> 350): 최소 — 아크 라인만 (정적), 파티클/아이콘 비표시
 */
export const LOD_DISTANCE = {
  /** close → mid 전환 거리 (히스테리시스 적용: 200 + 10) */
  CLOSE_TO_MID: 210,
  /** mid → close 전환 거리 (히스테리시스 적용: 200 - 10) */
  MID_TO_CLOSE: 190,
  /** mid → far 전환 거리 (히스테리시스 적용: 350 + 10) */
  MID_TO_FAR: 360,
  /** far → mid 전환 거리 (히스테리시스 적용: 350 - 10) */
  FAR_TO_MID: 340,
} as const;

/** 카메라 거리 LOD 티어 타입 */
export type DistanceLODTier = 'close' | 'mid' | 'far';

// ===================================================================
// 10. Reduced Motion Accessibility (v24 Phase 6)
// ===================================================================

/**
 * prefers-reduced-motion 감지 시 적용할 기본값.
 * 파티클/쉐이크/펄스 비활성화, 아크는 정적 라인으로 표시.
 */
export const REDUCED_MOTION = {
  /** 파티클 표시 여부 */
  showParticles: false,
  /** 펄스/글로우 애니메이션 여부 */
  enablePulse: false,
  /** 카메라 쉐이크 여부 */
  enableShake: false,
  /** 링 회전 여부 */
  enableRotation: false,
  /** 아이콘 크기 진동 여부 */
  enableScaleOscillation: false,
  /** 대시 라인 애니메이션 여부 (false → 정적 라인) */
  enableDashAnimation: false,
  /** 고정 opacity (펄스 대신) */
  staticOpacity: 0.6,
} as const;

// ===================================================================
// 11. Centroid Prop Type (Phase 1: 타입 정의만, 리네임은 각 Phase에서 점진적 적용)
// ===================================================================

/**
 * 통일된 centroid prop 타입.
 * 현재 5곳에서 `centroidsMap`, 7곳에서 `countryCentroids`로 사용 중.
 * 통일 방향: `countryCentroids` (다수파 + 명확한 의미).
 *
 * Phase 1에서는 타입만 정의하고, 실제 prop 리네임은 각 Phase에서 수행.
 */
export type CountryCentroidsMap = Map<string, [number, number]>;

// ===================================================================
// 12. Sound Cue Interface (v24 Phase 7: hook point for future audio)
// ===================================================================

/**
 * 사운드 큐 이벤트 타입.
 * 3D 이펙트 발생 시 사운드 시스템에 전달하는 오디오 큐.
 * 실제 사운드 구현은 별도 버전에서 — 여기는 인터페이스만 정의.
 *
 * 사용 패턴:
 *   <GlobeWarEffects onSoundCue={(cue) => audioManager.play(cue)} ... />
 */
export interface SoundCue {
  /** 사운드 이벤트 유형 */
  type: 'war_declared' | 'nuke_launched' | 'epoch_change' | 'alliance_formed' | 'trade_started';
  /** 사운드 강도 (0: 무음 ~ 1: 최대) */
  intensity: number;
  /** 사운드 발생 좌표 [lat, lng] — 3D 공간 오디오용 (optional) */
  position?: [number, number];
}

/**
 * 사운드 큐 콜백 타입.
 * 이펙트 컴포넌트에서 prop으로 전달받아 사운드 시스템과 연결.
 *
 * 예시:
 *   const handleSoundCue: OnSoundCue = (cue) => {
 *     if (cue.type === 'nuke_launched') playNukeSound(cue.intensity);
 *   };
 */
export type OnSoundCue = (cue: SoundCue) => void;
