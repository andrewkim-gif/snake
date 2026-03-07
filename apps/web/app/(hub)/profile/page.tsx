'use client';

/**
 * /profile — 프로필 페이지
 * Agent Card (닉네임, 승률, 전적) + Wallet (연결/해제, 토큰 목록)
 * Achievements 컴포넌트 + WalletConnectButton + TokenBalanceList 연결
 */

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, sketchShadow, radius } from '@/lib/sketch-ui';
import WalletConnectButton from '@/components/blockchain/WalletConnectButton';
import TokenBalanceList from '@/components/blockchain/TokenBalanceList';
import type { WalletState, TokenBalance } from '@/lib/crossx-config';

// Lazy load Achievements (대형 컴포넌트)
const Achievements = dynamic(() => import('@/components/profile/Achievements'), {
  loading: () => (
    <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 24, textAlign: 'center' }}>
      Loading achievements...
    </div>
  ),
});

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || '';

// Mock 프로필 데이터
const MOCK_PROFILE = {
  name: 'xXDarkLord420Xx',
  level: 42,
  winRate: 42,
  avgLevel: 7.3,
  totalBattles: 156,
  totalKills: 2847,
  totalDeaths: 189,
  playtime: '48h 23m',
  faction: 'East Asia Coalition',
  factionTag: 'EAC',
  country: 'KOR',
  rank: 'Commander',
};

// Mock 토큰 잔고 (지갑 연결 시 표시)
const MOCK_BALANCES: TokenBalance[] = [
  { iso3: 'KOR', name: 'Korea Token', symbol: '$KOR', balance: '50000', stakedBalance: '12000', pendingReward: '340', tier: 'S', marketCap: 8500000, defenseMultiplier: 1.45, stakingAPR: 1200 },
  { iso3: 'USA', name: 'USA Token', symbol: '$USA', balance: '25000', stakedBalance: '5000', pendingReward: '120', tier: 'S', marketCap: 12000000, defenseMultiplier: 1.55, stakingAPR: 980 },
  { iso3: 'JPN', name: 'Japan Token', symbol: '$JPN', balance: '15000', stakedBalance: '0', pendingReward: '0', tier: 'A', marketCap: 6200000, defenseMultiplier: 1.30, stakingAPR: 1100 },
  { iso3: 'GBR', name: 'UK Token', symbol: '$GBR', balance: '8000', stakedBalance: '2000', pendingReward: '45', tier: 'A', marketCap: 4800000, defenseMultiplier: 1.25, stakingAPR: 850 },
];

export default function ProfilePage() {
  const tProfile = useTranslations('profile');
  const [wallet, setWallet] = useState<WalletState | null>(null);

  const handleWalletConnect = useCallback((w: WalletState) => {
    setWallet(w);
  }, []);

  const handleWalletDisconnect = useCallback(() => {
    setWallet(null);
  }, []);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* 페이지 헤더 */}
      <h1 style={{
        fontFamily: headingFont,
        fontWeight: 800,
        fontSize: '24px',
        color: SK.textPrimary,
        letterSpacing: '2px',
        textTransform: 'uppercase',
        margin: '0 0 24px 0',
      }}>
        {tProfile('title')}
      </h1>

      {/* Agent Card + Wallet 섹션 (2-column) — 반응형 */}
      <div
        className="profile-top-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <style>{`
          @media (max-width: 767px) {
            .profile-top-grid {
              grid-template-columns: 1fr !important;
              gap: 12px !important;
            }
          }
        `}</style>
        {/* Agent Card */}
        <div style={{
          background: SK.cardBg,
          border: sketchBorder(),
          borderRadius: radius.lg,
          padding: 24,
          boxShadow: sketchShadow('md'),
        }}>
          {/* 3D 캐릭터 프리뷰 (플레이스홀더) */}
          <div style={{
            width: '100%',
            height: 180,
            background: SK.bgWarm,
            borderRadius: radius.md,
            border: sketchBorder(SK.borderDark),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* 그리드 패턴 배경 */}
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
            }} />
            <div style={{
              fontSize: 64,
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
              position: 'relative',
              zIndex: 1,
            }}>
              {/* 캐릭터 플레이스홀더 이모지 */}
              {'\uD83E\uDDD1\u200D\uD83D\uDE80'}
            </div>
            <div style={{
              position: 'absolute',
              bottom: 8,
              right: 12,
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: SK.textMuted,
            }}>
              {tProfile('previewComingSoon')}
            </div>
          </div>

          {/* 닉네임 + 랭크 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}>
            <h2 style={{
              fontFamily: headingFont,
              fontSize: '20px',
              color: SK.textPrimary,
              margin: 0,
              letterSpacing: '0.5px',
            }}>
              {MOCK_PROFILE.name}
            </h2>
            <span style={{
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: SK.gold,
              padding: '2px 10px',
              background: `${SK.gold}15`,
              border: `1px solid ${SK.gold}30`,
              borderRadius: radius.pill,
              letterSpacing: '0.5px',
            }}>
              {MOCK_PROFILE.rank}
            </span>
          </div>

          {/* 팩션 정보 */}
          <div style={{
            fontFamily: bodyFont,
            fontSize: SKFont.sm,
            color: SK.textSecondary,
            marginBottom: 16,
          }}>
            {MOCK_PROFILE.faction} [{MOCK_PROFILE.factionTag}] &mdash; {MOCK_PROFILE.country}
          </div>

          {/* 전적 통계 그리드 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
          }}>
            <StatItem label={tProfile('winRate')} value={`${MOCK_PROFILE.winRate}%`} color={SK.green} />
            <StatItem label={tProfile('avgLevel')} value={String(MOCK_PROFILE.avgLevel)} color={SK.blue} />
            <StatItem label={tProfile('totalBattles')} value={String(MOCK_PROFILE.totalBattles)} color={SK.textPrimary} />
            <StatItem label={tProfile('totalKills')} value={MOCK_PROFILE.totalKills.toLocaleString()} color={SK.red} />
            <StatItem label={tProfile('deaths')} value={String(MOCK_PROFILE.totalDeaths)} color={SK.textMuted} />
            <StatItem label={tProfile('playtime')} value={MOCK_PROFILE.playtime} color={SK.orange} />
          </div>
        </div>

        {/* Wallet 섹션 */}
        <div style={{
          background: SK.cardBg,
          border: sketchBorder(),
          borderRadius: radius.lg,
          padding: 24,
          boxShadow: sketchShadow('md'),
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <h3 style={{
              fontFamily: headingFont,
              fontSize: '16px',
              color: SK.textPrimary,
              margin: 0,
              letterSpacing: '1px',
            }}>
              {tProfile('wallet')}
            </h3>
          </div>

          {/* Wallet Connect Button */}
          <div style={{ marginBottom: 16 }}>
            <WalletConnectButton
              onConnect={handleWalletConnect}
              onDisconnect={handleWalletDisconnect}
            />
          </div>

          {/* 지갑 주소 표시 */}
          {wallet && (
            <div style={{
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: SK.green,
              padding: '8px 12px',
              background: `${SK.green}10`,
              border: `1px solid ${SK.green}30`,
              borderRadius: radius.md,
              marginBottom: 16,
            }}>
              Connected: {wallet.address.slice(0, 10)}...{wallet.address.slice(-6)}
            </div>
          )}

          {/* 토큰 잔고 목록 */}
          {wallet ? (
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: headingFont,
                fontSize: SKFont.sm,
                color: SK.textSecondary,
                letterSpacing: '1px',
                marginBottom: 8,
              }}>
                {tProfile('tokenHoldings')}
              </div>
              <TokenBalanceList
                balances={MOCK_BALANCES}
                onTokenSelect={(iso3) => {
                  window.location.href = `/economy/tokens?country=${iso3}`;
                }}
              />
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: bodyFont,
              fontSize: SKFont.sm,
              color: SK.textMuted,
              textAlign: 'center',
              padding: 24,
            }}>
              {tProfile('connectPrompt')}
            </div>
          )}
        </div>
      </div>

      {/* Achievements 섹션 */}
      <div style={{
        background: SK.cardBg,
        border: sketchBorder(),
        borderRadius: radius.lg,
        padding: 24,
        boxShadow: sketchShadow('md'),
      }}>
        {SERVER_URL ? (
          <Achievements
            serverUrl={SERVER_URL}
            userId="local-user"
          />
        ) : (
          /* Mock 업적 (서버 미연결 시) */
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <h3 style={{
                fontFamily: headingFont,
                fontSize: '18px',
                color: SK.textPrimary,
                margin: 0,
                letterSpacing: '1px',
              }}>
                {tProfile('achievements')}
              </h3>
              <span style={{
                fontFamily: bodyFont,
                fontSize: SKFont.sm,
                color: SK.textSecondary,
              }}>
                4/12 (33%)
              </span>
            </div>

            {/* 진행 바 */}
            <div style={{
              height: 6,
              background: SK.bgWarm,
              borderRadius: radius.pill,
              overflow: 'hidden',
              marginBottom: 20,
            }}>
              <div style={{
                height: '100%',
                width: '33%',
                background: `linear-gradient(90deg, ${SK.blue}, ${SK.green})`,
                borderRadius: radius.pill,
              }} />
            </div>

            {/* Mock 업적 그리드 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 10,
            }}>
              {MOCK_ACHIEVEMENTS.map((ach) => (
                <div
                  key={ach.name}
                  style={{
                    background: ach.unlocked ? `${ach.tierColor}10` : SK.cardBg,
                    border: sketchBorder(ach.unlocked ? `${ach.tierColor}40` : SK.border),
                    borderRadius: radius.md,
                    padding: '12px 14px',
                    opacity: ach.unlocked ? 1 : 0.5,
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{
                    fontSize: 28,
                    lineHeight: 1,
                    flexShrink: 0,
                    filter: ach.unlocked ? 'none' : 'grayscale(100%)',
                  }}>
                    {ach.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 2,
                    }}>
                      <span style={{
                        fontFamily: headingFont,
                        fontSize: SKFont.sm,
                        color: ach.unlocked ? SK.textPrimary : SK.textMuted,
                        fontWeight: 600,
                      }}>
                        {ach.name}
                      </span>
                      <span style={{
                        fontFamily: bodyFont,
                        fontSize: SKFont.xs,
                        color: ach.tierColor,
                        textTransform: 'uppercase',
                        fontWeight: 600,
                      }}>
                        {ach.tier}
                      </span>
                    </div>
                    <div style={{
                      fontFamily: bodyFont,
                      fontSize: SKFont.xs,
                      color: SK.textSecondary,
                    }}>
                      {ach.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Helper Components ---

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: SK.bgWarm,
      borderRadius: radius.md,
      border: sketchBorder(SK.borderDark),
    }}>
      <div style={{
        fontFamily: headingFont,
        fontSize: '16px',
        color,
        marginBottom: 2,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: SK.textMuted,
      }}>
        {label}
      </div>
    </div>
  );
}

// --- Mock Achievements ---

const MOCK_ACHIEVEMENTS = [
  { name: 'First Blood', icon: '\u2694\uFE0F', description: 'Get your first kill in battle', tier: 'bronze', tierColor: '#CD7F32', unlocked: true },
  { name: 'Century Slayer', icon: '\uD83D\uDC80', description: 'Reach 100 total kills', tier: 'silver', tierColor: '#808080', unlocked: true },
  { name: 'Explorer', icon: '\uD83C\uDF0D', description: 'Visit 10 different countries', tier: 'bronze', tierColor: '#CD7F32', unlocked: true },
  { name: 'Iron Will', icon: '\uD83D\uDEE1\uFE0F', description: 'Survive 50 battles', tier: 'gold', tierColor: '#B8860B', unlocked: true },
  { name: 'Season Champion', icon: '\uD83D\uDC51', description: 'Win a season as faction leader', tier: 'platinum', tierColor: '#3B82F6', unlocked: false },
  { name: 'Whale', icon: '\uD83D\uDCB0', description: 'Stake over 1M tokens total', tier: 'gold', tierColor: '#B8860B', unlocked: false },
  { name: 'Master Diplomat', icon: '\uD83E\uDD1D', description: 'Successfully negotiate 5 treaties', tier: 'silver', tierColor: '#808080', unlocked: false },
  { name: 'Speed Demon', icon: '\u26A1', description: 'Reach Level 15 in under 5 minutes', tier: 'gold', tierColor: '#B8860B', unlocked: false },
];
