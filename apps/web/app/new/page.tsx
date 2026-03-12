'use client';

/**
 * /new — 3D Voxel 게임 페이지 (v42 Phase 3: 레벨업 & 스킬 트리 연결)
 *
 * MatrixScene(R3F) + useSkillBuild + useCombo 훅 오케스트레이션.
 * 킬 → XP → 레벨업 → 스킬 선택 → 파워업 → 더 강한 적 도파민 루프 완성.
 *
 * 핵심 구조:
 *   page.tsx (훅 오케스트레이션 + DOM 오버레이)
 *   ├── useSkillBuild (standalone: 스킬 레벨/선택지 관리)
 *   ├── useCombo (standalone: 콤보 카운터/배율)
 *   ├── pausedRef (레벨업 중 게임 일시정지)
 *   ├── MatrixScene (R3F Canvas — pausedRef/onEnemyKill/onLevelUp 주입)
 *   └── MatrixLevelUp (Canvas 외부 DOM 오버레이)
 */

import { Suspense, useRef, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSkillBuild } from '@/lib/matrix/hooks/useSkillBuild';
import { useCombo } from '@/lib/matrix/hooks/useCombo';
import type { Enemy, WeaponType } from '@/lib/matrix/types';

// 동적 임포트: SSR 비활성화 (R3F/Three.js는 클라이언트 전용)
const MatrixScene = dynamic(
  () => import('@/components/game/matrix/MatrixScene').then(m => ({ default: m.MatrixScene })),
  { ssr: false },
);

const MatrixLevelUp = dynamic(
  () => import('@/components/game/matrix/MatrixLevelUp'),
  { ssr: false },
);

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
  // v42 Phase 3: 레벨업 UI 상태 (React state — UI 전용)
  // ============================================
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [currentWeaponsSnapshot, setCurrentWeaponsSnapshot] = useState<Record<string, number>>({});

  // 킬 카운트 ref (Phase 4 엘리트 스폰 확장용)
  const killCountRef = useRef(0);

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
  // v42 Phase 3: 적 처치 콜백 (콤보 등록)
  // XP는 GameLogic 내부에서 gem 수집으로 처리됨
  // ============================================
  const handleEnemyKill = useCallback((enemy: Enemy) => {
    killCountRef.current++;
    // 콤보 등록 (배율은 Phase 4에서 활용)
    combo.registerKill();
  }, [combo]);

  // ============================================
  // v42 Phase 3: 레벨업 콜백 (GameLogic에서 XP 임계값 감지 시 호출)
  // GameLogic이 pausedRef.current = true 설정 후 이 콜백 호출
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

      {/* 3D Scene — pausedRef + onEnemyKill + onLevelUp + playerSkillsMap 주입 */}
      <MatrixScene
        gameActive={true}
        pausedRef={pausedRef}
        onEnemyKill={handleEnemyKill}
        onLevelUp={handleLevelUp}
        playerSkillsMap={skillBuild.playerSkills}
      />

      {/* v42 Phase 3: 레벨업 카드 선택 UI (Canvas 외부 DOM 오버레이) */}
      {showLevelUp && (
        <MatrixLevelUp
          currentWeapons={currentWeaponsSnapshot}
          onSelect={handleLevelUpSelect}
          playerClass="neo"
        />
      )}
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
