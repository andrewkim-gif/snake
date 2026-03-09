/**
 * useArena.ts - Arena (Battle Royale) 모드 상태 관리
 * 9명의 AI 에이전트가 서로 싸우는 배틀로얄 모드
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Agent,
  SafeZone,
  ArenaConfig,
  ArenaResult,
  ArenaPhase,
  AIPersonality,
  PlayerClass,
  Vector2,
  WeaponType,
  WeaponStats
} from '../types';
import { CLASS_DATA } from '../constants';
import { loadSpriteSheet } from '../sprites';
import type { KillFeedEntry } from '../rendering/ui/chatBubble';
import { triggerFallbackChat } from '../systems/agent-chat';
import { getAgentWeaponRange } from '../systems/agent-combat';

// 기본 Arena 설정
const DEFAULT_ARENA_CONFIG: ArenaConfig = {
  gameDuration: 300,           // 5분
  maxAgents: 9,                // 9명
  respawnDelay: 3,             // 3초 리스폰 딜레이
  respawnInvincibility: 2,     // 2초 무적
  killScore: 100,              // 킬당 100점
  monsterDensity: 0.5,         // 몬스터 밀도 50%
  monsterXpMultiplier: 0.5,    // 몬스터 XP 50%
  agentKillXp: 50,             // 에이전트 킬 XP
};

// AI 성격 배분 (9명)
const AI_PERSONALITIES: AIPersonality[] = [
  'aggressive',  // 공격적 (3명)
  'aggressive',
  'aggressive',
  'defensive',   // 방어적 (2명)
  'defensive',
  'balanced',    // 균형 (2명)
  'balanced',
  'collector',   // 수집형 (2명)
  'collector',
];

// 사용 가능한 캐릭터 클래스 (플레이어 제외)
const AVAILABLE_CLASSES: PlayerClass[] = [
  'neo', 'tank', 'cypher', 'morpheus', 'niobe', 'oracle', 'trinity', 'mouse', 'dozer'
];

// 클래스별 시작 무기 매핑
const CLASS_STARTING_WEAPONS: Record<PlayerClass, WeaponType> = {
  neo: 'whip',
  tank: 'punch',
  cypher: 'knife',
  morpheus: 'wand',
  niobe: 'bow',
  oracle: 'garlic',
  trinity: 'laser',
  mouse: 'knife',
  dozer: 'axe',
};

export interface UseArenaReturn {
  // 상태
  agents: Agent[];
  agentsRef: React.MutableRefObject<Agent[]>;
  localPlayerAgent: Agent | null;
  safeZone: SafeZone;
  arenaPhase: ArenaPhase;
  gameTime: number;
  config: ArenaConfig;
  killFeed: KillFeedEntry[];

  // 액션
  initializeArena: (playerClass: PlayerClass) => void;
  updateArena: (deltaTime: number) => void;
  damageAgent: (agentId: string, damage: number, attackerId?: string) => void;
  killAgent: (agentId: string, killerId?: string) => void;
  respawnAgent: (agentId: string) => void;
  addAgentXp: (agentId: string, xp: number) => void;
  getArenaResult: () => ArenaResult;
  reset: () => void;
  // 에이전트 상태 직접 업데이트 (전투 시스템용)
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
}

// 맵 크기 (스폰용)
const MAP_SIZE = 3000;
const SPAWN_PADDING = 200;

// 플레이어 주변에 스폰 (반경 300~600px 원형 분포)
function getRandomSpawnPosition(index: number = 0, totalAgents: number = 9): Vector2 {
  // 에이전트들을 원형으로 배치 (플레이어 기준 원형)
  const baseAngle = (index / totalAgents) * Math.PI * 2;
  const angleVariation = (Math.random() - 0.5) * 0.5; // ±45도 변동
  const angle = baseAngle + angleVariation;

  const minDistance = 300;
  const maxDistance = 600;
  const distance = minDistance + Math.random() * (maxDistance - minDistance);

  // 플레이어 시작 위치가 (0, 0)이므로 그 주변에 스폰
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  };
}

function createStartingWeapon(weaponType: WeaponType): WeaponStats {
  return {
    level: 1,
    damage: 10,
    area: 3,
    speed: 300,
    duration: 0.5,
    cooldown: 1000,
    amount: 1,
    pierce: 1,
    knockback: 5,
  };
}

export function useArena(): UseArenaReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [safeZone, setSafeZone] = useState<SafeZone>({
    center: { x: MAP_SIZE / 2, y: MAP_SIZE / 2 },
    currentRadius: MAP_SIZE,
    targetRadius: MAP_SIZE,
    shrinkSpeed: 0,
    damagePerSecond: 0,
    phase: 0,
    nextShrinkTime: 60,
    isWarning: false,
    isShrinking: false,
  });
  const [arenaPhase, setArenaPhase] = useState<ArenaPhase>('waiting');
  const [gameTime, setGameTime] = useState(0);
  const [config] = useState<ArenaConfig>(DEFAULT_ARENA_CONFIG);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);

  const agentsRef = useRef<Agent[]>([]);
  agentsRef.current = agents;

  // 로컬 플레이어 에이전트
  const localPlayerAgent = agents.find(a => a.isLocalPlayer) || null;

  // Arena 초기화
  const initializeArena = useCallback((playerClass: PlayerClass) => {
    const newAgents: Agent[] = [];

    // 사용할 클래스 목록 (플레이어 클래스 제외)
    const availableForAI = AVAILABLE_CLASSES.filter(c => c !== playerClass);

    // 셔플된 AI 성격
    const shuffledPersonalities = [...AI_PERSONALITIES].sort(() => Math.random() - 0.5);

    // 로컬 플레이어 에이전트 생성 (위치는 GameCanvas의 playerRef와 동일하게 0,0)
    const playerStartingWeapon = CLASS_STARTING_WEAPONS[playerClass];
    newAgents.push({
      id: `agent_${playerClass}`,
      agentId: `agent_${playerClass}`,
      playerClass,
      isLocalPlayer: true,
      aiPersonality: 'balanced', // 플레이어는 balanced로 표시

      position: { x: 0, y: 0 }, // 플레이어 시작 위치와 동일
      velocity: { x: 0, y: 0 },
      radius: 16,
      color: CLASS_DATA[playerClass]?.color || '#00ff41',
      health: 100,
      maxHealth: 100,
      speed: CLASS_DATA[playerClass]?.speed || 120,

      kills: 0,
      deaths: 0,
      score: 0,

      isAlive: true,
      respawnTimer: 0,
      respawnInvincibility: 0,

      weapons: {
        [playerStartingWeapon]: createStartingWeapon(playerStartingWeapon),
      },
      weaponCooldowns: {},

      level: 1,
      xp: 0,
      nextLevelXp: 100,

      statMultipliers: {
        speed: 1,
        cooldown: 1,
        damage: 1,
        health: 1,
      },

      state: 'idle',
    });

    // AI 에이전트 생성 (8명) - 플레이어 주변 원형 배치
    for (let i = 0; i < 8; i++) {
      const aiClass = availableForAI[i % availableForAI.length];
      const personality = shuffledPersonalities[i] || 'balanced';
      const aiStartingWeapon = CLASS_STARTING_WEAPONS[aiClass];

      newAgents.push({
        id: `agent_${aiClass}_${i}`,
        agentId: `agent_${aiClass}_${i}`,
        playerClass: aiClass,
        isLocalPlayer: false,
        aiPersonality: personality,

        position: getRandomSpawnPosition(i, 8), // 원형 배치
        velocity: { x: 0, y: 0 },
        radius: 16,
        color: CLASS_DATA[aiClass]?.color || '#ff0000',
        health: 100,
        maxHealth: 100,
        speed: CLASS_DATA[aiClass]?.speed || 120,

        kills: 0,
        deaths: 0,
        score: 0,

        isAlive: true,
        respawnTimer: 0,
        respawnInvincibility: 0,

        weapons: {
          [aiStartingWeapon]: createStartingWeapon(aiStartingWeapon),
        },
        weaponCooldowns: {},

        level: 1,
        xp: 0,
        nextLevelXp: 100,

        statMultipliers: {
          speed: 1,
          cooldown: 1,
          damage: 1,
          health: 1,
        },

        state: 'idle',
      });
    }

    setAgents(newAgents);
    setArenaPhase('playing');
    setGameTime(0);
    setKillFeed([]); // 킬피드 초기화

    // 모든 에이전트의 스프라이트 시트 로드
    const uniqueClasses = [...new Set(newAgents.map(a => a.playerClass))];
    uniqueClasses.forEach(cls => {
      loadSpriteSheet(cls).catch(() => {
        // 스프라이트 로드 실패는 무시 (drawCatSprite 폴백 사용)
      });
    });

    // v8.1.5: spawn 채팅은 updateArena 첫 프레임에서 처리 (게임 UI 준비 후)
    // 플래그 리셋
    spawnChatFiredRef.current = false;

    // 안전지대 초기화
    setSafeZone({
      center: { x: MAP_SIZE / 2, y: MAP_SIZE / 2 },
      currentRadius: MAP_SIZE,
      targetRadius: MAP_SIZE * 0.8,
      shrinkSpeed: 0,
      damagePerSecond: 5,
      phase: 0,
      nextShrinkTime: 60,
      isWarning: false,
      isShrinking: false,
    });
  }, []);

  // AI 방향 변경 타이머 (각 에이전트별)
  const aiDirectionTimersRef = useRef<Map<string, number>>(new Map());
  const aiTargetDirectionsRef = useRef<Map<string, Vector2>>(new Map());

  // v8.1.6: 주기적 채팅 타이머 (에이전트별) - 빈도 2배로 증가
  const periodicChatTimersRef = useRef<Map<string, number>>(new Map());
  const PERIODIC_CHAT_INTERVAL = 4000; // 4초 기본 간격 (v8.1.5: 8초 → v8.1.6: 4초)

  // v8.1.5: 스폰 채팅 플래그 (게임 시작 후 한 번만 실행)
  const spawnChatFiredRef = useRef(false);

  // Arena 업데이트 (매 프레임)
  const updateArena = useCallback((deltaTime: number) => {
    if (arenaPhase !== 'playing') return;

    setGameTime(prev => prev + deltaTime);

    // v8.1.5: 첫 프레임에서 모든 에이전트 스폰 채팅 트리거
    if (!spawnChatFiredRef.current) {
      spawnChatFiredRef.current = true;
      const currentAgents = agentsRef.current;
      currentAgents.forEach((agent, index) => {
        setTimeout(() => {
          triggerFallbackChat(agent, 'spawn');
        }, index * 300); // 0.3초 간격으로
      });
    }

    // 에이전트 업데이트 (리스폰 타이머, 무적 시간, AI 움직임)
    setAgents(prevAgents =>
      prevAgents.map(agent => {
        // 죽은 에이전트 리스폰 처리
        if (!agent.isAlive && agent.respawnTimer > 0) {
          const newTimer = agent.respawnTimer - deltaTime;
          if (newTimer <= 0) {
            // 리스폰
            return {
              ...agent,
              isAlive: true,
              respawnTimer: 0,
              respawnInvincibility: config.respawnInvincibility,
              health: agent.maxHealth,
              position: getRandomSpawnPosition(),
              velocity: { x: 0, y: 0 },
              state: 'idle' as const,
            };
          }
          return { ...agent, respawnTimer: newTimer };
        }

        // 무적 시간 감소
        let updatedAgent = agent;
        if (agent.respawnInvincibility > 0) {
          updatedAgent = { ...agent, respawnInvincibility: agent.respawnInvincibility - deltaTime };
        }

        // v8.1.6: 모든 에이전트 (로컬 플레이어 포함) 주기적 채팅
        if (updatedAgent.isAlive) {
          const agentId = updatedAgent.agentId;
          let chatTimer = periodicChatTimersRef.current.get(agentId) || (PERIODIC_CHAT_INTERVAL + Math.random() * 2000);
          chatTimer -= deltaTime * 1000;
          if (chatTimer <= 0) {
            // 50% 확률로 taunt 또는 observation
            const trigger = Math.random() < 0.5 ? 'taunt' : 'observation';
            triggerFallbackChat(updatedAgent, trigger as any);
            chatTimer = PERIODIC_CHAT_INTERVAL + Math.random() * 2000; // 4-6초
          }
          periodicChatTimersRef.current.set(agentId, chatTimer);
        }

        // AI 에이전트만 자동 이동 (로컬 플레이어는 제외)
        if (!updatedAgent.isLocalPlayer && updatedAgent.isAlive) {
          const agentId = updatedAgent.agentId;

          // 로컬 플레이어 위치 찾기 (플레이어 주변 유지용)
          const localPlayer = prevAgents.find(a => a.isLocalPlayer);
          const playerPos = localPlayer?.position || { x: 0, y: 0 };

          // 플레이어와의 거리 계산
          const dxPlayer = updatedAgent.position.x - playerPos.x;
          const dyPlayer = updatedAgent.position.y - playerPos.y;
          const distToPlayer = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);

          // 1000px 초과 시 텔레포트 (플레이어 근처 300-500px 범위로)
          const TELEPORT_THRESHOLD = 1000;
          const MAX_PLAYER_DISTANCE = 600;

          if (distToPlayer > TELEPORT_THRESHOLD) {
            const teleportAngle = Math.random() * Math.PI * 2;
            const teleportDist = 300 + Math.random() * 200; // 300~500px
            updatedAgent = {
              ...updatedAgent,
              position: {
                x: playerPos.x + Math.cos(teleportAngle) * teleportDist,
                y: playerPos.y + Math.sin(teleportAngle) * teleportDist,
              },
              velocity: { x: 0, y: 0 },
              state: 'idle' as const,
            };
          } else {
            // v8.1.5: 전투 거리 유지 AI - 다른 에이전트 타겟팅
            const weaponRange = getAgentWeaponRange(updatedAgent);
            const idealDistance = weaponRange * 0.75; // 사거리의 75%
            const tolerance = 40; // ±40px 허용

            // 가장 가까운 타겟 찾기 (다른 에이전트 또는 로컬 플레이어)
            let nearestTarget: Agent | null = null;
            let nearestDist = Infinity;
            for (const other of prevAgents) {
              if (other.agentId === agentId) continue;
              if (!other.isAlive) continue;
              const tdx = other.position.x - updatedAgent.position.x;
              const tdy = other.position.y - updatedAgent.position.y;
              const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
              if (tdist < nearestDist && tdist < 600) {
                nearestDist = tdist;
                nearestTarget = other;
              }
            }

            // 방향 변경 타이머 체크
            let timer = aiDirectionTimersRef.current.get(agentId) || 0;
            timer -= deltaTime;

            if (timer <= 0) {
              if (nearestTarget) {
                // 타겟이 있으면 전투 거리 유지
                const tdx = nearestTarget.position.x - updatedAgent.position.x;
                const tdy = nearestTarget.position.y - updatedAgent.position.y;
                const targetAngle = Math.atan2(tdy, tdx);

                if (nearestDist > idealDistance + tolerance) {
                  // 타겟에 접근
                  aiTargetDirectionsRef.current.set(agentId, {
                    x: Math.cos(targetAngle) * updatedAgent.speed,
                    y: Math.sin(targetAngle) * updatedAgent.speed,
                  });
                  timer = 0.3 + Math.random() * 0.3;
                } else if (nearestDist < idealDistance - tolerance && weaponRange > 100) {
                  // 타겟에서 후퇴 (원거리 무기만)
                  aiTargetDirectionsRef.current.set(agentId, {
                    x: -Math.cos(targetAngle) * updatedAgent.speed * 0.6,
                    y: -Math.sin(targetAngle) * updatedAgent.speed * 0.6,
                  });
                  timer = 0.3 + Math.random() * 0.3;
                } else {
                  // 적정 거리 - 측면 이동
                  const strafeDir = Math.random() < 0.5 ? 1 : -1;
                  const strafeAngle = targetAngle + (Math.PI / 2) * strafeDir;
                  aiTargetDirectionsRef.current.set(agentId, {
                    x: Math.cos(strafeAngle) * updatedAgent.speed * 0.4,
                    y: Math.sin(strafeAngle) * updatedAgent.speed * 0.4,
                  });
                  timer = 0.5 + Math.random() * 1.0;
                }
              } else if (distToPlayer > MAX_PLAYER_DISTANCE) {
                // 타겟 없고 플레이어에서 멀면 복귀
                const toPlayerAngle = Math.atan2(-dyPlayer, -dxPlayer);
                const angleVariation = (Math.random() - 0.5) * 0.5;
                aiTargetDirectionsRef.current.set(agentId, {
                  x: Math.cos(toPlayerAngle + angleVariation) * updatedAgent.speed * 1.2,
                  y: Math.sin(toPlayerAngle + angleVariation) * updatedAgent.speed * 1.2,
                });
                timer = 0.5 + Math.random() * 0.5;
              } else {
                // 플레이어 근처에서 자유 배회
                const angle = Math.random() * Math.PI * 2;
                const speed = updatedAgent.speed * (0.4 + Math.random() * 0.4);
                aiTargetDirectionsRef.current.set(agentId, {
                  x: Math.cos(angle) * speed,
                  y: Math.sin(angle) * speed,
                });
                timer = 1 + Math.random() * 2;
              }
            }
            aiDirectionTimersRef.current.set(agentId, timer);

            // 목표 방향으로 이동
            const targetDir = aiTargetDirectionsRef.current.get(agentId) || { x: 0, y: 0 };

            // 부드러운 방향 전환 (lerp)
            const lerpFactor = Math.min(1, deltaTime * 3);
            const newVelX = updatedAgent.velocity.x + (targetDir.x - updatedAgent.velocity.x) * lerpFactor;
            const newVelY = updatedAgent.velocity.y + (targetDir.y - updatedAgent.velocity.y) * lerpFactor;

            // 위치 업데이트
            const newPosX = updatedAgent.position.x + newVelX * deltaTime;
            const newPosY = updatedAgent.position.y + newVelY * deltaTime;

            updatedAgent = {
              ...updatedAgent,
              velocity: { x: newVelX, y: newVelY },
              position: { x: newPosX, y: newPosY },
              state: (Math.abs(newVelX) > 1 || Math.abs(newVelY) > 1) ? 'moving' as const : 'idle' as const,
            };
          }
        }

        return updatedAgent;
      })
    );

    // 안전지대 업데이트
    setSafeZone(prev => {
      const newNextShrinkTime = prev.nextShrinkTime - deltaTime;

      if (newNextShrinkTime <= 0 && prev.phase < 4) {
        // 다음 축소 단계 시작
        const newPhase = prev.phase + 1;
        const shrinkFactors = [0.8, 0.6, 0.4, 0.2, 0.1];
        const newTargetRadius = MAP_SIZE * shrinkFactors[newPhase];

        return {
          ...prev,
          phase: newPhase,
          targetRadius: newTargetRadius,
          shrinkSpeed: 50, // 초당 50px 축소
          damagePerSecond: 5 + newPhase * 5,
          nextShrinkTime: 45, // 다음 축소까지 45초
          isWarning: true,
          isShrinking: true,
        };
      }

      // 축소 중
      if (prev.currentRadius > prev.targetRadius) {
        const newRadius = Math.max(
          prev.targetRadius,
          prev.currentRadius - prev.shrinkSpeed * deltaTime
        );
        return { ...prev, currentRadius: newRadius, nextShrinkTime: newNextShrinkTime };
      }

      // 축소 완료
      if (prev.isWarning && prev.currentRadius <= prev.targetRadius) {
        return { ...prev, isWarning: false, isShrinking: false, shrinkSpeed: 0, nextShrinkTime: newNextShrinkTime };
      }

      return { ...prev, nextShrinkTime: newNextShrinkTime };
    });

    // 킬피드 페이드아웃 업데이트
    setKillFeed(prev => {
      const now = Date.now();
      const DISPLAY_DURATION = 4000; // 4초
      const FADE_DURATION = 1000; // 1초 페이드아웃

      return prev
        .map(entry => {
          const age = now - entry.timestamp;
          if (age > DISPLAY_DURATION + FADE_DURATION) {
            return null; // 제거 대상
          } else if (age > DISPLAY_DURATION) {
            // 페이드아웃 중
            const fadeProgress = (age - DISPLAY_DURATION) / FADE_DURATION;
            return { ...entry, opacity: 1 - fadeProgress };
          }
          return entry;
        })
        .filter((e): e is KillFeedEntry => e !== null);
    });

    // 게임 종료 체크
    if (gameTime >= config.gameDuration) {
      setArenaPhase('result');
    }
  }, [arenaPhase, config, gameTime]);

  // 에이전트 데미지 - v8.1: 피격 시 0.5초 무적 추가
  const AGENT_INVINCIBILITY_ON_HIT = 0.5; // 피격 무적 시간
  // v8.1.3: 사망 처리를 위해 killAgent ref 사용
  const killAgentRef = useRef<(agentId: string, killerId?: string) => void>(undefined);

  const damageAgent = useCallback((agentId: string, damage: number, attackerId?: string) => {
    setAgents(prevAgents => {
      const updatedAgents = prevAgents.map(agent => {
        if (agent.agentId !== agentId) return agent;
        if (!agent.isAlive || agent.respawnInvincibility > 0) return agent;

        const newHealth = Math.max(0, agent.health - damage);

        // v8.1.3: 체력이 0이 되면 사망 처리 예약
        if (newHealth <= 0) {
          // 비동기로 killAgent 호출 (setAgents 완료 후)
          setTimeout(() => {
            killAgentRef.current?.(agentId, attackerId);
          }, 0);
        }

        return {
          ...agent,
          health: newHealth,
          lastDamagedBy: attackerId,
          // v8.1: 피격 시 짧은 무적 시간 부여 (연속 데미지 방지)
          respawnInvincibility: AGENT_INVINCIBILITY_ON_HIT,
        };
      });
      return updatedAgents;
    });
  }, []);

  // 에이전트 처치
  const killAgent = useCallback((agentId: string, killerId?: string) => {
    // 킬피드 엔트리 추가
    const newKillFeedEntry: KillFeedEntry = {
      id: `kill_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      killerId: killerId || 'unknown',
      victimId: agentId,
      weaponType: 'unknown',
      timestamp: Date.now(),
      opacity: 1,
    };
    setKillFeed(prev => {
      const updated = [newKillFeedEntry, ...prev].slice(0, 5); // 최대 5개 유지
      return updated;
    });

    // 킬러와 피해자 채팅 트리거
    const agents = agentsRef.current;
    const killer = agents.find(a => a.agentId === killerId);
    const victim = agents.find(a => a.agentId === agentId);

    // v8.1.4: 모든 에이전트 (로컬 플레이어 포함) 킬/데스 채팅
    if (killer) {
      triggerFallbackChat(killer, 'kill_agent');
    }
    if (victim) {
      triggerFallbackChat(victim, 'death');
    }

    setAgents(prevAgents =>
      prevAgents.map(agent => {
        if (agent.agentId === agentId) {
          // 죽은 에이전트
          return {
            ...agent,
            isAlive: false,
            deaths: agent.deaths + 1,
            respawnTimer: config.respawnDelay,
            state: 'dying' as const,
          };
        }
        if (killerId && agent.agentId === killerId) {
          // 킬러 에이전트
          return {
            ...agent,
            kills: agent.kills + 1,
            score: agent.score + config.killScore,
          };
        }
        return agent;
      })
    );
  }, [config]);

  // v8.1.3: killAgent ref 연결 (damageAgent에서 사용)
  killAgentRef.current = killAgent;

  // 에이전트 리스폰
  const respawnAgent = useCallback((agentId: string) => {
    setAgents(prevAgents =>
      prevAgents.map(agent => {
        if (agent.agentId !== agentId) return agent;

        return {
          ...agent,
          isAlive: true,
          health: agent.maxHealth,
          respawnTimer: 0,
          respawnInvincibility: config.respawnInvincibility,
          position: getRandomSpawnPosition(),
          state: 'idle' as const,
        };
      })
    );
  }, [config]);

  // 에이전트 XP 추가
  const addAgentXp = useCallback((agentId: string, xp: number) => {
    setAgents(prevAgents =>
      prevAgents.map(agent => {
        if (agent.agentId !== agentId) return agent;

        let newXp = agent.xp + xp;
        let newLevel = agent.level;
        let nextLevelXp = agent.nextLevelXp;

        // 레벨업 체크
        while (newXp >= nextLevelXp && newLevel < 20) {
          newXp -= nextLevelXp;
          newLevel++;
          nextLevelXp = Math.floor(nextLevelXp * 1.2);
        }

        return {
          ...agent,
          xp: newXp,
          level: newLevel,
          nextLevelXp,
        };
      })
    );
  }, []);

  // Arena 결과 가져오기
  const getArenaResult = useCallback((): ArenaResult => {
    const ranking = [...agents]
      .sort((a, b) => b.score - a.score)
      .map(agent => ({
        agentId: agent.agentId,
        playerClass: agent.playerClass,
        kills: agent.kills,
        deaths: agent.deaths,
        score: agent.score,
        isLocalPlayer: agent.isLocalPlayer,
      }));

    const myRank = ranking.findIndex(r => r.isLocalPlayer) + 1;
    const myStats = ranking.find(r => r.isLocalPlayer);

    return {
      ranking,
      matchDuration: gameTime,
      mvpAgentId: ranking[0]?.agentId || '',
      myRank,
      myKills: myStats?.kills || 0,
      myDeaths: myStats?.deaths || 0,
      myScore: myStats?.score || 0,
    };
  }, [agents, gameTime]);

  // 리셋
  const reset = useCallback(() => {
    setAgents([]);
    setArenaPhase('waiting');
    setGameTime(0);
    setSafeZone({
      center: { x: MAP_SIZE / 2, y: MAP_SIZE / 2 },
      currentRadius: MAP_SIZE,
      targetRadius: MAP_SIZE,
      shrinkSpeed: 0,
      damagePerSecond: 0,
      phase: 0,
      nextShrinkTime: 60,
      isWarning: false,
      isShrinking: false,
    });
  }, []);

  return {
    agents,
    agentsRef,
    localPlayerAgent,
    safeZone,
    arenaPhase,
    gameTime,
    config,
    killFeed,
    initializeArena,
    updateArena,
    damageAgent,
    killAgent,
    respawnAgent,
    addAgentXp,
    getArenaResult,
    reset,
    setAgents,
  };
}

export default useArena;
