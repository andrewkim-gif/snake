'use client';

/**
 * FieldShop.tsx - v37 Phase 7: 전장 상점 컴포넌트
 *
 * Tab키로 열리는 전장 상점 패널 (React 오버레이).
 * 3개 탭: 소모품(Consumables), 스텟업(Stat Boost), 경제투자(Investment)
 *
 * 기능:
 *  - 아이템 카드: 아이콘 + 이름 + 가격 + 효과 설명 + 구매 버튼
 *  - 인벤토리 표시 (구매 횟수/최대)
 *  - 구매 이펙트 (플래시 애니메이션)
 *  - Match Reward Forecast 패널
 *
 * 디자인: SK 팔레트, Chakra Petch heading, Space Grotesk body, border-radius: 0
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import {
  Heart, Shield, Zap, Sword, ShieldCheck, ChevronsRight,
  Coins, Skull, TrendingUp, X, ShoppingBag,
} from 'lucide-react';
import { SK, headingFont, bodyFont } from '@/lib/sketch-ui';
import {
  SHOP_ITEMS,
  SHOP_CATEGORY_DISPLAY,
  getInflatedPrice,
  type ShopCategory,
  type ShopItemConfig,
} from '@/lib/matrix/config/shop.config';
import type { EconomySnapshot } from '@/lib/matrix/systems/economy';
import BattleStats from './BattleStats';
import type { BattleStatsData } from './BattleStats';

// ============================================
// PLACEHOLDER: Props
// ============================================

export interface FieldShopProps {
  /** 상점 열림 상태 */
  isOpen: boolean;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 경제 스냅샷 */
  economy: EconomySnapshot;
  /** 아이템 구매 콜백 */
  onPurchase: (itemId: string) => void;
  /** 남은 매치 시간 (초) */
  remainingTime: number;
  /** 예상 최종 Gold */
  estimatedFinalGold: number;
  /** 예상 RP */
  estimatedRP: number;
  /** v37 Phase 8: 전투 통계 데이터 (Stats 탭용) */
  battleStats?: BattleStatsData;
}

// ============================================
// Icon Map
// ============================================

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  Heart, Shield, Zap, Sword, ShieldCheck, ChevronsRight,
  Coins, Skull, TrendingUp,
};

function getIcon(name: string) {
  return ICON_MAP[name] ?? Coins;
}

// ============================================
// CSS Keyframes (주입 1회)
// ============================================

const KEYFRAMES_ID = 'field-shop-v37-keyframes';

if (typeof window !== 'undefined' && !document.getElementById(KEYFRAMES_ID)) {
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes shopSlideIn {
      from { opacity: 0; transform: translateX(40px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes shopSlideOut {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(40px); }
    }
    @keyframes shopPurchaseFlash {
      0% { background-color: rgba(245, 158, 11, 0.3); }
      100% { background-color: transparent; }
    }
    @keyframes shopCoinAbsorb {
      0% { opacity: 1; transform: translate(0, 0) scale(1); }
      70% { opacity: 0.7; transform: translate(-20px, -30px) scale(0.6); }
      100% { opacity: 0; transform: translate(-40px, -60px) scale(0.2); }
    }
    @keyframes shopItemEquip {
      0% { box-shadow: inset 0 0 0 0 rgba(245, 158, 11, 0.4); }
      50% { box-shadow: inset 0 0 30px 5px rgba(245, 158, 11, 0.3); }
      100% { box-shadow: inset 0 0 0 0 rgba(245, 158, 11, 0); }
    }
  `;
  document.head.appendChild(style);
}

// ============================================
// 탭 목록
// ============================================

/** Extended tab type including stats */
type FieldShopTab = ShopCategory | 'stats';

const TABS: FieldShopTab[] = ['consumable', 'stat_boost', 'investment', 'stats'];

/** Tab display config — extended for stats tab */
const TAB_DISPLAY: Record<string, { color: string; labelKo: string }> = {
  stats: { color: '#6366F1', labelKo: 'STATS' },
};

// ============================================
// Sub: ShopItemCard
// ============================================

interface ShopItemCardProps {
  item: ShopItemConfig;
  purchaseCount: number;
  currentGold: number;
  onPurchase: (itemId: string) => void;
}

function ShopItemCard({ item, purchaseCount, currentGold, onPurchase }: ShopItemCardProps) {
  const [flashActive, setFlashActive] = useState(false);
  const price = getInflatedPrice(item.basePrice, purchaseCount);
  const canBuy = currentGold >= price && purchaseCount < item.maxStack;
  const maxed = purchaseCount >= item.maxStack;
  const IconComp = getIcon(item.icon);

  const handleBuy = useCallback(() => {
    if (!canBuy) return;
    onPurchase(item.id);
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 500);
  }, [canBuy, item.id, onPurchase]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: flashActive ? undefined : SK.cardBg,
        border: `1px solid ${canBuy ? item.color + '30' : SK.border}`,
        borderRadius: 0,
        opacity: maxed ? 0.4 : canBuy ? 1 : 0.6,
        animation: flashActive ? 'shopPurchaseFlash 0.5s ease-out' : undefined,
        position: 'relative',
        cursor: canBuy ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onClick={handleBuy}
      onMouseEnter={(e) => { if (canBuy) (e.currentTarget.style.background = SK.cardBgHover); }}
      onMouseLeave={(e) => { e.currentTarget.style.background = SK.cardBg; }}
    >
      {/* 좌측 컬러 스트라이프 */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        background: canBuy ? item.color : SK.textMuted,
      }} />

      {/* 아이콘 */}
      <div style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${item.color}15`,
        border: `1px solid ${item.color}30`,
        borderRadius: 0,
        flexShrink: 0,
      }}>
        <IconComp size={16} style={{ color: item.color }} />
      </div>

      {/* 이름 + 설명 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: headingFont,
          fontSize: 12,
          fontWeight: 700,
          color: canBuy ? SK.textPrimary : SK.textMuted,
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.nameKo}
        </div>
        <div style={{
          fontFamily: bodyFont,
          fontSize: 10,
          color: SK.textSecondary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.descriptionKo}
        </div>
      </div>

      {/* 가격 + 구매 횟수 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
        <span style={{
          fontFamily: headingFont,
          fontSize: 12,
          fontWeight: 800,
          color: canBuy ? SK.gold : (maxed ? SK.textMuted : SK.red),
        }}>
          {maxed ? 'MAX' : `${price.toLocaleString()}G`}
        </span>
        <span style={{
          fontFamily: bodyFont,
          fontSize: 9,
          color: SK.textMuted,
        }}>
          {purchaseCount}/{item.maxStack}
        </span>
      </div>

      {/* 구매 버튼 */}
      {!maxed && (
        <button
          onClick={(e) => { e.stopPropagation(); handleBuy(); }}
          disabled={!canBuy}
          style={{
            fontFamily: headingFont,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: canBuy ? SK.bg : SK.textMuted,
            background: canBuy ? item.color : SK.cardBg,
            border: `1px solid ${canBuy ? item.color : SK.border}`,
            borderRadius: 0,
            padding: '4px 10px',
            cursor: canBuy ? 'pointer' : 'not-allowed',
            flexShrink: 0,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          BUY
        </button>
      )}

      {/* 구매 시 코인 흡수 이펙트 */}
      {flashActive && (
        <div style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: SK.gold,
          animation: 'shopCoinAbsorb 0.5s ease-in forwards',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}

// ============================================
// Sub: RewardForecast
// ============================================

interface RewardForecastProps {
  economy: EconomySnapshot;
  remainingTime: number;
  estimatedFinalGold: number;
  estimatedRP: number;
}

function RewardForecast({ economy, remainingTime, estimatedFinalGold, estimatedRP }: RewardForecastProps) {
  const remainMinStr = Math.floor(remainingTime / 60);
  const remainSecStr = String(Math.floor(remainingTime % 60)).padStart(2, '0');

  return (
    <div style={{
      background: SK.cardBg,
      border: `1px solid ${SK.gold}20`,
      borderRadius: 0,
      padding: '10px 14px',
      position: 'relative',
    }}>
      {/* 좌측 골드 스트라이프 */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        background: SK.gold,
      }} />

      <div style={{
        fontFamily: headingFont,
        fontSize: 11,
        fontWeight: 800,
        color: SK.gold,
        letterSpacing: '0.12em',
        marginBottom: 8,
      }}>
        MATCH REWARD FORECAST
      </div>

      {/* 스탯 행들 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <ForecastRow label="Current Gold" value={`${economy.gold.current.toLocaleString()}`} color={SK.gold} />
        <ForecastRow label="Gold/min" value={`${economy.gold.perMinute.toLocaleString()}`} color={SK.textSecondary} />
        <ForecastRow label="Est. Final Gold" value={`~${estimatedFinalGold.toLocaleString()}`} color={SK.textPrimary} />

        <div style={{ borderTop: `1px solid ${SK.border}`, margin: '2px 0' }} />

        <ForecastRow label="Gold → RP Rate" value="1,000 : 1" color={SK.textSecondary} />
        <ForecastRow label="Estimated RP" value={`${estimatedRP.toFixed(2)}`} color={SK.green} />

        <div style={{ borderTop: `1px solid ${SK.border}`, margin: '2px 0' }} />

        <ForecastRow label="Time Left" value={`${remainMinStr}:${remainSecStr}`} color={remainingTime < 60 ? SK.red : SK.textSecondary} />
        <ForecastRow label="Total Earned" value={`${economy.gold.totalEarned.toLocaleString()}`} color={SK.textMuted} />
        <ForecastRow label="Total Spent" value={`${economy.gold.totalSpent.toLocaleString()}`} color={SK.textMuted} />
      </div>
    </div>
  );
}

function ForecastRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontFamily: bodyFont, fontSize: 10, color: SK.textMuted }}>{label}</span>
      <span style={{ fontFamily: headingFont, fontSize: 11, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

function FieldShopInner({
  isOpen,
  onClose,
  economy,
  onPurchase,
  remainingTime,
  estimatedFinalGold,
  estimatedRP,
  battleStats,
}: FieldShopProps) {
  const [activeTab, setActiveTab] = useState<FieldShopTab>('consumable');
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // 1~9 키로 빠른 구매 (stats 탭에서는 비활성)
  useEffect(() => {
    if (!isOpen || activeTab === 'stats') return;
    const handler = (e: KeyboardEvent) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        const items = SHOP_ITEMS.filter(it => it.category === activeTab);
        const item = items[num - 1];
        if (item) {
          onPurchase(item.id);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, activeTab, onPurchase]);

  if (!isOpen) return null;

  const isStatsTab = activeTab === 'stats';
  const tabItems = isStatsTab ? [] : SHOP_ITEMS.filter(it => it.category === activeTab);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 80,
        pointerEvents: 'none',
      }}
    >
      {/* 경고 바 (상단) */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: `linear-gradient(90deg, transparent, ${SK.gold}60, transparent)`,
        pointerEvents: 'none',
      }} />

      {/* 상점 패널 (우측) */}
      <div
        ref={panelRef}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 320,
          background: `${SK.bg}F2`,
          backdropFilter: 'blur(8px)',
          borderLeft: `1px solid ${SK.border}`,
          display: 'flex',
          flexDirection: 'column',
          animation: 'shopSlideIn 0.2s ease-out',
          pointerEvents: 'auto',
          overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: `1px solid ${SK.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={16} style={{ color: SK.gold }} />
            <span style={{
              fontFamily: headingFont,
              fontSize: 14,
              fontWeight: 800,
              color: SK.textPrimary,
              letterSpacing: '0.12em',
            }}>
              FIELD SHOP
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Gold 표시 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Coins size={14} style={{ color: SK.gold }} />
              <span style={{
                fontFamily: headingFont,
                fontSize: 14,
                fontWeight: 800,
                color: SK.gold,
              }}>
                {economy.gold.current.toLocaleString()}
              </span>
            </div>

            {/* 닫기 */}
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: `1px solid ${SK.border}`,
                borderRadius: 0,
                padding: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} style={{ color: SK.textSecondary }} />
            </button>
          </div>
        </div>

        {/* 탭 바 */}
        <div style={{
          display: 'flex',
          borderBottom: `1px solid ${SK.border}`,
          flexShrink: 0,
        }}>
          {TABS.map((tab) => {
            const info = tab === 'stats'
              ? TAB_DISPLAY.stats
              : SHOP_CATEGORY_DISPLAY[tab as ShopCategory];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  fontFamily: headingFont,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: isActive ? info.color : SK.textMuted,
                  background: isActive ? `${info.color}10` : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? `2px solid ${info.color}` : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'color 0.15s, background 0.15s',
                }}
              >
                {info.labelKo}
              </button>
            );
          })}
        </div>

        {/* 아이템 목록 or Stats */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {isStatsTab ? (
            battleStats ? (
              <BattleStats stats={battleStats} compact />
            ) : (
              <div style={{
                fontFamily: bodyFont,
                fontSize: 11,
                color: SK.textMuted,
                textAlign: 'center',
                padding: '20px 0',
              }}>
                No battle data yet
              </div>
            )
          ) : (
            tabItems.map((item) => {
              const purchaseCount = economy.purchases[item.id]?.count ?? 0;
              return (
                <ShopItemCard
                  key={item.id}
                  item={item}
                  purchaseCount={purchaseCount}
                  currentGold={economy.gold.current}
                  onPurchase={onPurchase}
                />
              );
            })
          )}
        </div>

        {/* 보상 예측 위젯 */}
        <div style={{
          flexShrink: 0,
          padding: '8px 10px 12px',
          borderTop: `1px solid ${SK.border}`,
        }}>
          <RewardForecast
            economy={economy}
            remainingTime={remainingTime}
            estimatedFinalGold={estimatedFinalGold}
            estimatedRP={estimatedRP}
          />
        </div>

        {/* TAB 닫기 힌트 */}
        <div style={{
          flexShrink: 0,
          padding: '6px 14px',
          borderTop: `1px solid ${SK.border}`,
          textAlign: 'center',
        }}>
          <span style={{
            fontFamily: bodyFont,
            fontSize: 10,
            color: SK.textMuted,
          }}>
            [TAB] / [ESC] 닫기 &nbsp;&middot;&nbsp; [1-9] 빠른 구매
          </span>
        </div>
      </div>

      {/* 취약 경고 (좌측 하단) */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: `${SK.red}20`,
        border: `1px solid ${SK.red}40`,
        borderRadius: 0,
        pointerEvents: 'none',
        animation: 'milestonePulse 1.5s ease-in-out infinite',
      }}>
        <span style={{
          fontFamily: headingFont,
          fontSize: 11,
          fontWeight: 700,
          color: SK.red,
          letterSpacing: '0.08em',
        }}>
          ⚠ SHOP OPEN — YOU ARE VULNERABLE
        </span>
      </div>
    </div>
  );
}

const FieldShop = memo(FieldShopInner);
export default FieldShop;
