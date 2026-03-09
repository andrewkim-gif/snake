'use client';

/**
 * CountryPanel — 국가 상세 패널 (탭 확장 v13)
 * 4개 탭: OVERVIEW | TOKEN | VOTE | FACTION
 * 모바일: 하단 바텀시트, 데스크탑: 우측 슬라이드
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { BarChart3, Coins, Vote, Shield, Building2, X } from 'lucide-react';
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
import { fetchCouncilProposals, fetchGdpData, fetchFactions, fetchWorldStatus, fetchPlayerTokenBalance, type CouncilProposal, type GdpEntry, type FactionSummary, type WorldStatusData } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { useWalletStore } from '@/stores/wallet-store';
import WalletConnectButton from '@/components/blockchain/WalletConnectButton';
import { KEYFRAMES_PULSE } from '@/lib/overlay-tokens';

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
  /** v29b: Globe → Matrix 게임 진입 */
  onManageCountry?: (iso3: string) => void;
  /** v29b: Globe → Isometric 도시 관리 전환 (별도 경로 보존) */
  onManageCity?: (iso3: string) => void;
}

// ─── API Data Helpers ────────────────────────────────────

/** GDP 데이터에서 해당 국가의 TokenBalance 생성 */
function getTokenBalance(country: CountryClientState, gdpEntries: GdpEntry[] | null): TokenBalance {
  const gdp = gdpEntries?.find(g => g.iso3 === country.iso3);
  return {
    iso3: country.iso3,
    name: `${country.name} Token`,
    symbol: country.iso3.slice(0, 3),
    balance: '0',
    stakedBalance: '0',
    pendingReward: '0',
    tier: country.tier,
    marketCap: gdp?.gdp || 0,
    defenseMultiplier: 10000,
    stakingAPR: 500,
  };
}

/** GDP 데이터에서 해당 국가의 StakingInfo 생성 */
function getStakingInfo(country: CountryClientState, _gdpEntries: GdpEntry[] | null): StakingInfo {
  return {
    iso3: country.iso3,
    totalStaked: '0',
    userStaked: '0',
    pendingReward: '0',
    apr: 500,
    lastStakeTimestamp: Date.now() / 1000 - 86400,
  };
}

/** CouncilProposal → Proposal 변환 (거버넌스 컴포넌트 호환) */
function toProposals(apiProposals: CouncilProposal[] | null): Proposal[] {
  if (!apiProposals) return [];
  return apiProposals.map(p => ({
    id: typeof p.id === 'string' ? parseInt(p.id, 10) || 0 : (p.id as unknown as number),
    iso3: p.iso3,
    proposer: p.proposer,
    title: p.title,
    description: p.description,
    proposalType: p.proposalType as Proposal['proposalType'],
    forVotes: p.forVotes,
    againstVotes: p.againstVotes,
    startTime: typeof p.startTime === 'string' ? new Date(p.startTime).getTime() / 1000 : p.startTime as unknown as number,
    endTime: typeof p.endTime === 'string' ? new Date(p.endTime).getTime() / 1000 : p.endTime as unknown as number,
    status: p.status as Proposal['status'],
    executed: p.executed,
    totalVoters: p.totalVoters,
  }));
}

/** WorldStatus에서 해당 국가의 NationStats 추출 */
function getNationStats(country: CountryClientState, worldStatus: WorldStatusData | null): NationStatsData {
  const ws = worldStatus?.countries?.find((c) => c.iso3 === country.iso3);
  return {
    happiness: ws?.happiness ?? 50,
    birthRate: 2.0,
    gdp: country.gdp || 0,
    militaryPower: ws?.militaryPower ?? 50,
    techLevel: 50,
    loyalty: 50,
    population: ws?.population ?? 0,
    internationalRep: 0,
  };
}

/** 기본 정책값 (정책 API는 PolicyPanel이 별도로 처리) */
function getDefaultPolicies(country: CountryClientState): CountryPoliciesData {
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

/** FactionSummary 리스트에서 해당 국가의 팩션 정보 추출 */
interface FactionInfo {
  name: string;
  tag: string;
  color: string;
  memberCount: number;
  prestige: number;
}

function getFactionInfo(country: CountryClientState, factionsList: FactionSummary[] | null): FactionInfo | null {
  if (!country.sovereignFaction || !factionsList) return null;
  const faction = factionsList.find(f => f.name === country.sovereignFaction);
  if (!faction) return null;
  return {
    name: faction.name,
    tag: faction.tag,
    color: faction.color,
    memberCount: faction.member_count,
    prestige: faction.prestige,
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
        animation: cfg.pulse ? 'effectPulse 1.5s infinite' : 'none',
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

/** 탭 바 — 5탭, 레드 underline 활성 인디케이터 + lucide 아이콘 */
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
              background: isActive ? 'rgba(239, 68, 68, 0.06)' : 'none',
              border: 'none',
              borderBottom: isActive ? '2px solid #EF4444' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              fontFamily: bodyFont,
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: isActive ? '#EF4444' : SK.textMuted,
              transition: 'color 150ms ease, border-color 150ms ease, background 150ms ease',
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
/** v30 Task 2-12: 지갑 미연결 시 "Connect Wallet" 표시 */
function TokenTab({ country, gdpData }: { country: CountryClientState; gdpData: GdpEntry[] | null }) {
  const walletStore = useWalletStore();
  const token = getTokenBalance(country, gdpData);
  const stakingInfo = getStakingInfo(country, gdpData);

  // v30 Task 2-12: 지갑 미연결 시 Connect Wallet 게이트
  if (!walletStore.isConnected) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '32px 16px',
        textAlign: 'center',
      }}>
        <Coins size={32} style={{ color: SK.gold, opacity: 0.5 }} />
        <div style={{ fontFamily: headingFont, fontSize: '14px', color: SK.textSecondary, letterSpacing: '0.5px' }}>
          Connect your wallet to view token data and stake
        </div>
        <WalletConnectButton onConnect={() => {}} onDisconnect={() => {}} />
      </div>
    );
  }

  const treasuryAddr = walletStore.address || '0x0000000000000000000000000000000000000000';

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
        treasuryAddress={treasuryAddr}
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
/** v30 Task 2-11/2-12: 서버에서 실제 토큰 잔고 조회 */
function VoteTab({ country, proposals }: { country: CountryClientState; proposals: Proposal[] }) {
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const walletStore = useWalletStore();
  const playerId = walletStore.isConnected ? walletStore.address : 'local-user';
  const { data: tokenBalanceData } = useApiData(
    () => fetchPlayerTokenBalance(playerId),
    { refreshInterval: 15000 },
  );
  const userTokenBalance = tokenBalanceData?.balance ?? 0;

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
            userTokenBalance={userTokenBalance}
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
function FactionTab({ country, factionInfo }: { country: CountryClientState; factionInfo: FactionInfo | null }) {
  const displayInfo = factionInfo || {
    name: country.sovereignFaction || 'Independent',
    tag: '',
    color: '',
    memberCount: 0,
    prestige: 0,
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
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '4px',
        }}>
          {displayInfo.color && (
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '2px',
              backgroundColor: displayInfo.color,
              flexShrink: 0,
            }} />
          )}
          <div style={{
            fontFamily: headingFont,
            fontSize: SKFont.body,
            color: displayInfo.name !== 'Independent' ? SK.textPrimary : SK.textMuted,
            fontWeight: 700,
          }}>
            {displayInfo.name}
            {displayInfo.tag && (
              <span style={{ color: SK.textMuted, fontWeight: 400, marginLeft: '6px', fontSize: SKFont.xs }}>
                [{displayInfo.tag}]
              </span>
            )}
          </div>
        </div>
        <div style={{
          fontFamily: bodyFont,
          fontSize: SKFont.xs,
          color: SK.textSecondary,
        }}>
          {displayInfo.memberCount} member nations
        </div>
      </div>

      {/* 프레스티지 */}
      {displayInfo.prestige > 0 && (
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
            Prestige
          </div>
          <div style={{
            fontFamily: bodyFont,
            fontSize: SKFont.h3,
            color: SK.gold,
            fontWeight: 700,
          }}>
            {displayInfo.prestige.toLocaleString()}
          </div>
        </div>
      )}

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
  onManageCountry,
  onManageCity,
}: CountryPanelProps) {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<CountryTab>('OVERVIEW');
  const isMobile = useIsMobile();

  // ─── API Data Hooks ───
  const selectedCountry = country;
  const gdpFetcher = useMemo(() => () => fetchGdpData(), []);
  const factionsFetcher = useMemo(() => () => fetchFactions(), []);
  const worldStatusFetcher = useMemo(() => () => fetchWorldStatus(), []);
  const proposalsFetcher = useMemo(
    () => () => fetchCouncilProposals(selectedCountry?.iso3),
    [selectedCountry?.iso3],
  );

  const { data: gdpData } = useApiData(gdpFetcher);
  const { data: factions } = useApiData(factionsFetcher);
  const { data: worldStatus } = useApiData(worldStatusFetcher);
  const { data: apiProposals } = useApiData(proposalsFetcher);

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
        return <TokenTab country={country} gdpData={gdpData} />;
      case 'VOTE':
        return <VoteTab country={country} proposals={toProposals(apiProposals)} />;
      case 'FACTION':
        return <FactionTab country={country} factionInfo={getFactionInfo(country, factions)} />;
      case 'CIVILIZATION':
        return (
          <CivilizationPanel
            countryCode={country.iso3}
            countryName={country.name}
            stats={getNationStats(country, worldStatus)}
            policies={getDefaultPolicies(country)}
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
      padding: '16px 20px 12px',
      borderBottom: `1px solid rgba(239, 68, 68, 0.15)`,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    }}>
      <div>
        <div style={{
          fontFamily: bodyFont,
          fontWeight: 700,
          fontSize: '20px',
          color: SK.textPrimary,
          letterSpacing: '0.3px',
          marginBottom: '4px',
        }}>
          {country?.name || 'Unknown'}
        </div>
        <div style={{
          fontFamily: bodyFont,
          fontSize: '12px',
          color: SK.textSecondary,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ letterSpacing: '0.5px' }}>{country?.iso3}</span>
          <span style={{
            color: tierColor,
            fontWeight: 700,
            padding: '1px 6px',
            border: `1px solid ${tierColor}40`,
            borderRadius: 0,
            fontSize: '10px',
            letterSpacing: '0.5px',
          }}>
            TIER {country?.tier}
          </span>
          <span style={{ opacity: 0.5, letterSpacing: '0.3px' }}>{country?.continent}</span>
        </div>
      </div>

      {/* 닫기 버튼 — 붉은 악센트 */}
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: `1px solid rgba(239, 68, 68, 0.3)`,
          borderRadius: 0,
          color: SK.textSecondary,
          cursor: 'pointer',
          padding: '5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 150ms ease, border-color 150ms ease, background 150ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#EF4444';
          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)';
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = SK.textSecondary;
          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
          e.currentTarget.style.background = 'none';
        }}
      >
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  );

  // ─── 공통 하단 액션 ───
  const footer = (
    <div style={{
      padding: '14px 20px 20px',
      borderTop: `1px solid rgba(239, 68, 68, 0.15)`,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {/* v29b: Matrix 게임 진입 버튼 (메인) */}
      <McButton
        variant="green"
        onClick={() => country?.iso3 && onManageCountry?.(country.iso3)}
        disabled={!country}
        style={{
          width: '100%',
          fontSize: SKFont.body,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          letterSpacing: '2px',
        }}
      >
        <Building2 size={16} strokeWidth={2} /> ENTER {country?.name?.toUpperCase() || 'COUNTRY'}
      </McButton>

      {/* v29b: Iso 도시 관리 버튼 (보조 — 경로 보존) */}
      {onManageCity && (
        <button
          onClick={() => country?.iso3 && onManageCity(country.iso3)}
          disabled={!country}
          style={{
            width: '100%',
            padding: '10px 16px',
            border: `1px solid ${SK.textMuted}40`,
            borderRadius: 0,
            background: 'rgba(255, 255, 255, 0.03)',
            color: SK.textSecondary,
            fontFamily: bodyFont,
            fontSize: SKFont.xs,
            fontWeight: 600,
            letterSpacing: '1.5px',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            textTransform: 'uppercase' as const,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = `${SK.textSecondary}60`;
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.color = SK.textPrimary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = `${SK.textMuted}40`;
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
            e.currentTarget.style.color = SK.textSecondary;
          }}
        >
          <Building2 size={13} strokeWidth={2} /> MANAGE CITY
        </button>
      )}
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

        {/* 통일 pulse 키프레임 (overlay-tokens.ts) */}
        <style>{KEYFRAMES_PULSE}</style>
      </>
    );
  }

  // ━━━ 데스크탑: 중앙 팝업 — Apex 스타일 ━━━
  return (
    <>
      {/* 배경 오버레이 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 100,
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease',
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* 팝업 패널 — Apex 에이펙스 스타일 */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: visible
          ? 'translate(-50%, -50%) scale(1)'
          : 'translate(-50%, -48%) scale(0.96)',
        opacity: visible ? 1 : 0,
        width: 'min(520px, 92vw)',
        maxHeight: '80vh',
        zIndex: 101,
        transition: 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(9, 9, 11, 0.94)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${SK.glassBorder}`,
        borderTop: '1px solid rgba(239, 68, 68, 0.5)',
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.7), 0 0 1px rgba(239, 68, 68, 0.3)',
        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
        pointerEvents: visible ? 'auto' : 'none',
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

        {/* 왼쪽 아래 붉은 삼각형 */}
        <div style={{
          position: 'absolute',
          bottom: -1,
          left: -1,
          width: 0,
          height: 0,
          borderLeft: '16px solid #EF4444',
          borderTop: '16px solid transparent',
          pointerEvents: 'none',
        }} />
      </div>

      {/* 통일 pulse 키프레임 (overlay-tokens.ts) */}
      <style>{KEYFRAMES_PULSE}</style>
    </>
  );
}
