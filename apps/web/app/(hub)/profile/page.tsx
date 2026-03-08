'use client';

/**
 * /profile — 프로필 페이지
 * DashboardPage + tierColors + mock data 모듈 사용
 */

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, sketchShadow, radius, tierColors, grid } from '@/lib/sketch-ui';
import { DashboardPage } from '@/components/hub';
import { MOCK_PROFILE, MOCK_BALANCES, MOCK_ACHIEVEMENTS } from '@/lib/mock-data';
import { User } from 'lucide-react';
import WalletConnectButton from '@/components/blockchain/WalletConnectButton';
import TokenBalanceList from '@/components/blockchain/TokenBalanceList';
import type { WalletState } from '@/lib/crossx-config';

const Achievements = dynamic(() => import('@/components/profile/Achievements'), {
  loading: () => (
    <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 24, textAlign: 'center' }}>
      …
    </div>
  ),
});

import { getServerUrl } from '@/lib/api-client';

const SERVER_URL = getServerUrl();

const TIER_COLOR_MAP: Record<string, string> = {
  bronze: tierColors.bronze,
  silver: tierColors.silver,
  gold: tierColors.gold,
  platinum: tierColors.platinum,
};

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
    <DashboardPage
      icon={User}
      title={tProfile('title')}
      description={`${MOCK_PROFILE.name} — ${MOCK_PROFILE.faction} [${MOCK_PROFILE.factionTag}]`}
      accentColor={SK.blue}
      maxWidth={960}
    >
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
              {MOCK_PROFILE.name}
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
                4/12 (33%)
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
                width: '33%',
                background: `linear-gradient(90deg, ${SK.blue}, ${SK.green})`,
                borderRadius: 0,
              }} />
            </div>

            {/* Mock 업적 그리드 — tierColors 적용 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: grid.card,
              gap: 10,
            }}>
              {MOCK_ACHIEVEMENTS.map((ach) => {
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
          </div>
        )}
      </div>
    </DashboardPage>
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
