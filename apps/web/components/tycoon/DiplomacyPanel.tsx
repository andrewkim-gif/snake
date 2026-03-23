'use client';

/**
 * DiplomacyPanel.tsx - 동맹 + 전쟁 외교 패널
 * 좌측 슬라이드, 다크 테마
 */

import { useState } from 'react';
import {
  X, Coins, Handshake, Swords, Users, LogOut, Trash2,
  ShieldAlert, Clock, AlertTriangle, Crown, UserPlus,
} from 'lucide-react';

interface IAllianceInfo {
  id: string;
  name: string;
  members: string[];
}

interface IActiveWar {
  id: string;
  targetName: string;
  status: 'preparing' | 'active';
  ourScore: number;
  theirScore: number;
  remainingTime: string;
}

interface IDiplomacyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mcBalance: number;
  onAllianceAction: (action: string, targetId?: string) => void;
  onDeclareWar: (targetId: string) => void;
  currentAlliance?: IAllianceInfo | null;
}

// 전쟁 선포 비용
const WAR_COST = 50000;

// 임시 전쟁 대상 목록
const MOCK_NATIONS = [
  { id: 'nation_1', name: 'Republic of Nova' },
  { id: 'nation_2', name: 'Iron Dominion' },
  { id: 'nation_3', name: 'Pacific Union' },
];

// 임시 활성 전쟁
const MOCK_ACTIVE_WARS: IActiveWar[] = [
  { id: 'war_1', targetName: 'Iron Dominion', status: 'active', ourScore: 3200, theirScore: 2800, remainingTime: '4h 22m' },
  { id: 'war_2', targetName: 'Pacific Union', status: 'preparing', ourScore: 0, theirScore: 0, remainingTime: '23h 59m' },
];

export default function DiplomacyPanel({
  isOpen, onClose, mcBalance, onAllianceAction, onDeclareWar, currentAlliance,
}: IDiplomacyPanelProps) {
  const [allianceName, setAllianceName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [warTarget, setWarTarget] = useState('');

  const canDeclareWar = mcBalance >= WAR_COST && warTarget !== '';

  // 동맹 생성
  const handleCreateAlliance = () => {
    if (!allianceName.trim()) return;
    onAllianceAction('create', allianceName.trim());
    setAllianceName('');
  };

  // 동맹 가입
  const handleJoinAlliance = () => {
    if (!joinCode.trim()) return;
    onAllianceAction('join', joinCode.trim());
    setJoinCode('');
  };

  // 전쟁 선포
  const handleDeclareWar = () => {
    if (!canDeclareWar) return;
    onDeclareWar(warTarget);
    setWarTarget('');
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 left-0 bottom-0 z-20 w-full sm:w-[380px] md:w-[420px] pointer-events-auto">
      <div className="h-full flex flex-col bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-md border-r border-slate-700/50 shadow-[4px_0_30px_rgba(0,0,0,0.5)]">
        {/* 헤더 */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50 bg-gradient-to-r from-violet-900/40 to-slate-900/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Handshake size={18} className="text-violet-400" />
              <h2 className="text-white font-bold text-sm tracking-wide">DIPLOMACY</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-red-600/60 text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
            <Coins size={12} className="text-yellow-400" />
            <span>Balance: <span className="text-yellow-300 font-medium">{mcBalance.toLocaleString()} MC</span></span>
          </div>
        </div>

        {/* 스크롤 컨텐츠 */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {/* === Alliance 섹션 === */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Users size={14} className="text-violet-400" />
              <span className="text-violet-300 text-xs font-bold uppercase tracking-wider">Alliance</span>
            </div>

            {!currentAlliance ? (
              /* 동맹 미가입 상태 */
              <div className="space-y-3">
                {/* 동맹 생성 */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3 space-y-2">
                  <div className="text-white text-xs font-semibold">Create Alliance</div>
                  <input
                    type="text"
                    value={allianceName}
                    onChange={(e) => setAllianceName(e.target.value)}
                    placeholder="Alliance name..."
                    maxLength={20}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-violet-500/50"
                  />
                  <button
                    onClick={handleCreateAlliance}
                    disabled={!allianceName.trim()}
                    className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${
                      allianceName.trim()
                        ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-[0_2px_0_#4c1d95] active:shadow-none active:translate-y-0.5'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Create
                  </button>
                </div>

                {/* 동맹 가입 */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3 space-y-2">
                  <div className="text-white text-xs font-semibold flex items-center gap-1">
                    <UserPlus size={12} />
                    Join Alliance
                  </div>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Enter invite code..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-violet-500/50"
                  />
                  <button
                    onClick={handleJoinAlliance}
                    disabled={!joinCode.trim()}
                    className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${
                      joinCode.trim()
                        ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-[0_2px_0_#4c1d95] active:shadow-none active:translate-y-0.5'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Join
                  </button>
                </div>
              </div>
            ) : (
              /* 동맹 가입 상태 */
              <div className="rounded-xl border border-violet-700/30 bg-violet-900/10 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Crown size={14} className="text-yellow-400" />
                    <span className="text-white text-sm font-bold">{currentAlliance.name}</span>
                  </div>
                  <span className="text-slate-500 text-[10px]">{currentAlliance.members.length}/5 members</span>
                </div>

                {/* 멤버 목록 (최대 5명) */}
                <div className="space-y-1">
                  {currentAlliance.members.slice(0, 5).map((member, i) => (
                    <div key={member} className="flex items-center gap-2 text-xs text-slate-300">
                      <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-400">
                        {i + 1}
                      </div>
                      <span>{member}</span>
                      {i === 0 && <span className="text-yellow-500 text-[9px] ml-auto">LEADER</span>}
                    </div>
                  ))}
                </div>

                {/* 배신 쿨다운 경고 */}
                <div className="flex items-start gap-1.5 bg-orange-950/30 border border-orange-800/30 rounded-lg p-2">
                  <Clock size={12} className="text-orange-400 flex-shrink-0 mt-0.5" />
                  <span className="text-orange-300 text-[10px]">72h betrayal cooldown after leaving</span>
                </div>

                {/* Leave / Disband 버튼 */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => onAllianceAction('leave')}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-slate-700 hover:bg-orange-700 text-slate-300 hover:text-white text-xs font-bold transition-colors"
                  >
                    <LogOut size={12} />
                    Leave
                  </button>
                  <button
                    onClick={() => onAllianceAction('disband')}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-slate-700 hover:bg-red-700 text-slate-300 hover:text-white text-xs font-bold transition-colors"
                  >
                    <Trash2 size={12} />
                    Disband
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 구분선 */}
          <div className="border-t border-slate-700/40" />

          {/* === War 섹션 === */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Swords size={14} className="text-red-400" />
              <span className="text-red-300 text-xs font-bold uppercase tracking-wider">War</span>
            </div>

            {/* 전쟁 선포 폼 */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3 space-y-2">
              <div className="text-white text-xs font-semibold">Declare War</div>
              <select
                value={warTarget}
                onChange={(e) => setWarTarget(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-red-500/50"
              >
                <option value="">-- Select target --</option>
                {MOCK_NATIONS.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>

              {/* 비용 + Hegemony 경고 */}
              <div className="flex items-start gap-1.5 bg-red-950/30 border border-red-800/30 rounded-lg p-2">
                <AlertTriangle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-[10px] space-y-0.5">
                  <div className="text-red-300">Cost: <span className="font-bold text-red-200">{WAR_COST.toLocaleString()} MC</span></div>
                  <div className="text-red-400">Requires Hegemony government type</div>
                </div>
              </div>

              <button
                onClick={handleDeclareWar}
                disabled={!canDeclareWar}
                className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all ${
                  canDeclareWar
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_2px_0_#7f1d1d] active:shadow-none active:translate-y-0.5'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                Declare War ({WAR_COST.toLocaleString()} MC)
              </button>
            </div>

            {/* 활성 전쟁 목록 */}
            {MOCK_ACTIVE_WARS.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Active Wars</div>
                {MOCK_ACTIVE_WARS.map((war) => (
                  <div key={war.id} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-white text-sm font-semibold">vs {war.targetName}</div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        war.status === 'active'
                          ? 'bg-red-900/40 text-red-300'
                          : 'bg-yellow-900/40 text-yellow-300'
                      }`}>
                        {war.status === 'active' ? 'IN PROGRESS' : 'PREPARING'}
                      </span>
                    </div>

                    {/* 스코어 */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-emerald-400">Us: {war.ourScore.toLocaleString()}</span>
                          <span className="text-red-400">Them: {war.theirScore.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden flex">
                          {(war.ourScore + war.theirScore) > 0 && (
                            <>
                              <div
                                className="h-full bg-emerald-500 rounded-l-full"
                                style={{ width: `${(war.ourScore / (war.ourScore + war.theirScore)) * 100}%` }}
                              />
                              <div
                                className="h-full bg-red-500 rounded-r-full"
                                style={{ width: `${(war.theirScore / (war.ourScore + war.theirScore)) * 100}%` }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 남은 시간 + Surrender */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock size={10} />
                        {war.remainingTime}
                      </div>
                      <button
                        onClick={() => onAllianceAction('surrender', war.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-orange-700 text-slate-400 hover:text-white text-[10px] font-bold transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <ShieldAlert size={10} />
                          Surrender
                        </div>
                      </button>
                    </div>

                    {/* 항복 경고 */}
                    <div className="text-[9px] text-orange-500/70 flex items-center gap-1">
                      <AlertTriangle size={8} />
                      Surrender transfers 30% of buildings to enemy
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 하단 */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-slate-700/50 bg-slate-900/80">
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>War cost: {WAR_COST.toLocaleString()} MC</span>
            <span className="text-slate-600">Diplomacy</span>
          </div>
        </div>
      </div>
    </div>
  );
}
