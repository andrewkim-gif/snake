"use client";

/**
 * CommanderHUD — Phase 5, S26
 * Manual control mode overlay for Commander Mode.
 * Shows mode status, idle timer, invincibility indicator, agent stats.
 * Uses SK (sketch-ui) design system.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from 'next-intl';
import { SK, SKFont, bodyFont, headingFont } from "@/lib/sketch-ui";

// --- Types ---

interface CommanderHUDProps {
  /** Current control mode: "ai" or "manual" */
  mode: "ai" | "manual";
  /** Seconds until idle auto-return (only in manual mode) */
  idleTimeRemaining: number;
  /** Whether commander invincibility is active */
  isInvincible: boolean;
  /** Seconds of invincibility remaining */
  invincibleRemain: number;
  /** Agent's current HP (mass) */
  agentHP: number;
  /** Agent's current level */
  agentLevel: number;
  /** Agent's kills */
  agentKills: number;
  /** Agent's score */
  agentScore: number;
  /** Whether dash ability is available */
  dashAvailable: boolean;
  /** Callback: user clicks "Take Command" */
  onTakeCommand: () => void;
  /** Callback: user clicks "Release Command" */
  onReleaseCommand: () => void;
}

export default function CommanderHUD({
  mode,
  idleTimeRemaining,
  isInvincible,
  invincibleRemain,
  agentHP,
  agentLevel,
  agentKills,
  agentScore,
  dashAvailable,
  onTakeCommand,
  onReleaseCommand,
}: CommanderHUDProps) {
  const tGame = useTranslations('game');
  const isManual = mode === "manual";
  const [pulseInvincible, setPulseInvincible] = useState(false);

  // Pulse effect when invincibility is active
  useEffect(() => {
    if (isInvincible) {
      setPulseInvincible(true);
      const t = setTimeout(() => setPulseInvincible(false), 1000);
      return () => clearTimeout(t);
    }
  }, [isInvincible]);

  // Keyboard shortcut: Tab to toggle commander mode
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        if (isManual) {
          onReleaseCommand();
        } else {
          onTakeCommand();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isManual, onTakeCommand, onReleaseCommand]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        zIndex: 50,
        pointerEvents: "auto",
      }}
    >
      {/* Invincibility flash indicator */}
      {isInvincible && (
        <div
          style={{
            background: `linear-gradient(90deg, ${SK.gold}00, ${SK.gold}88, ${SK.gold}00)`,
            color: SK.textWhite,
            fontFamily: headingFont,
            fontSize: SKFont.sm,
            padding: "4px 20px",
            borderRadius: 4,
            animation: "pulse 0.5s infinite alternate",
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {tGame('invincible')} — {invincibleRemain.toFixed(1)}s
        </div>
      )}

      {/* Main HUD container */}
      <div
        style={{
          background: isManual ? SK.glassBg : "rgba(12, 18, 32, 0.6)",
          border: `1px solid ${isManual ? SK.gold : SK.glassBorder}`,
          borderRadius: 8,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          backdropFilter: "blur(8px)",
          minWidth: 400,
        }}
      >
        {/* Mode indicator */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: isManual ? SK.gold : SK.green,
              boxShadow: `0 0 8px ${isManual ? SK.gold : SK.green}`,
            }}
          />
          <span
            style={{
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: isManual ? SK.gold : SK.green,
              textTransform: "uppercase",
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {isManual ? tGame('manual') : tGame('aiMode')}
          </span>
        </div>

        {/* Agent stats */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <StatBadge label="HP" value={Math.round(agentHP)} color={agentHP < 30 ? SK.red : SK.green} />
          <StatBadge label="LV" value={agentLevel} color={SK.blue} />
          <StatBadge label={tGame('kills')} value={agentKills} color={SK.orangeLight} />
          <StatBadge label={tGame('score')} value={agentScore} color={SK.textPrimary} />
        </div>

        {/* Dash indicator */}
        {isManual && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                border: `2px solid ${dashAvailable ? SK.gold : SK.textMuted}`,
                background: dashAvailable ? `${SK.gold}33` : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                color: dashAvailable ? SK.gold : SK.textMuted,
                fontWeight: 700,
              }}
            >
              ⚡
            </div>
            <span
              style={{
                fontFamily: bodyFont,
                fontSize: "9px",
                color: SK.textMuted,
              }}
            >
              SPACE
            </span>
          </div>
        )}

        {/* Idle timer (manual mode only) */}
        {isManual && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <span
              style={{
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                color: idleTimeRemaining < 10 ? SK.red : SK.textSecondary,
                fontWeight: 600,
              }}
            >
              {Math.ceil(idleTimeRemaining)}s
            </span>
            <span
              style={{
                fontFamily: bodyFont,
                fontSize: "9px",
                color: SK.textMuted,
              }}
            >
              IDLE
            </span>
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={isManual ? onReleaseCommand : onTakeCommand}
          style={{
            fontFamily: bodyFont,
            fontSize: SKFont.sm,
            fontWeight: 700,
            padding: "6px 14px",
            borderRadius: 4,
            border: `1px solid ${isManual ? SK.red : SK.gold}`,
            background: isManual
              ? `linear-gradient(180deg, ${SK.redDark}, ${SK.red})`
              : `linear-gradient(180deg, ${SK.orangeDark}, ${SK.orange})`,
            color: SK.textWhite,
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: 1,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.opacity = "0.85";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.opacity = "1";
          }}
        >
          {isManual ? tGame('release') : tGame('command')}
        </button>

        {/* Keyboard hint */}
        <span
          style={{
            fontFamily: bodyFont,
            fontSize: "9px",
            color: SK.textMuted,
            position: "absolute",
            bottom: -14,
            right: 0,
          }}
        >
          {tGame('tabToToggle')}
        </span>
      </div>

      {/* Manual mode controls hint */}
      {isManual && (
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: SKFont.xs,
            color: SK.textSecondary,
            display: "flex",
            gap: 12,
          }}
        >
          <span>
            <kbd style={kbdStyle}>Mouse</kbd> {tGame('move')}
          </span>
          <span>
            <kbd style={kbdStyle}>Space</kbd> {tGame('dashAction')}
          </span>
          <span>
            <kbd style={kbdStyle}>1-3</kbd> {tGame('upgradeAction')}
          </span>
        </div>
      )}

      {/* CSS keyframe for pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          from { opacity: 0.6; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// --- Sub-components ---

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
      }}
    >
      <span
        style={{
          fontFamily: bodyFont,
          fontSize: SKFont.body,
          color,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: bodyFont,
          fontSize: "9px",
          color: SK.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </span>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: "10px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 3,
  padding: "1px 5px",
  color: SK.textPrimary,
};
