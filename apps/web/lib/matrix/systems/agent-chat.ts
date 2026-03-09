/**
 * agent-chat.ts — AI 에이전트 채팅 메시지 타입 stub
 */

export interface ChatMessage {
  agentId: string;
  text: string;
  message: string;
  timestamp: number;
  opacity: number;
  type?: 'taunt' | 'strategy' | 'reaction';
}
