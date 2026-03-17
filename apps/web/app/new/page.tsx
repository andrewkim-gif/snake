'use client';

/**
 * /new — 3D Voxel 게임 페이지 (v42 Phase 5: 분기 진화 & 폴리싱)
 *
 * MatrixScene(R3F) + useSkillBuild + useCombo 훅 오케스트레이션.
 * 킬 → XP → 레벨업 → 스킬 선택 → 파워업 → 더 강한 적 도파민 루프 완성.
 *
 * Phase 5 추가:
 *   - BranchSelectModal: Lv.11 도달 시 Path A/B 선택 UI
 *   - 궁극기 해금: Lv.20 도달 시 Ultimate 무기 활성화 + 전체 화면 이펙트
 *   - PostProcessing: Bloom + Vignette 이펙트 활성화
 *   - 피드백 강화: 크리티컬 연타, 킬 스트릭, 콤보 시각 피드백
 *
 * 핵심 구조:
 *   page.tsx (훅 오케스트레이션 + DOM 오버레이)
 *   ├── useSkillBuild (standalone: 스킬 레벨/선택지 관리)
 *   ├── useCombo (standalone: 콤보 카운터/배율)
 *   ├── comboDamageMultiplierRef / comboXpMultiplierRef (배율 실시간 ref)
 *   ├── pausedRef (레벨업 중 게임 일시정지)
 *   ├── MatrixScene (R3F Canvas — 모든 ref/콜백 주입)
 *   ├── MatrixLevelUp (Canvas 외부 DOM 오버레이)
 *   ├── BranchSelectModal (Lv.11 분기 선택 UI)
 *   ├── UltimateUnlockBanner (Lv.20 궁극기 해금 연출)
 *   ├── ComboGauge (콤보 시각 피드백)
 *   ├── KillStreakBanner (킬 스트릭 에스컬레이션)
 *   └── PhaseBanner (Wave 전환 텍스트 배너)
 */

import { Suspense, useRef, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSkillBuild } from '@/lib/matrix/hooks/useSkillBuild';
import { useCombo } from '@/lib/matrix/hooks/useCombo';
import type { Enemy, WeaponType } from '@/lib/matrix/types';
import type { WavePhaseName, EliteSpawnConfig } from '@/lib/matrix/config/wave-system.config';
import { SKILL_BRANCHES, BRANCH_UNLOCK_LEVEL, ULTIMATE_UNLOCK_LEVEL } from '@/lib/matrix/config/skills/branches';
import DebugSkillPanel from '@/components/game/matrix/3d/DebugSkillPanel';

// 동적 임포트: SSR 비활성화 (R3F/Three.js는 클라이언트 전용)
const MatrixScene = dynamic(
  () => import('@/components/game/matrix/MatrixScene').then(m => ({ default: m.MatrixScene })),
  { ssr: false },
);

const MatrixLevelUp = dynamic(
  () => import('@/components/game/matrix/MatrixLevelUp'),
  { ssr: false },
);

const BranchSelectModal = dynamic(
  () => import('@/components/game/matrix/BranchSelectModal'),
  { ssr: false },
);

// ============================================
// Phase 전환 배너 컴포넌트 (DOM 오버레이)
// ============================================

/** Phase 전환 배너 설정 */
const PHASE_BANNER_CONFIG: Record<WavePhaseName, {
  title: string;
  subtitle: string;
  color: string;
  glowColor: string;
}> = {
  SKIRMISH: {
    title: 'SKIRMISH',
    subtitle: '소규모 교전 시작',
    color: '#4ADE80',
    glowColor: 'rgba(74, 222, 128, 0.6)',
  },
  ENGAGEMENT: {
    title: 'ENGAGEMENT',
    subtitle: '본격 전투 돌입',
    color: '#FBBF24',
    glowColor: 'rgba(251, 191, 36, 0.6)',
  },
  SHOWDOWN: {
    title: 'SHOWDOWN',
    subtitle: '최종 결전',
    color: '#EF4444',
    glowColor: 'rgba(239, 68, 68, 0.6)',
  },
};

/** Phase 전환 배너 — 3초간 표시 후 페이드아웃 */
function PhaseBanner({ phase, onComplete }: { phase: WavePhaseName | null; onComplete: () => void }) {
  const [opacity, setOpacity] = useState(0);
  const [scale, setScale] = useState(0.5);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!phase) return;

    // 페이드인 (0.3초)
    requestAnimationFrame(() => {
      setOpacity(1);
      setScale(1);
    });

    // 3초 후 페이드아웃
    timerRef.current = setTimeout(() => {
      setOpacity(0);
      setScale(1.2);
      // 페이드아웃 완료 후 콜백
      setTimeout(onComplete, 500);
    }, 2500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, onComplete]);

  if (!phase) return null;

  const config = PHASE_BANNER_CONFIG[phase];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      pointerEvents: 'none',
      opacity,
      transform: `scale(${scale})`,
      transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
    }}>
      {/* 메인 타이틀 */}
      <div style={{
        fontFamily: '"Black Ops One", "Rajdhani", sans-serif',
        fontSize: 'clamp(36px, 8vw, 72px)',
        fontWeight: 900,
        color: config.color,
        textShadow: `0 0 30px ${config.glowColor}, 0 0 60px ${config.glowColor}, 0 2px 4px rgba(0,0,0,0.8)`,
        letterSpacing: '0.15em',
        lineHeight: 1,
      }}>
        {config.title}
      </div>
      {/* 서브타이틀 */}
      <div style={{
        fontFamily: '"Rajdhani", sans-serif',
        fontSize: 'clamp(14px, 3vw, 24px)',
        color: 'rgba(255,255,255,0.7)',
        marginTop: 8,
        letterSpacing: '0.1em',
        textShadow: '0 1px 3px rgba(0,0,0,0.6)',
      }}>
        {config.subtitle}
      </div>
      {/* 구분선 */}
      <div style={{
        width: 'clamp(100px, 30vw, 300px)',
        height: 2,
        background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
        marginTop: 12,
        opacity: 0.6,
      }} />
    </div>
  );
}

/** 엘리트 스폰 알림 배너 */
function EliteSpawnBanner({ config, onComplete }: { config: EliteSpawnConfig | null; onComplete: () => void }) {
  const [opacity, setOpacity] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!config) return;

    requestAnimationFrame(() => setOpacity(1));

    timerRef.current = setTimeout(() => {
      setOpacity(0);
      setTimeout(onComplete, 400);
    }, 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [config, onComplete]);

  if (!config) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '20%',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10001,
      pointerEvents: 'none',
      opacity,
      transition: 'opacity 0.3s ease-out',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: '"Black Ops One", "Rajdhani", sans-serif',
        fontSize: 'clamp(20px, 4vw, 36px)',
        fontWeight: 900,
        color: config.color,
        textShadow: `0 0 20px ${config.color}80, 0 2px 4px rgba(0,0,0,0.8)`,
        letterSpacing: '0.1em',
      }}>
        {config.name} APPEARED!
      </div>
      <div style={{
        fontFamily: '"Rajdhani", sans-serif',
        fontSize: 'clamp(12px, 2vw, 18px)',
        color: 'rgba(255,255,255,0.6)',
        marginTop: 4,
      }}>
        HP x{config.hpMultiplier} / DMG x{config.damageMultiplier}
      </div>
    </div>
  );
}

// ============================================
// v42 Phase 5: 궁극기 해금 배너 (Lv.20)
// ============================================

/** 궁극기 해금 — 전체 화면 폭발 이펙트 배너 */
function UltimateUnlockBanner({ active, onComplete }: { active: boolean; onComplete: () => void }) {
  const [phase, setPhase] = useState<'flash' | 'text' | 'fade' | 'done'>('done');

  useEffect(() => {
    if (!active) return;
    // 1단계: 화면 밝기 최대 (화이트 플래시)
    setPhase('flash');
    const t1 = setTimeout(() => setPhase('text'), 600);
    const t2 = setTimeout(() => setPhase('fade'), 3000);
    const t3 = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active, onComplete]);

  if (phase === 'done') return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10002,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* 화이트 플래시 배경 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: phase === 'flash' ? '#ffffff' : 'rgba(0,0,0,0.6)',
        opacity: phase === 'fade' ? 0 : 1,
        transition: phase === 'flash' ? 'none' : 'background 0.5s, opacity 0.8s',
      }} />
      {/* 텍스트 */}
      {(phase === 'text' || phase === 'fade') && (
        <div style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          opacity: phase === 'fade' ? 0 : 1,
          transform: phase === 'fade' ? 'scale(1.3)' : 'scale(1)',
          transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
        }}>
          <div style={{
            fontFamily: '"Black Ops One", "Rajdhani", sans-serif',
            fontSize: 'clamp(28px, 7vw, 56px)',
            fontWeight: 900,
            color: '#FFD700',
            textShadow: '0 0 40px rgba(255,215,0,0.8), 0 0 80px rgba(255,215,0,0.4), 0 2px 4px rgba(0,0,0,0.8)',
            letterSpacing: '0.2em',
          }}>
            ULTIMATE UNLOCKED
          </div>
          <div style={{
            fontFamily: '"Rajdhani", sans-serif',
            fontSize: 'clamp(14px, 3vw, 22px)',
            color: 'rgba(255,255,255,0.8)',
            marginTop: 8,
            letterSpacing: '0.1em',
          }}>
            Lv.20 — All enemies will feel your wrath
          </div>
          <div style={{
            width: 'clamp(120px, 40vw, 350px)',
            height: 2,
            background: 'linear-gradient(90deg, transparent, #FFD700, transparent)',
            margin: '16px auto 0',
          }} />
        </div>
      )}
    </div>
  );
}

// ============================================
// v42 Phase 5: 콤보 게이지 (좌측 하단 시각 피드백)
// ============================================

/** 콤보 시각 게이지 — 현재 콤보 티어 + 진행률 표시 */
function ComboGauge({ comboTier, comboCount, comboTimer, maxTimer }: {
  comboTier: string;
  comboCount: number;
  comboTimer: number;
  maxTimer: number;
}) {
  if (comboCount <= 0) return null;

  // 콤보 티어별 색상
  const tierColors: Record<string, string> = {
    none: '#666', bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700',
    diamond: '#00FFFF', platinum: '#E5E4E2', master: '#FF6B6B',
    grandmaster: '#FF4444', legend: '#FF00FF', mythic: '#9400D3',
    transcendent: '#FFD700',
  };
  const color = tierColors[comboTier] ?? '#FFD700';
  const timerProgress = maxTimer > 0 ? Math.max(0, comboTimer / maxTimer) : 0;

  return (
    <div style={{
      position: 'fixed',
      bottom: 100,
      left: 12,
      zIndex: 9998,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 2,
    }}>
      {/* 콤보 카운트 + 티어 */}
      <div style={{
        fontFamily: '"Black Ops One", "Rajdhani", sans-serif',
        fontSize: comboCount >= 50 ? 18 : 14,
        fontWeight: 900,
        color,
        textShadow: `0 0 8px ${color}80, 0 1px 2px rgba(0,0,0,0.8)`,
        letterSpacing: '0.05em',
        transition: 'font-size 0.2s',
      }}>
        {comboCount}x COMBO
      </div>
      {/* 티어 이름 */}
      {comboTier !== 'none' && (
        <div style={{
          fontFamily: '"Rajdhani", sans-serif',
          fontSize: 10,
          color,
          letterSpacing: '0.15em',
          opacity: 0.8,
        }}>
          {comboTier.toUpperCase()}
        </div>
      )}
      {/* 타이머 바 */}
      <div style={{
        width: 60,
        height: 3,
        background: 'rgba(255,255,255,0.15)',
        borderRadius: 2,
      }}>
        <div style={{
          width: `${timerProgress * 100}%`,
          height: '100%',
          background: color,
          borderRadius: 2,
          transition: 'width 0.1s linear',
        }} />
      </div>
    </div>
  );
}

// ============================================
// v42 Phase 5: 킬 스트릭 배너 (연속 킬 에스컬레이션)
// ============================================

const KILL_STREAK_CONFIG = [
  { threshold: 10, text: 'KILLING SPREE', color: '#4ADE80' },
  { threshold: 25, text: 'RAMPAGE', color: '#FBBF24' },
  { threshold: 50, text: 'UNSTOPPABLE', color: '#F97316' },
  { threshold: 100, text: 'GODLIKE', color: '#EF4444' },
  { threshold: 200, text: 'LEGENDARY', color: '#A855F7' },
  { threshold: 300, text: 'BEYOND GODLIKE', color: '#FFD700' },
];

function KillStreakBanner({ killCount, visible, onComplete }: {
  killCount: number;
  visible: boolean;
  onComplete: () => void;
}) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (!visible) return;
    requestAnimationFrame(() => setOpacity(1));
    const t = setTimeout(() => {
      setOpacity(0);
      setTimeout(onComplete, 400);
    }, 1500);
    return () => clearTimeout(t);
  }, [visible, onComplete]);

  if (!visible) return null;

  // 현재 킬 카운트에 맞는 가장 높은 스트릭 찾기
  let streak = KILL_STREAK_CONFIG[0];
  for (const s of KILL_STREAK_CONFIG) {
    if (killCount >= s.threshold) streak = s;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '30%',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10001,
      pointerEvents: 'none',
      opacity,
      transition: 'opacity 0.3s ease-out',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: '"Black Ops One", "Rajdhani", sans-serif',
        fontSize: 'clamp(18px, 4vw, 32px)',
        fontWeight: 900,
        color: streak.color,
        textShadow: `0 0 20px ${streak.color}80, 0 2px 4px rgba(0,0,0,0.8)`,
        letterSpacing: '0.12em',
      }}>
        {streak.text}!
      </div>
      <div style={{
        fontFamily: '"Rajdhani", sans-serif',
        fontSize: 'clamp(11px, 2vw, 16px)',
        color: 'rgba(255,255,255,0.6)',
        marginTop: 4,
      }}>
        {killCount} Kills
      </div>
    </div>
  );
}

// ============================================
// Scene3DPage — 메인 페이지 컴포넌트
// ============================================

function Scene3DPage() {
  // ============================================
  // v42 Phase 3: 일시정지 ref (레벨업 중 게임 멈춤)
  // ============================================
  const pausedRef = useRef(false);

  // ============================================
  // v42 Phase 3: 스킬 빌드 시스템 (standalone 재사용)
  // ============================================
  const skillBuild = useSkillBuild('neo');

  // ============================================
  // v42 Phase 3: 콤보 시스템 (standalone 재사용)
  // ============================================
  const combo = useCombo();

  // ============================================
  // v42 Phase 4: 콤보 배율 ref (매 프레임 GameLogic/useBlockWeapons에서 읽음)
  // React state가 아닌 ref로 60fps 유지
  // ============================================
  const comboDamageMultiplierRef = useRef(1.0);
  const comboXpMultiplierRef = useRef(1.0);

  // ============================================
  // v42 Phase 3: 레벨업 UI 상태 (React state — UI 전용)
  // ============================================
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [currentWeaponsSnapshot, setCurrentWeaponsSnapshot] = useState<Record<string, number>>({});

  // v42 Phase 4: 킬 카운트 ref (엘리트 스폰 트리거)
  const killCountRef = useRef(0);

  // v42 Phase 4: Wave 페이즈 배너 상태
  const [activePhaseBanner, setActivePhaseBanner] = useState<WavePhaseName | null>(null);

  // v42 Phase 4: 엘리트 스폰 알림 상태
  const [activeEliteBanner, setActiveEliteBanner] = useState<EliteSpawnConfig | null>(null);

  // ============================================
  // v42 Phase 5: 분기 선택 + 궁극기 + 킬스트릭 + 콤보 표시 상태
  // ============================================
  const [showBranchSelect, setShowBranchSelect] = useState(false);
  const [branchSelectWeapon, setBranchSelectWeapon] = useState<WeaponType | null>(null);
  const [showUltimateBanner, setShowUltimateBanner] = useState(false);
  const [showKillStreak, setShowKillStreak] = useState(false);
  const lastKillStreakRef = useRef(0);
  // 궁극기 상태: 해금 여부 + 쿨다운 (ref 기반)
  const ultimateUnlockedRef = useRef(false);
  const ultimateCooldownRef = useRef(0);
  // 콤보 표시용 state (100ms 폴링)
  const [comboDisplay, setComboDisplay] = useState({ tier: 'none', count: 0, timer: 0, maxTimer: 3 });
  // 보류 중인 레벨업 레벨 (분기 선택 후 레벨업 카드 표시)
  const pendingLevelRef = useRef(0);

  // ============================================
  // 초기 무기 부여 (게임 시작 시 knife Lv.1)
  // ============================================
  const initialWeaponApplied = useRef(false);
  useEffect(() => {
    if (!initialWeaponApplied.current) {
      initialWeaponApplied.current = true;
      // useSkillBuild에 초기 무기 등록 → playerSkillsMap으로 MatrixScene에 전파
      skillBuild.applyLevelUp('knife' as WeaponType);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // v42 Phase 4+5: 콤보 배율 동기화 + 콤보 표시 UI 업데이트
  // useEffect interval로 매 100ms 폴링
  // ============================================
  useEffect(() => {
    const interval = setInterval(() => {
      const mults = combo.getMultipliers();
      comboDamageMultiplierRef.current = mults.damage;
      comboXpMultiplierRef.current = mults.xp;
      // Phase 5: 콤보 게이지 표시용 state 업데이트
      const comboState = combo.comboRef.current;
      setComboDisplay({
        tier: comboState.tier,
        count: comboState.count,
        timer: comboState.timer,
        maxTimer: 3,
      });
    }, 100);
    return () => clearInterval(interval);
  }, [combo]);

  // ============================================
  // v42 Phase 3+4+5: 적 처치 콜백 (콤보 등록 + 배율 + 킬스트릭)
  // ============================================
  const handleEnemyKill = useCallback((enemy: Enemy) => {
    killCountRef.current++;
    // 콤보 등록 → 배율 즉시 갱신
    combo.registerKill();
    const mults = combo.getMultipliers();
    comboDamageMultiplierRef.current = mults.damage;
    comboXpMultiplierRef.current = mults.xp;

    // Phase 5: 킬 스트릭 배너 체크
    const kc = killCountRef.current;
    for (const s of KILL_STREAK_CONFIG) {
      if (kc === s.threshold && kc > lastKillStreakRef.current) {
        lastKillStreakRef.current = kc;
        setShowKillStreak(true);
        break;
      }
    }
  }, [combo]);

  // ============================================
  // v42 Phase 3+5: 레벨업 콜백 — Lv.11 분기 / Lv.20 궁극기 감지
  // ============================================
  const handleLevelUp = useCallback((level: number) => {
    // 현재 무기 상태 스냅샷 생성 (MatrixLevelUp에 전달)
    const weaponSnapshot: Record<string, number> = {};
    skillBuild.playerSkills.forEach((lvl, skill) => {
      weaponSnapshot[skill] = lvl;
    });
    setCurrentWeaponsSnapshot(weaponSnapshot);

    // Phase 5: Lv.20 궁극기 해금 체크
    if (level >= ULTIMATE_UNLOCK_LEVEL && !ultimateUnlockedRef.current) {
      ultimateUnlockedRef.current = true;
      setShowUltimateBanner(true);
      // 궁극기 배너 끝나면 레벨업 카드 표시
      pendingLevelRef.current = level;
      return; // 배너 끝나면 레벨업 표시
    }

    // Phase 5: Lv.11 분기 선택 체크 — 가장 높은 레벨 무기에 분기가 있는지
    if (level >= BRANCH_UNLOCK_LEVEL) {
      // 분기 선택이 필요한 무기 찾기 (레벨 10에 도달한 무기 중 분기 미선택)
      let needsBranch: WeaponType | null = null;
      skillBuild.playerSkills.forEach((wLvl, skill) => {
        if (wLvl >= 10 && SKILL_BRANCHES[skill] && !skillBuild.branchChoices.has(skill as WeaponType)) {
          needsBranch = skill as WeaponType;
        }
      });
      if (needsBranch) {
        setBranchSelectWeapon(needsBranch);
        setShowBranchSelect(true);
        pendingLevelRef.current = level;
        return; // 분기 선택 후 레벨업 표시
      }
    }

    // 일반 레벨업 UI 표시
    setShowLevelUp(true);
  }, [skillBuild.playerSkills, skillBuild.branchChoices]);

  // ============================================
  // v42 Phase 3: 레벨업 선택 처리
  // ============================================
  const handleLevelUpSelect = useCallback((skillId: string) => {
    const weaponType = skillId as WeaponType;

    // useSkillBuild에 레벨업 적용 → playerSkills 업데이트 → MatrixScene 무기 동기화
    skillBuild.applyLevelUp(weaponType);

    // 레벨업 UI 닫기 + 게임 재개
    setShowLevelUp(false);
    pausedRef.current = false;
  }, [skillBuild]);

  // ============================================
  // v42 Phase 5: 분기 선택 처리 (Path A/B)
  // ============================================
  const handleBranchSelect = useCallback((branch: 'A' | 'B') => {
    if (!branchSelectWeapon) return;
    // useSkillBuild에 분기 등록
    skillBuild.selectBranch(branchSelectWeapon, branch);
    setShowBranchSelect(false);
    setBranchSelectWeapon(null);
    // 보류 중인 레벨업 카드 표시
    if (pendingLevelRef.current > 0) {
      setShowLevelUp(true);
      pendingLevelRef.current = 0;
    } else {
      pausedRef.current = false;
    }
  }, [branchSelectWeapon, skillBuild]);

  // ============================================
  // v42 Phase 5: 궁극기 배너 완료 콜백
  // ============================================
  const handleUltimateBannerComplete = useCallback(() => {
    setShowUltimateBanner(false);
    // 보류 중인 레벨업 카드 표시
    if (pendingLevelRef.current > 0) {
      setShowLevelUp(true);
      pendingLevelRef.current = 0;
    } else {
      pausedRef.current = false;
    }
  }, []);

  // ============================================
  // v42 Phase 5: 킬 스트릭 배너 완료 콜백
  // ============================================
  const handleKillStreakComplete = useCallback(() => {
    setShowKillStreak(false);
  }, []);

  // ============================================
  // v42 Phase 5: 궁극기 발동 (MatrixScene에서 호출)
  // 30초 쿨다운, 모든 적에 999 데미지
  // ============================================
  const handleUltimateActivate = useCallback(() => {
    // 궁극기 발동은 MatrixScene의 GameLogic에서 처리 (onUltimateActivate prop)
    // 여기서는 쿨다운 리셋만
    ultimateCooldownRef.current = 30;
  }, []);

  // ============================================
  // 디버그: 스킬 즉시 업그레이드
  // ============================================
  const handleDebugUpgrade = useCallback((skill: WeaponType) => {
    skillBuild.applyLevelUp(skill);
  }, [skillBuild]);

  // ============================================
  // v42 Phase 4: Wave 페이즈 전환 콜백
  // ============================================
  const handlePhaseChange = useCallback((phase: WavePhaseName) => {
    setActivePhaseBanner(phase);
  }, []);

  const handlePhaseBannerComplete = useCallback(() => {
    setActivePhaseBanner(null);
  }, []);

  // ============================================
  // v42 Phase 4: 엘리트 스폰 콜백
  // ============================================
  const handleEliteSpawn = useCallback((config: EliteSpawnConfig) => {
    setActiveEliteBanner(config);
  }, []);

  const handleEliteBannerComplete = useCallback(() => {
    setActiveEliteBanner(null);
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      overflow: 'hidden',
      backgroundColor: '#000',
      position: 'relative',
    }}>

      {/* 디버그 스킬 업그레이드 패널 (오른쪽 위) */}
      <DebugSkillPanel
        playerSkills={skillBuild.playerSkills}
        onUpgrade={handleDebugUpgrade}
      />

      {/* 3D Scene — 모든 ref/콜백 주입 (Phase 5: 분기/궁극기/이펙트 연동) */}
      <MatrixScene
        gameActive={true}
        pausedRef={pausedRef}
        onEnemyKill={handleEnemyKill}
        onLevelUp={handleLevelUp}
        playerSkillsMap={skillBuild.playerSkills}
        comboDamageMultiplierRef={comboDamageMultiplierRef}
        comboXpMultiplierRef={comboXpMultiplierRef}
        killCountRef={killCountRef}
        onPhaseChange={handlePhaseChange}
        onEliteSpawn={handleEliteSpawn}
        comboUpdate={combo.updateCombo}
        ultimateUnlockedRef={ultimateUnlockedRef}
        ultimateCooldownRef={ultimateCooldownRef}
      />

      {/* v42 Phase 3: 레벨업 카드 선택 UI (Canvas 외부 DOM 오버레이) */}
      {showLevelUp && (
        <MatrixLevelUp
          currentWeapons={currentWeaponsSnapshot}
          onSelect={handleLevelUpSelect}
          playerClass="neo"
        />
      )}

      {/* v42 Phase 5: 분기 선택 UI (Lv.11) */}
      {showBranchSelect && branchSelectWeapon && SKILL_BRANCHES[branchSelectWeapon] && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10003 }}>
          <BranchSelectModal
            skillName={branchSelectWeapon}
            skillColor="#CC9933"
            skillType={branchSelectWeapon as WeaponType}
            branchA={SKILL_BRANCHES[branchSelectWeapon].A}
            branchB={SKILL_BRANCHES[branchSelectWeapon].B}
            onSelect={handleBranchSelect}
          />
        </div>
      )}

      {/* v42 Phase 5: 궁극기 해금 배너 (Lv.20) */}
      <UltimateUnlockBanner
        active={showUltimateBanner}
        onComplete={handleUltimateBannerComplete}
      />

      {/* v42 Phase 5: 콤보 게이지 (좌측 하단) */}
      <ComboGauge
        comboTier={comboDisplay.tier}
        comboCount={comboDisplay.count}
        comboTimer={comboDisplay.timer}
        maxTimer={comboDisplay.maxTimer}
      />

      {/* v42 Phase 5: 킬 스트릭 배너 */}
      <KillStreakBanner
        killCount={killCountRef.current}
        visible={showKillStreak}
        onComplete={handleKillStreakComplete}
      />

      {/* v42 Phase 4: Wave 페이즈 전환 배너 (DOM 오버레이) */}
      <PhaseBanner
        phase={activePhaseBanner}
        onComplete={handlePhaseBannerComplete}
      />

      {/* v42 Phase 4: 엘리트 스폰 알림 배너 (DOM 오버레이) */}
      <EliteSpawnBanner
        config={activeEliteBanner}
        onComplete={handleEliteBannerComplete}
      />
    </div>
  );
}

export default function NewPage() {
  return (
    <Suspense fallback={
      <div style={{
        width: '100vw',
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        color: '#666',
        fontFamily: 'monospace',
        fontSize: 14,
      }}>
        LOADING 3D SCENE...
      </div>
    }>
      <Scene3DPage />
    </Suspense>
  );
}
