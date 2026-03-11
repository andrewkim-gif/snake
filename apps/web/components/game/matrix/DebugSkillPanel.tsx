'use client';

/**
 * DebugSkillPanel.tsx — 디버그용 스킬 업그레이드 패널 (v35 리디자인)
 *
 * 이전 게임(app_ingame)의 DesktopLevelUpModal 디자인 포팅:
 * - 카드 기반 그리드 레이아웃 (5열)
 * - 큰 AI 생성 아이콘 (48px)
 * - 자동 선택 로직 (Ultimate > Evolution > 최고 레벨)
 * - 카테고리별 컬러 스트라이프
 * - 레벨 표시 + 스탯 변경 프리뷰
 */

import React, { useState, useCallback, useMemo, memo } from 'react';
import { WEAPON_DATA } from '@/lib/matrix/constants';
import type { WeaponType } from '@/lib/matrix/types';
import { getWeaponCategory } from '@/lib/matrix/config/skills/progressive-tree.config';
import {
  CATEGORY_DISPLAY_NAMES,
  CATEGORY_DISPLAY_COLORS,
} from '@/lib/matrix/config/skills/category-display.config';
import { SkillIcon } from './SkillIcon';
import {
  Settings, X, ChevronDown, ChevronUp, Crown, Sparkles,
  ArrowRight, Zap, RotateCcw, Bot, Trash2, Plus,
} from 'lucide-react';
import type { AIPersonality } from '@/lib/matrix/types';
import { SK, headingFont, bodyFont } from '@/lib/sketch-ui';

// ── 카테고리 컬러 / 이름 (중앙 config에서 import) ──
const CATEGORY_COLORS: Record<string, string> = CATEGORY_DISPLAY_COLORS;
const CATEGORY_NAMES: Record<string, string> = CATEGORY_DISPLAY_NAMES;

// ── 봇 전략 정보 ──
const BOT_STRATEGIES: { key: AIPersonality; label: string; color: string; desc: string }[] = [
  { key: 'aggressive', label: 'AGG', color: '#EF4444', desc: '강적 회피 → 약적 사냥' },
  { key: 'defensive', label: 'DEF', color: '#3B82F6', desc: '전체 회피 → 플레이어 근처 공전' },
  { key: 'balanced', label: 'BAL', color: '#10B981', desc: 'HP 기반 적응형 전투' },
  { key: 'collector', label: 'COL', color: '#F59E0B', desc: '경험치 수집 우선' },
];

// ── Props ──
interface DebugSkillPanelProps {
  weapons: Record<string, number>;
  onUpgrade: (weaponType: string) => void;
  onAddBot?: (personality?: AIPersonality) => void;
  onRemoveAllBots?: () => void;
  botCount?: number;
}

// ── 스킬 정보 타입 ──
interface SkillInfo {
  key: string;
  name: string;
  desc: string;
  color: string;
  level: number;
  maxLevel: number;
  category: string;
  isEvolved: boolean;
  isUltimate: boolean;
  statPreview: string;
}

// ── 스탯 변경 프리뷰 계산 ──
function getStatPreview(type: WeaponType, currentLevel: number): string {
  const data = WEAPON_DATA[type as keyof typeof WEAPON_DATA];
  if (!data) return '';

  const nextLevel = currentLevel + 1;
  if (currentLevel === 0) return 'NEW';
  if (nextLevel > data.stats.length) return 'MAX';

  const prev = data.stats[currentLevel - 1];
  const next = data.stats[nextLevel - 1];
  if (!prev || !next) return '';

  if ((next as any).isEvolved && !(prev as any).isEvolved) return 'EVOLUTION';
  if ((next as any).isUltimate && !(prev as any).isUltimate) return 'ULTIMATE';

  const changes: string[] = [];
  if (next.damage > prev.damage) changes.push(`DMG+${Math.round(next.damage - prev.damage)}`);
  if (next.amount > prev.amount) changes.push(`AMT+${next.amount - prev.amount}`);
  if (next.cooldown < prev.cooldown) changes.push(`SPD+${Math.round((1 - next.cooldown / prev.cooldown) * 100)}%`);
  if (next.area > prev.area) changes.push(`RNG+${Math.round(((next.area - prev.area) / prev.area) * 100)}%`);
  if (next.pierce > prev.pierce) changes.push(`PRC+${next.pierce - prev.pierce}`);
  return changes.join(' ') || 'OPT';
}

// ── 자동 선택 로직 (원본 게임 포팅) ──
function autoSelectBest(skills: SkillInfo[]): SkillInfo | null {
  if (skills.length === 0) return null;

  // 1순위: Ultimate
  const ultimate = skills.find(s => {
    const data = WEAPON_DATA[s.key as keyof typeof WEAPON_DATA];
    if (!data || s.level >= data.stats.length) return false;
    const next = data.stats[s.level];
    return (next as any)?.isUltimate && !(s.level > 0 && (data.stats[s.level - 1] as any)?.isUltimate);
  });
  if (ultimate) return ultimate;

  // 2순위: Evolution
  const evolution = skills.find(s => {
    const data = WEAPON_DATA[s.key as keyof typeof WEAPON_DATA];
    if (!data || s.level >= data.stats.length) return false;
    const next = data.stats[s.level];
    return (next as any)?.isEvolved && !(s.level > 0 && (data.stats[s.level - 1] as any)?.isEvolved);
  });
  if (evolution) return evolution;

  // 3순위: 가장 높은 레벨의 스킬 (이미 보유한 스킬 우선)
  const owned = skills.filter(s => s.level > 0 && s.level < s.maxLevel);
  if (owned.length > 0) {
    return owned.sort((a, b) => b.level - a.level)[0];
  }

  return skills[0];
}

// ── 개별 스킬 카드 (원본 DesktopLevelUpModal 스타일) ──
const SkillCard = memo(function SkillCard({
  skill, onUpgrade,
}: {
  skill: SkillInfo;
  onUpgrade: (key: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const catColor = CATEGORY_COLORS[skill.category] || SK.textMuted;
  const isMaxed = skill.level >= skill.maxLevel;
  const isOwned = skill.level > 0;

  return (
    <button
      onClick={() => !isMaxed && onUpgrade(skill.key)}
      disabled={isMaxed}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px 6px 8px',
        width: '100%',
        cursor: isMaxed ? 'default' : 'pointer',
        opacity: isMaxed ? 0.35 : 1,
        transition: 'all 0.15s',
        textAlign: 'center',
        background: skill.isUltimate
          ? 'rgba(245,158,11,0.12)'
          : skill.isEvolved
            ? 'rgba(56,189,248,0.08)'
            : isOwned
              ? 'rgba(255,255,255,0.06)'
              : SK.cardBg,
        border: skill.isUltimate
          ? '1px solid rgba(245,158,11,0.5)'
          : hovered
            ? `1px solid ${catColor}80`
            : `1px solid ${SK.border}`,
        borderRadius: 0,
        borderTop: `3px solid ${catColor}`,
        transform: hovered && !isMaxed ? 'scale(1.05)' : 'scale(1)',
        fontFamily: bodyFont,
      }}
    >
      {/* Ultimate 크라운 */}
      {skill.isUltimate && (
        <Crown style={{
          position: 'absolute', top: -2, left: 2,
          color: SK.gold, width: 12, height: 12,
        }} />
      )}

      {/* NEW 뱃지 */}
      {skill.level === 0 && !isMaxed && (
        <div style={{
          position: 'absolute', top: 2, right: 2,
          display: 'flex', alignItems: 'center', gap: 1,
          background: SK.gold, color: '#000',
          fontSize: 7, fontWeight: 700,
          padding: '0 3px', lineHeight: '12px',
        }}>
          <Sparkles size={6} />
          NEW
        </div>
      )}

      {/* 아이콘 (큰 사이즈!) */}
      <div style={{
        width: 48, height: 48,
        border: `1px solid ${skill.color}60`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
        background: skill.isUltimate ? 'rgba(245,158,11,0.15)' : 'rgba(0,0,0,0.4)',
      }}>
        <SkillIcon type={skill.key as WeaponType} size={40} />
      </div>

      {/* 레벨 표시 */}
      {!isMaxed && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          marginBottom: 3,
          background: 'rgba(0,0,0,0.5)',
          padding: '1px 5px',
          fontSize: 9,
        }}>
          <span style={{ color: SK.textMuted }}>{skill.level}</span>
          <ArrowRight size={7} style={{ color: SK.textMuted }} />
          <span style={{
            color: skill.isUltimate ? SK.gold : SK.accent,
            fontWeight: 700,
          }}>
            {skill.level + 1}
          </span>
        </div>
      )}
      {isMaxed && (
        <div style={{
          marginBottom: 3,
          background: 'rgba(239,68,68,0.2)',
          padding: '1px 5px',
          fontSize: 8, fontWeight: 700,
          color: SK.accent,
          letterSpacing: '0.05em',
        }}>
          MAX
        </div>
      )}

      {/* 스킬명 */}
      <span style={{
        fontFamily: headingFont,
        fontSize: 11,
        fontWeight: 700,
        color: isOwned ? skill.color : SK.textMuted,
        lineHeight: 1.2,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '100%',
        letterSpacing: '0.02em',
      }}>
        {skill.name}
      </span>

      {/* 스탯 프리뷰 */}
      {!isMaxed && skill.statPreview && (
        <span style={{
          fontSize: 8,
          fontWeight: 600,
          color: skill.statPreview === 'ULTIMATE' ? SK.gold
            : skill.statPreview === 'EVOLUTION' ? '#38bdf8'
              : skill.statPreview === 'NEW' ? SK.green
                : SK.textSecondary,
          marginTop: 2,
          letterSpacing: '0.02em',
        }}>
          {skill.statPreview}
        </span>
      )}
    </button>
  );
});

// ── 메인 컴포넌트 ──
function DebugSkillPanelInner({ weapons, onUpgrade, onAddBot, onRemoveAllBots, botCount = 0 }: DebugSkillPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCategory = useCallback((cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  // 전체 스킬 데이터 빌드
  const allSkills: SkillInfo[] = useMemo(() => {
    const result: SkillInfo[] = [];
    for (const [key, data] of Object.entries(WEAPON_DATA)) {
      if (!data || key === 'gold_reward') continue;
      const level = weapons[key] || 0;
      const maxLevel = data.stats?.length || 20;
      const cat = getWeaponCategory(key as WeaponType) || 'OTHER';
      const nextStats = level < maxLevel ? data.stats[level] : null;

      result.push({
        key,
        name: data.name,
        desc: data.desc || '',
        color: data.color || '#888',
        level,
        maxLevel,
        category: cat,
        isEvolved: nextStats ? (nextStats as any).isEvolved === true : false,
        isUltimate: nextStats ? (nextStats as any).isUltimate === true : false,
        statPreview: getStatPreview(key as WeaponType, level),
      });
    }
    return result;
  }, [weapons]);

  // 카테고리별 그룹핑
  const groups = useMemo(() => {
    const order = ['CODE', 'DATA', 'NETWORK', 'SECURITY', 'AI', 'SYSTEM', 'OTHER'];
    const grouped: Record<string, SkillInfo[]> = {};

    for (const skill of allSkills) {
      const cat = skill.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(skill);
    }

    return order
      .filter(cat => grouped[cat]?.length)
      .map(cat => ({
        category: cat,
        items: grouped[cat].sort((a, b) => {
          // 보유 우선 → 레벨 높은 순 → 이름순
          if (a.level > 0 && b.level === 0) return -1;
          if (a.level === 0 && b.level > 0) return 1;
          if (a.level !== b.level) return b.level - a.level;
          return a.name.localeCompare(b.name);
        }),
      }));
  }, [allSkills]);

  // 보유 스킬 수 / 전체
  const ownedCount = useMemo(() =>
    Object.values(weapons).filter(v => v > 0).length
  , [weapons]);
  const totalCount = allSkills.length;

  // 자동 선택 (원본 게임 로직)
  const handleAutoSelect = useCallback(() => {
    const upgradeable = allSkills.filter(s => s.level < s.maxLevel);
    const best = autoSelectBest(upgradeable);
    if (best) {
      onUpgrade(best.key);
    }
  }, [allSkills, onUpgrade]);

  // 전체 리셋
  const handleResetAll = useCallback(() => {
    for (const key of Object.keys(weapons)) {
      if (weapons[key] > 0) {
        // 리셋은 레벨을 0으로 설정 — onUpgrade로는 불가능하므로 단순히 UI 힌트만
      }
    }
  }, [weapons]);

  return (
    <>
      {/* ── 토글 버튼 (우측 상단) ── */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          position: 'fixed',
          top: 8,
          right: 8,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '5px 12px',
          background: isOpen ? 'rgba(239,68,68,0.9)' : 'rgba(0,0,0,0.8)',
          border: `1px solid ${isOpen ? '#EF4444' : '#444'}`,
          borderRadius: 0,
          cursor: 'pointer',
          color: SK.textPrimary,
          fontFamily: headingFont,
          fontSize: 12,
          letterSpacing: '0.08em',
          backdropFilter: 'blur(4px)',
        }}
      >
        {isOpen ? <X size={12} /> : <Settings size={12} style={{ animation: 'spin 4s linear infinite' }} />}
        <span>DEV</span>
        {ownedCount > 0 && (
          <span style={{
            background: SK.green,
            color: '#000',
            padding: '0 5px',
            fontSize: 9,
            fontWeight: 700,
          }}>
            {ownedCount}
          </span>
        )}
      </button>

      {/* ── 패널 ── */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 42,
          right: 8,
          zIndex: 9998,
          width: 380,
          maxHeight: 'calc(100dvh - 54px)',
          overflowY: 'auto',
          background: 'rgba(9,9,11,0.97)',
          border: `1px solid ${SK.border}`,
          borderRadius: 0,
          backdropFilter: 'blur(12px)',
          fontFamily: bodyFont,
        }}>
          {/* 헤더 */}
          <div style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${SK.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: SK.cardBg,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28,
                border: `2px solid ${SK.accent}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: SK.accentBg,
              }}>
                <Zap size={14} style={{ color: SK.accent }} />
              </div>
              <div>
                <div style={{
                  fontFamily: headingFont,
                  fontSize: 14,
                  fontWeight: 700,
                  color: SK.accent,
                  letterSpacing: '0.08em',
                }}>
                  SKILL DEBUG
                </div>
                <div style={{ fontSize: 9, color: SK.textMuted }}>
                  {ownedCount}/{totalCount} equipped — click to +1
                </div>
              </div>
            </div>

            {/* 자동 선택 버튼 */}
            <button
              onClick={handleAutoSelect}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                background: 'rgba(16,185,129,0.15)',
                border: `1px solid ${SK.green}60`,
                borderRadius: 0,
                cursor: 'pointer',
                color: SK.green,
                fontFamily: headingFont,
                fontSize: 10,
                letterSpacing: '0.05em',
              }}
              title="Auto-select: Ultimate > Evolution > Highest Level"
            >
              <Sparkles size={10} />
              AUTO
            </button>
          </div>

          {/* Dev Mode 배너 */}
          <div style={{
            background: `${SK.orange}12`,
            borderBottom: `1px solid ${SK.orange}30`,
            padding: '4px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Settings size={10} style={{ color: SK.orange }} />
              <span style={{ color: SK.orange, fontSize: 10, letterSpacing: '0.05em', fontWeight: 600 }}>
                DEV MODE
              </span>
            </div>
            <span style={{ color: `${SK.orange}99`, fontSize: 9 }}>
              {totalCount} skills available
            </span>
          </div>

          {/* ── 봇 컨트롤 섹션 ── */}
          {onAddBot && (
            <div style={{
              padding: '8px 12px',
              borderBottom: `1px solid ${SK.border}`,
              background: 'rgba(16,185,129,0.05)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Bot size={12} style={{ color: SK.green }} />
                  <span style={{
                    fontFamily: headingFont, fontSize: 11, fontWeight: 700,
                    color: SK.green, letterSpacing: '0.08em',
                  }}>
                    AI BOTS
                  </span>
                  {botCount > 0 && (
                    <span style={{
                      background: SK.green, color: '#000',
                      padding: '0 5px', fontSize: 9, fontWeight: 700,
                    }}>
                      {botCount}
                    </span>
                  )}
                </div>
                {botCount > 0 && onRemoveAllBots && (
                  <button
                    onClick={onRemoveAllBots}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      padding: '2px 8px', background: 'rgba(239,68,68,0.15)',
                      border: `1px solid ${SK.accent}40`, borderRadius: 0,
                      cursor: 'pointer', color: SK.accent,
                      fontFamily: headingFont, fontSize: 9, letterSpacing: '0.05em',
                    }}
                  >
                    <Trash2 size={8} />
                    CLEAR
                  </button>
                )}
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
              }}>
                {BOT_STRATEGIES.map(strat => (
                  <button
                    key={strat.key}
                    onClick={() => onAddBot(strat.key)}
                    title={strat.desc}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 2, padding: '6px 4px',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${strat.color}40`,
                      borderTop: `2px solid ${strat.color}`,
                      borderRadius: 0, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `${strat.color}20`;
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <Plus size={14} style={{ color: strat.color }} />
                    <span style={{
                      fontFamily: headingFont, fontSize: 9, fontWeight: 700,
                      color: strat.color, letterSpacing: '0.08em',
                    }}>
                      {strat.label}
                    </span>
                    <span style={{ fontSize: 7, color: SK.textMuted, lineHeight: 1.2 }}>
                      {strat.desc.split('→')[0].trim()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 카테고리 + 카드 그리드 */}
          <div style={{ padding: 8 }}>
            {groups.map(({ category, items }) => {
              const catColor = CATEGORY_COLORS[category] || '#666';
              const catName = CATEGORY_NAMES[category] || category;
              const isCollapsed = collapsed[category];
              const ownedInCat = items.filter(i => i.level > 0).length;

              return (
                <div key={category} style={{ marginBottom: 8 }}>
                  {/* 카테고리 헤더 */}
                  <button
                    onClick={() => toggleCategory(category)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      width: '100%',
                      padding: '5px 8px',
                      border: 'none',
                      borderLeft: `3px solid ${catColor}`,
                      background: 'rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      borderRadius: 0,
                      marginBottom: isCollapsed ? 0 : 6,
                    }}
                  >
                    {isCollapsed
                      ? <ChevronDown size={10} style={{ color: catColor }} />
                      : <ChevronUp size={10} style={{ color: catColor }} />
                    }
                    <span style={{
                      fontFamily: headingFont,
                      fontSize: 11,
                      fontWeight: 700,
                      color: catColor,
                      letterSpacing: '0.1em',
                    }}>
                      {catName}
                    </span>
                    <span style={{
                      fontSize: 9,
                      color: SK.textMuted,
                      marginLeft: 'auto',
                    }}>
                      {ownedInCat}/{items.length}
                    </span>
                  </button>

                  {/* 카드 그리드 (5열) */}
                  {!isCollapsed && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: 4,
                    }}>
                      {items.map(skill => (
                        <SkillCard
                          key={skill.key}
                          skill={skill}
                          onUpgrade={onUpgrade}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 푸터 */}
          <div style={{
            padding: '6px 12px',
            borderTop: `1px solid ${SK.border}`,
            textAlign: 'center',
            color: SK.textMuted,
            fontSize: 9,
            background: SK.cardBg,
            letterSpacing: '0.05em',
          }}>
            Auto: Ultimate {'>'} Evolution {'>'} Highest Lv
          </div>
        </div>
      )}
    </>
  );
}

const DebugSkillPanel = memo(DebugSkillPanelInner);
export default DebugSkillPanel;
