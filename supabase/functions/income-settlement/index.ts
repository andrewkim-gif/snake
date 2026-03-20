/**
 * income-settlement Edge Function
 * 1시간마다 모든 소유 건물 수익 계산 -> Market Cap 가산
 *
 * pg_cron으로 1시간마다 호출:
 *   SELECT cron.schedule('income-settlement', '0 * * * *',
 *     $$ SELECT net.http_post('https://<project>.supabase.co/functions/v1/income-settlement', ...) $$
 *   );
 */

// @ts-nocheck — Deno Edge Function (Supabase runtime)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 경제 상수 (economy.config.ts 미러링)
const RARITY_INCOME_MULT: Record<string, number> = {
  common: 1.0,
  uncommon: 1.5,
  rare: 2.5,
  epic: 5.0,
  legendary: 10.0,
};

const LEVEL_MULT = [1.0, 1.3, 1.7, 2.2, 3.0];
const MAINTENANCE_RATE = 0.10;
const DEPRECIATION_WEEKLY_RATE = 0.02;
const MAX_DEPRECIATION = 0.50;
const REGION_SATURATION_THRESHOLD = 5;
const SATURATION_PENALTY_PER_EXTRA = 0.05;
const MAX_SATURATION_PENALTY = 0.50;

interface OwnedBuilding {
  building_id: string;
  owner_id: string;
  purchased_at: string;
  building: {
    id: string;
    name: string;
    rarity: string;
    level: number;
    base_income: number;
    region_code: string;
  };
}

serve(async (req: Request) => {
  try {
    // Supabase 서비스 키로 admin 클라이언트 생성
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const periodStart = new Date(now.getTime() - 3600000); // 1시간 전
    const periodEnd = now;

    // 1) 모든 활성 소유 건물 조회
    const { data: ownerships, error: fetchError } = await supabase
      .from('tycoon_ownership')
      .select(`
        building_id, owner_id, purchased_at,
        building:tycoon_buildings!inner(id, name, rarity, level, base_income, region_code)
      `)
      .eq('is_active', true);

    if (fetchError) {
      throw new Error(`Fetch ownerships failed: ${fetchError.message}`);
    }

    if (!ownerships || ownerships.length === 0) {
      return new Response(JSON.stringify({ settled: 0, message: 'No owned buildings' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2) 유저별 건물 그룹핑 + 지역별 카운트
    const userBuildings = new Map<string, OwnedBuilding[]>();
    for (const o of ownerships as OwnedBuilding[]) {
      if (!userBuildings.has(o.owner_id)) {
        userBuildings.set(o.owner_id, []);
      }
      userBuildings.get(o.owner_id)!.push(o);
    }

    const incomeLogEntries: Array<{
      user_id: string;
      building_id: string;
      amount: number;
      period_start: string;
      period_end: string;
    }> = [];

    const userTotals = new Map<string, number>();

    // 3) 유저별 수익 계산
    for (const [userId, buildings] of userBuildings) {
      // 지역별 건물 수 (포화도)
      const regionCounts = new Map<string, number>();
      for (const ob of buildings) {
        const rc = ob.building.region_code;
        regionCounts.set(rc, (regionCounts.get(rc) ?? 0) + 1);
      }

      let userTotal = 0;

      for (const ob of buildings) {
        const b = ob.building;
        const level = b.level ?? 1;
        const levelMult = LEVEL_MULT[level - 1] ?? 1.0;
        const rarityMult = RARITY_INCOME_MULT[b.rarity] ?? 1.0;

        // 포화 패널티
        const regionCount = regionCounts.get(b.region_code) ?? 0;
        const excess = Math.max(0, regionCount - REGION_SATURATION_THRESHOLD);
        const satPenalty = Math.min(excess * SATURATION_PENALTY_PER_EXTRA, MAX_SATURATION_PENALTY);
        const satMult = 1 - satPenalty;

        // 감가상각
        const purchasedAt = new Date(ob.purchased_at);
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        const weeks = Math.floor((now.getTime() - purchasedAt.getTime()) / msPerWeek);
        const depRate = Math.min(Math.max(0, weeks) * DEPRECIATION_WEEKLY_RATE, MAX_DEPRECIATION);

        // 총수익
        const grossIncome = Math.round(b.base_income * rarityMult * levelMult * satMult);
        const maintenance = Math.round(grossIncome * MAINTENANCE_RATE);
        const depreciation = Math.round(grossIncome * depRate);
        const netIncome = Math.max(0, grossIncome - maintenance - depreciation);

        if (netIncome > 0) {
          incomeLogEntries.push({
            user_id: userId,
            building_id: b.id,
            amount: netIncome,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
          });
          userTotal += netIncome;
        }
      }

      if (userTotal > 0) {
        userTotals.set(userId, userTotal);
      }
    }

    // 4) tycoon_income_log에 기록
    if (incomeLogEntries.length > 0) {
      const { error: logError } = await supabase
        .from('tycoon_income_log')
        .insert(incomeLogEntries);

      if (logError) {
        console.error('Income log insert failed:', logError.message);
      }
    }

    // 5) 유저별 Market Cap 가산 + player_stats 업데이트
    let settledCount = 0;
    for (const [userId, totalIncome] of userTotals) {
      // game_saves.total_market_cap 업데이트 (RPC 사용 권장, 여기선 직접 업데이트)
      const { data: currentSave } = await supabase
        .from('game_saves')
        .select('total_market_cap')
        .eq('user_id', userId)
        .single();

      if (currentSave) {
        const newCap = (currentSave.total_market_cap ?? 0) + totalIncome;
        await supabase
          .from('game_saves')
          .update({ total_market_cap: newCap })
          .eq('user_id', userId);
      }

      // tycoon_player_stats 업데이트
      const userBldgs = userBuildings.get(userId) ?? [];
      const portfolioValue = userBldgs.reduce((sum, ob) => {
        const b = ob.building;
        const lm = LEVEL_MULT[(b.level ?? 1) - 1] ?? 1.0;
        const rm = RARITY_INCOME_MULT[b.rarity] ?? 1.0;
        return sum + Math.round(b.base_income * 10 * lm * rm);
      }, 0);

      await supabase
        .from('tycoon_player_stats')
        .upsert({
          user_id: userId,
          portfolio_value: portfolioValue,
          total_income: totalIncome,
          building_count: userBldgs.length,
          highest_rarity: getHighestRarity(userBldgs.map((ob) => ob.building.rarity)),
        }, { onConflict: 'user_id' });

      settledCount++;
    }

    return new Response(
      JSON.stringify({
        settled: settledCount,
        totalBuildings: incomeLogEntries.length,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Income settlement error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

function getHighestRarity(rarities: string[]): string {
  const order = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  let highest = 'common';
  for (const r of rarities) {
    if (order.indexOf(r) > order.indexOf(highest)) {
      highest = r;
    }
  }
  return highest;
}
