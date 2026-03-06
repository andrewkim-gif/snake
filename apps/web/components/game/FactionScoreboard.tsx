'use client';

/**
 * FactionScoreboard — 현재 배틀의 팩션별 점수 (킬/생존/레벨)
 * v12 S23: state 패킷에서 실시간 추출하여 팩션별 스코어 표시
 * 화면 우측 상단, Dark Tactical 스타일
 */

import { useMemo } from 'react';
import type { GameData } from '@/hooks/useSocket';
import type { AgentNetworkData, LeaderboardEntry } from '@agent-survivor/shared';

interface FactionScoreboardProps {
  dataRef: React.MutableRefObject<GameData>;
}

interface FactionScore {
  factionId: string;
  label: string;
  color: string;
  kills: number;
  alive: number;
  totalLevel: number;
  agentCount: number;
  avgLevel: number;
  score: number;
}

// 팩션 색상 (서버 팩션 ID 기반, 기본 4개 팩션)
const FACTION_COLORS: Record<string, { color: string; label: string }> = {
  red: { color: '#FF5555', label: 'RED' },
  blue: { color: '#5588FF', label: 'BLUE' },
  green: { color: '#55FF55', label: 'GREEN' },
  yellow: { color: '#FFFF55', label: 'YELLOW' },
  // 폴백
  default: { color: '#AAAAAA', label: 'NEUTRAL' },
};

function getFactionMeta(factionId: string): { color: string; label: string } {
  return FACTION_COLORS[factionId.toLowerCase()] ?? {
    color: FACTION_COLORS.default.color,
    label: factionId.toUpperCase().slice(0, 6),
  };
}

/** state 패킷에서 팩션별 스코어를 집계 */
function aggregateFactionScores(agents: AgentNetworkData[], leaderboard: LeaderboardEntry[]): FactionScore[] {
  const factionMap = new Map<string, FactionScore>();

  // 에이전트 이름 패턴에서 팩션 추출 (서버가 [FACTION] 접두사 제공하는 경우)
  // 또는 봇이 아닌 에이전트를 색상으로 구분
  // 현재 서버 데이터에서 팩션 ID가 별도 필드로 오지 않으므로,
  // leaderboard의 faction 필드 사용 또는 이름 패턴 파싱
  for (const agent of agents) {
    // 에이전트 이름에서 팩션 추출 시도: "[RED] AgentName" 패턴
    const nameMatch = agent.n?.match(/^\[(\w+)\]/);
    let factionId = nameMatch?.[1]?.toLowerCase() ?? 'neutral';

    // 봇이면 팩션 배정 (이름 접두사 없으면 neutral)
    if (factionId === 'neutral' && agent.bot) {
      // 봇 이름 기반 팩션: 간단히 ID 해싱
      const hash = agent.i.charCodeAt(0) % 4;
      factionId = ['red', 'blue', 'green', 'yellow'][hash];
    }

    if (!factionMap.has(factionId)) {
      const meta = getFactionMeta(factionId);
      factionMap.set(factionId, {
        factionId,
        label: meta.label,
        color: meta.color,
        kills: 0,
        alive: 0,
        totalLevel: 0,
        agentCount: 0,
        avgLevel: 0,
        score: 0,
      });
    }

    const f = factionMap.get(factionId)!;
    f.agentCount++;
    f.totalLevel += agent.lv ?? 1;
    if (agent.a) f.alive++;
    f.kills += agent.ks ?? 0;
  }

  // leaderboard에서 추가 킬 정보 보완
  for (const entry of leaderboard) {
    // 이미 에이전트에서 처리했으므로 skip
  }

  // 평균 레벨 + 스코어 계산
  for (const f of factionMap.values()) {
    f.avgLevel = f.agentCount > 0 ? Math.round(f.totalLevel / f.agentCount * 10) / 10 : 0;
    // 스코어 = 킬 * 15 + 생존자 * 50 + 평균레벨 * 10
    f.score = f.kills * 15 + f.alive * 50 + Math.round(f.avgLevel * 10);
  }

  // 스코어 내림차순 정렬
  return Array.from(factionMap.values())
    .filter(f => f.agentCount > 0)
    .sort((a, b) => b.score - a.score);
}

export function FactionScoreboard({ dataRef }: FactionScoreboardProps) {
  const state = dataRef.current.latestState;
  const agents = state?.s ?? [];
  const leaderboard = dataRef.current.leaderboard ?? [];

  const factions = useMemo(
    () => aggregateFactionScores(agents, leaderboard),
    // 매 렌더 시 재계산 (state 패킷은 ref이므로 useMemo 의존성 트릭)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agents.length, leaderboard.length],
  );

  if (factions.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '48px',
      right: '12px',
      zIndex: 15,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      minWidth: '150px',
    }}>
      {/* 헤더 */}
      <div style={{
        fontFamily: '"Black Ops One", "Rajdhani", "Inter", sans-serif',
        fontSize: '10px',
        fontWeight: 700,
        color: '#CC9933',
        letterSpacing: '0.08em',
        padding: '2px 6px',
        backgroundColor: 'rgba(17, 17, 17, 0.7)',
        borderBottom: '1px solid rgba(204, 153, 51, 0.3)',
        textTransform: 'uppercase',
      }}>
        FACTION SCORES
      </div>

      {/* 팩션 행 */}
      {factions.slice(0, 4).map((f, idx) => (
        <div key={f.factionId} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '3px 6px',
          backgroundColor: idx === 0
            ? `rgba(17, 17, 17, 0.85)`
            : 'rgba(17, 17, 17, 0.7)',
          borderLeft: `3px solid ${f.color}`,
        }}>
          {/* 순위 */}
          <span style={{
            fontFamily: '"Rajdhani", "Inter", sans-serif',
            fontSize: '10px',
            fontWeight: 700,
            color: idx === 0 ? '#CC9933' : '#888888',
            width: '12px',
            textAlign: 'center',
          }}>
            {idx + 1}
          </span>

          {/* 팩션 이름 */}
          <span style={{
            fontFamily: '"Rajdhani", "Inter", sans-serif',
            fontSize: '11px',
            fontWeight: 700,
            color: f.color,
            flex: 1,
            letterSpacing: '0.04em',
          }}>
            {f.label}
          </span>

          {/* 킬 수 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '2px',
          }}>
            {/* 킬 아이콘 (검) */}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#FF5555" style={{ opacity: 0.7 }}>
              <path d="M6.92 5L5 7l6 6-5 5 1.5 1.5 5-5 5 5L19 18l-5-5 6-6-2-2-6 6-5.08-6z" />
            </svg>
            <span style={{
              fontFamily: '"Rajdhani", "Inter", sans-serif',
              fontSize: '10px',
              fontWeight: 600,
              color: '#E8E0D4',
            }}>
              {f.kills}
            </span>
          </div>

          {/* 생존 수 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '2px',
          }}>
            {/* 생존 아이콘 (하트) */}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#55FF55" style={{ opacity: 0.7 }}>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span style={{
              fontFamily: '"Rajdhani", "Inter", sans-serif',
              fontSize: '10px',
              fontWeight: 600,
              color: '#E8E0D4',
            }}>
              {f.alive}
            </span>
          </div>

          {/* 평균 레벨 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '2px',
          }}>
            <span style={{
              fontFamily: '"Rajdhani", "Inter", sans-serif',
              fontSize: '9px',
              fontWeight: 600,
              color: '#55FFFF',
            }}>
              Lv
            </span>
            <span style={{
              fontFamily: '"Rajdhani", "Inter", sans-serif',
              fontSize: '10px',
              fontWeight: 600,
              color: '#E8E0D4',
            }}>
              {f.avgLevel.toFixed(1)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
