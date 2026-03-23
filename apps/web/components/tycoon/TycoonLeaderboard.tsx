'use client';

import { useState, useMemo } from 'react';
import {
  X,
  Trophy,
  Medal,
  DollarSign,
  Building2,
  Swords,
  Globe,
  Users,
} from 'lucide-react';

// ─── 인터페이스 ───
interface ILeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  value: number;
}

interface ITycoonLeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
  /** 현재 플레이어 ID (하이라이트용) */
  currentPlayerId?: string;
}

// ─── 탭 정의 ───
type TLeaderboardTab = 'richest' | 'landlord' | 'conqueror' | 'empire' | 'alliance';

interface ITabConfig {
  key: TLeaderboardTab;
  label: string;
  icon: typeof DollarSign;
  unit: string;
}

const TABS: ITabConfig[] = [
  { key: 'richest', label: 'Richest', icon: DollarSign, unit: 'MC' },
  { key: 'landlord', label: 'Landlord', icon: Building2, unit: 'buildings' },
  { key: 'conqueror', label: 'Conqueror', icon: Swords, unit: 'wins' },
  { key: 'empire', label: 'Empire', icon: Globe, unit: 'territories' },
  { key: 'alliance', label: 'Alliance', icon: Users, unit: 'MC (total)' },
];

// ─── 데모 데이터 (서버 연동 전 임시) ───
const DEMO_NAMES = [
  'CryptoKing', 'DiamondHands', 'MoonWalker', 'BlockBaron',
  'HashLord', 'TokenTiger', 'ChainMaster', 'SatoshiJr',
  'WhaleWatch', 'MintMaster',
];

function generateDemoData(tab: TLeaderboardTab): ILeaderboardEntry[] {
  const multipliers: Record<TLeaderboardTab, number> = {
    richest: 100_000,
    landlord: 50,
    conqueror: 200,
    empire: 30,
    alliance: 500_000,
  };
  const mult = multipliers[tab];
  return DEMO_NAMES.map((name, i) => ({
    rank: i + 1,
    playerId: `demo_${i}`,
    playerName: name,
    value: Math.round(mult * (DEMO_NAMES.length - i) * (0.8 + Math.random() * 0.4)),
  })).sort((a, b) => b.value - a.value)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

// ─── 메달 색상 (1~3위) ───
const MEDAL_COLORS = ['text-yellow-400', 'text-gray-300', 'text-amber-600'] as const;

/** 우측 슬라이드 패널 — 5종 리더보드 */
export default function TycoonLeaderboard({
  isOpen,
  onClose,
  currentPlayerId,
}: ITycoonLeaderboardProps) {
  const [activeTab, setActiveTab] = useState<TLeaderboardTab>('richest');

  // 탭별 데모 데이터 — 탭 변경 시 재생성
  const entries = useMemo(() => generateDemoData(activeTab), [activeTab]);

  const activeConfig = TABS.find((t) => t.key === activeTab)!;

  return (
    <>
      {/* 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* 슬라이드 패널 */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-80 bg-gray-900 border-l border-gray-700
          shadow-2xl transition-transform duration-300 ease-in-out flex flex-col
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-bold text-white">Leaderboard</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
            aria-label="Close leaderboard"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 탭 바 */}
        <div className="flex border-b border-gray-700 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 py-2 px-1 text-[10px]
                  font-medium transition-colors border-b-2
                  ${isActive
                    ? 'border-yellow-400 text-yellow-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'}`}
              >
                <TabIcon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 랭킹 목록 */}
        <div className="flex-1 overflow-y-auto p-2">
          {entries.map((entry) => {
            const isCurrentPlayer = currentPlayerId === entry.playerId;
            const isMedal = entry.rank <= 3;
            return (
              <div
                key={entry.playerId}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors
                  ${isCurrentPlayer
                    ? 'bg-green-900/40 border border-green-500/30'
                    : 'hover:bg-gray-800/50'}`}
              >
                {/* 순위 */}
                <div className="w-8 flex-shrink-0 text-center">
                  {isMedal ? (
                    <Medal className={`w-5 h-5 mx-auto ${MEDAL_COLORS[entry.rank - 1]}`} />
                  ) : (
                    <span className="text-sm text-gray-500 font-mono">{entry.rank}</span>
                  )}
                </div>

                {/* 이름 */}
                <span
                  className={`flex-1 text-sm truncate ${
                    isCurrentPlayer ? 'text-green-300 font-semibold' : 'text-gray-200'
                  }`}
                >
                  {entry.playerName}
                </span>

                {/* 값 */}
                <span className="text-sm font-mono text-gray-300">
                  {entry.value.toLocaleString()}
                </span>
                <span className="text-[10px] text-gray-500 w-14 text-right">
                  {activeConfig.unit}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
