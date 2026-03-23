'use client';

/**
 * AttackPlanner.tsx - 공격 명령 모달
 * 중앙 팝업, 유닛 선택 + 공격 실행
 */

import { useState, useMemo } from 'react';
import {
  Swords, X, AlertTriangle, Clock, CheckSquare, Square, MapPin,
} from 'lucide-react';

// 유닛 타입 아이콘 매핑 (MilitaryPanel과 동기화)
const UNIT_TYPE_LABELS: Record<string, { name: string; nameKo: string }> = {
  infantry: { name: 'Infantry', nameKo: '보병' },
  armor: { name: 'Armor', nameKo: '기갑' },
  air: { name: 'Air Force', nameKo: '공군' },
  special: { name: 'Special Ops', nameKo: '특수부대' },
};

// 예상 이동 시간 (유닛 타입별, 초 단위)
const MOVE_TIME_BASE: Record<string, number> = {
  infantry: 300,
  armor: 240,
  air: 120,
  special: 180,
};

interface IArmy {
  id: string;
  unitType: string;
  count: number;
  status: string;
}

interface IAttackPlannerProps {
  isOpen: boolean;
  onClose: () => void;
  targetRegion: string;
  targetRegionName: string;
  onAttackOrder: (armyIds: string[], targetRegion: string) => void;
  // 보유 유닛 목록 (서버 데이터)
  armies?: IArmy[];
}

export default function AttackPlanner({
  isOpen,
  onClose,
  targetRegion,
  targetRegionName,
  onAttackOrder,
  armies = [],
}: IAttackPlannerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 체크박스 토글
  const toggleArmy = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 대기 상태 유닛만 선택 가능
  const availableArmies = useMemo(
    () => armies.filter((a) => a.status === 'idle' || a.status === 'stationed'),
    [armies],
  );

  // 선택된 유닛 총 병력수
  const selectedTotal = useMemo(() => {
    return availableArmies
      .filter((a) => selectedIds.has(a.id))
      .reduce((sum, a) => sum + a.count, 0);
  }, [availableArmies, selectedIds]);

  // 예상 이동 시간 (가장 느린 유닛 기준)
  const estimatedTime = useMemo(() => {
    const selected = availableArmies.filter((a) => selectedIds.has(a.id));
    if (selected.length === 0) return 0;
    return Math.max(...selected.map((a) => MOVE_TIME_BASE[a.unitType] ?? 300));
  }, [availableArmies, selectedIds]);

  const formatTime = (sec: number) => {
    if (sec >= 60) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    return `${sec}s`;
  };

  // 공격 실행
  const handleLaunch = () => {
    if (selectedIds.size === 0) return;
    onAttackOrder(Array.from(selectedIds), targetRegion);
    setSelectedIds(new Set());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-auto">
      {/* 백드롭 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* 모달 */}
      <div className="relative w-[90%] max-w-md rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-900/98 to-slate-950/98 backdrop-blur-lg shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-slate-700/50 bg-gradient-to-r from-red-900/30 to-slate-900/60 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords size={18} className="text-red-400" />
              <h2 className="text-white font-bold text-sm tracking-wide">ATTACK ORDER</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-red-600/60 text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
            <MapPin size={12} className="text-red-400" />
            <span>Target: <span className="text-red-300 font-medium">{targetRegionName}</span></span>
          </div>
        </div>

        {/* 경고 배너 */}
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-amber-900/20 border border-amber-700/30 px-3 py-2">
          <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-amber-300/80 leading-relaxed">
            Daily limit: 3 attacks. 12-hour cooldown between attacks on the same region.
          </p>
        </div>

        {/* 유닛 목록 */}
        <div className="px-4 py-3 space-y-2 max-h-[260px] overflow-y-auto">
          {availableArmies.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No available units. Produce units first.
            </div>
          ) : (
            availableArmies.map((army) => {
              const isSelected = selectedIds.has(army.id);
              const label = UNIT_TYPE_LABELS[army.unitType];
              return (
                <button
                  key={army.id}
                  onClick={() => toggleArmy(army.id)}
                  className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${
                    isSelected
                      ? 'border-red-500/50 bg-red-900/20'
                      : 'border-slate-700/40 bg-slate-800/30 hover:bg-slate-800/60'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare size={16} className="text-red-400 flex-shrink-0" />
                  ) : (
                    <Square size={16} className="text-slate-600 flex-shrink-0" />
                  )}
                  <div className="flex-1 text-left">
                    <div className="text-white text-xs font-medium">
                      {label?.name ?? army.unitType}
                      <span className="text-slate-500 ml-1 font-normal">({label?.nameKo})</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      x{army.count} units | Status: {army.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Clock size={10} />
                    <span>{formatTime(MOVE_TIME_BASE[army.unitType] ?? 300)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* 하단: 요약 + 공격 버튼 */}
        <div className="px-5 py-4 border-t border-slate-700/50 space-y-3">
          {/* 선택 요약 */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Selected: <span className="text-white font-medium">{selectedIds.size} armies ({selectedTotal} units)</span>
            </span>
            {estimatedTime > 0 && (
              <span className="text-slate-500 flex items-center gap-1">
                <Clock size={10} />
                ETA {formatTime(estimatedTime)}
              </span>
            )}
          </div>

          {/* Launch Attack 버튼 */}
          <button
            onClick={handleLaunch}
            disabled={selectedIds.size === 0}
            className={`w-full py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all ${
              selectedIds.size > 0
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_3px_0_#991b1b] active:shadow-none active:translate-y-0.5'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {selectedIds.size > 0 ? 'LAUNCH ATTACK' : 'Select Units'}
          </button>
        </div>
      </div>
    </div>
  );
}
