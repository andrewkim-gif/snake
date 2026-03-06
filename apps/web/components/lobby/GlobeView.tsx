'use client';

/**
 * GlobeView — Pure Three.js + R3F 지구본
 * three-globe 제거 → GeoJSON ShapeGeometry + sphere projection 직접 구현
 * 근본 원인 제거: 내부 rAF 충돌, animateIn 트윈, ThreeDigest id 의존 없음
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CountryClientState, GeoJSONData } from '@/lib/globe-data';
import { loadGeoJSON, factionColorPalette } from '@/lib/globe-data';
import { sovereigntyColors, getCountryISO, getCountryName } from '@/lib/map-style';

// ── Types ──────────────────────────────────────────

interface GlobeViewProps {
  countryStates?: Map<string, CountryClientState>;
  selectedCountry?: string | null;
  onCountryClick?: (iso3: string, name: string) => void;
  style?: React.CSSProperties;
}

interface HoverInfo {
  iso3: string;
  name: string;
  faction: string;
  level: number;
  screenX: number;
  screenY: number;
}

// ── Constants ──────────────────────────────────────

const GLOBE_RADIUS = 100;
const POLYGON_ALT = 0.01;    // 폴리곤 고도 (1 unit, chord dip 0.095 대비 충분)
const BORDER_ALT = 0.011;    // 국경선 고도 (폴리곤 위)
const LABEL_ALT = 0.015;     // 라벨 고도
const SELECTED_SCALE = (1 + 0.015) / (1 + POLYGON_ALT); // 선택 시 scale 비율

// ── Helpers ────────────────────────────────────────

/** lat/lng(도) → 3D 좌표 (three-globe polar2Cartesian 호환) */
function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (90 - lng) * Math.PI / 180;
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

// 팩션 색상 캐시
const _factionColorCache = new Map<string, string>();
function getFactionHexColor(factionId: string): string {
  if (!factionId) return sovereigntyColors.unclaimed;
  const cached = _factionColorCache.get(factionId);
  if (cached) return cached;
  let hash = 0;
  for (let i = 0; i < factionId.length; i++) {
    hash = ((hash << 5) - hash + factionId.charCodeAt(i)) | 0;
  }
  const color = factionColorPalette[Math.abs(hash) % factionColorPalette.length];
  _factionColorCache.set(factionId, color);
  return color;
}

function sovereigntyLevelToOpacity(level: number): number {
  return level <= 0 ? 0.3 : Math.min(1.0, 0.3 + level * 0.14);
}

function sovereigntyLevelLabel(level: number): string {
  const labels = ['Unclaimed', 'Lv1 Influence', 'Lv2 Control', 'Lv3 Dominion', 'Lv4 Authority', 'Lv5 Sovereignty'];
  return labels[Math.min(level, 5)] || `Lv${level}`;
}

function lerpHexColor(from: string, to: string, t: number): string {
  const fr = parseInt(from.slice(1, 3), 16), fg = parseInt(from.slice(3, 5), 16), fb = parseInt(from.slice(5, 7), 16);
  const tr = parseInt(to.slice(1, 3), 16), tg = parseInt(to.slice(3, 5), 16), tb = parseInt(to.slice(5, 7), 16);
  const r = Math.round(fr + (tr - fr) * t), g = Math.round(fg + (tg - fg) * t), b = Math.round(fb + (tb - fb) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function computeCentroid(geometry: { type: string; coordinates: unknown }): { lat: number; lng: number } | null {
  let ring: number[][];
  if (geometry.type === 'Polygon') {
    ring = (geometry.coordinates as number[][][])[0];
  } else if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates as number[][][][];
    let maxLen = 0; ring = [];
    for (const p of polys) { if (p[0].length > maxLen) { maxLen = p[0].length; ring = p[0]; } }
  } else return null;
  if (!ring.length) return null;
  let sLng = 0, sLat = 0;
  for (const [lng, lat] of ring) { sLng += lng; sLat += lat; }
  return { lng: sLng / ring.length, lat: sLat / ring.length };
}

/** 국가 색상 결정 */
function resolveCountryColor(iso3: string, states?: Map<string, CountryClientState>): string {
  const s = states?.get(iso3);
  if (!s) return sovereigntyColors.unclaimed;
  if (s.battleStatus === 'in_battle') return sovereigntyColors.atWar;
  if (s.sovereignFaction) {
    return lerpHexColor('#1a1a2e', getFactionHexColor(s.sovereignFaction), sovereigntyLevelToOpacity(s.sovereigntyLevel ?? 0));
  }
  return sovereigntyColors.unclaimed;
}

/**
 * Subdivide ring so no edge exceeds maxDeg degrees.
 * Prevents flat earcut triangles from dipping below the sphere surface.
 * Without this, Canada (~90° lon span) and China (~62°) get visible holes.
 */
function subdivideRing(ring: number[][], maxDeg: number): number[][] {
  if (ring.length < 2) return ring;
  const out: number[][] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    out.push(a);
    const dLng = Math.abs(b[0] - a[0]);
    const dLat = Math.abs(b[1] - a[1]);
    const dist = Math.max(dLng, dLat);
    if (dist > maxDeg) {
      const n = Math.ceil(dist / maxDeg);
      for (let s = 1; s < n; s++) {
        const t = s / n;
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
  }
  return out;
}

const MAX_EDGE_DEG = 5; // ~0.095 unit chord deviation at R=100, well within 1.5 altitude

/**
 * Earcut 후 내부 삼각형 엣지도 분할.
 * ShapeGeometry는 non-indexed buffer → 삼각형당 9 floats (3 verts × 3 components).
 * 모든 엣지가 maxDeg 이하가 될 때까지 longest edge를 midpoint로 2분할.
 */
function subdivideTriangles(geo: THREE.BufferGeometry, maxDeg: number): THREE.BufferGeometry {
  // ⚠️ ShapeGeometry는 INDEXED geometry — index buffer에서 삼각형을 읽어야 함
  const nonIdx = geo.index ? geo.toNonIndexed() : geo;
  const src = nonIdx.attributes.position;
  type Tri = [number, number, number, number, number, number];
  let tris: Tri[] = [];
  for (let i = 0; i < src.count; i += 3) {
    tris.push([src.getX(i), src.getY(i), src.getX(i + 1), src.getY(i + 1), src.getX(i + 2), src.getY(i + 2)]);
  }
  for (let iter = 0; iter < 12; iter++) { // 2^12 = 4096 max subdivisions per triangle
    const next: Tri[] = [];
    let anyChanged = false;
    for (const [ax, ay, bx, by, cx, cy] of tris) {
      const ab = Math.max(Math.abs(ax - bx), Math.abs(ay - by));
      const bc = Math.max(Math.abs(bx - cx), Math.abs(by - cy));
      const ca = Math.max(Math.abs(cx - ax), Math.abs(cy - ay));
      const maxE = Math.max(ab, bc, ca);
      if (maxE <= maxDeg) { next.push([ax, ay, bx, by, cx, cy]); continue; }
      anyChanged = true;
      if (ab >= bc && ab >= ca) {
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        next.push([ax, ay, mx, my, cx, cy], [mx, my, bx, by, cx, cy]);
      } else if (bc >= ab && bc >= ca) {
        const mx = (bx + cx) / 2, my = (by + cy) / 2;
        next.push([ax, ay, bx, by, mx, my], [ax, ay, mx, my, cx, cy]);
      } else {
        const mx = (cx + ax) / 2, my = (cy + ay) / 2;
        next.push([ax, ay, bx, by, mx, my], [mx, my, bx, by, cx, cy]);
      }
    }
    tris = next;
    if (!anyChanged) break;
  }
  const positions = new Float32Array(tris.length * 9);
  for (let i = 0; i < tris.length; i++) {
    const [ax, ay, bx, by, cx, cy] = tris[i];
    const o = i * 9;
    positions[o] = ax; positions[o + 1] = ay; positions[o + 2] = 0;
    positions[o + 3] = bx; positions[o + 4] = by; positions[o + 5] = 0;
    positions[o + 6] = cx; positions[o + 7] = cy; positions[o + 8] = 0;
  }
  if (nonIdx !== geo) nonIdx.dispose(); // toNonIndexed()로 생성된 임시 geometry 정리
  const newGeo = new THREE.BufferGeometry();
  newGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return newGeo;
}

/** GeoJSON polygon rings → ShapeGeometry (sphere projection) */
function createPolygonGeo(rings: number[][][], radius: number): THREE.BufferGeometry | null {
  const outer = rings[0];
  if (!outer || outer.length < 3) return null;
  try {
    const subOuter = subdivideRing(outer, MAX_EDGE_DEG);
    const shape = new THREE.Shape();
    shape.moveTo(subOuter[0][0], subOuter[0][1]);
    for (let i = 1; i < subOuter.length; i++) shape.lineTo(subOuter[i][0], subOuter[i][1]);
    for (let h = 1; h < rings.length; h++) {
      const hole = rings[h];
      if (!hole || hole.length < 3) continue;
      const subHole = subdivideRing(hole, MAX_EDGE_DEG);
      const hp = new THREE.Path();
      hp.moveTo(subHole[0][0], subHole[0][1]);
      for (let i = 1; i < subHole.length; i++) hp.lineTo(subHole[i][0], subHole[i][1]);
      shape.holes.push(hp);
    }
    // Earcut 2D 삼각분할 → 내부 엣지까지 분할 → 구체 투영
    const shapeGeo = new THREE.ShapeGeometry(shape);
    const geo = subdivideTriangles(shapeGeo, MAX_EDGE_DEG);
    shapeGeo.dispose();
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = latLngToVec3(pos.getY(i), pos.getX(i), radius);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  } catch { return null; }
}

// ── GlobeObject ────────────────────────────────────

function GlobeObject({
  countryStates, selectedCountry, onCountryClick, onHoverCountry,
}: Omit<GlobeViewProps, 'style'> & { onHoverCountry?: (info: HoverInfo | null) => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshMapRef = useRef<Map<string, THREE.Mesh[]>>(new Map());
  const labelGroupRef = useRef<THREE.Group | null>(null);
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);
  const [ready, setReady] = useState(false);

  // GeoJSON 로딩
  useEffect(() => { loadGeoJSON().then(setGeoData).catch(console.error); }, []);

  // 지구본 구축: 구체 + 폴리곤 + 국경선 + 라벨
  useEffect(() => {
    if (!geoData || !groupRef.current) return;
    const group = groupRef.current;

    // 기존 자식 정리
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((c) => {
        if (c instanceof THREE.Mesh) { c.geometry.dispose(); const m = c.material; if (Array.isArray(m)) m.forEach(x => x.dispose()); else m.dispose(); }
        if (c instanceof THREE.Sprite) { c.material.map?.dispose(); c.material.dispose(); }
        if (c instanceof THREE.LineSegments) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
      });
    }
    meshMapRef.current.clear();

    const features = geoData.features.filter(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');

    console.log('[GlobeView v3] Building globe — toNonIndexed fix active, POLYGON_ALT:', POLYGON_ALT);

    // ① 해양 구체 + 위성 텍스처
    const oceanMat = new THREE.MeshBasicMaterial({ color: '#0a1628' });
    const oceanMesh = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64),
      oceanMat,
    );
    oceanMesh.rotation.y = -Math.PI / 2;
    group.add(oceanMesh);
    new THREE.TextureLoader().load('/textures/earth-blue-marble.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      oceanMat.map = tex;
      oceanMat.color.set('#ffffff');
      oceanMat.needsUpdate = true;
    });

    // ② 국가 폴리곤 메시
    const polyRadius = GLOBE_RADIUS * (1 + POLYGON_ALT);
    const newMap = new Map<string, THREE.Mesh[]>();

    for (const feature of features) {
      const props = feature.properties as Record<string, unknown>;
      const iso3 = getCountryISO(props);
      const name = getCountryName(props);
      if (!iso3) continue;

      const color = resolveCountryColor(iso3, countryStates);
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      const meshes: THREE.Mesh[] = [];

      const polySets: number[][][][] = feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates as number[][][]]
        : (feature.geometry.coordinates as number[][][][]);

      for (const rings of polySets) {
        const geo = createPolygonGeo(rings, polyRadius);
        if (!geo) continue;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData = { iso3, name };
        mesh.renderOrder = 1;
        group.add(mesh);
        meshes.push(mesh);
      }
      if (meshes.length > 0) newMap.set(iso3, meshes);
    }
    meshMapRef.current = newMap;

    // ③ 국경선 (전체 → 단일 LineSegments)
    const borderVerts: number[] = [];
    const bRadius = GLOBE_RADIUS * (1 + BORDER_ALT);
    for (const feature of features) {
      const allRings: number[][][] = [];
      if (feature.geometry.type === 'Polygon') {
        allRings.push(...(feature.geometry.coordinates as number[][][]));
      } else {
        for (const poly of feature.geometry.coordinates as number[][][][]) allRings.push(...poly);
      }
      for (const ring of allRings) {
        for (let i = 0; i < ring.length - 1; i++) {
          const a = latLngToVec3(ring[i][1], ring[i][0], bRadius);
          const b = latLngToVec3(ring[i + 1][1], ring[i + 1][0], bRadius);
          borderVerts.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
    }
    const borderGeo = new THREE.BufferGeometry();
    borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderVerts, 3));
    const borderLine = new THREE.LineSegments(borderGeo,
      new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.25, transparent: true }));
    borderLine.renderOrder = 2;
    group.add(borderLine);

    // ④ 국가 이름 라벨 (CanvasTexture 스프라이트)
    const labelGroup = new THREE.Group();
    labelGroup.name = 'country-labels';
    const sharedCanvas = document.createElement('canvas');
    const sharedCtx = sharedCanvas.getContext('2d');
    if (sharedCtx) {
      const lRadius = GLOBE_RADIUS * (1 + LABEL_ALT);
      for (const feature of features) {
        const fname = (feature.properties as Record<string, unknown>).NAME as string;
        if (!fname) continue;
        const centroid = computeCentroid(feature.geometry as { type: string; coordinates: unknown });
        if (!centroid) continue;
        try {
          const fs = 36, pad = 14;
          sharedCtx.font = `700 ${fs}px "Rajdhani","Segoe UI",sans-serif`;
          const tw = Math.ceil(sharedCtx.measureText(fname).width);
          const pw = tw + 24 + pad * 2, ph = fs + 20 + pad * 2;
          sharedCanvas.width = pw; sharedCanvas.height = ph;
          sharedCtx.font = `700 ${fs}px "Rajdhani","Segoe UI",sans-serif`;
          sharedCtx.textBaseline = 'middle'; sharedCtx.textAlign = 'center';
          const cx = pw / 2, cy = ph / 2;
          sharedCtx.shadowColor = 'rgba(0,0,0,0.95)'; sharedCtx.shadowBlur = 12;
          sharedCtx.strokeStyle = 'rgba(0,0,0,0.85)'; sharedCtx.lineWidth = 6; sharedCtx.lineJoin = 'round';
          sharedCtx.strokeText(fname, cx, cy);
          sharedCtx.shadowBlur = 0; sharedCtx.fillStyle = '#FFFFFF'; sharedCtx.fillText(fname, cx, cy);
          const lc = document.createElement('canvas'); lc.width = pw; lc.height = ph;
          lc.getContext('2d')!.drawImage(sharedCanvas, 0, 0);
          const tex = new THREE.CanvasTexture(lc);
          tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: tex, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: true,
          }));
          sprite.renderOrder = 999;
          sprite.raycast = () => {};
          sprite.position.copy(latLngToVec3(centroid.lat, centroid.lng, lRadius));
          sprite.scale.set(8 * (pw / ph), 8, 1);
          labelGroup.add(sprite);
        } catch { /* skip */ }
      }
    }
    group.add(labelGroup);
    labelGroupRef.current = labelGroup;
    setReady(true);

    return () => {
      labelGroupRef.current?.traverse((c) => {
        if (c instanceof THREE.Sprite) { c.material.map?.dispose(); c.material.dispose(); }
      });
    };
  }, [geoData]); // eslint-disable-line react-hooks/exhaustive-deps

  // 국가 색상 + 선택 시 스케일 업데이트
  useEffect(() => {
    if (!ready) return;
    for (const [iso3, meshes] of meshMapRef.current) {
      const col = resolveCountryColor(iso3, countryStates);
      const scale = selectedCountry === iso3 ? SELECTED_SCALE : 1;
      for (const m of meshes) {
        (m.material as THREE.MeshBasicMaterial).color.set(col);
        m.scale.setScalar(scale);
      }
    }
  }, [countryStates, selectedCountry, ready]);

  // 라벨: 거리 페이드 + 뒷면 숨김
  const _cam = useMemo(() => new THREE.Vector3(), []);
  const _lbl = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    if (!labelGroupRef.current) return;
    const dist = camera.position.length();
    const maxOp = THREE.MathUtils.clamp((600 - dist) / 200, 0, 1);
    labelGroupRef.current.visible = maxOp > 0.01;
    if (!labelGroupRef.current.visible) return;
    _cam.copy(camera.position).normalize();
    for (const child of labelGroupRef.current.children) {
      if (child instanceof THREE.Sprite) {
        _lbl.copy(child.position).normalize();
        child.material.opacity = maxOp * THREE.MathUtils.smoothstep(_cam.dot(_lbl), -0.1, 0.2);
      }
    }
  });

  // DOM 클릭 / 호버
  const { gl, camera } = useThree();
  const rc = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const downPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!ready) return;
    const cvs = gl.domElement;

    const onDown = (e: PointerEvent) => { downPos.current = { x: e.clientX, y: e.clientY }; };

    const onClick = (e: MouseEvent) => {
      if (!onCountryClick || !groupRef.current) return;
      if (downPos.current) {
        const dx = e.clientX - downPos.current.x, dy = e.clientY - downPos.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) return;
      }
      const rect = cvs.getBoundingClientRect();
      mouse.current.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      rc.current.setFromCamera(mouse.current, camera);
      for (const hit of rc.current.intersectObjects(groupRef.current.children, true)) {
        if (hit.object.userData.iso3) { onCountryClick(hit.object.userData.iso3, hit.object.userData.name); return; }
      }
    };

    let hoverT = 0;
    const onMove = (e: PointerEvent) => {
      const now = Date.now(); if (now - hoverT < 100) return; hoverT = now;
      if (!onHoverCountry || !groupRef.current) return;
      const rect = cvs.getBoundingClientRect();
      rc.current.setFromCamera(
        new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1),
        camera,
      );
      for (const hit of rc.current.intersectObjects(groupRef.current.children, true)) {
        const ud = hit.object.userData;
        if (ud.iso3) {
          const st = countryStates?.get(ud.iso3);
          onHoverCountry({ iso3: ud.iso3, name: ud.name, faction: st?.sovereignFaction ?? '', level: st?.sovereigntyLevel ?? 0, screenX: e.clientX, screenY: e.clientY });
          return;
        }
      }
      onHoverCountry(null);
    };

    const onLeave = () => onHoverCountry?.(null);
    cvs.addEventListener('pointerdown', onDown);
    cvs.addEventListener('click', onClick);
    cvs.addEventListener('pointermove', onMove);
    cvs.addEventListener('pointerleave', onLeave);
    return () => {
      cvs.removeEventListener('pointerdown', onDown);
      cvs.removeEventListener('click', onClick);
      cvs.removeEventListener('pointermove', onMove);
      cvs.removeEventListener('pointerleave', onLeave);
    };
  }, [ready, gl, camera, onCountryClick, onHoverCountry, countryStates]);

  return <group ref={groupRef} />;
}

// ── AtmosphereGlow ─────────────────────────────────

function AtmosphereGlow() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.65 - dot(vNormal, vec3(0,0,1)), 2.0);
        gl_FragColor = vec4(0.35, 0.65, 1.0, 1.0) * intensity * 0.35;
      }`,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }), []);
  return <mesh material={material}><sphereGeometry args={[104, 64, 64]} /></mesh>;
}

// ── SunLight (실시간 UTC 태양 위치) ────────────────

function SunLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const sunRef = useRef<THREE.Group>(null);

  const glowTexture = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,250,230,1)'); g.addColorStop(0.15, 'rgba(255,240,200,0.6)');
    g.addColorStop(0.4, 'rgba(255,220,150,0.12)'); g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);

  useFrame(() => {
    const now = new Date();
    const doy = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const dec = (-23.44 * Math.cos(((doy + 10) / 365) * 2 * Math.PI)) * Math.PI / 180;
    const ha = ((utcH - 12) / 24) * 2 * Math.PI;
    const d = 500;
    const x = d * Math.cos(dec) * Math.sin(-ha);
    const y = d * Math.sin(dec);
    const z = d * Math.cos(dec) * Math.cos(-ha);
    lightRef.current?.position.set(x, y, z);
    sunRef.current?.position.set(x, y, z);
  });

  return (
    <>
      <directionalLight ref={lightRef} intensity={1.15} color="#FFF8F0" />
      <group ref={sunRef}>
        <mesh><sphereGeometry args={[5, 16, 16]} /><meshBasicMaterial color="#FFF8E0" toneMapped={false} /></mesh>
        <sprite scale={[120, 120, 1]}>
          <spriteMaterial map={glowTexture} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      </group>
    </>
  );
}

// ── Starfield (4000 twinkling stars) ──────────────

function Starfield() {
  const COUNT = 4000;
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);
    const spectrum: [number, number, number][] = [
      [0.7, 0.8, 1], [0.85, 0.9, 1], [1, 1, 1], [1, 0.96, 0.85], [1, 0.88, 0.7],
    ];
    for (let i = 0; i < COUNT; i++) {
      const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      const r = 650 + Math.random() * 250;
      positions[i * 3] = r * Math.sin(p) * Math.cos(t);
      positions[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      positions[i * 3 + 2] = r * Math.cos(p);
      const bright = Math.pow(Math.random(), 3);
      sizes[i] = 0.6 + bright * 3.5;
      const sc = spectrum[Math.floor(Math.random() * spectrum.length)];
      const bv = 0.4 + bright * 0.6;
      colors[i * 3] = sc[0] * bv; colors[i * 3 + 1] = sc[1] * bv; colors[i * 3 + 2] = sc[2] * bv;
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
        attribute float aSize; attribute float aPhase; attribute vec3 aColor;
        uniform float uTime; varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = aColor;
          vAlpha = 0.6 + 0.4 * sin(uTime * (0.3 + aPhase * 0.8) + aPhase * 6.283);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (1.0 + 0.15 * sin(uTime * 0.5 + aPhase * 3.14));
          gl_Position = projectionMatrix * mvPos;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          gl_FragColor = vec4(vColor, smoothstep(0.5, 0.15, d) * vAlpha);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    return { geometry: geo, material: mat };
  }, []);

  useFrame(({ clock }) => { material.uniforms.uTime.value = clock.getElapsedTime(); });
  return <points geometry={geometry} material={material} />;
}

// ── AdaptiveControls ──────────────────────────────

const MIN_DIST = 150, MAX_DIST = 500;
const MIN_ROT = 0.15, MAX_ROT = 0.5;
const ROT_DAMP = 0.015;
const ZOOM_FRICTION = 0.92, ZOOM_IMPULSE = 0.00004, ZOOM_MAX = 0.03;

function AdaptiveControls() {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera, gl } = useThree();
  const zoomVel = useRef(0);
  const pinchRef = useRef(0);

  useEffect(() => {
    const cvs = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      let d = e.deltaY;
      if (e.deltaMode === 1) d *= 40; if (e.deltaMode === 2) d *= 800;
      zoomVel.current += THREE.MathUtils.clamp(d, -150, 150) * ZOOM_IMPULSE;
      zoomVel.current = THREE.MathUtils.clamp(zoomVel.current, -ZOOM_MAX, ZOOM_MAX);
    };
    const onTS = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = Math.sqrt(dx * dx + dy * dy);
      }
    };
    const onTM = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        zoomVel.current += (1 - dist / pinchRef.current) * 0.06;
        zoomVel.current = THREE.MathUtils.clamp(zoomVel.current, -0.05, 0.05);
        pinchRef.current = dist;
      }
    };
    const onTE = () => { pinchRef.current = 0; };
    cvs.addEventListener('wheel', onWheel, { passive: false });
    cvs.addEventListener('touchstart', onTS, { passive: true });
    cvs.addEventListener('touchmove', onTM, { passive: true });
    cvs.addEventListener('touchend', onTE, { passive: true });
    return () => {
      cvs.removeEventListener('wheel', onWheel);
      cvs.removeEventListener('touchstart', onTS);
      cvs.removeEventListener('touchmove', onTM);
      cvs.removeEventListener('touchend', onTE);
    };
  }, [gl]);

  useFrame(() => {
    if (!controlsRef.current) return;
    const cur = camera.position.length();
    if (Math.abs(zoomVel.current) > 0.00005) {
      const nd = THREE.MathUtils.clamp(cur * (1 + zoomVel.current), MIN_DIST, MAX_DIST);
      if (nd >= MAX_DIST && zoomVel.current > 0) zoomVel.current = 0;
      if (nd <= MIN_DIST && zoomVel.current < 0) zoomVel.current = 0;
      camera.position.normalize().multiplyScalar(nd);
      zoomVel.current *= ZOOM_FRICTION;
    } else { zoomVel.current = 0; }
    const t = Math.max(0, Math.min(1, (cur - MIN_DIST) / (MAX_DIST - MIN_DIST)));
    (controlsRef.current as unknown as { rotateSpeed: number }).rotateSpeed = MIN_ROT + (MAX_ROT - MIN_ROT) * Math.sqrt(t);
  });

  return (
    <OrbitControls ref={controlsRef} enablePan={false} enableZoom={false}
      minDistance={MIN_DIST} maxDistance={MAX_DIST} enableDamping dampingFactor={ROT_DAMP} rotateSpeed={MAX_ROT} />
  );
}

// 진단용 씬 노출 (Playwright evaluate에서 접근)
function SceneExposer() {
  const { scene, camera } = useThree();
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__scene = scene;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__camera = camera;
    }
  }, [scene, camera]);
  return null;
}

// ── GlobeView (export) ────────────────────────────

export function GlobeView({ countryStates, selectedCountry, onCountryClick, style }: GlobeViewProps) {
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const handleHover = useCallback((info: HoverInfo | null) => { setHoverInfo(info); }, []);

  return (
    <div style={{ width: '100%', height: '100%', background: '#07080C', position: 'relative', ...style }}>
      <Canvas
        camera={{ position: [0, 0, 300], fov: 50, near: 1, far: 1000 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={1} />
        <GlobeObject countryStates={countryStates} selectedCountry={selectedCountry}
          onCountryClick={onCountryClick} onHoverCountry={handleHover} />
        <AdaptiveControls />
        <SceneExposer />
      </Canvas>
      {hoverInfo && <SovereigntyTooltip info={hoverInfo} />}
    </div>
  );
}

// ── SovereigntyTooltip ────────────────────────────

function SovereigntyTooltip({ info }: { info: HoverInfo }) {
  const fc = info.faction ? getFactionHexColor(info.faction) : '#8B8D98';
  return (
    <div style={{
      position: 'absolute', left: info.screenX + 14, top: info.screenY - 10, pointerEvents: 'none', zIndex: 100,
      backgroundColor: 'rgba(14,14,18,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', padding: '8px 12px', maxWidth: '220px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)', fontFamily: '"Inter",-apple-system,sans-serif',
    }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: '#ECECEF', letterSpacing: '0.5px', marginBottom: '4px' }}>
        {info.name}
      </div>
      {info.faction ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: fc, flexShrink: 0 }} />
          <span style={{ color: fc, fontWeight: 600 }}>{info.faction}</span>
          <span style={{ color: '#8B8D98', fontSize: '10px', marginLeft: 4 }}>({sovereigntyLevelLabel(info.level)})</span>
        </div>
      ) : (
        <div style={{ fontSize: '11px', color: '#55565E', letterSpacing: '1px' }}>UNCLAIMED</div>
      )}
    </div>
  );
}
