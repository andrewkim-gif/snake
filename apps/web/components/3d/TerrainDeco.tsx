'use client';

/**
 * TerrainDeco — 6종 테마별 환경 데코레이션 (InstancedMesh)
 *
 * forest:  나무 25개, 꽃 40개, 버섯 10개
 * desert:  선인장 15개, 바위 20개
 * mountain: 침엽수 10개, 바위 30개
 * urban:   건물 블록 15개, 가로등 10개
 * arctic:  빙산 5개 (대형)
 * island:  야자수 8개
 *
 * 시드 기반 랜덤 배치, 총 ~6-10 InstancedMesh draw calls
 * useFrame priority 0 필수!
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TerrainDecoProps {
  arenaRadius: number;
  theme?: string;
}

// ─── 시드 기반 의사 난수 ───

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function randomPositionInRing(
  innerR: number,
  outerR: number,
  seed: number,
): [number, number] {
  const angle = seededRandom(seed) * Math.PI * 2;
  const r = innerR + seededRandom(seed + 1000) * (outerR - innerR);
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

function randomPositionInCircle(
  radius: number,
  seed: number,
): [number, number] {
  const angle = seededRandom(seed) * Math.PI * 2;
  const r = radius * Math.sqrt(seededRandom(seed + 1000));
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

// ─── 단일 InstancedMesh 배치 헬퍼 ───

function setInstanceTransform(
  mesh: THREE.InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
  rotY = 0,
): void {
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
  _m.compose(
    new THREE.Vector3(x, y, z),
    _q,
    new THREE.Vector3(scaleX, scaleY, scaleZ),
  );
  mesh.setMatrixAt(index, _m);
}

// ─── 테마별 설정 ───

interface ThemeDecoConfig {
  // 나무/식물
  treeCount: number;
  flowerCount: number;
  // 환경 구조물
  structureCount: number;
  secondaryCount: number;
  // 특수 요소
  specialCount: number;
}

function getDecoConfig(theme: string): ThemeDecoConfig {
  switch (theme) {
    case 'forest':
      return { treeCount: 25, flowerCount: 40, structureCount: 10, secondaryCount: 8, specialCount: 16 };
    case 'desert':
      return { treeCount: 15, flowerCount: 0, structureCount: 20, secondaryCount: 6, specialCount: 0 };
    case 'mountain':
      return { treeCount: 10, flowerCount: 0, structureCount: 30, secondaryCount: 6, specialCount: 0 };
    case 'urban':
      return { treeCount: 0, flowerCount: 0, structureCount: 15, secondaryCount: 10, specialCount: 0 };
    case 'arctic':
      return { treeCount: 0, flowerCount: 0, structureCount: 5, secondaryCount: 0, specialCount: 12 };
    case 'island':
      return { treeCount: 8, flowerCount: 20, structureCount: 0, secondaryCount: 4, specialCount: 0 };
    default:
      return { treeCount: 25, flowerCount: 40, structureCount: 10, secondaryCount: 8, specialCount: 16 };
  }
}

// ─── 꽃 색상 ───

const FLOWER_COLORS: Record<string, string[]> = {
  forest:   ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6EB4', '#FF8C42', '#C084FC', '#F472B6'],
  desert:   [],
  mountain: [],
  urban:    [],
  arctic:   [],
  island:   ['#FF6EB4', '#FFD93D', '#FF8C42', '#FF6B6B', '#C084FC', '#6BCB77'],
};

// ─── 메인 컴포넌트 ───

export function TerrainDeco({ arenaRadius, theme = 'forest' }: TerrainDecoProps) {
  const midR = arenaRadius * 0.60;

  const cfg = useMemo(() => getDecoConfig(theme), [theme]);

  // ─── Refs ───
  const trunkRef = useRef<THREE.InstancedMesh>(null!);
  const canopyRef = useRef<THREE.InstancedMesh>(null!);
  const flowerRef = useRef<THREE.InstancedMesh>(null!);
  const structureRef = useRef<THREE.InstancedMesh>(null!);
  const secondaryRef = useRef<THREE.InstancedMesh>(null!);
  const specialRef = useRef<THREE.InstancedMesh>(null!);

  // ─── Geometries ───
  const geos = useMemo(() => {
    switch (theme) {
      case 'forest':
        return {
          trunk: new THREE.BoxGeometry(4, 16, 4),
          canopy: new THREE.BoxGeometry(12, 12, 12),
          flower: new THREE.BoxGeometry(4, 6, 4),
          structure: new THREE.BoxGeometry(3, 5, 3),   // 버섯
          secondary: new THREE.BoxGeometry(16, 12, 4), // 석재벽
          special: new THREE.BoxGeometry(2, 8, 2),     // 횃불
        };
      case 'desert':
        return {
          trunk: new THREE.BoxGeometry(3, 12, 3),      // 선인장 몸통
          canopy: new THREE.BoxGeometry(6, 4, 6),      // 선인장 상단
          flower: new THREE.BoxGeometry(1, 1, 1),      // 미사용
          structure: new THREE.BoxGeometry(8, 6, 8),    // 바위
          secondary: new THREE.BoxGeometry(20, 3, 16),  // 모래 언덕
          special: new THREE.BoxGeometry(1, 1, 1),      // 미사용
        };
      case 'mountain':
        return {
          trunk: new THREE.BoxGeometry(3, 20, 3),       // 침엽수 줄기
          canopy: new THREE.ConeGeometry(8, 18, 4),     // 침엽수 원뿔
          flower: new THREE.BoxGeometry(1, 1, 1),
          structure: new THREE.BoxGeometry(10, 10, 10),  // 대형 바위
          secondary: new THREE.BoxGeometry(6, 4, 6),     // 소형 바위
          special: new THREE.BoxGeometry(1, 1, 1),
        };
      case 'urban':
        return {
          trunk: new THREE.BoxGeometry(1, 1, 1),
          canopy: new THREE.BoxGeometry(1, 1, 1),
          flower: new THREE.BoxGeometry(1, 1, 1),
          structure: new THREE.BoxGeometry(20, 24, 20),   // 건물 블록
          secondary: new THREE.BoxGeometry(2, 14, 2),     // 가로등 기둥
          special: new THREE.BoxGeometry(1, 1, 1),
        };
      case 'arctic':
        return {
          trunk: new THREE.BoxGeometry(1, 1, 1),
          canopy: new THREE.BoxGeometry(1, 1, 1),
          flower: new THREE.BoxGeometry(1, 1, 1),
          structure: new THREE.BoxGeometry(24, 20, 18),   // 빙산
          secondary: new THREE.BoxGeometry(1, 1, 1),
          special: new THREE.BoxGeometry(4, 2, 4),        // 눈 파티클 (큰 눈 조각)
        };
      case 'island':
        return {
          trunk: new THREE.BoxGeometry(3, 18, 3),        // 야자수 줄기
          canopy: new THREE.BoxGeometry(14, 4, 14),      // 야자수 잎
          flower: new THREE.BoxGeometry(4, 6, 4),        // 열대 꽃
          structure: new THREE.BoxGeometry(1, 1, 1),
          secondary: new THREE.BoxGeometry(6, 3, 6),     // 산호초
          special: new THREE.BoxGeometry(1, 1, 1),
        };
      default:
        return {
          trunk: new THREE.BoxGeometry(4, 16, 4),
          canopy: new THREE.BoxGeometry(12, 12, 12),
          flower: new THREE.BoxGeometry(4, 6, 4),
          structure: new THREE.BoxGeometry(3, 5, 3),
          secondary: new THREE.BoxGeometry(16, 12, 4),
          special: new THREE.BoxGeometry(2, 8, 2),
        };
    }
  }, [theme]);

  // ─── Materials ───
  const mats = useMemo(() => {
    switch (theme) {
      case 'forest':
        return {
          trunk: new THREE.MeshLambertMaterial({ color: '#6B4226' }),
          canopy: new THREE.MeshLambertMaterial({ color: '#3A7D2C' }),
          flower: new THREE.MeshLambertMaterial({ color: '#FF6B6B' }),
          structure: new THREE.MeshLambertMaterial({ color: '#C84040' }),   // 버섯 (빨간 반점)
          secondary: new THREE.MeshLambertMaterial({ color: '#888888' }),   // 석재벽
          special: new THREE.MeshLambertMaterial({
            color: '#FF6600',
            emissive: new THREE.Color('#FF6600'),
            emissiveIntensity: 0.3,
          }), // 횃불
        };
      case 'desert':
        return {
          trunk: new THREE.MeshLambertMaterial({ color: '#3A7030' }),       // 선인장 녹색
          canopy: new THREE.MeshLambertMaterial({ color: '#4A8040' }),      // 선인장 상단
          flower: new THREE.MeshLambertMaterial({ color: '#C4A661' }),
          structure: new THREE.MeshLambertMaterial({ color: '#9B7B57' }),   // 바위 (사암색)
          secondary: new THREE.MeshLambertMaterial({ color: '#d4b672' }),   // 모래 언덕
          special: new THREE.MeshLambertMaterial({ color: '#C4A661' }),
        };
      case 'mountain':
        return {
          trunk: new THREE.MeshLambertMaterial({ color: '#5A3818' }),       // 어두운 나무줄기
          canopy: new THREE.MeshLambertMaterial({ color: '#2A5A1C' }),      // 어두운 침엽수
          flower: new THREE.MeshLambertMaterial({ color: '#6b6b6b' }),
          structure: new THREE.MeshLambertMaterial({ color: '#666666' }),   // 바위
          secondary: new THREE.MeshLambertMaterial({ color: '#777777' }),   // 소형 바위
          special: new THREE.MeshLambertMaterial({ color: '#6b6b6b' }),
        };
      case 'urban':
        return {
          trunk: new THREE.MeshLambertMaterial({ color: '#808080' }),
          canopy: new THREE.MeshLambertMaterial({ color: '#808080' }),
          flower: new THREE.MeshLambertMaterial({ color: '#808080' }),
          structure: new THREE.MeshLambertMaterial({ color: '#606060' }),   // 건물 콘크리트
          secondary: new THREE.MeshLambertMaterial({
            color: '#333333',
            emissive: new THREE.Color('#FFAA00'),
            emissiveIntensity: 0.1,
          }), // 가로등
          special: new THREE.MeshLambertMaterial({ color: '#808080' }),
        };
      case 'arctic':
        return {
          trunk: new THREE.MeshLambertMaterial({ color: '#e8e8f0' }),
          canopy: new THREE.MeshLambertMaterial({ color: '#e8e8f0' }),
          flower: new THREE.MeshLambertMaterial({ color: '#e8e8f0' }),
          structure: new THREE.MeshLambertMaterial({
            color: '#AACCEE',
            emissive: new THREE.Color('#88BBFF'),
            emissiveIntensity: 0.15,
            transparent: true,
            opacity: 0.85,
          }), // 빙산
          secondary: new THREE.MeshLambertMaterial({ color: '#e8e8f0' }),
          special: new THREE.MeshLambertMaterial({
            color: '#FFFFFF',
            transparent: true,
            opacity: 0.7,
          }), // 눈 파티클
        };
      case 'island':
        return {
          trunk: new THREE.MeshLambertMaterial({ color: '#8B6B35' }),       // 야자수 줄기
          canopy: new THREE.MeshLambertMaterial({ color: '#3A8B25' }),      // 야자수 잎
          flower: new THREE.MeshLambertMaterial({ color: '#FF6EB4' }),      // 열대 꽃
          structure: new THREE.MeshLambertMaterial({ color: '#C4A661' }),
          secondary: new THREE.MeshLambertMaterial({
            color: '#FF6666',
            emissive: new THREE.Color('#FF4444'),
            emissiveIntensity: 0.1,
          }), // 산호초
          special: new THREE.MeshLambertMaterial({ color: '#C4A661' }),
        };
      default:
        return {
          trunk: new THREE.MeshLambertMaterial({ color: '#6B4226' }),
          canopy: new THREE.MeshLambertMaterial({ color: '#3A7D2C' }),
          flower: new THREE.MeshLambertMaterial({ color: '#FF6B6B' }),
          structure: new THREE.MeshLambertMaterial({ color: '#C84040' }),
          secondary: new THREE.MeshLambertMaterial({ color: '#888888' }),
          special: new THREE.MeshLambertMaterial({ color: '#FF6600' }),
        };
    }
  }, [theme]);

  // ─── 인스턴스 배치 ───
  useEffect(() => {
    // -- Trees / Trunk + Canopy --
    if (cfg.treeCount > 0 && trunkRef.current && canopyRef.current) {
      for (let i = 0; i < cfg.treeCount; i++) {
        const [x, z] = randomPositionInRing(midR + 100, arenaRadius - 100, i * 7 + 42);
        const rotY = seededRandom(i * 13 + 7) * Math.PI * 2;

        if (theme === 'mountain') {
          // 침엽수: 더 높은 줄기 + 원뿔
          setInstanceTransform(trunkRef.current, i, x, 10, z, 1, 1, 1, rotY);
          setInstanceTransform(canopyRef.current, i, x, 24, z, 1, 1, 1, rotY);
        } else if (theme === 'island') {
          // 야자수: 기울어진 느낌
          setInstanceTransform(trunkRef.current, i, x, 9, z, 1, 1, 1, rotY);
          setInstanceTransform(canopyRef.current, i, x, 20, z, 1, 1, 1, rotY);
        } else if (theme === 'desert') {
          // 선인장
          const cactusScale = 0.6 + seededRandom(i * 5 + 33) * 0.8;
          setInstanceTransform(trunkRef.current, i, x, 6 * cactusScale, z, cactusScale, cactusScale, cactusScale, rotY);
          setInstanceTransform(canopyRef.current, i, x, 12 * cactusScale + 2, z, cactusScale * 0.6, cactusScale, cactusScale * 0.6, rotY);
        } else {
          // 참나무 (forest default)
          setInstanceTransform(trunkRef.current, i, x, 8, z, 1, 1, 1, rotY);
          setInstanceTransform(canopyRef.current, i, x, 22, z, 1, 1, 1, rotY);
        }
      }
      trunkRef.current.instanceMatrix.needsUpdate = true;
      canopyRef.current.instanceMatrix.needsUpdate = true;
    }

    // -- Flowers --
    if (cfg.flowerCount > 0 && flowerRef.current) {
      const colors = FLOWER_COLORS[theme] ?? FLOWER_COLORS.forest;
      for (let i = 0; i < cfg.flowerCount; i++) {
        const [x, z] = randomPositionInRing(midR + 50, arenaRadius - 50, i * 11 + 137);
        setInstanceTransform(flowerRef.current, i, x, 3, z, 1, 1, 1);

        const colorIdx = Math.floor(seededRandom(i * 5 + 23) * colors.length);
        const color = new THREE.Color(colors[colorIdx % colors.length] || '#FF6B6B');
        flowerRef.current.setColorAt(i, color);
      }
      flowerRef.current.instanceMatrix.needsUpdate = true;
      if (flowerRef.current.instanceColor) {
        flowerRef.current.instanceColor.needsUpdate = true;
      }
    }

    // -- Structures --
    if (cfg.structureCount > 0 && structureRef.current) {
      for (let i = 0; i < cfg.structureCount; i++) {
        const rotY = seededRandom(i * 19 + 53) * Math.PI;

        if (theme === 'forest') {
          // 버섯 — 엣지 존
          const [x, z] = randomPositionInRing(midR + 50, arenaRadius - 150, i * 17 + 251);
          setInstanceTransform(structureRef.current, i, x, 2.5, z, 1, 1, 1, rotY);
        } else if (theme === 'desert') {
          // 바위 — 전체 분포
          const [x, z] = randomPositionInRing(200, arenaRadius - 200, i * 17 + 251);
          const sc = 0.5 + seededRandom(i * 7 + 99) * 1.0;
          setInstanceTransform(structureRef.current, i, x, 3 * sc, z, sc, sc, sc, rotY);
        } else if (theme === 'mountain') {
          // 대형 바위 — 전체 분포
          const [x, z] = randomPositionInRing(200, arenaRadius - 200, i * 17 + 251);
          const sc = 0.4 + seededRandom(i * 7 + 99) * 1.2;
          setInstanceTransform(structureRef.current, i, x, 5 * sc, z, sc, sc, sc, rotY);
        } else if (theme === 'urban') {
          // 건물 블록 — 규칙적 배치
          const [x, z] = randomPositionInRing(midR - 200, arenaRadius - 200, i * 17 + 251);
          const floors = 0.5 + seededRandom(i * 3 + 11) * 1.5; // 1~3층
          setInstanceTransform(structureRef.current, i, x, 12 * floors, z, 1, floors, 1, rotY);
          // 건물별 색상 변형
          const gray = 0.3 + seededRandom(i * 9 + 77) * 0.3;
          structureRef.current.setColorAt(i, new THREE.Color(gray, gray, gray + 0.02));
        } else if (theme === 'arctic') {
          // 빙산 — 외곽
          const [x, z] = randomPositionInRing(midR + 200, arenaRadius - 200, i * 17 + 251);
          const sc = 0.8 + seededRandom(i * 7 + 99) * 1.5;
          setInstanceTransform(structureRef.current, i, x, 10 * sc, z, sc, sc, sc, rotY);
        }
      }
      structureRef.current.instanceMatrix.needsUpdate = true;
      if (structureRef.current.instanceColor) {
        structureRef.current.instanceColor.needsUpdate = true;
      }
    }

    // -- Secondary --
    if (cfg.secondaryCount > 0 && secondaryRef.current) {
      for (let i = 0; i < cfg.secondaryCount; i++) {
        const rotY = seededRandom(i * 23 + 389) * Math.PI;

        if (theme === 'forest') {
          // 석재벽
          const [x, z] = randomPositionInRing(arenaRadius * 0.35, midR - 200, i * 23 + 389);
          setInstanceTransform(secondaryRef.current, i, x, 6, z, 1, 1, 1, rotY);
        } else if (theme === 'desert') {
          // 모래 언덕
          const [x, z] = randomPositionInRing(300, arenaRadius - 300, i * 23 + 389);
          const sc = 0.8 + seededRandom(i * 11 + 55) * 0.8;
          setInstanceTransform(secondaryRef.current, i, x, 1.5 * sc, z, sc, sc, sc, rotY);
        } else if (theme === 'mountain') {
          // 소형 바위
          const [x, z] = randomPositionInRing(200, arenaRadius - 150, i * 23 + 389);
          const sc = 0.6 + seededRandom(i * 11 + 55) * 0.8;
          setInstanceTransform(secondaryRef.current, i, x, 2 * sc, z, sc, sc, sc, rotY);
        } else if (theme === 'urban') {
          // 가로등
          const [x, z] = randomPositionInRing(arenaRadius * 0.3, arenaRadius - 200, i * 23 + 389);
          setInstanceTransform(secondaryRef.current, i, x, 7, z, 1, 1, 1, 0);
        } else if (theme === 'island') {
          // 산호초 — 수중 가장자리
          const [x, z] = randomPositionInRing(arenaRadius * 0.6, arenaRadius - 100, i * 23 + 389);
          const sc = 0.5 + seededRandom(i * 11 + 55) * 1.0;
          setInstanceTransform(secondaryRef.current, i, x, 1.5 * sc, z, sc, sc, sc, rotY);
        }
      }
      secondaryRef.current.instanceMatrix.needsUpdate = true;
    }

    // -- Special --
    if (cfg.specialCount > 0 && specialRef.current) {
      for (let i = 0; i < cfg.specialCount; i++) {
        if (theme === 'forest') {
          // 횃불 — 미드 존
          const [x, z] = randomPositionInRing(arenaRadius * 0.25 + 100, midR - 100, i * 17 + 251);
          setInstanceTransform(specialRef.current, i, x, 4, z, 1, 1, 1);
        } else if (theme === 'arctic') {
          // 눈 조각 파티클 — 넓게 분포
          const [x, z] = randomPositionInCircle(arenaRadius * 0.8, i * 29 + 503);
          const y = 10 + seededRandom(i * 13 + 77) * 40;
          const sc = 0.3 + seededRandom(i * 7 + 33) * 0.7;
          setInstanceTransform(specialRef.current, i, x, y, z, sc, sc, sc);
        }
      }
      specialRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [arenaRadius, midR, theme, cfg]);

  // ─── 애니메이션 ───
  useFrame(() => {
    const time = performance.now() * 0.001;

    // Forest: 횃불 불꽃 애니메이션
    if (theme === 'forest' && cfg.specialCount > 0 && specialRef.current) {
      const _m = new THREE.Matrix4();
      const _p = new THREE.Vector3();
      const _q = new THREE.Quaternion();
      const _s = new THREE.Vector3();

      for (let i = 0; i < cfg.specialCount; i++) {
        specialRef.current.getMatrixAt(i, _m);
        _m.decompose(_p, _q, _s);
        const flickerPhase = Math.sin(time * Math.PI + i * 2.1);
        _s.y = flickerPhase > 0 ? 1.1 : 0.9;
        _m.compose(_p, _q, _s);
        specialRef.current.setMatrixAt(i, _m);
      }
      specialRef.current.instanceMatrix.needsUpdate = true;
    }

    // Arctic: 눈 파티클 천천히 떨어지는 애니메이션
    if (theme === 'arctic' && cfg.specialCount > 0 && specialRef.current) {
      const _m = new THREE.Matrix4();
      const _p = new THREE.Vector3();
      const _q = new THREE.Quaternion();
      const _s = new THREE.Vector3();

      for (let i = 0; i < cfg.specialCount; i++) {
        specialRef.current.getMatrixAt(i, _m);
        _m.decompose(_p, _q, _s);
        // 천천히 떨어짐 + 좌우 흔들림
        _p.y -= 0.05;
        _p.x += Math.sin(time * 0.3 + i * 1.7) * 0.1;
        if (_p.y < 0) _p.y = 30 + seededRandom(i * 17 + 501) * 20;
        _m.compose(_p, _q, _s);
        specialRef.current.setMatrixAt(i, _m);
      }
      specialRef.current.instanceMatrix.needsUpdate = true;
    }

    // Urban: 가로등 깜빡임
    if (theme === 'urban' && cfg.secondaryCount > 0 && secondaryRef.current) {
      const mat = mats.secondary;
      if (mat.emissive) {
        const flicker = 0.08 + Math.sin(time * 2) * 0.04;
        mat.emissiveIntensity = flicker;
      }
    }
  });

  // ─── Cleanup ───
  useEffect(() => {
    return () => {
      Object.values(geos).forEach(g => g.dispose());
      Object.values(mats).forEach(m => m.dispose());
    };
  }, [geos, mats]);

  return (
    <group>
      {/* 나무/식물 trunk */}
      {cfg.treeCount > 0 && (
        <instancedMesh
          ref={trunkRef}
          args={[geos.trunk, mats.trunk, cfg.treeCount]}
          frustumCulled={false}
        />
      )}

      {/* 나무/식물 canopy */}
      {cfg.treeCount > 0 && (
        <instancedMesh
          ref={canopyRef}
          args={[geos.canopy, mats.canopy, cfg.treeCount]}
          frustumCulled={false}
        />
      )}

      {/* 꽃 */}
      {cfg.flowerCount > 0 && (
        <instancedMesh
          ref={flowerRef}
          args={[geos.flower, mats.flower, cfg.flowerCount]}
          frustumCulled={false}
        />
      )}

      {/* 환경 구조물 (버섯/바위/건물/빙산) */}
      {cfg.structureCount > 0 && (
        <instancedMesh
          ref={structureRef}
          args={[geos.structure, mats.structure, cfg.structureCount]}
          frustumCulled={false}
        />
      )}

      {/* 보조 구조물 (석재벽/모래언덕/가로등/산호초) */}
      {cfg.secondaryCount > 0 && (
        <instancedMesh
          ref={secondaryRef}
          args={[geos.secondary, mats.secondary, cfg.secondaryCount]}
          frustumCulled={false}
        />
      )}

      {/* 특수 요소 (횃불/눈 파티클) */}
      {cfg.specialCount > 0 && (
        <instancedMesh
          ref={specialRef}
          args={[geos.special, mats.special, cfg.specialCount]}
          frustumCulled={false}
        />
      )}
    </group>
  );
}
