'use client';

/**
 * VoxelTerrain — 테마별 바닥(120x120) + 언덕 + 장식
 * 6종 테마: forest, desert, mountain, urban, arctic, island
 * 안개로 가장자리 완전 은폐 → 무한 월드 느낌
 */

import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { createTerrainTextures, type TerrainTextureSet } from '@/lib/3d/terrain-textures';

const GROUND = 120;

interface VoxelTerrainProps {
  theme?: string;
}

// ─── 테마별 언덕 프로필 ───

interface HillDef { cx: number; cz: number; r: number; h: number }
interface PondDef { cx: number; cz: number; r: number }

interface TerrainProfile {
  hills: HillDef[];
  pond: PondDef | null;
  groundColor?: string; // 풀백 색상 (텍스처 없을 때)
}

function getTerrainProfile(theme: string): TerrainProfile {
  switch (theme) {
    case 'forest':
      return {
        hills: [
          { cx: 0, cz: 0, r: 3, h: 2 }, { cx: -12, cz: -8, r: 3, h: 2 },
          { cx: 10, cz: -12, r: 2.5, h: 1 }, { cx: -14, cz: 7, r: 2, h: 1 },
          { cx: 13, cz: 9, r: 3, h: 2 }, { cx: -6, cz: 14, r: 2.5, h: 1 },
          { cx: 8, cz: -5, r: 2, h: 1 }, { cx: -9, cz: -14, r: 2, h: 1 },
          { cx: 16, cz: -3, r: 2.5, h: 2 }, { cx: -16, cz: -1, r: 2, h: 1 },
          { cx: 3, cz: 16, r: 2, h: 1 },
        ],
        pond: { cx: -5, cz: 7, r: 3 },
      };
    case 'desert':
      // 사막: 낮고 넓은 모래 언덕, 연못 없음
      return {
        hills: [
          { cx: -10, cz: -6, r: 5, h: 1 }, { cx: 12, cz: 8, r: 6, h: 1 },
          { cx: -4, cz: 14, r: 4, h: 1 }, { cx: 15, cz: -10, r: 5, h: 1 },
          { cx: -15, cz: 3, r: 4, h: 1 }, { cx: 3, cz: -14, r: 3, h: 1 },
        ],
        pond: null,
      };
    case 'mountain':
      // 산악: 높고 험준한 지형
      return {
        hills: [
          { cx: 0, cz: 0, r: 4, h: 4 }, { cx: -10, cz: -10, r: 3, h: 3 },
          { cx: 12, cz: -8, r: 3.5, h: 4 }, { cx: -14, cz: 6, r: 2.5, h: 3 },
          { cx: 8, cz: 12, r: 3, h: 3 }, { cx: -5, cz: -15, r: 2.5, h: 2 },
          { cx: 16, cz: 2, r: 2, h: 3 }, { cx: -16, cz: -5, r: 3, h: 4 },
          { cx: 5, cz: -8, r: 2, h: 2 }, { cx: -8, cz: 10, r: 2.5, h: 3 },
          { cx: 10, cz: 4, r: 2, h: 2 }, { cx: -3, cz: 6, r: 1.5, h: 2 },
        ],
        pond: null,
      };
    case 'urban':
      // 도시: 평탄, 언덕 없음
      return {
        hills: [],
        pond: null,
      };
    case 'arctic':
      // 극지: 빙산 느낌의 매끄러운 언덕
      return {
        hills: [
          { cx: -8, cz: -10, r: 5, h: 2 }, { cx: 10, cz: 6, r: 4, h: 2 },
          { cx: -12, cz: 8, r: 3, h: 1 }, { cx: 5, cz: -12, r: 4, h: 2 },
          { cx: 15, cz: -4, r: 3, h: 1 },
        ],
        pond: null,
      };
    case 'island':
      // 섬: 중앙 약간의 언덕 + 주변 해안
      return {
        hills: [
          { cx: 0, cz: 0, r: 4, h: 2 }, { cx: -6, cz: -4, r: 2.5, h: 1 },
          { cx: 5, cz: 6, r: 2, h: 1 }, { cx: -3, cz: 8, r: 2, h: 1 },
        ],
        pond: null,
      };
    default:
      return getTerrainProfile('forest');
  }
}

// ─── 데코 데이터 (꽃/돌/잔디 등) ───

function srand(s: number) {
  const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface P3 { x: number; y: number; z: number }

interface TerrainData {
  topBlocks: P3[];    // 상단 블록 (잔디/모래/눈 등)
  underBlocks: P3[];  // 하단 블록 (흙/돌 등)
  flowers: P3[];
  fColors: string[];
  stones: P3[];
  grass: P3[];        // 잔디 데코
  hasPond: boolean;
  pondCx: number;
  pondCz: number;
  pondR: number;
}

function getThemeDecoColors(theme: string): { flowerColors: string[]; grassColor: string } {
  switch (theme) {
    case 'forest':
      return { flowerColors: ['#FF4444', '#FFDD44', '#FF88CC', '#FF6644'], grassColor: '#3D8C2E' };
    case 'desert':
      return { flowerColors: ['#FFD700', '#FF8C00'], grassColor: '#8B7355' }; // 마른 덤불 색
    case 'mountain':
      return { flowerColors: ['#9988CC', '#AABBDD'], grassColor: '#556655' }; // 고산 식물
    case 'urban':
      return { flowerColors: ['#FF4444', '#FFDD44'], grassColor: '#3D8C2E' }; // 화분 꽃
    case 'arctic':
      return { flowerColors: ['#CCDDFF', '#AABBEE'], grassColor: '#99AABB' }; // 얼음 결정
    case 'island':
      return { flowerColors: ['#FF66AA', '#FFAA44', '#FF4466', '#44CCFF'], grassColor: '#4a7c3f' };
    default:
      return { flowerColors: ['#FF4444', '#FFDD44'], grassColor: '#3D8C2E' };
  }
}

function generate(theme: string): TerrainData {
  const profile = getTerrainProfile(theme);
  const topBlocks: P3[] = [];
  const underBlocks: P3[] = [];
  const flowers: P3[] = [];
  const fColors: string[] = [];
  const stones: P3[] = [];
  const grassDeco: P3[] = [];
  const hm = new Map<string, number>();

  const inPond = profile.pond
    ? (x: number, z: number) =>
        Math.sqrt((x - profile.pond!.cx) ** 2 + (z - profile.pond!.cz) ** 2) < profile.pond!.r + 0.5
    : () => false;

  // 언덕 높이맵 계산
  for (const hill of profile.hills) {
    const ir = Math.ceil(hill.r);
    for (let dx = -ir; dx <= ir; dx++) {
      for (let dz = -ir; dz <= ir; dz++) {
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > hill.r) continue;
        const h = Math.max(1, Math.round(hill.h * Math.cos((d / hill.r) * Math.PI * 0.5)));
        const k = `${hill.cx + dx},${hill.cz + dz}`;
        if (h > (hm.get(k) || 0)) hm.set(k, h);
      }
    }
  }

  // 블록 생성
  for (const [k, h] of hm) {
    const [gx, gz] = k.split(',').map(Number);
    for (let l = 0; l < h; l++) {
      (l === h - 1 ? topBlocks : underBlocks).push({ x: gx, y: l + 0.5, z: gz });
    }
  }

  // 데코 (꽃/돌/잔디) — 테마별 수량 조정
  const decoColors = getThemeDecoColors(theme);
  const flowerCount = theme === 'urban' ? 10 : theme === 'arctic' ? 15 : theme === 'desert' ? 8 : 50;
  const stoneCount = theme === 'mountain' ? 35 : theme === 'urban' ? 5 : 25;
  const grassCount = theme === 'arctic' ? 0 : theme === 'desert' ? 10 : theme === 'urban' ? 5 : 40;

  for (let i = 0; i < flowerCount; i++) {
    const x = (srand(i * 3.17) - 0.5) * 50;
    const z = (srand(i * 7.31) - 0.5) * 50;
    if (inPond(x, z) || hm.has(`${Math.round(x)},${Math.round(z)}`)) continue;
    flowers.push({ x, y: 0.15, z });
    const ci = Math.floor(srand(i * 11.7) * decoColors.flowerColors.length);
    fColors.push(decoColors.flowerColors[ci]);
  }

  for (let i = 0; i < stoneCount; i++) {
    const x = (srand(i * 5.31 + 100) - 0.5) * 45;
    const z = (srand(i * 9.13 + 100) - 0.5) * 45;
    if (!inPond(x, z)) stones.push({ x, y: 0.12, z });
  }

  for (let i = 0; i < grassCount; i++) {
    const x = (srand(i * 4.71 + 200) - 0.5) * 50;
    const z = (srand(i * 8.37 + 200) - 0.5) * 50;
    if (!inPond(x, z)) grassDeco.push({ x, y: 0.2, z });
  }

  return {
    topBlocks,
    underBlocks,
    flowers,
    fColors,
    stones,
    grass: grassDeco,
    hasPond: !!profile.pond,
    pondCx: profile.pond?.cx ?? 0,
    pondCz: profile.pond?.cz ?? 0,
    pondR: profile.pond?.r ?? 0,
  };
}

// ─── InstancedMesh 배치 헬퍼 ───

const _o = new THREE.Object3D();

function makeIM(
  g: THREE.Group,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  ps: P3[],
): THREE.InstancedMesh | null {
  if (!ps.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, ps.length);
  ps.forEach((b, i) => {
    _o.position.set(b.x, b.y, b.z);
    _o.rotation.set(0, 0, 0);
    _o.scale.setScalar(1);
    _o.updateMatrix();
    m.setMatrixAt(i, _o.matrix);
  });
  m.instanceMatrix.needsUpdate = true;
  g.add(m);
  return m;
}

// ─── 테마별 바닥 색상 (ground plane) ───

function getGroundPlaneColor(theme: string): string {
  switch (theme) {
    case 'forest': return '#4a7c3f';
    case 'desert': return '#C4A661';
    case 'mountain': return '#6b6b6b';
    case 'urban': return '#808080';
    case 'arctic': return '#e8e8f0';
    case 'island': return '#3388cc'; // 물 색상 (섬 주변)
    default: return '#4a7c3f';
  }
}

function getWaterColor(theme: string): string {
  switch (theme) {
    case 'forest': return '#3388DD';
    case 'island': return '#3388cc';
    case 'arctic': return '#88bbff';
    default: return '#3388DD';
  }
}

// ─── 메인 컴포넌트 ───

export function VoxelTerrain({ theme = 'forest' }: VoxelTerrainProps) {
  const ref = useRef<THREE.Group>(null!);
  const td = useMemo(() => generate(theme), [theme]);

  useEffect(() => {
    const g = ref.current;
    if (!g) return;

    const tex = createTerrainTextures(theme);
    const dispose: (() => void)[] = [];

    // 바닥 평면 (120x120) — 테마 텍스처 또는 색상
    const gGeo = new THREE.PlaneGeometry(GROUND, GROUND);
    gGeo.rotateX(-Math.PI / 2);

    let gMat: THREE.MeshLambertMaterial;
    if (theme === 'island') {
      // 섬: 바닥 = 물
      gMat = new THREE.MeshLambertMaterial({
        color: getGroundPlaneColor(theme),
        transparent: true,
        opacity: 0.8,
      });
    } else {
      const gTex = tex.ground.clone();
      gTex.wrapS = gTex.wrapT = THREE.RepeatWrapping;
      gTex.repeat.set(GROUND, GROUND);
      gTex.needsUpdate = true;
      gMat = new THREE.MeshLambertMaterial({ map: gTex });
      dispose.push(() => gTex.dispose());
    }
    const ground = new THREE.Mesh(gGeo, gMat);
    g.add(ground);
    dispose.push(() => { g.remove(ground); gGeo.dispose(); gMat.dispose(); });

    // 섬 테마: 중앙 잔디 원형 패치
    if (theme === 'island') {
      const islandGeo = new THREE.CircleGeometry(40, 32);
      islandGeo.rotateX(-Math.PI / 2);
      const islandTex = tex.ground.clone();
      islandTex.wrapS = islandTex.wrapT = THREE.RepeatWrapping;
      islandTex.repeat.set(40, 40);
      islandTex.needsUpdate = true;
      const islandMat = new THREE.MeshLambertMaterial({ map: islandTex });
      const islandMesh = new THREE.Mesh(islandGeo, islandMat);
      islandMesh.position.y = 0.02;
      g.add(islandMesh);
      dispose.push(() => { g.remove(islandMesh); islandGeo.dispose(); islandMat.dispose(); islandTex.dispose(); });
    }

    // 블록 지오메트리 (공유)
    const bGeo = new THREE.BoxGeometry(1, 1, 1);

    // 상단 블록 (테마 ground 텍스처)
    const topMats = buildTopBlockMaterials(tex, theme);
    const topIM = makeIM(g, bGeo, topMats as unknown as THREE.Material, td.topBlocks);

    // 하단 블록 (side 텍스처)
    const underMat = new THREE.MeshLambertMaterial({ map: tex.side });
    const underIM = makeIM(g, bGeo, underMat, td.underBlocks);

    // 꽃 (per-instance color)
    const fGeo = new THREE.BoxGeometry(0.2, 0.3, 0.2);
    const fMat = new THREE.MeshLambertMaterial();
    if (td.flowers.length) {
      const fIM = new THREE.InstancedMesh(fGeo, fMat, td.flowers.length);
      const col = new THREE.Color();
      td.flowers.forEach((f, i) => {
        _o.position.set(f.x, f.y, f.z);
        _o.rotation.set(0, 0, 0);
        _o.scale.setScalar(1);
        _o.updateMatrix();
        fIM.setMatrixAt(i, _o.matrix);
        col.set(td.fColors[i]);
        fIM.setColorAt(i, col);
      });
      fIM.instanceMatrix.needsUpdate = true;
      if (fIM.instanceColor) fIM.instanceColor.needsUpdate = true;
      g.add(fIM);
      dispose.push(() => { g.remove(fIM); fIM.dispose(); });
    }

    // 돌
    const sGeo = new THREE.BoxGeometry(0.4, 0.25, 0.4);
    const sMat = new THREE.MeshLambertMaterial({ map: tex.accent });
    const sIM = makeIM(g, sGeo, sMat, td.stones);

    // 잔디 데코
    const tGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);
    const grassColor = getThemeDecoColors(theme).grassColor;
    const tMat = new THREE.MeshLambertMaterial({ color: grassColor });
    const tIM = makeIM(g, tGeo, tMat, td.grass);

    // 연못 (forest/island만)
    if (td.hasPond) {
      const wGeo = new THREE.CircleGeometry(td.pondR, 16);
      wGeo.rotateX(-Math.PI / 2);
      const wMat = new THREE.MeshLambertMaterial({
        color: getWaterColor(theme),
        transparent: true,
        opacity: 0.6,
      });
      const water = new THREE.Mesh(wGeo, wMat);
      water.position.set(td.pondCx, 0.01, td.pondCz);
      g.add(water);
      dispose.push(() => { g.remove(water); wGeo.dispose(); wMat.dispose(); });
    }

    dispose.push(() => {
      [topIM, underIM, sIM, tIM].forEach(m => { if (m) { g.remove(m); m.dispose(); } });
      [bGeo, fGeo, sGeo, tGeo].forEach(x => x.dispose());
      [underMat, fMat, sMat, tMat, ...topMats].forEach(m => m.dispose());
    });

    return () => dispose.forEach(fn => fn());
  }, [td, theme]);

  return <group ref={ref} />;
}

// ─── 상단 블록 멀티 머티리얼 생성 (6면: 4 side + top + bottom) ───

function buildTopBlockMaterials(
  tex: TerrainTextureSet,
  theme: string,
): THREE.MeshLambertMaterial[] {
  return [
    new THREE.MeshLambertMaterial({ map: tex.side }),   // +x
    new THREE.MeshLambertMaterial({ map: tex.side }),   // -x
    new THREE.MeshLambertMaterial({ map: tex.ground }), // +y (top)
    new THREE.MeshLambertMaterial({ map: tex.side }),   // -y (bottom)
    new THREE.MeshLambertMaterial({ map: tex.side }),   // +z
    new THREE.MeshLambertMaterial({ map: tex.side }),   // -z
  ];
}
