/**
 * agentChat.ts - Arena Mode AI Agent Chat System
 *
 * OpenRouter API를 사용한 AI 에이전트 채팅 시스템
 * 트리거 기반 대화 생성 + 폴백 메시지
 */

import { Agent, Vector2 } from '../types';
import {
  ChatTrigger,
  getArenaAgentIdentity,
  getArenaAgentDisplayName,
  getRandomFallbackMessage,
  CHAT_BUBBLE_CONFIG,
  PERSONALITY_WEIGHTS,
} from '../config/arena-agents.config';

// OpenRouter API 설정
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'google/gemini-2.5-flash-lite'; // 저렴하고 빠름 (gemini lite)

// Rate Limiting
const MIN_CHAT_INTERVAL = 5000; // 같은 에이전트 최소 5초 간격
const GLOBAL_CHAT_COOLDOWN = 2000; // 전체 채팅 2초 쿨다운
const MAX_PENDING_REQUESTS = 3; // 동시 API 요청 최대 3개

// 채팅 메시지 인터페이스
export interface ChatMessage {
  id: string;
  agentId: string;
  message: string;
  timestamp: number;
  trigger: ChatTrigger;
  position: Vector2; // 표시 위치
  opacity: number; // 페이드아웃용
}

// 상태 관리
let lastGlobalChatTime = 0;
const agentLastChatTimes: Map<string, number> = new Map();
let pendingRequests = 0;
const activeMessages: ChatMessage[] = [];

/**
 * API 키 가져오기
 */
function getApiKey(): string | null {
  // Next.js / Vite 환경변수
  if (typeof process !== 'undefined' && (process.env as any)?.NEXT_PUBLIC_OPENROUTER_API_KEY) {
    return (process.env as any).NEXT_PUBLIC_OPENROUTER_API_KEY;
  }
  if (typeof (globalThis as any).import?.meta?.env !== 'undefined') {
    return (globalThis as any).import.meta.env?.VITE_OPENROUTER_API_KEY ?? null;
  }
  return null;
}

/**
 * Rate limit 체크
 */
function canChat(agentId: string): boolean {
  const now = Date.now();

  // 전역 쿨다운
  if (now - lastGlobalChatTime < GLOBAL_CHAT_COOLDOWN) {
    return false;
  }

  // 에이전트별 쿨다운
  const lastChat = agentLastChatTimes.get(agentId) || 0;
  if (now - lastChat < MIN_CHAT_INTERVAL) {
    return false;
  }

  // 동시 요청 제한
  if (pendingRequests >= MAX_PENDING_REQUESTS) {
    return false;
  }

  return true;
}

/**
 * 채팅 확률 체크 (성격 기반)
 * v8.1.4: 중요 트리거는 100% 채팅하도록 수정
 */
function shouldChat(agent: Agent, trigger: ChatTrigger): boolean {
  // v8.1.4: 중요 트리거는 무조건 채팅 (spawn, kill_agent, death, victory)
  const alwaysChatTriggers: ChatTrigger[] = ['spawn', 'kill_agent', 'death', 'victory'];
  if (alwaysChatTriggers.includes(trigger)) {
    return true;
  }

  const personality = PERSONALITY_WEIGHTS[agent.aiPersonality || 'balanced'];
  if (!personality) return false;
  const baseChance = personality.chatFrequency;

  // 트리거별 확률 조정
  const triggerMultipliers: Record<ChatTrigger, number> = {
    spawn: 1.0, // 위에서 처리
    kill_agent: 1.0, // 위에서 처리
    kill_monster: 0.3, // 낮은 확률
    death: 1.0, // 위에서 처리
    low_health: 0.6,
    level_up: 0.8,
    taunt: 0.4,
    observation: 0.15,
    victory: 1.0, // 위에서 처리
    defeat: 0.8,
  };

  const finalChance = baseChance * triggerMultipliers[trigger];
  return Math.random() < finalChance;
}

/**
 * OpenRouter API 호출
 */
async function callOpenRouter(
  agentId: string,
  trigger: ChatTrigger,
  context: string
): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[AgentChat] No API key found, using fallback');
    return null;
  }

  const identity = getArenaAgentIdentity(agentId);
  if (!identity) return null;

  const systemPrompt = `You are ${identity.displayName}, ${identity.title} from the Matrix.
Your personality is ${identity.chatStyle}. You speak in short, punchy phrases (1-2 sentences max).
Your catchphrases include: "${identity.catchphrases.slice(0, 3).join('", "')}"
Stay in character. Be dramatic but brief. No emojis.`;

  const userPrompt = `[Trigger: ${trigger}] ${context}
Respond as ${identity.displayName} would in this situation. Keep it under 15 words.`;

  try {
    pendingRequests++;

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'CODE SURVIVOR Arena',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 50,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.warn('[AgentChat] API call failed:', error);
    return null;
  } finally {
    pendingRequests--;
  }
}

/**
 * 트리거 컨텍스트 생성
 */
function buildContext(trigger: ChatTrigger, details: Record<string, unknown>): string {
  switch (trigger) {
    case 'spawn':
      return 'You just spawned into the arena. Ready for battle.';
    case 'kill_agent':
      return `You just eliminated ${details.victimName || 'an enemy agent'}!`;
    case 'kill_monster':
      return `You killed ${details.killStreak || 1} monsters in a row.`;
    case 'death':
      return `You were eliminated by ${details.killerName || 'an enemy'}.`;
    case 'low_health':
      return `Your health is critical (${details.healthPercent || 20}%).`;
    case 'level_up':
      return `You reached level ${details.level || 2}!`;
    case 'taunt':
      return `You see ${details.targetName || 'an enemy'} nearby.`;
    case 'observation':
      return `You notice ${details.observation || 'something interesting'}.`;
    case 'victory':
      return 'You won the match!';
    case 'defeat':
      return 'The match ended. You did not win.';
    default:
      return 'Something happened.';
  }
}

/**
 * 채팅 메시지 생성 (메인 함수)
 */
export async function triggerAgentChat(
  agent: Agent,
  trigger: ChatTrigger,
  details: Record<string, unknown> = {}
): Promise<ChatMessage | null> {
  // Rate limit 체크
  if (!canChat(agent.agentId)) {
    return null;
  }

  // 확률 체크
  if (!shouldChat(agent, trigger)) {
    return null;
  }

  // 쿨다운 기록
  const now = Date.now();
  lastGlobalChatTime = now;
  agentLastChatTimes.set(agent.agentId, now);

  // 컨텍스트 생성
  const context = buildContext(trigger, details);

  // API 호출 (비동기, 폴백 준비)
  let message: string;

  try {
    const apiResponse = await Promise.race([
      callOpenRouter(agent.agentId, trigger, context),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)), // 3초 타임아웃
    ]);

    message = apiResponse || getRandomFallbackMessage(agent.agentId, trigger);
  } catch {
    message = getRandomFallbackMessage(agent.agentId, trigger);
  }

  // 채팅 메시지 객체 생성
  const chatMessage: ChatMessage = {
    id: `chat_${agent.agentId}_${now}`,
    agentId: agent.agentId,
    message,
    timestamp: now,
    trigger,
    position: { ...agent.position },
    opacity: 1,
  };

  // 활성 메시지 목록에 추가
  activeMessages.push(chatMessage);

  // 오래된 메시지 정리 (최대 10개 유지)
  while (activeMessages.length > 10) {
    activeMessages.shift();
  }

  return chatMessage;
}

/**
 * 채팅 메시지 업데이트 (페이드아웃 처리)
 */
export function updateChatMessages(deltaTime: number): void {
  const now = Date.now();
  const { displayDuration, fadeOutDuration } = CHAT_BUBBLE_CONFIG;

  for (let i = activeMessages.length - 1; i >= 0; i--) {
    const msg = activeMessages[i];
    const age = now - msg.timestamp;

    if (age > displayDuration + fadeOutDuration) {
      // 완전히 사라진 메시지 제거
      activeMessages.splice(i, 1);
    } else if (age > displayDuration) {
      // 페이드아웃 중
      const fadeProgress = (age - displayDuration) / fadeOutDuration;
      msg.opacity = 1 - fadeProgress;
    }
  }
}

/**
 * 활성 채팅 메시지 가져오기
 */
export function getActiveChatMessages(): ChatMessage[] {
  return activeMessages.filter(msg => msg.opacity > 0);
}

/**
 * 특정 에이전트의 활성 채팅 가져오기
 */
export function getAgentChatMessage(agentId: string): ChatMessage | null {
  return activeMessages.find(msg => msg.agentId === agentId && msg.opacity > 0) || null;
}

/**
 * 채팅 시스템 리셋
 */
export function resetChatSystem(): void {
  activeMessages.length = 0;
  agentLastChatTimes.clear();
  lastGlobalChatTime = 0;
  pendingRequests = 0;
}

/**
 * 즉시 폴백 메시지 생성 (API 없이)
 */
export function triggerFallbackChat(
  agent: Agent,
  trigger: ChatTrigger
): ChatMessage | null {
  if (!canChat(agent.agentId)) return null;
  if (!shouldChat(agent, trigger)) return null;

  const now = Date.now();
  lastGlobalChatTime = now;
  agentLastChatTimes.set(agent.agentId, now);

  const message = getRandomFallbackMessage(agent.agentId, trigger);

  const chatMessage: ChatMessage = {
    id: `chat_${agent.agentId}_${now}`,
    agentId: agent.agentId,
    message,
    timestamp: now,
    trigger,
    position: { ...agent.position },
    opacity: 1,
  };

  activeMessages.push(chatMessage);

  while (activeMessages.length > 10) {
    activeMessages.shift();
  }

  return chatMessage;
}
