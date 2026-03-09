/**
 * pickup.ts - 픽업 시스템
 * 픽업 아이템 수집 및 효과 적용
 */

import React from 'react';
import { Player, Pickup, Enemy, Gem, Vector2 } from '../types';
import { soundManager } from '../utils/audio';
import { sfxManager } from '../utils/sfx';

/**
 * 픽업 수집에 필요한 컨텍스트
 */
export interface PickupCollectContext {
  player: Player;
  gems: Gem[];
  enemies: Enemy[];
  screenFlash: React.MutableRefObject<number>;
  onHealthUpdate: (hp: number) => void;
  onChestCollected: () => void;
  onMaterialCollected?: () => void;  // 재료 수집 콜백
  spawnDamageNumber: (pos: Vector2, value: number, isHeal: boolean) => void;
  damageEnemy: (enemy: Enemy, damage: number, knockback: number, sourcePos: Vector2, weaponType: 'bomb') => void;
}

/**
 * 픽업 수집 결과
 */
export interface PickupCollectResult {
  healthRestored?: number;
  gemsCollected?: boolean;
  bombExploded?: boolean;
  chestOpened?: boolean;
  materialCollected?: boolean;
}

/**
 * 픽업 아이템 수집 처리
 */
export const collectPickup = (
  pickup: Pickup,
  ctx: PickupCollectContext
): PickupCollectResult => {
  const result: PickupCollectResult = {};

  if (pickup.type === 'chest') {
    ctx.onChestCollected();
    result.chestOpened = true;
  } else {
    // 픽업 타입별 사운드 재생
    switch (pickup.type) {
      case 'chicken': {
        soundManager.playSFX('heal');  // 회복 사운드
        const healAmount = 50;
        ctx.player.health = Math.min(ctx.player.health + healAmount, ctx.player.maxHealth);
        ctx.onHealthUpdate(ctx.player.health);
        ctx.spawnDamageNumber(ctx.player.position, healAmount, true);
        result.healthRestored = healAmount;
        break;
      }
      case 'magnet': {
        soundManager.playSFX('powerup');  // 마그넷 효과
        ctx.gems.forEach((g) => (g.isCollected = true));
        result.gemsCollected = true;
        break;
      }
      case 'bomb': {
        soundManager.playSFX('explosion');
        ctx.screenFlash.current = 0.5;
        ctx.enemies.forEach((e) => {
          ctx.damageEnemy(e, 99999, 50, ctx.player.position, 'bomb');
        });
        result.bombExploded = true;
        break;
      }
      case 'upgrade_material': {
        soundManager.playSFX('powerup');  // 재료 수집
        // 캐릭터 강화 재료 수집
        if (ctx.onMaterialCollected) {
          ctx.onMaterialCollected();
        }
        result.materialCollected = true;
        break;
      }
    }
  }

  return result;
};

/**
 * 픽업 타입별 우선순위
 */
export const getPickupPriority = (type: Pickup['type'], playerHealthRatio: number): number => {
  switch (type) {
    case 'chest':
      return 4;
    case 'bomb':
      return 3;
    case 'upgrade_material':
      return 2.5;  // 재료는 bomb보다 낮고 magnet보다 높음
    case 'chicken':
      return playerHealthRatio < 0.7 ? 3 : 0.5;
    case 'magnet':
      return 2;
    default:
      return 0;
  }
};

/**
 * 픽업 수집 범위 내 확인
 */
export const isPickupInRange = (pickup: Pickup, playerPos: Vector2, playerRadius: number): boolean => {
  const dx = pickup.position.x - playerPos.x;
  const dy = pickup.position.y - playerPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < playerRadius + pickup.radius;
};

/**
 * 젬 수집 컨텍스트
 */
export interface GemCollectContext {
  player: Player;
  magnetRange: number;
  collectSpeed: number;
  despawnRadius: number;
  lastCollectSfx: React.MutableRefObject<number>;
  lastReportedXp: React.MutableRefObject<number>;
  xpThresholds: number[];
  onLevelUp: () => void;
  onXpUpdate: (xp: number, nextXp: number, level: number) => void;
  xpBonusPercent?: number; // NFT XP bonus percentage
  onTutorialGemCollect?: () => void; // 튜토리얼 젬 수집 콜백
  // v3 시스템: XP 배율 (콤보 + 쉬는시간)
  v3XpMultiplier?: number;
}

/**
 * 젬 수집 결과
 */
export interface GemCollectResult {
  leveledUp: boolean;
  xpGained: number;
}

/**
 * 젬 업데이트 및 수집 처리
 * v7.17: in-place 업데이트로 변경 (GC 압박 감소)
 */
export const updateGems = (
  gems: Gem[],
  ctx: GemCollectContext,
  deltaTime: number
): Gem[] => {
  const { player, magnetRange, collectSpeed, despawnRadius } = ctx;
  const magnetRangeSq = magnetRange * magnetRange;

  let writeIdx = 0;
  for (let i = 0; i < gems.length; i++) {
    const gem = gems[i];
    const dx = player.position.x - gem.position.x;
    const dy = player.position.y - gem.position.y;

    let shouldKeep = true;

    if (gem.isCollected) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      // v7.8.8: 젬 수집 범위 2배 증가 (근처 가도 못 먹는 문제 해결)
      if (dist < player.radius * 2) {
        // 젬 수집 (XP 보너스 + v3 배율 적용)
        const nftXpMultiplier = 1 + ((ctx.xpBonusPercent ?? 0) / 100);
        const v3Multiplier = ctx.v3XpMultiplier ?? 1;
        player.xp += Math.floor(gem.value * nftXpMultiplier * v3Multiplier);

        // 사운드 (throttle) - gem_pickup으로 변경 (심플한 사운드)
        if (Date.now() - ctx.lastCollectSfx.current > 50) {
          sfxManager.play('gem_pickup');
          ctx.lastCollectSfx.current = Date.now();
        }

        // 레벨업 체크
        if (player.xp >= player.nextLevelXp) {
          player.level++;
          const nextIdx = Math.min(player.level, ctx.xpThresholds.length - 1);
          player.xp = player.xp - player.nextLevelXp;
          player.nextLevelXp = ctx.xpThresholds[nextIdx];

          // Level Up Animation 트리거 (Phase 3)
          player.levelUpAnim = 0.01; // 시작

          ctx.onLevelUp();
          soundManager.playSFX('levelup');
        }

        // XP 업데이트 콜백
        if (player.xp !== ctx.lastReportedXp.current) {
          ctx.onXpUpdate(player.xp, player.nextLevelXp, player.level);
          ctx.lastReportedXp.current = player.xp;
        }

        // 튜토리얼 젬 수집 콜백
        if (ctx.onTutorialGemCollect) {
          ctx.onTutorialGemCollect();
        }

        shouldKeep = false; // 젬 제거
      } else {
        // 플레이어 쪽으로 이동
        gem.position.x += (dx / dist) * collectSpeed * deltaTime;
        gem.position.y += (dy / dist) * collectSpeed * deltaTime;
      }
    } else {
      // 마그넷 범위 내 체크
      if (Math.abs(dx) < magnetRange && Math.abs(dy) < magnetRange) {
        if (dx * dx + dy * dy < magnetRangeSq) {
          gem.isCollected = true;
        }
      }

      // 디스폰 체크
      if (Math.abs(dx) > despawnRadius || Math.abs(dy) > despawnRadius) {
        shouldKeep = false;
      }
    }

    if (shouldKeep) {
      gems[writeIdx++] = gem;
    }
  }
  gems.length = writeIdx;
  return gems;
};
