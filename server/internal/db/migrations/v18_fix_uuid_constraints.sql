-- ============================================================
-- v18 Fix: UUID → TEXT for user-facing ID columns
-- ============================================================
-- 문제: API Key Validator가 deterministic UUID를 생성하지만
-- faction_members.user_id가 users(id)를 FK로 참조하여
-- 시뮬레이션 에이전트(users 테이블 미등록)에서 FK violation 발생.
--
-- 해결: leader_id를 TEXT로 변경, faction_members user_id FK 제거,
-- achievements user_id FK 제거 (시뮬레이션 에이전트 지원)
-- ============================================================

-- 1. factions.leader_id: UUID → TEXT (FK 없었음, 타입만 변경)
ALTER TABLE factions ALTER COLUMN leader_id TYPE TEXT USING leader_id::text;

-- 2. faction_members.user_id: FK 제거 + UUID → TEXT
ALTER TABLE faction_members DROP CONSTRAINT IF EXISTS faction_members_user_id_fkey;
ALTER TABLE faction_members ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- 3. achievements.user_id: FK 제거 (없을 수도 있음) + UUID → TEXT
ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_user_id_fkey;
ALTER TABLE achievements ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- 4. achievements unique constraint 재생성 (컬럼 타입 변경 후)
-- 기존 unique 제약은 유지됨 (타입 변경 시 자동 유지)

-- 5. wars.season_id FK 제거 (nullable, 시즌이 아직 없을 수 있음)
ALTER TABLE wars DROP CONSTRAINT IF EXISTS wars_season_id_fkey;

-- 6. sovereignty_history FK 완화 (시뮬레이션 데이터)
ALTER TABLE sovereignty_history DROP CONSTRAINT IF EXISTS sovereignty_history_faction_id_fkey;
ALTER TABLE sovereignty_history DROP CONSTRAINT IF EXISTS sovereignty_history_season_id_fkey;

-- Done!
SELECT 'v18 UUID constraints fixed' AS status;
