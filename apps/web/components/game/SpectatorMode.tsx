'use client';

/**
 * SpectatorMode — v14 Phase 8 S38: Enhanced Spectator System
 *
 * Two entry modes:
 *   1. Death-based: 사망 후 관전 (기존 v12 S20)
 *   2. Arena-full: 아레나 풀(50명) 시 관전 모드 입장 (v14 S38)
 *
 * Features:
 *   - Free camera: 마우스 드래그 이동, 스크롤 줌
 *   - Player follow: 클릭으로 특정 플레이어 추적
 *   - Spectator count: 아레나 정보에 포함
 *   - Join transition: 빈자리 생기면 참가 전환 버튼
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { DeathPayload } from '@agent-survivor/shared';
import { SK, bodyFont, sketchShadow } from '@/lib/sketch-ui';

export interface SpectatorTarget {
  id: string;
  name: string;
  kills: number;
  level: number;
  score: number;
  alive: boolean;
  nationality?: string;
}

// ─── Spectator entry reason ───
export type SpectatorReason = 'death' | 'arena_full' | 'manual';

interface SpectatorModeProps {
  /** How the player entered spectator mode */
  reason?: SpectatorReason;
  /** Death info (only for death-based spectating) */
  deathInfo?: DeathPayload | null;
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
  /** v14 S38: 아레나 현재 인원 */
  arenaPlayerCount?: number;
  /** v14 S38: 아레나 최대 인원 */
  arenaMaxPlayers?: number;
  /** v14 S38: 빈자리 참가 콜백 */
  onJoinArena?: () => void;
  /** v14 S38: 마우스 드래그 카메라 이동 콜백 */
  onDragCamera?: (dx: number, dy: number) => void;
  /** v14 S38: 스크롤 줌 콜백 */
  onZoomCamera?: (delta: number) => void;
  /** ESC로 로비 복귀 */
  onExitToLobby?: () => void;
}

export function SpectatorMode({
  reason = 'death',
  deathInfo,
  aliveAgents,
  followTarget,
  onFollowAgent,
  onMoveCamera,
  timeRemaining,
  spectatorCount = 0,
  arenaPlayerCount,
  arenaMaxPlayers = 50,
  onJoinArena,
  onDragCamera,
  onZoomCamera,
  onExitToLobby,
}: SpectatorModeProps) {
  const tGame = useTranslations('game');
  const tOverlay = useTranslations('overlay');
  const [listOpen, setListOpen] = useState(false);
  const [freeCam, setFreeCam] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);
  const [dragging, setDragging] = useState(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // v14 S38: 빈자리 여부 체크
  const hasSlot = arenaPlayerCount !== undefined && arenaPlayerCount < arenaMaxPlayers;

  // 등장 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => setFadeIn(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // v14 S38: 마우스 드래그 → 자유 카메라 이동
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!freeCam) return;
    setDragging(true);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, [freeCam]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !freeCam || !onDragCamera) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    onDragCamera(dx, dy);
  }, [dragging, freeCam, onDragCamera]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  // v14 S38: 스크롤 → 줌
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!onZoomCamera) return;
    onZoomCamera(e.deltaY > 0 ? 1 : -1);
  }, [onZoomCamera]);

  // v14 S38: 키보드 단축키
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onExitToLobby) {
        e.preventDefault();
        onExitToLobby();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setListOpen(prev => !prev);
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        if (freeCam && aliveAgents.length > 0) {
          handleNextAgent();
        } else {
          handleFreeCam();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [freeCam, aliveAgents.length]);

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

  // Spectating reason label
  const reasonLabel = reason === 'arena_full'
    ? 'SPECTATING (ARENA FULL)'
    : reason === 'manual'
    ? 'SPECTATING'
    : tGame('spectating');

  const reasonColor = reason === 'arena_full' ? SK.orange : SK.red;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 30,
        opacity: fadeIn ? 1 : 0,
        transition: 'opacity 500ms ease',
        cursor: freeCam && dragging ? 'grabbing' : freeCam ? 'grab' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
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
            backgroundColor: `${reasonColor}20`,
            border: `1px solid ${reasonColor}40`,
            borderRadius: '3px',
          }}>
            <span style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              fontWeight: 700,
              color: reasonColor,
              letterSpacing: '2px',
            }}>
              {reasonLabel}
            </span>
          </div>
          {spectatorCount > 0 && (
            <span style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.textMuted,
              letterSpacing: '1px',
            }}>
              {tGame('watching', { count: spectatorCount })}
            </span>
          )}
          {/* Arena population */}
          {arenaPlayerCount !== undefined && (
            <span style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: hasSlot ? SK.green : SK.textMuted,
              letterSpacing: '1px',
            }}>
              {arenaPlayerCount}/{arenaMaxPlayers}
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
              {tGame('freeCamera')}
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
          label={tGame('freeCam')}
          onClick={handleFreeCam}
          active={freeCam}
        />
        <SpecButton
          label={tGame('agents')}
          onClick={() => setListOpen(!listOpen)}
          active={listOpen}
        />
        {aliveAgents.length > 0 && !followTarget && (
          <SpecButton
            label={tGame('follow')}
            onClick={handleNextAgent}
          />
        )}

        {/* v14 S38: 빈자리 생기면 참가 전환 버튼 */}
        {hasSlot && onJoinArena && (
          <SpecButton
            label="JOIN"
            onClick={onJoinArena}
            highlight
          />
        )}

        {/* ESC → 로비 복귀 */}
        {onExitToLobby && (
          <SpecButton
            label="ESC"
            onClick={onExitToLobby}
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
          minWidth: '260px',
          maxWidth: '340px',
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
            {tGame('aliveAgents', { count: aliveAgents.length })}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{agent.name}</span>
                {agent.nationality && (
                  <span style={{ fontSize: '9px', color: SK.textMuted }}>
                    [{agent.nationality}]
                  </span>
                )}
              </div>
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
              {tGame('noAgentsAlive')}
            </div>
          )}
        </div>
      )}

      {/* 사망 정보 (좌하단, death-based 관전일 때만) */}
      {reason === 'death' && deathInfo && (
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
              {tOverlay('eliminated')}
            </div>
            {deathInfo.killer && (
              <div style={{ fontSize: '11px', color: SK.textSecondary }}>
                {tOverlay('byKiller', { killer: deathInfo.killer })}
              </div>
            )}
            <div style={{
              display: 'flex',
              gap: '8px',
              fontSize: '10px',
              color: SK.textMuted,
              marginTop: '4px',
            }}>
              <span>{tGame('score')}: {deathInfo.score}</span>
              <span>{tGame('kills')}: {deathInfo.kills}</span>
            </div>
          </div>
        </div>
      )}

      {/* v14 S38: Arena full notification (arena_full reason) */}
      {reason === 'arena_full' && (
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
            border: `1px solid ${SK.orange}40`,
            borderRadius: '4px',
            padding: '8px 12px',
          }}>
            <div style={{
              fontSize: '10px',
              color: SK.orange,
              fontWeight: 700,
              letterSpacing: '1px',
              marginBottom: '2px',
            }}>
              ARENA FULL
            </div>
            <div style={{
              fontSize: '11px',
              color: SK.textSecondary,
            }}>
              {arenaPlayerCount}/{arenaMaxPlayers} players
            </div>
            <div style={{
              fontSize: '10px',
              color: SK.textMuted,
              marginTop: '4px',
            }}>
              Waiting for a slot to open...
            </div>
          </div>
        </div>
      )}

      {/* v14 S38: 자유 카메라 도움말 */}
      {freeCam && (
        <div style={{
          position: 'absolute',
          top: '50px',
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          opacity: 0.4,
          transition: 'opacity 300ms',
        }}>
          <div style={{
            fontFamily: bodyFont,
            fontSize: '10px',
            color: SK.textMuted,
            letterSpacing: '1px',
            textAlign: 'center',
          }}>
            DRAG to move | SCROLL to zoom | F to follow | TAB for list
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 내부 버튼 ───

function SpecButton({
  label,
  onClick,
  active = false,
  small = false,
  highlight = false,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  small?: boolean;
  highlight?: boolean;
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
        color: highlight ? '#FFFFFF' : active ? SK.textPrimary : SK.textSecondary,
        backgroundColor: highlight
          ? 'rgba(16, 185, 129, 0.3)'
          : active
          ? 'rgba(99, 102, 241, 0.2)'
          : SK.glassBg,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: `1px solid ${
          highlight
            ? SK.green + '60'
            : active
            ? SK.blue + '40'
            : SK.glassBorder
        }`,
        borderRadius: '3px',
        cursor: 'pointer',
        transition: 'all 150ms ease',
        textTransform: 'uppercase' as const,
        animation: highlight ? 'joinPulse 1.5s ease-in-out infinite' : 'none',
      }}
    >
      {label}
      {highlight && (
        <style>{`
          @keyframes joinPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.85; transform: scale(1.05); }
          }
        `}</style>
      )}
    </button>
  );
}
