'use client';

/**
 * BranchSelectModal.tsx - v32 Phase 3: Branch A/B Selection Modal (Apex Tactical)
 *
 * Shown at Lv.11 when a skill has branch evolution options.
 * Player chooses between Path A (multi/area) or Path B (power/focus).
 *
 * Uses SK tokens, headingFont/bodyFont, apexClip. Apex tactical design system (SK tokens only).
 */

import React, { memo, useCallback, useEffect } from 'react';
import { GitFork, Zap, Shield, Target, Sparkles } from 'lucide-react';
import { SK, headingFont, bodyFont, apexClip } from '@/lib/sketch-ui';
import { OVERLAY } from '@/lib/overlay-tokens';

export interface BranchOption {
  id: 'A' | 'B';
  name: string;
  nameEn: string;
  description: string;
  icon: string;
  focus: string;
  ultimateName: string;
  ultimateEffect: string;
}

export interface BranchSelectModalProps {
  skillName: string;
  skillColor: string;
  branchA: BranchOption;
  branchB: BranchOption;
  onSelect: (branch: 'A' | 'B') => void;
}

/** Map icon string to lucide component */
function getBranchIcon(iconName: string) {
  switch (iconName) {
    case 'GitFork': return GitFork;
    case 'Target': return Target;
    case 'Shield': return Shield;
    case 'Sparkles': return Sparkles;
    default: return Zap;
  }
}

function BranchSelectModalInner({
  skillName,
  skillColor,
  branchA,
  branchB,
  onSelect,
}: BranchSelectModalProps) {

  // Keyboard shortcuts: 1 = A, 2 = B
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '1' || e.code === 'Numpad1') onSelect('A');
      if (e.key === '2' || e.code === 'Numpad2') onSelect('B');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onSelect]);

  const renderBranch = useCallback((branch: BranchOption, index: number) => {
    const IconComp = getBranchIcon(branch.icon);
    const isA = branch.id === 'A';
    const branchColor = isA ? SK.green : SK.blue;

    return (
      <button
        key={branch.id}
        onClick={() => onSelect(branch.id)}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          padding: 20,
          background: SK.cardBg,
          border: `1px solid ${SK.border}`,
          borderRadius: 0,
          clipPath: apexClip.md,
          cursor: 'pointer',
          transition: 'all 0.15s',
          fontFamily: bodyFont,
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top stripe */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: branchColor,
        }} />

        {/* Branch label */}
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: branchColor,
          letterSpacing: '0.15em',
          fontFamily: headingFont,
        }}>
          PATH {branch.id}
        </div>

        {/* Icon */}
        <div style={{
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${branchColor}15`,
          border: `1px solid ${branchColor}40`,
          clipPath: apexClip.sm,
        }}>
          <IconComp size={24} style={{ color: branchColor }} />
        </div>

        {/* Name */}
        <div style={{
          fontFamily: headingFont,
          fontSize: 16,
          fontWeight: 700,
          color: SK.textPrimary,
          letterSpacing: '0.03em',
        }}>
          {branch.nameEn}
        </div>

        {/* Description */}
        <div style={{
          fontSize: 12,
          color: SK.textSecondary,
          lineHeight: 1.5,
          minHeight: 36,
        }}>
          {branch.description}
        </div>

        {/* Focus tag */}
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          color: branchColor,
          letterSpacing: '0.08em',
          padding: '3px 10px',
          background: `${branchColor}12`,
          border: `1px solid ${branchColor}30`,
        }}>
          {branch.focus.toUpperCase()}
        </div>

        {/* Ultimate preview */}
        <div style={{
          width: '100%',
          paddingTop: 8,
          borderTop: `1px solid ${SK.border}`,
          marginTop: 4,
        }}>
          <div style={{
            fontSize: 9,
            color: SK.textMuted,
            letterSpacing: '0.1em',
            marginBottom: 4,
          }}>
            LV.20 ULTIMATE
          </div>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: SK.gold,
            fontFamily: headingFont,
          }}>
            {branch.ultimateName}
          </div>
        </div>

        {/* Keyboard hint */}
        <div style={{
          position: 'absolute',
          bottom: 8,
          right: 12,
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: SK.bg,
          border: `1px solid ${SK.border}`,
          fontSize: 12,
          fontWeight: 700,
          color: SK.textMuted,
          fontFamily: headingFont,
        }}>
          {index + 1}
        </div>
      </button>
    );
  }, [onSelect]);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 75,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: OVERLAY.bg,
      backdropFilter: OVERLAY.blur,
      WebkitBackdropFilter: OVERLAY.blur,
      fontFamily: bodyFont,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 560,
        background: SK.bg,
        border: `1px solid ${SK.border}`,
        borderRadius: 0,
        padding: 24,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}>
          <GitFork size={24} style={{ color: SK.accent }} />
          <div>
            <h2 style={{
              fontFamily: headingFont,
              fontSize: 20,
              fontWeight: 700,
              color: SK.accent,
              letterSpacing: '0.08em',
              margin: 0,
            }}>
              BRANCH EVOLUTION
            </h2>
            <p style={{
              color: SK.textSecondary,
              fontSize: 12,
              margin: 0,
              marginTop: 2,
            }}>
              <span style={{ color: skillColor, fontWeight: 600 }}>{skillName}</span>
              <span style={{ color: SK.textMuted }}> has reached Lv.11 — Choose your path</span>
            </p>
          </div>
        </div>

        {/* Branch cards side by side */}
        <div style={{
          display: 'flex',
          gap: 12,
        }}>
          {renderBranch(branchA, 0)}
          {renderBranch(branchB, 1)}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 16,
          textAlign: 'center',
          fontSize: 10,
          color: SK.textMuted,
          letterSpacing: '0.05em',
        }}>
          This choice is permanent. Press 1 or 2 to select.
        </div>
      </div>
    </div>
  );
}

const BranchSelectModal = memo(BranchSelectModalInner);
export default BranchSelectModal;
