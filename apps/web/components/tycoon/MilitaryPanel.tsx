'use client';

/**
 * MilitaryPanel.tsx - 유닛 생산 + 주둔 현황 패널
 * 우측 슬라이드, 다크 테마
 */

import { useState, useMemo } from 'react';
import { Shield, Truck, Plane, Target, X, Minus, Plus, Coins } from 'lucide-react';

// 유닛 타입 정의 (서버 military_system.go와 동기화)
const UNIT_TYPES = [
  { type: 'infantry', name: 'Infantry', nameKo: '보병', cost: 500, time: 60, attack: 10, defense: 8, hp: 100, icon: 'Shield' },
  { type: 'armor', name: 'Armor', nameKo: '기갑', cost: 2000, time: 180, attack: 30, defense: 25, hp: 300, icon: 'Truck' },
  { type: 'air', name: 'Air Force', nameKo: '공군', cost: 5000, time: 300, attack: 40, defense: 15, hp: 200, icon: 'Plane' },
  { type: 'special', name: 'Special Ops', nameKo: '특수부대', cost: 10000, time: 600, attack: 50, defense: 20, hp: 150, icon: 'Target' },
] as const;

const ICON_MAP: Record<string, React.ReactNode> = {
  Shield: <Shield size={20} />,
  Truck: <Truck size={20} />,
  Plane: <Plane size={20} />,
  Target: <Target size={20} />,
};

// 수량 프리셋
const COUNT_PRESETS = [1, 5, 10] as const;

interface IMilitaryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mcBalance: number;
  onProduceUnits: (unitType: string, count: number) => void;
}

// 스탯 바 컴포넌트
function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-slate-500">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right text-slate-400">{value}</span>
    </div>
  );
}

export default function MilitaryPanel({ isOpen, onClose, mcBalance, onProduceUnits }: IMilitaryPanelProps) {
  // 각 유닛별 선택 수량 관리
  const [counts, setCounts] = useState<Record<string, number>>({
    infantry: 1,
    armor: 1,
    air: 1,
    special: 1,
  });

  // 수량 변경 핸들러
  const setCount = (unitType: string, value: number) => {
    setCounts((prev) => ({ ...prev, [unitType]: Math.max(1, Math.min(value, 99)) }));
  };

  // 총 비용 계산
  const totalCost = useMemo(() => {
    return UNIT_TYPES.reduce((sum, u) => sum + u.cost * (counts[u.type] ?? 1), 0);
  }, [counts]);

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 bottom-0 z-20 w-full sm:w-[380px] md:w-[420px] pointer-events-auto">
      <div className="h-full flex flex-col bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-md border-l border-slate-700/50 shadow-[-4px_0_30px_rgba(0,0,0,0.5)]">
        {/* 헤더 */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50 bg-gradient-to-r from-emerald-900/40 to-slate-900/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-emerald-400" />
              <h2 className="text-white font-bold text-sm tracking-wide">MILITARY</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-red-600/60 text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          {/* MC 잔고 표시 */}
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
            <Coins size={12} className="text-yellow-400" />
            <span>Balance: <span className="text-yellow-300 font-medium">{mcBalance.toLocaleString()} MC</span></span>
          </div>
        </div>

        {/* 유닛 카드 목록 */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {UNIT_TYPES.map((unit) => {
            const count = counts[unit.type] ?? 1;
            const unitCost = unit.cost * count;
            const canAfford = mcBalance >= unitCost;
            const timeStr = unit.time >= 60 ? `${Math.floor(unit.time / 60)}m` : `${unit.time}s`;

            return (
              <div
                key={unit.type}
                className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3 space-y-2"
              >
                {/* 유닛 헤더 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-900/40 flex items-center justify-center text-emerald-400">
                      {ICON_MAP[unit.icon]}
                    </div>
                    <div>
                      <div className="text-white text-sm font-semibold">{unit.name}</div>
                      <div className="text-slate-500 text-[10px]">{unit.nameKo} | {timeStr}/unit</div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <span className="text-yellow-400 font-medium">{unit.cost.toLocaleString()}</span> MC
                  </div>
                </div>

                {/* 스탯 바 */}
                <div className="space-y-1">
                  <StatBar label="ATK" value={unit.attack} max={50} color="bg-red-500" />
                  <StatBar label="DEF" value={unit.defense} max={30} color="bg-blue-500" />
                  <StatBar label="HP" value={unit.hp} max={300} color="bg-green-500" />
                </div>

                {/* 수량 선택 + Produce 버튼 */}
                <div className="flex items-center gap-2 pt-1">
                  {/* 수량 조절 */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCount(unit.type, count - 1)}
                      className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-8 text-center text-white text-sm font-medium">{count}</span>
                    <button
                      onClick={() => setCount(unit.type, count + 1)}
                      className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* 프리셋 버튼 */}
                  <div className="flex gap-1">
                    {COUNT_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setCount(unit.type, preset)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                          count === preset
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        x{preset}
                      </button>
                    ))}
                  </div>

                  {/* Produce 버튼 */}
                  <button
                    onClick={() => canAfford && onProduceUnits(unit.type, count)}
                    disabled={!canAfford}
                    className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      canAfford
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_2px_0_#065f46] active:shadow-none active:translate-y-0.5'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Produce ({unitCost.toLocaleString()})
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 하단: 총 비용 요약 */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-slate-700/50 bg-slate-900/80">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Total (all units)</span>
            <span className={`font-bold ${totalCost > mcBalance ? 'text-red-400' : 'text-yellow-300'}`}>
              {totalCost.toLocaleString()} MC
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
