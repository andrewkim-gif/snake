'use client';

/**
 * VictoryOverlay.tsx — v39 Phase 6: 배틀로얄 승리 연출
 *
 * 배틀로얄 종료 후 승리 결과를 표시하는 풀스크린 오버레이:
 * - 승리 팩션 배너 (팩션명 + 컬러 + "VICTORY")
 * - 순위별 보상 표시 (1위 100%, 2위 60%, 3위 30%)
 * - Region Point 지급 (1위 +10 RP, 2위 +5 RP, 3위 +3 RP)
 * - 개인 기여 점수 (킬/어시스트/자원채취/생존시간)
 *
 * Canvas 위 React DOM 오버레이 (position: absolute).
 */

import { memo, useMemo } from 'react';
import type {
  IBRVictoryResult,
  IFactionReward,
  IPlayerContribution,
  IFactionEliminationRecord,
} from '@/lib/matrix/types/region';

// ── 폰트 ──
const DISPLAY_FONT = '"Ethnocentric", "Black Ops One", "Chakra Petch", monospace';
const BODY_FONT = '"ITC Avant Garde Gothic", "Rajdhani", "Space Grotesk", sans-serif';

// ── 순위 메달 ──
const RANK_MEDALS: Record<number, { emoji: string; color: string; label: string }> = {
  1: { emoji: '🥇', color: '#FFD700', label: '1ST PLACE' },
  2: { emoji: '🥈', color: '#C0C0C0', label: '2ND PLACE' },
  3: { emoji: '🥉', color: '#CD7F32', label: '3RD PLACE' },
};

// ── Props ──

export interface VictoryOverlayProps {
  /** 승리 결과 데이터 */
  result: IBRVictoryResult | null;
  /** 내 팩션 ID */
  myFactionId: string;
  /** 내 플레이어 ID */
  myPlayerId: string;
  /** 표시 여부 */
  visible: boolean;
  /** 닫기 콜백 */
  onClose?: () => void;
}

// ── 컴포넌트 ──

export const VictoryOverlay = memo(function VictoryOverlay({
  result,
  myFactionId,
  myPlayerId,
  visible,
  onClose,
}: VictoryOverlayProps) {
  if (!visible || !result) return null;

  // 내 팩션 보상 정보
  const myReward = useMemo(
    () => result.rewards.find(r => r.factionId === myFactionId),
    [result, myFactionId],
  );

  // 내 개인 기여
  const myContribution = useMemo(
    () => result.topContributors.find(c => c.playerId === myPlayerId),
    [result, myPlayerId],
  );

  // 내 팩션이 1위인지
  const isWinner = result.winnerFactionId === myFactionId;

  // 내 팩션 순위
  const myRank = myReward?.rank ?? 0;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        animation: 'victoryFadeIn 0.6s ease-out',
      }}
    >
      {/* 승리 배너 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          marginBottom: 32,
        }}
      >
        {/* 승리/패배 라벨 */}
        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: isWinner ? 42 : 28,
            fontWeight: 900,
            color: isWinner ? '#FFD700' : '#E8E0D4',
            textShadow: isWinner
              ? '0 0 24px rgba(255,215,0,0.6), 0 0 48px rgba(255,215,0,0.3)'
              : '0 0 12px rgba(232,224,212,0.3)',
            letterSpacing: '0.15em',
            animation: isWinner ? 'victoryGlow 2s ease-in-out infinite' : undefined,
          }}
        >
          {isWinner ? 'VICTORY' : 'BATTLE OVER'}
        </div>

        {/* 승리 팩션명 */}
        <div
          style={{
            fontFamily: BODY_FONT,
            fontSize: 16,
            color: result.winnerColor || '#FFFFFF',
            letterSpacing: '0.1em',
          }}
        >
          {result.winnerFactionName} wins the battle!
        </div>

        {/* 라운드 정보 */}
        <div
          style={{
            fontFamily: BODY_FONT,
            fontSize: 12,
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          Round {result.roundNumber} — {formatDuration(result.brDurationSec)}
          {result.earlyFinish && ' (Early Finish)'}
        </div>
      </div>

      {/* 순위 + 보상 테이블 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          width: '100%',
          maxWidth: 480,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontFamily: BODY_FONT,
            fontSize: 12,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.15em',
            marginBottom: 4,
          }}
        >
          RANKINGS
        </div>

        {result.rankings.slice(0, 6).map((ranking, idx) => {
          const reward = result.rewards.find(r => r.factionId === ranking.factionId);
          const medal = RANK_MEDALS[ranking.rank];
          const isMe = ranking.factionId === myFactionId;

          return (
            <div
              key={ranking.factionId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: isMe
                  ? 'rgba(34, 197, 94, 0.12)'
                  : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${isMe ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8,
                padding: '10px 16px',
              }}
            >
              {/* 순위 */}
              <div
                style={{
                  width: 36,
                  textAlign: 'center',
                  fontFamily: DISPLAY_FONT,
                  fontSize: 18,
                  fontWeight: 700,
                  color: medal?.color ?? 'rgba(255,255,255,0.5)',
                }}
              >
                {medal?.emoji ?? `#${ranking.rank}`}
              </div>

              {/* 팩션 컬러 + 이름 */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: ranking.color,
                    boxShadow: `0 0 6px ${ranking.color}80`,
                  }}
                />
                <div
                  style={{
                    fontFamily: BODY_FONT,
                    fontSize: 14,
                    fontWeight: 600,
                    color: isMe ? '#4ADE80' : '#E8E0D4',
                  }}
                >
                  {ranking.factionName}
                  {isMe && (
                    <span style={{ fontSize: 10, color: '#4ADE80', marginLeft: 6 }}>
                      YOU
                    </span>
                  )}
                </div>
              </div>

              {/* 보상 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 2,
                }}
              >
                {reward && (
                  <>
                    <div
                      style={{
                        fontFamily: DISPLAY_FONT,
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#CC9933',
                      }}
                    >
                      +{reward.rp} RP
                    </div>
                    <div
                      style={{
                        fontFamily: BODY_FONT,
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {Math.round(reward.rewardRatio * 100)}% reward
                      {reward.gold > 0 && ` · ${reward.gold}G`}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 개인 기여 (내가 상위 10에 있는 경우) */}
      {myContribution && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            width: '100%',
            maxWidth: 480,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontFamily: BODY_FONT,
              fontSize: 12,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.15em',
            }}
          >
            YOUR CONTRIBUTION
          </div>
          <div
            style={{
              display: 'flex',
              gap: 12,
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '12px 16px',
            }}
          >
            <ContributionStat
              label="KILLS"
              value={myContribution.kills.toString()}
              color="#EF4444"
            />
            <ContributionStat
              label="ASSISTS"
              value={myContribution.assists.toString()}
              color="#F59E0B"
            />
            <ContributionStat
              label="RESOURCES"
              value={myContribution.resourceGathered.toString()}
              color="#22C55E"
            />
            <ContributionStat
              label="SURVIVAL"
              value={formatDuration(myContribution.survivalTimeSec)}
              color="#3B82F6"
            />
            <ContributionStat
              label="SCORE"
              value={Math.round(myContribution.score).toString()}
              color="#CC9933"
            />
          </div>
        </div>
      )}

      {/* 상위 기여자 목록 */}
      {result.topContributors.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            width: '100%',
            maxWidth: 480,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontFamily: BODY_FONT,
              fontSize: 12,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.15em',
            }}
          >
            TOP CONTRIBUTORS
          </div>
          {result.topContributors.slice(0, 5).map((c, i) => (
            <div
              key={c.playerId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background:
                  c.playerId === myPlayerId
                    ? 'rgba(34, 197, 94, 0.08)'
                    : 'rgba(255, 255, 255, 0.02)',
                borderRadius: 4,
                padding: '4px 10px',
              }}
            >
              <span
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.3)',
                  width: 20,
                }}
              >
                #{i + 1}
              </span>
              <span
                style={{
                  fontFamily: BODY_FONT,
                  fontSize: 12,
                  color: c.playerId === myPlayerId ? '#4ADE80' : '#E8E0D4',
                  flex: 1,
                }}
              >
                {c.playerName || c.playerId.slice(0, 8)}
              </span>
              <span
                style={{
                  fontFamily: BODY_FONT,
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                {c.kills}K · {c.assists}A
              </span>
              <span
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontSize: 12,
                  color: '#CC9933',
                }}
              >
                {Math.round(c.score)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 닫기 버튼 */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            fontFamily: BODY_FONT,
            fontSize: 14,
            fontWeight: 600,
            color: '#E8E0D4',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 8,
            padding: '10px 32px',
            cursor: 'pointer',
            letterSpacing: '0.1em',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={e => {
            (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
          }}
          onMouseOut={e => {
            (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
          }}
        >
          CONTINUE
        </button>
      )}

      {/* CSS 키프레임 */}
      <style>{`
        @keyframes victoryFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes victoryGlow {
          0%, 100% { text-shadow: 0 0 24px rgba(255,215,0,0.6), 0 0 48px rgba(255,215,0,0.3); }
          50% { text-shadow: 0 0 36px rgba(255,215,0,0.8), 0 0 72px rgba(255,215,0,0.5); }
        }
      `}</style>
    </div>
  );
});

// ── 기여 통계 서브 컴포넌트 ──

const BODY_FONT_SUB = '"ITC Avant Garde Gothic", "Rajdhani", "Space Grotesk", sans-serif';
const DISPLAY_FONT_SUB = '"Ethnocentric", "Black Ops One", "Chakra Petch", monospace';

const ContributionStat = memo(function ContributionStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        flex: 1,
      }}
    >
      <div
        style={{
          fontFamily: DISPLAY_FONT_SUB,
          fontSize: 16,
          fontWeight: 700,
          color,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: BODY_FONT_SUB,
          fontSize: 9,
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.1em',
        }}
      >
        {label}
      </div>
    </div>
  );
});

// ── 유틸리티 ──

function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const min = Math.floor(s / 60);
  const sec = s % 60;
  if (min > 0) {
    return `${min}m ${sec}s`;
  }
  return `${sec}s`;
}

export default VictoryOverlay;
