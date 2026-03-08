'use client';

/**
 * v26 Phase 6 — Election Panel
 * 선거 기간: 후보 카드 (이름, 파벌 성향 바, 공약 리스트, 지지율)
 * 투표 버튼 (플레이어가 지지 후보 선택)
 * 결과 화면: 당선자 공약 시행 알림
 *
 * 다크 전술 패널 + SK 디자인 토큰
 */

import { useCityStore } from '@/stores/cityStore';
import { SK, bodyFont, headingFont, sketchShadow } from '@/lib/sketch-ui';
import {
  FACTION_AXIS_LABELS,
  FACTION_AXIS_COLORS,
  type FactionAxisKey,
  type CandidateSnapshot,
  type ElectionPhase,
  type PledgeSnapshot,
} from '@agent-survivor/shared/types/city';

// ─── Sub-components ───

/** Compact 4-axis stance display for a candidate */
function CandidateStanceBar({
  axisKey,
  value,
}: {
  axisKey: FactionAxisKey;
  value: number;
}) {
  const [leftLabel, rightLabel] = FACTION_AXIS_LABELS[axisKey];
  const [leftColor, rightColor] = FACTION_AXIS_COLORS[axisKey];
  const pct = ((value + 1) / 2) * 100;
  const isPositive = value >= 0;

  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '2px',
      }}>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '7px',
          color: !isPositive ? leftColor : SK.textMuted,
          fontWeight: !isPositive ? 700 : 400,
        }}>
          {leftLabel}
        </span>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '7px',
          color: isPositive ? rightColor : SK.textMuted,
          fontWeight: isPositive ? 700 : 400,
        }}>
          {rightLabel}
        </span>
      </div>
      <div style={{
        position: 'relative',
        width: '100%',
        height: '4px',
        background: 'rgba(255,255,255,0.06)',
      }}>
        <div style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: '1px',
          background: 'rgba(255,255,255,0.12)',
          zIndex: 1,
        }} />
        <div style={{
          position: 'absolute',
          top: 0,
          height: '100%',
          left: isPositive ? '50%' : `${pct}%`,
          width: `${Math.abs(pct - 50)}%`,
          background: isPositive ? rightColor : leftColor,
          opacity: 0.8,
          transition: 'all 300ms ease',
        }} />
      </div>
    </div>
  );
}

/** Pledge (edict promise) chip */
function PledgeChip({ pledge }: { pledge: PledgeSnapshot }) {
  const catColor: Record<string, string> = {
    economic: SK.gold,
    social: '#F97316',
    military: '#84CC16',
    environmental: '#10B981',
  };
  const accent = catColor[pledge.category] ?? SK.textSecondary;

  return (
    <div
      title={pledge.description}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        background: `${accent}12`,
        border: `1px solid ${accent}30`,
        marginRight: '3px',
        marginBottom: '3px',
      }}
    >
      <div style={{
        width: '2px',
        height: '10px',
        background: accent,
      }} />
      <span style={{
        fontFamily: bodyFont,
        fontSize: '8px',
        color: SK.textPrimary,
        maxWidth: '100px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {pledge.edictName}
      </span>
    </div>
  );
}

/** Single candidate card */
function CandidateCard({
  candidate,
  isVoted,
  canVote,
  onVote,
}: {
  candidate: CandidateSnapshot;
  isVoted: boolean;
  canVote: boolean;
  onVote: (candidateId: string) => void;
}) {
  // Determine accent based on dominant axis
  const axes = candidate.factionAxes;
  const axisValues = [
    { key: 'economic' as FactionAxisKey, val: axes.economic },
    { key: 'environment' as FactionAxisKey, val: axes.environment },
    { key: 'governance' as FactionAxisKey, val: axes.governance },
    { key: 'social' as FactionAxisKey, val: axes.social },
  ];
  const dominant = axisValues.reduce((a, b) =>
    Math.abs(b.val) > Math.abs(a.val) ? b : a
  );
  const [negColor, posColor] = FACTION_AXIS_COLORS[dominant.key];
  const stripeColor = dominant.val >= 0 ? posColor : negColor;

  // Support bar width
  const supportWidth = Math.max(2, candidate.supportPct);

  return (
    <div style={{
      display: 'flex',
      background: isVoted
        ? 'rgba(245, 158, 11, 0.08)'
        : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isVoted ? 'rgba(245, 158, 11, 0.3)' : SK.glassBorder}`,
      marginBottom: '8px',
      overflow: 'hidden',
    }}>
      {/* Left color stripe (faction color) */}
      <div style={{
        width: '4px',
        minHeight: '100%',
        background: stripeColor,
        flexShrink: 0,
      }} />

      <div style={{
        flex: 1,
        padding: '10px 12px',
      }}>
        {/* Header: name + incumbent badge */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              fontFamily: bodyFont,
              fontSize: '12px',
              fontWeight: 700,
              color: SK.textPrimary,
            }}>
              {candidate.name}
            </span>
            {candidate.isIncumbent && (
              <span style={{
                fontFamily: bodyFont,
                fontSize: '7px',
                color: SK.gold,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                padding: '1px 5px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}>
                INCUMBENT
              </span>
            )}
          </div>
          <span style={{
            fontFamily: bodyFont,
            fontSize: '14px',
            fontWeight: 700,
            color: SK.textPrimary,
          }}>
            {candidate.supportPct.toFixed(1)}%
          </span>
        </div>

        {/* Support bar */}
        <div style={{
          width: '100%',
          height: '3px',
          background: 'rgba(255,255,255,0.06)',
          marginBottom: '8px',
        }}>
          <div style={{
            width: `${supportWidth}%`,
            height: '100%',
            background: stripeColor,
            transition: 'width 500ms ease',
          }} />
        </div>

        {/* Political stance (4 axes) */}
        <div style={{ marginBottom: '8px' }}>
          <CandidateStanceBar axisKey="economic" value={axes.economic} />
          <CandidateStanceBar axisKey="environment" value={axes.environment} />
          <CandidateStanceBar axisKey="governance" value={axes.governance} />
          <CandidateStanceBar axisKey="social" value={axes.social} />
        </div>

        {/* Pledged edicts */}
        {candidate.pledges && candidate.pledges.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '8px',
              color: SK.textMuted,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}>
              Pledged Edicts
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {candidate.pledges.map((p) => (
                <PledgeChip key={p.edictId} pledge={p} />
              ))}
            </div>
          </div>
        )}

        {/* Vote button */}
        {canVote && (
          <button
            onClick={() => onVote(candidate.id)}
            disabled={isVoted}
            style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              fontWeight: 700,
              color: isVoted ? SK.gold : SK.textPrimary,
              background: isVoted
                ? 'rgba(245, 158, 11, 0.15)'
                : 'rgba(255,255,255,0.06)',
              border: `1px solid ${isVoted
                ? 'rgba(245, 158, 11, 0.4)'
                : SK.glassBorder}`,
              padding: '5px 14px',
              cursor: isVoted ? 'default' : 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              width: '100%',
            }}
          >
            {isVoted ? 'YOUR VOTE' : 'CAST VOTE'}
          </button>
        )}

        {/* Vote count in results phase */}
        {candidate.votes > 0 && (
          <div style={{
            fontFamily: bodyFont,
            fontSize: '9px',
            color: SK.textMuted,
            marginTop: '4px',
          }}>
            {candidate.votes} votes
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Phase Banner ───

const PHASE_LABELS: Record<ElectionPhase, { label: string; color: string }> = {
  none:     { label: 'No Election', color: SK.textMuted },
  campaign: { label: 'CAMPAIGN PERIOD', color: '#F59E0B' },
  voting:   { label: 'VOTING IN PROGRESS', color: '#10B981' },
  results:  { label: 'ELECTION RESULTS', color: '#3B82F6' },
};

// ─── Main Component ───

interface ElectionPanelProps {
  onClose: () => void;
  onVote: (candidateId: string) => void;
}

export function ElectionPanel({ onClose, onVote }: ElectionPanelProps) {
  const election = useCityStore(s => s.election);
  const tickCount = useCityStore(s =>
    s.election ? s.election.phaseStart : 0
  );

  if (!election) {
    return (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '400px',
        background: 'rgba(9, 9, 11, 0.95)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${SK.glassBorder}`,
        boxShadow: sketchShadow('lg'),
        zIndex: 50,
        pointerEvents: 'auto',
        padding: '24px',
        textAlign: 'center',
      }}>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '13px',
          color: SK.textMuted,
        }}>
          Election data not available yet. Waiting for server...
        </span>
      </div>
    );
  }

  const { phase, candidates, playerVote, nextElection, history } = election;
  const phaseInfo = PHASE_LABELS[phase];
  const canVote = phase === 'campaign' || phase === 'voting';
  const showCandidates = phase !== 'none' && candidates && candidates.length > 0;

  // Sort candidates by support (descending)
  const sortedCandidates = showCandidates
    ? [...candidates].sort((a, b) => b.supportPct - a.supportPct)
    : [];

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '600px',
      maxHeight: '85vh',
      background: 'rgba(9, 9, 11, 0.95)',
      backdropFilter: 'blur(16px)',
      border: `1px solid ${SK.glassBorder}`,
      boxShadow: sketchShadow('lg'),
      zIndex: 50,
      pointerEvents: 'auto',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: `1px solid ${SK.glassBorder}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '4px',
            height: '20px',
            background: phaseInfo.color,
          }} />
          <span style={{
            fontFamily: headingFont,
            fontSize: '16px',
            fontWeight: 700,
            color: SK.textPrimary,
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            Elections
          </span>
          <span style={{
            fontFamily: bodyFont,
            fontSize: '9px',
            fontWeight: 700,
            color: phaseInfo.color,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '2px 8px',
            background: `${phaseInfo.color}15`,
            border: `1px solid ${phaseInfo.color}30`,
          }}>
            {phaseInfo.label}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: SK.textMuted,
            fontSize: '18px',
            cursor: 'pointer',
            padding: '4px',
            lineHeight: 1,
          }}
        >
          X
        </button>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
      }}>
        {/* No election state */}
        {phase === 'none' && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
          }}>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '13px',
              color: SK.textSecondary,
              marginBottom: '8px',
            }}>
              No election in progress
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '11px',
              color: SK.textMuted,
            }}>
              Next election at tick {nextElection}
            </div>
          </div>
        )}

        {/* Candidate list */}
        {showCandidates && (
          <div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.textSecondary,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '10px',
              paddingBottom: '4px',
              borderBottom: `1px solid ${SK.glassBorder}`,
            }}>
              Candidates ({sortedCandidates.length})
            </div>
            {sortedCandidates.map((cand) => (
              <CandidateCard
                key={cand.id}
                candidate={cand}
                isVoted={playerVote === cand.id}
                canVote={canVote}
                onVote={onVote}
              />
            ))}
          </div>
        )}

        {/* Election history */}
        {history && history.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.textSecondary,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '8px',
              paddingBottom: '4px',
              borderBottom: `1px solid ${SK.glassBorder}`,
            }}>
              Election History
            </div>
            {history.slice().reverse().map((rec, i) => (
              <div key={`${rec.tick}-${i}`} style={{
                padding: '6px 8px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${SK.glassBorder}`,
                marginBottom: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <span style={{
                    fontFamily: bodyFont,
                    fontSize: '10px',
                    color: SK.textPrimary,
                    fontWeight: 700,
                  }}>
                    {rec.winnerName}
                  </span>
                  <span style={{
                    fontFamily: bodyFont,
                    fontSize: '9px',
                    color: SK.textMuted,
                    marginLeft: '6px',
                  }}>
                    won with {rec.totalVotes > 0
                      ? ((rec.candidates.find(c => c.id === rec.winnerId)?.supportPct ?? 0).toFixed(0))
                      : '?'}%
                  </span>
                </div>
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: '8px',
                  color: SK.textMuted,
                }}>
                  Tick {rec.tick}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
