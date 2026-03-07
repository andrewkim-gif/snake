/**
 * Economy mock data — 토큰 이코노미
 */

const COUNTRIES = [
  'USA','CHN','RUS','IND','BRA','JPN','DEU','GBR',
  'KOR','FRA','CAN','AUS','SAU','TUR','IDN','MEX','ITA','ESP',
  'IRN','EGY','PAK','NGA','ISR','POL','ZAF','UKR','NLD','SWE',
  'THA','ARG','COL','MYS','PHL','VNM','BGD','NOR','CHE','AUT',
  'BEL','CHL','PER','VEN','IRQ','KWT','ARE','QAT','SGP','FIN',
  'DNK','IRL','PRT','GRC','CZE','ROU','NZL','KAZ','ETH','DZA',
  'MAR','KEN','MMR','TWN','HUN','PRK','CUB','LBY','AGO','COD',
];

const TIERS = [
  { tier: 'S', count: 8, supply: 50e6, baseCap: 500000 },
  { tier: 'A', count: 20, supply: 30e6, baseCap: 100000 },
  { tier: 'B', count: 40, supply: 20e6, baseCap: 30000 },
  { tier: 'C', count: 68, supply: 10e6, baseCap: 5000 },
  { tier: 'D', count: 59, supply: 5e6, baseCap: 1000 },
];

export function generateMockData() {
  const marketCapData: Array<{
    iso3: string;
    name: string;
    tier: string;
    marketCap: number;
    change24h: number;
    defenseMultiplier: number;
  }> = [];
  const stakingData: Array<{
    iso3: string;
    name: string;
    totalStaked: number;
    totalSupply: number;
    apr: number;
    stakingRatio: number;
  }> = [];
  let idx = 0;

  for (const t of TIERS) {
    for (let i = 0; i < Math.min(t.count, 15); i++) {
      const iso3 = COUNTRIES[idx] || `C${String(idx).padStart(3, '0')}`;
      const cap = t.baseCap * (1 + Math.random() * 3);
      const change = (Math.random() - 0.4) * 20;
      const mult = cap >= 1e8 ? 50000 : cap >= 1e7 ? 30000 : cap >= 1e6 ? 20000 :
                   cap >= 1e5 ? 15000 : cap >= 1e4 ? 12000 : 10000;

      marketCapData.push({
        iso3,
        name: `${iso3} Nation`,
        tier: t.tier,
        marketCap: cap,
        change24h: change,
        defenseMultiplier: mult,
      });

      const stakeRatio = 5 + Math.random() * 25;
      stakingData.push({
        iso3,
        name: `${iso3} Nation`,
        totalStaked: t.supply * (stakeRatio / 100),
        totalSupply: t.supply,
        apr: 500 + Math.floor(Math.random() * 2000),
        stakingRatio: stakeRatio,
      });

      idx++;
    }
  }

  const buybacks = Array.from({ length: 20 }, (_, i) => ({
    iso3: COUNTRIES[i % COUNTRIES.length],
    gdpTaxAmount: 100 + Math.random() * 500,
    tokensReceived: 5000 + Math.random() * 50000,
    timestamp: Math.floor(Date.now() / 1000) - i * 300,
  }));

  const burns = Array.from({ length: 8 }, (_, i) => ({
    iso3: COUNTRIES[i * 3 % COUNTRIES.length],
    amount: 1000 + Math.random() * 10000,
    reason: i % 2 === 0 ? 'war_victory' : 'deflation',
    timestamp: Math.floor(Date.now() / 1000) - i * 1800,
  }));

  return { marketCapData, stakingData, buybacks, burns };
}
