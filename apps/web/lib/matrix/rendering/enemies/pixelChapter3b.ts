/**
 * Pixel Art Chapter 3b: Stage 26-30 Monsters
 * v6.0: Cyberpunk pixel art style - final stages theme
 *
 * Stage 26 (Cloud Layers): instance_spawn, load_balancer, container_box, serverless_ghost, auto_scaler
 * Stage 27 (Quantum Realm): qubit_spin, superposition, entangle_pair, quantum_gate, decoherence
 * Stage 28 (Singularity Gate): event_horizon, time_dilation, gravity_well, hawking_particle, gate_keeper
 * Stage 29 (God's Room): omniscient_eye, divine_code, angel_process, fallen_daemon, prayer_packet
 * Stage 30 (Final Choice): destiny_shard, timeline_split, choice_echo, paradox_loop, final_bit
 */

import type { EnemyRenderData } from './types';
import {
  CYBER_PALETTE,
  drawPixel,
  drawPixelRect,
  drawPixelCircle,
  drawPixelLED,
  drawPixelLineH,
  drawPixelLineV,
  drawPixelShadow,
  drawBlackOutlineRect,
  drawPixelRectWithBlackOutline,
  drawPixelCircleWithBlackOutline,
} from './pixelMonster';
import { deterministicRandom } from './renderContext';

const P = 2; // Pixel size

// ============================================================
// Stage 26: Cloud Layers (클라우드 계층)
// ============================================================

/**
 * Instance Spawn - 인스턴스 생성
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelInstanceSpawn(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const spawnPhase = (Math.sin(t / 300) + 1) / 2;

  ctx.save();

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const innerColor = isHit ? '#ffffff' : CYBER_PALETTE.cyan;
  const idColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;

  // v8.0: 메인 컨테이너 - 검은 아웃라인
  ctx.globalAlpha = 0.7 + spawnPhase * 0.3;
  drawBlackOutlineRect(ctx, -8 * P - P, -10 * P - P, 16 + 1, 20 + 1, P);
  drawPixelRect(ctx, -8 * P, -10 * P, 16, 20, P, bodyColor);
  drawPixelRect(ctx, -6 * P, -8 * P, 12, 16, P, innerColor);

  // v8.0: 인스턴스 ID 패턴 - 검은 아웃라인
  ctx.globalAlpha = 1;
  for (let i = 0; i < 3; i++) {
    const py = -4 * P + i * 4 * P;
    drawPixelRectWithBlackOutline(ctx, -4 * P, py, 8, 2, P, idColor);
  }

  // v8.0: 스폰 파티클 - 검은 아웃라인
  ctx.globalAlpha = spawnPhase * 0.9;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + t / 500;
    const dist = 12 + Math.sin(t / 250 + i) * 2;
    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist;
    drawPixelRectWithBlackOutline(ctx, px, py, 1, 1, P, CYBER_PALETTE.white);
  }

  // v8.0: 상태 LED - 검은 아웃라인
  ctx.globalAlpha = 1;
  const ledColor = spawnPhase > 0.5 ? CYBER_PALETTE.acidGreen : CYBER_PALETTE.brightYellow;
  drawPixelCircleWithBlackOutline(ctx, 0, -12 * P, 2, P, ledColor);

  ctx.restore();
}

/**
 * Load Balancer - 로드 밸런서
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelLoadBalancer(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const balanceAngle = Math.sin(t / 400) * 0.2;

  ctx.save();

  const hubColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const armColor = isHit ? '#ffffff' : CYBER_PALETTE.steel;
  const nodeColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;

  // v8.0: 중앙 허브 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 6, P, hubColor);
  drawPixelCircle(ctx, 0, 0, 4, P, CYBER_PALETTE.cyan);

  // v8.0: 밸런싱 암 - 검은 아웃라인
  ctx.save();
  ctx.rotate(balanceAngle);
  // Left arm
  drawBlackOutlineRect(ctx, -14 * P - P, -1 * P - P, 10 + 1, 2 + 1, P);
  drawPixelRect(ctx, -14 * P, -1 * P, 10, 2, P, armColor);
  drawPixelCircleWithBlackOutline(ctx, -14 * P, 0, 3, P, nodeColor);
  // Right arm
  drawBlackOutlineRect(ctx, 4 * P - P, -1 * P - P, 10 + 1, 2 + 1, P);
  drawPixelRect(ctx, 4 * P, -1 * P, 10, 2, P, armColor);
  drawPixelCircleWithBlackOutline(ctx, 14 * P, 0, 3, P, nodeColor);
  ctx.restore();

  // v8.0: 데이터 흐름 - 검은 아웃라인
  const flowOffset = (t / 10) % 6;
  drawPixelRectWithBlackOutline(ctx, -8 * P + flowOffset * P, -4 * P, 1, 1, P, CYBER_PALETTE.acidGreen);
  drawPixelRectWithBlackOutline(ctx, 8 * P - flowOffset * P, 4 * P, 1, 1, P, CYBER_PALETTE.acidGreen);

  // v8.0: 센터 표시등 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, CYBER_PALETTE.brightCyan);

  ctx.restore();
}

/**
 * Container Box - 컨테이너 박스 (Docker)
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelContainerBox(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const innerColor = isHit ? '#ffffff' : CYBER_PALETTE.blue;
  const blockColor = isHit ? '#ffffff' : CYBER_PALETTE.cyan;

  // v8.0: 컨테이너 몸체 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -10 * P - P, -6 * P - P, 20 + 1, 12 + 1, P);
  drawPixelRect(ctx, -10 * P, -6 * P, 20, 12, P, bodyColor);
  drawPixelRect(ctx, -8 * P, -4 * P, 16, 8, P, innerColor);

  // v8.0: 컨테이너 블록 (도커 로고) - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const bx = -7 * P + i * 4 * P;
    const bobY = Math.sin(t / 200 + i * 0.5) * P;
    drawPixelRectWithBlackOutline(ctx, bx, -9 * P + bobY, 3, 3, P, blockColor);
  }

  // v8.0: 얼굴 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -4 * P, -1 * P, 1, 1, P, CYBER_PALETTE.white);
  drawPixelRectWithBlackOutline(ctx, 4 * P, -1 * P, 1, 1, P, CYBER_PALETTE.white);
  // 미소
  drawBlackOutlineRect(ctx, -3 * P - P, 3 * P - P, 6 + 1, 1 + 1, P);
  drawPixelLineH(ctx, -3 * P, 3 * P, 6, P, CYBER_PALETTE.white);

  // v8.0: 상태 표시등 - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    const ledX = -6 * P + i * 6 * P;
    const color = i === 0 ? CYBER_PALETTE.acidGreen :
                  i === 1 ? CYBER_PALETTE.brightYellow : CYBER_PALETTE.brightCyan;
    drawPixelCircleWithBlackOutline(ctx, ledX, 7 * P, 1, P, color);
  }

  ctx.restore();
}

/**
 * Serverless Ghost - 서버리스 유령
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelServerlessGhost(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const floatY = Math.sin(t / 300) * 2;

  ctx.save();
  ctx.translate(0, floatY);

  const ghostColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;

  // v8.0: 유령 몸체 - 검은 아웃라인
  ctx.globalAlpha = 0.8 + Math.sin(t / 200) * 0.15;

  // v8.0: 메인 유령 형태 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -4 * P, 7, P, ghostColor);
  drawBlackOutlineRect(ctx, -7 * P - P, -4 * P - P, 14 + 1, 10 + 1, P);
  drawPixelRect(ctx, -7 * P, -4 * P, 14, 10, P, ghostColor);

  // v8.0: 물결 하단 - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const wx = -6 * P + i * 4 * P;
    const wy = 5 * P + Math.sin(t / 150 + i) * 2;
    drawPixelRectWithBlackOutline(ctx, wx, wy, 3, 4, P, ghostColor);
  }

  // v8.0: 람다 심볼 - 검은 아웃라인 배경
  ctx.globalAlpha = 1;
  drawPixelRectWithBlackOutline(ctx, -3 * P, -2 * P, 6, 6, P, CYBER_PALETTE.brightYellow);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('λ', 0, 4);

  // v8.0: 빛나는 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -3 * P, -5 * P, 2, P, CYBER_PALETTE.brightCyan);
  drawPixelCircleWithBlackOutline(ctx, 3 * P, -5 * P, 2, P, CYBER_PALETTE.brightCyan);

  // v8.0: 떠다니는 파티클 - 검은 아웃라인
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 3; i++) {
    const px = Math.sin(t / 300 + i * 2) * 10;
    const py = -10 * P - i * 4 * P + Math.cos(t / 400 + i) * 2;
    drawPixelRectWithBlackOutline(ctx, px, py, 1, 1, P, CYBER_PALETTE.white);
  }

  ctx.restore();
}

/**
 * Auto Scaler - 오토 스케일러
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelAutoScaler(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const scalePhase = (Math.sin(t / 400) + 1) / 2;
  const dynamicScale = 0.8 + scalePhase * 0.4;

  ctx.save();
  ctx.scale(dynamicScale, dynamicScale);

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const innerColor = isHit ? '#ffffff' : CYBER_PALETTE.blue;
  const arrowColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;

  // v8.0: 메인 바디 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -8 * P - P, -8 * P - P, 16 + 1, 16 + 1, P);
  drawPixelRect(ctx, -8 * P, -8 * P, 16, 16, P, bodyColor);
  drawPixelRect(ctx, -6 * P, -6 * P, 12, 12, P, innerColor);

  // v8.0: 스케일 화살표 - 검은 아웃라인
  const arrowOffset = Math.sin(t / 200) * P;

  // Up arrow
  drawPixelRectWithBlackOutline(ctx, -2 * P, -11 * P - arrowOffset, 4, 2, P, arrowColor);
  drawPixelRectWithBlackOutline(ctx, 0, -13 * P - arrowOffset, 1, 1, P, arrowColor);

  // Down arrow
  drawPixelRectWithBlackOutline(ctx, -2 * P, 9 * P + arrowOffset, 4, 2, P, arrowColor);
  drawPixelRectWithBlackOutline(ctx, 0, 12 * P + arrowOffset, 1, 1, P, arrowColor);

  // Left arrow
  drawPixelRectWithBlackOutline(ctx, -11 * P - arrowOffset, -2 * P, 2, 4, P, arrowColor);
  drawPixelRectWithBlackOutline(ctx, -13 * P - arrowOffset, 0, 1, 1, P, arrowColor);

  // Right arrow
  drawPixelRectWithBlackOutline(ctx, 9 * P + arrowOffset, -2 * P, 2, 4, P, arrowColor);
  drawPixelRectWithBlackOutline(ctx, 12 * P + arrowOffset, 0, 1, 1, P, arrowColor);

  // v8.0: 중앙 메트릭 디스플레이 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -3 * P - P, 8 + 1, 6 + 1, P);
  drawPixelRect(ctx, -4 * P, -3 * P, 8, 6, P, CYBER_PALETTE.black);
  const percent = Math.floor(scalePhase * 100);
  ctx.fillStyle = CYBER_PALETTE.brightCyan;
  ctx.font = '6px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${percent}%`, 0, 2);

  ctx.restore();
}

// ============================================================
// Stage 27: Quantum Realm (양자 영역)
// ============================================================

/**
 * Qubit Spin - 큐비트 스핀
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelQubitSpin(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const sphereColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;
  const innerColor = isHit ? '#ffffff' : CYBER_PALETTE.magenta;
  const axisColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;

  // v8.0: 회전 구체 - 검은 아웃라인
  ctx.save();
  ctx.rotate(t / 200);

  drawPixelCircleWithBlackOutline(ctx, 0, 0, 7, P, sphereColor);
  drawPixelCircle(ctx, 0, 0, 5, P, innerColor);

  // v8.0: 스핀 축 - 검은 아웃라인
  drawBlackOutlineRect(ctx, 0 - P, -10 * P - P, 1 + 1, 20 + 1, P);
  drawPixelLineV(ctx, 0, -10 * P, 20, P, axisColor);
  drawPixelRectWithBlackOutline(ctx, -2 * P, -12 * P, 4, 2, P, axisColor);
  drawPixelRectWithBlackOutline(ctx, -2 * P, 10 * P, 4, 2, P, axisColor);

  ctx.restore();

  // v8.0: 상태 표시 - 검은 아웃라인 배경
  const state = Math.sin(t / 500) > 0 ? '|0>' : '|1>';
  drawPixelRectWithBlackOutline(ctx, -5 * P, -2 * P, 10, 6, P, CYBER_PALETTE.black);
  ctx.fillStyle = CYBER_PALETTE.white;
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(state, 0, 3);

  // v8.0: 확률 구름 - 검은 아웃라인
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + t / 600;
    const px = Math.cos(angle) * 10;
    const py = Math.sin(angle) * 5;
    drawPixelRectWithBlackOutline(ctx, px, py, 1, 1, P, CYBER_PALETTE.brightCyan);
  }

  ctx.restore();
}

/**
 * Superposition - 중첩 상태
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelSuperposition(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  // v8.0: 다중 중첩 상태 - 검은 아웃라인
  const states = 3;
  for (let i = 0; i < states; i++) {
    ctx.globalAlpha = 0.5 + (i === 1 ? 0.3 : 0);
    const offset = Math.sin(t / 300 + i * Math.PI * 2 / states) * 4;
    const stateX = Math.cos(i * Math.PI * 2 / states) * offset;
    const stateY = Math.sin(i * Math.PI * 2 / states) * offset;

    const color = isHit ? '#ffffff' :
                  i === 0 ? CYBER_PALETTE.brightCyan :
                  i === 1 ? CYBER_PALETTE.neonPink : CYBER_PALETTE.magenta;

    drawPixelCircleWithBlackOutline(ctx, stateX, stateY, 6, P, color);
  }

  // v8.0: 중앙 코어 - 검은 아웃라인
  ctx.globalAlpha = 1;
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.white);

  // v8.0: 파동함수 시각화 - 검은 아웃라인
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 10; i++) {
    const wx = -10 * P + i * 2 * P;
    const wy = Math.sin(t / 200 + i * 0.5) * 4;
    drawPixelRectWithBlackOutline(ctx, wx, wy, 1, 1, P, CYBER_PALETTE.brightCyan);
  }

  ctx.restore();
}

/**
 * Entangle Pair - 얽힘 쌍
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelEntanglePair(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const leftColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const rightColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;
  const linkColor = isHit ? '#ffffff' : CYBER_PALETTE.magenta;

  // v8.0: 얽힘 연결선 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -10 * P - P, -P, 20 + 1, 1 + 1, P);
  ctx.globalAlpha = 0.7 + Math.sin(t / 150) * 0.2;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = linkColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10 * P, 0);
  ctx.lineTo(10 * P, 0);
  ctx.stroke();
  ctx.setLineDash([]);

  // v8.0: 왼쪽 입자 - 검은 아웃라인
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(-10 * P, 0);
  ctx.rotate(t / 200);
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 5, P, leftColor);
  drawPixelRectWithBlackOutline(ctx, -6 * P, -1 * P, 12, 2, P, CYBER_PALETTE.white);
  ctx.restore();

  // v8.0: 오른쪽 입자 (반대 스핀) - 검은 아웃라인
  ctx.save();
  ctx.translate(10 * P, 0);
  ctx.rotate(-t / 200);
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 5, P, rightColor);
  drawPixelRectWithBlackOutline(ctx, -6 * P, -1 * P, 12, 2, P, CYBER_PALETTE.white);
  ctx.restore();

  // v8.0: 상태 라벨 - 검은 아웃라인
  ctx.globalAlpha = 1;
  drawPixelRectWithBlackOutline(ctx, -12 * P, -12 * P, 4, 4, P, CYBER_PALETTE.brightYellow);
  drawPixelRectWithBlackOutline(ctx, 8 * P, -12 * P, 4, 4, P, CYBER_PALETTE.brightYellow);
  ctx.fillStyle = '#000000';
  ctx.font = '6px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('↑', -10 * P, -9 * P);
  ctx.fillText('↓', 10 * P, -9 * P);

  ctx.restore();
}

/**
 * Quantum Gate - 양자 게이트
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelQuantumGate(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const frameColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const bgColor = isHit ? '#ffffff' : CYBER_PALETTE.black;
  const wireColor = isHit ? '#ffffff' : CYBER_PALETTE.steel;

  // v8.0: 게이트 프레임 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -9 * P - P, -9 * P - P, 18 + 1, 18 + 1, P);
  drawPixelRect(ctx, -9 * P, -9 * P, 18, 18, P, frameColor);
  drawPixelRect(ctx, -7 * P, -7 * P, 14, 14, P, bgColor);

  // v8.0: 게이트 타입 표시
  const gates = ['H', 'X', 'Z', 'T'];
  const gateIndex = Math.floor((t / 1000) % gates.length);
  ctx.fillStyle = CYBER_PALETTE.brightCyan;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(gates[gateIndex], 0, 0);

  // v8.0: 입력/출력 와이어 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -15 * P - P, 0 - P, 6 + 1, 1 + 1, P);
  drawPixelLineH(ctx, -15 * P, 0, 6, P, wireColor);
  drawBlackOutlineRect(ctx, 9 * P - P, 0 - P, 6 + 1, 1 + 1, P);
  drawPixelLineH(ctx, 9 * P, 0, 6, P, wireColor);

  // v8.0: 데이터 흐름 파티클 - 검은 아웃라인
  const flowX = ((t / 10) % 18) * P - 9 * P;
  ctx.globalAlpha = 1;
  drawPixelRectWithBlackOutline(ctx, flowX, 0, 1, 1, P, CYBER_PALETTE.acidGreen);

  // v8.0: 코너 LED - 검은 아웃라인
  const corners = [[-7, -7], [7, -7], [-7, 7], [7, 7]];
  corners.forEach(([cx, cy]) => {
    drawPixelCircleWithBlackOutline(ctx, cx * P, cy * P, 1, P, CYBER_PALETTE.neonPink);
  });

  ctx.restore();
}

/**
 * Decoherence - 결어긋남
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelDecoherence(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const collapsePhase = (Math.sin(t / 400) + 1) / 2;

  ctx.save();

  const coreColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;

  // v8.0: 붕괴하는 파동함수 - 검은 아웃라인
  ctx.globalAlpha = 1 - collapsePhase * 0.5;
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 8, P, coreColor);

  // v8.0: 결어긋남 노이즈 - 검은 아웃라인
  ctx.globalAlpha = collapsePhase * 0.9;
  const seed = Math.floor(t / 100);
  for (let i = 0; i < 12; i++) {
    const rand1 = deterministicRandom(seed + i);
    const rand2 = deterministicRandom(seed + i + 100);
    const nx = (rand1 - 0.5) * 20;
    const ny = (rand2 - 0.5) * 20;
    const noiseColor = rand1 > 0.5 ? CYBER_PALETTE.brightRed : CYBER_PALETTE.steel;
    drawPixelRectWithBlackOutline(ctx, nx, ny, 1, 1, P, noiseColor);
  }

  // v8.0: 중앙 잔존물 - 검은 아웃라인
  ctx.globalAlpha = 1;
  const coreSize = Math.max(2, Math.floor(4 * (1 - collapsePhase * 0.5)));
  drawPixelCircleWithBlackOutline(ctx, 0, 0, coreSize, P, CYBER_PALETTE.brightCyan);

  // v8.0: 경고 표시 - 검은 아웃라인
  if (collapsePhase > 0.5) {
    ctx.globalAlpha = (Math.sin(t / 50) + 1) / 2;
    drawPixelRectWithBlackOutline(ctx, -2 * P, -14 * P, 4, 4, P, CYBER_PALETTE.brightRed);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -11 * P);
  }

  ctx.restore();
}

// ============================================================
// Stage 28: Singularity Gate (특이점 문)
// ============================================================

/**
 * Event Horizon - 사건의 지평선
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelEventHorizon(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  // v8.0: 외부 강착 원반 - 검은 아웃라인
  ctx.globalAlpha = 0.7;
  for (let ring = 3; ring >= 0; ring--) {
    const ringSize = 4 + ring * 3;
    ctx.save();
    ctx.rotate(t / (300 + ring * 100));
    const color = isHit ? '#ffffff' :
                  ring === 0 ? CYBER_PALETTE.black :
                  ring === 1 ? CYBER_PALETTE.neonPink :
                  ring === 2 ? CYBER_PALETTE.magenta : CYBER_PALETTE.brightRed;
    drawPixelCircleWithBlackOutline(ctx, 0, 0, ringSize, P, color);
    ctx.restore();
  }

  // v8.0: 사건의 지평선 (검은 중심) - 검은 아웃라인
  ctx.globalAlpha = 1;
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 6, P, CYBER_PALETTE.black);

  // v8.0: 호킹 복사 스파크 - 검은 아웃라인
  ctx.globalAlpha = 1;
  for (let i = 0; i < 4; i++) {
    const sparkAngle = t / 200 + i * Math.PI / 2;
    const sparkDist = 7 + Math.sin(t / 150 + i) * 2;
    const sx = Math.cos(sparkAngle) * sparkDist;
    const sy = Math.sin(sparkAngle) * sparkDist;
    drawPixelCircleWithBlackOutline(ctx, sx, sy, 1, P, CYBER_PALETTE.white);
  }

  ctx.restore();
}

/**
 * Time Dilation - 시간 지연
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelTimeDilation(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const faceColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const bgColor = isHit ? '#ffffff' : CYBER_PALETTE.black;
  const markColor = isHit ? '#ffffff' : CYBER_PALETTE.steel;

  // v8.0: 시계 얼굴 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 9, P, faceColor);
  drawPixelCircle(ctx, 0, 0, 7, P, bgColor);

  // v8.0: 시계 눈금 - 검은 아웃라인
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const markDist = 6;
    const mx = Math.cos(angle) * markDist;
    const my = Math.sin(angle) * markDist;
    drawPixelRectWithBlackOutline(ctx, mx, my, 1, 1, P, markColor);
  }

  // v8.0: 지연된 시계 바늘 - 검은 아웃라인
  const slowAngle = (t / 3000) % (Math.PI * 2);
  const fastAngle = (t / 500) % (Math.PI * 2);

  // Hour hand (slow)
  ctx.save();
  ctx.rotate(slowAngle - Math.PI / 2);
  drawPixelRectWithBlackOutline(ctx, 0, -1 * P, 4, 2, P, CYBER_PALETTE.brightCyan);
  ctx.restore();

  // Minute hand
  ctx.save();
  ctx.rotate(fastAngle - Math.PI / 2);
  drawPixelRectWithBlackOutline(ctx, 0, -1 * P, 6, 1, P, CYBER_PALETTE.neonPink);
  ctx.restore();

  // v8.0: 왜곡 파동 - 검은 아웃라인 (원형)
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 2; i++) {
    const waveRadius = 10 + i * 3 + Math.sin(t / 300 + i) * 2;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = CYBER_PALETTE.magenta;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // v8.0: 중앙 피벗 - 검은 아웃라인
  ctx.globalAlpha = 1;
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, CYBER_PALETTE.white);

  ctx.restore();
}

/**
 * Gravity Well - 중력 우물
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelGravityWell(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  // v8.0: 중력 우물 시각화 (동심원 함몰) - 검은 아웃라인
  for (let ring = 4; ring >= 0; ring--) {
    const ringRadius = 2 * ring;
    const depth = (4 - ring) * 0.2;
    ctx.globalAlpha = 0.4 + depth * 0.5;

    const color = isHit ? '#ffffff' :
                  ring > 2 ? CYBER_PALETTE.blue :
                  ring > 0 ? CYBER_PALETTE.neonPink : CYBER_PALETTE.black;

    ctx.save();
    ctx.scale(1, 0.5); // 깊이 표현을 위해 납작하게
    drawPixelCircleWithBlackOutline(ctx, 0, 0, ringRadius, P, color);
    ctx.restore();
  }

  // v8.0: 공간 곡률 그리드 라인 - 검은 아웃라인
  ctx.globalAlpha = 0.5;
  for (let i = -2; i <= 2; i++) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(i * 4, -12);
    ctx.quadraticCurveTo(i * 2, 0, i * 4, 12);
    ctx.stroke();
    ctx.strokeStyle = CYBER_PALETTE.brightCyan;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // v8.0: 떨어지는 물체 - 검은 아웃라인
  ctx.globalAlpha = 1;
  for (let i = 0; i < 4; i++) {
    const fallAngle = t / 300 + i * Math.PI / 2;
    const fallDist = 12 * (1 - ((t / 1000 + i * 0.25) % 1));
    const fx = Math.cos(fallAngle) * fallDist;
    const fy = Math.sin(fallAngle) * fallDist * 0.5;
    drawPixelRectWithBlackOutline(ctx, fx, fy, 1, 1, P, CYBER_PALETTE.brightYellow);
  }

  // v8.0: 중앙 질량 - 검은 아웃라인
  ctx.globalAlpha = 1;
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, CYBER_PALETTE.white);

  ctx.restore();
}

/**
 * Hawking Particle - 호킹 입자
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelHawkingParticle(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const pairAngle = t / 300;
  const separation = 5 + Math.sin(t / 200) * 2;

  ctx.save();

  // v8.0: 탈출 입자 (밝은) - 검은 아웃라인
  const escapeX = Math.cos(pairAngle) * separation;
  const escapeY = Math.sin(pairAngle) * separation - 3;
  ctx.globalAlpha = 1;
  drawPixelCircleWithBlackOutline(ctx, escapeX, escapeY, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.white);

  // v8.0: 탈출 입자 광선 효과
  for (let i = 0; i < 6; i++) {
    const rayAngle = (i / 6) * Math.PI * 2 + t / 400;
    const rx = escapeX + Math.cos(rayAngle) * 5;
    const ry = escapeY + Math.sin(rayAngle) * 5;
    drawPixelRectWithBlackOutline(ctx, rx, ry, 1, 1, P, CYBER_PALETTE.brightCyan);
  }

  // v8.0: 추락 입자 (어두운) - 검은 아웃라인
  const fallX = -Math.cos(pairAngle) * separation * 0.5;
  const fallY = -Math.sin(pairAngle) * separation * 0.5 + 3;
  ctx.globalAlpha = 0.7;
  drawPixelCircleWithBlackOutline(ctx, fallX, fallY, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.neonPink);

  // v8.0: 가상 입자 연결선 - 검은 아웃라인 패턴
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(escapeX, escapeY);
  ctx.lineTo(fallX, fallY);
  ctx.stroke();
  ctx.strokeStyle = CYBER_PALETTE.brightOrange;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  // v8.0: 중앙 블랙홀 - 검은 아웃라인
  ctx.globalAlpha = 1;
  drawPixelCircleWithBlackOutline(ctx, 0, 4, 3, P, CYBER_PALETTE.black);
  // 이벤트 호라이즌 링
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 4, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = CYBER_PALETTE.neonPink;
  ctx.lineWidth = 1;
  ctx.stroke();

  // v8.0: 호킹 복사 파티클 - 검은 아웃라인
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < 4; i++) {
    const radAngle = t / 500 + i * Math.PI / 2;
    const radDist = 8 + Math.sin(t / 200 + i) * 2;
    const rx = Math.cos(radAngle) * radDist;
    const ry = Math.sin(radAngle) * radDist;
    drawPixelRectWithBlackOutline(ctx, rx, ry, 1, 1, P, CYBER_PALETTE.brightYellow);
  }

  ctx.restore();
}

/**
 * Gate Keeper - 문지기
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelGateKeeper(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const frameColor = isHit ? '#ffffff' : CYBER_PALETTE.blue;
  const pillarColor = isHit ? '#ffffff' : CYBER_PALETTE.steel;
  const portalColor = isHit ? '#ffffff' : CYBER_PALETTE.black;

  // v8.0: 게이트 기둥 (왼쪽) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -12, -14, 4, 26, P, pillarColor);
  // 기둥 장식
  for (let i = 0; i < 4; i++) {
    const sy = -10 + i * 6;
    drawPixelRectWithBlackOutline(ctx, -11, sy, 2, 3, P, CYBER_PALETTE.brightCyan);
  }

  // v8.0: 게이트 기둥 (오른쪽) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 8, -14, 4, 26, P, pillarColor);
  // 기둥 장식
  for (let i = 0; i < 4; i++) {
    const sy = -10 + i * 6;
    drawPixelRectWithBlackOutline(ctx, 9, sy, 2, 3, P, CYBER_PALETTE.brightCyan);
  }

  // v8.0: 게이트 아치 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -12, -16, 24, 4, P, frameColor);

  // v8.0: 포털 영역 배경 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -8, -12, 16, 22, P, portalColor);

  // v8.0: 포털 이펙트 - 회전 링들 - 검은 아웃라인
  const portalPhase = t / 200;
  ctx.globalAlpha = 0.8;
  for (let ring = 3; ring >= 0; ring--) {
    const ringSize = 2 + ring * 2;
    ctx.save();
    ctx.rotate(portalPhase * (ring % 2 === 0 ? 1 : -1));
    const color = ring === 0 ? CYBER_PALETTE.neonPink :
                  ring === 1 ? CYBER_PALETTE.brightOrange :
                  ring === 2 ? CYBER_PALETTE.brightCyan : CYBER_PALETTE.blue;
    drawPixelCircleWithBlackOutline(ctx, 0, -2, ringSize, P, color);
    ctx.restore();
  }

  // v8.0: 문지기 눈 - 검은 아웃라인
  ctx.globalAlpha = 1;
  const eyeBlink = Math.sin(t / 500) > 0.9 ? 0.3 : 1;
  ctx.globalAlpha = eyeBlink;
  drawPixelCircleWithBlackOutline(ctx, -4, -18, 2, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 4, -18, 2, P, CYBER_PALETTE.brightRed);

  // v8.0: 고대 룬 기호 - 검은 아웃라인
  ctx.globalAlpha = 0.9;
  const runeGlow = 0.5 + Math.sin(t / 300) * 0.3;
  ctx.globalAlpha = runeGlow;
  // 룬 (기둥 위)
  drawPixelRectWithBlackOutline(ctx, -10, -20, 2, 2, P, CYBER_PALETTE.brightYellow);
  drawPixelRectWithBlackOutline(ctx, 8, -20, 2, 2, P, CYBER_PALETTE.brightYellow);

  // v8.0: 포털 에너지 파티클 - 검은 아웃라인
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 6; i++) {
    const pAngle = t / 400 + i * Math.PI / 3;
    const pDist = 5 + Math.sin(t / 200 + i) * 2;
    const px = Math.cos(pAngle) * pDist;
    const py = -2 + Math.sin(pAngle) * pDist * 0.6;
    drawPixelRectWithBlackOutline(ctx, px, py, 1, 1, P, CYBER_PALETTE.white);
  }

  ctx.restore();
}

// ============================================================
// Stage 29: God's Room (신의 방)
// ============================================================

/**
 * Omniscient Eye - 전지적 눈
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelOmniscientEye(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  // v8.0: 신성한 광선 - 검은 아웃라인
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 12; i++) {
    const rayAngle = (i / 12) * Math.PI * 2 + t / 1000;
    const rayLen = 18 + Math.sin(t / 200 + i) * 3;
    const rx = Math.cos(rayAngle) * rayLen;
    const ry = Math.sin(rayAngle) * rayLen;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    ctx.strokeStyle = CYBER_PALETTE.brightYellow;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // v8.0: 눈 외형 - 검은 아웃라인
  ctx.globalAlpha = 1;
  const eyeColor = isHit ? '#ffffff' : CYBER_PALETTE.white;
  // 눈 형태 (가로 타원)
  drawPixelRectWithBlackOutline(ctx, -12, -6, 24, 12, P, eyeColor);
  // 양 끝 둥글게
  drawPixelCircleWithBlackOutline(ctx, -10, 0, 4, P, eyeColor);
  drawPixelCircleWithBlackOutline(ctx, 10, 0, 4, P, eyeColor);

  // v8.0: 홍채 - 검은 아웃라인
  const irisX = Math.sin(t / 600) * 3;
  const irisY = Math.cos(t / 800) * 1;
  drawPixelCircleWithBlackOutline(ctx, irisX, irisY, 5, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
  drawPixelCircleWithBlackOutline(ctx, irisX, irisY, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.blue);

  // v8.0: 동공 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, irisX, irisY, 2, P, CYBER_PALETTE.black);

  // v8.0: 빛 반사
  drawPixelRectWithBlackOutline(ctx, irisX - 2, irisY - 3, 2, 2, P, CYBER_PALETTE.white);

  // v8.0: 감시 표시기 - 검은 아웃라인
  ctx.globalAlpha = 0.8;
  const watchPulse = 0.5 + Math.sin(t / 300) * 0.3;
  ctx.globalAlpha = watchPulse;
  drawPixelRectWithBlackOutline(ctx, -3, -12, 6, 3, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

/**
 * Divine Code - 신성한 코드
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelDivineCode(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const scrollColor = isHit ? '#ffffff' : CYBER_PALETTE.white;
  const innerColor = isHit ? '#ffffff' : CYBER_PALETTE.cream;
  const codeColor = isHit ? '#ffffff' : CYBER_PALETTE.brightYellow;

  // v8.0: 성스러운 후광 링 - 검은 아웃라인
  ctx.globalAlpha = 0.5;
  for (let ring = 2; ring >= 0; ring--) {
    const ringSize = 14 + ring * 4;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, ringSize, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = CYBER_PALETTE.brightYellow;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // v8.0: 두루마리/석판 본체 - 검은 아웃라인
  ctx.globalAlpha = 1;
  drawPixelRectWithBlackOutline(ctx, -9, -13, 18, 26, P, scrollColor);
  drawPixelRectWithBlackOutline(ctx, -7, -11, 14, 22, P, innerColor);

  // v8.0: 신성한 코드 라인 - 검은 아웃라인
  for (let i = 0; i < 5; i++) {
    const lineY = -7 + i * 4;
    const lineWidth = 10 - Math.abs(i - 2) * 2;
    const shimmer = Math.sin(t / 300 + i) * 0.3 + 0.7;
    ctx.globalAlpha = shimmer;
    drawPixelRectWithBlackOutline(ctx, -lineWidth / 2, lineY, lineWidth, 2, P, codeColor);
  }

  // v8.0: 상단 십자가 심볼 - 검은 아웃라인
  ctx.globalAlpha = 1;
  drawPixelRectWithBlackOutline(ctx, -1, -16, 2, 5, P, CYBER_PALETTE.brightYellow);
  drawPixelRectWithBlackOutline(ctx, -3, -14, 6, 2, P, CYBER_PALETTE.brightYellow);

  // v8.0: 빛나는 파티클 - 검은 아웃라인
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < 6; i++) {
    const sparkAngle = t / 400 + i * Math.PI / 3;
    const sparkDist = 16 + Math.sin(t / 200 + i) * 2;
    const sx = Math.cos(sparkAngle) * sparkDist;
    const sy = Math.sin(sparkAngle) * sparkDist;
    drawPixelRectWithBlackOutline(ctx, sx, sy, 1, 1, P, CYBER_PALETTE.white);
  }

  ctx.restore();
}

/**
 * Angel Process - 천사 프로세스
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelAngelProcess(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const floatY = Math.sin(t / 400) * 2;

  ctx.save();
  ctx.translate(0, floatY);

  const wingColor = isHit ? '#ffffff' : CYBER_PALETTE.white;
  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const haloColor = isHit ? '#ffffff' : CYBER_PALETTE.brightYellow;

  // v8.0: 날개 퍼덕임 계산
  const wingFlap = Math.sin(t / 100) * 0.2;

  // v8.0: 왼쪽 날개 - 검은 아웃라인
  ctx.globalAlpha = 0.9;
  ctx.save();
  ctx.translate(-5, -3);
  ctx.rotate(-Math.PI / 6 + wingFlap);
  drawPixelRectWithBlackOutline(ctx, -12, -4, 12, 10, P, wingColor);
  // 날개 깃털 디테일
  for (let i = 0; i < 3; i++) {
    drawPixelRectWithBlackOutline(ctx, -10 + i * 3, -2 + i, 2, 6 - i, P, CYBER_PALETTE.brightCyan);
  }
  ctx.restore();

  // v8.0: 오른쪽 날개 - 검은 아웃라인
  ctx.save();
  ctx.translate(5, -3);
  ctx.rotate(Math.PI / 6 - wingFlap);
  drawPixelRectWithBlackOutline(ctx, 0, -4, 12, 10, P, wingColor);
  // 날개 깃털 디테일
  for (let i = 0; i < 3; i++) {
    drawPixelRectWithBlackOutline(ctx, 8 - i * 3, -2 + i, 2, 6 - i, P, CYBER_PALETTE.brightCyan);
  }
  ctx.restore();

  // v8.0: 몸체 - 검은 아웃라인
  ctx.globalAlpha = 1;
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 6, P, wingColor);
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 4, P, bodyColor);

  // v8.0: 헤일로 - 검은 아웃라인
  ctx.globalAlpha = 0.8 + Math.sin(t / 200) * 0.2;
  ctx.save();
  ctx.scale(1, 0.4);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -28, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = haloColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // v8.0: 프로세스 ID 표시 - 검은 아웃라인
  ctx.globalAlpha = 1;
  drawPixelRectWithBlackOutline(ctx, -4, -1, 8, 4, P, CYBER_PALETTE.black);
  ctx.fillStyle = CYBER_PALETTE.acidGreen;
  ctx.font = 'bold 5px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('∞', 0, 3);

  // v8.0: 신성한 파티클 - 검은 아웃라인
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 4; i++) {
    const pAngle = t / 500 + i * Math.PI / 2;
    const pDist = 14;
    const px = Math.cos(pAngle) * pDist;
    const py = Math.sin(pAngle) * pDist * 0.5;
    drawPixelRectWithBlackOutline(ctx, px, py, 1, 1, P, CYBER_PALETTE.brightYellow);
  }

  ctx.restore();
}

/**
 * Fallen Daemon - 타락한 데몬
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelFallenDaemon(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;
  const coreColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;

  // v8.0: 어두운 오라 - 검은 아웃라인
  ctx.globalAlpha = 0.5;
  for (let ring = 2; ring >= 0; ring--) {
    const auraSize = 12 + ring * 4;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, auraSize, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = CYBER_PALETTE.neonPink;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // v8.0: 타락한 몸체 - 검은 아웃라인
  ctx.globalAlpha = 1;
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 8, P, bodyColor);
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 5, P, coreColor);

  // v8.0: 뿔 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -8, -12, 4, 8, P, coreColor);
  drawPixelRectWithBlackOutline(ctx, 4, -12, 4, 8, P, coreColor);
  // 뿔 끝
  drawPixelRectWithBlackOutline(ctx, -7, -14, 2, 3, P, CYBER_PALETTE.brightOrange);
  drawPixelRectWithBlackOutline(ctx, 5, -14, 2, 3, P, CYBER_PALETTE.brightOrange);

  // v8.0: 사악한 눈 - 검은 아웃라인
  const eyeGlow = (Math.sin(t / 100) + 1) / 2;
  ctx.globalAlpha = 0.9 + eyeGlow * 0.1;
  drawPixelCircleWithBlackOutline(ctx, -3, -2, 2, P, CYBER_PALETTE.brightYellow);
  drawPixelCircleWithBlackOutline(ctx, 3, -2, 2, P, CYBER_PALETTE.brightYellow);

  // v8.0: 악성 코드 표시 - 검은 아웃라인
  ctx.globalAlpha = 1;
  drawPixelRectWithBlackOutline(ctx, -5, 2, 10, 5, P, CYBER_PALETTE.black);
  ctx.fillStyle = CYBER_PALETTE.brightRed;
  ctx.font = 'bold 5px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('666', 0, 6);

  // v8.0: 부패 파티클 - 검은 아웃라인
  ctx.globalAlpha = 0.8;
  const seed = Math.floor(t / 200);
  for (let i = 0; i < 6; i++) {
    const rand = deterministicRandom(seed + i);
    const pAngle = rand * Math.PI * 2;
    const pDist = 12 + rand * 4;
    const px = Math.cos(pAngle) * pDist;
    const py = Math.sin(pAngle) * pDist;
    const pColor = rand > 0.5 ? CYBER_PALETTE.brightRed : CYBER_PALETTE.neonPink;
    drawPixelRectWithBlackOutline(ctx, px, py, 1, 1, P, pColor);
  }

  ctx.restore();
}

/**
 * Prayer Packet - 기도 패킷
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelPrayerPacket(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const floatY = Math.sin(t / 200) * 3;

  ctx.save();
  ctx.translate(0, floatY);

  const envColor = isHit ? '#ffffff' : CYBER_PALETTE.white;
  const innerColor = isHit ? '#ffffff' : CYBER_PALETTE.cream;
  const sealColor = isHit ? '#ffffff' : CYBER_PALETTE.brightYellow;

  // v8.0: 상승 광선 트레일 (배경) - 검은 아웃라인
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < 4; i++) {
    const trailY = 10 + i * 4;
    const trailAlpha = 0.6 - i * 0.12;
    ctx.globalAlpha = trailAlpha;
    drawPixelRectWithBlackOutline(ctx, -4, trailY - floatY, 8, 3, P, CYBER_PALETTE.brightYellow);
  }

  // v8.0: 봉투 본체 - 검은 아웃라인
  ctx.globalAlpha = 1;
  drawPixelRectWithBlackOutline(ctx, -11, -7, 22, 14, P, envColor);
  drawPixelRectWithBlackOutline(ctx, -9, -5, 18, 10, P, innerColor);

  // v8.0: 봉투 덮개 (삼각형) - 검은 아웃라인
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-11, -7);
  ctx.lineTo(0, -14);
  ctx.lineTo(11, -7);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = envColor;
  ctx.fill();

  // v8.0: 성스러운 봉인 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 4, P, sealColor);
  // 십자가 심볼
  drawPixelRectWithBlackOutline(ctx, -0.5, -2, 1, 4, P, CYBER_PALETTE.white);
  drawPixelRectWithBlackOutline(ctx, -2, -0.5, 4, 1, P, CYBER_PALETTE.white);

  // v8.0: 기도 파티클 - 검은 아웃라인
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < 6; i++) {
    const sparkAngle = t / 350 + i * Math.PI / 3;
    const sparkDist = 14 + Math.sin(t / 200 + i) * 2;
    const sx = Math.cos(sparkAngle) * sparkDist;
    const sy = Math.sin(sparkAngle) * sparkDist * 0.5 - 4;
    drawPixelRectWithBlackOutline(ctx, sx, sy, 1, 1, P, CYBER_PALETTE.brightCyan);
  }

  // v8.0: 날개 장식 - 검은 아웃라인
  ctx.globalAlpha = 0.7;
  // 왼쪽 작은 날개
  drawPixelRectWithBlackOutline(ctx, -14, -4, 4, 6, P, CYBER_PALETTE.white);
  // 오른쪽 작은 날개
  drawPixelRectWithBlackOutline(ctx, 10, -4, 4, 6, P, CYBER_PALETTE.white);

  ctx.restore();
}

// ============================================================
// Stage 30: Final Choice (최후의 선택)
// ============================================================

/**
 * Destiny Shard - 운명의 조각
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelDestinyShard(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  // v8.0: 운명의 실 - 검은 아웃라인
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < 8; i++) {
    const threadAngle = (i / 8) * Math.PI * 2 + t / 600;
    const threadLen = 16 + Math.sin(t / 300 + i) * 3;
    const pulseColor = i % 2 === 0 ? CYBER_PALETTE.neonPink : CYBER_PALETTE.brightYellow;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(threadAngle) * threadLen, Math.sin(threadAngle) * threadLen);
    ctx.stroke();
    ctx.strokeStyle = pulseColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // v8.0: 크리스탈 조각 형태 - 검은 아웃라인
  ctx.save();
  ctx.rotate(t / 1000);

  const shardColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const innerColor = isHit ? '#ffffff' : CYBER_PALETTE.white;

  // 크리스탈 외곽선
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(8, -4);
  ctx.lineTo(5, 12);
  ctx.lineTo(-5, 12);
  ctx.lineTo(-8, -4);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = shardColor;
  ctx.fill();

  // 크리스탈 내부 빛
  ctx.fillStyle = innerColor;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(4, -2);
  ctx.lineTo(3, 8);
  ctx.lineTo(-3, 8);
  ctx.lineTo(-4, -2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // v8.0: 미래 비전 노드 - 검은 아웃라인
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < 3; i++) {
    const vAngle = t / 500 + i * Math.PI * 2 / 3;
    const vDist = 18;
    const vx = Math.cos(vAngle) * vDist;
    const vy = Math.sin(vAngle) * vDist;
    drawPixelCircleWithBlackOutline(ctx, vx, vy, 2, P, CYBER_PALETTE.neonPink);
  }

  ctx.restore();
}

/**
 * Timeline Split - 타임라인 분기
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelTimelineSplit(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const lineColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const nodeColor = isHit ? '#ffffff' : CYBER_PALETTE.white;
  const branchAColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const branchBColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;

  // v8.0: 시간 왜곡 링 - 검은 아웃라인
  ctx.globalAlpha = 0.5;
  for (let ring = 2; ring >= 0; ring--) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 6 + ring * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = CYBER_PALETTE.brightYellow;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // v8.0: 메인 타임라인 (수직) - 검은 아웃라인
  ctx.globalAlpha = 1;
  drawPixelRectWithBlackOutline(ctx, -2, -16, 4, 16, P, lineColor);

  // v8.0: 분기점 중앙 노드 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 4, P, nodeColor);
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, CYBER_PALETTE.neonPink);

  // v8.0: 분기 A (왼쪽 아래) - 검은 아웃라인
  ctx.save();
  ctx.rotate(-Math.PI / 4);
  drawPixelRectWithBlackOutline(ctx, -2, 0, 4, 16, P, branchAColor);
  // 이동하는 파티클
  const particleOffset = (t / 10) % 14;
  drawPixelRectWithBlackOutline(ctx, -1, particleOffset, 2, 2, P, CYBER_PALETTE.white);
  ctx.restore();

  // v8.0: 분기 B (오른쪽 아래) - 검은 아웃라인
  ctx.save();
  ctx.rotate(Math.PI / 4);
  drawPixelRectWithBlackOutline(ctx, -2, 0, 4, 16, P, branchBColor);
  drawPixelRectWithBlackOutline(ctx, -1, particleOffset, 2, 2, P, CYBER_PALETTE.white);
  ctx.restore();

  // v8.0: 선택 표시기 - 검은 아웃라인
  ctx.globalAlpha = 0.9;
  drawPixelRectWithBlackOutline(ctx, -12, 8, 5, 5, P, CYBER_PALETTE.brightCyan);
  drawPixelRectWithBlackOutline(ctx, 7, 8, 5, 5, P, CYBER_PALETTE.neonPink);
  ctx.fillStyle = CYBER_PALETTE.black;
  ctx.font = 'bold 5px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('A', -9.5, 12);
  ctx.fillText('B', 9.5, 12);

  ctx.restore();
}

/**
 * Choice Echo - 선택의 메아리
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelChoiceEcho(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  // v8.0: 메아리 파동 - 검은 아웃라인
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 3; i++) {
    const rippleSize = 10 + ((t / 10 + i * 5) % 14);
    const rippleAlpha = 0.5 - (rippleSize - 10) / 14 * 0.4;
    ctx.globalAlpha = rippleAlpha;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, rippleSize, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = CYBER_PALETTE.neonPink;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // v8.0: 다중 에코 레이어 - 검은 아웃라인
  for (let echo = 3; echo >= 0; echo--) {
    const echoOffset = echo * 3;
    const echoAlpha = 0.9 - echo * 0.2;
    const echoTime = t - echo * 300;

    ctx.globalAlpha = echoAlpha;
    ctx.save();
    ctx.translate(Math.sin(echoTime / 300) * echoOffset, -echo * 2);

    const color = isHit ? '#ffffff' :
                  echo === 0 ? CYBER_PALETTE.brightCyan :
                  echo === 1 ? CYBER_PALETTE.blue :
                  echo === 2 ? CYBER_PALETTE.neonPink : CYBER_PALETTE.steel;

    drawPixelCircleWithBlackOutline(ctx, 0, 0, 6, P, color);

    // v8.0: 선택 심볼 (주 에코만) - 검은 아웃라인
    if (echo === 0) {
      drawPixelRectWithBlackOutline(ctx, -3, -3, 6, 6, P, CYBER_PALETTE.black);
      ctx.fillStyle = CYBER_PALETTE.brightYellow;
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 1);
    }

    ctx.restore();
  }

  // v8.0: 과거 선택 파편 - 검은 아웃라인
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 6; i++) {
    const fragAngle = t / 800 + i * Math.PI / 3;
    const fragDist = 14 + Math.sin(t / 200 + i) * 2;
    const fx = Math.cos(fragAngle) * fragDist;
    const fy = Math.sin(fragAngle) * fragDist;
    drawPixelRectWithBlackOutline(ctx, fx, fy, 2, 2, P, CYBER_PALETTE.brightYellow);
  }

  ctx.restore();
}

/**
 * Paradox Loop - 역설 루프
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelParadoxLoop(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const loopColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;

  // v8.0: 무한 루프 형태 - 검은 아웃라인
  ctx.save();
  ctx.rotate(t / 1000);

  // 무한대 심볼 (8자 루프)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 7;
  ctx.beginPath();
  for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
    const loopX = Math.sin(angle) * 12;
    const loopY = Math.sin(angle * 2) * 6;
    if (angle === 0) {
      ctx.moveTo(loopX, loopY);
    } else {
      ctx.lineTo(loopX, loopY);
    }
  }
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = loopColor;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.restore();

  // v8.0: 역설 파티클 (루프를 따라 이동) - 검은 아웃라인
  const loopAngle = t / 200;
  const particleX = Math.sin(loopAngle) * 12;
  const particleY = Math.sin(loopAngle * 2) * 6;
  ctx.globalAlpha = 1;
  drawPixelCircleWithBlackOutline(ctx, particleX, particleY, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.white);
  // 파티클 트레일
  for (let i = 1; i <= 3; i++) {
    const trailAngle = loopAngle - i * 0.15;
    const tx = Math.sin(trailAngle) * 12;
    const ty = Math.sin(trailAngle * 2) * 6;
    ctx.globalAlpha = 0.8 - i * 0.2;
    drawPixelRectWithBlackOutline(ctx, tx, ty, 2, 2, P, CYBER_PALETTE.brightCyan);
  }

  // v8.0: 교차점 글리치 효과 - 검은 아웃라인
  if (Math.abs(particleX) < 3) {
    ctx.globalAlpha = 0.9;
    const glitchSeed = Math.floor(t / 50);
    for (let i = 0; i < 6; i++) {
      const gx = (deterministicRandom(glitchSeed + i) - 0.5) * 14;
      const gy = (deterministicRandom(glitchSeed + i + 10) - 0.5) * 8;
      drawPixelRectWithBlackOutline(ctx, gx, gy, 1, 1, P, CYBER_PALETTE.brightRed);
    }
  }

  // v8.0: 시간 경고 표시 - 검은 아웃라인
  ctx.globalAlpha = 0.9;
  drawPixelRectWithBlackOutline(ctx, -4, 9, 8, 6, P, CYBER_PALETTE.black);
  ctx.fillStyle = CYBER_PALETTE.brightYellow;
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('∞', 0, 14);

  ctx.restore();
}

/**
 * Final Bit - 최후의 비트
 * v8.0: 검은색 아웃라인 스트로크 적용
 */
export function drawPixelFinalBit(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  // v8.0: 운명의 실 - 검은 아웃라인
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([4, 4]);
  for (let i = 0; i < 8; i++) {
    const threadAngle = (i / 8) * Math.PI * 2 + t / 2000;
    const threadLen = 22;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(threadAngle) * 10, Math.sin(threadAngle) * 10);
    ctx.lineTo(Math.cos(threadAngle) * threadLen, Math.sin(threadAngle) * threadLen);
    ctx.stroke();
    ctx.strokeStyle = CYBER_PALETTE.brightYellow;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // v8.0: 최종 왕관 - 검은 아웃라인
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 5; i++) {
    const crownAngle = -Math.PI / 2 + (i - 2) * Math.PI / 8;
    const crownDist = 14;
    const cx = Math.cos(crownAngle) * crownDist;
    const cy = Math.sin(crownAngle) * crownDist;
    drawPixelRectWithBlackOutline(ctx, cx - 2, cy - 4, 4, 8, P, CYBER_PALETTE.brightYellow);
    // 왕관 보석
    if (i === 2) {
      drawPixelCircleWithBlackOutline(ctx, cx, cy - 2, 2, P, CYBER_PALETTE.brightRed);
    }
  }

  // v8.0: 궁극의 글로우 링 - 검은 아웃라인
  ctx.globalAlpha = 0.6;
  for (let ring = 3; ring >= 0; ring--) {
    const glowSize = 10 + ring * 4;
    const color = isHit ? '#ffffff' :
                  ring === 0 ? CYBER_PALETTE.white :
                  ring === 1 ? CYBER_PALETTE.brightCyan :
                  ring === 2 ? CYBER_PALETTE.neonPink : CYBER_PALETTE.blue;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // v8.0: 최후의 비트 코어 - 검은 아웃라인
  ctx.globalAlpha = 1;
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 8, P, CYBER_PALETTE.black);
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 6, P, CYBER_PALETTE.blue);

  // v8.0: 이진수 값 (0/1 전환)
  const bitValue = Math.sin(t / 500) > 0 ? '1' : '0';
  const bitColor = bitValue === '1' ? CYBER_PALETTE.acidGreen : CYBER_PALETTE.brightRed;
  ctx.fillStyle = bitColor;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bitValue, 0, 1);

  // v8.0: 에너지 펄스 - 검은 아웃라인
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < 8; i++) {
    const pulseAngle = (i / 8) * Math.PI * 2 + t / 300;
    const pulseDist = 12 + Math.sin(t / 150 + i) * 3;
    const px = Math.cos(pulseAngle) * pulseDist;
    const py = Math.sin(pulseAngle) * pulseDist;
    const pulseColor = i % 2 === 0 ? CYBER_PALETTE.brightCyan : CYBER_PALETTE.neonPink;
    drawPixelRectWithBlackOutline(ctx, px, py, 2, 2, P, pulseColor);
  }

  ctx.restore();
}
