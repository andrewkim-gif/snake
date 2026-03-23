'use client';

/**
 * DefensePanel.tsx - 방어 시설 배치 패널
 * 좌측 슬라이드, 다크 테마
 */

import { useState } from 'react';
import {
  ShieldCheck, X, Coins, Hammer, Heart, Zap, Castle, Crosshair, ShieldAlert,
} from 'lucide-react';

// 방어 시설 타입 (서버 military_system.go와 동기화)
const DEFENSE_TYPES = [
  { type: 'bunker', name: 'Bunker', nameKo: '벙커', cost: 3000, hp: 500, dps: 0, desc: 'Infantry defense +50%', icon: 'ShieldAlert' },
  { type: 'turret', name: 'Turret', nameKo: '포탑', cost: 5000, hp: 300, dps: 20, desc: 'Auto-attack, DPS 20', icon: 'Crosshair' },
  { type: 'anti_air', name: 'Anti-Air', nameKo: '대공포', cost: 8000, hp: 400, dps: 15, desc: '2x damage to air', icon: 'Zap' },
  { type: 'wall', name: 'Wall', nameKo: '성벽', cost: 2000, hp: 1000, dps: 0, desc: 'Blocks ground units', icon: 'Castle' },
  { type: 'hq', name: 'HQ', nameKo: '본부', cost: 20000, hp: 2000, dps: 30, desc: 'HP+5000, auto-attack, 1 only', icon: 'ShieldCheck' },
] as const;

const ICON_MAP: Record<string, React.ReactNode> = {
  ShieldAlert: <ShieldAlert size={20} />,
  Crosshair: <Crosshair size={20} />,
  Zap: <Zap size={20} />,
  Castle: <Castle size={20} />,
  ShieldCheck: <ShieldCheck size={20} />,
};

// HQ 등급 색상
const RARITY_COLOR: Record<string, { border: string; bg: string; text: string }> = {
  hq: { border: 'border-yellow-500/50', bg: 'bg-yellow-900/15', text: 'text-yellow-400' },
  default: { border: 'border-slate-700/50', bg: 'bg-slate-800/50', text: 'text-slate-300' },
};

interface IDefensePanelProps {
  isOpen: boolean;
  onClose: () => void;
  regionCode: string;
  mcBalance: number;
  onBuildDefense: (regionCode: string, defenseType: string) => void;
}

export default function DefensePanel({
  isOpen,
  onClose,
  regionCode,
  mcBalance,
  onBuildDefense,
}: IDefensePanelProps) {
  const [building, setBuilding] = useState<string | null>(null);

  const handleBuild = (defenseType: string) => {
    setBuilding(defenseType);
    onBuildDefense(regionCode, defenseType);
    // 애니메이션 후 리셋
    setTimeout(() => setBuilding(null), 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 left-0 bottom-0 z-20 w-full sm:w-[360px] md:w-[400px] pointer-events-auto">
      <div className="h-full flex flex-col bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-md border-r border-slate-700/50 shadow-[4px_0_30px_rgba(0,0,0,0.5)]">
        {/* 헤더 */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50 bg-gradient-to-r from-blue-900/40 to-slate-900/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-blue-400" />
              <h2 className="text-white font-bold text-sm tracking-wide">DEFENSE</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-red-600/60 text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          {/* 지역 + MC 잔고 */}
          <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
            <span>Region: <span className="text-blue-300 font-medium">{regionCode}</span></span>
            <span className="flex items-center gap-1">
              <Coins size={12} className="text-yellow-400" />
              <span className="text-yellow-300 font-medium">{mcBalance.toLocaleString()} MC</span>
            </span>
          </div>
        </div>

        {/* 방어 시설 카드 목록 */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {DEFENSE_TYPES.map((def) => {
            const canAfford = mcBalance >= def.cost;
            const isBuilding = building === def.type;
            const rarity = def.type === 'hq' ? RARITY_COLOR.hq : RARITY_COLOR.default;

            return (
              <div
                key={def.type}
                className={`rounded-xl border ${rarity.border} ${rarity.bg} p-3 space-y-2 transition-all ${
                  isBuilding ? 'animate-pulse' : ''
                }`}
              >
                {/* 카드 헤더 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg bg-blue-900/40 flex items-center justify-center ${rarity.text}`}>
                      {ICON_MAP[def.icon]}
                    </div>
                    <div>
                      <div className="text-white text-sm font-semibold">{def.name}</div>
                      <div className="text-slate-500 text-[10px]">{def.nameKo}</div>
                    </div>
                  </div>
                  {def.type === 'hq' && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-600/30 text-yellow-400 border border-yellow-500/30">
                      UNIQUE
                    </span>
                  )}
                </div>

                {/* 스탯 */}
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1 text-green-400">
                    <Heart size={10} /> {def.hp.toLocaleString()} HP
                  </span>
                  {def.dps > 0 && (
                    <span className="flex items-center gap-1 text-red-400">
                      <Zap size={10} /> {def.dps} DPS
                    </span>
                  )}
                </div>

                {/* 설명 */}
                <p className="text-[11px] text-slate-400 leading-relaxed">{def.desc}</p>

                {/* 비용 + Build 버튼 */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-500">
                    <span className="text-yellow-400 font-medium">{def.cost.toLocaleString()}</span> MC
                  </span>
                  <button
                    onClick={() => canAfford && handleBuild(def.type)}
                    disabled={!canAfford || isBuilding}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      canAfford && !isBuilding
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_2px_0_#1e3a8a] active:shadow-none active:translate-y-0.5'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Hammer size={12} />
                    {isBuilding ? 'Building...' : 'Build'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 하단: 방어 시설 수 요약 */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-slate-700/50 bg-slate-900/80">
          <p className="text-[11px] text-slate-500 text-center">
            Defense structures are permanent. Destroyed in combat only.
          </p>
        </div>
      </div>
    </div>
  );
}
