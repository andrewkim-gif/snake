/**
 * chatBubble.ts - Arena Mode Chat Bubble Rendering
 *
 * 에이전트 말풍선 및 이름표 렌더링
 */

import { Agent, Vector2 } from '../../types';
import { ChatMessage } from '../../systems/agent-chat';
import {
  NAMEPLATE_CONFIG,
  CHAT_BUBBLE_CONFIG,
  getArenaAgentIdentity,
  getArenaAgentDisplayName,
} from '../../config/arena.config';

/**
 * 에이전트 이름표 렌더링
 */
export function drawAgentNameplate(
  ctx: CanvasRenderingContext2D,
  agent: Agent,
  screenX: number,
  screenY: number
): void {
  const identity = getArenaAgentIdentity(agent.agentId);
  if (!identity) return;

  const { fontSize, fontFamily, backgroundColor, padding, borderRadius, offsetY } = NAMEPLATE_CONFIG;
  const displayName = identity.displayName;

  // 위치 계산
  const y = screenY + offsetY;

  ctx.save();

  // 텍스트 측정
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  const textWidth = ctx.measureText(displayName).width;
  const bgWidth = textWidth + padding * 2;
  const bgHeight = fontSize + padding * 2;
  const x = screenX - bgWidth / 2;

  // 배경 박스
  ctx.fillStyle = backgroundColor;
  ctx.beginPath();
  ctx.roundRect(x, y - bgHeight / 2, bgWidth, bgHeight, borderRadius);
  ctx.fill();

  // 캐릭터 색상 테두리
  ctx.strokeStyle = identity.color;
  ctx.lineWidth = 1;
  ctx.stroke();

  // 이름 텍스트
  ctx.fillStyle = identity.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayName, screenX, y);

  ctx.restore();
}

/**
 * 채팅 버블 렌더링
 */
export function drawChatBubble(
  ctx: CanvasRenderingContext2D,
  message: ChatMessage,
  screenX: number,
  screenY: number
): void {
  const {
    maxWidth,
    fontSize,
    fontFamily,
    backgroundColor,
    textColor,
    borderColor,
    padding,
    borderRadius,
    offsetY,
  } = CHAT_BUBBLE_CONFIG;

  const identity = getArenaAgentIdentity(message.agentId);
  const bubbleColor = identity?.color || borderColor;

  ctx.save();

  // 투명도 적용
  ctx.globalAlpha = message.opacity;

  // 텍스트 줄바꿈 처리
  ctx.font = `${fontSize}px ${fontFamily}`;
  const words = message.message.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth - padding * 2) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  // 버블 크기 계산
  const lineHeight = fontSize + 4;
  const textHeight = lines.length * lineHeight;
  const bubbleWidth = Math.min(
    maxWidth,
    Math.max(...lines.map(line => ctx.measureText(line).width)) + padding * 2
  );
  const bubbleHeight = textHeight + padding * 2;

  // v8.1.3: 체력바(screenY - 10) 위에 표시
  // 버블 하단이 체력바 상단보다 위에 와야 함
  // 버블 하단 = y + bubbleHeight, 체력바 상단 = screenY - 10
  // 따라서 y = screenY - 10 - bubbleHeight - gap(5)
  const gap = 5;
  const y = screenY - 10 - bubbleHeight - gap;
  const x = screenX - bubbleWidth / 2;

  // 말풍선 꼬리 (삼각형) - 버블 하단에서 아래로
  ctx.fillStyle = backgroundColor;
  ctx.beginPath();
  ctx.moveTo(screenX - 6, y + bubbleHeight);
  ctx.lineTo(screenX + 6, y + bubbleHeight);
  ctx.lineTo(screenX, y + bubbleHeight + 8);
  ctx.closePath();
  ctx.fill();

  // 배경 박스
  ctx.beginPath();
  ctx.roundRect(x, y, bubbleWidth, bubbleHeight, borderRadius);
  ctx.fill();

  // 테두리
  ctx.strokeStyle = bubbleColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 텍스트
  ctx.fillStyle = bubbleColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  lines.forEach((line, i) => {
    ctx.fillText(line, x + padding, y + padding + i * lineHeight);
  });

  ctx.restore();
}

/**
 * 에이전트 UI 전체 렌더링 (이름표 + 채팅)
 */
export function drawAgentUI(
  ctx: CanvasRenderingContext2D,
  agent: Agent,
  chatMessage: ChatMessage | null,
  screenX: number,
  screenY: number,
  isLocalPlayer: boolean
): void {
  // 로컬 플레이어는 이름표 표시 안 함 (옵션)
  if (!isLocalPlayer) {
    drawAgentNameplate(ctx, agent, screenX, screenY);
  }

  // 채팅 메시지 표시
  if (chatMessage) {
    drawChatBubble(ctx, chatMessage, screenX, screenY);
  }
}

/**
 * 체력바 렌더링 (에이전트용)
 */
export function drawAgentHealthBar(
  ctx: CanvasRenderingContext2D,
  agent: Agent,
  screenX: number,
  screenY: number,
  width: number = 40,
  height: number = 4
): void {
  const identity = getArenaAgentIdentity(agent.agentId);
  const barColor = identity?.color || '#00FF41';

  const healthRatio = agent.health / agent.maxHealth;
  // v8.1.1: screenY는 이미 GameCanvas에서 spriteHeadY로 머리 위치가 계산되어 전달됨
  // 체력바는 머리 바로 위에 표시 (-10만 추가)
  const y = screenY - 10;
  const x = screenX - width / 2;

  ctx.save();

  // 배경
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(x, y, width, height);

  // 체력
  ctx.fillStyle = healthRatio > 0.3 ? barColor : '#dc2626';
  ctx.fillRect(x, y, width * healthRatio, height);

  // 테두리
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, width, height);

  ctx.restore();
}

/**
 * 킬피드 메시지 렌더링
 */
export interface KillFeedEntry {
  id: string;
  killerId: string;
  victimId: string;
  weaponType: string;
  timestamp: number;
  opacity: number;
}

export function drawKillFeed(
  ctx: CanvasRenderingContext2D,
  entries: KillFeedEntry[],
  canvasWidth: number
): void {
  const startX = canvasWidth - 250;
  const startY = 100;
  const lineHeight = 24;
  const fontSize = 11;

  ctx.save();
  ctx.font = `${fontSize}px monospace`;

  entries.forEach((entry, i) => {
    const killerName = getArenaAgentDisplayName(entry.killerId);
    const victimName = getArenaAgentDisplayName(entry.victimId);
    const killerIdentity = getArenaAgentIdentity(entry.killerId);
    const victimIdentity = getArenaAgentIdentity(entry.victimId);

    const y = startY + i * lineHeight;

    ctx.globalAlpha = entry.opacity;

    // 킬러 이름
    ctx.fillStyle = killerIdentity?.color || '#00FF41';
    ctx.textAlign = 'right';
    ctx.fillText(killerName, startX + 80, y);

    // 화살표
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.fillText('>', startX + 95, y);

    // 피해자 이름
    ctx.fillStyle = victimIdentity?.color || '#dc2626';
    ctx.textAlign = 'left';
    ctx.fillText(victimName, startX + 110, y);
  });

  ctx.restore();
}
