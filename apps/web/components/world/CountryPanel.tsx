'use client';

/**
 * CountryPanel — 국가 상세 패널 (탭 확장 v13)
 * 4개 탭: OVERVIEW | TOKEN | VOTE | FACTION
 * 모바일: 하단 바텀시트, 데스크탑: 우측 슬라이드
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { BarChart3, Coins, Vote, Shield, Building2, X, Play, Eye } from 'lucide-react';
import { McButton } from '@/components/lobby/McButton';
import { SK, SKFont, bodyFont, headingFont, sketchBorder, handDrawnRadius, radius } from '@/lib/sketch-ui';
import { tierColors, resourceLabels, resourceIcons } from '@/lib/map-style';
import type { CountryClientState } from '@/lib/globe-data';
import CountryTokenInfo from '@/components/blockchain/CountryTokenInfo';
import StakingPanel from '@/components/blockchain/StakingPanel';
import ProposalList from '@/components/governance/ProposalList';
import VoteInterface from '@/components/governance/VoteInterface';
import type { Proposal } from '@/components/governance/types';
import type { TokenBalance, StakingInfo } from '@/lib/crossx-config';
import { CivilizationPanel } from '@/components/civilization/CivilizationPanel';
import type { NationStatsData } from '@/components/civilization/StatsChart';
import type { CountryPoliciesData, PolicyCategory } from '@/components/civilization/PolicyManager';

// ─── Types ───────────────────────────────────────────────
type CountryTab = 'OVERVIEW' | 'TOKEN' | 'VOTE' | 'FACTION' | 'CIVILIZATION';

const TABS: CountryTab[] = ['OVERVIEW', 'TOKEN', 'VOTE', 'FACTION', 'CIVILIZATION'];

// 모바일 바텀시트 단계
type SheetStage = 'closed' | 'peek' | 'half' | 'full';
const SHEET_HEIGHTS: Record<SheetStage, string> = {
  closed: '0vh',
  peek: '20vh',
  half: '50vh',
  full: '85vh',
};

interface CountryPanelProps {
  country: CountryClientState | null;
  open: boolean;
  onClose: () => void;
  onEnterArena?: (iso3: string) => void;
  onSpectate?: (iso3: string) => void;
}

// ─── Mock Data Generators ────────────────────────────────
function getMockTokenBalance(country: CountryClientState): TokenBalance {
  const tierMultiplier: Record<string, number> = { S: 50, A: 20, B: 10, C: 5, D: 2 };
  const mult = tierMultiplier[country.tier] || 5;
  return {
    iso3: country.iso3,
    name: `${country.name} Token`,
    symbol: country.iso3.slice(0, 3),
    balance: String(mult * 1000 * 1e18),
    stakedBalance: String(mult * 400 * 1e18),
    pendingReward: String(mult * 10 * 1e18),
    tier: country.tier,
    marketCap: mult * 1_000_000,
    defenseMultiplier: 10000 + mult * 100,
    stakingAPR: 800 + mult * 50,
  };
}

function getMockStakingInfo(country: CountryClientState): StakingInfo {
  const tierMultiplier: Record<string, number> = { S: 50, A: 20, B: 10, C: 5, D: 2 };
  const mult = tierMultiplier[country.tier] || 5;
  return {
    iso3: country.iso3,
    totalStaked: String(mult * 50000 * 1e18),
    userStaked: String(mult * 400 * 1e18),
    pendingReward: String(mult * 10 * 1e18),
    apr: 800 + mult * 50,
    lastStakeTimestamp: Date.now() / 1000 - 86400,
  };
}

function getMockProposals(iso3: string): Proposal[] {
  return [
    {
      id: 1,
      iso3,
      proposer: '0x1234567890abcdef1234567890abcdef12345678',
      title: `${iso3} Tax Rate Reduction Proposal`,
      description: `Reduce the national tax rate of ${iso3} from 5% to 3% to stimulate economic growth.`,
      proposalType: 'tax',
      forVotes: 124.5,
      againstVotes: 45.2,
      startTime: Date.now() / 1000 - 86400 * 2,
      endTime: Date.now() / 1000 + 86400 * 5,
      status: 'active',
      executed: false,
      totalVoters: 89,
    },
    {
      id: 2,
      iso3,
      proposer: '0xabcdef1234567890abcdef1234567890abcdef12',
      title: `${iso3} Defense Budget Increase`,
      description: `Increase defense spending by 15% to strengthen territorial defense.`,
      proposalType: 'defense',
      forVotes: 200.1,
      againstVotes: 30.0,
      startTime: Date.now() / 1000 - 86400 * 7,
      endTime: Date.now() / 1000 - 86400 * 1,
      status: 'passed',
      executed: false,
      totalVoters: 145,
    },
    {
      id: 3,
      iso3,
      proposer: '0x9876543210fedcba9876543210fedcba98765432',
      title: `${iso3}-Allied Trade Agreement`,
      description: `Establish a bilateral trade agreement with neighboring allied nations.`,
      proposalType: 'trade',
      forVotes: 55.0,
      againstVotes: 88.3,
      startTime: Date.now() / 1000 - 86400 * 10,
      endTime: Date.now() / 1000 - 86400 * 3,
      status: 'rejected',
      executed: false,
      totalVoters: 72,
    },
  ];
}

// ─── Mock Civilization Data ─────────────────────────────
function getMockNationStats(country: CountryClientState): NationStatsData {
  const tierMult: Record<string, number> = { S: 1.5, A: 1.2, B: 1.0, C: 0.8, D: 0.6 };
  const mult = tierMult[country.tier] || 1.0;
  return {
    happiness: Math.min(100, 50 * mult + Math.random() * 20),
    birthRate: Math.min(4.0, Math.max(0.5, 2.0 * mult + (Math.random() - 0.5))),
    gdp: Math.max(100, 1000 * mult + Math.random() * 500),
    militaryPower: Math.min(100, 50 * mult + Math.random() * 20),
    techLevel: Math.min(100, 50 * mult + Math.random() * 15),
    loyalty: Math.min(100, 50 * mult + Math.random() * 20),
    population: Math.max(10, 1000 * mult + Math.random() * 500),
    internationalRep: (mult - 1.0) * 30 + (Math.random() - 0.5) * 20,
  };
}

function getMockPolicies(country: CountryClientState): CountryPoliciesData {
  const policies: Record<PolicyCategory, number> = {
    religion: 1, language: 1, government: 0, tax_rate: 1,
    military: 1, education: 1, trade: 1, environment: 1,
    immigration: 1, culture: 1,
  };
  return {
    countryCode: country.iso3,
    policies,
    lastChanged: 0,
    changedBy: '',
    graceEnd: 0,
  };
}

interface MockFactionInfo {
  name: string;
  memberCount: number;
  diplomacy: { allies: string[]; enemies: string[]; neutral: string[] };
  techProgress: { name: string; branch: string; progress: number; icon: string }[];
}

function getMockFactionInfo(country: CountryClientState): MockFactionInfo {
  const faction = country.sovereignFaction || 'Independent';
  return {
    name: faction,
    memberCount: Math.floor(Math.random() * 30) + 5,
    diplomacy: {
      allies: ['NATO Alliance', 'Pacific Rim Coalition'].slice(0, faction === 'Independent' ? 0 : 2),
      enemies: ['Shadow Syndicate'].slice(0, faction === 'Independent' ? 0 : 1),
      neutral: ['Non-Aligned Movement', 'Arctic Council'],
    },
    techProgress: [
      { name: 'Advanced Infantry', branch: 'military', progress: 0.72, icon: '⚔️' },
      { name: 'Trade Network', branch: 'economic', progress: 0.45, icon: '💰' },
      { name: 'Diplomatic Corps', branch: 'diplomatic', progress: 0.30, icon: '🛡️' },
    ],
  };
}

// ─── Sub-Components ──────────────────────────────────────
function ResourceBar({ label, icon, value, color }: {
  label: string;
  icon: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <span style={{
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: SK.textSecondary,
        width: '32px',
        textAlign: 'right',
        fontWeight: 600,
      }}>
        {icon}
      </span>
      <div style={{
        flex: 1,
        height: '8px',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 0,
        overflow: 'hidden',
      }}>
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            background: color,
            borderRadius: 0,
            transition: 'width 300ms ease',
          }}
        />
      </div>
      <span style={{
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: SK.textPrimary,
        width: '28px',
        textAlign: 'right',
        fontWeight: 700,
      }}>
        {value}
      </span>
    </div>
  );
}

function BattleStatusIndicator({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; color: string; pulse: boolean }> = {
    idle: { label: 'IDLE', color: SK.textMuted, pulse: false },
    preparing: { label: 'PREPARING', color: '#F59E0B', pulse: true },
    in_battle: { label: 'IN BATTLE', color: '#EF4444', pulse: true },
    cooldown: { label: 'COOLDOWN', color: '#3B82F6', pulse: false },
  };

  const cfg = statusConfig[status] || statusConfig.idle;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 12px',
      background: `${cfg.color}15`,
      borderRadius: handDrawnRadius(2),
      border: `1px solid ${cfg.color}30`,
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: cfg.color,
        boxShadow: cfg.pulse ? `0 0 8px ${cfg.color}` : 'none',
        animation: cfg.pulse ? 'pulse 1.5s infinite' : 'none',
      }} />
      <span style={{
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: cfg.color,
        fontWeight: 700,
        letterSpacing: '2px',
      }}>
        {cfg.label}
      </span>
    </div>
  );
}

/** 탭 아이콘 매핑 */
const TAB_ICONS: Record<CountryTab, typeof BarChart3> = {
  OVERVIEW: BarChart3,
  TOKEN: Coins,
  VOTE: Vote,
  FACTION: Shield,
  CIVILIZATION: Building2,
};

/** 탭 바 — 5탭, 골드 underline 활성 인디케이터 + lucide 아이콘 */
function TabBar({ activeTab, onTabChange }: {
  activeTab: CountryTab;
  onTabChange: (tab: CountryTab) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      borderBottom: `1px solid ${SK.border}`,
      margin: '0 20px',
    }}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab;
        const Icon = TAB_ICONS[tab];
        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'none',
              border: 'none',
              borderBottom: isActive ? '2px solid #F59E0B' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              fontFamily: bodyFont,
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: isActive ? '#F59E0B' : SK.textMuted,
              transition: 'color 150ms ease, border-color 150ms ease',
            }}
          >
            <Icon size={13} strokeWidth={1.8} />
            {tab}
          </button>
        );
      })}
    </div>
  );
}

/** OVERVIEW 탭 — 기존 국가 정보 (배틀 상태, 소버린티, GDP, 자원) */
function OverviewTab({ country }: { country: CountryClientState }) {
  const tierColor = tierColors[country.tier] || SK.textMuted;
  const resources = country.resources || { oil: 0, minerals: 0, food: 0, tech: 0, manpower: 0 };
  const resourceColors: Record<string, string> = {
    oil: '#1E1E1E',
    minerals: '#7C7C7C',
    food: '#4A9E4A',
    tech: '#4488AA',
    manpower: '#CC9933',
  };

  return (
    <div>
      {/* 전투 상태 */}
      <div style={{ marginBottom: '16px' }}>
        <BattleStatusIndicator status={country.battleStatus || 'idle'} />
      </div>

      {/* 지배 팩션 */}
      <div style={{
        marginBottom: '16px',
        padding: '12px',
        background: SK.cardBg,
        borderRadius: handDrawnRadius(2),
        border: sketchBorder(),
      }}>
        <div style={{
          fontFamily: bodyFont,
          fontSize: SKFont.xs,
          color: SK.textMuted,
          letterSpacing: '2px',
          marginBottom: '6px',
          textTransform: 'uppercase',
        }}>
          Sovereignty
        </div>
        <div style={{
          fontFamily: bodyFont,
          fontSize: SKFont.body,
          color: country.sovereignFaction ? SK.textPrimary : SK.textMuted,
          fontWeight: 700,
        }}>
          {country.sovereignFaction || 'Unclaimed'}
        </div>
        {country.sovereigntyLevel !== undefined && country.sovereigntyLevel > 0 && (
          <div style={{
            fontFamily: bodyFont,
            fontSize: SKFont.xs,
            color: SK.orange,
            marginTop: '4px',
          }}>
            Sovereignty Lv.{country.sovereigntyLevel}
          </div>
        )}
      </div>

      {/* GDP & Agents */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        marginBottom: '16px',
      }}>
        <div style={{
          padding: '10px',
          background: SK.cardBg,
          borderRadius: handDrawnRadius(2),
          border: sketchBorder(),
        }}>
          <div style={{
            fontFamily: bodyFont,
            fontSize: SKFont.xs,
            color: SK.textMuted,
            letterSpacing: '1px',
            marginBottom: '4px',
          }}>
            GDP
          </div>
          <div style={{
            fontFamily: bodyFont,
            fontSize: SKFont.h3,
            color: SK.gold,
            fontWeight: 700,
          }}>
            {country.gdp ? `$${(country.gdp / 1000).toFixed(0)}B` : '$0'}
          </div>
        </div>

        <div style={{
          padding: '10px',
          background: SK.cardBg,
          borderRadius: handDrawnRadius(2),
          border: sketchBorder(),
        }}>
          <div style={{
            fontFamily: bodyFont,
            fontSize: SKFont.xs,
            color: SK.textMuted,
            letterSpacing: '1px',
            marginBottom: '4px',
          }}>
            AGENTS
          </div>
          <div style={{
            fontFamily: bodyFont,
            fontSize: SKFont.h3,
            color: SK.green,
            fontWeight: 700,
          }}>
            {country.activeAgents || 0}
          </div>
        </div>
      </div>

      {/* Resources */}
      <div style={{
        marginBottom: '20px',
        padding: '12px',
        background: SK.cardBg,
        borderRadius: handDrawnRadius(2),
        border: sketchBorder(),
      }}>
        <div style={{
          fontFamily: bodyFont,
          fontSize: SKFont.xs,
          color: SK.textMuted,
          letterSpacing: '2px',
          marginBottom: '10px',
          textTransform: 'uppercase',
        }}>
          Resources
        </div>
        {Object.entries(resources).map(([key, value]) => (
          <ResourceBar
            key={key}
            label={resourceLabels[key] || key}
            icon={resourceIcons[key] || key.slice(0, 3).toUpperCase()}
            value={value}
            color={resourceColors[key] || SK.textSecondary}
          />
        ))}
      </div>

      {/* Terrain */}
      {country.terrainTheme && (
        <div style={{
          marginBottom: '16px',
          fontFamily: bodyFont,
          fontSize: SKFont.sm,
          color: SK.textSecondary,
        }}>
          <span style={{ color: SK.textMuted, letterSpacing: '1px', fontSize: SKFont.xs }}>
            TERRAIN:{' '}
          </span>
          <span style={{ color: SK.textPrimary, textTransform: 'uppercase', fontWeight: 600 }}>
            {country.terrainTheme}
          </span>
        </div>
      )}

      {/* View Full Stats 링크 */}
      <Link href="/factions" style={{
        display: 'block',
        textAlign: 'right',
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: SK.orange,
        textDecoration: 'none',
        fontWeight: 600,
        letterSpacing: '0.5px',
      }}>
        VIEW FULL STATS &rarr;
      </Link>
    </div>
  );
}

/** TOKEN 탭 — CountryTokenInfo + StakingPanel 축소 연결 */
function TokenTab({ country }: { country: CountryClientState }) {
  const token = getMockTokenBalance(country);
  const stakingInfo = getMockStakingInfo(country);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* CountryTokenInfo 컴포넌트 */}
      <CountryTokenInfo token={token} />

      {/* StakingPanel 축소 버전 */}
      <StakingPanel
        iso3={country.iso3}
        tokenName={`${country.name} Token`}
        tokenSymbol={country.iso3.slice(0, 3)}
        stakingInfo={stakingInfo}
        userBalance={token.balance}
        treasuryAddress="0x0000000000000000000000000000000000000000"
        defenseMultiplier={token.defenseMultiplier}
      />

      {/* View Token Dashboard 링크 */}
      <Link href="/economy/tokens" style={{
        display: 'block',
        textAlign: 'right',
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: SK.orange,
        textDecoration: 'none',
        fontWeight: 600,
        letterSpacing: '0.5px',
        marginTop: '4px',
      }}>
        VIEW TOKEN DASHBOARD &rarr;
      </Link>
    </div>
  );
}

/** VOTE 탭 — ProposalList + VoteInterface 인라인 */
function VoteTab({ country }: { country: CountryClientState }) {
  const proposals = getMockProposals(country.iso3);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ProposalList (국가 필터링 적용) */}
      {!selectedProposal ? (
        <ProposalList
          proposals={proposals}
          onSelectProposal={setSelectedProposal}
        />
      ) : (
        <>
          {/* VoteInterface 인라인 */}
          <button
            onClick={() => setSelectedProposal(null)}
            style={{
              background: 'none',
              border: 'none',
              color: SK.textSecondary,
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              cursor: 'pointer',
              padding: '0 0 8px 0',
              textAlign: 'left',
              letterSpacing: '0.5px',
            }}
          >
            &larr; BACK TO PROPOSALS
          </button>
          <VoteInterface
            proposal={selectedProposal}
            userTokenBalance={10000}
          />
        </>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <Link
          href={`/governance/new?country=${country.iso3}`}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 12px',
            borderRadius: radius.md,
            border: `1px solid ${SK.orange}40`,
            background: `${SK.orange}15`,
            color: SK.orange,
            fontFamily: bodyFont,
            fontSize: SKFont.xs,
            fontWeight: 700,
            textDecoration: 'none',
            letterSpacing: '0.5px',
          }}
        >
          NEW PROPOSAL
        </Link>
        <Link
          href={`/governance?country=${country.iso3}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            fontFamily: bodyFont,
            fontSize: SKFont.xs,
            color: SK.orange,
            textDecoration: 'none',
            fontWeight: 600,
            letterSpacing: '0.5px',
            padding: '8px',
          }}
        >
          ALL PROPOSALS &rarr;
        </Link>
      </div>
    </div>
  );
}

/** FACTION 탭 — 팩션 소속 + 외교 + 테크트리 축약 */
function FactionTab({ country }: { country: CountryClientState }) {
  const factionInfo = getMockFactionInfo(country);
  const branchColors: Record<string, string> = {
    military: SK.red,
    economic: SK.gold,
    diplomatic: SK.blue,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* 소속 팩션 정보 */}
      <div style={{
        padding: '12px',
        background: SK.cardBg,
        borderRadius: radius.md,
        border: sketchBorder(),
      }}>
        <div style={{
          fontFamily: bodyFont,
          fontSize: SKFont.xs,
          color: SK.textMuted,
          letterSpacing: '2px',
          marginBottom: '8px',
          textTransform: 'uppercase',
        }}>
          Faction
        </div>
        <div style={{
          fontFamily: headingFont,
          fontSize: SKFont.body,
          color: factionInfo.name !== 'Independent' ? SK.textPrimary : SK.textMuted,
          fontWeight: 700,
          marginBottom: '4px',
        }}>
          {factionInfo.name}
        </div>
        <div style={{
          fontFamily: bodyFont,
          fontSize: SKFont.xs,
          color: SK.textSecondary,
        }}>
          {factionInfo.memberCount} member nations
        </div>
      </div>

      {/* 외교 상태 */}
      <div style={{
        padding: '12px',
        background: SK.cardBg,
        borderRadius: radius.md,
        border: sketchBorder(),
      }}>
        <div style={{
          fontFamily: bodyFont,
          fontSize: SKFont.xs,
          color: SK.textMuted,
          letterSpacing: '2px',
          marginBottom: '10px',
          textTransform: 'uppercase',
        }}>
          Diplomacy
        </div>

        {/* Allies */}
        {factionInfo.diplomacy.allies.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.green,
              fontWeight: 700,
              marginBottom: '4px',
              letterSpacing: '1px',
            }}>
              ALLIES
            </div>
            {factionInfo.diplomacy.allies.map((ally) => (
              <div key={ally} style={{
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                color: SK.textSecondary,
                padding: '2px 0',
              }}>
                {ally}
              </div>
            ))}
          </div>
        )}

        {/* Enemies */}
        {factionInfo.diplomacy.enemies.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.red,
              fontWeight: 700,
              marginBottom: '4px',
              letterSpacing: '1px',
            }}>
              HOSTILE
            </div>
            {factionInfo.diplomacy.enemies.map((enemy) => (
              <div key={enemy} style={{
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                color: SK.textSecondary,
                padding: '2px 0',
              }}>
                {enemy}
              </div>
            ))}
          </div>
        )}

        {/* Neutral */}
        {factionInfo.diplomacy.neutral.length > 0 && (
          <div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.textMuted,
              fontWeight: 700,
              marginBottom: '4px',
              letterSpacing: '1px',
            }}>
              NEUTRAL
            </div>
            {factionInfo.diplomacy.neutral.map((n) => (
              <div key={n} style={{
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                color: SK.textSecondary,
                padding: '2px 0',
              }}>
                {n}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TechTree 진행 상황 (핵심 3개) */}
      <div style={{
        padding: '12px',
        background: SK.cardBg,
        borderRadius: radius.md,
        border: sketchBorder(),
      }}>
        <div style={{
          fontFamily: bodyFont,
          fontSize: SKFont.xs,
          color: SK.textMuted,
          letterSpacing: '2px',
          marginBottom: '10px',
          textTransform: 'uppercase',
        }}>
          Tech Progress
        </div>
        {factionInfo.techProgress.map((tech) => {
          const barColor = branchColors[tech.branch] || SK.textSecondary;
          return (
            <div key={tech.name} style={{ marginBottom: '10px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
              }}>
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: SKFont.xs,
                  color: SK.textPrimary,
                  fontWeight: 600,
                }}>
                  {tech.icon} {tech.name}
                </span>
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: '10px',
                  color: barColor,
                  fontWeight: 700,
                }}>
                  {Math.round(tech.progress * 100)}%
                </span>
              </div>
              <div style={{
                height: '4px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 0,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${tech.progress * 100}%`,
                  height: '100%',
                  background: barColor,
                  borderRadius: 0,
                  transition: 'width 300ms ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* View Faction 링크 */}
      <Link href="/factions" style={{
        display: 'block',
        textAlign: 'right',
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: SK.orange,
        textDecoration: 'none',
        fontWeight: 600,
        letterSpacing: '0.5px',
      }}>
        VIEW FACTION &rarr;
      </Link>
    </div>
  );
}

// ─── useIsMobile Hook ────────────────────────────────────
/** 모바일 감지 훅 (768px 기준) */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

// ─── Main Component ──────────────────────────────────────
export function CountryPanel({
  country,
  open,
  onClose,
  onEnterArena,
  onSpectate,
}: CountryPanelProps) {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<CountryTab>('OVERVIEW');
  const isMobile = useIsMobile();

  // 모바일 바텀시트 상태
  const [sheetStage, setSheetStage] = useState<SheetStage>('closed');
  const dragStartY = useRef<number>(0);
  const dragCurrentY = useRef<number>(0);
  const isDragging = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // 슬라이드/시트 애니메이션
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        setVisible(true);
        if (isMobile) setSheetStage('half');
      }, 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      setSheetStage('closed');
    }
  }, [open, isMobile]);

  // 국가 변경 시 탭 리셋
  useEffect(() => {
    setActiveTab('OVERVIEW');
  }, [country?.iso3]);

  // 바텀시트 터치 핸들러
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    dragCurrentY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const diff = dragCurrentY.current - dragStartY.current;
    // 아래로 스와이프
    if (diff > 60) {
      if (sheetStage === 'full') setSheetStage('half');
      else if (sheetStage === 'half') setSheetStage('peek');
      else onClose();
    }
    // 위로 스와이프
    else if (diff < -60) {
      if (sheetStage === 'peek') setSheetStage('half');
      else if (sheetStage === 'half') setSheetStage('full');
    }
  }, [sheetStage, onClose]);

  if (!open && !visible) return null;

  const tierColor = country?.tier ? tierColors[country.tier] : SK.textMuted;

  // ─── 탭 콘텐츠 렌더링 ───
  const renderTabContent = () => {
    if (!country) return null;
    switch (activeTab) {
      case 'OVERVIEW':
        return <OverviewTab country={country} />;
      case 'TOKEN':
        return <TokenTab country={country} />;
      case 'VOTE':
        return <VoteTab country={country} />;
      case 'FACTION':
        return <FactionTab country={country} />;
      case 'CIVILIZATION':
        return (
          <CivilizationPanel
            countryCode={country.iso3}
            countryName={country.name}
            stats={getMockNationStats(country)}
            policies={getMockPolicies(country)}
            canChangePolicy={false}
            dominantNation={country.sovereignFaction || undefined}
            hasHegemony={false}
            hasSovereignty={(country.sovereigntyLevel ?? 0) > 0}
          />
        );
      default:
        return null;
    }
  };

  // ─── 공통 헤더 (탭 위에 고정) ───
  const header = (
    <div style={{
      padding: '20px 20px 16px',
      borderBottom: `1px solid ${SK.border}`,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    }}>
      <div>
        <div style={{
          fontFamily: bodyFont,
          fontWeight: 800,
          fontSize: SKFont.h2,
          color: SK.textPrimary,
          letterSpacing: '1px',
          marginBottom: '4px',
        }}>
          {country?.name || 'Unknown'}
        </div>
        <div style={{
          fontFamily: bodyFont,
          fontSize: SKFont.sm,
          color: SK.textSecondary,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>{country?.iso3}</span>
          <span style={{
            color: tierColor,
            fontWeight: 700,
            padding: '1px 6px',
            border: `1px solid ${tierColor}40`,
            borderRadius: 0,
            fontSize: SKFont.xs,
          }}>
            TIER {country?.tier}
          </span>
          <span style={{ opacity: 0.5 }}>{country?.continent}</span>
        </div>
      </div>

      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: `1px solid ${SK.border}`,
          borderRadius: 0,
          color: SK.textSecondary,
          cursor: 'pointer',
          padding: '5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 150ms ease, border-color 150ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = SK.textPrimary;
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = SK.textSecondary;
          e.currentTarget.style.borderColor = SK.border;
        }}
      >
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  );

  // ─── 공통 하단 액션 ───
  const footer = (
    <div style={{
      padding: '16px 20px 24px',
      borderTop: `1px solid ${SK.border}`,
      display: 'flex',
      gap: '10px',
    }}>
      <McButton
        variant="green"
        onClick={() => country?.iso3 && onEnterArena?.(country.iso3)}
        disabled={!country}
        style={{ flex: 1, fontSize: SKFont.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
      >
        <Play size={14} strokeWidth={2} /> ENTER ARENA
      </McButton>
      <McButton
        variant="default"
        onClick={() => country?.iso3 && onSpectate?.(country.iso3)}
        disabled={!country}
        style={{ flex: 1, fontSize: SKFont.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
      >
        <Eye size={14} strokeWidth={2} /> SPECTATE
      </McButton>
    </div>
  );

  // ━━━ 모바일: 바텀시트 ━━━
  if (isMobile) {
    return (
      <>
        {/* 배경 오버레이 */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 100,
            opacity: sheetStage !== 'closed' ? 1 : 0,
            transition: 'opacity 200ms ease',
            pointerEvents: sheetStage !== 'closed' ? 'auto' : 'none',
          }}
          onClick={onClose}
        />

        {/* 바텀시트 */}
        <div
          ref={sheetRef}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: SHEET_HEIGHTS[sheetStage],
            zIndex: 101,
            background: SK.bg,
            borderTop: sketchBorder(),
            borderRadius: 0,
            transition: 'height 300ms cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* 드래그 핸들 */}
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '10px 0 6px',
              cursor: 'grab',
              flexShrink: 0,
            }}
          >
            <div style={{
              width: '40px',
              height: '5px',
              borderRadius: 0,
              background: SK.textMuted,
            }} />
          </div>

          {/* 헤더 */}
          {header}

          {/* 탭 바 */}
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

          {/* 탭 콘텐츠 (스크롤) */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
          }}>
            {renderTabContent()}
          </div>

          {/* 액션 버튼 */}
          {footer}
        </div>

        {/* Pulse 애니메이션 */}
        <style jsx global>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </>
    );
  }

  // ━━━ 데스크탑: 우측 슬라이드 패널 ━━━
  return (
    <>
      {/* 배경 오버레이 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 100,
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease',
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* 슬라이드 패널 — 글래스모피즘 */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 'min(400px, 90vw)',
        height: '100vh',
        zIndex: 101,
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(9,9,11,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        {/* 헤더 (탭 위에 고정) */}
        {header}

        {/* 탭 바 */}
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* 탭 콘텐츠 (스크롤 영역) */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
        }}>
          {renderTabContent()}
        </div>

        {/* 하단 액션 버튼 (탭 아래에 고정) */}
        {footer}
      </div>

      {/* Pulse 애니메이션 CSS */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}
