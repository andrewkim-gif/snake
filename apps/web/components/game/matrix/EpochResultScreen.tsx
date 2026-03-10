'use client';

/**
 * EpochResultScreen.tsx — v33 Phase 5: 에폭 종료 결과 화면
 *
 * Canvas 위 풀스크린 오버레이 (position: absolute, 전체 화면)
 * 에폭 end 페이즈 (5초) 동안 표시되는 결과 화면:
 * - 지배 국가 + 국가별 순위
 * - 개인 성과 (킬, 점수, 순위)
 * - 토큰 보상 요약
 * - MVP 표시
 *
 * 디자인: 다크/글로우 | Ethnocentric (display) + ITC Avant Garde Gothic (body)
 */

import { memo, useMemo } from 'react';
import type { MatrixResultPayload } from '@/hooks/useMatrixSocket';

// ─── 폰트 정의 ───
const DISPLAY_FONT = '"Ethnocentric", "Black Ops One", "Chakra Petch", monospace';
const BODY_FONT = '"ITC Avant Garde Gothic", "Rajdhani", "Space Grotesk", sans-serif';

// ─── 순위 색상 ───
const RANK_STYLES: Array<{ color: string; bg: string; glow: string }> = [
  { color: '#FFD700', bg: 'rgba(255,215,0,0.08)', glow: '0 0 16px rgba(255,215,0,0.3)' },
  { color: '#C0C0C0', bg: 'rgba(192,192,192,0.06)', glow: '0 0 12px rgba(192,192,192,0.2)' },
  { color: '#CD7F32', bg: 'rgba(205,127,50,0.06)', glow: '0 0 10px rgba(205,127,50,0.2)' },
];

// ─── Props ───

export interface EpochResultScreenProps {
  /** matrix_result 페이로드 */
  result: MatrixResultPayload | null;
  /** 현재 플레이어 ID */
  playerId?: string;
  /** 현재 플레이어 국적 */
  playerNation?: string;
  /** 표시 여부 */
  visible: boolean;
}

// ─── Utils ───

function formatScore(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function formatTokenAmount(amount: number): string {
  if (amount >= 1) return amount.toFixed(2);
  if (amount >= 0.01) return amount.toFixed(3);
  return amount.toFixed(4);
}

// ─── Component ───

function EpochResultScreenInner({
  result,
  playerId,
  playerNation,
  visible,
}: EpochResultScreenProps) {
  // 개인 보상 추출
  const personalReward = useMemo(() => {
    if (!result || !playerId) return null;
    return result.rewards.find((r) => r.playerId === playerId) ?? null;
  }, [result, playerId]);

  // 국가별 순위 (서버에서 이미 정렬됨)
  const nationRankings = useMemo(() => {
    if (!result) return [];
    return [...result.rankings]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 5)
      .map((r) => ({
        nation: r.nationality,
        score: r.score,
        rank: r.rank,
      }));
  }, [result]);

  const isMVP = result?.mvp?.playerId === playerId;
  const dominantNation = nationRankings[0]?.nation;

  if (!visible || !result) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(4,4,8,0.88)',
        backdropFilter: 'blur(16px)',
        pointerEvents: 'auto',
        animation: 'epochResultFadeIn 0.5s ease-out',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: '90%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* ═══ EPOCH COMPLETE Header ═══ */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              color: '#CC9933',
              fontFamily: DISPLAY_FONT,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.3em',
              textShadow: '0 0 8px rgba(204,153,51,0.4)',
              marginBottom: 4,
            }}
          >
            EPOCH COMPLETE
          </div>
          {dominantNation && (
            <div
              style={{
                color: '#FFD700',
                fontFamily: DISPLAY_FONT,
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: '0.1em',
                textShadow: '0 0 16px rgba(255,215,0,0.4), 0 0 32px rgba(255,215,0,0.2)',
              }}
            >
              {dominantNation} DOMINATES
            </div>
          )}
        </div>

        {/* ═══ MVP Banner ═══ */}
        {isMVP && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(204,153,51,0.06))',
              border: '1px solid rgba(255,215,0,0.3)',
              clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
              padding: '6px 20px',
              textAlign: 'center',
              boxShadow: '0 0 20px rgba(255,215,0,0.2)',
            }}
          >
            <span
              style={{
                color: '#FFD700',
                fontFamily: DISPLAY_FONT,
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: '0.2em',
                textShadow: '0 0 12px rgba(255,215,0,0.5)',
              }}
            >
              MVP
            </span>
          </div>
        )}

        {/* ═══ Nation Rankings ═══ */}
        <div
          style={{
            width: '100%',
            background: 'rgba(8,8,12,0.6)',
            border: '1px solid rgba(255,255,255,0.04)',
            clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
          }}
        >
          {/* Rankings header */}
          <div
            style={{
              padding: '6px 16px',
              borderBottom: '1px solid rgba(204,153,51,0.15)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                color: '#CC9933',
                fontFamily: DISPLAY_FONT,
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: '0.2em',
              }}
            >
              NATION RANKINGS
            </span>
            <span
              style={{
                color: '#55565E',
                fontFamily: BODY_FONT,
                fontSize: 8,
              }}
            >
              SCORE
            </span>
          </div>

          {/* Rankings rows */}
          {nationRankings.map((entry, idx) => {
            const style = RANK_STYLES[idx] ?? { color: '#8B8D98', bg: 'transparent', glow: 'none' };
            const isPlayer = playerNation?.toUpperCase() === entry.nation.toUpperCase();

            return (
              <div
                key={entry.nation}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 16px',
                  gap: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                  background: isPlayer ? 'rgba(204,153,51,0.06)' : style.bg,
                  borderLeft: isPlayer ? '3px solid #CC9933' : '3px solid transparent',
                }}
              >
                {/* Rank number */}
                <span
                  style={{
                    color: style.color,
                    fontFamily: DISPLAY_FONT,
                    fontSize: 16,
                    fontWeight: 900,
                    width: 24,
                    textAlign: 'center',
                    textShadow: style.glow,
                  }}
                >
                  {idx + 1}
                </span>

                {/* Nation */}
                <span
                  style={{
                    color: isPlayer ? '#CC9933' : '#ECECEF',
                    fontFamily: DISPLAY_FONT,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    flex: 1,
                    textShadow: isPlayer ? '0 0 6px rgba(204,153,51,0.3)' : 'none',
                  }}
                >
                  {entry.nation}
                </span>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ color: '#ECECEF', fontFamily: BODY_FONT, fontSize: 12, fontWeight: 600, minWidth: 40, textAlign: 'right' }}>
                    {formatScore(entry.score)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══ Personal Stats ═══ */}
        {personalReward && (
          <div
            style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
            }}
          >
            {/* Score */}
            <StatCard label="SCORE" value={formatScore(personalReward.rawScore)} color="#FBBF24" />
            {/* Multiplier */}
            <StatCard label="MULTI" value={`${personalReward.multiplier.toFixed(1)}x`} color="#CC9933" />
            {/* Reward */}
            <StatCard label="EARNED" value={formatTokenAmount(personalReward.finalAmount)} color="#4ADE80" />
          </div>
        )}

        {/* ═══ Token Rewards ═══ */}
        {result.rewards.length > 0 && (
          <div
            style={{
              width: '100%',
              background: 'rgba(8,8,12,0.6)',
              border: '1px solid rgba(204,153,51,0.15)',
              clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
              padding: '8px 16px',
            }}
          >
            <div
              style={{
                color: '#CC9933',
                fontFamily: DISPLAY_FONT,
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: '0.2em',
                marginBottom: 6,
              }}
            >
              TOKEN REWARDS
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {result.rewards
                .filter((r) => r.playerId === playerId)
                .map((reward, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        color: '#4ADE80',
                        fontFamily: DISPLAY_FONT,
                        fontSize: 16,
                        fontWeight: 900,
                        textShadow: '0 0 8px rgba(74,222,128,0.4)',
                      }}
                    >
                      +{formatTokenAmount(reward.finalAmount)}
                    </span>
                    <span
                      style={{
                        color: '#8B8D98',
                        fontFamily: BODY_FONT,
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                      }}
                    >
                      ${reward.tokenType}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ═══ Next Epoch Countdown ═══ */}
        <div
          style={{
            color: '#55565E',
            fontFamily: BODY_FONT,
            fontSize: 10,
            letterSpacing: '0.1em',
            animation: 'epochPulse 2s ease-in-out infinite',
          }}
        >
          NEXT EPOCH STARTING...
        </div>
      </div>

      {/* ═══ CSS Animations ═══ */}
      <style>{`
        @keyframes epochResultFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes epochPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// ─── Stat Card Sub-component ───

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: 'rgba(8,8,12,0.6)',
        border: '1px solid rgba(255,255,255,0.04)',
        clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)',
        padding: '8px 12px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: '#55565E',
          fontFamily: BODY_FONT,
          fontSize: 8,
          fontWeight: 600,
          letterSpacing: '0.2em',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color,
          fontFamily: DISPLAY_FONT,
          fontSize: 18,
          fontWeight: 900,
          textShadow: `0 0 8px ${color}55`,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const EpochResultScreen = memo(EpochResultScreenInner);
export default EpochResultScreen;
