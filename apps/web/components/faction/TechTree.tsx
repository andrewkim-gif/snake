'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SK, headingFont, bodyFont, sketchBorder, sketchShadow, radius } from '@/lib/sketch-ui';

// --- Types ---

interface TechNodeDef {
  id: string;
  branch: 'military' | 'economic' | 'diplomatic';
  level: number;
  name: string;
  description: string;
  tech_cost: number;
  prereq: string;
}

interface ResearchNode {
  node_id: string;
  tech_invested: number;
  tech_required: number;
  is_completed: boolean;
  completed_at?: string;
  started_at?: string;
}

interface TechBonus {
  node_id: string;
  bonus_type: string;
  bonus_value: number;
  description: string;
}

interface FactionResearch {
  faction_id: string;
  node_progress: Record<string, ResearchNode>;
  completed_ids: string[];
  active_bonuses: Record<string, TechBonus>;
}

// --- Constants ---

const BRANCH_CONFIG = {
  military: { label: 'Military', icon: '⚔️', color: SK.red },
  economic: { label: 'Economic', icon: '💰', color: SK.gold },
  diplomatic: { label: 'Diplomatic', icon: '🛡️', color: SK.blue },
} as const;

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || '';

// --- Props ---

interface TechTreeProps {
  factionId: string;
  token?: string;
  readOnly?: boolean;
}

// --- Component ---

export default function TechTree({ factionId, token, readOnly = false }: TechTreeProps) {
  const [nodes, setNodes] = useState<TechNodeDef[]>([]);
  const [research, setResearch] = useState<FactionResearch | null>(null);
  const [investAmount, setInvestAmount] = useState<number>(50);
  const [investing, setInvesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<'military' | 'economic' | 'diplomatic'>('military');

  // Fetch tech tree definitions
  useEffect(() => {
    fetch(`${SERVER_URL}/api/tech/nodes`)
      .then(res => res.json())
      .then(data => setNodes(data.nodes || []))
      .catch(() => setError('Failed to load tech tree'));
  }, []);

  // Fetch faction research state
  const fetchResearch = useCallback(() => {
    if (!factionId) return;
    fetch(`${SERVER_URL}/api/tech/research/${factionId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(res => res.json())
      .then(data => setResearch(data.research || null))
      .catch(() => {});
  }, [factionId, token]);

  useEffect(() => {
    fetchResearch();
  }, [fetchResearch]);

  // Invest in a tech node
  const handleInvest = async (nodeId: string) => {
    if (!token || readOnly) return;
    setInvesting(nodeId);
    setError(null);

    try {
      const res = await fetch(`${SERVER_URL}/api/tech/invest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ node_id: nodeId, amount: investAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Investment failed');
      } else {
        setResearch(data.research || null);
      }
    } catch {
      setError('Network error');
    } finally {
      setInvesting(null);
    }
  };

  // Get node progress
  const getNodeProgress = (nodeId: string): ResearchNode | null => {
    if (!research?.node_progress) return null;
    return research.node_progress[nodeId] || null;
  };

  const isCompleted = (nodeId: string): boolean => {
    return research?.completed_ids?.includes(nodeId) || false;
  };

  const isUnlocked = (node: TechNodeDef): boolean => {
    if (!node.prereq) return true;
    return isCompleted(node.prereq);
  };

  // Filter nodes by selected branch
  const branchNodes = nodes.filter(n => n.branch === selectedBranch).sort((a, b) => a.level - b.level);

  const cfg = BRANCH_CONFIG[selectedBranch];

  return (
    <div style={{
      background: SK.bg,
      border: sketchBorder(),
      borderRadius: radius.lg,
      padding: '24px',
      boxShadow: sketchShadow('md'),
    }}>
      {/* Header */}
      <h2 style={{
        fontFamily: headingFont,
        fontSize: '18px',
        color: SK.textPrimary,
        marginBottom: '16px',
      }}>
        Technology Research
      </h2>

      {/* Branch Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(Object.keys(BRANCH_CONFIG) as Array<keyof typeof BRANCH_CONFIG>).map(branch => {
          const bc = BRANCH_CONFIG[branch];
          const active = selectedBranch === branch;
          return (
            <button
              key={branch}
              onClick={() => setSelectedBranch(branch)}
              style={{
                flex: 1,
                padding: '10px 12px',
                fontFamily: headingFont,
                fontSize: '12px',
                background: active ? bc.color : SK.bgWarm,
                color: active ? '#fff' : SK.textSecondary,
                border: `2px solid ${active ? bc.color : SK.border}`,
                borderRadius: radius.md,
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: active ? 1 : 0.7,
              }}
            >
              {bc.icon} {bc.label}
            </button>
          );
        })}
      </div>

      {/* Tech investment amount */}
      {!readOnly && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
          padding: '8px 12px',
          background: SK.bgWarm,
          borderRadius: radius.md,
        }}>
          <span style={{ fontFamily: bodyFont, fontSize: '12px', color: SK.textSecondary }}>
            Invest Amount:
          </span>
          {[50, 100, 250, 500].map(amount => (
            <button
              key={amount}
              onClick={() => setInvestAmount(amount)}
              style={{
                padding: '4px 10px',
                fontFamily: bodyFont,
                fontSize: '11px',
                background: investAmount === amount ? cfg.color : 'transparent',
                color: investAmount === amount ? '#fff' : SK.textSecondary,
                border: `1px solid ${investAmount === amount ? cfg.color : SK.border}`,
                borderRadius: radius.sm,
                cursor: 'pointer',
              }}
            >
              {amount}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '8px 12px',
          marginBottom: '12px',
          background: '#3a1a1a',
          border: `1px solid ${SK.red}`,
          borderRadius: radius.sm,
          fontFamily: bodyFont,
          fontSize: '12px',
          color: SK.red,
        }}>
          {error}
        </div>
      )}

      {/* Tree Nodes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {branchNodes.map((node, idx) => {
          const progress = getNodeProgress(node.id);
          const completed = isCompleted(node.id);
          const unlocked = isUnlocked(node);
          const progressRatio = progress
            ? Math.min(progress.tech_invested / progress.tech_required, 1)
            : 0;

          return (
            <React.Fragment key={node.id}>
              {/* Connector line */}
              {idx > 0 && (
                <div style={{
                  width: '2px',
                  height: '16px',
                  background: completed
                    ? cfg.color
                    : unlocked
                    ? SK.border
                    : SK.bgWarm,
                  margin: '-12px auto -12px auto',
                  zIndex: 1,
                }} />
              )}

              {/* Node card */}
              <div style={{
                padding: '14px 16px',
                background: completed
                  ? `${cfg.color}22`
                  : unlocked
                  ? SK.cardBg
                  : SK.bgWarm,
                border: `2px solid ${
                  completed ? cfg.color : unlocked ? SK.border : SK.bgWarm
                }`,
                borderRadius: radius.md,
                opacity: unlocked ? 1 : 0.5,
                position: 'relative',
              }}>
                {/* Level badge */}
                <div style={{
                  position: 'absolute',
                  top: '-8px',
                  left: '12px',
                  background: completed ? cfg.color : SK.bgWarm,
                  color: completed ? '#fff' : SK.textSecondary,
                  fontFamily: headingFont,
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: radius.sm,
                  border: `1px solid ${completed ? cfg.color : SK.border}`,
                }}>
                  Lv.{node.level}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{
                      fontFamily: headingFont,
                      fontSize: '13px',
                      color: completed ? cfg.color : SK.textPrimary,
                      marginBottom: '4px',
                    }}>
                      {completed && '✓ '}{node.name}
                    </div>
                    <div style={{
                      fontFamily: bodyFont,
                      fontSize: '11px',
                      color: SK.textSecondary,
                    }}>
                      {node.description}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: bodyFont,
                    fontSize: '11px',
                    color: SK.textSecondary,
                    whiteSpace: 'nowrap',
                    marginLeft: '12px',
                  }}>
                    {completed
                      ? 'Done'
                      : `${progress?.tech_invested || 0} / ${node.tech_cost} Tech`}
                  </div>
                </div>

                {/* Progress bar */}
                {!completed && unlocked && (
                  <div style={{
                    marginTop: '10px',
                    height: '6px',
                    background: SK.bgWarm,
                    borderRadius: 0,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${progressRatio * 100}%`,
                      height: '100%',
                      background: cfg.color,
                      borderRadius: 0,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                )}

                {/* Invest button */}
                {!readOnly && unlocked && !completed && (
                  <button
                    onClick={() => handleInvest(node.id)}
                    disabled={investing === node.id}
                    style={{
                      marginTop: '10px',
                      padding: '6px 16px',
                      fontFamily: headingFont,
                      fontSize: '11px',
                      background: investing === node.id ? SK.bgWarm : cfg.color,
                      color: '#fff',
                      border: 'none',
                      borderRadius: radius.sm,
                      cursor: investing === node.id ? 'not-allowed' : 'pointer',
                      opacity: investing === node.id ? 0.6 : 1,
                    }}
                  >
                    {investing === node.id ? 'Investing...' : `Invest ${investAmount} Tech`}
                  </button>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Active bonuses summary */}
      {research?.active_bonuses && Object.keys(research.active_bonuses).length > 0 && (
        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: SK.bgWarm,
          borderRadius: radius.md,
          border: `1px solid ${SK.border}`,
        }}>
          <div style={{
            fontFamily: headingFont,
            fontSize: '12px',
            color: SK.textPrimary,
            marginBottom: '8px',
          }}>
            Active Bonuses
          </div>
          {Object.values(research.active_bonuses).map(bonus => (
            <div key={bonus.node_id} style={{
              fontFamily: bodyFont,
              fontSize: '11px',
              color: SK.green,
              marginBottom: '4px',
            }}>
              + {bonus.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
