'use client';

/**
 * GlobeEventPulse — v15 Phase 5
 * Global event visual effects on the 3D globe:
 * - Alliance: blue ring expanding from centroid
 * - Policy: purple wave
 * - Epoch: gold wave
 * - Truce: white/olive ring
 * - Embargo: red X mark
 *
 * Event queue system: max 3 simultaneous, rest in FIFO queue.
 * Each ring effect: RingGeometry, 2s expand → fade out.
 */

import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { CAMERA_PRIORITY } from '@/lib/effect-constants';

// ─── Types ───

export interface GlobalEventData {
  id: string;
  type: string;
  message: string;
  timestamp: number;
}

export interface GlobeEventPulseProps {
  /** Global events array from uiState */
  globalEvents: GlobalEventData[];
  /** Map of ISO3 → [lat, lng] country centroids */
  countryCentroids: Map<string, [number, number]>;
  /** Globe radius (must match globe mesh) */
  globeRadius?: number;
  /** Visibility toggle */
  visible?: boolean;
  /** v15 Phase 6: Callback when camera should focus on an event position
   *  v24: priority 파라미터 추가 (epoch=3, alliance=2)
   */
  onCameraTarget?: (position: THREE.Vector3, priority?: number) => void;
}

// ─── Constants ───

const DEFAULT_GLOBE_RADIUS = 100;
const MAX_SIMULTANEOUS = 3;       // 동시 최대 3개 이펙트
const PULSE_DURATION = 2.0;       // 2초 확산→소멸
const PULSE_MAX_SCALE = 15;       // 링 최대 반경 (구면 위)
const RING_INNER_RATIO = 0.85;    // 링 내경/외경 비율

// 이벤트 타입별 색상 매핑
const EVENT_COLORS: Record<string, THREE.Color> = {
  alliance: new THREE.Color(0x3388ff),     // 파란 링
  policy: new THREE.Color(0x8833cc),       // 보라 파동
  epoch: new THREE.Color(0xffcc33),        // 골드 웨이브
  truce: new THREE.Color(0xccddaa),        // 백색 올리브 링
  embargo: new THREE.Color(0xff3333),      // 적색
  // 기본 (알 수 없는 타입)
  default: new THREE.Color(0xaaaaaa),
};

// ─── Helpers ───
// latLngToVector3 → @/lib/globe-utils (v20 통합)

/** 이벤트 타입 → 색상 */
function getEventColor(type: string): THREE.Color {
  // message/type에 키워드가 포함되면 매칭
  const normalizedType = type.toLowerCase();
  if (normalizedType.includes('alliance') || normalizedType.includes('동맹')) return EVENT_COLORS.alliance;
  if (normalizedType.includes('policy') || normalizedType.includes('정책')) return EVENT_COLORS.policy;
  if (normalizedType.includes('epoch') || normalizedType.includes('에포크')) return EVENT_COLORS.epoch;
  if (normalizedType.includes('truce') || normalizedType.includes('휴전')) return EVENT_COLORS.truce;
  if (normalizedType.includes('embargo') || normalizedType.includes('금수')) return EVENT_COLORS.embargo;
  return EVENT_COLORS[type] ?? EVENT_COLORS.default;
}

/** 이벤트 메시지에서 국가 코드 추출 (단순 패턴 매칭) */
function extractCountryFromEvent(event: GlobalEventData, centroids: Map<string, [number, number]>): string | null {
  // 이벤트 메시지에서 알려진 국가 코드 매칭 시도
  for (const iso3 of centroids.keys()) {
    if (event.message.includes(iso3)) return iso3;
  }
  // 없으면 첫 번째 국가를 기본값으로 (분산 표시)
  return null;
}

// ─── Internal pulse state ───

interface ActivePulse {
  id: string;
  startTime: number;
  position: THREE.Vector3;
  normal: THREE.Vector3;
  color: THREE.Color;
  type: string;
}

// ─── Component ───

export function GlobeEventPulse({
  globalEvents,
  countryCentroids,
  globeRadius = DEFAULT_GLOBE_RADIUS,
  visible = true,
  onCameraTarget,
}: GlobeEventPulseProps) {
  const groupRef = useRef<THREE.Group>(null);

  // 활성 펄스 (최대 MAX_SIMULTANEOUS)
  const activePulsesRef = useRef<ActivePulse[]>([]);
  // 대기열
  const queueRef = useRef<GlobalEventData[]>([]);
  // 처리 완료된 이벤트 ID 세트
  const processedRef = useRef<Set<string>>(new Set());

  // 링 geometry (공유, 1회 생성)
  const ringGeo = useMemo(() => {
    return new THREE.RingGeometry(RING_INNER_RATIO, 1, 32);
  }, []);

  // X 마크 geometry (embargo용)
  const xGeo = useMemo(() => {
    const shape = new THREE.BufferGeometry();
    const verts = new Float32Array([
      // 대각선 1
      -0.5, -0.5, 0,  0.5, 0.5, 0,
      // 대각선 2
      0.5, -0.5, 0,  -0.5, 0.5, 0,
    ]);
    shape.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    return shape;
  }, []);

  // 링/X용 머티리얼 풀 (최대 MAX_SIMULTANEOUS × 2 재사용)
  const materials = useMemo(() => {
    const mats: THREE.MeshBasicMaterial[] = [];
    for (let i = 0; i < MAX_SIMULTANEOUS; i++) {
      mats.push(new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
    }
    return mats;
  }, []);

  // 메쉬 풀
  const meshPool = useMemo(() => {
    const meshes: THREE.Mesh[] = [];
    for (let i = 0; i < MAX_SIMULTANEOUS; i++) {
      const mesh = new THREE.Mesh(ringGeo, materials[i]);
      mesh.visible = false;
      mesh.renderOrder = 5;
      meshes.push(mesh);
    }
    return meshes;
  }, [ringGeo, materials]);

  // 이벤트 위치 결정 (국가 centroid 또는 랜덤 분산)
  const getEventPosition = useCallback((event: GlobalEventData): { position: THREE.Vector3; normal: THREE.Vector3 } | null => {
    const iso3 = extractCountryFromEvent(event, countryCentroids);
    if (iso3) {
      const centroid = countryCentroids.get(iso3);
      if (centroid) {
        const pos = latLngToVector3(centroid[0], centroid[1], globeRadius + 0.8);
        const normal = pos.clone().normalize();
        return { position: pos, normal };
      }
    }

    // 국가 매칭 실패 시: 랜덤 centroid 선택
    const keys = Array.from(countryCentroids.keys());
    if (keys.length === 0) return null;
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const centroid = countryCentroids.get(randomKey)!;
    const pos = latLngToVector3(centroid[0], centroid[1], globeRadius + 0.8);
    const normal = pos.clone().normalize();
    return { position: pos, normal };
  }, [countryCentroids, globeRadius]);

  // 매 프레임 업데이트
  useFrame(() => {
    if (!visible || !groupRef.current) return;

    const now = performance.now() / 1000;

    // 1. 새로운 이벤트를 대기열에 추가
    for (const event of globalEvents) {
      if (!processedRef.current.has(event.id)) {
        processedRef.current.add(event.id);
        queueRef.current.push(event);
      }
    }

    // 2. 만료된 활성 펄스 제거
    activePulsesRef.current = activePulsesRef.current.filter(pulse => {
      return (now - pulse.startTime) < PULSE_DURATION;
    });

    // 3. 빈 슬롯에 대기열에서 꺼내서 활성화
    let cameraFocusTriggered = false;
    while (
      activePulsesRef.current.length < MAX_SIMULTANEOUS &&
      queueRef.current.length > 0
    ) {
      const event = queueRef.current.shift()!;
      const posData = getEventPosition(event);
      if (!posData) continue;

      const eventType = event.type.toLowerCase();
      activePulsesRef.current.push({
        id: event.id,
        startTime: now,
        position: posData.position,
        normal: posData.normal,
        color: getEventColor(eventType),
        type: eventType,
      });

      // v15 Phase 6 + v24: 주요 이벤트 시 카메라 포커스 (epoch=3, alliance=2)
      if (!cameraFocusTriggered && onCameraTarget) {
        const isEpoch = eventType.includes('epoch') || eventType.includes('에포크');
        const isAlliance = eventType.includes('alliance') || eventType.includes('동맹');
        if (isEpoch || isAlliance) {
          const priority = isEpoch ? CAMERA_PRIORITY.epoch : CAMERA_PRIORITY.alliance;
          onCameraTarget(posData.position, priority);
          cameraFocusTriggered = true;
        }
      }
    }

    // 4. 메쉬 풀 업데이트
    for (let i = 0; i < MAX_SIMULTANEOUS; i++) {
      const mesh = meshPool[i];
      const mat = materials[i];

      if (i < activePulsesRef.current.length) {
        const pulse = activePulsesRef.current[i];
        const progress = (now - pulse.startTime) / PULSE_DURATION;

        if (progress >= 1) {
          mesh.visible = false;
          continue;
        }

        mesh.visible = true;

        // 이벤트 타입에 따른 geometry 전환
        const isEmbargo = pulse.type.includes('embargo') || pulse.type.includes('금수');
        if (isEmbargo && mesh.geometry !== xGeo) {
          mesh.geometry = xGeo;
        } else if (!isEmbargo && mesh.geometry !== ringGeo) {
          mesh.geometry = ringGeo;
        }

        // 색상
        mat.color.copy(pulse.color);

        // 스케일: 0 → PULSE_MAX_SCALE (easeOutCubic)
        const eased = 1 - Math.pow(1 - progress, 3);
        const scale = eased * PULSE_MAX_SCALE;
        mesh.scale.setScalar(scale);

        // opacity: 1 → 0 (easeInQuad)
        mat.opacity = Math.pow(1 - progress, 2);

        // 위치: 국가 centroid
        mesh.position.copy(pulse.position);

        // 방향: 구면 법선 방향으로 정렬 (billboard 대신 구면 접선면)
        mesh.lookAt(pulse.position.clone().multiplyScalar(2));
      } else {
        mesh.visible = false;
      }
    }

    // 5. 처리된 이벤트 ID 캐시 정리 (최대 200개 유지)
    if (processedRef.current.size > 200) {
      const ids = Array.from(processedRef.current);
      processedRef.current = new Set(ids.slice(-100));
    }
  });

  // 메쉬 풀을 그룹에 마운트
  return (
    <group ref={groupRef} visible={visible}>
      {meshPool.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </group>
  );
}
