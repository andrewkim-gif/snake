/**
 * combat.ts - 전투 시스템
 * 데미지 처리, 히트 이펙트, 적 처치 로직
 */

import React from 'react';
import { Enemy, Player, Vector2, WeaponType, Gem, Pickup, PickupType, EnemyType, StatusEffect, CriticalEffect, Particle } from '../types';
import { ENEMY_TYPES, GAME_CONFIG } from '../constants';
// STAGE_CONFIGS removed for Arena mode
import { angleBetween, randomRange } from '../utils/math';
import { soundManager } from '../utils/audio';
import { ExtendedParticle } from './game-context';
import { isoKnockback, ISO_Y_SCALE } from '../isometric';

// 크리티컬 히트 텍스트 배열 (마블 카툰 스타일)
const CRITICAL_TEXTS = ['펑!', '쾅!', '퍽!', '팍!', '쿵!', '빵!', '탕!', '땅!'];

// 무기별 크리티컬 이펙트 색상
const CRITICAL_COLORS: Partial<Record<WeaponType | 'bomb' | 'special', string>> & Record<string, string> = {
  whip: '#a855f7',      // 보라
  wand: '#3b82f6',      // 파랑
  knife: '#facc15',     // 노랑
  axe: '#94a3b8',       // 회색
  punch: '#ef4444',     // 빨강
  sword: '#60a5fa',     // 하늘
  bow: '#10b981',       // 초록
  bible: '#f472b6',     // 분홍
  garlic: '#22c55e',    // 연두
  pool: '#06b6d4',      // 시안
  lightning: '#fbbf24', // 골드
  beam: '#ef4444',      // 빨강
  phishing: '#a855f7',  // 보라
  stablecoin: '#22c55e',// 초록
  bridge: '#6366f1',    // 인디고
  aggregator: '#ec4899',// 핑크
  oracle: '#f59e0b',    // 주황
  ping: '#22d3ee',      // 시안
  shard: '#8b5cf6',     // 보라
  airdrop: '#f97316',   // 주황
  fork: '#06b6d4',      // 시안
  genesis: '#eab308',   // 골드
  gold_reward: '#facc15',// 노랑
  focus: '#f472b6',     // 핑크
  bomb: '#ef4444',      // 빨강
  special: '#ffffff',   // 흰색
};

/**
 * 크리티컬 판정 - 확률 기반
 * @param player 플레이어 (criticalChance 참조)
 * @returns 크리티컬 여부
 */
export const rollCritical = (player: Player): boolean => {
  // 기본 확률 + 레벨 보너스 + 운(oracle) 보너스 + 집중력(focus) 보너스
  const baseCrit = player.criticalChance; // 기본 5%
  const levelBonus = (player.level - 1) * 0.005; // 레벨당 0.5%
  const luckBonus = (player.weapons.oracle?.amount || 0) / 1000; // oracle당 0.1%
  const focusBonus = (player.weapons.focus?.amount || 0) / 1000; // focus당 0.1% (레벨 1: 2%, 최대: 25%)

  const totalCrit = Math.min(0.5, baseCrit + levelBonus + luckBonus + focusBonus); // 최대 50%
  return Math.random() < totalCrit;
};

/**
 * 크리티컬 이펙트 생성 - 마블 카툰 스타일 텍스트
 */
export const createCriticalEffect = (
  criticalEffectsRef: React.MutableRefObject<CriticalEffect[]>,
  pos: Vector2,
  weaponType: WeaponType | 'bomb' | 'special'
): void => {
  const MAX_CRITICAL_EFFECTS = 20;
  if (criticalEffectsRef.current.length >= MAX_CRITICAL_EFFECTS) return;

  const text = CRITICAL_TEXTS[Math.floor(Math.random() * CRITICAL_TEXTS.length)];
  const color = CRITICAL_COLORS[weaponType] || '#ffffff';

  criticalEffectsRef.current.push({
    id: Math.random().toString(),
    position: {
      x: pos.x + randomRange(-20, 20),
      y: pos.y - 30 + randomRange(-10, 10)
    },
    text,
    color,
    life: 0.6,
    maxLife: 0.6,
    scale: 0,        // 0에서 시작해서 팝업
    rotation: randomRange(-15, 15), // 랜덤 기울기
  });
};

/**
 * 상태이상 업데이트 - 매 프레임 호출
 * 독/화상 틱 데미지, 동결 해제 등 처리
 */
export const updateStatusEffects = (
  enemies: Enemy[],
  deltaTime: number,
  damageNumbers: React.MutableRefObject<any[]>
): void => {
  for (let ei = 0; ei < enemies.length; ei++) {
    const enemy = enemies[ei];
    if (!enemy.statusEffects || enemy.statusEffects.length === 0) continue;
    if (enemy.state === 'dying') continue;

    // 상태이상 역순 순회 (제거 시 인덱스 문제 방지)
    for (let si = enemy.statusEffects.length - 1; si >= 0; si--) {
      const effect = enemy.statusEffects[si];
      effect.duration -= deltaTime;

      // 독/화상 틱 데미지
      if ((effect.type === 'poison' || effect.type === 'burning') && effect.damage) {
        const tickInterval = effect.tickInterval || 0.5;
        effect.tickTimer = (effect.tickTimer || 0) + deltaTime;

        if (effect.tickTimer >= tickInterval) {
          effect.tickTimer -= tickInterval;

          // 틱 데미지 적용
          enemy.health -= effect.damage;

          // 데미지 넘버 표시 (독/화상 색상)
          if (damageNumbers.current.length < (GAME_CONFIG.MAX_DAMAGE_NUMBERS || 50)) {
            damageNumbers.current.push({
              id: Math.random().toString(),
              value: effect.damage,
              position: { ...enemy.position },
              velocity: { x: randomRange(-20, 20), y: -60 },
              life: 0.6,
              maxLife: 0.6,
              color: effect.type === 'poison' ? '#22c55e' : '#f97316', // 녹색/주황
            });
          }

          // 적 사망 처리 (health가 0 이하)
          if (enemy.health <= 0 && enemy.state !== 'dying') {
            enemy.state = 'dying';
            enemy.stunTimer = 0.3; // dying 애니메이션 시간
          }
        }
      }

      // 동결 효과 - isFrozen 상태 유지/해제
      if (effect.type === 'freeze') {
        enemy.isFrozen = true;
        // stunTimer는 projectile.ts에서 이미 설정됨
      }

      // 만료된 효과 제거
      if (effect.duration <= 0) {
        // 동결 해제 시 isFrozen 플래그도 해제
        if (effect.type === 'freeze') {
          // 다른 freeze 효과가 있는지 확인
          const hasOtherFreeze = enemy.statusEffects.some(
            (e, idx) => idx !== si && e.type === 'freeze' && e.duration > 0
          );
          if (!hasOtherFreeze) {
            enemy.isFrozen = false;
          }
        }
        enemy.statusEffects.splice(si, 1);
      }
    }
  }
};

/**
 * 히트 이펙트 생성에 필요한 refs
 */
export interface HitEffectRefs {
  particles: React.MutableRefObject<ExtendedParticle[]>;
}

/**
 * 데미지 처리에 필요한 refs와 콜백
 */
export interface DamageEnemyContext {
  player: React.MutableRefObject<Player>;
  gems: React.MutableRefObject<Gem[]>;
  criticalEffects: React.MutableRefObject<CriticalEffect[]>;
  pickups: React.MutableRefObject<Pickup[]>;
  particles: React.MutableRefObject<ExtendedParticle[]>;
  damageNumbers: React.MutableRefObject<any[]>;
  lastHitSfx: React.MutableRefObject<number>;
  lastReportedScore: React.MutableRefObject<number>;
  stageId: number;
  gameTime?: React.MutableRefObject<number>;  // 특이점 드랍률 계산용
  onScoreUpdate: (score: number) => void;
  onBossDefeated: () => void;
  // 특이점 모드 킬 카운트 콜백
  onSingularityKill?: () => void;
  // 튜토리얼 킬 카운트 콜백
  onTutorialKill?: () => void;
  // v3 시스템: 킬 이벤트 콜백 (콤보, 쉬는시간 게이지 등)
  onV3Kill?: () => void;
  // v3 시스템: 데미지 배율 (콤보 보너스)
  v3DamageMultiplier?: number;
  // v7.15: 엘리트 몬스터 사망 콜백
  onEliteDeath?: (enemy: Enemy) => void;
  // v7.15: 일반 킬 카운트 콜백 (엘리트 스폰 체크용)
  onKillCount?: () => void;
}

/**
 * 히트 이펙트 생성 - 도파민 컨셉: 화려하고 강렬한 타격감
 */
export const createHitEffect = (
  particlesRef: React.MutableRefObject<ExtendedParticle[]>,
  pos: Vector2,
  weaponType: WeaponType | 'bomb' | 'special',
  isUltimate: boolean,
  enemyColor?: string  // 적 색상 전달 (선택)
): void => {
  let color = '#ffffff';
  let debrisType: 'square' | 'text' | 'line' | 'ring' | 'smoke' = 'square';
  let text = '';
  let intensity = 1.0;  // 타격 강도

  switch (weaponType) {
    case 'whip':
      color = '#a855f7';
      debrisType = 'text';
      text = Math.random() > 0.5 ? '1' : '0';
      intensity = 1.2;
      break;
    case 'wand':
      color = '#3b82f6';
      intensity = 1.1;
      break;
    case 'knife':
      color = '#facc15';
      intensity = 1.1;
      break;
    case 'axe':
      color = '#94a3b8';
      intensity = 1.4;
      break;
    case 'punch':
      color = '#ef4444';
      intensity = 1.5;
      break;
    // 원거리 무기들
    case 'bow':
      color = '#10b981';
      intensity = 1.2;
      break;
    case 'crossbow':
      color = '#f97316';
      intensity = 1.3;
      break;
    case 'ping':
      color = '#22d3ee';
      debrisType = 'ring';
      intensity = 1.4;
      break;
    case 'lightning':
      color = '#fbbf24';
      intensity = 1.5;
      break;
    case 'beam':
      color = '#ef4444';
      intensity = 1.2;
      break;
    case 'laser':
      color = '#f43f5e';
      intensity = 1.4;
      break;
    // 특수 무기들
    case 'bible':
      color = '#f472b6';
      intensity = 1.0;
      break;
    case 'garlic':
      color = '#22c55e';
      intensity = 0.8;
      break;
    case 'pool':
      color = '#06b6d4';
      intensity = 0.9;
      break;
    case 'phishing':
      color = '#a855f7';
      intensity = 1.1;
      break;
    case 'stablecoin':
      color = '#22c55e';
      intensity = 1.0;
      break;
    case 'bridge':
      color = '#6366f1';
      intensity = 1.2;
      break;
    case 'aggregator':
      color = '#f59e0b';
      intensity = 1.1;
      break;
    case 'bomb':
      color = '#f97316';
      debrisType = 'ring';
      intensity = 2.0;
      break;
    case 'special':
      color = '#22d3ee';
      debrisType = 'ring';
      intensity = 1.8;
      break;
    default:
      // 미등록 무기도 기본 이펙트 생성
      color = '#ffffff';
      intensity = 1.0;
      break;
  }

  if (isUltimate) {
    color = '#ffffff';
    intensity = 2.5;
  }

  // 스킬별 타격 사운드 재생 - 도파민 폭발!
  soundManager.playHitSFX(weaponType, isUltimate);

  // 1. 외부 충격파 링 (큰 범위)
  particlesRef.current.push({
    position: { ...pos },
    velocity: { x: 0, y: 0 },
    radius: isUltimate ? 60 : 35 * intensity,
    color: color,
    life: 0.2,
    maxLife: 0.2,
    type: 'ring',
    width: isUltimate ? 5 : 3,
  });

  // 2. 내부 밝은 링 (빠르게 퍼짐)
  if (particlesRef.current.length < 300) {
    particlesRef.current.push({
      position: { ...pos },
      velocity: { x: 0, y: 0 },
      radius: isUltimate ? 30 : 18 * intensity,
      color: '#ffffff',
      life: 0.12,
      maxLife: 0.12,
      type: 'ring',
      width: 2,
    });
  }

  // 3. 타격 플래시 (순간 밝은 원)
  if (particlesRef.current.length < 300) {
    particlesRef.current.push({
      position: { ...pos },
      velocity: { x: 0, y: 0 },
      radius: isUltimate ? 20 : 12 * intensity,
      color: '#ffffff',
      life: 0.08,
      maxLife: 0.08,
      type: 'smoke',  // 원형으로 페이드
    });
  }

  // 4. 적 색상 파편 (적이 터지는 느낌)
  if (particlesRef.current.length < 300 && enemyColor) {
    const enemyDebrisCount = isUltimate ? 8 : 4;
    for (let i = 0; i < enemyDebrisCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(100, 250) * intensity;
      particlesRef.current.push({
        position: { ...pos },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
        radius: randomRange(4, 9),
        color: enemyColor,
        life: randomRange(0.3, 0.6),
        maxLife: 0.6,
        type: 'square',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: randomRange(-12, 12),
      });
    }
  }

  // 5. 메인 타격 파편 (무기 색상)
  if (particlesRef.current.length < 300) {
    const count = isUltimate ? 14 : Math.floor(7 * intensity);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(120, 280) * intensity;
      particlesRef.current.push({
        position: { ...pos },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
        radius: randomRange(3, 8),
        color: Math.random() > 0.3 ? color : '#ffffff',
        life: randomRange(0.25, 0.55),
        maxLife: 0.55,
        type: debrisType,
        text: text,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: randomRange(-10, 10),
      });
    }
  }

  // 6. 스파크 라인 (직선 파편)
  if (particlesRef.current.length < 300 && intensity > 1.0) {
    const sparkCount = Math.floor(4 * intensity);
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2 + Math.random() * 0.3;
      const speed = randomRange(200, 400);
      particlesRef.current.push({
        position: { ...pos },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
        radius: randomRange(8, 15),
        color: '#ffffff',
        life: 0.15,
        maxLife: 0.15,
        type: 'line',
        rotation: angle,
        rotSpeed: 0,
      });
    }
  }
};

/**
 * 몬스터별 특화 히트 이펙트 설정 - 개성있는 터지는 맛!
 * 각 몬스터의 특성에 맞는 고유한 파괴 효과
 */
interface MonsterHitConfig {
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor?: string;
  // 터지는 스타일 (핵심!)
  burstStyle: 'data' | 'pixel' | 'slime' | 'spark' | 'smoke' | 'shatter' | 'electric' | 'gold' | 'code' | 'debug' | 'api' | 'git';
  text?: string;
  baseSize: number;        // 몬스터 크기 비례 기준 (0.5~1.5)
  debrisCount: number;     // 파편 수
  ringCount: number;       // 충격파 개수
}

const getMonsterHitConfig = (enemyType: EnemyType): MonsterHitConfig => {
  switch (enemyType) {
    // === Era 1: Genesis (Awakening) - 가볍고 귀여운 효과 ===
    case 'bitling':
      // 비트봇: 0과 1로만 구성된 최소 AI 단위
      return { primaryColor: '#00ff41', secondaryColor: '#00cc33', tertiaryColor: '#009922', burstStyle: 'code', text: '01', baseSize: 0.5, debrisCount: 6, ringCount: 1 };
    case 'pixel':
      // 픽셀러: 저해상도 불완전 AI
      return { primaryColor: '#4ade80', secondaryColor: '#86efac', tertiaryColor: '#bbf7d0', burstStyle: 'pixel', baseSize: 0.6, debrisCount: 8, ringCount: 1 };
    case 'bug':
      // 크롤러: 웹 크롤러, 느리게 기어옴
      return { primaryColor: '#a3e635', secondaryColor: '#d9f99d', tertiaryColor: '#ecfccb', burstStyle: 'debug', text: 'BUG', baseSize: 0.65, debrisCount: 10, ringCount: 1 };

    // === Era 2: Infection (Spread) - 확산하는 AI ===
    case 'worm':
      // 웜: 자가복제 웜 바이러스
      return { primaryColor: '#84cc16', secondaryColor: '#bef264', tertiaryColor: '#d9f99d', burstStyle: 'slime', baseSize: 0.7, debrisCount: 10, ringCount: 1 };
    case 'spammer':
      // 엘리트 스패머: 무차별 공격 AI
      return { primaryColor: '#fb923c', secondaryColor: '#fdba74', tertiaryColor: '#fed7aa', burstStyle: 'api', text: 'SPAM', baseSize: 0.65, debrisCount: 12, ringCount: 2 };
    case 'adware':
      // 애드웨어: 달라붙어 이동 방해
      return { primaryColor: '#f472b6', secondaryColor: '#f9a8d4', tertiaryColor: '#fbcfe8', burstStyle: 'gold', text: 'AD', baseSize: 0.7, debrisCount: 12, ringCount: 2 };

    // === Era 3: Mutation (Evolution) - 변이 AI ===
    case 'crypter':
      // 크립터: 숨어서 매복 기습
      return { primaryColor: '#a78bfa', secondaryColor: '#c4b5fd', tertiaryColor: '#ddd6fe', burstStyle: 'data', text: '###', baseSize: 0.75, debrisCount: 14, ringCount: 2 };
    case 'mutant':
      // 뮤턴트: 팔 4개로 변이된 AI
      return { primaryColor: '#34d399', secondaryColor: '#6ee7b7', tertiaryColor: '#a7f3d0', burstStyle: 'smoke', baseSize: 0.85, debrisCount: 16, ringCount: 2 };
    case 'polymorphic':
      // 폴리모픽: 계속 형태가 변하는 AI
      return { primaryColor: '#f472b6', secondaryColor: '#e879f9', tertiaryColor: '#d946ef', burstStyle: 'slime', baseSize: 0.8, debrisCount: 16, ringCount: 2 };

    // === Era 4: Pandemic (Domination) - AI 지배 ===
    case 'ransomer':
      // 랜섬웨어: 잡아서 데이터 요구
      return { primaryColor: '#f43f5e', secondaryColor: '#fb7185', tertiaryColor: '#fda4af', burstStyle: 'debug', text: 'ERR', baseSize: 0.85, debrisCount: 18, ringCount: 2 };
    case 'trojan':
      // 트로이: 인간으로 위장 후 돌변
      return { primaryColor: '#f59e0b', secondaryColor: '#fbbf24', tertiaryColor: '#fcd34d', burstStyle: 'shatter', baseSize: 0.95, debrisCount: 20, ringCount: 3 };
    case 'botnet':
      // 봇넷: 집단으로 움직이는 AI 군단
      return { primaryColor: '#64748b', secondaryColor: '#94a3b8', tertiaryColor: '#cbd5e1', burstStyle: 'electric', baseSize: 1.0, debrisCount: 18, ringCount: 3 };

    // === Era 5: Apocalypse (Judgement) - AI 심판 ===
    case 'rootkit':
      // 루트킷: 시스템 깊숙이 잠복
      return { primaryColor: '#1e293b', secondaryColor: '#475569', tertiaryColor: '#64748b', burstStyle: 'code', text: 'ROOT', baseSize: 1.1, debrisCount: 22, ringCount: 3 };
    case 'apt':
      // APT: 고급 추적 능력을 가진 AI
      return { primaryColor: '#dc2626', secondaryColor: '#ef4444', tertiaryColor: '#f87171', burstStyle: 'electric', baseSize: 1.15, debrisCount: 24, ringCount: 3 };

    // === Era 6: Singularity - 최종 ===
    case 'zeroday':
      // 제로데이: AI 최종 진화, 극도로 위험
      return { primaryColor: '#450a0a', secondaryColor: '#7f1d1d', tertiaryColor: '#dc2626', burstStyle: 'debug', text: '0DAY', baseSize: 1.25, debrisCount: 28, ringCount: 4 };
    case 'skynet':
      // 스카이넷: 거대 AI 코어, 압도적 파괴력
      return { primaryColor: '#fcd34d', secondaryColor: '#fef08a', tertiaryColor: '#fef9c3', burstStyle: 'electric', text: 'AI', baseSize: 1.5, debrisCount: 32, ringCount: 4 };

    // === 기본 적 (일반 스테이지) ===
    case 'glitch':
      // 버그봇: 초기 AI, 버그 많고 불안정
      return { primaryColor: '#a855f7', secondaryColor: '#c084fc', tertiaryColor: '#d8b4fe', burstStyle: 'debug', text: 'BUG', baseSize: 0.7, debrisCount: 8, ringCount: 1 };
    case 'bot':
      // 챗봇: 양산형 AI 어시스턴트
      return { primaryColor: '#3b82f6', secondaryColor: '#60a5fa', tertiaryColor: '#93c5fd', burstStyle: 'api', text: '200', baseSize: 0.8, debrisCount: 10, ringCount: 1 };
    case 'malware':
      // 맬웨어: 공격적 바이러스 AI, 빠르고 흉폭
      return { primaryColor: '#ef4444', secondaryColor: '#f87171', tertiaryColor: '#fca5a5', burstStyle: 'spark', baseSize: 0.85, debrisCount: 12, ringCount: 2 };
    case 'whale':
      // 슈퍼컴퓨터: 거대 AI 서버, 느리지만 강력
      return { primaryColor: '#06b6d4', secondaryColor: '#22d3ee', tertiaryColor: '#67e8f9', burstStyle: 'data', text: 'GPU', baseSize: 1.4, debrisCount: 20, ringCount: 3 };

    // === 원거리 적 ===
    case 'sniper':
      // 스패머: 스팸메일 무차별 발사
      return { primaryColor: '#84cc16', secondaryColor: '#a3e635', tertiaryColor: '#bef264', burstStyle: 'api', text: '404', baseSize: 0.75, debrisCount: 10, ringCount: 1 };
    case 'caster':
      // 피싱봇: 타겟에게 피싱 링크 발사
      return { primaryColor: '#a855f7', secondaryColor: '#c084fc', tertiaryColor: '#d8b4fe', burstStyle: 'git', text: 'HOOK', baseSize: 0.8, debrisCount: 14, ringCount: 2 };
    case 'artillery':
      // DDoS봇: 대량 트래픽 폭격 수행
      return { primaryColor: '#f97316', secondaryColor: '#fb923c', tertiaryColor: '#fdba74', burstStyle: 'shatter', text: 'DDoS', baseSize: 1.0, debrisCount: 18, ringCount: 3 };

    default:
      return { primaryColor: '#00ff41', secondaryColor: '#00cc33', burstStyle: 'code', baseSize: 0.7, debrisCount: 8, ringCount: 1 };
  }
};

/**
 * 무기 이펙트 카테고리 - CODE SURVIVOR 테마별 분류
 * Matrix + Developer Tools 컨셉
 */
type WeaponEffectCategory = 'code' | 'api' | 'git' | 'debug' | 'electric' | 'data' | 'gold' | 'fire' | 'cyber' | 'bio' | 'shield' | 'special';

const getWeaponEffectCategory = (weaponType: WeaponType | 'bomb' | 'special'): WeaponEffectCategory => {
  switch (weaponType) {
    // 코드 계열: Matrix 녹색 코드, const/function 파편
    case 'whip':  // Hand Coding
      return 'code';
    // API 계열: JSON 브래킷, HTTP 상태 코드
    case 'wand':  // API Call
    case 'ping':  // Ping Packet
      return 'api';
    // Git 계열: 커밋, 브랜치, diff 기호
    case 'knife':  // Git Push
    case 'fork':   // Git Fork
      return 'git';
    // 디버그 계열: ERROR, BUG, 라인 번호
    case 'garlic':  // Debug Aura
    case 'beam':    // Stack Trace
      return 'debug';
    // 전기 계열: AI 번개, 시안 스파크
    case 'lightning':  // Claude Assist
    case 'laser':      // Recursive Loop
      return 'electric';
    // 데이터 계열: 01 문자, 글리치
    case 'shard':   // Code Snippet
    case 'bridge':  // Async/Await
      return 'data';
    // 골드 계열: 크레딧, 동전
    case 'aggregator':  // Auto Import
    case 'oracle':      // Code Review
      return 'gold';
    // 화염 계열: 방화벽, 폭발
    case 'pool':   // Firewall Zone
    case 'axe':    // Server Throw
    case 'punch':  // Keyboard Punch
    case 'bomb':
      return 'fire';
    // 사이버 계열: GraphQL
    case 'bow':    // GraphQL
    case 'crossbow':
      return 'cyber';
    // 바이오 계열: NPM 패키지
    case 'airdrop':  // NPM Install
      return 'bio';
    // 쉴드 계열: 문서, 타입
    case 'bible':       // Documentation
    case 'stablecoin':  // Type Safety
      return 'shield';
    // 특수 계열: MCP, System Crash
    case 'phishing':  // MCP Server
    case 'genesis':   // System Crash
    case 'focus':     // Deep Work
    case 'special':
    default:
      return 'special';
  }
};

/**
 * 무기 카테고리별 추가 이펙트 생성
 * 몬스터의 기본 burstStyle 위에 무기 테마 이펙트 추가
 *
 * @param hitAngle - 피격 방향 (공격 소스 → 적 방향). 파편은 이 방향으로 튀어나감!
 */
const createWeaponCategoryEffect = (
  particlesRef: React.MutableRefObject<ExtendedParticle[]>,
  pos: Vector2,
  category: WeaponEffectCategory,
  size: number,
  burstPower: number,
  hitAngle: number = 0  // 피격 방향각 (라디안)
): void => {
  // 피격 방향 기준 파편 분산 각도 (좁은 콘 형태로 튀어나감)
  const spreadAngle = Math.PI / 3;  // 60도 범위
  const getDirectionalAngle = () => hitAngle + randomRange(-spreadAngle / 2, spreadAngle / 2);
  switch (category) {
    // =========================================
    // CODE SURVIVOR 신규 카테고리
    // =========================================

    // 코드 계열: Matrix 녹색 코드 (Hand Coding)
    case 'code': {
      const codeChars = ['const', 'let', 'fn', '=>', '{}', '();', 'if', '++'];
      // 코드 문자 파편
      for (let i = 0; i < 6; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(150, 320) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE - 25 },
          radius: randomRange(10, 16) * size,
          color: '#00ff41', // Matrix green
          life: randomRange(0.5, 0.9),
          maxLife: 0.9,
          type: 'text',
          text: codeChars[Math.floor(Math.random() * codeChars.length)],
          rotation: randomRange(-0.3, 0.3),
          rotSpeed: randomRange(-5, 5),
        });
      }
      // 녹색 글리치 라인
      for (let i = 0; i < 4; i++) {
        const lineAngle = getDirectionalAngle();
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(lineAngle) * 280, y: Math.sin(lineAngle) * 280 },
          radius: randomRange(30, 50) * size,
          color: i === 0 ? '#ffffff' : '#00ff41',
          life: 0.15,
          maxLife: 0.15,
          type: 'line',
          rotation: lineAngle,
          rotSpeed: 0,
        });
      }
      // 세미콜론 파편
      for (let i = 0; i < 3; i++) {
        const angle = getDirectionalAngle();
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * 200, y: Math.sin(angle) * 200 - 80 },
          radius: 14 * size,
          color: '#00ff41',
          life: 0.6,
          maxLife: 0.6,
          type: 'text',
          text: ';',
          gravity: 150,
        });
      }
      break;
    }

    // API 계열: JSON 브래킷, HTTP 상태 코드 (API Call, Ping)
    case 'api': {
      const statusCodes = ['200', '404', '500', 'OK', 'ERR', 'GET'];
      // 상태 코드 텍스트
      for (let i = 0; i < 4; i++) {
        const angle = getDirectionalAngle();
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * 220, y: Math.sin(angle) * 220 - 80 },
          radius: randomRange(12, 18) * size,
          color: Math.random() > 0.3 ? '#3b82f6' : '#ef4444',
          life: 0.6,
          maxLife: 0.6,
          type: 'text',
          text: statusCodes[Math.floor(Math.random() * statusCodes.length)],
          gravity: 100,
        });
      }
      // JSON 브래킷 파편
      const brackets = ['{', '}', '[', ']', ':', '"'];
      for (let i = 0; i < 5; i++) {
        const angle = getDirectionalAngle();
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * 180, y: Math.sin(angle) * 180 },
          radius: 14 * size,
          color: '#60a5fa',
          life: 0.5,
          maxLife: 0.5,
          type: 'text',
          text: brackets[Math.floor(Math.random() * brackets.length)],
          rotation: Math.random() * Math.PI,
          rotSpeed: randomRange(-10, 10),
        });
      }
      // API 연결선 (점선 느낌)
      for (let i = 0; i < 3; i++) {
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(hitAngle) * (150 + i * 50), y: Math.sin(hitAngle) * (150 + i * 50) },
          radius: 6 * size,
          color: '#3b82f6',
          life: 0.3,
          maxLife: 0.3,
          type: 'smoke',
        });
      }
      break;
    }

    // Git 계열: 커밋, 브랜치, diff 기호 (Git Push, Git Fork)
    case 'git': {
      const gitTexts = ['commit', 'push', 'merge', '++', '--', '#'];
      // Git 텍스트 파편
      for (let i = 0; i < 5; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(180, 340) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
          radius: randomRange(10, 14) * size,
          color: Math.random() > 0.5 ? '#f97316' : '#22c55e',
          life: 0.6,
          maxLife: 0.6,
          type: 'text',
          text: gitTexts[Math.floor(Math.random() * gitTexts.length)],
          rotSpeed: randomRange(-8, 8),
        });
      }
      // 커밋 해시 파편
      const hashChars = '0123456789abcdef';
      const hash = '#' + Array(4).fill(0).map(() =>
        hashChars[Math.floor(Math.random() * 16)]).join('');
      particlesRef.current.push({
        position: { ...pos },
        velocity: { x: Math.cos(hitAngle) * 120, y: -140 },
        radius: 10 * size,
        color: '#9ca3af',
        life: 0.8,
        maxLife: 0.8,
        type: 'text',
        text: hash,
        gravity: 80,
      });
      // 브랜치 라인 (폭발)
      for (let i = 0; i < 6; i++) {
        const angle = getDirectionalAngle();
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * 250, y: Math.sin(angle) * 250 },
          radius: randomRange(25, 40) * size,
          color: '#f97316',
          life: 0.18,
          maxLife: 0.18,
          type: 'line',
          rotation: angle,
        });
      }
      break;
    }

    // 디버그 계열: ERROR, BUG, 라인 번호 (Debug Aura, Stack Trace)
    case 'debug': {
      const debugTexts = ['ERROR', 'BUG', 'NULL', 'NaN', '!!!'];
      // 에러 메시지 파편
      for (let i = 0; i < 4; i++) {
        const angle = getDirectionalAngle();
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * 220, y: Math.sin(angle) * 220 - 60 },
          radius: randomRange(12, 16) * size,
          color: '#ef4444',
          life: 0.7,
          maxLife: 0.7,
          type: 'text',
          text: debugTexts[Math.floor(Math.random() * debugTexts.length)],
        });
      }
      // 라인 번호 파편
      for (let i = 0; i < 3; i++) {
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: randomRange(-100, 100), y: -160 },
          radius: 10 * size,
          color: '#fbbf24',
          life: 0.5,
          maxLife: 0.5,
          type: 'text',
          text: ':' + Math.floor(Math.random() * 999),
          gravity: 120,
        });
      }
      // 빨간 breakpoint 점
      for (let i = 0; i < 6; i++) {
        const angle = getDirectionalAngle();
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * 150, y: Math.sin(angle) * 150 },
          radius: randomRange(5, 9) * size,
          color: '#dc2626',
          life: 0.4,
          maxLife: 0.4,
          type: 'smoke',
        });
      }
      // 콘솔 로그 링
      particlesRef.current.push({
        position: { ...pos },
        velocity: { x: 0, y: 0 },
        radius: 35 * size,
        color: '#ef4444',
        life: 0.2,
        maxLife: 0.2,
        type: 'ring',
        width: 3,
      });
      break;
    }

    // =========================================
    // 기존 카테고리 (업데이트)
    // =========================================

    // 전기 계열: 시안색 전기 스파크가 피격 방향으로 찌릿찌릿!
    case 'electric': {
      // 피격 방향으로 전기 스파크 라인
      for (let i = 0; i < 12; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(200, 450) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
          radius: randomRange(25, 50) * size,
          color: Math.random() > 0.3 ? '#00ffff' : '#ffffff',
          life: randomRange(0.1, 0.2),
          maxLife: 0.2,
          type: 'line',
          rotation: angle + randomRange(-0.3, 0.3),
          rotSpeed: randomRange(-20, 20),
        });
      }
      // 전기 지글지글 점
      for (let j = 0; j < 8; j++) {
        const jAngle = getDirectionalAngle();
        const jSpeed = randomRange(100, 200) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(jAngle) * jSpeed, y: Math.sin(jAngle) * jSpeed },
          radius: randomRange(3, 7) * size,
          color: '#00ffff',
          life: randomRange(0.15, 0.3),
          maxLife: 0.3,
          type: 'square',
          rotation: Math.random() * Math.PI,
          rotSpeed: randomRange(-40, 40),
        });
      }
      // 전기 충격 링
      particlesRef.current.push({
        position: { ...pos },
        velocity: { x: 0, y: 0 },
        radius: 30 * size,
        color: '#00ffff',
        life: 0.15,
        maxLife: 0.15,
        type: 'ring',
        width: 3,
      });
      break;
    }

    // 데이터 계열: 01 문자가 피격 방향으로 흩날림
    case 'data': {
      const dataChars = ['0', '1', '{', '}', '<', '>'];
      // 피격 방향으로 01 문자 파편
      for (let i = 0; i < 10; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(150, 350) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
          radius: randomRange(10, 16) * size,
          color: Math.random() > 0.5 ? '#a855f7' : '#00ffff',
          life: randomRange(0.35, 0.6),
          maxLife: 0.6,
          type: 'text',
          text: dataChars[Math.floor(Math.random() * dataChars.length)],
          rotation: Math.random() * Math.PI,
          rotSpeed: randomRange(-15, 15),
        });
      }
      // 글리치 사각형 (피격 방향으로)
      for (let g = 0; g < 6; g++) {
        const gAngle = getDirectionalAngle();
        const gSpeed = randomRange(120, 280) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(gAngle) * gSpeed, y: Math.sin(gAngle) * gSpeed },
          radius: randomRange(4, 8) * size,
          color: Math.random() > 0.5 ? '#00ffff' : '#ff00ff',
          life: 0.15,
          maxLife: 0.15,
          type: 'square',
          rotation: 0,
          rotSpeed: randomRange(-20, 20),
        });
      }
      break;
    }

    // 골드 계열: 동전이 피격 방향으로 파파팍!!! 튐
    case 'gold': {
      // 동전 (다이아몬드 회전하며 튀어나감)
      for (let i = 0; i < 15; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(180, 400) * burstPower;
        const upwardBoost = randomRange(80, 180);  // 위로 튀어오름
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE - upwardBoost * ISO_Y_SCALE },
          radius: randomRange(5, 10) * size,
          color: ['#facc15', '#fbbf24', '#fcd34d', '#ffffff'][Math.floor(Math.random() * 4)],
          life: randomRange(0.6, 1.0),
          maxLife: 1.0,
          type: 'square',
          rotation: Math.PI / 4,  // 다이아몬드 모양 = 동전!
          rotSpeed: randomRange(10, 25),  // 빙빙 회전
          gravity: 350,  // 떨어짐
        });
      }
      // $ 기호 (피격 방향으로)
      for (let d = 0; d < 5; d++) {
        const dAngle = getDirectionalAngle();
        const dSpeed = randomRange(100, 200) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(dAngle) * dSpeed, y: Math.sin(dAngle) * dSpeed - 60 },
          radius: randomRange(10, 14) * size,
          color: '#facc15',
          life: randomRange(0.5, 0.8),
          maxLife: 0.8,
          type: 'text',
          text: '$',
          rotation: 0,
          rotSpeed: randomRange(-8, 8),
          gravity: 200,
        });
      }
      // 황금빛 섬광
      particlesRef.current.push({
        position: { ...pos },
        velocity: { x: 0, y: 0 },
        radius: 25 * size,
        color: '#facc15',
        life: 0.12,
        maxLife: 0.12,
        type: 'smoke',
      });
      break;
    }

    // 화염 계열: 불꽃이 피격 방향으로 폭발!
    case 'fire': {
      // 불꽃 파편 (피격 방향으로)
      for (let i = 0; i < 15; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(250, 500) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE - 25 },
          radius: randomRange(8, 18) * size,
          color: ['#ef4444', '#f97316', '#fbbf24', '#ffffff'][Math.floor(Math.random() * 4)],
          life: randomRange(0.25, 0.5),
          maxLife: 0.5,
          type: 'smoke',
          gravity: -80,  // 살짝 위로 (불꽃처럼)
        });
      }
      // 폭발 충격파 링
      particlesRef.current.push({
        position: { ...pos },
        velocity: { x: 0, y: 0 },
        radius: 50 * size,
        color: '#f97316',
        life: 0.18,
        maxLife: 0.18,
        type: 'ring',
        width: 4,
      });
      // 중앙 밝은 섬광
      particlesRef.current.push({
        position: { ...pos },
        velocity: { x: 0, y: 0 },
        radius: 25 * size,
        color: '#ffffff',
        life: 0.1,
        maxLife: 0.1,
        type: 'smoke',
      });
      break;
    }

    // 사이버 계열: 레이저 슬래시가 피격 방향으로
    case 'cyber': {
      // 시안/마젠타 레이저 라인 (피격 방향 집중)
      for (let i = 0; i < 10; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(300, 550) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
          radius: randomRange(30, 55) * size,
          color: i % 2 === 0 ? '#00ffff' : '#ff00ff',
          life: randomRange(0.1, 0.18),
          maxLife: 0.18,
          type: 'line',
          rotation: angle,
          rotSpeed: 0,
        });
      }
      // 피격점 밝은 폭발
      particlesRef.current.push({
        position: { ...pos },
        velocity: { x: 0, y: 0 },
        radius: 20 * size,
        color: '#ffffff',
        life: 0.12,
        maxLife: 0.12,
        type: 'smoke',
      });
      break;
    }

    // 바이오 계열: 독성 물방울이 피격 방향으로 튐
    case 'bio': {
      // 독성 물방울 (피격 방향으로)
      for (let i = 0; i < 10; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(80, 200) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE - 40 },
          radius: randomRange(10, 20) * size,
          color: ['#22c55e', '#4ade80', '#86efac'][Math.floor(Math.random() * 3)],
          life: randomRange(0.6, 1.0),
          maxLife: 1.0,
          type: 'smoke',
          gravity: 300,  // 찐득하게 떨어짐
        });
      }
      // 바닥 독성 흔적 (피격 방향 쪽에)
      for (let p = 0; p < 4; p++) {
        const pDist = randomRange(20, 40) * size;
        particlesRef.current.push({
          position: { x: pos.x + Math.cos(hitAngle) * pDist + randomRange(-10, 10), y: pos.y + Math.sin(hitAngle) * pDist + randomRange(5, 15) },
          velocity: { x: 0, y: 0 },
          radius: randomRange(12, 22) * size,
          color: '#22c55e',
          life: 0.7,
          maxLife: 0.7,
          type: 'smoke',
        });
      }
      break;
    }

    // 쉴드 계열: 방어막 파편이 피격 방향으로
    case 'shield': {
      // 방어막 링 파편 (피격 방향으로)
      for (let i = 0; i < 8; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(120, 280) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
          radius: randomRange(12, 22) * size,
          color: ['#0ea5e9', '#38bdf8', '#7dd3fc'][Math.floor(Math.random() * 3)],
          life: randomRange(0.35, 0.6),
          maxLife: 0.6,
          type: 'ring',
          width: 2,
        });
      }
      // 방어막 섬광
      particlesRef.current.push({
        position: { ...pos },
        velocity: { x: 0, y: 0 },
        radius: 35 * size,
        color: '#38bdf8',
        life: 0.18,
        maxLife: 0.18,
        type: 'smoke',
      });
      break;
    }

    // 특수 계열: 다양한 파편이 피격 방향으로
    case 'special':
    default: {
      for (let i = 0; i < 12; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(150, 350) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
          radius: randomRange(6, 14) * size,
          color: ['#00ffff', '#ff00ff', '#facc15', '#ef4444', '#22c55e'][Math.floor(Math.random() * 5)],
          life: randomRange(0.35, 0.6),
          maxLife: 0.6,
          type: 'square',
          rotation: Math.random() * Math.PI,
          rotSpeed: randomRange(-20, 20),
        });
      }
      break;
    }
  }
};

/**
 * 몬스터별 특화 히트 이펙트 생성 - 개성있는 터지는 맛!
 * burstStyle + weaponType 조합으로 다양한 이펙트
 *
 * @param hitAngle - 피격 방향각 (소스 → 적 방향). 파편이 이 방향으로 튀어나감!
 */
// 파티클 생성 쓰로틀링 - 프레임당 과도한 생성 방지
let lastHitEffectFrame = 0;
let hitEffectsThisFrame = 0;
const MAX_HIT_EFFECTS_PER_FRAME = 8; // 프레임당 최대 8개 히트 이펙트

export const createHitEffectByEnemy = (
  particlesRef: React.MutableRefObject<ExtendedParticle[]>,
  pos: Vector2,
  enemyType: EnemyType,
  isUltimate: boolean,
  weaponType: WeaponType | 'bomb' | 'special' = 'special',
  hitAngle: number = 0  // 피격 방향각 (라디안)
): void => {
  // 프레임당 히트 이펙트 수 제한
  const currentFrame = Math.floor(performance.now() / 16); // ~60fps 기준
  if (currentFrame !== lastHitEffectFrame) {
    lastHitEffectFrame = currentFrame;
    hitEffectsThisFrame = 0;
  }
  hitEffectsThisFrame++;

  // 프레임당 MAX_HIT_EFFECTS_PER_FRAME 초과 시 간소화된 이펙트만
  const isSimplified = hitEffectsThisFrame > MAX_HIT_EFFECTS_PER_FRAME;

  // 파티클 300개 초과 시 이펙트 스킵
  if (particlesRef.current.length > 350) {
    soundManager.playHitSFX(weaponType, isUltimate);
    return;
  }

  // 스킬별 타격 사운드 재생 - 도파민 폭발!
  soundManager.playHitSFX(weaponType, isUltimate);

  const config = getMonsterHitConfig(enemyType);
  const { primaryColor, secondaryColor, tertiaryColor, burstStyle, text, baseSize, debrisCount, ringCount } = config;

  const size = isUltimate ? baseSize * 1.8 : baseSize;
  const intensity = size * 1.5;
  const burstPower = isUltimate ? 2.5 : 1.5;

  // 방향성 헬퍼: 피격 방향 기준 60도 범위 내 랜덤 각도
  const spreadAngle = Math.PI / 3;  // 60도
  const getDirectionalAngle = () => hitAngle + randomRange(-spreadAngle / 2, spreadAngle / 2);
  // 넓은 범위 (120도)
  const getWideAngle = () => hitAngle + randomRange(-Math.PI / 3, Math.PI / 3);

  // === 간소화 모드: 최소한의 이펙트만 (성능 최적화) ===
  if (isSimplified) {
    // 섬광 1개 + 링 1개만
    particlesRef.current.push({
      position: { ...pos },
      velocity: { x: 0, y: 0 },
      radius: 20 * intensity,
      color: primaryColor,
      life: 0.1,
      maxLife: 0.1,
      type: 'smoke',
    });
    particlesRef.current.push({
      position: { ...pos },
      velocity: { x: 0, y: 0 },
      radius: 35 * intensity,
      color: primaryColor,
      life: 0.15,
      maxLife: 0.15,
      type: 'ring',
      width: 2,
    });
    return; // 간소화 모드에서는 여기서 종료
  }

  // 무기 카테고리 기반 추가 이펙트 (방향성 적용!)
  const weaponCategory = getWeaponEffectCategory(weaponType);
  createWeaponCategoryEffect(particlesRef, pos, weaponCategory, size, burstPower, hitAngle);

  // ============================================
  // === 도파민 폭발 시스템 - 파팍!!! 터지는 맛! ===
  // ============================================

  // === 1. 섬광 폭발 (FLASH BURST) - 순간 눈부심! ===
  // 중앙 밝은 섬광 (크게!)
  particlesRef.current.push({
    position: { ...pos },
    velocity: { x: 0, y: 0 },
    radius: (isUltimate ? 45 : 25) * intensity,
    color: '#ffffff',
    life: 0.08,
    maxLife: 0.08,
    type: 'smoke',
  });

  // 색상 섬광 (몬스터 색상)
  particlesRef.current.push({
    position: { ...pos },
    velocity: { x: 0, y: 0 },
    radius: (isUltimate ? 35 : 20) * intensity,
    color: primaryColor,
    life: 0.1,
    maxLife: 0.1,
    type: 'smoke',
  });

  // === 2. 다중 충격파 링 (SHOCKWAVE RINGS) - 팍팍! 퍼짐! ===
  // 외부 큰 링 (빠르게 퍼짐)
  particlesRef.current.push({
    position: { ...pos },
    velocity: { x: 0, y: 0 },
    radius: (isUltimate ? 70 : 45) * intensity,
    color: primaryColor,
    life: 0.2,
    maxLife: 0.2,
    type: 'ring',
    width: isUltimate ? 5 : 3,
  });

  // 중간 링
  particlesRef.current.push({
    position: { ...pos },
    velocity: { x: 0, y: 0 },
    radius: (isUltimate ? 50 : 30) * intensity,
    color: secondaryColor,
    life: 0.15,
    maxLife: 0.15,
    type: 'ring',
    width: 3,
  });

  // 내부 밝은 링 (ringCount에 따라) - 최대 2개로 제한
  for (let r = 0; r < Math.min(ringCount, 2); r++) {
    particlesRef.current.push({
      position: { ...pos },
      velocity: { x: 0, y: 0 },
      radius: (isUltimate ? 30 : 18) * intensity * (1 - r * 0.15),
      color: r === 0 ? '#ffffff' : primaryColor,
      life: 0.1 + r * 0.025,
      maxLife: 0.15,
      type: 'ring',
      width: 2,
    });
  }

  // === 3. 방향성 스파크 (DIRECTIONAL SPARKS) - 피격 방향으로 파파팍! ===
  // 스파크 수 감소 (10 + ringCount*2 → 6 + ringCount)
  const sparkCount = Math.floor(6 + ringCount);
  for (let s = 0; s < sparkCount; s++) {
    // 대부분 피격 방향, 일부만 반대로 (70% 피격 방향)
    const angle = s < sparkCount * 0.7
      ? getDirectionalAngle()  // 피격 방향
      : hitAngle + Math.PI + randomRange(-0.5, 0.5);  // 반대 방향 (약간)
    const speed = randomRange(250, 500) * burstPower;
    particlesRef.current.push({
      position: { ...pos },
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
      radius: randomRange(20, 45) * size,
      color: Math.random() > 0.3 ? '#ffffff' : primaryColor,
      life: randomRange(0.12, 0.25),
      maxLife: 0.25,
      type: 'line',
      rotation: angle,
      rotSpeed: 0,
    });
  }

  // === 4. 피격 방향 파편 (DIRECTIONAL BURST) - 날아가는 폭발감! ===
  for (let u = 0; u < 8; u++) {
    // 피격 방향 + 위쪽 바이어스 (위로 튀어오르면서 피격 방향으로)
    const uAngle = getWideAngle() - Math.PI / 6;  // 피격 방향 + 약간 위로
    const uSpeed = randomRange(200, 400) * burstPower;
    particlesRef.current.push({
      position: { ...pos },
      velocity: { x: Math.cos(uAngle) * uSpeed, y: Math.sin(uAngle) * uSpeed - 80 },
      radius: randomRange(5, 10) * size,
      color: secondaryColor,
      life: randomRange(0.4, 0.7),
      maxLife: 0.7,
      type: 'square',
      rotation: Math.random() * Math.PI,
      rotSpeed: randomRange(-20, 20),
      gravity: 350,  // 중력으로 떨어짐
    });
  }

  // === 5. 피격 방향 반짝이 (DIRECTIONAL SPARKLES) - 피격 방향으로 반짝반짝! ===
  for (let sp = 0; sp < 10; sp++) {
    // 피격 방향 쪽에 더 많은 반짝이
    const spAngle = getWideAngle();
    const spDist = randomRange(15, 40) * size;
    const spSpeed = randomRange(80, 180);
    particlesRef.current.push({
      position: { x: pos.x + Math.cos(spAngle) * spDist * 0.3, y: pos.y + Math.sin(spAngle) * spDist * 0.3 },
      velocity: { x: Math.cos(spAngle) * spSpeed, y: Math.sin(spAngle) * spSpeed - 60 },
      radius: randomRange(3, 6) * size,
      color: '#ffffff',
      life: randomRange(0.25, 0.5),
      maxLife: 0.5,
      type: 'square',
      rotation: Math.PI / 4,
      rotSpeed: randomRange(15, 30),
      gravity: 200,
    });
  }

  // === 6. burstStyle별 고유 파편 (UNIQUE DEBRIS) - 피격 방향으로! ===
  const actualDebrisCount = Math.floor(debrisCount * 2);

  switch (burstStyle) {
    // 데이터 터짐: 01 문자가 피격 방향으로 흩날림!
    case 'data': {
      const chars = text || '01';
      for (let i = 0; i < actualDebrisCount * 1.5; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(200, 450) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
          radius: randomRange(10, 16) * size,
          color: Math.random() > 0.3 ? primaryColor : secondaryColor,
          life: randomRange(0.45, 0.9),
          maxLife: 0.9,
          type: 'text',
          text: chars.charAt(Math.floor(Math.random() * chars.length)),
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: randomRange(-20, 20),
        });
      }
      // 글리치 사각형 (피격 방향으로)
      for (let g = 0; g < 8; g++) {
        const gAngle = getDirectionalAngle();
        const gSpeed = randomRange(150, 300) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(gAngle) * gSpeed, y: Math.sin(gAngle) * gSpeed },
          radius: randomRange(4, 8) * size,
          color: Math.random() > 0.5 ? '#00ffff' : '#ff00ff',
          life: 0.18,
          maxLife: 0.18,
          type: 'square',
          rotation: 0,
          rotSpeed: randomRange(-25, 25),
        });
      }
      break;
    }

    // 픽셀 퍼즈즈: 사각형이 피격 방향으로 탁탁탁!
    case 'pixel': {
      for (let i = 0; i < actualDebrisCount * 1.5; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(220, 450) * burstPower;
        const pixelSize = randomRange(4, 12) * size;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
          radius: pixelSize,
          color: [primaryColor, secondaryColor, tertiaryColor || primaryColor, '#ffffff'][Math.floor(Math.random() * 4)],
          life: randomRange(0.35, 0.7),
          maxLife: 0.7,
          type: 'square',
          rotation: Math.random() * Math.PI / 4,
          rotSpeed: randomRange(-10, 10),
        });
      }
      break;
    }

    // 슬라임 찐득: 물방울이 피격 방향으로 튀어오름!
    case 'slime': {
      for (let i = 0; i < actualDebrisCount; i++) {
        const angle = getWideAngle();
        const speed = randomRange(100, 250) * burstPower;
        const upwardBoost = randomRange(150, 250);
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE - upwardBoost * ISO_Y_SCALE },
          radius: randomRange(10, 22) * size,
          color: Math.random() > 0.4 ? primaryColor : secondaryColor,
          life: randomRange(0.7, 1.2),
          maxLife: 1.2,
          type: 'smoke',
          gravity: randomRange(350, 550),
        });
      }
      // 피격 방향 쪽에 찐득한 웅덩이
      for (let j = 0; j < 6; j++) {
        const poolDist = randomRange(20, 50) * size;
        particlesRef.current.push({
          position: { x: pos.x + Math.cos(hitAngle) * poolDist + randomRange(-15, 15), y: pos.y + Math.sin(hitAngle) * poolDist + randomRange(-10, 10) },
          velocity: { x: 0, y: 0 },
          radius: randomRange(18, 32) * size,
          color: tertiaryColor || secondaryColor,
          life: 0.5,
          maxLife: 0.5,
          type: 'smoke',
        });
      }
      break;
    }

    // 스파크 찌직: 폭발적 불꽃이 피격 방향으로!
    case 'spark': {
      for (let i = 0; i < actualDebrisCount * 1.5; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(400, 700) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
          radius: randomRange(25, 50) * size,
          color: Math.random() > 0.4 ? '#ffffff' : primaryColor,
          life: randomRange(0.12, 0.25),
          maxLife: 0.25,
          type: 'line',
          rotation: angle,
          rotSpeed: 0,
        });
      }
      // 피격점 밝은 폭발
      for (let j = 0; j < 10; j++) {
        const jAngle = getWideAngle();
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(jAngle) * 120, y: Math.sin(jAngle) * 120 },
          radius: randomRange(6, 12) * size,
          color: '#ffffff',
          life: 0.2,
          maxLife: 0.2,
          type: 'smoke',
        });
      }
      break;
    }

    // 스모크 뿌아~: 연기가 피격 방향으로!
    case 'smoke': {
      for (let i = 0; i < actualDebrisCount * 1.5; i++) {
        const angle = getWideAngle();
        const speed = randomRange(80, 200) * burstPower;
        particlesRef.current.push({
          position: { x: pos.x + randomRange(-10, 10) * size, y: pos.y + randomRange(-10, 10) * size },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE - 40 },
          radius: randomRange(25, 55) * size,
          color: [primaryColor, secondaryColor, tertiaryColor || secondaryColor][Math.floor(Math.random() * 3)],
          life: randomRange(0.8, 1.4),
          maxLife: 1.4,
          type: 'smoke',
        });
      }
      // 피격 방향으로 연기 퍼짐
      for (let u = 0; u < 6; u++) {
        const uAngle = getDirectionalAngle();
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(uAngle) * 100, y: Math.sin(uAngle) * 100 - 50 },
          radius: randomRange(15, 30) * size,
          color: tertiaryColor || secondaryColor,
          life: randomRange(0.6, 1.0),
          maxLife: 1.0,
          type: 'smoke',
        });
      }
      break;
    }

    // 쉐터 쩍쩍: 파편이 피격 방향으로 산산조각!
    case 'shatter': {
      for (let i = 0; i < actualDebrisCount * 1.5; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(280, 550) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
          radius: randomRange(7, 18) * size,
          color: Math.random() > 0.3 ? primaryColor : secondaryColor,
          life: randomRange(0.45, 0.8),
          maxLife: 0.8,
          type: 'square',
          rotation: Math.random() * Math.PI,
          rotSpeed: randomRange(-30, 30),
        });
      }
      // 균열선 (피격 방향으로 집중!)
      for (let c = 0; c < 10; c++) {
        const crackAngle = getDirectionalAngle();
        const crackSpeed = randomRange(400, 550) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(crackAngle) * crackSpeed, y: Math.sin(crackAngle) * crackSpeed },
          radius: randomRange(30, 55) * size,
          color: tertiaryColor || '#ffffff',
          life: 0.15,
          maxLife: 0.15,
          type: 'line',
          rotation: crackAngle,
          rotSpeed: 0,
        });
      }
      break;
    }

    // 일렉트릭 찌지직: 전기가 피격 방향으로!
    case 'electric': {
      for (let i = 0; i < actualDebrisCount; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(300, 600) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed + randomRange(-60, 60), y: (Math.sin(angle) * speed + randomRange(-60, 60)) * ISO_Y_SCALE },
          radius: randomRange(25, 50) * size,
          color: Math.random() > 0.3 ? '#00ffff' : '#ffffff',
          life: randomRange(0.1, 0.2),
          maxLife: 0.2,
          type: 'line',
          rotation: angle + randomRange(-0.4, 0.4),
          rotSpeed: randomRange(-35, 35),
        });
      }
      // 전기 스파크 점 (피격 방향)
      for (let j = 0; j < actualDebrisCount; j++) {
        const sparkAngle = getDirectionalAngle();
        const sparkSpeed = randomRange(100, 200) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(sparkAngle) * sparkSpeed, y: Math.sin(sparkAngle) * sparkSpeed },
          radius: randomRange(5, 11) * size,
          color: Math.random() > 0.5 ? '#00ffff' : '#ffffff',
          life: randomRange(0.15, 0.25),
          maxLife: 0.25,
          type: 'square',
          rotation: Math.random() * Math.PI,
          rotSpeed: randomRange(-40, 40),
        });
      }
      // 전기 폭발
      particlesRef.current.push({
        position: { ...pos },
        velocity: { x: 0, y: 0 },
        radius: 30 * size,
        color: '#00ffff',
        life: 0.12,
        maxLife: 0.12,
        type: 'smoke',
      });
      break;
    }

    // 골드 반짝반짝: 황금이 피격 방향으로 폭발!
    case 'gold': {
      for (let i = 0; i < actualDebrisCount * 1.5; i++) {
        const angle = getDirectionalAngle();
        const speed = randomRange(180, 380) * burstPower;
        particlesRef.current.push({
          position: { ...pos },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE - 40 },
          radius: randomRange(5, 12) * size,
          color: [primaryColor, secondaryColor, '#ffffff', '#fffde7'][Math.floor(Math.random() * 4)],
          life: randomRange(0.5, 1.0),
          maxLife: 1.0,
          type: 'square',
          rotation: Math.PI / 4,
          rotSpeed: randomRange(8, 20),
          gravity: 150, // 약한 중력
        });
      }
      // 중앙 황금빛 폭발
      particlesRef.current.push({
        position: { ...pos },
        velocity: { x: 0, y: 0 },
        radius: 30 * size,
        color: primaryColor,
        life: 0.2,
        maxLife: 0.2,
        type: 'smoke',
      });
      // $ 기호도 피격 방향으로!
      if (text) {
        for (let t = 0; t < 6; t++) {
          const tAngle = getDirectionalAngle();
          const tSpeed = randomRange(120, 220) * burstPower;
          particlesRef.current.push({
            position: { ...pos },
            velocity: { x: Math.cos(tAngle) * tSpeed, y: Math.sin(tAngle) * tSpeed - 50 },
            radius: randomRange(8, 12) * size,
            color: primaryColor,
            life: randomRange(0.6, 1.0),
            maxLife: 1.0,
            type: 'text',
            text: text,
            rotation: 0,
            rotSpeed: randomRange(-8, 8),
            gravity: 180,
          });
        }
      }
      break;
    }
  }

  // 얼티밋 보너스: 추가 링 + 밝은 별
  if (isUltimate) {
    particlesRef.current.push({
      position: { ...pos },
      velocity: { x: 0, y: 0 },
      radius: 35 * size,
      color: '#ffffff',
      life: 0.25,
      maxLife: 0.25,
      type: 'ring',
      width: 3,
    });
    for (let s = 0; s < 6; s++) {
      const starAngle = (s / 6) * Math.PI * 2;
      particlesRef.current.push({
        position: { x: pos.x + Math.cos(starAngle) * 20 * size, y: pos.y + Math.sin(starAngle) * 20 * size },
        velocity: { x: Math.cos(starAngle) * 100, y: Math.sin(starAngle) * 100 - 50 },
        radius: 4 * size,
        color: '#ffffff',
        life: 0.5,
        maxLife: 0.5,
        type: 'square',
        rotation: Math.PI / 4,
        rotSpeed: 10,
      });
    }
  }
};

/**
 * 데미지 넘버 스폰
 */
export const spawnDamageNumber = (
  damageNumbersRef: React.MutableRefObject<any[]>,
  pos: Vector2,
  value: number,
  isCritical: boolean = false
): void => {
  damageNumbersRef.current.push({
    id: Math.random().toString(),
    value,
    position: { x: pos.x + randomRange(-10, 10), y: pos.y - 20 },
    velocity: { x: randomRange(-20, 20), y: isCritical ? -120 : -80 }, // 크리티컬은 더 높이 튀어오름
    life: GAME_CONFIG.DAMAGE_TEXT_LIFESPAN,
    maxLife: GAME_CONFIG.DAMAGE_TEXT_LIFESPAN,
    color: isCritical ? '#fbbf24' : undefined, // 크리티컬은 금색
    isCritical,
  });
};

/**
 * 젬 스폰
 */
export const spawnGem = (
  gemsRef: React.MutableRefObject<Gem[]>,
  pos: Vector2,
  value: number
): void => {
  gemsRef.current.push({
    id: Math.random().toString(),
    position: { ...pos },
    value: value,
    color: value > 10 ? '#a855f7' : '#3b82f6',
    isCollected: false,
  });
};

/**
 * 적에게 데미지 적용 (크리티컬 시스템 포함)
 * v8.1.2: ownerId 추가 - AI 에이전트 킬은 플레이어 콤보에 포함 안 함
 */
export const damageEnemy = (
  enemy: Enemy,
  amount: number,
  knockback: number,
  sourcePos: Vector2,
  ctx: DamageEnemyContext,
  weaponType: WeaponType | 'bomb' | 'special' = 'special',
  isUltimate: boolean = false,
  ownerId?: string
): void => {
  // 이미 죽은 적은 처리하지 않음
  if (enemy.state === 'dying') return;

  // 크리티컬 판정
  const isCritical = rollCritical(ctx.player.current);
  // v3 시스템: 데미지 배율 적용 (콤보 보너스)
  const v3DmgMult = ctx.v3DamageMultiplier ?? 1;
  let finalDamage = Math.floor(amount * v3DmgMult);
  let finalKnockback = knockback;

  if (isCritical) {
    // 크리티컬 데미지 = 기본 데미지 × 배율 (v3 배율 이미 적용됨)
    finalDamage = Math.floor(finalDamage * (ctx.player.current.criticalMultiplier || 2.0));
    // 크리티컬 넉백 = 기본 넉백 × 1.5
    finalKnockback = knockback * 1.5;

    // 크리티컬 이펙트 생성 (마블 카툰 스타일)
    createCriticalEffect(ctx.criticalEffects, enemy.position, weaponType);
  }

  enemy.health -= finalDamage;
  enemy.state = 'stunned';
  enemy.stunTimer = 0.15;
  (enemy as any).lastHitTime = Date.now();

  // v7.16: MP3 기반 hit 사운드 제거 - 무기별 Web Audio 합성음만 사용
  // (playHitSFX가 무기 타격 시 이미 호출됨)

  // Spawn damage number (크리티컬은 다른 색상)
  spawnDamageNumber(ctx.damageNumbers, enemy.position, finalDamage, isCritical);

  // 피격 방향 계산 - 파편이 공격 방향으로 튀어나감! (물리적으로 자연스러움)
  // sourcePos → enemy 방향 = 공격이 진행하는 방향 = 적이 밀려나는 방향
  const hitAngle = angleBetween(sourcePos, enemy.position);

  // Create hit effect - 무기 + 몬스터 조합 이펙트! (도파민 무쌍!)
  // 보스가 아닌 일반 몬스터는 burstStyle + weaponType 조합 이펙트
  if (!enemy.isBoss) {
    createHitEffectByEnemy(ctx.particles, enemy.position, enemy.enemyType, isUltimate, weaponType, hitAngle);
  } else {
    // 보스는 기존 무기 기반 이펙트 (더 화려한 효과)
    const typeConfig = ENEMY_TYPES[enemy.enemyType];
    createHitEffect(ctx.particles, enemy.position, weaponType, isUltimate, typeConfig?.color);
  }

  // Apply knockback (hitAngle 재사용, 크리티컬은 더 강함)
  // v6.0: 아이소메트릭 넉백 - Y축 0.5배 압축
  const force = (finalKnockback * 10) / enemy.mass;
  const { x: knockX, y: knockY } = isoKnockback(hitAngle, force);
  enemy.velocity.x += knockX;
  enemy.velocity.y += knockY;

  // Handle death
  if (enemy.health <= 0) {
    enemy.state = 'dying';

    // Death Animation Setup (도파민 타격감!)
    const DEATH_DURATION = 0.25; // 0.25초 동안 밀려남
    enemy.deathTimer = DEATH_DURATION;
    enemy.deathScale = 1.0;

    // 타격 방향으로 세게 밀려남 (knockback * 3배!)
    // v6.0: 아이소메트릭 넉백 적용
    const deathForce = (knockback * 30) / enemy.mass;
    const { x: deathX, y: deathY } = isoKnockback(hitAngle, deathForce);
    enemy.deathVelocity = { x: deathX, y: deathY };
    // 기존 속도에 더함 (밀려나는 관성)
    enemy.velocity.x += enemy.deathVelocity.x * 0.5;
    enemy.velocity.y += enemy.deathVelocity.y * 0.5;

    const typeConfig = ENEMY_TYPES[enemy.enemyType];
    // Arena mode: use base values (no stage multipliers)
    const xpValue = Math.ceil(typeConfig.xp);
    const scoreValue = Math.ceil(typeConfig.score);

    // Update score
    ctx.player.current.score += scoreValue;

    // Spawn rewards
    spawnGem(ctx.gems, enemy.position, xpValue);

    // Arena mode: No boss spawns, skip boss chest logic
    if (false) { // Boss system removed
      // Force chest spawn for boss only
      ctx.pickups.current.push({
        id: Math.random().toString(),
        type: 'chest',
        position: { ...enemy.position },
        radius: 20,
        life: 30,
      });
    } else {
      // Random pickup drop (affected by oracle weapon luck)
      // 스테이지 모드: 1.5% 기본 확률
      // 특이점 모드: 시간에 따라 드랍률 감소 (적이 많아지므로)
      //   - 0-5분: 0.4%, 5-15분: 0.25%, 15-60분: 0.15%, 60분+: 0.1%
      const isSingularity = ctx.stageId === 999;
      const gameTimeMinutes = (ctx.gameTime?.current || 0) / 60;

      let baseDropRate: number;
      if (isSingularity) {
        // 특이점: 시간에 따라 점진적으로 낮아지는 드랍률
        // 초반에는 여유롭게, 후반으로 갈수록 희귀
        // 몬스터 드랍률은 1.5~2배로 증가하지만 bomb은 더 희귀하게
        if (gameTimeMinutes < 3) baseDropRate = 0.025;       // 2.5% (초반 여유)
        else if (gameTimeMinutes < 8) baseDropRate = 0.018;  // 1.8%
        else if (gameTimeMinutes < 15) baseDropRate = 0.012; // 1.2%
        else if (gameTimeMinutes < 30) baseDropRate = 0.008; // 0.8%
        else if (gameTimeMinutes < 60) baseDropRate = 0.005; // 0.5%
        else baseDropRate = 0.003;                           // 0.3% (후반)
      } else {
        // 스테이지 모드: 1.5% → 2.5% (약 1.7배 증가)
        baseDropRate = 0.025;
      }

      const luckBonus = (ctx.player.current.weapons.oracle?.amount || 0) / 100;
      if (Math.random() < baseDropRate * (1 + luckBonus)) {
        // Determine pickup type
        let type: PickupType = 'chicken';
        const rand = Math.random();
        if (isSingularity) {
          // 특이점: 재료 드롭 추가! bomb은 시간 기반 스폰
          // 몬스터 처치 시: upgrade_material 8%, chest 2%, magnet 15%, chicken 75%
          if (rand < 0.08) type = 'upgrade_material'; // 8% 재료
          else if (rand < 0.10) type = 'chest';       // 2% chest
          else if (rand < 0.25) type = 'magnet';      // 15% magnet
          else type = 'chicken';                      // 75% chicken
          // bomb은 GameCanvas에서 시간 기반으로 랜덤 스폰됨
        } else {
          // 스테이지: bomb 8%, chest 4%, magnet 18%, chicken 70%
          if (rand < 0.04) type = 'chest';
          else if (rand < 0.12) type = 'bomb';
          else if (rand < 0.30) type = 'magnet';
          else type = 'chicken';
        }

        ctx.pickups.current.push({
          id: Math.random().toString(),
          type,
          position: { ...enemy.position },
          radius: type === 'chest' ? 20 : 12,
          life: 30,
        });
      }
    }

    // Update score callback
    if (ctx.player.current.score !== ctx.lastReportedScore.current) {
      ctx.onScoreUpdate(ctx.player.current.score);
      ctx.lastReportedScore.current = ctx.player.current.score;
    }

    // 강화된 Death particles - 도파민 폭발!
    if (ctx.particles.current.length < 300) {
      // 적의 원래 색상 사용
      const enemyColor = typeConfig.color || '#fff';
      const particleCount = enemy.isBoss ? 25 : 15;  // 파티클 수 대폭 증가

      // 폭발 링 이펙트
      ctx.particles.current.push({
        position: { ...enemy.position },
        velocity: { x: 0, y: 0 },
        radius: enemy.isBoss ? 60 : 35,
        color: enemyColor,
        life: 0.3,
        maxLife: 0.3,
        type: 'ring',
        width: enemy.isBoss ? 5 : 3,
      });

      // 사망 파티클
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = randomRange(80, 220);  // 더 빠르게
        const useEnemyColor = Math.random() > 0.3;  // 70% 적 색상, 30% 흰색
        ctx.particles.current.push({
          position: { ...enemy.position },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
          radius: randomRange(3, 8),  // 더 크게
          color: useEnemyColor ? enemyColor : '#fff',
          life: randomRange(0.35, 0.7),
          maxLife: 0.7,
          type: 'square',
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: randomRange(-10, 10),
        });
      }
    }

    // 특이점 모드: 킬 카운트 증가
    if (ctx.onSingularityKill) {
      ctx.onSingularityKill();
    }

    // 튜토리얼 모드: 킬 카운트 증가
    if (ctx.onTutorialKill) {
      ctx.onTutorialKill();
    }

    // v3 시스템: 킬 이벤트 (콤보, 쉬는시간 게이지 충전)
    // v8.1.2: AI 에이전트 킬은 플레이어 콤보에 포함 안 함
    const isAgentKill = ownerId?.startsWith('agent_') ?? false;
    if (ctx.onV3Kill && !isAgentKill) {
      ctx.onV3Kill();
    }

    // v7.15: 킬 카운트 증가 (엘리트 스폰 체크용)
    if (ctx.onKillCount) {
      ctx.onKillCount();
    }

    // v7.15: 엘리트 몬스터 사망 처리
    if (enemy.isElite && ctx.onEliteDeath) {
      ctx.onEliteDeath(enemy);
    }

    // Boss defeat callback (한 번만 호출되도록 보호)
    if (enemy.isBoss && !(enemy as any).bossDefeatedCalled) {
      (enemy as any).bossDefeatedCalled = true;
      ctx.onBossDefeated();
    }
  }
};

/**
 * 플레이어-적 충돌 처리 컨텍스트
 */
export interface EnemyCollisionContext {
  player: Player;
  onShieldHit: () => void;
  onPlayerDamaged: () => void;
  onHealthUpdate: (hp: number) => void;
  onGameOver: (score: number) => void;
  // v3 시스템: 플레이어 피격 콜백 (콤보 리셋, 쪽지시험 실패 등)
  onV3PlayerHit?: () => void;
  // v7.8: 피격 시 화면 쉐이크 (intensity: 0-1)
  onScreenShake?: (intensity: number) => void;
  // v5.7: 방어력 보너스 (데미지 감소율, 0-1)
  defBonus?: number;
}

/**
 * 적과 플레이어 충돌 처리
 * 쉴드/데미지/넉백 처리
 */
export const handleEnemyCollision = (
  enemy: Enemy,
  ctx: EnemyCollisionContext
): void => {
  const { player, onShieldHit, onPlayerDamaged, onHealthUpdate, onGameOver, onV3PlayerHit, onScreenShake, defBonus = 0 } = ctx;

  if (enemy.state === 'stunned' || player.invulnerabilityTimer > 0) return;

  const angle = Math.atan2(player.position.y - enemy.position.y, player.position.x - enemy.position.x);

  // Hit Reaction 애니메이션 트리거 (공통)
  const hitDir = { x: Math.cos(angle), y: Math.sin(angle) };

  if (player.shield > 0) {
    player.shield--;
    player.invulnerabilityTimer = GAME_CONFIG.PLAYER_INVULNERABILITY;
    player.knockback.x = Math.cos(angle) * 300;
    player.knockback.y = Math.sin(angle) * 300;
    player.hitFlashTimer = 0.1;
    // Hit Reaction (쉴드 - 약한 리액션)
    player.hitReaction = { active: true, timer: 0.15, direction: hitDir, intensity: 0.3 };
    soundManager.playSFX('hit');
    // v7.8: 쉴드 피격 시 미약한 쉐이크
    if (onScreenShake) onScreenShake(0.15);
    onShieldHit();
  } else {
    // v5.7: 방어력 보너스로 데미지 감소 (최대 감소율 90%)
    const damageReduction = Math.min(defBonus, 0.9);
    const actualDamage = enemy.damage * (1 - damageReduction);
    player.health -= actualDamage;
    player.invulnerabilityTimer = GAME_CONFIG.PLAYER_INVULNERABILITY;
    player.knockback.x = Math.cos(angle) * 400;
    player.knockback.y = Math.sin(angle) * 400;
    player.hitFlashTimer = 0.15;
    // Hit Reaction (데미지 - 강한 리액션)
    const intensity = Math.min(actualDamage / player.maxHealth, 1);
    player.hitReaction = { active: true, timer: 0.15, direction: hitDir, intensity: Math.max(0.5, intensity) };
    soundManager.playSFX('hit');
    // v7.8: 피격 시 화면 쉐이크 (데미지 비례)
    if (onScreenShake) onScreenShake(Math.max(0.3, intensity * 0.6));
    onPlayerDamaged();

    // v3 시스템: 플레이어 피격 (콤보 리셋, 쪽지시험 무피격 챌린지 실패)
    if (onV3PlayerHit) {
      onV3PlayerHit();
    }

    if (player.health <= 0) {
      player.health = 0;
      onHealthUpdate(0);
      onGameOver(player.score);
    } else {
      onHealthUpdate(Math.floor(player.health));
    }
  }
};

/**
 * 젬 통합 (성능 최적화)
 */
export const consolidateGems = (
  gemsRef: React.MutableRefObject<Gem[]>,
  playerPos: Vector2
): void => {
  if (gemsRef.current.length < 150) return;

  const collected: Gem[] = [];
  const uncollected: Gem[] = [];

  gemsRef.current.forEach((g) => {
    if (g.isCollected) collected.push(g);
    else uncollected.push(g);
  });

  if (uncollected.length > 50) {
    const removed = uncollected.splice(0, uncollected.length - 50);
    const totalVal = removed.reduce((sum, g) => sum + g.value, 0);
    if (totalVal > 0) {
      uncollected.push({
        id: Math.random().toString(),
        position: { ...playerPos },
        value: totalVal,
        color: '#a855f7',
        isCollected: false,
      });
    }
  }

  gemsRef.current = [...collected, ...uncollected];
};

// ============================================
// === CODE SURVIVOR 특수 이펙트 시스템 ===
// ============================================

/**
 * 크리티컬 히트 이펙트 - Matrix 스타일 강화된 타격
 * 일반 히트보다 2배 큰 이펙트 + CRITICAL 텍스트
 */
export const createCriticalHitEffect = (
  particlesRef: React.MutableRefObject<Particle[]>,
  position: Vector2,
  hitAngle: number
): void => {
  const pos = { ...position };

  // CRITICAL 텍스트 (Matrix 녹색)
  particlesRef.current.push({
    position: { x: pos.x, y: pos.y - 20 },
    velocity: { x: 0, y: -80 },
    radius: 18,
    color: '#00ff41',
    life: 0.8,
    maxLife: 0.8,
    type: 'text',
    text: 'CRITICAL',
    rotation: 0,
    rotSpeed: 0,
  });

  // Matrix 코드 폭발 (대량)
  const codeChars = ['1', '0', '{', '}', '(', ')', ';', '=>', 'fn', 'if'];
  for (let i = 0; i < 20; i++) {
    const angle = hitAngle + Math.PI + (Math.random() - 0.5) * Math.PI;
    const speed = 300 + Math.random() * 400;
    particlesRef.current.push({
      position: { ...pos },
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
      radius: 12 + Math.random() * 8,
      color: Math.random() > 0.3 ? '#00ff41' : '#00cc33',
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.8,
      type: 'text',
      text: codeChars[Math.floor(Math.random() * codeChars.length)],
      rotation: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 20,
    });
  }

  // 대형 충격파 (이중)
  particlesRef.current.push({
    position: { ...pos },
    velocity: { x: 0, y: 0 },
    radius: 80,
    color: '#00ff41',
    life: 0.25,
    maxLife: 0.25,
    type: 'ring',
    width: 5,
  });
  particlesRef.current.push({
    position: { ...pos },
    velocity: { x: 0, y: 0 },
    radius: 50,
    color: '#ffffff',
    life: 0.2,
    maxLife: 0.2,
    type: 'ring',
    width: 3,
  });

  // 밝은 섬광
  particlesRef.current.push({
    position: { ...pos },
    velocity: { x: 0, y: 0 },
    radius: 60,
    color: '#ffffff',
    life: 0.1,
    maxLife: 0.1,
    type: 'smoke',
  });
};

/**
 * 시스템 크래시 이펙트 - 블루스크린 폭발!
 * genesis (System Crash) 무기 특수 효과
 */
export const createSystemCrashEffect = (
  particlesRef: React.MutableRefObject<Particle[]>,
  position: Vector2
): void => {
  const pos = { ...position };

  // 블루스크린 플래시 (전체 화면급)
  particlesRef.current.push({
    position: { ...pos },
    velocity: { x: 0, y: 0 },
    radius: 200,
    color: '#1d4ed8',  // Blue screen blue
    life: 0.15,
    maxLife: 0.15,
    type: 'smoke',
  });

  // 에러 메시지 텍스트들
  const errorTexts = ['BSOD', 'FATAL', 'CRASH', '0x000', 'DUMP', 'HALT', 'PANIC'];
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 150 + Math.random() * 300;
    particlesRef.current.push({
      position: { ...pos },
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
      radius: 14 + Math.random() * 6,
      color: Math.random() > 0.5 ? '#ffffff' : '#60a5fa',
      life: 0.7 + Math.random() * 0.5,
      maxLife: 1.2,
      type: 'text',
      text: errorTexts[Math.floor(Math.random() * errorTexts.length)],
      rotation: 0,
      rotSpeed: (Math.random() - 0.5) * 10,
    });
  }

  // 글리치 사각형 (픽셀 노이즈)
  for (let g = 0; g < 25; g++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 100 + Math.random() * 250;
    particlesRef.current.push({
      position: { ...pos },
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
      radius: 8 + Math.random() * 15,
      color: Math.random() > 0.6 ? '#1d4ed8' : '#ffffff',
      life: 0.3 + Math.random() * 0.3,
      maxLife: 0.6,
      type: 'square',
      rotation: 0,
      rotSpeed: (Math.random() - 0.5) * 25,
    });
  }

  // 다중 충격파
  for (let r = 0; r < 3; r++) {
    particlesRef.current.push({
      position: { ...pos },
      velocity: { x: 0, y: 0 },
      radius: 120 - r * 30,
      color: r === 0 ? '#1d4ed8' : '#60a5fa',
      life: 0.3 - r * 0.05,
      maxLife: 0.3,
      type: 'ring',
      width: 6 - r,
    });
  }
};

/**
 * MCP 클리어 이펙트 - Model Context Protocol 정화
 * phishing (MCP Server) 무기 특수 효과
 */
export const createMCPClearEffect = (
  particlesRef: React.MutableRefObject<Particle[]>,
  position: Vector2
): void => {
  const pos = { ...position };

  // MCP 텍스트 상승
  particlesRef.current.push({
    position: { x: pos.x, y: pos.y - 30 },
    velocity: { x: 0, y: -100 },
    radius: 20,
    color: '#a855f7',  // Purple
    life: 1.0,
    maxLife: 1.0,
    type: 'text',
    text: 'MCP',
    rotation: 0,
    rotSpeed: 0,
  });

  // Protocol 데이터 스트림
  const protocolTexts = ['GET', 'POST', 'tool', 'call', 'res', 'ctx'];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const speed = 200 + Math.random() * 150;
    particlesRef.current.push({
      position: { ...pos },
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
      radius: 12 + Math.random() * 4,
      color: Math.random() > 0.4 ? '#a855f7' : '#c084fc',
      life: 0.6 + Math.random() * 0.3,
      maxLife: 0.9,
      type: 'text',
      text: protocolTexts[Math.floor(Math.random() * protocolTexts.length)],
      rotation: 0,
      rotSpeed: (Math.random() - 0.5) * 8,
    });
  }

  // 연결선 (방사형)
  for (let l = 0; l < 8; l++) {
    const angle = (l / 8) * Math.PI * 2;
    const speed = 350;
    particlesRef.current.push({
      position: { ...pos },
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * ISO_Y_SCALE },
      radius: 60,
      color: '#c084fc',
      life: 0.15,
      maxLife: 0.15,
      type: 'line',
      rotation: angle,
      rotSpeed: 0,
    });
  }

  // 정화 원형파
  particlesRef.current.push({
    position: { ...pos },
    velocity: { x: 0, y: 0 },
    radius: 150,
    color: '#a855f7',
    life: 0.35,
    maxLife: 0.35,
    type: 'ring',
    width: 8,
  });

  // 내부 밝은 코어
  particlesRef.current.push({
    position: { ...pos },
    velocity: { x: 0, y: 0 },
    radius: 40,
    color: '#ffffff',
    life: 0.12,
    maxLife: 0.12,
    type: 'smoke',
  });
};

/**
 * 디버그 오라 틱 이펙트 - 주기적 디버그 펄스
 * garlic (Debug Aura) 무기의 지속 데미지 효과
 */
export const createDebugAuraTick = (
  particlesRef: React.MutableRefObject<Particle[]>,
  position: Vector2
): void => {
  const pos = { ...position };

  // 콘솔 로그 텍스트
  const logTexts = ['log', 'warn', 'err', '>>>', 'dbg', 'trace'];
  const randomLog = logTexts[Math.floor(Math.random() * logTexts.length)];

  particlesRef.current.push({
    position: { x: pos.x + (Math.random() - 0.5) * 30, y: pos.y + (Math.random() - 0.5) * 30 },
    velocity: { x: (Math.random() - 0.5) * 60, y: -50 - Math.random() * 30 },
    radius: 10 + Math.random() * 4,
    color: randomLog === 'err' ? '#ef4444' : randomLog === 'warn' ? '#f59e0b' : '#00ff41',
    life: 0.5 + Math.random() * 0.3,
    maxLife: 0.8,
    type: 'text',
    text: randomLog,
    rotation: 0,
    rotSpeed: 0,
  });

  // 작은 데이터 파편
  for (let i = 0; i < 3; i++) {
    const angle = Math.random() * Math.PI * 2;
    particlesRef.current.push({
      position: { x: pos.x + Math.cos(angle) * 15, y: pos.y + Math.sin(angle) * 15 },
      velocity: { x: Math.cos(angle) * 40, y: Math.sin(angle) * 40 },
      radius: 4 + Math.random() * 3,
      color: '#00ff41',
      life: 0.3,
      maxLife: 0.3,
      type: 'square',
      rotation: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 15,
    });
  }
};

/**
 * Claude 어시스트 이펙트 - AI 협업 번개
 * lightning (Claude Assist) 무기 특수 효과
 */
export const createClaudeAssistEffect = (
  particlesRef: React.MutableRefObject<Particle[]>,
  startPos: Vector2,
  endPos: Vector2
): void => {
  // Claude 색상 (주황/갈색 톤)
  const claudeColors = ['#d97706', '#f59e0b', '#fbbf24', '#fcd34d'];

  // 시작점에서 끝점까지 번개 경로
  const segments = 6;
  let prevPos = { ...startPos };

  for (let i = 0; i < segments; i++) {
    const progress = (i + 1) / segments;
    const targetX = startPos.x + (endPos.x - startPos.x) * progress;
    const targetY = startPos.y + (endPos.y - startPos.y) * progress;

    // 지그재그 오프셋
    const offset = i < segments - 1 ? (Math.random() - 0.5) * 40 : 0;
    const currentPos = { x: targetX + offset, y: targetY + offset * 0.5 };

    // 번개 세그먼트
    const angle = Math.atan2(currentPos.y - prevPos.y, currentPos.x - prevPos.x);
    const dist = Math.sqrt((currentPos.x - prevPos.x) ** 2 + (currentPos.y - prevPos.y) ** 2);

    particlesRef.current.push({
      position: { x: (prevPos.x + currentPos.x) / 2, y: (prevPos.y + currentPos.y) / 2 },
      velocity: { x: 0, y: 0 },
      radius: dist,
      color: claudeColors[Math.floor(Math.random() * claudeColors.length)],
      life: 0.15,
      maxLife: 0.15,
      type: 'line',
      rotation: angle,
      rotSpeed: 0,
    });

    // 노드 포인트 글로우
    particlesRef.current.push({
      position: { ...currentPos },
      velocity: { x: 0, y: 0 },
      radius: 12,
      color: '#ffffff',
      life: 0.1,
      maxLife: 0.1,
      type: 'smoke',
    });

    prevPos = currentPos;
  }

  // 타격점 폭발
  particlesRef.current.push({
    position: { ...endPos },
    velocity: { x: 0, y: 0 },
    radius: 45,
    color: '#f59e0b',
    life: 0.2,
    maxLife: 0.2,
    type: 'ring',
    width: 4,
  });

  // AI 텍스트
  particlesRef.current.push({
    position: { x: endPos.x, y: endPos.y - 25 },
    velocity: { x: 0, y: -60 },
    radius: 14,
    color: '#f59e0b',
    life: 0.6,
    maxLife: 0.6,
    type: 'text',
    text: 'AI',
    rotation: 0,
    rotSpeed: 0,
  });
};

/**
 * Git Fork 분기 이펙트
 * fork (Git Fork) 무기의 분기 공격 효과
 */
export const createGitForkEffect = (
  particlesRef: React.MutableRefObject<Particle[]>,
  position: Vector2,
  branchCount: number = 3
): void => {
  const pos = { ...position };

  // Fork 텍스트
  particlesRef.current.push({
    position: { x: pos.x, y: pos.y - 20 },
    velocity: { x: 0, y: -70 },
    radius: 14,
    color: '#f97316',
    life: 0.6,
    maxLife: 0.6,
    type: 'text',
    text: 'FORK',
    rotation: 0,
    rotSpeed: 0,
  });

  // 분기 라인들
  const angleSpread = Math.PI / (branchCount + 1);
  for (let b = 0; b < branchCount; b++) {
    const branchAngle = -Math.PI / 2 + angleSpread * (b + 1);

    // 브랜치 라인
    particlesRef.current.push({
      position: { ...pos },
      velocity: { x: Math.cos(branchAngle) * 250, y: Math.sin(branchAngle) * 250 },
      radius: 50,
      color: '#f97316',
      life: 0.2,
      maxLife: 0.2,
      type: 'line',
      rotation: branchAngle,
      rotSpeed: 0,
    });

    // 브랜치 끝 노드
    const endX = pos.x + Math.cos(branchAngle) * 60;
    const endY = pos.y + Math.sin(branchAngle) * 60;
    particlesRef.current.push({
      position: { x: endX, y: endY },
      velocity: { x: 0, y: 0 },
      radius: 10,
      color: '#fb923c',
      life: 0.25,
      maxLife: 0.25,
      type: 'smoke',
    });
  }

  // 중앙 노드
  particlesRef.current.push({
    position: { ...pos },
    velocity: { x: 0, y: 0 },
    radius: 15,
    color: '#ffffff',
    life: 0.15,
    maxLife: 0.15,
    type: 'smoke',
  });
};
