/**
 * auction-scheduler - Supabase Edge Function
 * 경매 자동 생성 및 종료 처리
 *
 * Phase 2: S15 구현
 * - 소유자 없는 건물 중 5~10개 랜덤 선택하여 경매 생성
 * - 일반 경매 4시간 주기
 * - 경매 종료 처리 (낙찰/유찰)
 * - 유찰 시 시작가 -10% 후 재등록
 *
 * 배포: supabase functions deploy auction-scheduler
 * 스케줄: pg_cron으로 4시간마다 실행 또는 Vercel cron
 *
 * 참고: 이 파일은 Supabase CLI 배포용으로 작성됨.
 * 로컬에서는 app_ingame/tycoon/engine/AuctionEngine.ts의
 * createScheduledAuctions() 메서드를 직접 호출하여 동일 동작 수행.
 */

// Deno 환경 (Supabase Edge Functions)
// @ts-ignore - Deno imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// 경매 설정 상수
const AUCTION_DURATION_MS = 4 * 60 * 60 * 1000; // 4시간
const MIN_AUCTIONS = 5;
const MAX_AUCTIONS = 10;
const STARTING_BID_MIN_PCT = 0.3; // fair value의 30%
const STARTING_BID_MAX_PCT = 0.5; // fair value의 50%
const FAILED_DISCOUNT = 0.10; // 유찰 할인 10%
const NPC_MIN = 2;
const NPC_MAX = 5;
const NPC_FAIR_VALUE_MIN = 0.6;
const NPC_FAIR_VALUE_MAX = 0.8;

// 등급별 가치 배수
const RARITY_VALUE_MULT: Record<string, number> = {
  common: 1.0,
  uncommon: 1.5,
  rare: 2.5,
  epic: 5.0,
  legendary: 12.0,
};

// 레벨별 수익 배수
const LEVEL_MULT: Record<number, number> = {
  1: 1.0, 2: 1.3, 3: 1.7, 4: 2.2, 5: 3.0,
};

// NPC 이름 풀
const NPC_NAMES = [
  'NPC_Warren', 'NPC_Soros', 'NPC_Lynch', 'NPC_Buffett',
  'NPC_Dalio', 'NPC_Ackman', 'NPC_Icahn', 'NPC_Tudor',
];

interface IBuilding {
  id: string;
  base_income: number;
  rarity: string;
  level: number;
}

/** fair value 계산: hourly_income x 24 x rarity_mult */
function calculateFairValue(building: IBuilding): number {
  const levelMult = LEVEL_MULT[building.level] ?? 1.0;
  const hourlyIncome = building.base_income * levelMult;
  const rarityMult = RARITY_VALUE_MULT[building.rarity] ?? 1.0;
  return Math.round(hourlyIncome * 24 * rarityMult);
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

serve(async (req: Request) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ─── Step 1: 종료된 경매 정산 ────────────────────────
    const now = new Date().toISOString();
    const { data: expiredAuctions } = await supabase
      .from('tycoon_auctions')
      .select('id, building_id, current_bid, winner_id, starting_bid, type')
      .eq('status', 'active')
      .lte('end_at', now);

    const settlements: Array<{ id: string; success: boolean; failed: boolean }> = [];

    for (const auction of expiredAuctions ?? []) {
      if (auction.winner_id && auction.current_bid > 0) {
        // 낙찰 처리
        const { error } = await supabase.rpc('rpc_settle_auction', {
          p_auction_id: auction.id,
        });
        settlements.push({ id: auction.id, success: !error, failed: false });
      } else {
        // 유찰 처리
        await supabase
          .from('tycoon_auctions')
          .update({ status: 'failed' })
          .eq('id', auction.id);

        // 유찰 건물 경매 상태 해제
        await supabase
          .from('tycoon_buildings')
          .update({ is_active: true })
          .eq('id', auction.building_id);

        // 유찰 재등록: 시작가 -10%
        const discountedBid = Math.round(auction.starting_bid * (1 - FAILED_DISCOUNT));
        const newEndAt = new Date(Date.now() + AUCTION_DURATION_MS).toISOString();

        await supabase
          .from('tycoon_auctions')
          .insert({
            building_id: auction.building_id,
            type: auction.type,
            status: 'active',
            starting_bid: discountedBid,
            current_bid: 0,
            start_at: now,
            end_at: newEndAt,
          });

        settlements.push({ id: auction.id, success: true, failed: true });
      }
    }

    // ─── Step 2: 새 경매 생성 ────────────────────────────

    // 현재 활성 경매 수 확인
    const { count: activeCount } = await supabase
      .from('tycoon_auctions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    // 최소 5개 유지
    const needed = Math.max(0, MIN_AUCTIONS - (activeCount ?? 0));
    const toCreate = Math.min(randomInt(needed, MAX_AUCTIONS), MAX_AUCTIONS);

    // 소유자 없고 경매 중이 아닌 건물 조회
    const { data: unownedBuildings } = await supabase
      .from('tycoon_buildings')
      .select('id, base_income, rarity, level')
      .eq('is_active', true)
      .not('id', 'in', `(${
        // 이미 경매 중인 건물 제외
        (await supabase
          .from('tycoon_auctions')
          .select('building_id')
          .eq('status', 'active')
        ).data?.map((a: { building_id: string }) => `'${a.building_id}'`).join(',') || "'none'"
      })`)
      .not('id', 'in', `(${
        // 소유된 건물 제외
        (await supabase
          .from('tycoon_ownership')
          .select('building_id')
          .eq('is_active', true)
        ).data?.map((o: { building_id: string }) => `'${o.building_id}'`).join(',') || "'none'"
      })`)
      .limit(toCreate * 2); // 여유분 확보

    if (unownedBuildings && unownedBuildings.length > 0) {
      // 셔플 후 필요한 수만큼 선택
      const shuffled = unownedBuildings.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(toCreate, shuffled.length));

      const newAuctions = [];
      for (const building of selected) {
        const fairValue = calculateFairValue(building);
        const startingBid = Math.round(fairValue * randomRange(STARTING_BID_MIN_PCT, STARTING_BID_MAX_PCT));
        const endAt = new Date(Date.now() + AUCTION_DURATION_MS).toISOString();

        newAuctions.push({
          building_id: building.id,
          type: 'regular',
          status: 'active',
          starting_bid: startingBid,
          current_bid: 0,
          start_at: now,
          end_at: endAt,
        });
      }

      if (newAuctions.length > 0) {
        await supabase
          .from('tycoon_auctions')
          .insert(newAuctions);
      }

      // ─── Step 3: NPC 입찰 스케줄 ──────────────────────
      // NPC 입찰은 별도 Edge Function(npc-bidder)에서 처리
      // 여기서는 경매 생성만 담당
    }

    return new Response(
      JSON.stringify({
        success: true,
        settled: settlements.length,
        created: toCreate,
        timestamp: now,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
