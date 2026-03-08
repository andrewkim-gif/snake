/**
 * landmark-geometries.ts — 마인크래프트 스타일 복셀 랜드마크 (v20 Phase 3 MC)
 *
 * 모든 Archetype을 BoxGeometry만으로 구성 (마크 복셀 미학).
 * ConeGeo, SphereGeo, CylinderGeo, TorusGeo 사용 금지.
 * flatShading + 선명한 색상 = MC 느낌.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LandmarkArchetype } from './landmark-data';

// ─── 스케일 ───
const S = 1.8;

// ─── 헬퍼 ───

function b(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

function t(g: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry {
  g.translate(x, y, z);
  return g;
}

function rY(g: THREE.BufferGeometry, a: number): THREE.BufferGeometry {
  g.rotateY(a);
  return g;
}

function rZ(g: THREE.BufferGeometry, a: number): THREE.BufferGeometry {
  g.rotateZ(a);
  return g;
}

function m(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const result = mergeGeometries(geos);
  geos.forEach(g => g.dispose());
  return result;
}

// ─── Archetype 생성기 (복셀 only) ───

/** TOWER: 에펠탑/도쿄타워 — MC 격자 타워 (박스 적층 + 꼭대기 안테나) */
function createTower(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 4개 다리 (기울어진 박스)
  p.push(t(rZ(b(0.2*S, 1.2*S, 0.2*S), 0.15), -0.35*S, 0.55*S, -0.35*S));
  p.push(t(rZ(b(0.2*S, 1.2*S, 0.2*S), -0.15), 0.35*S, 0.55*S, -0.35*S));
  p.push(t(rZ(b(0.2*S, 1.2*S, 0.2*S), 0.15), -0.35*S, 0.55*S, 0.35*S));
  p.push(t(rZ(b(0.2*S, 1.2*S, 0.2*S), -0.15), 0.35*S, 0.55*S, 0.35*S));
  // 중간 플랫폼
  p.push(t(b(0.7*S, 0.15*S, 0.7*S), 0, 1.0*S, 0));
  // 상부 바디 (좁아지는 적층)
  p.push(t(b(0.5*S, 0.8*S, 0.5*S), 0, 1.5*S, 0));
  p.push(t(b(0.35*S, 0.6*S, 0.35*S), 0, 2.2*S, 0));
  // 안테나
  p.push(t(b(0.1*S, 0.8*S, 0.1*S), 0, 2.9*S, 0));
  p.push(t(b(0.06*S, 0.4*S, 0.06*S), 0, 3.5*S, 0));
  return m(p);
}

/** PYRAMID: MC 계단식 피라미드 (큰→작은 박스 적층) */
function createPyramid(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const w = (2.0 - i * 0.35) * S;
    const h = 0.4 * S;
    p.push(t(b(w, h, w), 0, i * h + h / 2, 0));
  }
  return m(p);
}

/** DOME: MC 돔 모스크 (큰 박스 + 단계적 돔 근사 + 미나렛) */
function createDome(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 메인 빌딩
  p.push(t(b(1.8*S, 0.7*S, 1.4*S), 0, 0.35*S, 0));
  // 돔 (박스 계단으로 근사)
  p.push(t(b(1.0*S, 0.3*S, 1.0*S), 0, 0.85*S, 0));
  p.push(t(b(0.7*S, 0.3*S, 0.7*S), 0, 1.15*S, 0));
  p.push(t(b(0.4*S, 0.25*S, 0.4*S), 0, 1.4*S, 0));
  p.push(t(b(0.2*S, 0.2*S, 0.2*S), 0, 1.62*S, 0));
  // 4 미나렛 (박스 기둥)
  const mp = [[-0.8, 0.4], [0.8, 0.4], [-0.8, -0.4], [0.8, -0.4]];
  for (const [px, pz] of mp) {
    p.push(t(b(0.15*S, 1.6*S, 0.15*S), px*S, 0.8*S, pz*S));
    p.push(t(b(0.2*S, 0.15*S, 0.2*S), px*S, 1.65*S, pz*S));
  }
  return m(p);
}

/** NEEDLE: MC 첨탑 (좁은 박스 적층 + 관측대 플랫폼) */
function createNeedle(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 기단
  p.push(t(b(0.5*S, 0.3*S, 0.5*S), 0, 0.15*S, 0));
  // 샤프트 (단계적으로 좁아지는 박스)
  p.push(t(b(0.3*S, 1.5*S, 0.3*S), 0, 1.05*S, 0));
  p.push(t(b(0.2*S, 1.0*S, 0.2*S), 0, 2.3*S, 0));
  // 관측대 플랫폼
  p.push(t(b(0.7*S, 0.15*S, 0.7*S), 0, 2.65*S, 0));
  p.push(t(b(0.5*S, 0.15*S, 0.5*S), 0, 2.8*S, 0));
  // 안테나
  p.push(t(b(0.1*S, 1.0*S, 0.1*S), 0, 3.4*S, 0));
  return m(p);
}

/** STATUE: MC 조각상 (박스 인체 + 받침대) */
function createStatue(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 받침대
  p.push(t(b(0.9*S, 0.8*S, 0.9*S), 0, 0.4*S, 0));
  p.push(t(b(0.7*S, 0.2*S, 0.7*S), 0, 0.9*S, 0));
  // 다리
  p.push(t(b(0.25*S, 0.6*S, 0.25*S), -0.15*S, 1.3*S, 0));
  p.push(t(b(0.25*S, 0.6*S, 0.25*S), 0.15*S, 1.3*S, 0));
  // 몸통
  p.push(t(b(0.5*S, 0.7*S, 0.3*S), 0, 1.95*S, 0));
  // 팔
  p.push(t(b(0.2*S, 0.6*S, 0.2*S), -0.35*S, 2.0*S, 0));
  p.push(t(b(0.2*S, 0.8*S, 0.2*S), 0.35*S, 2.1*S, 0)); // 오른팔 높이
  // 머리
  p.push(t(b(0.3*S, 0.3*S, 0.3*S), 0, 2.45*S, 0));
  // 횃불 (오른손 위)
  p.push(t(b(0.12*S, 0.3*S, 0.12*S), 0.35*S, 2.65*S, 0));
  return m(p);
}

/** WALL: MC 만리장성 (지그재그 박스 벽 + 망루) */
function createWall(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 지그재그 벽 세그먼트
  p.push(t(rY(b(1.0*S, 0.7*S, 0.25*S), 0.3), -0.6*S, 0.35*S, -0.1*S));
  p.push(t(rY(b(1.0*S, 0.7*S, 0.25*S), -0.3), 0.2*S, 0.35*S, 0.1*S));
  p.push(t(rY(b(0.8*S, 0.7*S, 0.25*S), 0.2), 1.0*S, 0.35*S, -0.15*S));
  // 망루 (양 끝)
  p.push(t(b(0.4*S, 1.1*S, 0.4*S), -1.1*S, 0.55*S, -0.25*S));
  p.push(t(b(0.4*S, 1.1*S, 0.4*S), 1.3*S, 0.55*S, 0.0*S));
  // 흉벽 (작은 블록)
  for (let i = 0; i < 3; i++) {
    p.push(t(b(0.15*S, 0.2*S, 0.15*S), -1.1*S + i*0.15*S, 1.2*S, -0.25*S));
    p.push(t(b(0.15*S, 0.2*S, 0.15*S), 1.15*S + i*0.15*S, 1.2*S, 0.0*S));
  }
  return m(p);
}

/** ARENA: MC 콜로세움 (사각 링 형태) */
function createArena(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const w = 1.8*S, d = 1.4*S, h = 0.8*S, th = 0.2*S;
  // 4면 벽
  p.push(t(b(w, h, th), 0, h/2, d/2));    // 앞
  p.push(t(b(w, h, th), 0, h/2, -d/2));   // 뒤
  p.push(t(b(th, h, d), w/2, h/2, 0));    // 오른쪽
  p.push(t(b(th, h, d), -w/2, h/2, 0));   // 왼쪽
  // 아레나 바닥
  p.push(t(b(w-th*2, 0.1*S, d-th*2), 0, 0.05*S, 0));
  // 아치 장식 (상단 작은 블록)
  for (let i = -3; i <= 3; i++) {
    p.push(t(b(0.15*S, 0.2*S, 0.12*S), i*0.22*S, h+0.1*S, d/2));
    p.push(t(b(0.15*S, 0.2*S, 0.12*S), i*0.22*S, h+0.1*S, -d/2));
  }
  return m(p);
}

/** BRIDGE: MC 현수교 (박스 탑 + 도로 + 케이블 근사) */
function createBridge(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 두 타워
  p.push(t(b(0.25*S, 2.5*S, 0.25*S), -1.0*S, 1.25*S, 0));
  p.push(t(b(0.25*S, 2.5*S, 0.25*S), 1.0*S, 1.25*S, 0));
  // 도로
  p.push(t(b(3.0*S, 0.12*S, 0.5*S), 0, 0.8*S, 0));
  // 케이블 (계단형 박스 근사 — MC 스타일)
  for (let i = -4; i <= 4; i++) {
    const x = i * 0.22 * S;
    const y = (2.3 - Math.abs(i) * 0.15) * S;
    p.push(t(b(0.06*S, 0.06*S, 0.06*S), x, y, 0.15*S));
    p.push(t(b(0.06*S, 0.06*S, 0.06*S), x, y, -0.15*S));
  }
  // 수직 케이블 (타워에서 도로로)
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue;
    const x = i * 0.22 * S;
    const top = (2.3 - Math.abs(i) * 0.15) * S;
    p.push(t(b(0.04*S, top - 0.8*S, 0.04*S), x, (top + 0.8*S)/2, 0));
  }
  return m(p);
}

/** PAGODA: MC 한/중/일 파고다 (적층 기와지붕 → 박스 처마) */
function createPagoda(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const w = (1.4 - i * 0.3) * S;
    const h = 0.45 * S;
    const y = i * 0.65 * S;
    // 벽체
    p.push(t(b(w * 0.8, h, w * 0.6), 0, y + h/2, 0));
    // 처마 (넓은 박스 — MC 스타일 지붕)
    p.push(t(b(w * 1.2, 0.08*S, w * 0.9), 0, y + h + 0.04*S, 0));
    // 처마 끝 살짝 올라감 (작은 엣지 블록)
    p.push(t(b(0.1*S, 0.06*S, w * 0.9), -w*0.6, y + h + 0.1*S, 0));
    p.push(t(b(0.1*S, 0.06*S, w * 0.9), w*0.6, y + h + 0.1*S, 0));
  }
  // 꼭대기 장식
  p.push(t(b(0.1*S, 0.5*S, 0.1*S), 0, tiers * 0.65*S + 0.25*S, 0));
  return m(p);
}

/** SHELLS: MC 오페라하우스 (삼각 돛 → 적층 계단 박스) */
function createShells(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 기단 플랫폼
  p.push(t(b(2.2*S, 0.2*S, 1.0*S), 0, 0.1*S, 0));
  // 4개 "돛" (MC 계단식 삼각형)
  for (let s = 0; s < 4; s++) {
    const xOff = (-0.6 + s * 0.4) * S;
    const maxH = 5 - s;
    for (let layer = 0; layer < maxH; layer++) {
      const w = (0.5 - layer * 0.08) * S;
      p.push(t(b(w, 0.25*S, 0.3*S), xOff, 0.32*S + layer * 0.25*S, 0));
    }
  }
  return m(p);
}

/** ONION_DOME: MC 성바실리 (적층 박스 양파돔) */
function createOnionDome(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 메인 빌딩
  p.push(t(b(1.6*S, 0.8*S, 1.2*S), 0, 0.4*S, 0));
  // 5개 양파돔 타워
  const dp = [[0, 0, 2.0], [-0.45, 0, 1.5], [0.45, 0, 1.5], [-0.25, 0.3, 1.3], [0.25, -0.3, 1.3]];
  for (const [dx, dz, maxH] of dp) {
    // 기둥
    p.push(t(b(0.15*S, (maxH-0.5)*S, 0.15*S), dx*S, (maxH-0.5)*S/2 + 0.4*S, dz*S));
    // 양파 (넓어졌다 좁아지는 박스 스택)
    const bulbY = (maxH - 0.3) * S;
    p.push(t(b(0.2*S, 0.15*S, 0.2*S), dx*S, bulbY, dz*S));
    p.push(t(b(0.28*S, 0.12*S, 0.28*S), dx*S, bulbY + 0.12*S, dz*S));
    p.push(t(b(0.22*S, 0.12*S, 0.22*S), dx*S, bulbY + 0.24*S, dz*S));
    p.push(t(b(0.12*S, 0.1*S, 0.12*S), dx*S, bulbY + 0.34*S, dz*S));
    p.push(t(b(0.06*S, 0.12*S, 0.06*S), dx*S, bulbY + 0.45*S, dz*S));
  }
  return m(p);
}

/** MOUNTAIN: MC 산 (계단식 박스 피라미드 + 눈캡) */
function createMountain(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const layers = 6;
  for (let i = 0; i < layers; i++) {
    const w = (2.5 - i * 0.4) * S;
    p.push(t(b(w, 0.35*S, w * 0.8), 0, i * 0.35*S + 0.175*S, 0));
  }
  // 눈캡 (상위 2레이어 정도 — 머티리얼에서 구분 불가하므로 약간 작은 블록)
  p.push(t(b(0.5*S, 0.25*S, 0.4*S), 0, layers * 0.35*S + 0.125*S, 0));
  return m(p);
}

/** TWIN_TOWER: MC 쌍둥이 타워 + 스카이 브릿지 */
function createTwinTower(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 좌 타워
  p.push(t(b(0.5*S, 3.0*S, 0.5*S), -0.45*S, 1.5*S, 0));
  // 우 타워
  p.push(t(b(0.5*S, 3.0*S, 0.5*S), 0.45*S, 1.5*S, 0));
  // 스카이 브릿지
  p.push(t(b(0.4*S, 0.12*S, 0.25*S), 0, 2.0*S, 0));
  // 첨탑 (박스 안테나)
  p.push(t(b(0.12*S, 0.6*S, 0.12*S), -0.45*S, 3.3*S, 0));
  p.push(t(b(0.12*S, 0.6*S, 0.12*S), 0.45*S, 3.3*S, 0));
  return m(p);
}

/** BRIDGE_TOP: MC 마리나 베이 샌즈 (3 타워 + 상판) */
function createBridgeTop(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  for (let i = -1; i <= 1; i++) {
    p.push(t(b(0.35*S, 2.5*S, 0.6*S), i * 0.6*S, 1.25*S, 0));
  }
  // 보트 상판
  p.push(t(b(2.4*S, 0.12*S, 0.8*S), 0, 2.6*S, 0));
  // 상판 위 수영장 (작은 인덴트)
  p.push(t(b(1.6*S, 0.06*S, 0.4*S), 0, 2.7*S, 0));
  return m(p);
}

/** SPIRE_CLUSTER: MC 다중 첨탑 */
function createSpireCluster(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 기단
  p.push(t(b(1.4*S, 0.4*S, 1.0*S), 0, 0.2*S, 0));
  // 5개 첨탑 (높이 다른 박스 기둥)
  const sd = [[0, 2.8, 0.18], [-0.4, 2.0, 0.14], [0.4, 2.0, 0.14], [-0.2, 1.6, 0.12], [0.2, 1.6, 0.12]];
  for (const [dx, h, w] of sd) {
    p.push(t(b(w*S, h*S, w*S), dx*S, h*S/2 + 0.4*S, 0));
    // 꼭대기 장식
    p.push(t(b(w*0.5*S, 0.2*S, w*0.5*S), dx*S, h*S + 0.5*S, 0));
  }
  return m(p);
}

/** SKYSCRAPER: MC 고층빌딩 (단계식 적층) */
function createSkyscraper(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  p.push(t(b(1.0*S, 1.0*S, 0.8*S), 0, 0.5*S, 0));
  p.push(t(b(0.75*S, 1.2*S, 0.6*S), 0, 1.6*S, 0));
  p.push(t(b(0.5*S, 1.0*S, 0.4*S), 0, 2.7*S, 0));
  // 안테나
  p.push(t(b(0.1*S, 0.6*S, 0.1*S), 0, 3.5*S, 0));
  return m(p);
}

/** CLOCK_TOWER: MC 빅벤 (시계탑 + 뾰족 지붕) */
function createClockTower(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 메인 타워
  p.push(t(b(0.6*S, 2.8*S, 0.6*S), 0, 1.4*S, 0));
  // 시계 돌출부 (4면)
  p.push(t(b(0.75*S, 0.4*S, 0.75*S), 0, 2.5*S, 0));
  // 뾰족 지붕 (박스 적층)
  p.push(t(b(0.5*S, 0.3*S, 0.5*S), 0, 2.95*S, 0));
  p.push(t(b(0.35*S, 0.25*S, 0.35*S), 0, 3.2*S, 0));
  p.push(t(b(0.2*S, 0.2*S, 0.2*S), 0, 3.42*S, 0));
  p.push(t(b(0.1*S, 0.15*S, 0.1*S), 0, 3.6*S, 0));
  return m(p);
}

/** TILTED_TOWER: MC 피사의 사탑 (살짝 기울어진 적층) */
function createTiltedTower(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const tilt = 0.06 * S; // X 방향 오프셋 per layer
  const layers = 7;
  for (let i = 0; i < layers; i++) {
    const w = (0.55 - i * 0.01) * S;
    p.push(t(b(w, 0.35*S, w), i * tilt, i * 0.35*S + 0.175*S, 0));
    // 층 구분 블록 (약간 넓은)
    if (i < layers - 1) {
      p.push(t(b(w + 0.06*S, 0.06*S, w + 0.06*S), i * tilt, (i + 1) * 0.35*S, 0));
    }
  }
  return m(p);
}

/** TEMPLE: MC 파르테논 (기단 + 기둥 + 삼각 지붕) */
function createTemple(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 기단 (3단 계단)
  p.push(t(b(2.0*S, 0.1*S, 1.2*S), 0, 0.05*S, 0));
  p.push(t(b(1.8*S, 0.1*S, 1.0*S), 0, 0.15*S, 0));
  // 6개 기둥 (박스)
  for (let i = 0; i < 6; i++) {
    p.push(t(b(0.12*S, 1.2*S, 0.12*S), (-0.75 + i * 0.3)*S, 0.8*S, 0.35*S));
  }
  // 뒤쪽 벽
  p.push(t(b(1.6*S, 1.0*S, 0.1*S), 0, 0.7*S, -0.35*S));
  // 삼각 지붕 (MC 계단식)
  p.push(t(b(1.8*S, 0.15*S, 0.9*S), 0, 1.47*S, 0));
  p.push(t(b(1.3*S, 0.15*S, 0.6*S), 0, 1.62*S, 0));
  p.push(t(b(0.7*S, 0.12*S, 0.4*S), 0, 1.74*S, 0));
  return m(p);
}

/** GATE: MC 개선문/문 (기둥 + 상부 + 아치 근사) */
function createGate(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 2개 주 기둥
  p.push(t(b(0.4*S, 1.8*S, 0.4*S), -0.5*S, 0.9*S, 0));
  p.push(t(b(0.4*S, 1.8*S, 0.4*S), 0.5*S, 0.9*S, 0));
  // 상부 블록 (엔타블러처)
  p.push(t(b(1.6*S, 0.3*S, 0.5*S), 0, 2.0*S, 0));
  // 아치 (기둥 사이 상단 블록)
  p.push(t(b(0.6*S, 0.25*S, 0.35*S), 0, 1.55*S, 0));
  // 쿼드리가 장식 (상부)
  p.push(t(b(0.5*S, 0.25*S, 0.3*S), 0, 2.3*S, 0));
  p.push(t(b(0.15*S, 0.2*S, 0.15*S), 0, 2.55*S, 0));
  return m(p);
}

/** WINDMILL: MC 풍차 (사각 타워 + 십자 날개) */
function createWindmill(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 타워 바디 (약간 좁아지는)
  p.push(t(b(0.6*S, 0.7*S, 0.6*S), 0, 0.35*S, 0));
  p.push(t(b(0.5*S, 0.7*S, 0.5*S), 0, 1.05*S, 0));
  p.push(t(b(0.4*S, 0.5*S, 0.4*S), 0, 1.6*S, 0));
  // 지붕 (MC 계단)
  p.push(t(b(0.5*S, 0.15*S, 0.5*S), 0, 1.92*S, 0));
  p.push(t(b(0.3*S, 0.12*S, 0.3*S), 0, 2.05*S, 0));
  // 4개 날개 (십자형 — 긴 얇은 박스)
  p.push(t(b(0.12*S, 1.2*S, 0.04*S), 0, 1.5*S, 0.3*S));
  p.push(t(b(1.2*S, 0.12*S, 0.04*S), 0, 1.5*S, 0.3*S));
  return m(p);
}

/** CASTLE: MC 성 (메인 블록 + 3 타워 + 뾰족 지붕) */
function createCastle(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 메인 블록
  p.push(t(b(1.2*S, 1.2*S, 0.8*S), 0, 0.6*S, 0));
  // 흉벽 (치형)
  for (let i = -2; i <= 2; i++) {
    p.push(t(b(0.18*S, 0.2*S, 0.18*S), i*0.25*S, 1.3*S, 0.3*S));
    p.push(t(b(0.18*S, 0.2*S, 0.18*S), i*0.25*S, 1.3*S, -0.3*S));
  }
  // 3개 타워 (박스 + 뾰족 지붕 → 적층 박스)
  const tp = [[-0.5, 0], [0.5, 0], [0, -0.3]];
  for (const [tx, tz] of tp) {
    p.push(t(b(0.35*S, 2.0*S, 0.35*S), tx*S, 1.0*S, tz*S));
    // 뾰족 지붕 (작아지는 박스 적층)
    p.push(t(b(0.4*S, 0.15*S, 0.4*S), tx*S, 2.1*S, tz*S));
    p.push(t(b(0.3*S, 0.12*S, 0.3*S), tx*S, 2.24*S, tz*S));
    p.push(t(b(0.18*S, 0.12*S, 0.18*S), tx*S, 2.36*S, tz*S));
  }
  return m(p);
}

/** STONE_RING: MC 스톤헨지 (직립 석판 링) */
function createStoneRing(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x = Math.cos(angle) * 0.8 * S;
    const z = Math.sin(angle) * 0.8 * S;
    const h = (0.6 + (i % 3) * 0.15) * S;
    const stone = b(0.2*S, h, 0.12*S);
    rY(stone, -angle);
    t(stone, x, h/2, z);
    p.push(stone);
  }
  // 린텔 (수평 석판)
  p.push(t(b(0.55*S, 0.12*S, 0.15*S), 0.65*S, 0.75*S, 0.35*S));
  p.push(t(b(0.55*S, 0.12*S, 0.15*S), -0.65*S, 0.7*S, -0.35*S));
  return m(p);
}

/** OBELISK: MC 오벨리스크 (가느다란 적층 박스) */
function createObelisk(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  p.push(t(b(0.5*S, 0.3*S, 0.5*S), 0, 0.15*S, 0));
  p.push(t(b(0.35*S, 3.0*S, 0.35*S), 0, 1.8*S, 0));
  // 피라미디온 (꼭대기 작은 계단)
  p.push(t(b(0.3*S, 0.15*S, 0.3*S), 0, 3.37*S, 0));
  p.push(t(b(0.2*S, 0.12*S, 0.2*S), 0, 3.5*S, 0));
  p.push(t(b(0.1*S, 0.1*S, 0.1*S), 0, 3.61*S, 0));
  return m(p);
}

/** TERRACE: MC 계단식 논/유적 */
function createTerrace(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const w = (2.2 - i * 0.35) * S;
    const d = (1.0 - i * 0.08) * S;
    p.push(t(b(w, 0.25*S, d), i * 0.1*S, i * 0.28*S + 0.125*S, 0));
  }
  // 정상 건물
  p.push(t(b(0.3*S, 0.4*S, 0.25*S), 0.4*S, 5*0.28*S + 0.2*S, 0));
  return m(p);
}

/** MESA: MC 테이블 마운틴 (넓은 박스 적층, 평탄 정상) */
function createMesa(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  p.push(t(b(2.4*S, 0.4*S, 1.8*S), 0, 0.2*S, 0));
  p.push(t(b(2.0*S, 0.4*S, 1.5*S), 0, 0.6*S, 0));
  p.push(t(b(1.8*S, 0.4*S, 1.3*S), 0, 1.0*S, 0));
  // 평탄한 정상
  p.push(t(b(1.9*S, 0.15*S, 1.4*S), 0, 1.28*S, 0));
  return m(p);
}

/** MONOLITH: MC 바위/모노리스 (큰 불규칙 박스) */
function createMonolith(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // 메인 바위
  p.push(t(b(1.5*S, 0.6*S, 1.1*S), 0, 0.3*S, 0));
  p.push(t(b(1.2*S, 0.4*S, 0.9*S), 0.1*S, 0.8*S, 0));
  p.push(t(b(0.7*S, 0.3*S, 0.6*S), -0.1*S, 1.15*S, 0));
  return m(p);
}

// ─── 캐시 + 팩토리 ───

const geometryCache = new Map<string, THREE.BufferGeometry>();

export function createArchetypeGeometry(archetype: LandmarkArchetype): THREE.BufferGeometry {
  const cached = geometryCache.get(archetype);
  if (cached) return cached;

  let geo: THREE.BufferGeometry;

  switch (archetype) {
    case LandmarkArchetype.TOWER:         geo = createTower(); break;
    case LandmarkArchetype.PYRAMID:       geo = createPyramid(); break;
    case LandmarkArchetype.DOME:          geo = createDome(); break;
    case LandmarkArchetype.NEEDLE:        geo = createNeedle(); break;
    case LandmarkArchetype.STATUE:        geo = createStatue(); break;
    case LandmarkArchetype.WALL:          geo = createWall(); break;
    case LandmarkArchetype.ARENA:         geo = createArena(); break;
    case LandmarkArchetype.BRIDGE:        geo = createBridge(); break;
    case LandmarkArchetype.PAGODA:        geo = createPagoda(); break;
    case LandmarkArchetype.SHELLS:        geo = createShells(); break;
    case LandmarkArchetype.ONION_DOME:    geo = createOnionDome(); break;
    case LandmarkArchetype.MOUNTAIN:      geo = createMountain(); break;
    case LandmarkArchetype.TWIN_TOWER:    geo = createTwinTower(); break;
    case LandmarkArchetype.BRIDGE_TOP:    geo = createBridgeTop(); break;
    case LandmarkArchetype.SPIRE_CLUSTER: geo = createSpireCluster(); break;
    case LandmarkArchetype.SKYSCRAPER:    geo = createSkyscraper(); break;
    case LandmarkArchetype.CLOCK_TOWER:   geo = createClockTower(); break;
    case LandmarkArchetype.TILTED_TOWER:  geo = createTiltedTower(); break;
    case LandmarkArchetype.TEMPLE:        geo = createTemple(); break;
    case LandmarkArchetype.GATE:          geo = createGate(); break;
    case LandmarkArchetype.WINDMILL:      geo = createWindmill(); break;
    case LandmarkArchetype.CASTLE:        geo = createCastle(); break;
    case LandmarkArchetype.STONE_RING:    geo = createStoneRing(); break;
    case LandmarkArchetype.OBELISK:       geo = createObelisk(); break;
    case LandmarkArchetype.TERRACE:       geo = createTerrace(); break;
    case LandmarkArchetype.MESA:          geo = createMesa(); break;
    case LandmarkArchetype.MONOLITH:      geo = createMonolith(); break;
    default:                              geo = createPyramid(); break;
  }

  geo.computeVertexNormals();
  geometryCache.set(archetype, geo);
  return geo;
}

export function disposeGeometryCache(): void {
  geometryCache.forEach(g => g.dispose());
  geometryCache.clear();
}
