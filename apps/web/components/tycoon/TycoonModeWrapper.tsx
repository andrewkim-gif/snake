'use client';

/**
 * TycoonModeWrapper — 타이쿬 모드의 메인 오케스트레이터
 * CityTycoonView + 10개 UI 패널 + useTycoonSocket 통합
 * page.tsx에서 matrix 모드일 때 마운트
 */

import { lazy, Suspense, useState, useCallback } from 'react';
import {
  Swords, ShieldPlus, BarChart3, Handshake,
  Trophy, ArrowLeftRight, DollarSign, ArrowLeft,
} from 'lucide-react';

// 타이쿬 소켓 훅 (page.tsx에서 이미 호출하므로 props로 받음)
import type { IUseTycoonSocket } from '@/hooks/useTycoonSocket';

// 패널 컴포넌트들 — dynamic import 불필요 (가벼움)
import MilitaryPanel from './MilitaryPanel';
import DefensePanel from './DefensePanel';
import TradePanel from './TradePanel';
import DiplomacyPanel from './DiplomacyPanel';
import EconomyDashboard from './EconomyDashboard';
import TycoonLeaderboard from './TycoonLeaderboard';
import TycoonAlerts from './TycoonAlerts';
import TycoonNewsFeed from './TycoonNewsFeed';
import BattleReplayViewer from './BattleReplayViewer';
import AttackPlanner from './AttackPlanner';

// CityTycoonView는 무거우므로 lazy
const CityTycoonView = lazy(() =>
  import('@app-ingame/components/tycoon/CityTycoonView')
);

// ── 패널 상태 타입 ──
type TPanelId =
  | 'military' | 'defense' | 'trade'
  | 'diplomacy' | 'economy' | 'leaderboard'
  | 'attack' | 'replay' | null;

interface ITycoonModeWrapperProps {
  marketCap: number;
  onMarketCapChange?: (delta: number) => void;
  onExitToLobby: () => void;
  regionName: string;
  regionCode: string;
  tycoon?: IUseTycoonSocket;
}

// ── 상단 HUD 버튼 정의 ──
const HUD_BUTTONS = [
  { id: 'military' as const, icon: Swords, label: 'Military', color: '#ef4444' },
  { id: 'defense' as const, icon: ShieldPlus, label: 'Defense', color: '#3b82f6' },
  { id: 'trade' as const, icon: ArrowLeftRight, label: 'Trade', color: '#22c55e' },
  { id: 'diplomacy' as const, icon: Handshake, label: 'Diplomacy', color: '#a855f7' },
  { id: 'economy' as const, icon: DollarSign, label: 'Economy', color: '#f59e0b' },
  { id: 'leaderboard' as const, icon: Trophy, label: 'Rank', color: '#06b6d4' },
] as const;

export function TycoonModeWrapper({
  marketCap,
  onMarketCapChange,
  onExitToLobby,
  regionName,
  regionCode,
  tycoon,
}: ITycoonModeWrapperProps) {
  const [activePanel, setActivePanel] = useState<TPanelId>(null);

  const displayBalance = tycoon?.latestIncome?.new_balance ?? marketCap;

  const togglePanel = useCallback((id: TPanelId) => {
    setActivePanel(prev => prev === id ? null : id);
  }, []);

  const closePanel = useCallback(() => setActivePanel(null), []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      {/* ── 상단 HUD 바 ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 48,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: 4,
        zIndex: 200, borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* Globe 복귀 */}
        <button onClick={onExitToLobby} style={btnStyle}>
          <ArrowLeft size={16} /> Globe
        </button>

        {/* 지역명 */}
        <span style={{ color: '#fff', fontSize: 13, opacity: 0.7, marginLeft: 8 }}>
          {regionName}
        </span>

        <div style={{ flex: 1 }} />

        {/* 액션 버튼 6개 */}
        {HUD_BUTTONS.map(({ id, icon: Icon, label, color }) => (
          <button
            key={id}
            onClick={() => togglePanel(id)}
            style={{
              ...btnStyle,
              background: activePanel === id ? `${color}30` : 'transparent',
              borderColor: activePanel === id ? color : 'transparent',
              borderWidth: 1, borderStyle: 'solid',
            }}
          >
            <Icon size={14} color={activePanel === id ? color : '#94a3b8'} />
            <span style={{
              fontSize: 11, color: activePanel === id ? color : '#94a3b8',
              display: 'none', // 모바일에서 숨김
            }} className="hidden sm:inline">
              {label}
            </span>
          </button>
        ))}

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

        {/* MC 잔고 */}
        <div style={{ color: '#4ade80', fontSize: 14, fontWeight: 600 }}>
          {displayBalance.toLocaleString()} MC
        </div>
      </div>

      {/* ── CityTycoonView (3D 배경) — 상단 48px 여백 ── */}
      <div style={{ position: 'absolute', top: 48, left: 0, right: 0, bottom: 0 }}>
        <Suspense fallback={
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: '#0a0a0a', color: '#fff',
          }}>Loading City...</div>
        }>
          <CityTycoonView
            marketCap={displayBalance}
            onMarketCapChange={onMarketCapChange}
          />
        </Suspense>
      </div>

      {/* ── 슬라이드 패널들 ── */}

      {/* 우측: Military */}
      <MilitaryPanel
        isOpen={activePanel === 'military'}
        onClose={closePanel}
        mcBalance={displayBalance}
        onProduceUnits={(unitType, count) => tycoon?.produceUnits(unitType, count, regionCode)}
      />

      {/* 좌측: Defense */}
      <DefensePanel
        isOpen={activePanel === 'defense'}
        onClose={closePanel}
        regionCode={regionCode}
        mcBalance={displayBalance}
        onBuildDefense={(rc, dt) => tycoon?.buildDefense(rc, dt)}
      />

      {/* 우측: Trade */}
      <TradePanel
        isOpen={activePanel === 'trade'}
        onClose={closePanel}
        mcBalance={displayBalance}
        onTradeOrder={(bid, ot, p) => tycoon?.tradeOrder(bid, ot, p)}
      />

      {/* 좌측: Diplomacy */}
      <DiplomacyPanel
        isOpen={activePanel === 'diplomacy'}
        onClose={closePanel}
        mcBalance={displayBalance}
        onAllianceAction={(action, targetId) => tycoon?.allianceAction(action, { targetId })}
        onDeclareWar={(targetId) => tycoon?.declareWar(targetId)}
      />

      {/* 중앙: Economy Dashboard */}
      <EconomyDashboard
        isOpen={activePanel === 'economy'}
        onClose={closePanel}
        data={{
          mcBalance: displayBalance,
          totalAssetValue: 0,
          hourlyIncome: tycoon?.latestIncome?.total_earned ?? 0,
          hourlyExpense: 0,
          netHourly: tycoon?.latestIncome?.total_earned ?? 0,
          buildingCount: tycoon?.latestIncome?.building_count ?? 0,
          armyCount: 0,
          regionsOwned: tycoon?.territories.length ?? 0,
        }}
      />

      {/* 우측: Leaderboard */}
      <TycoonLeaderboard
        isOpen={activePanel === 'leaderboard'}
        onClose={closePanel}
      />

      {/* 중앙 모달: Attack Planner */}
      <AttackPlanner
        isOpen={activePanel === 'attack'}
        onClose={closePanel}
        targetRegion={regionCode}
        targetRegionName={regionName}
        onAttackOrder={(armyIds, target) => tycoon?.attackOrder(armyIds, target)}
      />

      {/* 중앙 모달: Battle Replay */}
      <BattleReplayViewer
        isOpen={activePanel === 'replay'}
        onClose={closePanel}
        battleResult={tycoon?.latestBattle ? {
          id: tycoon.latestBattle.battle_id,
          attacker_id: tycoon.latestBattle.attacker_id,
          defender_id: tycoon.latestBattle.defender_id,
          target_region: tycoon.latestBattle.target_region,
          result: tycoon.latestBattle.result,
          mc_looted: tycoon.latestBattle.mc_looted,
          replay_frames: [],
          duration_ticks: 180,
        } : null}
      />

      {/* ── 항상 표시되는 오버레이 UI ── */}

      {/* 우상단: 공격 알림 + 수익 토스트 */}
      <TycoonAlerts
        alerts={tycoon?.alerts ?? []}
        latestIncome={tycoon?.latestIncome ?? null}
      />

      {/* 하단: 뉴스 마키 티커 */}
      <TycoonNewsFeed news={tycoon?.news ?? []} />
    </div>
  );
}

// 공통 버튼 스타일
const btnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#fff',
  cursor: 'pointer', fontSize: 13, padding: '4px 8px',
  borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4,
  transition: 'all 0.15s',
};
