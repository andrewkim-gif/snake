'use client';

/**
 * /new — 3D Voxel 게임 페이지 (v42 Phase 4: 콤보 & Wave 난이도)
 *
 * MatrixScene(R3F) + useSkillBuild + useCombo 훅 오케스트레이션.
 * 킬 → XP → 레벨업 → 스킬 선택 → 파워업 → 더 강한 적 도파민 루프 완성.
 *
 * Phase 4 추가:
 *   - 콤보 배율 → 데미지/XP에 실시간 적용
 *   - Wave 시스템 (SKIRMISH → ENGAGEMENT → SHOWDOWN)
 *   - 엘리트 몬스터 (100/200/300킬마다)
 *   - Phase 전환 텍스트 배너
 *
 * 핵심 구조:
 *   page.tsx (훅 오케스트레이션 + DOM 오버레이)
 *   ├── useSkillBuild (standalone: 스킬 레벨/선택지 관리)
 *   ├── useCombo (standalone: 콤보 카운터/배율)
 *   ├── comboDamageMultiplierRef / comboXpMultiplierRef (배율 실시간 ref)
 *   ├── pausedRef (레벨업 중 게임 일시정지)
 *   ├── MatrixScene (R3F Canvas — 모든 ref/콜백 주입)
 *   ├── MatrixLevelUp (Canvas 외부 DOM 오버레이)
 *   └── PhaseBanner (Wave 전환 텍스트 배너)
 */

import { Suspense, useRef, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSkillBuild } from '@/lib/matrix/hooks/useSkillBuild';
import { useCombo } from '@/lib/matrix/hooks/useCombo';
import type { Enemy, WeaponType } from '@/lib/matrix/types';
import type { WavePhaseName, EliteSpawnConfig } from '@/lib/matrix/config/wave-system.config';

// 동적 임포트: SSR 비활성화 (R3F/Three.js는 클라이언트 전용)
const MatrixScene = dynamic(
  () => import('@/components/game/matrix/MatrixScene').then(m => ({ default: m.MatrixScene })),
  { ssr: false },
);

const MatrixLevelUp = dynamic(
  () => import('@/components/game/matrix/MatrixLevelUp'),
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
  // v42 Phase 4: 콤보 배율 동기화 (킬/타이머 변경 시 ref 업데이트)
  // useEffect interval로 매 100ms 폴링 (ref 기반이라 state 변경 없음)
  // ============================================
  useEffect(() => {
    const interval = setInterval(() => {
      const mults = combo.getMultipliers();
      comboDamageMultiplierRef.current = mults.damage;
      comboXpMultiplierRef.current = mults.xp;
    }, 100);
    return () => clearInterval(interval);
  }, [combo]);

  // ============================================
  // v42 Phase 3+4: 적 처치 콜백 (콤보 등록 + 배율 즉시 업데이트)
  // ============================================
  const handleEnemyKill = useCallback((enemy: Enemy) => {
    killCountRef.current++;
    // 콤보 등록 → 배율 즉시 갱신
    combo.registerKill();
    const mults = combo.getMultipliers();
    comboDamageMultiplierRef.current = mults.damage;
    comboXpMultiplierRef.current = mults.xp;
  }, [combo]);

  // ============================================
  // v42 Phase 3: 레벨업 콜백 (GameLogic에서 XP 임계값 감지 시 호출)
  // ============================================
  const handleLevelUp = useCallback((level: number) => {
    // 현재 무기 상태 스냅샷 생성 (MatrixLevelUp에 전달)
    const weaponSnapshot: Record<string, number> = {};
    skillBuild.playerSkills.forEach((lvl, skill) => {
      weaponSnapshot[skill] = lvl;
    });
    setCurrentWeaponsSnapshot(weaponSnapshot);

    // 레벨업 UI 표시 (게임은 이미 일시정지됨)
    setShowLevelUp(true);
  }, [skillBuild.playerSkills]);

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
      {/* 좌측 상단 정보 배지 */}
      <div style={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '6px 10px',
        background: 'rgba(0,0,0,0.8)',
        border: '1px solid #333',
        borderLeft: '3px solid #CC9933',
        backdropFilter: 'blur(4px)',
        fontFamily: '"Rajdhani", sans-serif',
        fontSize: 10,
        color: '#888',
        pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: '"Black Ops One", cursive',
          fontSize: 11,
          color: '#CC9933',
          letterSpacing: '0.08em',
        }}>
          3D VOXEL TEST
        </span>
        <span>Engine: <b style={{ color: '#E8E0D4' }}>Three.js R3F</b></span>
        <span>Mode: <b style={{ color: '#10B981' }}>3D Enhanced</b></span>
      </div>

      {/* 3D Scene — 모든 ref/콜백 주입 (Phase 4: 콤보/Wave/엘리트 연동) */}
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
      />

      {/* v42 Phase 3: 레벨업 카드 선택 UI (Canvas 외부 DOM 오버레이) */}
      {showLevelUp && (
        <MatrixLevelUp
          currentWeapons={currentWeaponsSnapshot}
          onSelect={handleLevelUpSelect}
          playerClass="neo"
        />
      )}

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
