'use client';

/**
 * SpectatorMode — 사망 후 관전 모드 UI
 * v12 S20: 자유 카메라 관전, 에이전트 팔로우, 미니맵 클릭으로 이동
 * 1-life 시스템: 사망 → 관전 모드 전환 (리스폰 비활성) → 배틀 종료까지 대기
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { DeathPayload, AgentNetworkData } from '@agent-survivor/shared';
import { SK, bodyFont, sketchShadow } from '@/lib/sketch-ui';

export interface SpectatorTarget {
  id: string;
  name: string;
  kills: number;
  level: number;
  score: number;
  alive: boolean;
}

interface SpectatorModeProps {
  deathInfo: DeathPayload;
  /** 현재 살아있는 에이전트 목록 (미니맵/리스트에서 선택 가능) */
  aliveAgents: SpectatorTarget[];
  /** 현재 팔로우 중인 에이전트 ID */
  followTarget: string | null;
  /** 에이전트 팔로우 시작 */
  onFollowAgent: (agentId: string | null) => void;
  /** 관전 카메라 위치 이동 (미니맵 클릭) */
  onMoveCamera?: (worldX: number, worldY: number) => void;
  /** 배틀 종료까지 남은 시간 */
  timeRemaining: number;
  /** 실시간 관전자 수 */
  spectatorCount?: number;
}

export function SpectatorMode({
  deathInfo,
  aliveAgents,
  followTarget,
  onFollowAgent,
  onMoveCamera,
  timeRemaining,
  spectatorCount = 0,
}: SpectatorModeProps) {
  const [listOpen, setListOpen] = useState(false);
  const [freeCam, setFreeCam] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);

  // 등장 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => setFadeIn(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleFollowAgent = useCallback((agentId: string) => {
    onFollowAgent(agentId);
    setFreeCam(false);
    setListOpen(false);
  }, [onFollowAgent]);

  const handleFreeCam = useCallback(() => {
    onFollowAgent(null);
    setFreeCam(true);
  }, [onFollowAgent]);

  const handleNextAgent = useCallback(() => {
    if (aliveAgents.length === 0) return;
    const currentIdx = followTarget
      ? aliveAgents.findIndex(a => a.id === followTarget)
      : -1;
    const nextIdx = (currentIdx + 1) % aliveAgents.length;
    handleFollowAgent(aliveAgents[nextIdx].id);
  }, [aliveAgents, followTarget, handleFollowAgent]);

  const handlePrevAgent = useCallback(() => {
    if (aliveAgents.length === 0) return;
    const currentIdx = followTarget
      ? aliveAgents.findIndex(a => a.id === followTarget)
      : 0;
    const prevIdx = (currentIdx - 1 + aliveAgents.length) % aliveAgents.length;
    handleFollowAgent(aliveAgents[prevIdx].id);
  }, [aliveAgents, followTarget, handleFollowAgent]);

  const followName = followTarget
    ? aliveAgents.find(a => a.id === followTarget)?.name ?? 'Unknown'
    : null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 30,
      opacity: fadeIn ? 1 : 0,
      transition: 'opacity 500ms ease',
    }}>
      {/* 상단 관전 바 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'linear-gradient(to bottom, rgba(9,9,11,0.85) 0%, transparent 100%)',
        pointerEvents: 'auto',
      }}>
        {/* 좌: 관전 모드 라벨 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            padding: '3px 10px',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${SK.red}40`,
            borderRadius: '3px',
          }}>
            <span style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              fontWeight: 700,
              color: SK.red,
              letterSpacing: '2px',
            }}>
              SPECTATING
            </span>
          </div>
          {spectatorCount > 0 && (
            <span style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.textMuted,
              letterSpacing: '1px',
            }}>
              {spectatorCount} watching
            </span>
          )}
        </div>

        {/* 중앙: 팔로우 대상 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          {followName ? (
            <>
              <SpecButton label="<" onClick={handlePrevAgent} small />
              <span style={{
                fontFamily: bodyFont,
                fontSize: '12px',
                fontWeight: 700,
                color: SK.textPrimary,
                letterSpacing: '1px',
                minWidth: '80px',
                textAlign: 'center',
              }}>
                {followName}
              </span>
              <SpecButton label=">" onClick={handleNextAgent} small />
            </>
          ) : (
            <span style={{
              fontFamily: bodyFont,
              fontSize: '11px',
              color: SK.textSecondary,
              letterSpacing: '1px',
            }}>
              FREE CAMERA
            </span>
          )}
        </div>

        {/* 우: 타이머 */}
        <div style={{
          fontFamily: bodyFont,
          fontSize: '12px',
          fontWeight: 700,
          color: SK.textSecondary,
          letterSpacing: '1px',
        }}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
      </div>

      {/* 하단 컨트롤 바 */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '8px',
        pointerEvents: 'auto',
      }}>
        <SpecButton
          label="FREE CAM"
          onClick={handleFreeCam}
          active={freeCam}
        />
        <SpecButton
          label="AGENTS"
          onClick={() => setListOpen(!listOpen)}
          active={listOpen}
        />
        {aliveAgents.length > 0 && !followTarget && (
          <SpecButton
            label="FOLLOW"
            onClick={handleNextAgent}
          />
        )}
      </div>

      {/* 에이전트 목록 패널 */}
      {listOpen && (
        <div style={{
          position: 'absolute',
          bottom: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: SK.glassBg,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${SK.glassBorder}`,
          borderRadius: '6px',
          padding: '8px',
          maxHeight: '200px',
          overflowY: 'auto',
          minWidth: '240px',
          maxWidth: '320px',
          boxShadow: sketchShadow('lg'),
          pointerEvents: 'auto',
        }}>
          <div style={{
            fontSize: '9px',
            color: SK.textMuted,
            letterSpacing: '2px',
            fontWeight: 700,
            padding: '4px 8px',
            borderBottom: `1px solid ${SK.border}`,
            marginBottom: '4px',
          }}>
            ALIVE AGENTS ({aliveAgents.length})
          </div>
          {aliveAgents.map(agent => (
            <button
              key={agent.id}
              onClick={() => handleFollowAgent(agent.id)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                padding: '6px 8px',
                backgroundColor: followTarget === agent.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontFamily: bodyFont,
                fontSize: '11px',
                color: followTarget === agent.id ? SK.textPrimary : SK.textSecondary,
                fontWeight: followTarget === agent.id ? 700 : 400,
                transition: 'all 100ms ease',
              }}
              onMouseEnter={(e) => {
                if (followTarget !== agent.id) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = SK.cardBgHover;
                }
              }}
              onMouseLeave={(e) => {
                if (followTarget !== agent.id) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }
              }}
            >
              <span>{agent.name}</span>
              <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: SK.textMuted }}>
                <span>{agent.kills}K</span>
                <span>Lv{agent.level}</span>
              </div>
            </button>
          ))}
          {aliveAgents.length === 0 && (
            <div style={{
              padding: '12px 8px',
              textAlign: 'center',
              fontSize: '11px',
              color: SK.textMuted,
            }}>
              No agents alive
            </div>
          )}
        </div>
      )}

      {/* 사망 정보 (좌하단, 컴팩트) */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        pointerEvents: 'none',
      }}>
        <div style={{
          backgroundColor: SK.glassBg,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: `1px solid ${SK.border}`,
          borderRadius: '4px',
          padding: '8px 12px',
        }}>
          <div style={{
            fontSize: '10px',
            color: SK.red,
            fontWeight: 700,
            letterSpacing: '1px',
            marginBottom: '2px',
          }}>
            ELIMINATED
          </div>
          {deathInfo.killer && (
            <div style={{ fontSize: '11px', color: SK.textSecondary }}>
              by <span style={{ color: SK.textPrimary, fontWeight: 600 }}>{deathInfo.killer}</span>
            </div>
          )}
          <div style={{
            display: 'flex',
            gap: '8px',
            fontSize: '10px',
            color: SK.textMuted,
            marginTop: '4px',
          }}>
            <span>Score: {deathInfo.score}</span>
            <span>Kills: {deathInfo.kills}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 내부 버튼 ───

function SpecButton({
  label,
  onClick,
  active = false,
  small = false,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? '4px 8px' : '6px 14px',
        fontSize: small ? '11px' : '10px',
        fontWeight: 700,
        fontFamily: bodyFont,
        letterSpacing: '1px',
        color: active ? SK.textPrimary : SK.textSecondary,
        backgroundColor: active ? 'rgba(99, 102, 241, 0.2)' : SK.glassBg,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: `1px solid ${active ? SK.blue + '40' : SK.glassBorder}`,
        borderRadius: '3px',
        cursor: 'pointer',
        transition: 'all 150ms ease',
        textTransform: 'uppercase' as const,
      }}
    >
      {label}
    </button>
  );
}
