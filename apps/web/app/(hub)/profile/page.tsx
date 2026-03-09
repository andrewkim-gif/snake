'use client';

/**
 * /profile --- 프로필 페이지
 * DashboardPage + tierColors + API 데이터 (서버 연동)
 */

import { useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, sketchShadow, radius, tierColors, grid } from '@/lib/sketch-ui';
import { User } from 'lucide-react';
import WalletConnectButton from '@/components/blockchain/WalletConnectButton';
import TokenBalanceList from '@/components/blockchain/TokenBalanceList';
import type { WalletState, TokenBalance } from '@/lib/crossx-config';
import { useWalletStore } from '@/stores/wallet-store';

import {
  fetchPlayerAccount,
  fetchPlayerAchievements,
  fetchGdpData,
  fetchCountries,
  fetchRewards,
  getServerUrl,
  isServerAvailable,
} from '@/lib/api-client';
import type { PlayerAccount, PlayerAchievement, GdpEntry, CountryEconomy, TokenReward } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { ServerRequired } from '@/components/ui/ServerRequired';

const Achievements = dynamic(() => import('@/components/profile/Achievements'), {
  loading: () => (
    <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 24, textAlign: 'center' }}>
      ...
    </div>
  ),
});

const SERVER_URL = getServerUrl();

const TIER_COLOR_MAP: Record<string, string> = {
  bronze: tierColors.bronze,
  silver: tierColors.silver,
  gold: tierColors.gold,
  platinum: tierColors.platinum,
};

// 기본 프로필 (서버 데이터 없을 때 폴백)
const DEFAULT_PROFILE = {
  name: 'Agent',
  level: 1,
  winRate: 0,
  avgLevel: 1,
  totalBattles: 0,
  totalKills: 0,
  totalDeaths: 0,
  playtime: 0,
  faction: 'Unaffiliated',
  factionTag: '---',
  country: '---',
  rank: 0,
  xp: 0,
  nextLevelXp: 100,
};

function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function ProfilePage() {
  const tProfile = useTranslations('profile');
  const walletStore = useWalletStore();
  const wallet: WalletState | null = walletStore.isConnected
    ? { connected: true, address: walletStore.address, chainId: walletStore.chainId, balance: '0' }
    : null;

  const { data: account, loading: accountLoading } = useApiData(
    () => fetchPlayerAccount('local-user'),
  );
  const { data: achievements, loading: achievementsLoading } = useApiData(
    () => fetchPlayerAchievements('local-user'),
  );
  const { data: gdpData } = useApiData(() => fetchGdpData());
  const { data: countries } = useApiData(() => fetchCountries());

  // v30 Task 2-6/2-7: 토큰 보상 이력 (playerId = wallet address 또는 서버 할당 ID)
  const playerId = walletStore.isConnected ? walletStore.address : 'local-user';
  const { data: rewardHistory } = useApiData(
    () => fetchRewards(playerId, 20),
    { refreshInterval: 30000 },
  );

  const profile = account || DEFAULT_PROFILE;

  // GDP/countries 데이터를 조합하여 토큰 잔액 생성
  const balances: TokenBalance[] = useMemo(() => {
    return (countries || []).slice(0, 4).map((c) => ({
      iso3: c.iso3,
      name: `${c.iso3} Token`,
      symbol: `$${c.iso3}`,
      balance: '0',
      stakedBalance: '0',
      pendingReward: '0',
      tier: 'C',
      marketCap: c.gdp || 0,
      defenseMultiplier: 1.0,
      stakingAPR: 5.0,
    }));
  }, [countries]);

  // achievements 데이터 (null-safe)
  const achievementList = achievements || [];

  const handleWalletConnect = useCallback((_address: string) => {
    // zustand 스토어가 자동으로 상태를 업데이트합니다
  }, []);

  const handleWalletDisconnect = useCallback(() => {
    // zustand 스토어가 자동으로 상태를 업데이트합니다
  }, []);

  // 로딩 스피너
  if (accountLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: SK.bg,
          color: SK.textPrimary,
          fontFamily: bodyFont,
          padding: 24,
        }}
      >
        <header style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontFamily: headingFont,
              fontSize: SKFont.h1,
              color: SK.gold,
              margin: 0,
            }}
          >
            Profile
          </h1>
          <p style={{ color: SK.textSecondary, fontSize: SKFont.sm, marginTop: 4 }}>...</p>
        </header>
        <main>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '40vh',
            color: SK.textSecondary,
            fontFamily: bodyFont,
            fontSize: SKFont.sm,
          }}>
            Loading profile...
          </div>
        </main>
      </div>
    );
  }

  return (
    <ServerRequired>
      <div
        style={{
          minHeight: "100vh",
          background: SK.bg,
          color: SK.textPrimary,
          fontFamily: bodyFont,
          padding: 24,
        }}
      >
        {/* Header */}
        <header style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontFamily: headingFont,
              fontSize: SKFont.h1,
              color: SK.gold,
              margin: 0,
            }}
          >
            Profile
          </h1>
          <p style={{ color: SK.textSecondary, fontSize: SKFont.sm, marginTop: 4 }}>
            {profile.name} — {profile.faction} [{profile.factionTag}]
          </p>
        </header>

        {/* Tab content */}
        <main>
        {/* Agent Card + Wallet 섹션 (2-column) --- 반응형 */}
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
            borderRadius: 0,
            padding: 24,
            boxShadow: sketchShadow('md'),
          }}>
            {/* 3D 캐릭터 프리뷰 (플레이스홀더) */}
            <div style={{
              width: '100%',
              height: 180,
              background: SK.bgWarm,
              borderRadius: 0,
              border: sketchBorder(SK.borderDark),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              position: 'relative',
              overflow: 'hidden',
            }}>
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
                {profile.name}
              </h2>
              <span style={{
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                color: SK.gold,
                padding: '2px 10px',
                background: `${SK.gold}15`,
                border: `1px solid ${SK.gold}30`,
                borderRadius: 0,
                letterSpacing: '0.5px',
              }}>
                {typeof profile.rank === 'number' ? `Rank #${profile.rank}` : profile.rank}
              </span>
            </div>

            {/* 팩션 정보 */}
            <div style={{
              fontFamily: bodyFont,
              fontSize: SKFont.sm,
              color: SK.textSecondary,
              marginBottom: 16,
            }}>
              {profile.faction} [{profile.factionTag}] &mdash; {profile.country}
            </div>

            {/* 전적 통계 그리드 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
            }}>
              <StatItem label={tProfile('winRate')} value={`${profile.winRate}%`} color={SK.green} />
              <StatItem label={tProfile('avgLevel')} value={String(profile.avgLevel)} color={SK.blue} />
              <StatItem label={tProfile('totalBattles')} value={String(profile.totalBattles)} color={SK.textPrimary} />
              <StatItem label={tProfile('totalKills')} value={profile.totalKills.toLocaleString()} color={SK.red} />
              <StatItem label={tProfile('deaths')} value={String(profile.totalDeaths)} color={SK.textMuted} />
              <StatItem label={tProfile('playtime')} value={typeof profile.playtime === 'number' ? formatPlaytime(profile.playtime) : String(profile.playtime)} color={SK.orange} />
            </div>
          </div>

          {/* Wallet 섹션 */}
          <div style={{
            background: SK.cardBg,
            border: sketchBorder(),
            borderRadius: 0,
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

            <div style={{ marginBottom: 16 }}>
              <WalletConnectButton
                onConnect={handleWalletConnect}
                onDisconnect={handleWalletDisconnect}
              />
            </div>

            {wallet && (
              <div style={{
                fontFamily: bodyFont,
                fontSize: SKFont.xs,
                color: SK.green,
                padding: '8px 12px',
                background: `${SK.green}10`,
                border: `1px solid ${SK.green}30`,
                borderRadius: 0,
                marginBottom: 16,
              }}>
                {tProfile('connected')} {wallet.address.slice(0, 10)}...{wallet.address.slice(-6)}
              </div>
            )}

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
                  balances={balances}
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

        {/* v30 Task 2-6: Token Reward History */}
        <div style={{
          background: SK.cardBg,
          border: sketchBorder(),
          borderRadius: 0,
          padding: 24,
          boxShadow: sketchShadow('md'),
          marginBottom: 16,
        }}>
          <h3 style={{
            fontFamily: headingFont,
            fontSize: '16px',
            color: SK.textPrimary,
            margin: 0,
            marginBottom: 16,
            letterSpacing: '1px',
          }}>
            {tProfile('rewardHistory') ?? 'Token Reward History'}
          </h3>

          {rewardHistory && rewardHistory.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
              {rewardHistory.map((reward: TokenReward, idx: number) => {
                const date = new Date(reward.timestamp);
                const dateStr = date.toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                });
                const typeColor = reward.rewardType === 'domination' ? SK.gold
                  : reward.rewardType === 'hegemony' ? SK.blue
                  : reward.rewardType === 'sovereignty' ? SK.green
                  : SK.orange;
                return (
                  <div key={reward.id || idx} style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 80px 1fr auto',
                    gap: '8px',
                    alignItems: 'center',
                    padding: '6px 10px',
                    background: SK.bgWarm,
                    borderLeft: `3px solid ${typeColor}`,
                    borderRadius: 0,
                  }}>
                    <span style={{ fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.textMuted }}>{dateStr}</span>
                    <span style={{
                      fontFamily: bodyFont,
                      fontSize: '10px',
                      fontWeight: 700,
                      color: typeColor,
                      textTransform: 'uppercase',
                    }}>
                      {reward.rewardType}
                    </span>
                    <span style={{ fontFamily: bodyFont, fontSize: SKFont.xs, color: SK.textSecondary }}>
                      {reward.reason?.slice(0, 40) || `${reward.tokenType} reward`}
                    </span>
                    <span style={{
                      fontFamily: headingFont,
                      fontSize: '13px',
                      fontWeight: 700,
                      color: SK.green,
                    }}>
                      +{reward.amount.toFixed(1)} ${reward.tokenType}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              fontFamily: bodyFont,
              fontSize: SKFont.sm,
              color: SK.textMuted,
              textAlign: 'center',
              padding: 24,
            }}>
              {tProfile('noRewards') ?? 'No token rewards yet. Play to earn!'}
            </div>
          )}
        </div>

        {/* Achievements 섹션 */}
        <div style={{
          background: SK.cardBg,
          border: sketchBorder(),
          borderRadius: 0,
          padding: 24,
          boxShadow: sketchShadow('md'),
        }}>
          {SERVER_URL ? (
            <Achievements
              serverUrl={SERVER_URL}
              userId="local-user"
            />
          ) : (
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
                  {achievementList.length > 0
                    ? `${achievementList.filter(a => a.unlocked).length}/${achievementList.length} (${Math.round((achievementList.filter(a => a.unlocked).length / achievementList.length) * 100)}%)`
                    : '0/0 (0%)'
                  }
                </span>
              </div>

              {/* 진행 바 */}
              <div style={{
                height: 6,
                background: SK.bgWarm,
                borderRadius: 0,
                overflow: 'hidden',
                marginBottom: 20,
              }}>
                <div style={{
                  height: '100%',
                  width: achievementList.length > 0
                    ? `${Math.round((achievementList.filter(a => a.unlocked).length / achievementList.length) * 100)}%`
                    : '0%',
                  background: `linear-gradient(90deg, ${SK.blue}, ${SK.green})`,
                  borderRadius: 0,
                }} />
              </div>

              {/* 업적 그리드 --- tierColors 적용 */}
              {achievementList.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: grid.card,
                  gap: 10,
                }}>
                  {achievementList.map((ach) => {
                    const color = TIER_COLOR_MAP[ach.tier] ?? ach.tierColor;
                    return (
                      <div
                        key={ach.name}
                        style={{
                          background: ach.unlocked ? `${color}10` : SK.cardBg,
                          border: sketchBorder(ach.unlocked ? `${color}40` : SK.border),
                          borderRadius: 0,
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
                              color,
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
                    );
                  })}
                </div>
              ) : (
                <div style={{
                  color: SK.textMuted,
                  fontFamily: bodyFont,
                  fontSize: SKFont.sm,
                  textAlign: 'center',
                  padding: 24,
                }}>
                  No achievements data available.
                </div>
              )}
            </div>
          )}
        </div>
        </main>
      </div>
    </ServerRequired>
  );
}

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: SK.bgWarm,
      borderRadius: 0,
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
