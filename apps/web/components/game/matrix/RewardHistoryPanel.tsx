'use client';

/**
 * RewardHistoryPanel.tsx — v33 Phase 6: 보상 히스토리 UI
 *
 * Canvas 위 React DOM 오버레이 (position: absolute)
 * - 최근 24시간 보상 내역 리스트
 * - 일일 잔여 한도 표시
 * - 합산 보상 총액
 *
 * API: GET /api/matrix/rewards/history?playerId={id}&period=day
 *
 * 디자인: 다크/글로우 | Ethnocentric (display) + ITC Avant Garde Gothic (body)
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react';

// ─── 폰트 정의 ───
const DISPLAY_FONT = '"Ethnocentric", "Black Ops One", "Chakra Petch", monospace';
const BODY_FONT = '"ITC Avant Garde Gothic", "Rajdhani", "Space Grotesk", sans-serif';

// ─── 타입 ───

interface RewardEntry {
  id: string;
  epochNumber: number;
  tokenType: string;
  amount: number;
  reason: string;
  isMvp: boolean;
  createdAt: number; // unix ms
}

interface RewardHistoryData {
  rewards: RewardEntry[];
  total: number;
  dailyRemaining: number;
}

// ─── Props ───

export interface RewardHistoryPanelProps {
  /** 플레이어 ID */
  playerId: string | null;
  /** 패널 표시 여부 */
  visible: boolean;
  /** 닫기 콜백 */
  onClose: () => void;
  /** API 서버 URL */
  serverUrl?: string;
}

// ─── Helper ───

function formatTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatAmount(amount: number): string {
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  if (amount >= 1) return amount.toFixed(1);
  return amount.toFixed(3);
}

// ─── Component ───

function RewardHistoryPanelInner({
  playerId,
  visible,
  onClose,
  serverUrl,
}: RewardHistoryPanelProps) {
  const [data, setData] = useState<RewardHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  // Fetch reward history
  const fetchHistory = useCallback(async () => {
    if (!playerId) return;

    setLoading(true);
    setError(null);

    try {
      const baseUrl = serverUrl || process.env.NEXT_PUBLIC_SERVER_URL || '';
      const url = `${baseUrl}/api/matrix/rewards/history?playerId=${encodeURIComponent(playerId)}&period=day`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json: RewardHistoryData = await resp.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, [playerId, serverUrl]);

  // Auto-fetch on mount/visible change
  useEffect(() => {
    if (visible && playerId && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchHistory();
    }
    if (!visible) {
      fetchedRef.current = false;
    }
  }, [visible, playerId, fetchHistory]);

  if (!visible) return null;

  const dailyCap = 5000;
  const dailyUsed = data ? dailyCap - data.dailyRemaining : 0;
  const dailyPct = data ? Math.min(100, (dailyUsed / dailyCap) * 100) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        right: 8,
        top: 60,
        width: 240,
        maxHeight: 360,
        zIndex: 50,
        background: 'rgba(8,8,12,0.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(251,191,36,0.15)',
        clipPath:
          'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      {/* ═══ Header ═══ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px 6px',
          borderBottom: '1px solid rgba(251,191,36,0.1)',
        }}
      >
        <span
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: '#FBBF24',
            textShadow: '0 0 6px rgba(251,191,36,0.4)',
          }}
        >
          REWARD HISTORY
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#55565E',
            cursor: 'pointer',
            fontSize: 12,
            padding: 0,
            lineHeight: 1,
          }}
        >
          {'\u2715'}
        </button>
      </div>

      {/* ═══ Daily Cap Bar ═══ */}
      {data && (
        <div style={{ padding: '6px 12px 4px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: BODY_FONT,
              fontSize: 7,
              color: '#8B8D98',
              marginBottom: 3,
            }}
          >
            <span>DAILY LIMIT</span>
            <span>
              {formatAmount(dailyUsed)} / {formatAmount(dailyCap)}
            </span>
          </div>
          <div
            style={{
              height: 3,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${dailyPct}%`,
                background:
                  dailyPct >= 100
                    ? '#EF4444'
                    : dailyPct >= 80
                      ? '#F59E0B'
                      : '#4ADE80',
                borderRadius: 1,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          {dailyPct >= 100 && (
            <div
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 6,
                color: '#EF4444',
                letterSpacing: '0.2em',
                marginTop: 3,
                textAlign: 'center',
                textShadow: '0 0 4px rgba(239,68,68,0.4)',
              }}
            >
              MAX EARNED TODAY
            </div>
          )}
        </div>
      )}

      {/* ═══ Reward List ═══ */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 8px',
          scrollbarWidth: 'none',
        }}
      >
        {loading && (
          <div
            style={{
              fontFamily: BODY_FONT,
              fontSize: 8,
              color: '#55565E',
              textAlign: 'center',
              padding: '16px 0',
            }}
          >
            Loading...
          </div>
        )}

        {error && (
          <div
            style={{
              fontFamily: BODY_FONT,
              fontSize: 8,
              color: '#EF4444',
              textAlign: 'center',
              padding: '16px 0',
            }}
          >
            {error}
          </div>
        )}

        {data && data.rewards.length === 0 && (
          <div
            style={{
              fontFamily: BODY_FONT,
              fontSize: 8,
              color: '#55565E',
              textAlign: 'center',
              padding: '16px 0',
            }}
          >
            No rewards in the last 24h
          </div>
        )}

        {data &&
          data.rewards.map((reward) => (
            <div
              key={reward.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 4px',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}
            >
              {/* Token icon */}
              <div
                style={{
                  width: 20,
                  height: 20,
                  background: 'rgba(251,191,36,0.1)',
                  border: '1px solid rgba(251,191,36,0.2)',
                  borderRadius: 0,
                  clipPath:
                    'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 0 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 10, lineHeight: 1 }}>
                  {reward.isMvp ? '\u2B50' : '\u26A1'}
                </span>
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: 8,
                    fontWeight: 700,
                    color: '#FBBF24',
                    letterSpacing: '0.05em',
                    textShadow: '0 0 3px rgba(251,191,36,0.3)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  +{formatAmount(reward.amount)} ${reward.tokenType}
                </div>
                <div
                  style={{
                    fontFamily: BODY_FONT,
                    fontSize: 7,
                    color: '#55565E',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {reward.reason}
                </div>
              </div>

              {/* Time */}
              <div
                style={{
                  fontFamily: BODY_FONT,
                  fontSize: 7,
                  color: '#44454D',
                  flexShrink: 0,
                }}
              >
                {formatTime(reward.createdAt)}
              </div>
            </div>
          ))}
      </div>

      {/* ═══ Footer Total ═══ */}
      {data && data.total > 0 && (
        <div
          style={{
            padding: '6px 12px',
            borderTop: '1px solid rgba(251,191,36,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: BODY_FONT,
              fontSize: 7,
              color: '#8B8D98',
              letterSpacing: '0.1em',
            }}
          >
            24H TOTAL
          </span>
          <span
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 10,
              fontWeight: 700,
              color: '#FBBF24',
              textShadow: '0 0 6px rgba(251,191,36,0.4)',
            }}
          >
            {formatAmount(data.total)}
          </span>
        </div>
      )}
    </div>
  );
}

const RewardHistoryPanel = memo(RewardHistoryPanelInner);
export default RewardHistoryPanel;
