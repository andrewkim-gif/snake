'use client';

/**
 * VoxelTerrain — 넓은 바닥(120x120) + 언덕 + 장식 (꽃/돌/풀/연못)
 * 안개로 가장자리 완전 은폐 → 무한 월드 느낌
 */

import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { getVoxelTextures } from '@/lib/3d/voxel-textures';

const GROUND = 120;
const HILLS: { cx: number; cz: number; r: number; h: number }[] = [
  { cx: 0, cz: 0, r: 3, h: 2 }, { cx: -12, cz: -8, r: 3, h: 2 },
  { cx: 10, cz: -12, r: 2.5, h: 1 }, { cx: -14, cz: 7, r: 2, h: 1 },
  { cx: 13, cz: 9, r: 3, h: 2 }, { cx: -6, cz: 14, r: 2.5, h: 1 },
  { cx: 8, cz: -5, r: 2, h: 1 }, { cx: -9, cz: -14, r: 2, h: 1 },
  { cx: 16, cz: -3, r: 2.5, h: 2 }, { cx: -16, cz: -1, r: 2, h: 1 },
  { cx: 3, cz: 16, r: 2, h: 1 },
];
const POND = { cx: -5, cz: 7, r: 3 };

function srand(s: number) { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

interface P3 { x: number; y: number; z: number }

function inPond(x: number, z: number) {
  return Math.sqrt((x - POND.cx) ** 2 + (z - POND.cz) ** 2) < POND.r + 0.5;
}

function generate() {
  const grass: P3[] = [], dirt: P3[] = [];
  const flowers: P3[] = [], fColors: string[] = [];
  const stones: P3[] = [], tGrass: P3[] = [];
  const hm = new Map<string, number>();

  for (const hill of HILLS) {
    const ir = Math.ceil(hill.r);
    for (let dx = -ir; dx <= ir; dx++) for (let dz = -ir; dz <= ir; dz++) {
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > hill.r) continue;
      const h = Math.max(1, Math.round(hill.h * Math.cos((d / hill.r) * Math.PI * 0.5)));
      const k = `${hill.cx + dx},${hill.cz + dz}`;
      if (h > (hm.get(k) || 0)) hm.set(k, h);
    }
  }
  for (const [k, h] of hm) {
    const [gx, gz] = k.split(',').map(Number);
    for (let l = 0; l < h; l++) (l === h - 1 ? grass : dirt).push({ x: gx, y: l + 0.5, z: gz });
  }

  // 꽃 50개
  for (let i = 0; i < 50; i++) {
    const x = (srand(i * 3.17) - 0.5) * 50, z = (srand(i * 7.31) - 0.5) * 50;
    if (inPond(x, z) || hm.has(`${Math.round(x)},${Math.round(z)}`)) continue;
    flowers.push({ x, y: 0.15, z });
    fColors.push(srand(i * 11.7) > 0.5 ? '#FF4444' : '#FFDD44');
  }
  // 돌 25개
  for (let i = 0; i < 25; i++) {
    const x = (srand(i * 5.31 + 100) - 0.5) * 45, z = (srand(i * 9.13 + 100) - 0.5) * 45;
    if (!inPond(x, z)) stones.push({ x, y: 0.12, z });
  }
  // 잔디 40개
  for (let i = 0; i < 40; i++) {
    const x = (srand(i * 4.71 + 200) - 0.5) * 50, z = (srand(i * 8.37 + 200) - 0.5) * 50;
    if (!inPond(x, z)) tGrass.push({ x, y: 0.2, z });
  }

  return { grass, dirt, flowers, fColors, stones, tGrass };
}

const _o = new THREE.Object3D();

function makeIM(g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, ps: P3[]) {
  if (!ps.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, ps.length);
  ps.forEach((b, i) => {
    _o.position.set(b.x, b.y, b.z); _o.rotation.set(0, 0, 0);
    _o.scale.setScalar(1); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix);
  });
  m.instanceMatrix.needsUpdate = true; g.add(m); return m;
}

export function VoxelTerrain() {
  const ref = useRef<THREE.Group>(null!);
  const td = useMemo(generate, []);

  useEffect(() => {
    const g = ref.current; if (!g) return;
    const tex = getVoxelTextures();
    const dispose: (() => void)[] = [];

    // 바닥 평면 (120×120)
    const gGeo = new THREE.PlaneGeometry(GROUND, GROUND); gGeo.rotateX(-Math.PI / 2);
    const gTex = tex.grassTop.clone();
    gTex.wrapS = gTex.wrapT = THREE.RepeatWrapping; gTex.repeat.set(GROUND, GROUND); gTex.needsUpdate = true;
    const gMat = new THREE.MeshLambertMaterial({ map: gTex });
    const ground = new THREE.Mesh(gGeo, gMat); g.add(ground);
    dispose.push(() => { g.remove(ground); gGeo.dispose(); gMat.dispose(); gTex.dispose(); });

    // 블록 지오메트리 (공유)
    const bGeo = new THREE.BoxGeometry(1, 1, 1);
    const grassMats = [
      new THREE.MeshLambertMaterial({ map: tex.grassSide }),
      new THREE.MeshLambertMaterial({ map: tex.grassSide }),
      new THREE.MeshLambertMaterial({ map: tex.grassTop }),
      new THREE.MeshLambertMaterial({ map: tex.dirt }),
      new THREE.MeshLambertMaterial({ map: tex.grassSide }),
      new THREE.MeshLambertMaterial({ map: tex.grassSide }),
    ];

    // 언덕 잔디+흙
    const gIM = makeIM(g, bGeo, grassMats as unknown as THREE.Material, td.grass);
    const dMat = new THREE.MeshLambertMaterial({ map: tex.dirt });
    const dIM = makeIM(g, bGeo, dMat, td.dirt);

    // 꽃 (per-instance color)
    const fGeo = new THREE.BoxGeometry(0.2, 0.3, 0.2);
    const fMat = new THREE.MeshLambertMaterial();
    if (td.flowers.length) {
      const fIM = new THREE.InstancedMesh(fGeo, fMat, td.flowers.length);
      const col = new THREE.Color();
      td.flowers.forEach((f, i) => {
        _o.position.set(f.x, f.y, f.z); _o.rotation.set(0, 0, 0); _o.scale.setScalar(1); _o.updateMatrix();
        fIM.setMatrixAt(i, _o.matrix); col.set(td.fColors[i]); fIM.setColorAt(i, col);
      });
      fIM.instanceMatrix.needsUpdate = true;
      if (fIM.instanceColor) fIM.instanceColor.needsUpdate = true;
      g.add(fIM);
      dispose.push(() => { g.remove(fIM); fIM.dispose(); });
    }

    // 돌
    const sGeo = new THREE.BoxGeometry(0.4, 0.25, 0.4);
    const sMat = new THREE.MeshLambertMaterial({ map: tex.stone });
    const sIM = makeIM(g, sGeo, sMat, td.stones);

    // 잔디
    const tGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);
    const tMat = new THREE.MeshLambertMaterial({ color: '#3D8C2E' });
    const tIM = makeIM(g, tGeo, tMat, td.tGrass);

    // 연못
    const wGeo = new THREE.CircleGeometry(POND.r, 16); wGeo.rotateX(-Math.PI / 2);
    const wMat = new THREE.MeshLambertMaterial({ color: '#3388DD', transparent: true, opacity: 0.6 });
    const water = new THREE.Mesh(wGeo, wMat); water.position.set(POND.cx, 0.01, POND.cz); g.add(water);

    dispose.push(() => {
      [gIM, dIM, sIM, tIM].forEach(m => { if (m) { g.remove(m); m.dispose(); } });
      g.remove(water);
      [bGeo, fGeo, sGeo, tGeo, wGeo].forEach(x => x.dispose());
      [dMat, fMat, sMat, tMat, wMat, ...grassMats].forEach(m => m.dispose());
    });

    return () => dispose.forEach(fn => fn());
  }, [td]);

  return <group ref={ref} />;
}
