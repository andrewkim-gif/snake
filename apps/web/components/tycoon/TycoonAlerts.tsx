'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, DollarSign, X } from 'lucide-react';
import type { IUnderAttack, IIncomeSettled } from '@/hooks/useTycoonSocket';

// ─── 인터페이스 ───
interface ITycoonAlertsProps {
  alerts: IUnderAttack[];
  latestIncome: IIncomeSettled | null;
}

interface IToastItem {
  id: string;
  type: 'attack' | 'income';
  data: IUnderAttack | IIncomeSettled;
  createdAt: number;
}

const MAX_VISIBLE = 3;
const ATTACK_DURATION = 3_000;
const INCOME_DURATION = 4_000;

/** 우상단 고정 — 공격 알림 + 수익 토스트 스택 */
export default function TycoonAlerts({ alerts, latestIncome }: ITycoonAlertsProps) {
  const [toasts, setToasts] = useState<IToastItem[]>([]);
  // 이전 alerts/income 추적 (중복 방지)
  const prevAlertsLen = useRef(alerts.length);
  const prevIncomeRef = useRef<IIncomeSettled | null>(null);

  // 토스트 제거
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 공격 알림 감지 — 새 항목 추가 시 토스트 생성
  useEffect(() => {
    if (alerts.length > prevAlertsLen.current && alerts.length > 0) {
      const latest = alerts[0];
      const id = `attack_${Date.now()}`;
      setToasts((prev) => {
        const next = [{ id, type: 'attack' as const, data: latest, createdAt: Date.now() }, ...prev];
        return next.slice(0, MAX_VISIBLE);
      });
      // 자동 제거
      setTimeout(() => removeToast(id), ATTACK_DURATION);
    }
    prevAlertsLen.current = alerts.length;
  }, [alerts, removeToast]);

  // 수익 토스트 감지
  useEffect(() => {
    if (latestIncome && latestIncome !== prevIncomeRef.current) {
      const id = `income_${Date.now()}`;
      setToasts((prev) => {
        const next = [{ id, type: 'income' as const, data: latestIncome, createdAt: Date.now() }, ...prev];
        return next.slice(0, MAX_VISIBLE);
      });
      setTimeout(() => removeToast(id), INCOME_DURATION);
    }
    prevIncomeRef.current = latestIncome;
  }, [latestIncome, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-[60px] right-4 z-50 flex flex-col gap-2 w-72 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-lg p-3 shadow-lg border
            animate-in slide-in-from-right-5 fade-in duration-300
            ${toast.type === 'attack'
              ? 'bg-red-900/90 border-red-600/50 text-red-100'
              : 'bg-green-900/90 border-green-600/50 text-green-100'}`}
        >
          {/* 닫기 */}
          <button
            onClick={() => removeToast(toast.id)}
            className="absolute top-1 right-1 p-0.5 rounded hover:bg-white/10"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5 opacity-60" />
          </button>

          {toast.type === 'attack' ? (
            <AttackContent data={toast.data as IUnderAttack} />
          ) : (
            <IncomeContent data={toast.data as IIncomeSettled} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── 공격 알림 내부 컴포넌트 ───
function AttackContent({ data }: { data: IUnderAttack }) {
  // arrival_at은 타임스탬프 → 남은 분 계산
  const minutesLeft = Math.max(0, Math.ceil((data.arrival_at - Date.now()) / 60_000));

  return (
    <div className="flex items-start gap-2">
      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-red-300">
          Under Attack!
        </p>
        <p className="text-xs mt-1">
          <span className="font-semibold">{data.attacker_name}</span>
          {' \u2192 '}
          <span className="font-semibold">{data.target_region}</span>
        </p>
        <p className="text-[10px] mt-0.5 text-red-300/80">
          {data.unit_count.toLocaleString()} units &middot; ETA {minutesLeft}m
        </p>
      </div>
    </div>
  );
}

// ─── 수익 토스트 내부 컴포넌트 ───
function IncomeContent({ data }: { data: IIncomeSettled }) {
  return (
    <div className="flex items-center gap-2">
      <DollarSign className="w-5 h-5 text-green-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-green-200">
          +{data.total_earned.toLocaleString()} MC
        </p>
        <p className="text-[10px] text-green-300/80">
          {data.building_count} building{data.building_count !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
