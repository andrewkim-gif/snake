'use client';

/**
 * NationScoreboard.tsx — v33 Phase 5: 실시간 국가별 점수 순위
 *
 * Canvas 위 React DOM 오버레이 (position: absolute, 우상단)
 * - 상위 5개국 Nation Score 실시간 표시
 * - 내 국가 하이라이트 (골드 글로우)
 * - 점수 변동 애니메이션
 * - 에폭 종료 시 확장 모드 (EpochResultScreen에서 처리)
 *
 * 디자인: 다크/글로우 | Ethnocentric (display) + ITC Avant Garde Gothic (body)
 */

import { memo, useMemo } from 'react';

// ─── 폰트 정의 ───
const DISPLAY_FONT = '"Ethnocentric", "Black Ops One", "Chakra Petch", monospace';
const BODY_FONT = '"ITC Avant Garde Gothic", "Rajdhani", "Space Grotesk", sans-serif';

// ─── 순위별 색상 ───
const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#8B8D98', '#55565E'] as const;
const RANK_GLOW = [
  '0 0 8px rgba(255,215,0,0.4)',
  '0 0 6px rgba(192,192,192,0.3)',
  '0 0 6px rgba(205,127,50,0.3)',
  'none',
  'none',
] as const;

// ─── Props ───

export interface NationScoreEntry {
  nation: string;
  score: number;
}

export interface NationScoreboardProps {
  /** 국가별 점수 맵 */
  nationScores: Record<string, number>;
  /** 플레이어 소속 국가 코드 */
  playerNation?: string;
  /** 개인 점수 */
  personalScore?: number;
  /** 개인 순위 */
  personalRank?: number;
  /** 최대 표시 개수 */
  maxDisplay?: number;
  /** 컴팩트 모드 (미니맵 옆) */
  compact?: boolean;
}

// ─── Utils ───

function formatScore(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

/** 국가 코드 → 국기 이모지 변환 */
function countryFlag(code: string): string {
  if (!code || code.length !== 3) return '';
  // ISO 3166-1 alpha-2 변환 시도 (3글자 → 2글자 매핑은 복잡하므로 3자 코드 그대로 표시)
  const iso2Map: Record<string, string> = {
    KOR: 'KR', USA: 'US', JPN: 'JP', CHN: 'CN', GBR: 'GB',
    FRA: 'FR', DEU: 'DE', RUS: 'RU', BRA: 'BR', IND: 'IN',
    AUS: 'AU', CAN: 'CA', MEX: 'MX', ITA: 'IT', ESP: 'ES',
  };
  const iso2 = iso2Map[code.toUpperCase()];
  if (!iso2) return '';
  const codePoints = [...iso2.toUpperCase()].map(
    (c) => 0x1F1E6 - 65 + c.charCodeAt(0),
  );
  return String.fromCodePoint(...codePoints);
}

// ─── Component ───

function NationScoreboardInner({
  nationScores,
  playerNation,
  personalScore,
  personalRank,
  maxDisplay = 5,
  compact = false,
}: NationScoreboardProps) {
  // 상위 N개국 정렬
  const sortedNations = useMemo(() => {
    return Object.entries(nationScores)
      .map(([nation, score]) => ({ nation, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxDisplay);
  }, [nationScores, maxDisplay]);

  if (sortedNations.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: compact ? 56 : 8,
        right: 8,
        zIndex: 45,
        pointerEvents: 'none',
        userSelect: 'none',
        width: compact ? 140 : 170,
      }}
    >
      {/* ═══ Header ═══ */}
      <div
        style={{
          background: 'rgba(8,8,12,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(204,153,51,0.3)',
          padding: compact ? '3px 8px' : '4px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
        }}
      >
        <span
          style={{
            color: '#CC9933',
            fontFamily: DISPLAY_FONT,
            fontSize: compact ? 8 : 9,
            fontWeight: 700,
            letterSpacing: '0.15em',
            textShadow: '0 0 6px rgba(204,153,51,0.4)',
          }}
        >
          NATIONS
        </span>
        {personalRank !== undefined && (
          <span
            style={{
              color: '#8B8D98',
              fontFamily: BODY_FONT,
              fontSize: 8,
            }}
          >
            #{personalRank}
          </span>
        )}
      </div>

      {/* ═══ Score Rows ═══ */}
      <div
        style={{
          background: 'rgba(8,8,12,0.75)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.04)',
          borderTop: 'none',
        }}
      >
        {sortedNations.map((entry, idx) => {
          const isPlayerNation = playerNation?.toUpperCase() === entry.nation.toUpperCase();
          const rankColor = RANK_COLORS[idx] ?? '#55565E';
          const rankGlow = RANK_GLOW[idx] ?? 'none';
          const flag = countryFlag(entry.nation);

          return (
            <div
              key={entry.nation}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: compact ? '2px 8px' : '3px 10px',
                gap: compact ? 4 : 6,
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                background: isPlayerNation ? 'rgba(204,153,51,0.08)' : 'transparent',
                borderLeft: isPlayerNation ? '2px solid #CC9933' : '2px solid transparent',
              }}
            >
              {/* Rank */}
              <span
                style={{
                  color: rankColor,
                  fontFamily: DISPLAY_FONT,
                  fontSize: compact ? 9 : 10,
                  fontWeight: 700,
                  width: 14,
                  textAlign: 'right',
                  textShadow: rankGlow,
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </span>

              {/* Flag + Nation code */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, minWidth: 0 }}>
                {flag && (
                  <span style={{ fontSize: compact ? 10 : 12, lineHeight: 1 }}>{flag}</span>
                )}
                <span
                  style={{
                    color: isPlayerNation ? '#CC9933' : '#ECECEF',
                    fontFamily: BODY_FONT,
                    fontSize: compact ? 9 : 10,
                    fontWeight: isPlayerNation ? 700 : 500,
                    letterSpacing: '0.05em',
                    textShadow: isPlayerNation ? '0 0 6px rgba(204,153,51,0.3)' : 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.nation}
                </span>
              </div>

              {/* Score */}
              <span
                style={{
                  color: isPlayerNation ? '#CC9933' : '#8B8D98',
                  fontFamily: DISPLAY_FONT,
                  fontSize: compact ? 9 : 10,
                  fontWeight: 600,
                  textAlign: 'right',
                  flexShrink: 0,
                  minWidth: 32,
                  textShadow: isPlayerNation ? '0 0 4px rgba(204,153,51,0.3)' : 'none',
                }}
              >
                {formatScore(entry.score)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ═══ Personal Score Footer ═══ */}
      {personalScore !== undefined && (
        <div
          style={{
            background: 'rgba(8,8,12,0.85)',
            borderTop: '1px solid rgba(204,153,51,0.2)',
            padding: compact ? '3px 8px' : '4px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)',
          }}
        >
          <span
            style={{
              color: '#8B8D98',
              fontFamily: BODY_FONT,
              fontSize: 8,
              letterSpacing: '0.1em',
            }}
          >
            MY SCORE
          </span>
          <span
            style={{
              color: '#CC9933',
              fontFamily: DISPLAY_FONT,
              fontSize: 11,
              fontWeight: 700,
              textShadow: '0 0 6px rgba(204,153,51,0.4)',
            }}
          >
            {formatScore(personalScore)}
          </span>
        </div>
      )}
    </div>
  );
}

const NationScoreboard = memo(NationScoreboardInner);
export default NationScoreboard;
