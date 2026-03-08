/**
 * landmark-geometries.ts — 12+ Archetype 프로시저럴 3D 지오메트리 팩토리 (v20 Phase 3)
 *
 * 각 Archetype에 대해 로우폴리 BufferGeometry를 프로시저럴 생성.
 * Three.js r175 기본 지오메트리를 조합하여 구성.
 *
 * 호출: createArchetypeGeometry(archetype) → BufferGeometry (merged)
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LandmarkArchetype } from './landmark-data';

// ─── 스케일 상수 ───
// 지구 반경 100 기준, 랜드마크는 1~4 unit 정도가 적절
const S = 1.8; // base scale multiplier (지구 반경 100 기준, 눈에 잘 띄도록)

// ─── 헬퍼 ───

function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

function cylinder(rTop: number, rBot: number, h: number, seg = 8): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rTop, rBot, h, seg);
}

function cone(r: number, h: number, seg = 6): THREE.BufferGeometry {
  return new THREE.ConeGeometry(r, h, seg);
}

function sphere(r: number, wSeg = 8, hSeg = 6): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, wSeg, hSeg);
}

function torus(r: number, tube: number, radSeg = 8, tubeSeg = 12): THREE.BufferGeometry {
  return new THREE.TorusGeometry(r, tube, radSeg, tubeSeg);
}

/** 지오메트리를 이동/회전 후 반환 */
function translate(g: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry {
  g.translate(x, y, z);
  return g;
}

function rotateZ(g: THREE.BufferGeometry, angle: number): THREE.BufferGeometry {
  g.rotateZ(angle);
  return g;
}

function rotateX(g: THREE.BufferGeometry, angle: number): THREE.BufferGeometry {
  g.rotateX(angle);
  return g;
}

function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const result = mergeGeometries(geos);
  geos.forEach(g => g.dispose());
  return result;
}

// ─── Archetype별 지오메트리 생성 ───

/** TOWER: 에펠탑, 도쿄타워 — 격자 테이퍼드 타워 */
function createTower(): THREE.BufferGeometry {
  const base = box(1.2 * S, 0.3 * S, 1.2 * S);
  translate(base, 0, 0.15 * S, 0);
  const body = cone(0.5 * S, 3.0 * S, 4);
  translate(body, 0, 1.8 * S, 0);
  const tip = cylinder(0.02 * S, 0.08 * S, 0.6 * S, 4);
  translate(tip, 0, 3.6 * S, 0);
  // 4개의 다리
  const legs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const leg = cylinder(0.06 * S, 0.06 * S, 1.5 * S, 4);
    translate(leg, Math.cos(angle) * 0.4 * S, 0.75 * S, Math.sin(angle) * 0.4 * S);
    legs.push(leg);
  }
  return merge([base, body, tip, ...legs]);
}

/** PYRAMID: 기자, 치첸이트사 — 피라미드 */
function createPyramid(): THREE.BufferGeometry {
  const body = cone(1.2 * S, 2.5 * S, 4);
  translate(body, 0, 1.25 * S, 0);
  return body;
}

/** DOME: 타지마할, 국회의사당 — 돔 + 미나렛/윙 */
function createDome(): THREE.BufferGeometry {
  const base = box(2.0 * S, 0.6 * S, 1.4 * S);
  translate(base, 0, 0.3 * S, 0);
  const dome = sphere(0.7 * S, 8, 6);
  translate(dome, 0, 1.3 * S, 0);
  const tip = cone(0.06 * S, 0.4 * S, 4);
  translate(tip, 0, 2.2 * S, 0);
  // 4개 미나렛
  const minarets: THREE.BufferGeometry[] = [];
  const positions = [[-0.8, 0.4], [0.8, 0.4], [-0.8, -0.4], [0.8, -0.4]];
  for (const [px, pz] of positions) {
    const m = cylinder(0.06 * S, 0.06 * S, 1.6 * S, 4);
    translate(m, px * S, 0.8 * S, pz * S);
    const cap = sphere(0.08 * S, 4, 3);
    translate(cap, px * S, 1.7 * S, pz * S);
    minarets.push(m, cap);
  }
  return merge([base, dome, tip, ...minarets]);
}

/** NEEDLE: 부르즈할리파, CN타워, 스페이스니들 — 가느다란 첨탑 */
function createNeedle(): THREE.BufferGeometry {
  const shaft = cylinder(0.08 * S, 0.2 * S, 3.5 * S, 6);
  translate(shaft, 0, 1.75 * S, 0);
  const obs = torus(0.35 * S, 0.08 * S, 6, 8);
  rotateX(obs, Math.PI / 2);
  translate(obs, 0, 2.6 * S, 0);
  const tip = cone(0.04 * S, 0.8 * S, 4);
  translate(tip, 0, 3.9 * S, 0);
  return merge([shaft, obs, tip]);
}

/** STATUE: 자유의여신, 구세주상, 모아이 — 받침대 + 인체형 */
function createStatue(): THREE.BufferGeometry {
  const pedestal = box(0.8 * S, 1.0 * S, 0.8 * S);
  translate(pedestal, 0, 0.5 * S, 0);
  const torso = box(0.4 * S, 1.2 * S, 0.3 * S);
  translate(torso, 0, 1.6 * S, 0);
  const head = sphere(0.2 * S, 6, 4);
  translate(head, 0, 2.4 * S, 0);
  // 팔 (좌우로 펼침)
  const leftArm = box(0.8 * S, 0.15 * S, 0.15 * S);
  translate(leftArm, -0.6 * S, 1.8 * S, 0);
  const rightArm = box(0.8 * S, 0.15 * S, 0.15 * S);
  translate(rightArm, 0.6 * S, 1.8 * S, 0);
  // 횃불 (오른손)
  const torch = cone(0.1 * S, 0.3 * S, 4);
  translate(torch, 1.0 * S, 2.1 * S, 0);
  return merge([pedestal, torso, head, leftArm, rightArm, torch]);
}

/** WALL: 만리장성 — 지그재그 성벽 세그먼트 */
function createWall(): THREE.BufferGeometry {
  const segments: THREE.BufferGeometry[] = [];
  const wallPoints = [
    [-1.2, 0, -0.3],
    [-0.4, 0, 0.2],
    [0.4, 0, -0.2],
    [1.2, 0, 0.3],
  ];
  for (let i = 0; i < wallPoints.length - 1; i++) {
    const [x1, , z1] = wallPoints[i];
    const [x2, , z2] = wallPoints[i + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dz, dx);
    const seg = box(len * S, 0.8 * S, 0.3 * S);
    seg.rotateY(-angle);
    translate(seg, ((x1 + x2) / 2) * S, 0.4 * S, ((z1 + z2) / 2) * S);
    segments.push(seg);
    // 탑 (각 코너)
    if (i === 0 || i === wallPoints.length - 2) {
      const tower = box(0.4 * S, 1.2 * S, 0.4 * S);
      const px = i === 0 ? x1 : x2;
      const pz = i === 0 ? z1 : z2;
      translate(tower, px * S, 0.6 * S, pz * S);
      segments.push(tower);
    }
  }
  return merge(segments);
}

/** ARENA: 콜로세움 — 타원 링 */
function createArena(): THREE.BufferGeometry {
  const ring = torus(0.9 * S, 0.3 * S, 6, 16);
  rotateX(ring, Math.PI / 2);
  translate(ring, 0, 0.3 * S, 0);
  // 내부를 잘라낸 느낌을 위한 상부 개구부 표현 → 상단 반만
  const base = cylinder(1.0 * S, 1.0 * S, 0.2 * S, 16);
  translate(base, 0, 0.1 * S, 0);
  return merge([ring, base]);
}

/** BRIDGE: 골든게이트 — 두 타워 + 케이블(근사) + 도로 */
function createBridge(): THREE.BufferGeometry {
  // 두 타워
  const t1 = box(0.2 * S, 2.5 * S, 0.2 * S);
  translate(t1, -1.0 * S, 1.25 * S, 0);
  const t2 = box(0.2 * S, 2.5 * S, 0.2 * S);
  translate(t2, 1.0 * S, 1.25 * S, 0);
  // 도로
  const road = box(3.0 * S, 0.1 * S, 0.5 * S);
  translate(road, 0, 0.8 * S, 0);
  // 케이블 (간단히 가느다란 실린더로)
  const cable = cylinder(0.02 * S, 0.02 * S, 2.4 * S, 4);
  rotateZ(cable, Math.PI / 2);
  translate(cable, 0, 2.2 * S, 0);
  return merge([t1, t2, road, cable]);
}

/** PAGODA: 경복궁, 자금성 — 적층 기와지붕 */
function createPagoda(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tiers = 3;
  for (let t = 0; t < tiers; t++) {
    const w = (1.6 - t * 0.3) * S;
    const h = 0.5 * S;
    const y = t * 0.7 * S;
    // 벽체
    const wall = box(w, h, w * 0.7);
    translate(wall, 0, y + h / 2, 0);
    parts.push(wall);
    // 기와지붕 (약간 넓은 얇은 박스 + 경사)
    const roof = box(w * 1.3, 0.12 * S, w * 1.0);
    translate(roof, 0, y + h + 0.06 * S, 0);
    parts.push(roof);
  }
  // 지붕 첨탑
  const finial = cone(0.1 * S, 0.4 * S, 4);
  translate(finial, 0, tiers * 0.7 * S + 0.35 * S, 0);
  parts.push(finial);
  return merge(parts);
}

/** SHELLS: 시드니 오페라하우스 — 조개 돛 아크 */
function createShells(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const base = box(2.2 * S, 0.2 * S, 1.0 * S);
  translate(base, 0, 0.1 * S, 0);
  parts.push(base);
  // 4개의 돛 형태 (반 원뿔로 근사)
  for (let i = 0; i < 4; i++) {
    const shell = cone(0.4 * S, 1.8 * S - i * 0.3 * S, 8);
    // 반으로 잘라야 하지만 로우폴리이므로 그냥 원뿔 사용 + 뒤로 기울임
    rotateZ(shell, -0.3);
    translate(shell, (-0.6 + i * 0.4) * S, (1.1 - i * 0.1) * S, 0);
    parts.push(shell);
  }
  return merge(parts);
}

/** ONION_DOME: 성 바실리 — 다색 양파돔 스택 */
function createOnionDome(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const base = box(1.6 * S, 0.8 * S, 1.2 * S);
  translate(base, 0, 0.4 * S, 0);
  parts.push(base);
  // 5개 양파돔
  const domePositions = [
    [0, 1.8, 0],
    [-0.5, 1.4, 0],
    [0.5, 1.4, 0],
    [-0.3, 1.2, 0.3],
    [0.3, 1.2, -0.3],
  ];
  for (const [dx, dy, dz] of domePositions) {
    const stem = cylinder(0.06 * S, 0.06 * S, 0.6 * S, 4);
    translate(stem, dx * S, (dy - 0.2) * S, dz * S);
    parts.push(stem);
    // 양파 형태: sphere를 Y방향으로 스케일
    const bulb = sphere(0.18 * S, 6, 4);
    bulb.scale(1, 1.4, 1);
    translate(bulb, dx * S, dy * S, dz * S);
    parts.push(bulb);
    const tip = cone(0.03 * S, 0.15 * S, 4);
    translate(tip, dx * S, (dy + 0.3) * S, dz * S);
    parts.push(tip);
  }
  return merge(parts);
}

/** MOUNTAIN: 후지산, 킬리만자로 — 원뿔 + 눈캡 */
function createMountain(): THREE.BufferGeometry {
  const body = cone(1.5 * S, 2.5 * S, 8);
  translate(body, 0, 1.25 * S, 0);
  // 눈 캡 (작은 원뿔, 흰색은 머티리얼에서 처리)
  const snowCap = cone(0.4 * S, 0.6 * S, 8);
  translate(snowCap, 0, 2.3 * S, 0);
  return merge([body, snowCap]);
}

/** TWIN_TOWER: 페트로나스 — 쌍둥이 실린더 + 스카이 브릿지 */
function createTwinTower(): THREE.BufferGeometry {
  const t1 = cylinder(0.25 * S, 0.3 * S, 3.0 * S, 6);
  translate(t1, -0.4 * S, 1.5 * S, 0);
  const t2 = cylinder(0.25 * S, 0.3 * S, 3.0 * S, 6);
  translate(t2, 0.4 * S, 1.5 * S, 0);
  const bridge = box(0.6 * S, 0.1 * S, 0.2 * S);
  translate(bridge, 0, 2.0 * S, 0);
  const tip1 = cone(0.08 * S, 0.5 * S, 4);
  translate(tip1, -0.4 * S, 3.3 * S, 0);
  const tip2 = cone(0.08 * S, 0.5 * S, 4);
  translate(tip2, 0.4 * S, 3.3 * S, 0);
  return merge([t1, t2, bridge, tip1, tip2]);
}

/** BRIDGE_TOP: 마리나 베이 샌즈 — 3 타워 + 상판 */
function createBridgeTop(): THREE.BufferGeometry {
  const towers: THREE.BufferGeometry[] = [];
  for (let i = -1; i <= 1; i++) {
    const t = box(0.3 * S, 2.5 * S, 0.6 * S);
    translate(t, i * 0.6 * S, 1.25 * S, 0);
    towers.push(t);
  }
  // 보트 모양 상판
  const top = box(2.4 * S, 0.1 * S, 0.8 * S);
  translate(top, 0, 2.6 * S, 0);
  return merge([...towers, top]);
}

/** SPIRE_CLUSTER: 왓아룬, 사그라다 파밀리아 — 다중 첨탑 */
function createSpireCluster(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const base = box(1.4 * S, 0.4 * S, 1.0 * S);
  translate(base, 0, 0.2 * S, 0);
  parts.push(base);
  const spireData = [
    [0, 2.8, 0.15],       // 중앙 (가장 높음)
    [-0.4, 2.0, 0.12],
    [0.4, 2.0, 0.12],
    [-0.2, 1.6, 0.10],
    [0.2, 1.6, 0.10],
  ];
  for (const [dx, h, r] of spireData) {
    const spire = cone(r * S, h * S, 6);
    translate(spire, dx * S, (h / 2 + 0.4) * S, 0);
    parts.push(spire);
  }
  return merge(parts);
}

/** SKYSCRAPER: 엠파이어 스테이트 — 아르데코 단계식 타워 */
function createSkyscraper(): THREE.BufferGeometry {
  const b1 = box(1.0 * S, 1.0 * S, 0.8 * S);
  translate(b1, 0, 0.5 * S, 0);
  const b2 = box(0.7 * S, 1.2 * S, 0.6 * S);
  translate(b2, 0, 1.6 * S, 0);
  const b3 = box(0.4 * S, 1.0 * S, 0.35 * S);
  translate(b3, 0, 2.7 * S, 0);
  const tip = cone(0.06 * S, 0.6 * S, 4);
  translate(tip, 0, 3.5 * S, 0);
  return merge([b1, b2, b3, tip]);
}

/** CLOCK_TOWER: 빅 벤 — 시계탑 + 피라미드 캡 */
function createClockTower(): THREE.BufferGeometry {
  const body = box(0.6 * S, 2.8 * S, 0.6 * S);
  translate(body, 0, 1.4 * S, 0);
  // 시계면 (약간 돌출된 박스)
  const clock = box(0.7 * S, 0.5 * S, 0.7 * S);
  translate(clock, 0, 2.5 * S, 0);
  const cap = cone(0.5 * S, 0.8 * S, 4);
  translate(cap, 0, 3.2 * S, 0);
  return merge([body, clock, cap]);
}

/** TILTED_TOWER: 피사의 사탑 — 기울어진 실린더 */
function createTiltedTower(): THREE.BufferGeometry {
  const body = cylinder(0.3 * S, 0.35 * S, 2.5 * S, 8);
  rotateZ(body, 0.1); // ~5.7도 기울기
  translate(body, 0.1 * S, 1.25 * S, 0);
  // 층 구분 링
  const rings: THREE.BufferGeometry[] = [];
  for (let i = 1; i <= 5; i++) {
    const ring = torus(0.35 * S, 0.03 * S, 4, 8);
    rotateX(ring, Math.PI / 2);
    translate(ring, i * 0.02 * S, i * 0.45 * S, 0);
    rings.push(ring);
  }
  return merge([body, ...rings]);
}

/** TEMPLE: 파르테논, 페트라 — 열주 + 지붕 */
function createTemple(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // 기단
  const platform = box(1.8 * S, 0.2 * S, 1.0 * S);
  translate(platform, 0, 0.1 * S, 0);
  parts.push(platform);
  // 6개 기둥 (앞면)
  for (let i = 0; i < 6; i++) {
    const col = cylinder(0.08 * S, 0.08 * S, 1.4 * S, 6);
    translate(col, (-0.75 + i * 0.3) * S, 0.9 * S, 0.35 * S);
    parts.push(col);
  }
  // 삼각 지붕 (페디먼트)
  const roof = cone(1.0 * S, 0.5 * S, 3);
  roof.scale(1, 1, 0.5);
  rotateZ(roof, 0);
  translate(roof, 0, 1.85 * S, 0);
  parts.push(roof);
  return merge(parts);
}

/** GATE: 브란덴부르크 문 — 기둥 열 + 상부 블록 */
function createGate(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // 5개 기둥
  for (let i = 0; i < 5; i++) {
    const col = cylinder(0.08 * S, 0.08 * S, 1.8 * S, 6);
    translate(col, (-0.6 + i * 0.3) * S, 0.9 * S, 0);
    parts.push(col);
  }
  // 상부 블록 (엔타블러처)
  const top = box(1.6 * S, 0.3 * S, 0.4 * S);
  translate(top, 0, 2.0 * S, 0);
  parts.push(top);
  // 쿼드리가 (간단히 작은 박스로)
  const quadriga = box(0.4 * S, 0.3 * S, 0.3 * S);
  translate(quadriga, 0, 2.3 * S, 0);
  parts.push(quadriga);
  return merge(parts);
}

/** WINDMILL: 풍차 — 원통 + 4 블레이드 */
function createWindmill(): THREE.BufferGeometry {
  const body = cylinder(0.3 * S, 0.4 * S, 1.8 * S, 6);
  translate(body, 0, 0.9 * S, 0);
  const cap = cone(0.35 * S, 0.5 * S, 6);
  translate(cap, 0, 2.05 * S, 0);
  // 4 블레이드
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const blade = box(0.1 * S, 1.2 * S, 0.02 * S);
    blade.rotateZ((i / 4) * Math.PI * 2);
    translate(blade, 0, 1.8 * S, 0.35 * S);
    blades.push(blade);
  }
  return merge([body, cap, ...blades]);
}

/** CASTLE: 노이슈반슈타인 — 성 타워 + 원뿔 캡 */
function createCastle(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // 메인 블록
  const mainBlock = box(1.2 * S, 1.4 * S, 0.8 * S);
  translate(mainBlock, 0, 0.7 * S, 0);
  parts.push(mainBlock);
  // 3개 타워
  const towerPos = [[-0.5, 0], [0.5, 0], [0, -0.3]];
  for (const [tx, tz] of towerPos) {
    const tower = cylinder(0.2 * S, 0.2 * S, 2.0 * S, 6);
    translate(tower, tx * S, 1.0 * S, tz * S);
    parts.push(tower);
    const cap = cone(0.25 * S, 0.5 * S, 6);
    translate(cap, tx * S, 2.25 * S, tz * S);
    parts.push(cap);
  }
  return merge(parts);
}

/** STONE_RING: 스톤헨지 — 석판 원형 배치 */
function createStoneRing(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const stone = box(0.2 * S, 0.8 * S + Math.random() * 0.3 * S, 0.15 * S);
    translate(stone, Math.cos(angle) * 0.8 * S, 0.5 * S, Math.sin(angle) * 0.8 * S);
    stone.rotateY(-angle);
    parts.push(stone);
  }
  // 상부 링텔 (2개)
  const lintel1 = box(0.6 * S, 0.15 * S, 0.15 * S);
  translate(lintel1, 0, 1.0 * S, 0.8 * S);
  parts.push(lintel1);
  const lintel2 = box(0.6 * S, 0.15 * S, 0.15 * S);
  translate(lintel2, 0, 1.0 * S, -0.8 * S);
  parts.push(lintel2);
  return merge(parts);
}

/** OBELISK: 워싱턴 기념탑 — 가느다란 오벨리스크 */
function createObelisk(): THREE.BufferGeometry {
  const body = box(0.35 * S, 3.5 * S, 0.35 * S);
  translate(body, 0, 1.75 * S, 0);
  const tip = cone(0.3 * S, 0.5 * S, 4);
  translate(tip, 0, 3.75 * S, 0);
  return merge([body, tip]);
}

/** TERRACE: 마추픽추 — 산악 계단식 */
function createTerrace(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const w = (2.0 - i * 0.35) * S;
    const step = box(w, 0.3 * S, 0.6 * S);
    translate(step, i * 0.15 * S, i * 0.35 * S + 0.15 * S, 0);
    parts.push(step);
  }
  return merge(parts);
}

/** MESA: 테이블 마운틴 — 평탄 정상 */
function createMesa(): THREE.BufferGeometry {
  const body = cylinder(1.0 * S, 1.3 * S, 1.5 * S, 6);
  translate(body, 0, 0.75 * S, 0);
  const top = cylinder(1.0 * S, 1.0 * S, 0.2 * S, 6);
  translate(top, 0, 1.6 * S, 0);
  return merge([body, top]);
}

/** MONOLITH: 울루루 — 반구체 모노리스 */
function createMonolith(): THREE.BufferGeometry {
  const body = sphere(1.0 * S, 8, 4);
  body.scale(1.3, 0.6, 0.9);
  translate(body, 0, 0.5 * S, 0);
  return body;
}

// ─── 메인 팩토리 함수 ───

/** Archetype → 캐시된 BufferGeometry 맵 */
const geometryCache = new Map<string, THREE.BufferGeometry>();

/**
 * Archetype별 프로시저럴 BufferGeometry를 생성하고 캐시한다.
 * 동일 Archetype 재호출 시 캐시에서 반환.
 */
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

/** 캐시 정리 (언마운트 시) */
export function disposeGeometryCache(): void {
  geometryCache.forEach(g => g.dispose());
  geometryCache.clear();
}
