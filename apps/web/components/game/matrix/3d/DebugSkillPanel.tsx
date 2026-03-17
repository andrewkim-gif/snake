'use client';

/**
 * DebugSkillPanel — 디버그용 전체 스킬 업그레이드 패널
 *
 * 오른쪽 위 🛠 버튼 → 열기/닫기
 * 6개 카테고리(STEEL/TERRITORY/ALLIANCE/SOVEREIGNTY/INTELLIGENCE/MORALE)별로
 * 전체 55종 스킬을 표시하고, 클릭하면 즉시 applyLevelUp 호출.
 */

import { useState, useCallback } from 'react';
import type { WeaponType, SkillCategory } from '@/lib/matrix/types';

// 스킬 정의는 런타임에서 읽기
import { ALL_SKILLS, SKILLS_BY_CATEGORY } from '@/lib/matrix/config/skills';
import {
  CATEGORY_DISPLAY_NAMES,
  CATEGORY_DISPLAY_COLORS,
} from '@/lib/matrix/config/skills/category-display.config';

interface DebugSkillPanelProps {
  playerSkills: Map<WeaponType, number>;
  onUpgrade: (skill: WeaponType) => void;
  maxLevel?: number;
}

// 카테고리 순서
const CATEGORY_ORDER: SkillCategory[] = ['CODE', 'DATA', 'NETWORK', 'SECURITY', 'AI', 'SYSTEM'];

export default function DebugSkillPanel({ playerSkills, onUpgrade, maxLevel = 20 }: DebugSkillPanelProps) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen(p => !p), []);

  return (
    <>
      {/* 토글 버튼 — 오른쪽 위 */}
      <button
        onClick={toggle}
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          zIndex: 10010,
          width: 36,
          height: 36,
          borderRadius: 6,
          border: '1px solid #555',
          background: open ? 'rgba(204, 153, 51, 0.9)' : 'rgba(0,0,0,0.7)',
          color: open ? '#000' : '#CC9933',
          fontSize: 18,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)',
          fontFamily: '"Rajdhani", sans-serif',
          fontWeight: 900,
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        {open ? 'X' : 'D'}
      </button>

      {/* 패널 */}
      {open && (
        <div
          style={{
            position: 'fixed',
            top: 52,
            right: 10,
            zIndex: 10009,
            width: 340,
            maxHeight: 'calc(100dvh - 64px)',
            overflowY: 'auto',
            background: 'rgba(10, 10, 15, 0.95)',
            border: '1px solid #333',
            borderRadius: 8,
            padding: '12px 10px',
            backdropFilter: 'blur(8px)',
            fontFamily: '"Rajdhani", sans-serif',
            fontSize: 12,
            color: '#ccc',
          }}
        >
          {/* 헤더 */}
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#CC9933',
            marginBottom: 10,
            letterSpacing: '0.1em',
            borderBottom: '1px solid #333',
            paddingBottom: 6,
          }}>
            DEBUG — SKILL UPGRADE
          </div>

          {/* 카테고리별 스킬 목록 */}
          {CATEGORY_ORDER.map(cat => {
            const skills = SKILLS_BY_CATEGORY[cat] || [];
            const displayName = CATEGORY_DISPLAY_NAMES[cat] || cat;
            const catColor = CATEGORY_DISPLAY_COLORS[cat] || '#888';

            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                {/* 카테고리 헤더 */}
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: catColor,
                  letterSpacing: '0.08em',
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: catColor,
                    display: 'inline-block',
                    flexShrink: 0,
                  }} />
                  {displayName}
                  <span style={{ color: '#555', fontSize: 10, fontWeight: 400 }}>
                    ({skills.length})
                  </span>
                </div>

                {/* 스킬 그리드 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 3,
                }}>
                  {skills.map(skill => {
                    const level = playerSkills.get(skill.id as WeaponType) || 0;
                    const isMaxed = level >= maxLevel;

                    return (
                      <button
                        key={skill.id}
                        onClick={() => {
                          if (!isMaxed) onUpgrade(skill.id as WeaponType);
                        }}
                        disabled={isMaxed}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '4px 6px',
                          borderRadius: 4,
                          border: level > 0
                            ? `1px solid ${catColor}60`
                            : '1px solid #2a2a2a',
                          background: level > 0
                            ? `${catColor}15`
                            : 'rgba(30, 30, 35, 0.8)',
                          color: isMaxed ? '#666' : level > 0 ? '#eee' : '#888',
                          cursor: isMaxed ? 'default' : 'pointer',
                          fontSize: 10,
                          fontFamily: 'inherit',
                          textAlign: 'left',
                          transition: 'background 0.1s, border-color 0.1s',
                          opacity: isMaxed ? 0.5 : 1,
                        }}
                        onMouseEnter={e => {
                          if (!isMaxed) {
                            (e.target as HTMLButtonElement).style.background = `${catColor}30`;
                          }
                        }}
                        onMouseLeave={e => {
                          (e.target as HTMLButtonElement).style.background = level > 0
                            ? `${catColor}15`
                            : 'rgba(30, 30, 35, 0.8)';
                        }}
                        title={`${skill.nameEn}\n${skill.description}`}
                      >
                        {/* 스킬 이름 */}
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 110,
                        }}>
                          {skill.name}
                        </span>

                        {/* 레벨 뱃지 */}
                        <span style={{
                          flexShrink: 0,
                          fontSize: 9,
                          fontWeight: 700,
                          color: isMaxed ? '#666' : level > 0 ? catColor : '#444',
                          minWidth: 28,
                          textAlign: 'right',
                        }}>
                          {level > 0 ? `Lv.${level}` : '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
