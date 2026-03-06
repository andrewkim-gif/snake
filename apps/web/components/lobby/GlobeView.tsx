'use client';

/**
 * GlobeView — three-globe 3D 지구본
 * 실사 렌더링: NASA Blue Marble 바다 텍스처 + 얇은 대기 림 + 자동 회전 없음
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CountryClientState, GeoJSONData } from '@/lib/globe-data';
import { loadGeoJSON, factionColorPalette } from '@/lib/globe-data';
import { sovereigntyColors, getCountryISO, getCountryName } from '@/lib/map-style';

// three-globe dynamic import 타입
type ThreeGlobeInstance = import('three-globe').default;
let ThreeGlobeClass: (new () => ThreeGlobeInstance) | null = null;

interface GlobeViewProps {
  countryStates?: Map<string, CountryClientState>;
  selectedCountry?: string | null;
  onCountryClick?: (iso3: string, name: string) => void;
  style?: React.CSSProperties;
}

// hex → rgba 변환 (반투명 오버레이용)
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// v12 S21: 팩션 이름 → 색상 인덱스 (해시 기반, 안정적 매핑)
const _factionColorCache = new Map<string, string>();
function getFactionHexColor(factionId: string): string {
  if (!factionId) return sovereigntyColors.unclaimed;
  const cached = _factionColorCache.get(factionId);
  if (cached) return cached;
  // 간단한 해시: 문자열 → 인덱스
  let hash = 0;
  for (let i = 0; i < factionId.length; i++) {
    hash = ((hash << 5) - hash + factionId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % factionColorPalette.length;
  const color = factionColorPalette[idx];
  _factionColorCache.set(factionId, color);
  return color;
}

// v12 S21: 주권 레벨 (0-5) → opacity (0.3 ~ 1.0)
function sovereigntyLevelToOpacity(level: number): number {
  if (level <= 0) return 0.3;
  // Lv1=0.44, Lv2=0.58, Lv3=0.72, Lv4=0.86, Lv5=1.0
  return Math.min(1.0, 0.3 + level * 0.14);
}

// v12 S21: 주권 레벨 라벨
function sovereigntyLevelLabel(level: number): string {
  const labels = ['Unclaimed', 'Lv1 Influence', 'Lv2 Control', 'Lv3 Dominion', 'Lv4 Authority', 'Lv5 Sovereignty'];
  return labels[Math.min(level, 5)] || `Lv${level}`;
}

// v12 S21: hex 색상 lerp (불투명 기반 — 두 hex 색상 간 보간)
function lerpHexColor(from: string, to: string, t: number): string {
  const fr = parseInt(from.slice(1, 3), 16);
  const fg = parseInt(from.slice(3, 5), 16);
  const fb = parseInt(from.slice(5, 7), 16);
  const tr = parseInt(to.slice(1, 3), 16);
  const tg = parseInt(to.slice(3, 5), 16);
  const tb = parseInt(to.slice(5, 7), 16);
  const r = Math.round(fr + (tr - fr) * t);
  const g = Math.round(fg + (tg - fg) * t);
  const b = Math.round(fb + (tb - fb) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// GeoJSON geometry → centroid (lat/lng) 계산
function computeCentroid(geometry: { type: string; coordinates: unknown }): { lat: number; lng: number } | null {
  let ring: number[][];
  if (geometry.type === 'Polygon') {
    ring = (geometry.coordinates as number[][][])[0];
  } else if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates as number[][][][];
    let maxLen = 0;
    ring = [];
    for (const p of polys) {
      if (p[0].length > maxLen) { maxLen = p[0].length; ring = p[0]; }
    }
  } else return null;
  if (!ring.length) return null;
  let sLng = 0, sLat = 0;
  for (const [lng, lat] of ring) { sLng += lng; sLat += lat; }
  return { lng: sLng / ring.length, lat: sLat / ring.length };
}

// v12 S21: 호버 데이터 타입
interface HoverInfo {
  iso3: string;
  name: string;
  faction: string;
  level: number;
  screenX: number;
  screenY: number;
}

// Globe 3D 오브젝트 컴포넌트
function GlobeObject({
  countryStates,
  selectedCountry,
  onCountryClick,
  onHoverCountry,
}: Omit<GlobeViewProps, 'style' | 'autoRotate'> & {
  onHoverCountry?: (info: HoverInfo | null) => void;
}) {
  const globeRef = useRef<ThreeGlobeInstance | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const labelGroupRef = useRef<THREE.Group | null>(null);
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);
  const [globeReady, setGlobeReady] = useState(false);

  // GeoJSON 로딩
  useEffect(() => {
    loadGeoJSON().then(setGeoData).catch(console.error);
  }, []);

  // three-globe 인스턴스 생성
  useEffect(() => {
    if (!geoData) return;

    let cancelled = false;

    (async () => {
      if (!ThreeGlobeClass) {
        const mod = await import('three-globe');
        ThreeGlobeClass = mod.default as unknown as new () => ThreeGlobeInstance;
      }
      if (cancelled) return;

      // three-globe의 ThreeDigest는 d.id로 폴리곤을 식별함
      // GeoJSON feature에 id 없으면 전부 undefined → 1개만 생성됨 (근본 버그)
      const polys = geoData.features
        .filter((f) => f.geometry.type !== 'Point')
        .map((f, i) => ({
          ...f,
          id: (f.properties.ADM0_A3 as string) || String(i),
        }));
      console.log('[GLOBE-DBG] GeoJSON polys:', polys.length, 'first id:', polys[0]?.id);

      // animateIn: false → scale tween 비활성화 (R3F의 rAF와 충돌 방지)
      // waitForGlobeReady: false → visible 즉시 true (텍스쳐 로딩 대기 안 함)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globe = new (ThreeGlobeClass as any)({ animateIn: false, waitForGlobeReady: false });
      // polygonsTransitionDuration(0): polygonsData보다 먼저 설정 필수!
      // 기본값 1000ms → altitude tween이 -0.001(지구 표면 안쪽)에서 시작 → z-fighting
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globe as any).polygonsTransitionDuration(0);

      globe
        // .globeImageUrl('/textures/earth-blue-marble.jpg') // 디버그: 텍스쳐 제거하여 렌더링 문제 격리
        .showGlobe(true)
        .showAtmosphere(false)
        .polygonsData(polys)
        .polygonCapColor((feat: object) => {
          const f = feat as { properties: Record<string, unknown> };
          const iso3 = getCountryISO(f.properties);
          const state = countryStates?.get(iso3);
          // v12 S21: 팩션 색상 + 주권 레벨 기반 opacity
          if (state?.battleStatus === 'in_battle') return sovereigntyColors.atWar;
          if (state?.sovereignFaction) {
            const factionColor = getFactionHexColor(state.sovereignFaction);
            // 불투명 기반 — 주권 레벨로 밝기 조절 (MeshBasicMaterial 기반이므로 hex RGB로)
            const lvl = state.sovereigntyLevel ?? 0;
            const intensity = sovereigntyLevelToOpacity(lvl);
            // 색상 강도를 intensity로 조절 (어두운 배경 위에서 밝기 변화)
            return lerpHexColor('#1a1a2e', factionColor, intensity);
          }
          return sovereigntyColors.unclaimed;
        })
        .polygonSideColor(() => '#1a1a2e')
        .polygonStrokeColor(() => 'rgba(255, 255, 255, 0.4)')
        .polygonAltitude((feat: object) => {
          const f = feat as { properties: Record<string, unknown> };
          const iso3 = getCountryISO(f.properties);
          if (selectedCountry && iso3 === selectedCountry) return 0.02;
          return 0.015; // z-fighting 방지: 기존 0.006→0.015
        });

      // Globe material: 텍스쳐 없는 상태 — 짙은 바다색 구체 (폴리곤 대비 극대화)
      const globeMat = globe.globeMaterial() as THREE.MeshPhongMaterial;
      globeMat.color = new THREE.Color('#0a1628'); // 짙은 네이비
      globeMat.emissive = new THREE.Color('#0d1f3c');
      globeMat.emissiveIntensity = 0.5;
      globeMat.shininess = 0;
      globeMat.specular = new THREE.Color('#000000');

      if (groupRef.current) {
        if (globeRef.current) {
          groupRef.current.remove(globeRef.current as unknown as THREE.Object3D);
        }
        // 이전 라벨 그룹 제거
        if (labelGroupRef.current) {
          labelGroupRef.current.traverse((child) => {
            if (child instanceof THREE.Sprite) {
              child.material.map?.dispose();
              child.material.dispose();
            }
          });
          groupRef.current.remove(labelGroupRef.current);
        }

        groupRef.current.add(globe as unknown as THREE.Object3D);
        globeRef.current = globe;
        // 진단용 window 노출 (evaluate에서 접근)
        if (typeof window !== 'undefined') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__globeDebug = globe;
        }
        // 디버그: 글로브 오브젝트 상태 로그
        const gObj = globe as unknown as THREE.Object3D;
        console.log('[GLOBE-DBG] Globe added to scene', {
          visible: gObj.visible,
          position: gObj.position.toArray(),
          scale: gObj.scale.toArray(),
          childCount: gObj.children.length,
          parent: gObj.parent?.type,
        });

        // 국가 이름 라벨: 단일 캔버스 재사용 (브라우저 캔버스 컨텍스트 제한 회피)
        // 기존: 195개 캔버스 각각 getContext('2d') → 컨텍스트 제한 초과 시 TypeError
        // 수정: 1개 캔버스 재사용 + DataTexture로 픽셀 데이터 복사
        const labelGroup = new THREE.Group();
        labelGroup.name = 'country-labels';

        try {
          const sharedCanvas = document.createElement('canvas');
          const sharedCtx = sharedCanvas.getContext('2d');
          if (!sharedCtx) throw new Error('Cannot create 2D canvas context');

          let labelCount = 0;
          for (const f of polys) {
            const name = (f.properties.NAME as string) || '';
            if (!name) continue;
            const centroid = computeCentroid(f.geometry);
            if (!centroid) continue;

            try {
              const fontSize = 36;
              const shadowPad = 14;

              // 텍스트 측정 (캔버스 크기 결정)
              sharedCtx.font = `700 ${fontSize}px "Rajdhani", "Segoe UI", sans-serif`;
              const metrics = sharedCtx.measureText(name);
              const pw = Math.ceil(metrics.width) + 24 + shadowPad * 2;
              const ph = fontSize + 20 + shadowPad * 2;

              // 캔버스 리사이즈 (내용 리셋됨)
              sharedCanvas.width = pw;
              sharedCanvas.height = ph;

              // 리사이즈 후 상태 재설정 필수
              sharedCtx.font = `700 ${fontSize}px "Rajdhani", "Segoe UI", sans-serif`;
              sharedCtx.textBaseline = 'middle';
              sharedCtx.textAlign = 'center';
              const cx = pw / 2;
              const cy = ph / 2;

              // 1단계: 소프트 다크 글로우
              sharedCtx.shadowColor = 'rgba(0, 0, 0, 0.95)';
              sharedCtx.shadowBlur = 12;
              sharedCtx.shadowOffsetX = 0;
              sharedCtx.shadowOffsetY = 0;
              // 2단계: 두꺼운 다크 아웃라인
              sharedCtx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
              sharedCtx.lineWidth = 6;
              sharedCtx.lineJoin = 'round';
              sharedCtx.strokeText(name, cx, cy);
              // 3단계: 흰색 본문
              sharedCtx.shadowBlur = 0;
              sharedCtx.fillStyle = '#FFFFFF';
              sharedCtx.fillText(name, cx, cy);

              // 개별 캔버스 → CanvasTexture (가장 안정적인 방식)
              // THREE.CanvasTexture는 flipY/format을 자동 처리
              const labelCanvas = document.createElement('canvas');
              labelCanvas.width = pw;
              labelCanvas.height = ph;
              const labelCtx = labelCanvas.getContext('2d');
              if (!labelCtx) throw new Error('Label canvas context failed');
              labelCtx.drawImage(sharedCanvas, 0, 0);
              const texture = new THREE.CanvasTexture(labelCanvas);
              texture.minFilter = THREE.LinearFilter;
              texture.magFilter = THREE.LinearFilter;

              const mat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthWrite: false,
                depthTest: false,
                sizeAttenuation: true,
              });
              const sprite = new THREE.Sprite(mat);
              sprite.renderOrder = 999;
              sprite.raycast = () => {};

              // 위치: three-globe polar2Cartesian 공식
              const alt = 0.02;
              const phi = (90 - centroid.lat) * Math.PI / 180;
              const theta = (90 - centroid.lng) * Math.PI / 180;
              const r = 100 * (1 + alt);
              sprite.position.set(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.cos(phi),
                r * Math.sin(phi) * Math.sin(theta),
              );

              const baseH = 8;
              sprite.scale.set(baseH * (pw / ph), baseH, 1);
              labelGroup.add(sprite);
              labelCount++;
              if (labelCount <= 3) {
                console.log(`[GLOBE-DBG] Label "${name}":`, {
                  pos: sprite.position.toArray().map((v: number) => Math.round(v)),
                  scale: sprite.scale.toArray().map((v: number) => +v.toFixed(1)),
                  tex: `${pw}x${ph}`,
                });
              }
            } catch (labelErr) {
              // 개별 라벨 실패는 무시하고 다음 라벨 진행
              console.warn(`[GLOBE-DBG] Label failed: ${name}`, labelErr);
            }
          }
          console.log(`[GLOBE-DBG] Labels created: ${labelCount}/${polys.length}`);
        } catch (err) {
          console.error('Label system init failed:', err);
        }

        // 라벨 생성 성공/실패 무관하게 씬에 추가
        groupRef.current.add(labelGroup);
        labelGroupRef.current = labelGroup;
      }

      // 라벨 오류와 무관하게 항상 호출 (클릭 핸들러, 상태 업데이트 활성화)
      setGlobeReady(true);
    })();

    return () => {
      cancelled = true;
      // 라벨 텍스처 메모리 해제
      if (labelGroupRef.current) {
        labelGroupRef.current.traverse((child) => {
          if (child instanceof THREE.Sprite) {
            child.material.map?.dispose();
            child.material.dispose();
          }
        });
      }
    };
  }, [geoData]); // eslint-disable-line react-hooks/exhaustive-deps

  // 국가 상태/선택 변경 시 polygons 업데이트
  useEffect(() => {
    if (!globeRef.current || !geoData || !globeReady) return;
    const globe = globeRef.current;

    globe
      .polygonCapColor((feat: object) => {
        const f = feat as { properties: Record<string, unknown> };
        const iso3 = getCountryISO(f.properties);
        const state = countryStates?.get(iso3);
        // v12 S21: 실시간 팩션 색상 + 주권 레벨 강도
        if (state?.battleStatus === 'in_battle') return sovereigntyColors.atWar;
        if (state?.sovereignFaction) {
          const factionColor = getFactionHexColor(state.sovereignFaction);
          const lvl = state.sovereigntyLevel ?? 0;
          const intensity = sovereigntyLevelToOpacity(lvl);
          return lerpHexColor('#1a1a2e', factionColor, intensity);
        }
        return sovereigntyColors.unclaimed;
      })
      .polygonAltitude((feat: object) => {
        const f = feat as { properties: Record<string, unknown> };
        const iso3 = getCountryISO(f.properties);
        if (selectedCountry && iso3 === selectedCountry) return 0.02;
        return 0.015;
      });
  }, [countryStates, selectedCountry, geoData, globeReady]);

  // 진단: 폴리곤 머티리얼 수정 + 씬 그래프 로그
  const dbgFrame = useRef(0);
  const matFixDone = useRef(false);

  useFrame(() => {
    dbgFrame.current++;

    // 강제: three-globe의 visible/scale 보장
    // three-globe는 initGlobe()에서 visible=true + scale tween(1e-6→1)을 실행하지만
    // R3F 환경에서 three-globe의 자체 _animationCycle(rAF)이 제대로 안 돌 수 있음
    if (globeRef.current) {
      const gObj = globeRef.current as unknown as THREE.Object3D;
      if (!gObj.visible) {
        gObj.visible = true;
        console.log('[GLOBE-DBG] Forced globe visible=true');
      }
      if (gObj.scale.x < 0.99) {
        gObj.scale.set(1, 1, 1);
        console.log('[GLOBE-DBG] Forced globe scale=1');
      }
    }

    // 1회성: 폴리곤 머티리얼 depthWrite 수정
    // three-globe 폴리곤은 비동기 생성 → meshCount > 50 대기
    if (!matFixDone.current && globeRef.current) {
      const globeObj = globeRef.current as unknown as THREE.Object3D;
      let meshCount = 0;
      globeObj.traverse((c) => { if (c instanceof THREE.Mesh) meshCount++; });
      if (meshCount > 50) {
        matFixDone.current = true;
        let fixCount = 0;
        globeObj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (const mat of mats) {
              if (mat.transparent && mat.depthWrite) {
                mat.depthWrite = false;
                fixCount++;
              }
            }
          }
        });
        console.log('[GLOBE-DBG] Material fix applied:', { meshes: meshCount, depthWriteFixes: fixCount });

        // 디버그: 폴리곤 캡 머터리얼 (material[1]) 상태 확인
        // three-globe에서: material[0]=side, material[1]=cap
        let polyChecked = 0;
        globeObj.traverse((c) => {
          if (polyChecked >= 3) return;
          if (c instanceof THREE.Mesh && Array.isArray(c.material) && c.material.length === 2) {
            const side = c.material[0] as THREE.MeshBasicMaterial;
            const cap = c.material[1] as THREE.MeshBasicMaterial;
            console.log(`[GLOBE-DBG] Polygon[${polyChecked}] side:`, {
              color: '#' + side.color?.getHexString(),
              opacity: side.opacity,
              transparent: side.transparent,
            });
            console.log(`[GLOBE-DBG] Polygon[${polyChecked}] cap:`, {
              color: '#' + cap.color?.getHexString(),
              opacity: cap.opacity,
              transparent: cap.transparent,
              depthWrite: cap.depthWrite,
            });
            polyChecked++;
          }
        });
      }
    }

    // 매 300프레임(~5초)마다 씬 상태 요약 로그
    if (dbgFrame.current % 300 === 0 && globeRef.current) {
      const g = globeRef.current as unknown as THREE.Object3D;
      let mCount = 0, sCount = 0, grpCount = 0;
      g.traverse((c) => {
        if (c instanceof THREE.Mesh) mCount++;
        else if (c instanceof THREE.Sprite) sCount++;
        else if (c.type === 'Group') grpCount++;
      });
      console.log(`[GLOBE-DBG] Frame ${dbgFrame.current}: meshes=${mCount}, sprites=${sCount}, groups=${grpCount}, globeVisible=${g.visible}, globePos=${g.position.toArray()}`);
    }
  });

  // 라벨 거리 페이드 + facing 기반 뒷면 숨김
  // depthTest: false이므로 뒷면 라벨이 지구를 뚫고 보이는 문제를
  // 카메라↔라벨 방향의 dot product로 해결 (뒷면 = dot < 0 → opacity 0)
  const _camDir = useMemo(() => new THREE.Vector3(), []);
  const _labelDir = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    if (!labelGroupRef.current) return;
    const dist = camera.position.length();
    // 450 이상: 투명, 300 이하: 불투명 (기본 카메라 300 → 1.0)
    const maxOpacity = THREE.MathUtils.clamp((450 - dist) / 150, 0, 1);
    labelGroupRef.current.visible = maxOpacity > 0.01;

    // 매 300프레임마다 라벨 가시성 로그
    if (dbgFrame.current % 300 === 1) {
      console.log('[GLOBE-DBG] Labels:', {
        camDist: dist.toFixed(1),
        maxOpacity: maxOpacity.toFixed(2),
        groupVisible: labelGroupRef.current.visible,
        spriteCount: labelGroupRef.current.children.length,
      });
    }

    if (!labelGroupRef.current.visible) return;

    // 카메라 방향 벡터 (재할당 없이 재사용 — 프레임당 ~200개 Vector3 생성 방지)
    _camDir.copy(camera.position).normalize();

    for (const child of labelGroupRef.current.children) {
      if (child instanceof THREE.Sprite) {
        // 라벨 위치 방향과 카메라 방향의 내적: 1=정면, 0=가장자리, -1=뒷면
        _labelDir.copy(child.position).normalize();
        const dot = _camDir.dot(_labelDir);
        // smoothstep: dot -0.1 이하 → 0 (완전 투명), dot 0.2 이상 → 1 (완전 불투명)
        const facing = THREE.MathUtils.smoothstep(dot, -0.1, 0.2);
        child.material.opacity = maxOpacity * facing;
      }
    }
  });

  // DOM 이벤트 기반 클릭 감지 (R3F 이벤트는 imperatively 추가된 three-globe 메시를 감지 못함)
  const { gl, camera } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const CLICK_THRESHOLD = 5;

  useEffect(() => {
    if (!globeReady || !globeRef.current) return;

    const canvas = gl.domElement;

    const handlePointerDown = (event: PointerEvent) => {
      pointerDownPos.current = { x: event.clientX, y: event.clientY };
    };

    const handleCanvasClick = (event: MouseEvent) => {
      console.log('[GLOBE-DBG] Click:', { hasCallback: !!onCountryClick, hasGlobe: !!globeRef.current });
      if (!onCountryClick || !globeRef.current) return;

      // 드래그 vs 클릭 구분
      if (pointerDownPos.current) {
        const dx = event.clientX - pointerDownPos.current.x;
        const dy = event.clientY - pointerDownPos.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > CLICK_THRESHOLD) return;
      }

      // 마우스 좌표 → NDC 변환
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // three-globe 오브젝트의 모든 자식에 대해 레이캐스트
      const globeObj = globeRef.current as unknown as THREE.Object3D;
      const intersects = raycasterRef.current.intersectObjects(globeObj.children, true);

      console.log('[GLOBE-DBG] Raycaster hits:', intersects.length, intersects.length > 0 ? intersects[0].object.type : 'none');
      if (intersects.length === 0) return;

      // three-globe은 각 polygon 메시의 __data에 원본 GeoJSON feature를 저장
      let target: THREE.Object3D | null = intersects[0].object;
      while (target) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const feat = (target as any).__data;
        if (feat?.properties) {
          const iso3 = getCountryISO(feat.properties);
          const name = (feat.properties.NAME as string) || (feat.properties.ADMIN as string) || 'Unknown';
          if (iso3) {
            onCountryClick(iso3, name);
          }
          break;
        }
        target = target.parent;
      }
    };

    // v12 S21: 호버 감지 (pointermove → raycaster → 국가 식별)
    let hoverThrottle = 0;
    const handlePointerMove = (event: PointerEvent) => {
      const now = Date.now();
      if (now - hoverThrottle < 100) return; // 100ms 스로틀
      hoverThrottle = now;

      if (!globeRef.current || !onHoverCountry) return;

      const rect = canvas.getBoundingClientRect();
      const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const hoverRay = raycasterRef.current;
      hoverRay.setFromCamera(new THREE.Vector2(mx, my), camera);

      const globeObj = globeRef.current as unknown as THREE.Object3D;
      const hits = hoverRay.intersectObjects(globeObj.children, true);

      if (hits.length === 0) {
        onHoverCountry(null);
        return;
      }

      let hitTarget: THREE.Object3D | null = hits[0].object;
      while (hitTarget) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const feat = (hitTarget as any).__data;
        if (feat?.properties) {
          const iso3 = getCountryISO(feat.properties);
          const name = getCountryName(feat.properties);
          const state = countryStates?.get(iso3);
          onHoverCountry({
            iso3,
            name,
            faction: state?.sovereignFaction ?? '',
            level: state?.sovereigntyLevel ?? 0,
            screenX: event.clientX,
            screenY: event.clientY,
          });
          return;
        }
        hitTarget = hitTarget.parent;
      }
      onHoverCountry(null);
    };

    const handlePointerLeave = () => {
      onHoverCountry?.(null);
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [globeReady, gl, camera, onCountryClick, onHoverCountry, countryStates]);

  return (
    <group ref={groupRef} />
  );
}

// 대기 글로우 이펙트 (실사 — 얇은 BackSide 대기 림)
function AtmosphereGlow() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          vec3 color = vec3(0.35, 0.65, 1.0);
          gl_FragColor = vec4(color, 1.0) * intensity * 0.35;
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  return (
    <mesh material={material}>
      <sphereGeometry args={[104, 64, 64]} />
    </mesh>
  );
}

// 실시간 태양 위치 + 조명 (현재 UTC 시각 기반)
function SunLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const sunRef = useRef<THREE.Group>(null);

  // 태양 코로나 글로우 (캔버스 라디얼 그래디언트)
  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,250,230,1)');
    g.addColorStop(0.15, 'rgba(255,240,200,0.6)');
    g.addColorStop(0.4, 'rgba(255,220,150,0.12)');
    g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;

    // 태양 적위 (지축 23.44° 기울기)
    const decRad = (-23.44 * Math.cos(((dayOfYear + 10) / 365) * 2 * Math.PI)) * (Math.PI / 180);
    // 시간각: UTC 12시 = 본초자오선(경도 0°) 정오
    const ha = ((utcH - 12) / 24) * 2 * Math.PI;

    const d = 500;
    const x = d * Math.cos(decRad) * Math.sin(-ha);
    const y = d * Math.sin(decRad);
    const z = d * Math.cos(decRad) * Math.cos(-ha);

    lightRef.current?.position.set(x, y, z);
    sunRef.current?.position.set(x, y, z);
  });

  return (
    <>
      <directionalLight ref={lightRef} intensity={1.15} color="#FFF8F0" />
      <group ref={sunRef}>
        {/* 태양 코어 */}
        <mesh>
          <sphereGeometry args={[5, 16, 16]} />
          <meshBasicMaterial color="#FFF8E0" toneMapped={false} />
        </mesh>
        {/* 태양 코로나 글로우 */}
        <sprite scale={[120, 120, 1]}>
          <spriteMaterial
            map={glowTexture}
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      </group>
    </>
  );
}

// 배경 별 (자연스러운 크기/색상/깜빡임 변화)
function Starfield() {
  const COUNT = 4000;
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);
    // 항성 스펙트럼 유형별 색상 (O/B 청백 → K 주황)
    const starColors: [number, number, number][] = [
      [0.7, 0.8, 1.0], [0.85, 0.9, 1.0], [1.0, 1.0, 1.0],
      [1.0, 0.96, 0.85], [1.0, 0.88, 0.7],
    ];
    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 650 + Math.random() * 250;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      // 밝기: 멱급수 분포 (대부분 어둡고, 소수만 밝음)
      const brightness = Math.pow(Math.random(), 3);
      sizes[i] = 0.6 + brightness * 3.5;
      const c = starColors[Math.floor(Math.random() * starColors.length)];
      const b = 0.4 + brightness * 0.6;
      colors[i * 3] = c[0] * b;
      colors[i * 3 + 1] = c[1] * b;
      colors[i * 3 + 2] = c[2] * b;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        attribute vec3 aColor;
        uniform float uTime;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          float twinkle = 0.6 + 0.4 * sin(uTime * (0.3 + aPhase * 0.8) + aPhase * 6.283);
          vAlpha = twinkle;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (1.0 + 0.15 * sin(uTime * 0.5 + aPhase * 3.14));
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.15, d) * vAlpha;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: geo, material: mat };
  }, []);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
  });

  return <points geometry={geometry} material={material} />;
}

// 카메라 모션 설정
const MIN_DIST = 150;
const MAX_DIST = 500;
const MIN_ROTATE_SPEED = 0.15;     // 줌인 시 회전 속도 (0.03→0.15: 5배 향상)
const MAX_ROTATE_SPEED = 0.5;
const ROTATION_DAMPING = 0.015;    // 회전 관성 감쇠
const ZOOM_FRICTION = 0.92;        // 줌 속도 감쇠 (프레임당 8% 감속)
const ZOOM_IMPULSE = 0.00004;      // 스크롤 1px당 속도 누적
const ZOOM_MAX_VEL = 0.03;         // 줌 최대 속도 (프레임당 3%)

function AdaptiveControls() {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera, gl } = useThree();
  const zoomVel = useRef(0);
  const pinchRef = useRef(0);

  // 모멘텀 기반 줌 (휠 + 터치 핀치)
  useEffect(() => {
    const canvas = gl.domElement;

    // 마우스 휠 / 트랙패드: 속도 누적 → 자연스러운 가감속
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 40;
      if (e.deltaMode === 2) delta *= 800;
      zoomVel.current += THREE.MathUtils.clamp(delta, -150, 150) * ZOOM_IMPULSE;
      zoomVel.current = THREE.MathUtils.clamp(zoomVel.current, -ZOOM_MAX_VEL, ZOOM_MAX_VEL);
    };

    // 터치 핀치: 핀치 비율 → 속도 변환
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = Math.sqrt(dx * dx + dy * dy);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        zoomVel.current += (1 - dist / pinchRef.current) * 0.06;
        zoomVel.current = THREE.MathUtils.clamp(zoomVel.current, -0.05, 0.05);
        pinchRef.current = dist;
      }
    };
    const onTouchEnd = () => { pinchRef.current = 0; };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [gl]);

  useFrame(() => {
    if (!controlsRef.current) return;
    const currentDist = camera.position.length();

    // 모멘텀 줌: 속도 적분 + 마찰 감쇠 (스크롤 멈춰도 관성으로 서서히 정지)
    if (Math.abs(zoomVel.current) > 0.00005) {
      const newDist = THREE.MathUtils.clamp(
        currentDist * (1 + zoomVel.current), MIN_DIST, MAX_DIST,
      );
      // 경계 도달 시 해당 방향 속도 즉시 소멸 (반발 방지)
      if (newDist >= MAX_DIST && zoomVel.current > 0) zoomVel.current = 0;
      if (newDist <= MIN_DIST && zoomVel.current < 0) zoomVel.current = 0;
      camera.position.normalize().multiplyScalar(newDist);
      zoomVel.current *= ZOOM_FRICTION;
    } else {
      zoomVel.current = 0;
    }

    // 적응형 회전 속도 (√ 커브: 줌인 시에도 답답하지 않게)
    const t = Math.max(0, Math.min(1, (currentDist - MIN_DIST) / (MAX_DIST - MIN_DIST)));
    (controlsRef.current as unknown as { rotateSpeed: number }).rotateSpeed =
      MIN_ROTATE_SPEED + (MAX_ROTATE_SPEED - MIN_ROTATE_SPEED) * Math.sqrt(t);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={false}
      minDistance={MIN_DIST}
      maxDistance={MAX_DIST}
      enableDamping
      dampingFactor={ROTATION_DAMPING}
      rotateSpeed={MAX_ROTATE_SPEED}
    />
  );
}

export function GlobeView({
  countryStates,
  selectedCountry,
  onCountryClick,
  style,
}: GlobeViewProps) {
  // v12 S21: 호버 툴팁 상태
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  const handleHover = useCallback((info: HoverInfo | null) => {
    setHoverInfo(info);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', background: '#07080C', position: 'relative', ...style }}>
      <Canvas
        camera={{
          position: [0, 0, 300],
          fov: 50,
          near: 1,
          far: 1000,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
      >
        {/* 우주: 최소 ambient + 반구 필 + 실시간 태양 + 별 */}
        <ambientLight intensity={0.08} color="#1a2a4a" />
        <hemisphereLight args={['#223355', '#080810', 0.1]} />
        <SunLight />
        <Starfield />

        <GlobeObject
          countryStates={countryStates}
          selectedCountry={selectedCountry}
          onCountryClick={onCountryClick}
          onHoverCountry={handleHover}
        />

        <AtmosphereGlow />

        <AdaptiveControls />
      </Canvas>

      {/* v12 S21: 국가 호버 툴팁 (주권 정보 표시) */}
      {hoverInfo && (
        <SovereigntyTooltip info={hoverInfo} />
      )}
    </div>
  );
}

// v12 S21: 주권 정보 호버 툴팁
function SovereigntyTooltip({ info }: { info: HoverInfo }) {
  const factionColor = info.faction ? getFactionHexColor(info.faction) : '#8B8D98';

  return (
    <div
      style={{
        position: 'absolute',
        left: info.screenX + 14,
        top: info.screenY - 10,
        pointerEvents: 'none',
        zIndex: 100,
        backgroundColor: 'rgba(14, 14, 18, 0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '5px',
        padding: '8px 12px',
        maxWidth: '220px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
        fontFamily: '"Inter", -apple-system, sans-serif',
      }}
    >
      {/* 국가 이름 */}
      <div style={{
        fontSize: '13px',
        fontWeight: 700,
        color: '#ECECEF',
        letterSpacing: '0.5px',
        marginBottom: '4px',
      }}>
        {info.name}
      </div>

      {/* 팩션 + 주권 레벨 */}
      {info.faction ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '2px',
            backgroundColor: factionColor,
            flexShrink: 0,
          }} />
          <span style={{ color: factionColor, fontWeight: 600 }}>
            {info.faction}
          </span>
          <span style={{
            color: '#8B8D98',
            fontSize: '10px',
            marginLeft: '4px',
          }}>
            ({sovereigntyLevelLabel(info.level)})
          </span>
        </div>
      ) : (
        <div style={{
          fontSize: '11px',
          color: '#55565E',
          letterSpacing: '1px',
        }}>
          UNCLAIMED
        </div>
      )}
    </div>
  );
}
