'use client';

/**
 * BattleResultOverlay — 배틀 종료 전체화면 오버레이
 * v12 S20: 승리 팩션, 점령 변화, 개인 스코어 (v11 공식), 10초 자동 복귀
 * Dark Tactical / War Room 디자인 시스템
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type {
  RoundEndPayload,
  DeathPayload,
  SovereigntyDelta,
  TopPlayerEntry,
} from '@agent-survivor/shared';
import { SK, bodyFont, sketchShadow } from '@/lib/sketch-ui';

// 팩션 색상 팔레트 (globe-data에서 공유)
const FACTION_COLORS: Record<string, string> = {
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#22C55E',
  yellow: '#F59E0B',
  purple: '#8B5CF6',
  orange: '#F97316',
  cyan: '#06B6D4',
  pink: '#EC4899',
};

function getFactionDisplayColor(faction: string): string {
  const lower = faction.toLowerCase();
  return FACTION_COLORS[lower] ?? SK.gold;
}

// v11 스코어링 공식 표시
function formatScoreBreakdown(
  alive: boolean,
  kills: number,
  level: number,
  damage: number,
  survivalSec: number,
): { total: number; breakdown: string } {
  if (alive) {
    const base = 100;
    const killPts = kills * 15;
    const lvlPts = level * 10;
    const dmgPts = Math.floor(damage * 0.5);
    const total = base + killPts + lvlPts + dmgPts;
    return {
      total,
      breakdown: `Base 100 + Kills(${kills}x15=${killPts}) + Level(${level}x10=${lvlPts}) + Damage(${Math.floor(damage)}x0.5=${dmgPts})`,
    };
  } else {
    const killPts = kills * 15;
    const lvlPts = level * 10;
    const dmgPts = Math.floor(damage * 0.5);
    const survPts = Math.floor(survivalSec * 2);
    const total = killPts + lvlPts + dmgPts + survPts;
    return {
      total,
      breakdown: `Kills(${kills}x15=${killPts}) + Level(${level}x10=${lvlPts}) + Damage(${Math.floor(damage)}x0.5=${dmgPts}) + Survival(${Math.floor(survivalSec)}sx2=${survPts})`,
    };
  }
}

// 주권 레벨 표시 텍스트
function sovereigntyLevelLabel(level: number): string {
  const labels = ['', 'Lv1 Influence', 'Lv2 Control', 'Lv3 Dominion', 'Lv4 Authority', 'Lv5 Sovereignty'];
  return labels[Math.min(level, 5)] || `Lv${level}`;
}

interface BattleResultOverlayProps {
  roundEnd: RoundEndPayload;
  deathInfo?: DeathPayload | null;
  countdownSec: number;
  onReenter?: () => void;
  onRedeploy?: () => void;
  onExit?: () => void;
}

export function BattleResultOverlay({
  roundEnd,
  deathInfo,
  countdownSec,
  onReenter,
  onRedeploy,
  onExit,
}: BattleResultOverlayProps) {
  const tOverlay = useTranslations('overlay');
  const tGame = useTranslations('game');
  const {
    winner,
    winnerFaction,
    sovereigntyChange,
    topPlayers,
    yourRank,
    yourScore,
    finalLeaderboard,
  } = roundEnd;

  const playerAlive = deathInfo == null;
  const playerKills = deathInfo?.kills ?? winner?.kills ?? 0;
  const playerLevel = 1; // from leaderboard if available
  const playerDamage = 0; // not always available
  const playerSurvival = deathInfo?.duration ?? 300;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(9, 9, 11, 0.92)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      zIndex: 45,
      fontFamily: bodyFont,
      gap: '12px',
      overflowY: 'auto',
      padding: 'clamp(12px, 3vw, 24px)',
      WebkitOverflowScrolling: 'touch' as never,
    }}>
      {/* 배틀 종료 타이틀 */}
      <h2 style={{
        fontFamily: '"Black Ops One", "Inter", sans-serif',
        fontSize: 'clamp(18px, 4vw, 28px)',
        color: SK.gold,
        margin: 0,
        textTransform: 'uppercase',
        letterSpacing: '3px',
        textShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
      }}>
        {tOverlay('battleComplete')}
      </h2>

      {/* 승리 팩션 */}
      {winnerFaction && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span style={{
            fontSize: '11px',
            color: SK.textMuted,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            {tOverlay('victoriousFaction')}
          </span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {/* 팩션 색상 아이콘 */}
            <div style={{
              width: '14px',
              height: '14px',
              borderRadius: '3px',
              backgroundColor: getFactionDisplayColor(winnerFaction),
              boxShadow: `0 0 12px ${getFactionDisplayColor(winnerFaction)}60`,
            }} />
            <span style={{
              fontFamily: '"Black Ops One", "Inter", sans-serif',
              fontSize: 'clamp(16px, 3.5vw, 24px)',
              color: getFactionDisplayColor(winnerFaction),
              textTransform: 'uppercase',
              letterSpacing: '2px',
            }}>
              {winnerFaction}
            </span>
          </div>
        </div>
      )}

      {/* 점령 변화 */}
      {sovereigntyChange && (
        <SovereigntyChangeCard change={sovereigntyChange} />
      )}

      {/* 개인 스코어 카드 */}
      <div style={{
        backgroundColor: SK.cardBg,
        border: `1px solid ${SK.border}`,
        borderRadius: '6px',
        padding: '12px 20px',
        minWidth: '260px',
        maxWidth: '360px',
        width: '100%',
        boxShadow: sketchShadow('md'),
      }}>
        <div style={{
          fontSize: '10px',
          color: SK.textMuted,
          letterSpacing: '2px',
          fontWeight: 700,
          marginBottom: '8px',
          textTransform: 'uppercase',
          borderBottom: `1px solid ${SK.border}`,
          paddingBottom: '6px',
        }}>
          {tOverlay('yourResult')} — {playerAlive ? tGame('survived') : tGame('eliminated')}
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}>
          <span style={{ fontSize: '13px', color: SK.textSecondary }}>{tGame('rank')}</span>
          <span style={{
            fontSize: '16px',
            fontWeight: 700,
            color: yourRank <= 3 ? SK.gold : SK.textPrimary,
          }}>
            #{yourRank}
          </span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}>
          <span style={{ fontSize: '13px', color: SK.textSecondary }}>{tGame('score')}</span>
          <span style={{
            fontSize: '16px',
            fontWeight: 700,
            color: SK.gold,
          }}>
            {yourScore}
          </span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}>
          <span style={{ fontSize: '13px', color: SK.textSecondary }}>{tGame('kills')}</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: SK.red }}>
            {playerKills}
          </span>
        </div>
        {/* 생존 시간 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '13px', color: SK.textSecondary }}>{tOverlay('survival')}</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: SK.blue }}>
            {Math.floor(playerSurvival)}s
          </span>
        </div>
      </div>

      {/* 탑 플레이어 목록 */}
      {topPlayers && topPlayers.length > 0 && (
        <TopPlayersCard players={topPlayers} />
      )}

      {/* 최종 리더보드 (topPlayers 없을 때 fallback) */}
      {(!topPlayers || topPlayers.length === 0) && finalLeaderboard.length > 0 && (
        <div style={{
          backgroundColor: SK.cardBg,
          border: `1px solid ${SK.border}`,
          borderRadius: '6px',
          padding: '10px 16px',
          minWidth: '220px',
          maxWidth: '320px',
          width: '100%',
          boxShadow: sketchShadow('sm'),
        }}>
          <div style={{
            fontSize: '10px',
            color: SK.textMuted,
            letterSpacing: '2px',
            fontWeight: 700,
            marginBottom: '6px',
          }}>
            {tOverlay('finalStandings')}
          </div>
          {finalLeaderboard.slice(0, 5).map((entry, i) => (
            <div key={entry.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              padding: '2px 0',
              color: i === 0 ? SK.gold : SK.textSecondary,
              fontWeight: i === 0 ? 700 : 400,
            }}>
              <span>#{entry.rank} {entry.name}</span>
              <span>{entry.score}</span>
            </div>
          ))}
        </div>
      )}

      {/* 액션 버튼 + 카운트다운 */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginTop: '8px',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {onReenter && (
          <ActionButton
            label={tOverlay('sameCountry')}
            color={SK.blue}
            onClick={onReenter}
          />
        )}
        {onRedeploy && (
          <ActionButton
            label={tOverlay('redeploy')}
            color={SK.green}
            onClick={onRedeploy}
          />
        )}
      </div>

      {/* 자동 복귀 카운트다운 */}
      <div style={{
        fontSize: '11px',
        color: SK.textMuted,
        letterSpacing: '1.5px',
        fontWeight: 600,
        marginTop: '4px',
      }}>
        {tOverlay('returningToLobby', { seconds: countdownSec })}
      </div>
    </div>
  );
}

// ─── 내부 컴포넌트 ───

function SovereigntyChangeCard({ change }: { change: SovereigntyDelta }) {
  const tOverlay = useTranslations('overlay');
  const oldColor = change.oldFaction ? getFactionDisplayColor(change.oldFaction) : SK.textMuted;
  const newColor = getFactionDisplayColor(change.newFaction);

  return (
    <div style={{
      backgroundColor: SK.cardBg,
      border: `1px solid ${SK.border}`,
      borderRadius: '6px',
      padding: '10px 16px',
      minWidth: '240px',
      maxWidth: '340px',
      width: '100%',
      boxShadow: sketchShadow('sm'),
    }}>
      <div style={{
        fontSize: '10px',
        color: SK.textMuted,
        letterSpacing: '2px',
        fontWeight: 700,
        marginBottom: '8px',
      }}>
        {change.isNewClaim ? tOverlay('territoryClaimed') : tOverlay('sovereigntyChanged')}
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
        fontWeight: 700,
      }}>
        <span style={{ color: SK.textPrimary, letterSpacing: '1px' }}>
          {change.countryIso}:
        </span>
        {change.oldFaction && (
          <>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: oldColor,
            }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                backgroundColor: oldColor,
                display: 'inline-block',
              }} />
              {change.oldFaction}
            </span>
            <span style={{ color: SK.textMuted }}>→</span>
          </>
        )}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          color: newColor,
        }}>
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '2px',
            backgroundColor: newColor,
            display: 'inline-block',
          }} />
          {change.newFaction}
        </span>
      </div>
      <div style={{
        fontSize: '11px',
        color: SK.textSecondary,
        marginTop: '4px',
        letterSpacing: '0.5px',
      }}>
        {sovereigntyLevelLabel(change.newLevel)}
      </div>
    </div>
  );
}

function TopPlayersCard({ players }: { players: TopPlayerEntry[] }) {
  const tOverlay = useTranslations('overlay');
  const tGame = useTranslations('game');
  return (
    <div style={{
      backgroundColor: SK.cardBg,
      border: `1px solid ${SK.border}`,
      borderRadius: '6px',
      padding: '10px 16px',
      minWidth: '260px',
      maxWidth: '360px',
      width: '100%',
      boxShadow: sketchShadow('sm'),
    }}>
      <div style={{
        fontSize: '10px',
        color: SK.textMuted,
        letterSpacing: '2px',
        fontWeight: 700,
        marginBottom: '6px',
      }}>
        {tOverlay('topCombatants')}
      </div>
      {players.slice(0, 5).map((p, i) => (
        <div key={p.id} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          padding: '3px 0',
          color: i === 0 ? SK.gold : SK.textSecondary,
          fontWeight: i === 0 ? 700 : 400,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '18px', textAlign: 'right' }}>#{i + 1}</span>
            <span>{p.name}</span>
            {p.alive && (
              <span style={{
                fontSize: '9px',
                color: SK.green,
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                padding: '1px 4px',
                borderRadius: '2px',
                letterSpacing: '0.5px',
              }}>
                {tGame('alive')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
            <span>{p.kills}K</span>
            <span>Lv{p.level}</span>
            <span style={{ color: SK.gold, fontWeight: 700 }}>{p.score}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 24px',
        minHeight: '44px',
        fontSize: '12px',
        fontWeight: 700,
        fontFamily: bodyFont,
        letterSpacing: '1.5px',
        color: SK.textPrimary,
        backgroundColor: 'transparent',
        border: `1px solid ${color}`,
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 150ms ease',
        textTransform: 'uppercase' as const,
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLElement).style.backgroundColor = `${color}20`;
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.backgroundColor = 'transparent';
      }}
    >
      {label}
    </button>
  );
}
