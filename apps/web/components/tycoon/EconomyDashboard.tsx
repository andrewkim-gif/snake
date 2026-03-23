'use client';

/**
 * EconomyDashboard.tsx - 경제 현황 대시보드
 * 중앙 모달 (fixed overlay), 다크 테마
 */

import {
  X, Coins, TrendingUp, TrendingDown, Building2, Swords,
  MapPin, PiggyBank, BarChart3,
} from 'lucide-react';

interface IEconomyData {
  mcBalance: number;
  totalAssetValue: number;
  hourlyIncome: number;
  hourlyExpense: number;
  netHourly: number;
  buildingCount: number;
  armyCount: number;
  regionsOwned: number;
}

interface IEconomyDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  data: IEconomyData | null;
}

// 스탯 카드 정의
interface IStatCard {
  label: string;
  getValue: (d: IEconomyData) => string;
  getColor: (d: IEconomyData) => string;
  icon: React.ReactNode;
  suffix?: string;
}

const STAT_CARDS: IStatCard[] = [
  {
    label: 'MC Balance',
    getValue: (d) => d.mcBalance.toLocaleString(),
    getColor: () => 'text-emerald-400',
    icon: <Coins size={18} className="text-emerald-400" />,
    suffix: 'MC',
  },
  {
    label: 'Total Assets',
    getValue: (d) => d.totalAssetValue.toLocaleString(),
    getColor: () => 'text-blue-400',
    icon: <PiggyBank size={18} className="text-blue-400" />,
    suffix: 'MC',
  },
  {
    label: 'Hourly Income',
    getValue: (d) => `+${d.hourlyIncome.toLocaleString()}`,
    getColor: () => 'text-emerald-400',
    icon: <TrendingUp size={18} className="text-emerald-400" />,
    suffix: 'MC/h',
  },
  {
    label: 'Hourly Expense',
    getValue: (d) => `-${d.hourlyExpense.toLocaleString()}`,
    getColor: () => 'text-red-400',
    icon: <TrendingDown size={18} className="text-red-400" />,
    suffix: 'MC/h',
  },
  {
    label: 'Net Income',
    getValue: (d) => `${d.netHourly >= 0 ? '+' : ''}${d.netHourly.toLocaleString()}`,
    getColor: (d) => d.netHourly >= 0 ? 'text-emerald-400' : 'text-red-400',
    icon: <BarChart3 size={18} className="text-violet-400" />,
    suffix: 'MC/h',
  },
  {
    label: 'Buildings',
    getValue: (d) => d.buildingCount.toLocaleString(),
    getColor: () => 'text-amber-400',
    icon: <Building2 size={18} className="text-amber-400" />,
  },
  {
    label: 'Army Size',
    getValue: (d) => d.armyCount.toLocaleString(),
    getColor: () => 'text-red-400',
    icon: <Swords size={18} className="text-red-400" />,
    suffix: 'units',
  },
  {
    label: 'Regions Owned',
    getValue: (d) => d.regionsOwned.toLocaleString(),
    getColor: () => 'text-cyan-400',
    icon: <MapPin size={18} className="text-cyan-400" />,
  },
];

export default function EconomyDashboard({ isOpen, onClose, data }: IEconomyDashboardProps) {
  if (!isOpen || !data) return null;

  // 수익/지출 비율 계산
  const totalFlow = data.hourlyIncome + data.hourlyExpense;
  const incomePct = totalFlow > 0 ? (data.hourlyIncome / totalFlow) * 100 : 50;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-auto">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 본체 */}
      <div className="relative w-[90vw] max-w-[520px] bg-gradient-to-b from-slate-900/98 to-slate-950/98 border border-slate-700/50 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] overflow-hidden">
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-slate-700/50 bg-gradient-to-r from-blue-900/40 to-slate-900/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-400" />
              <h2 className="text-white font-bold text-sm tracking-wide">ECONOMY DASHBOARD</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-red-600/60 text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 4x2 스탯 그리드 */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STAT_CARDS.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3 flex flex-col items-center text-center space-y-1"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-900/60 flex items-center justify-center">
                {card.icon}
              </div>
              <div className={`text-lg font-bold ${card.getColor(data)}`}>
                {card.getValue(data)}
              </div>
              <div className="text-[10px] text-slate-500">
                {card.label}
                {card.suffix && <span className="ml-0.5 text-slate-600">{card.suffix}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* 하단: 수익/지출 비율 프로그레스 바 */}
        <div className="px-5 pb-5 pt-1">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Income vs Expense Ratio</div>
          <div className="h-3 bg-slate-700/60 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
              style={{ width: `${incomePct}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-red-400 to-red-600 transition-all duration-500"
              style={{ width: `${100 - incomePct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px]">
            <span className="text-emerald-400 font-medium">
              Income {incomePct.toFixed(1)}%
            </span>
            <span className="text-red-400 font-medium">
              Expense {(100 - incomePct).toFixed(1)}%
            </span>
          </div>

          {/* 순수익 요약 */}
          <div className="mt-3 rounded-lg bg-slate-800/60 border border-slate-700/40 p-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">Projected Daily Net</span>
            <span className={`text-sm font-bold ${data.netHourly >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {data.netHourly >= 0 ? '+' : ''}{(data.netHourly * 24).toLocaleString()} MC/day
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
