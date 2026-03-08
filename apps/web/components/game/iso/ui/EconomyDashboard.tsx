'use client';

/**
 * v26 Phase 4 — Economy Dashboard
 * 중앙 오버레이: GDP, 수입/지출, 무역수지, 인구 통계
 * 다크 전술 패널 + 바 차트 시각화
 */

import { useCityStore } from '@/stores/cityStore';
import { SK, bodyFont, headingFont, sketchShadow } from '@/lib/sketch-ui';

/** 숫자 포맷 */
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.floor(n).toLocaleString();
}

/** 수평 바 차트 행 */
function BarRow({
  label,
  value,
  maxValue,
  color,
  suffix = '',
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  suffix?: string;
}) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '2px',
      }}>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '10px',
          color: SK.textSecondary,
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '10px',
          fontWeight: 700,
          color,
        }}>
          {fmt(value)}{suffix}
        </span>
      </div>
      <div style={{
        width: '100%',
        height: '4px',
        background: 'rgba(255,255,255,0.06)',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          transition: 'width 300ms ease',
        }} />
      </div>
    </div>
  );
}

/** 통계 카드 */
function StatCard({
  label,
  value,
  subValue,
  color,
  icon,
}: {
  label: string;
  value: string;
  subValue?: string;
  color: string;
  icon: string;
}) {
  return (
    <div style={{
      padding: '8px 10px',
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${SK.glassBorder}`,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginBottom: '4px',
      }}>
        <span style={{ fontSize: '12px' }}>{icon}</span>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '9px',
          color: SK.textMuted,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontFamily: bodyFont,
        fontSize: '18px',
        fontWeight: 700,
        color,
      }}>
        {value}
      </div>
      {subValue && (
        <div style={{
          fontFamily: bodyFont,
          fontSize: '9px',
          color: SK.textMuted,
          marginTop: '2px',
        }}>
          {subValue}
        </div>
      )}
    </div>
  );
}

interface EconomyDashboardProps {
  onClose: () => void;
}

export function EconomyDashboard({ onClose }: EconomyDashboardProps) {
  const treasury = useCityStore(s => s.treasury);
  const gdp = useCityStore(s => s.gdp);
  const population = useCityStore(s => s.population);
  const happiness = useCityStore(s => s.happiness);
  const employed = useCityStore(s => s.employed);
  const unemployed = useCityStore(s => s.unemployed);
  const powerGen = useCityStore(s => s.powerGen);
  const powerUse = useCityStore(s => s.powerUse);
  const taxRate = useCityStore(s => s.taxRate);
  const economyStats = useCityStore(s => s.economyStats);
  const tradeRoutes = useCityStore(s => s.tradeRoutes);
  const serverBuildings = useCityStore(s => s.serverBuildings);

  // 무역 수지 계산
  const tradeBalance = (economyStats?.tradeIncome ?? 0) - (economyStats?.tradeExpense ?? 0);
  const activeTradeRoutes = tradeRoutes.filter(r => r.active).length;

  // 건물 통계
  const totalBuildings = serverBuildings.length;
  const activeBuildings = serverBuildings.filter(b => b.enabled && !b.underConstruction).length;
  const constructing = serverBuildings.filter(b => b.underConstruction).length;

  // 경제 바 차트 최대값 (정규화용)
  const incomeMax = Math.max(
    economyStats?.productionValue ?? 1,
    economyStats?.taxCollected ?? 1,
    economyStats?.tradeIncome ?? 1,
    economyStats?.wagesPaid ?? 1,
    economyStats?.maintenancePaid ?? 1,
    economyStats?.tradeExpense ?? 1,
    1,
  );

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '520px',
      maxHeight: '80vh',
      background: 'rgba(9, 9, 11, 0.95)',
      backdropFilter: 'blur(16px)',
      border: `1px solid ${SK.glassBorder}`,
      boxShadow: sketchShadow('lg'),
      zIndex: 50,
      pointerEvents: 'auto',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: `1px solid ${SK.glassBorder}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '4px',
            height: '20px',
            background: SK.gold,
          }} />
          <span style={{
            fontFamily: headingFont,
            fontSize: '16px',
            fontWeight: 700,
            color: SK.textPrimary,
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            Economy Dashboard
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: SK.textMuted,
            fontSize: '18px',
            cursor: 'pointer',
            padding: '4px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
      }}>
        {/* 핵심 통계 그리드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: '8px',
          marginBottom: '16px',
        }}>
          <StatCard
            label="GDP"
            value={`$${fmt(gdp)}`}
            icon="📊"
            color={SK.gold}
          />
          <StatCard
            label="Treasury"
            value={`$${fmt(treasury)}`}
            icon="💰"
            color={SK.orange}
          />
          <StatCard
            label="Population"
            value={fmt(population)}
            subValue={`${employed} employed`}
            icon="👥"
            color={SK.blue}
          />
          <StatCard
            label="Happiness"
            value={`${happiness.toFixed(0)}%`}
            icon="❤️"
            color={happiness >= 70 ? SK.green : happiness >= 40 ? SK.orange : SK.red}
          />
        </div>

        {/* 수입/지출 섹션 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '16px',
        }}>
          {/* 수입 */}
          <div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.green,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '8px',
              paddingBottom: '4px',
              borderBottom: `1px solid rgba(16, 185, 129, 0.2)`,
            }}>
              Income
            </div>
            <BarRow
              label="Production Value"
              value={economyStats?.productionValue ?? 0}
              maxValue={incomeMax}
              color={SK.green}
            />
            <BarRow
              label="Tax Revenue"
              value={economyStats?.taxCollected ?? 0}
              maxValue={incomeMax}
              color={SK.greenLight}
              suffix={` (${(taxRate * 100).toFixed(0)}%)`}
            />
            <BarRow
              label="Trade Income"
              value={economyStats?.tradeIncome ?? 0}
              maxValue={incomeMax}
              color="#34D399"
            />
          </div>

          {/* 지출 */}
          <div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.red,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '8px',
              paddingBottom: '4px',
              borderBottom: `1px solid rgba(239, 68, 68, 0.2)`,
            }}>
              Expenses
            </div>
            <BarRow
              label="Wages"
              value={economyStats?.wagesPaid ?? 0}
              maxValue={incomeMax}
              color={SK.red}
            />
            <BarRow
              label="Maintenance"
              value={economyStats?.maintenancePaid ?? 0}
              maxValue={incomeMax}
              color={SK.redLight}
            />
            <BarRow
              label="Trade Expense"
              value={economyStats?.tradeExpense ?? 0}
              maxValue={incomeMax}
              color="#F87171"
            />
          </div>
        </div>

        {/* 인프라 통계 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '8px',
          marginBottom: '16px',
        }}>
          {/* 전력 */}
          <div style={{
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${SK.glassBorder}`,
          }}>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              color: SK.textMuted,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}>
              Power Grid
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '14px',
              fontWeight: 700,
              color: powerGen >= powerUse ? SK.green : SK.red,
            }}>
              {fmt(powerGen - powerUse)} surplus
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              color: SK.textMuted,
              marginTop: '2px',
            }}>
              {fmt(powerUse)} / {fmt(powerGen)} capacity
            </div>
            {/* 전력 바 */}
            <div style={{
              width: '100%',
              height: '4px',
              background: 'rgba(255,255,255,0.06)',
              marginTop: '4px',
            }}>
              <div style={{
                width: `${powerGen > 0 ? Math.min((powerUse / powerGen) * 100, 100) : 0}%`,
                height: '100%',
                background: powerUse / Math.max(powerGen, 1) > 0.9 ? SK.red : SK.green,
                transition: 'width 300ms ease',
              }} />
            </div>
          </div>

          {/* 고용 */}
          <div style={{
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${SK.glassBorder}`,
          }}>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              color: SK.textMuted,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}>
              Employment
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '14px',
              fontWeight: 700,
              color: unemployed === 0 ? SK.green : SK.orange,
            }}>
              {population > 0 ? ((employed / population) * 100).toFixed(0) : 0}%
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              color: SK.textMuted,
              marginTop: '2px',
            }}>
              {employed} employed / {unemployed} idle
            </div>
            <div style={{
              width: '100%',
              height: '4px',
              background: 'rgba(255,255,255,0.06)',
              marginTop: '4px',
            }}>
              <div style={{
                width: `${population > 0 ? (employed / population) * 100 : 0}%`,
                height: '100%',
                background: SK.blue,
                transition: 'width 300ms ease',
              }} />
            </div>
          </div>

          {/* 무역 */}
          <div style={{
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${SK.glassBorder}`,
          }}>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              color: SK.textMuted,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}>
              Trade Balance
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '14px',
              fontWeight: 700,
              color: tradeBalance >= 0 ? SK.green : SK.red,
            }}>
              {tradeBalance >= 0 ? '+' : ''}{fmt(tradeBalance)}
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              color: SK.textMuted,
              marginTop: '2px',
            }}>
              {activeTradeRoutes} active routes
            </div>
          </div>
        </div>

        {/* 건물 통계 */}
        <div style={{
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${SK.glassBorder}`,
        }}>
          <div style={{
            fontFamily: bodyFont,
            fontSize: '9px',
            color: SK.textMuted,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}>
            Buildings
          </div>
          <div style={{
            display: 'flex',
            gap: '16px',
          }}>
            <div>
              <span style={{ fontFamily: bodyFont, fontSize: '14px', fontWeight: 700, color: SK.textPrimary }}>
                {totalBuildings}
              </span>
              <span style={{ fontFamily: bodyFont, fontSize: '9px', color: SK.textMuted, marginLeft: '4px' }}>
                total
              </span>
            </div>
            <div>
              <span style={{ fontFamily: bodyFont, fontSize: '14px', fontWeight: 700, color: SK.green }}>
                {activeBuildings}
              </span>
              <span style={{ fontFamily: bodyFont, fontSize: '9px', color: SK.textMuted, marginLeft: '4px' }}>
                active
              </span>
            </div>
            {constructing > 0 && (
              <div>
                <span style={{ fontFamily: bodyFont, fontSize: '14px', fontWeight: 700, color: SK.orange }}>
                  {constructing}
                </span>
                <span style={{ fontFamily: bodyFont, fontSize: '9px', color: SK.textMuted, marginLeft: '4px' }}>
                  building
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 식량 만족도 */}
        {economyStats && (
          <div style={{
            marginTop: '8px',
            padding: '6px 12px',
            background: economyStats.foodSatisfaction >= 0.8
              ? 'rgba(16, 185, 129, 0.08)'
              : economyStats.foodSatisfaction >= 0.5
                ? 'rgba(245, 158, 11, 0.08)'
                : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${SK.glassBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.textSecondary,
            }}>
              Food Satisfaction
            </span>
            <span style={{
              fontFamily: bodyFont,
              fontSize: '12px',
              fontWeight: 700,
              color: economyStats.foodSatisfaction >= 0.8 ? SK.green
                : economyStats.foodSatisfaction >= 0.5 ? SK.orange : SK.red,
            }}>
              {(economyStats.foodSatisfaction * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
