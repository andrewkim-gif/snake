'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, X, FastForward } from 'lucide-react';

// ── 인터페이스 ──

interface IBattleUnit {
  id: string;
  type: string;
  count: number;
  hp: number;
  max_hp: number;
  attack: number;
  defense: number;
  is_air: boolean;
  side: 'attacker' | 'defender';
}

interface IBattleDefense {
  type: string;
  hp: number;
  max_hp: number;
  dps: number;
  active: boolean;
}

interface IBattleTickFrame {
  tick: number;
  attacker_units: IBattleUnit[];
  defender_units: IBattleUnit[];
  defenses: IBattleDefense[];
  events: string[];
}

interface IBattleReplayViewerProps {
  isOpen: boolean;
  onClose: () => void;
  battleResult: {
    id: string;
    attacker_id: string;
    defender_id: string;
    target_region: string;
    result: 'attacker_win' | 'defender_win' | 'draw';
    mc_looted: number;
    replay_frames: IBattleTickFrame[];
    duration_ticks: number;
  } | null;
}

// ── 결과별 색상 매핑 ──

const RESULT_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  attacker_win: { label: 'ATTACKER WIN', color: 'text-red-400', bg: 'bg-red-500/20' },
  defender_win: { label: 'DEFENDER WIN', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  draw: { label: 'DRAW', color: 'text-zinc-400', bg: 'bg-zinc-500/20' },
};

// ── 배속 옵션 ──

const SPEED_OPTIONS = [1, 2, 4] as const;

// ── 유닛 카드 컴포넌트 ──

function UnitCard({ unit }: { unit: IBattleUnit }) {
  const hpRatio = unit.max_hp > 0 ? unit.hp / unit.max_hp : 0;
  const isDead = unit.hp <= 0;
  const barColor = hpRatio > 0.5 ? 'bg-green-500' : hpRatio > 0.2 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`rounded-md border px-2 py-1.5 text-xs transition-opacity ${isDead ? 'border-zinc-700 opacity-40' : 'border-zinc-600'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-200">
          {unit.is_air ? '✈ ' : ''}{unit.type}
        </span>
        <span className="tabular-nums text-zinc-400">x{unit.count}</span>
      </div>
      {/* HP 바 */}
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-700">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.max(hpRatio * 100, 0)}%` }}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-zinc-500">
        <span>ATK {unit.attack}</span>
        <span>DEF {unit.defense}</span>
        <span>{unit.hp}/{unit.max_hp}</span>
      </div>
    </div>
  );
}

// ── 방어 시설 카드 ──

function DefenseCard({ defense }: { defense: IBattleDefense }) {
  const hpRatio = defense.max_hp > 0 ? defense.hp / defense.max_hp : 0;
  const destroyed = !defense.active || defense.hp <= 0;

  return (
    <div className={`rounded-md border px-2 py-1 text-xs ${destroyed ? 'border-red-800/50 opacity-40' : 'border-amber-600/50'}`}>
      <div className="flex items-center justify-between gap-1">
        <span className={`font-medium ${destroyed ? 'text-red-400 line-through' : 'text-amber-300'}`}>
          {defense.type}
        </span>
        <span className="text-[10px] text-zinc-500">{defense.dps} DPS</span>
      </div>
      <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-zinc-700">
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-300"
          style={{ width: `${Math.max(hpRatio * 100, 0)}%` }}
        />
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──

export default function BattleReplayViewer({ isOpen, onClose, battleResult }: IBattleReplayViewerProps) {
  const [currentTick, setCurrentTick] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  const frames = battleResult?.replay_frames ?? [];
  const totalTicks = battleResult?.duration_ticks ?? 0;
  const currentFrame = frames[currentTick] ?? null;
  const resultStyle = battleResult ? RESULT_STYLES[battleResult.result] : null;

  // 자동 재생 인터벌
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (isPlaying && frames.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentTick((prev) => {
          if (prev >= frames.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / speed);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, frames.length]);

  // 이벤트 로그 자동 스크롤
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentTick]);

  // 열릴 때 리셋
  useEffect(() => {
    if (isOpen) {
      setCurrentTick(0);
      setIsPlaying(false);
      setSpeed(1);
    }
  }, [isOpen]);

  // 키보드 단축키
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsPlaying((p) => !p);
          break;
        case 'ArrowRight':
          setCurrentTick((p) => Math.min(p + 1, frames.length - 1));
          break;
        case 'ArrowLeft':
          setCurrentTick((p) => Math.max(p - 1, 0));
          break;
        case 'Escape':
          onClose();
          break;
      }
    },
    [isOpen, frames.length, onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSpeedCycle = useCallback(() => {
    setSpeed((prev) => {
      const idx = SPEED_OPTIONS.indexOf(prev);
      return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    });
  }, []);

  if (!isOpen || !battleResult) return null;

  // 누적 이벤트 (현재 틱까지)
  const cumulativeEvents: string[] = [];
  for (let i = 0; i <= currentTick && i < frames.length; i++) {
    cumulativeEvents.push(...frames[i].events);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex h-[90vh] w-[95vw] max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">
            Battle Replay: <span className="text-amber-400">{battleResult.target_region}</span>
          </h2>
          <div className="flex items-center gap-3">
            {resultStyle && (
              <span className={`rounded px-2 py-0.5 text-xs font-bold ${resultStyle.color} ${resultStyle.bg}`}>
                {resultStyle.label}
              </span>
            )}
            {battleResult.mc_looted > 0 && (
              <span className="text-xs text-yellow-400">+{battleResult.mc_looted.toLocaleString()} MC looted</span>
            )}
            <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 전투 영역 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 공격자 (좌측) */}
          <div className="flex w-1/2 flex-col border-r border-zinc-800 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
              Attacker — {battleResult.attacker_id}
            </h3>
            <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
              {currentFrame?.attacker_units.map((unit) => (
                <UnitCard key={unit.id} unit={unit} />
              ))}
              {(!currentFrame || currentFrame.attacker_units.length === 0) && (
                <p className="py-4 text-center text-xs text-zinc-600">No units</p>
              )}
            </div>
          </div>

          {/* 방어자 (우측) */}
          <div className="flex w-1/2 flex-col p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
              Defender — {battleResult.defender_id}
            </h3>
            <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
              {currentFrame?.defender_units.map((unit) => (
                <UnitCard key={unit.id} unit={unit} />
              ))}
              {(!currentFrame || currentFrame.defender_units.length === 0) && (
                <p className="py-4 text-center text-xs text-zinc-600">No units</p>
              )}
            </div>
            {/* 방어 시설 */}
            {currentFrame && currentFrame.defenses.length > 0 && (
              <div className="mt-2 border-t border-zinc-800 pt-2">
                <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">Defenses</h4>
                <div className="grid grid-cols-2 gap-1">
                  {currentFrame.defenses.map((def, i) => (
                    <DefenseCard key={`${def.type}-${i}`} defense={def} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 이벤트 로그 */}
        <div className="h-20 overflow-y-auto border-t border-zinc-800 bg-zinc-950/50 px-4 py-2">
          {cumulativeEvents.length === 0 ? (
            <p className="text-xs text-zinc-600">Waiting for events...</p>
          ) : (
            cumulativeEvents.slice(-20).map((evt, i) => (
              <p key={i} className="text-[11px] leading-tight text-zinc-400">
                <span className="text-zinc-600">▸</span> {evt}
              </p>
            ))
          )}
          <div ref={eventsEndRef} />
        </div>

        {/* 컨트롤 바 */}
        <div className="flex items-center gap-3 border-t border-zinc-700 px-4 py-2">
          {/* 이전 프레임 */}
          <button
            onClick={() => setCurrentTick((p) => Math.max(p - 1, 0))}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Previous frame"
          >
            <SkipBack size={16} />
          </button>

          {/* 재생/일시정지 */}
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="rounded-full bg-zinc-700 p-2 text-zinc-200 hover:bg-zinc-600"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>

          {/* 다음 프레임 */}
          <button
            onClick={() => setCurrentTick((p) => Math.min(p + 1, frames.length - 1))}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Next frame"
          >
            <SkipForward size={16} />
          </button>

          {/* 배속 토글 */}
          <button
            onClick={handleSpeedCycle}
            className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-800"
            aria-label="Change speed"
          >
            <FastForward size={12} />
            {speed}x
          </button>

          {/* 틱 표시 */}
          <span className="min-w-[80px] text-center text-xs tabular-nums text-zinc-400">
            Tick {currentTick + 1}/{totalTicks || frames.length}
          </span>

          {/* 스크러버 */}
          <input
            type="range"
            min={0}
            max={Math.max(frames.length - 1, 0)}
            value={currentTick}
            onChange={(e) => {
              setCurrentTick(Number(e.target.value));
              setIsPlaying(false);
            }}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-amber-500"
            aria-label="Scrub timeline"
          />
        </div>
      </div>
    </div>
  );
}
