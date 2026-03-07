'use client';

/**
 * /arena — Arena Combat 테스트 페이지 (Standalone)
 *
 * Phase 1 검증용:
 * - 단일 플레이어 PvE 모드
 * - 서버 없이 클라이언트 로컬 시뮬레이션
 * - WASD 이동 + 마우스 카메라 + 자동 공격
 * - 적 웨이브 스폰 + XP 수집 + 레벨업
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type {
  ARPhase,
  ARPlayerNet,
  AREnemyNet,
  ARCrystalNet,
  ARTomeOffer,
  ARTomeID,
  ARDamageType,
  ARCharacterType,
  ARTerrainTheme,
  ARSynergyID,
} from '@/lib/3d/ar-types';
import { TOME_INFO, CHARACTER_INFO, SYNERGY_INFO } from '@/lib/3d/ar-types';
import { addDamageNumber, type DamageNumber } from '@/components/game/ar/ARDamageNumbers';
import { ARHUD } from '@/components/game/ar/ARHUD';
import { ARLevelUp } from '@/components/game/ar/ARLevelUp';
import { ARCharacterSelect } from '@/components/game/ar/ARCharacterSelect';

// Dynamic Canvas import (SSR 불가)
const ArenaCanvas = dynamic(() => import('./ArenaCanvas'), { ssr: false });

// ============================================================
// Local Simulation State (서버 없이 테스트)
// ============================================================

interface LocalEnemy {
  id: string;
  type: 'zombie' | 'skeleton' | 'slime' | 'spider' | 'creeper';
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  isElite: boolean;
  speed: number;
  damage: number;
}

interface LocalCrystal {
  id: string;
  x: number;
  z: number;
  value: number;
}

const ARENA_RADIUS = 40;
const BASE_HP = 100;
const BASE_ATTACK_RANGE = 3.5;
const BASE_ATTACK_DPS = 15;
const MAGNET_RANGE = 2.5;
const WAVE_INTERVAL = 3;

export default function ArenaPage() {
  // Character selection (Phase 3)
  const [selectedCharacter, setSelectedCharacter] = useState<ARCharacterType | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [terrain] = useState<ARTerrainTheme>('urban');
  const [activeSynergies, setActiveSynergies] = useState<ARSynergyID[]>([]);

  // Player state
  const [hp, setHp] = useState(BASE_HP);
  const [maxHp, setMaxHp] = useState(BASE_HP);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [xpToNext, setXpToNext] = useState(80);
  const [kills, setKills] = useState(0);
  const [alive, setAlive] = useState(true);
  const [tomes, setTomes] = useState<Record<string, number>>({});
  const [phase] = useState<ARPhase>('pve');
  const [timer, setTimer] = useState(300);
  const [wave, setWave] = useState(0);

  // Character selection handler
  const handleCharacterSelect = useCallback((character: ARCharacterType) => {
    setSelectedCharacter(character);
    const charInfo = CHARACTER_INFO[character];
    if (charInfo) {
      // Apply character base stats
      const baseHPMap: Record<ARCharacterType, number> = {
        striker: 100, guardian: 130, pyro: 90, frost_mage: 85,
        sniper: 80, gambler: 95, berserker: 110, shadow: 75,
      };
      const charHP = baseHPMap[character] || BASE_HP;
      setHp(charHP);
      setMaxHp(charHP);
    }
    setGameStarted(true);
  }, []);

  // Level-up popup
  const [levelUpChoices, setLevelUpChoices] = useState<ARTomeOffer[] | null>(null);

  // Enemies & crystals (refs for performance)
  const enemiesRef = useRef<LocalEnemy[]>([]);
  const crystalsRef = useRef<LocalCrystal[]>([]);
  const [enemyNet, setEnemyNet] = useState<AREnemyNet[]>([]);
  const [crystalNet, setCrystalNet] = useState<ARCrystalNet[]>([]);

  // Player position (updated by ArenaCanvas)
  const playerPosRef = useRef({ x: 0, y: 0, z: 0 });
  const playerRotRef = useRef(0);
  const movingRef = useRef(false);

  // ID counters
  const nextIdRef = useRef(0);
  const waveTimerRef = useRef(WAVE_INTERVAL);

  // Keys
  const keysRef = useRef<Set<string>>(new Set());

  // Damage numbers
  const damageNumbersRef = useRef<DamageNumber[]>([]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => keysRef.current.add(e.code);
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // Game loop (60fps)
  useEffect(() => {
    if (!alive) return;

    let lastTime = performance.now();
    let rafId: number;

    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Timer
      setTimer((prev) => Math.max(0, prev - dt));

      // Wave spawning
      waveTimerRef.current -= dt;
      if (waveTimerRef.current <= 0) {
        waveTimerRef.current = WAVE_INTERVAL;
        setWave((w) => w + 1);
        spawnWave();
      }

      // Enemy AI: move toward player
      const px = playerPosRef.current.x;
      const pz = playerPosRef.current.z;
      let playerDamage = 0;

      for (const enemy of enemiesRef.current) {
        const dx = px - enemy.x;
        const dz = pz - enemy.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.5) {
          enemy.x += (dx / dist) * enemy.speed * dt;
          enemy.z += (dz / dist) * enemy.speed * dt;
        }
        // Enemy attack (melee range 1.5m)
        if (dist < 1.5) {
          playerDamage += enemy.damage * dt;
        }
      }

      // Apply damage to player
      if (playerDamage > 0) {
        setHp((prev) => {
          const next = prev - playerDamage;
          if (next <= 0) {
            setAlive(false);
            return 0;
          }
          return next;
        });
      }

      // Auto-attack: damage nearest enemy
      const attackRange = BASE_ATTACK_RANGE;
      const dps = BASE_ATTACK_DPS * (1 + (tomes['damage'] || 0) * 0.15);
      let nearestIdx = -1;
      let nearestDist = Infinity;

      for (let i = 0; i < enemiesRef.current.length; i++) {
        const e = enemiesRef.current[i];
        const dx = e.x - px;
        const dz = e.z - pz;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < attackRange && d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      }

      if (nearestIdx >= 0) {
        const target = enemiesRef.current[nearestIdx];
        const dmgThisTick = dps * dt;

        // Critical check (5% base)
        const critChance = 5 + (tomes['crit_chance'] || 0) * 8;
        const roll = Math.random() * 100;
        const critCount = roll < critChance ? 1 : 0;
        const critMult = critCount > 0 ? 2.0 + (tomes['crit_damage'] || 0) * 0.2 : 1.0;
        const finalDmg = dmgThisTick * critMult;

        target.hp -= finalDmg;

        // Spawn damage number
        addDamageNumber(damageNumbersRef, target.x, target.z, finalDmg, critCount, 'physical');

        if (target.hp <= 0) {
          // Kill: spawn XP crystal
          nextIdRef.current++;
          crystalsRef.current.push({
            id: `xp_${nextIdRef.current}`,
            x: target.x,
            z: target.z,
            value: target.maxHp * 0.1 * (target.isElite ? 3 : 1),
          });
          enemiesRef.current.splice(nearestIdx, 1);
          setKills((k) => k + 1);
        }
      }

      // XP collection (magnet range)
      const magnetR = MAGNET_RANGE + (tomes['magnet'] || 0) * 1;
      let xpGain = 0;
      crystalsRef.current = crystalsRef.current.filter((c) => {
        const dx = c.x - px;
        const dz = c.z - pz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < magnetR) {
          xpGain += c.value * (1 + (tomes['xp'] || 0) * 0.15);
          return false;
        }
        return true;
      });

      if (xpGain > 0 && !levelUpChoices) {
        setXp((prev) => {
          let newXP = prev + xpGain;
          let currentXPToNext = xpToNext;
          let newLevel = level;
          let newMaxHp = maxHp;
          let leveled = false;

          while (newXP >= currentXPToNext && newLevel < 99) {
            newXP -= currentXPToNext;
            newLevel++;
            currentXPToNext = 50 + newLevel * 30;
            newMaxHp *= 1.05;
            leveled = true;
          }

          if (leveled) {
            setLevel(newLevel);
            setXpToNext(currentXPToNext);
            setMaxHp(newMaxHp);
            setHp((h) => Math.min(h + newMaxHp * 0.05, newMaxHp));
            // Generate tome choices
            generateLevelUpChoices();
          }

          return newXP;
        });
      }

      // Sync to React state for rendering (throttled)
      setEnemyNet(
        enemiesRef.current.map((e) => ({
          id: e.id,
          type: e.type,
          x: e.x,
          z: e.z,
          hp: e.hp,
          maxHp: e.maxHp,
          isElite: e.isElite,
        }))
      );
      setCrystalNet(
        crystalsRef.current.map((c) => ({
          id: c.id,
          x: c.x,
          z: c.z,
          value: c.value,
        }))
      );

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alive, tomes, levelUpChoices, level, xpToNext, maxHp]);

  const spawnWave = useCallback(() => {
    const count = 6 + wave * 2;
    const types: Array<'zombie' | 'skeleton' | 'slime' | 'spider' | 'creeper'> = [
      'zombie',
      'skeleton',
      'slime',
      'spider',
      'creeper',
    ];

    for (let i = 0; i < count; i++) {
      nextIdRef.current++;
      const angle = Math.random() * Math.PI * 2;
      const dist = ARENA_RADIUS * (0.6 + Math.random() * 0.4);
      const t = types[Math.floor(Math.random() * types.length)];
      const isElite = Math.random() < 0.05 + wave * 0.02;

      const baseStats: Record<string, [number, number, number]> = {
        zombie: [100, 10, 2],
        skeleton: [80, 15, 3],
        slime: [150, 8, 1.5],
        spider: [60, 12, 5],
        creeper: [120, 80, 2.5],
      };
      const [baseHp, baseDmg, baseSpd] = baseStats[t] || [100, 10, 2];
      const waveMult = 1 + wave * 0.3;

      enemiesRef.current.push({
        id: `e_${nextIdRef.current}`,
        type: t,
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        hp: baseHp * waveMult * (isElite ? 3 : 1),
        maxHp: baseHp * waveMult * (isElite ? 3 : 1),
        isElite,
        speed: baseSpd * (isElite ? 1.5 : 1),
        damage: baseDmg * (1 + wave * 0.2) * (isElite ? 2 : 1),
      });
    }
  }, [wave]);

  const generateLevelUpChoices = useCallback(() => {
    const allTomes: ARTomeID[] = [
      'damage', 'attack_speed', 'crit_chance', 'crit_damage',
      'area', 'projectile', 'speed', 'hp',
      'shield', 'thorns', 'knockback', 'xp',
      'luck', 'magnet', 'dodge', 'cursed',
    ];

    const shuffled = [...allTomes].sort(() => Math.random() - 0.5);
    const rarities: Array<'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'> = [
      'common',
      'uncommon',
      'rare',
      'epic',
      'legendary',
    ];
    const choices: ARTomeOffer[] = shuffled.slice(0, 3).map((t) => {
      const roll = Math.random() * 100;
      let rarity: typeof rarities[number] = 'common';
      if (roll < 1) rarity = 'legendary';
      else if (roll < 5) rarity = 'epic';
      else if (roll < 20) rarity = 'rare';
      else if (roll < 50) rarity = 'uncommon';
      return { tomeId: t, rarity, stacks: 1 };
    });

    setLevelUpChoices(choices);
  }, []);

  const handleChooseTome = useCallback(
    (tomeId: string) => {
      setTomes((prev) => ({ ...prev, [tomeId]: (prev[tomeId] || 0) + 1 }));

      // Apply HP tome immediately
      if (tomeId === 'hp') {
        setMaxHp((prev) => {
          const bonus = prev * 0.1;
          setHp((h) => h + bonus);
          return prev + bonus;
        });
      }

      setLevelUpChoices(null);
    },
    []
  );

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#111',
        overflow: 'hidden',
      }}
    >
      {/* Character Selection Screen (Phase 3) */}
      {!gameStarted && (
        <ARCharacterSelect onSelect={handleCharacterSelect} />
      )}

      {/* 3D Canvas */}
      {gameStarted && (
        <ArenaCanvas
          enemies={enemyNet}
          xpCrystals={crystalNet}
          playerPosRef={playerPosRef}
          playerRotRef={playerRotRef}
          movingRef={movingRef}
          keysRef={keysRef}
          attackRange={BASE_ATTACK_RANGE}
          hpRatio={maxHp > 0 ? hp / maxHp : 1}
          alive={alive}
          damageNumbersRef={damageNumbersRef}
        />
      )}

      {/* HUD 오버레이 */}
      {gameStarted && (
        <ARHUD
          hp={hp}
          maxHp={maxHp}
          xp={xp}
          xpToNext={xpToNext}
          level={level}
          phase={phase}
          timer={timer}
          wave={wave}
          kills={kills}
          alive={alive}
        />
      )}

      {/* Active Synergies display (Phase 3) */}
      {gameStarted && activeSynergies.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 80,
            right: 16,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontFamily: '"Rajdhani", sans-serif',
          }}
        >
          {activeSynergies.map((synId) => {
            const info = SYNERGY_INFO[synId];
            return (
              <div
                key={synId}
                style={{
                  padding: '4px 10px',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  border: `1px solid ${info?.color || '#888'}`,
                  borderRadius: 4,
                  fontSize: 11,
                  color: info?.color || '#ccc',
                  fontWeight: 600,
                }}
              >
                {info?.name || synId}
              </div>
            );
          })}
        </div>
      )}

      {/* 레벨업 선택 */}
      {gameStarted && levelUpChoices && (
        <ARLevelUp
          level={level}
          choices={levelUpChoices}
          onChoose={handleChooseTome}
        />
      )}

      {/* 조작 가이드 */}
      {gameStarted && (
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            right: 16,
            fontSize: 11,
            color: '#666',
            fontFamily: '"Rajdhani", sans-serif',
            pointerEvents: 'none',
            zIndex: 50,
            textAlign: 'right',
          }}
        >
          <div>WASD: Move</div>
          <div>Mouse: Camera</div>
          <div>Click: Lock Cursor</div>
          <div>Auto-Attack: Enabled</div>
          {selectedCharacter && (
            <div style={{ color: '#CC9933', marginTop: 4 }}>
              {CHARACTER_INFO[selectedCharacter].name}: {CHARACTER_INFO[selectedCharacter].passive}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
