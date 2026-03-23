-- 002_seed_buildings.sql — 서울/도쿄/뉴욕 150개 건물 시드 데이터
-- 등급 분포 (도시당 50): Common 20, Uncommon 15, Rare 8, Epic 5, Legendary 2

-- ═══════════════════════════════════════════════════════════════
-- SEOUL (서울) — 5 구역: gangnam, jongno, songpa, mapo, yongsan
-- ═══════════════════════════════════════════════════════════════

-- Legendary (2)
INSERT INTO buildings (id, name, name_ko, region_code, rarity, base_income, level, defense_power, garrison_capacity, visual_height, visual_width, visual_depth, position_x, position_z) VALUES
('bld-seoul-001', 'Lotte World Tower', '롯데월드타워', 'seoul-songpa', 'legendary', 5000, 1, 500, 100, 450, 30, 30, 0, 0),
('bld-seoul-002', 'Gyeongbokgung Palace', '경복궁', 'seoul-jongno', 'legendary', 5000, 1, 500, 100, 80, 120, 100, -100, 300);

-- Epic (5)
INSERT INTO buildings (id, name, name_ko, region_code, rarity, base_income, level, defense_power, garrison_capacity, visual_height, visual_width, visual_depth, position_x, position_z) VALUES
('bld-seoul-003', 'N Seoul Tower', 'N서울타워', 'seoul-yongsan', 'epic', 1500, 1, 150, 50, 300, 20, 20, -200, 150),
('bld-seoul-004', 'COEX Convention', '코엑스', 'seoul-gangnam', 'epic', 1500, 1, 150, 50, 80, 60, 50, 150, -120),
('bld-seoul-005', '63 Building', '63빌딩', 'seoul-mapo', 'epic', 1500, 1, 150, 50, 280, 25, 25, -300, -80),
('bld-seoul-006', 'Jamsil Olympic Stadium', '잠실올림픽주경기장', 'seoul-songpa', 'epic', 1500, 1, 150, 50, 50, 80, 80, 60, 60),
('bld-seoul-007', 'Dongdaemun DDP', '동대문DDP', 'seoul-jongno', 'epic', 1500, 1, 150, 50, 60, 55, 45, 80, 200);

-- Rare (8)
INSERT INTO buildings (id, name, name_ko, region_code, rarity, base_income, level, defense_power, garrison_capacity, visual_height, visual_width, visual_depth, position_x, position_z) VALUES
('bld-seoul-008', 'IFC Seoul', 'IFC서울', 'seoul-mapo', 'rare', 600, 1, 60, 25, 200, 28, 22, -260, -40),
('bld-seoul-009', 'Samsung HQ', '삼성본사', 'seoul-gangnam', 'rare', 600, 1, 60, 25, 180, 30, 28, 200, -250),
('bld-seoul-010', 'Hyundai Dept Store', '현대백화점더현대', 'seoul-mapo', 'rare', 600, 1, 60, 25, 120, 50, 35, -350, 50),
('bld-seoul-011', 'Starfield Library', '별마당도서관', 'seoul-gangnam', 'rare', 600, 1, 60, 25, 70, 40, 40, 120, -80),
('bld-seoul-012', 'Seoul Sky', '서울스카이', 'seoul-songpa', 'rare', 600, 1, 60, 25, 200, 22, 22, 40, -30),
('bld-seoul-013', 'War Memorial', '전쟁기념관', 'seoul-yongsan', 'rare', 600, 1, 60, 25, 40, 60, 50, -180, 120),
('bld-seoul-014', 'Yeouido Park Tower', '여의도파크원', 'seoul-mapo', 'rare', 600, 1, 60, 25, 160, 22, 18, -280, -120),
('bld-seoul-015', 'Cheongdam Tower', '청담타워', 'seoul-gangnam', 'rare', 600, 1, 60, 25, 140, 20, 18, 130, -100);

-- Uncommon (15)
INSERT INTO buildings (id, name, name_ko, region_code, rarity, base_income, level, defense_power, garrison_capacity, visual_height, visual_width, visual_depth, position_x, position_z) VALUES
('bld-seoul-016', 'Myeongdong Cathedral', '명동성당', 'seoul-jongno', 'uncommon', 250, 1, 25, 10, 80, 25, 30, 50, 180),
('bld-seoul-017', 'Gangnam Station', '강남역', 'seoul-gangnam', 'uncommon', 250, 1, 25, 10, 50, 45, 25, 180, -180),
('bld-seoul-018', 'Itaewon Hamilton', '이태원해밀턴', 'seoul-yongsan', 'uncommon', 250, 1, 25, 10, 55, 30, 25, -150, 100),
('bld-seoul-019', 'Hongdae Playground', '홍대놀이터', 'seoul-mapo', 'uncommon', 250, 1, 25, 10, 40, 35, 30, -400, 200),
('bld-seoul-020', 'Apgujeong Rodeo', '압구정로데오', 'seoul-gangnam', 'uncommon', 250, 1, 25, 10, 65, 28, 22, 100, -150),
('bld-seoul-021', 'Gwanghwamun Gate', '광화문', 'seoul-jongno', 'uncommon', 250, 1, 25, 10, 30, 40, 20, -100, 280),
('bld-seoul-022', 'Seoul Station', '서울역', 'seoul-yongsan', 'uncommon', 250, 1, 25, 10, 45, 55, 30, -180, 60),
('bld-seoul-023', 'Noryangjin Market', '노량진수산시장', 'seoul-mapo', 'uncommon', 250, 1, 25, 10, 20, 40, 25, -220, -180),
('bld-seoul-024', 'Jongno Tower', '종로타워', 'seoul-jongno', 'uncommon', 250, 1, 25, 10, 100, 22, 18, -60, 240),
('bld-seoul-025', 'Lotte Dept Myeongdong', '롯데백화점명동', 'seoul-jongno', 'uncommon', 250, 1, 25, 10, 90, 35, 30, 30, 160),
('bld-seoul-026', 'Olympic Park', '올림픽공원', 'seoul-songpa', 'uncommon', 250, 1, 25, 10, 15, 60, 60, 80, 40),
('bld-seoul-027', 'Banpo Bridge', '반포대교', 'seoul-gangnam', 'uncommon', 250, 1, 25, 10, 10, 80, 15, 160, -60),
('bld-seoul-028', 'Mapo Bridge', '마포대교', 'seoul-mapo', 'uncommon', 250, 1, 25, 10, 10, 70, 15, -330, -30),
('bld-seoul-029', 'Namsan Park', '남산공원', 'seoul-yongsan', 'uncommon', 250, 1, 25, 10, 25, 50, 50, -170, 180),
('bld-seoul-030', 'Songpa Lotte Mall', '송파롯데몰', 'seoul-songpa', 'uncommon', 250, 1, 25, 10, 60, 45, 35, 20, -50);

-- Common (20)
INSERT INTO buildings (id, name, name_ko, region_code, rarity, base_income, level, defense_power, garrison_capacity, visual_height, visual_width, visual_depth, position_x, position_z) VALUES
('bld-seoul-031', 'Sinchon Cafe Street', '신촌카페거리', 'seoul-mapo', 'common', 100, 1, 10, 5, 25, 18, 15, -350, 250),
('bld-seoul-032', 'Samcheong-dong Alley', '삼청동거리', 'seoul-jongno', 'common', 100, 1, 10, 5, 18, 15, 12, -80, 320),
('bld-seoul-033', 'Bukchon Hanok Village', '북촌한옥마을', 'seoul-jongno', 'common', 100, 1, 10, 5, 12, 22, 18, -60, 350),
('bld-seoul-034', 'Insadong Gallery', '인사동갤러리', 'seoul-jongno', 'common', 100, 1, 10, 5, 20, 18, 14, -30, 250),
('bld-seoul-035', 'Namdaemun Market', '남대문시장', 'seoul-jongno', 'common', 100, 1, 10, 5, 15, 35, 30, 10, 150),
('bld-seoul-036', 'Garosugil Shop', '가로수길', 'seoul-gangnam', 'common', 100, 1, 10, 5, 22, 15, 12, 160, -200),
('bld-seoul-037', 'Mangwon Market', '망원시장', 'seoul-mapo', 'common', 100, 1, 10, 5, 15, 30, 25, -380, 160),
('bld-seoul-038', 'Seolleung Park', '선릉공원', 'seoul-gangnam', 'common', 100, 1, 10, 5, 10, 40, 35, 170, -140),
('bld-seoul-039', 'Hapjeong Cafe', '합정카페', 'seoul-mapo', 'common', 100, 1, 10, 5, 20, 16, 14, -360, 180),
('bld-seoul-040', 'Yongsan Electronics', '용산전자상가', 'seoul-yongsan', 'common', 100, 1, 10, 5, 30, 40, 30, -200, 80),
('bld-seoul-041', 'Gangnam Apt Complex', '강남아파트단지', 'seoul-gangnam', 'common', 100, 1, 10, 5, 50, 25, 20, 140, -220),
('bld-seoul-042', 'Songpa Apt Tower', '송파아파트', 'seoul-songpa', 'common', 100, 1, 10, 5, 55, 22, 18, 30, 30),
('bld-seoul-043', 'Jongno Bookstore', '종로서점', 'seoul-jongno', 'common', 100, 1, 10, 5, 18, 14, 12, -40, 220),
('bld-seoul-044', 'Mapo Convenience', '마포편의점', 'seoul-mapo', 'common', 100, 1, 10, 5, 8, 10, 8, -340, 140),
('bld-seoul-045', 'Yongsan Pharmacy', '용산약국', 'seoul-yongsan', 'common', 100, 1, 10, 5, 10, 12, 10, -160, 140),
('bld-seoul-046', 'Gangnam School', '강남학교', 'seoul-gangnam', 'common', 100, 1, 10, 5, 25, 30, 25, 190, -160),
('bld-seoul-047', 'Songpa Library', '송파도서관', 'seoul-songpa', 'common', 100, 1, 10, 5, 20, 25, 20, 50, -60),
('bld-seoul-048', 'Jongno Post Office', '종로우체국', 'seoul-jongno', 'common', 100, 1, 10, 5, 15, 16, 14, -20, 200),
('bld-seoul-049', 'Mapo Fire Station', '마포소방서', 'seoul-mapo', 'common', 100, 1, 10, 5, 18, 20, 16, -370, 120),
('bld-seoul-050', 'Yongsan Community', '용산주민센터', 'seoul-yongsan', 'common', 100, 1, 10, 5, 12, 18, 14, -190, 40);

-- ═══════════════════════════════════════════════════════════════
-- TOKYO (도쿄) — 5 구역: shibuya, shinjuku, akihabara, roppongi, ginza
-- ═══════════════════════════════════════════════════════════════

-- Legendary (2)
INSERT INTO buildings (id, name, name_ko, region_code, rarity, base_income, level, defense_power, garrison_capacity, visual_height, visual_width, visual_depth, position_x, position_z) VALUES
('bld-tokyo-001', 'Tokyo Skytree', '도쿄스카이트리', 'tokyo-akihabara', 'legendary', 5000, 1, 500, 100, 500, 20, 20, 0, 0),
('bld-tokyo-002', 'Tokyo Tower', '도쿄타워', 'tokyo-roppongi', 'legendary', 5000, 1, 500, 100, 350, 25, 25, -150, -100);

-- Epic (5)
INSERT INTO buildings (id, name, name_ko, region_code, rarity, base_income, level, defense_power, garrison_capacity, visual_height, visual_width, visual_depth, position_x, position_z) VALUES
('bld-tokyo-003', 'Shibuya 109', '시부야109', 'tokyo-shibuya', 'epic', 1500, 1, 150, 50, 120, 35, 35, -300, 200),
('bld-tokyo-004', 'Shinjuku Station', '신주쿠역', 'tokyo-shinjuku', 'epic', 1500, 1, 150, 50, 60, 80, 60, 200, 150),
('bld-tokyo-005', 'Roppongi Hills', '롯본기힐즈', 'tokyo-roppongi', 'epic', 1500, 1, 150, 50, 240, 40, 40, -200, -150),
('bld-tokyo-006', 'Ginza Wako', '긴자와코', 'tokyo-ginza', 'epic', 1500, 1, 150, 50, 80, 45, 35, 100, -200),
('bld-tokyo-007', 'Akihabara Radio Kaikan', '아키하바라라디오회관', 'tokyo-akihabara', 'epic', 1500, 1, 150, 50, 90, 30, 30, 50, 50);

-- Rare (8)
INSERT INTO buildings (id, name, name_ko, region_code, rarity, base_income, level, defense_power, garrison_capacity, visual_height, visual_width, visual_depth, position_x, position_z) VALUES
('bld-tokyo-008', 'Meiji Shrine', '메이지신궁', 'tokyo-shibuya', 'rare', 600, 1, 60, 25, 30, 60, 50, -350, 250),
('bld-tokyo-009', 'Kabukicho Tower', '가부키초타워', 'tokyo-shinjuku', 'rare', 600, 1, 60, 25, 200, 25, 22, 250, 100),
('bld-tokyo-010', 'Tokyo Midtown', '도쿄미드타운', 'tokyo-roppongi', 'rare', 600, 1, 60, 25, 250, 30, 28, -180, -200),
('bld-tokyo-011', 'Mitsukoshi Ginza', '미쓰코시긴자', 'tokyo-ginza', 'rare', 600, 1, 60, 25, 70, 40, 35, 130, -180),
('bld-tokyo-012', 'Yodobashi Camera', '요도바시카메라', 'tokyo-akihabara', 'rare', 600, 1, 60, 25, 60, 50, 40, 30, 80),
('bld-tokyo-013', 'NTT Docomo Tower', 'NTT도코모타워', 'tokyo-shinjuku', 'rare', 600, 1, 60, 25, 270, 20, 20, 180, 200),
('bld-tokyo-014', 'Shibuya Scramble', '시부야스크램블', 'tokyo-shibuya', 'rare', 600, 1, 60, 25, 100, 35, 30, -280, 180),
('bld-tokyo-015', 'Tsukiji Outer Market', '쓰키지시장', 'tokyo-ginza', 'rare', 600, 1, 60, 25, 15, 50, 45, 80, -250);

-- Uncommon (15)
INSERT INTO buildings (id, name, name_ko, region_code, rarity, base_income, level, defense_power, garrison_capacity, visual_height, visual_width, visual_depth, position_x, position_z) VALUES
('bld-tokyo-016', 'Harajuku Station', '하라주쿠역', 'tokyo-shibuya', 'uncommon', 250, 1, 25, 10, 30, 35, 25, -320, 220),
('bld-tokyo-017', 'Golden Gai', '골든가이', 'tokyo-shinjuku', 'uncommon', 250, 1, 25, 10, 15, 25, 20, 220, 130),
('bld-tokyo-018', 'Maid Cafe Strip', '메이드카페거리', 'tokyo-akihabara', 'uncommon', 250, 1, 25, 10, 20, 18, 15, 40, 30),
('bld-tokyo-019', 'Roppongi Crossing', '롯본기교차로', 'tokyo-roppongi', 'uncommon', 250, 1, 25, 10, 40, 30, 25, -160, -130),
('bld-tokyo-020', 'Ginza SIX', '긴자식스', 'tokyo-ginza', 'uncommon', 250, 1, 25, 10, 60, 35, 30, 110, -220),
('bld-tokyo-021', 'Takeshita Street', '다케시타도오리', 'tokyo-shibuya', 'uncommon', 250, 1, 25, 10, 18, 15, 12, -330, 200),
('bld-tokyo-022', 'Omoide Yokocho', '오모이데요코초', 'tokyo-shinjuku', 'uncommon', 250, 1, 25, 10, 10, 20, 15, 210, 170),
('bld-tokyo-023', 'Mandarake Complex', '만다라케', 'tokyo-akihabara', 'uncommon', 250, 1, 25, 10, 40, 22, 18, 60, 60),
('bld-tokyo-024', 'National Art Center', '국립신미술관', 'tokyo-roppongi', 'uncommon', 250, 1, 25, 10, 30, 50, 40, -220, -180),
('bld-tokyo-025', 'Kabuki-za Theatre', '가부키좌', 'tokyo-ginza', 'uncommon', 250, 1, 25, 10, 35, 40, 30, 90, -170),
('bld-tokyo-026', 'Shibuya Mark City', '시부야마크시티', 'tokyo-shibuya', 'uncommon', 250, 1, 25, 10, 80, 30, 25, -290, 160),
('bld-tokyo-027', 'Isetan Shinjuku', '이세탄신주쿠', 'tokyo-shinjuku', 'uncommon', 250, 1, 25, 10, 50, 40, 35, 240, 120),
('bld-tokyo-028', 'Don Quijote Akiba', '돈키호테아키바', 'tokyo-akihabara', 'uncommon', 250, 1, 25, 10, 35, 20, 18, 20, 40),
('bld-tokyo-029', 'Tokyo Prince Hotel', '도쿄프린스호텔', 'tokyo-roppongi', 'uncommon', 250, 1, 25, 10, 70, 30, 28, -170, -80),
('bld-tokyo-030', 'Ginza Apple Store', '긴자애플스토어', 'tokyo-ginza', 'uncommon', 250, 1, 25, 10, 25, 20, 18, 120, -200);

-- Common (20)
INSERT INTO buildings (id, name, name_ko, region_code, rarity, base_income, level, defense_power, garrison_capacity, visual_height, visual_width, visual_depth, position_x, position_z) VALUES
('bld-tokyo-031', 'Shibuya Ramen Shop', '시부야라멘집', 'tokyo-shibuya', 'common', 100, 1, 10, 5, 10, 12, 10, -310, 240),
('bld-tokyo-032', 'Shinjuku Capsule Hotel', '신주쿠캡슐호텔', 'tokyo-shinjuku', 'common', 100, 1, 10, 5, 25, 15, 12, 230, 140),
('bld-tokyo-033', 'Akiba Game Center', '아키바게임센터', 'tokyo-akihabara', 'common', 100, 1, 10, 5, 30, 20, 18, 70, 20),
('bld-tokyo-034', 'Roppongi Konbini', '롯본기편의점', 'tokyo-roppongi', 'common', 100, 1, 10, 5, 8, 10, 8, -190, -160),
('bld-tokyo-035', 'Ginza Sushi Bar', '긴자초밥집', 'tokyo-ginza', 'common', 100, 1, 10, 5, 10, 14, 10, 140, -190),
('bld-tokyo-036', 'Shibuya Karaoke', '시부야노래방', 'tokyo-shibuya', 'common', 100, 1, 10, 5, 20, 14, 12, -340, 170),
('bld-tokyo-037', 'Shinjuku Izakaya', '신주쿠이자카야', 'tokyo-shinjuku', 'common', 100, 1, 10, 5, 12, 12, 10, 200, 180),
('bld-tokyo-038', 'Akiba Figure Shop', '아키바피규어샵', 'tokyo-akihabara', 'common', 100, 1, 10, 5, 15, 10, 8, 50, 70),
('bld-tokyo-039', 'Roppongi Pharmacy', '롯본기약국', 'tokyo-roppongi', 'common', 100, 1, 10, 5, 10, 12, 10, -140, -120),
('bld-tokyo-040', 'Ginza Jewelry Store', '긴자보석상', 'tokyo-ginza', 'common', 100, 1, 10, 5, 12, 10, 8, 100, -230),
('bld-tokyo-041', 'Shibuya Apt', '시부야아파트', 'tokyo-shibuya', 'common', 100, 1, 10, 5, 40, 20, 18, -260, 230),
('bld-tokyo-042', 'Shinjuku Gym', '신주쿠체육관', 'tokyo-shinjuku', 'common', 100, 1, 10, 5, 15, 25, 20, 260, 110),
('bld-tokyo-043', 'Akiba Post Office', '아키바우체국', 'tokyo-akihabara', 'common', 100, 1, 10, 5, 12, 14, 12, 35, 90),
('bld-tokyo-044', 'Roppongi School', '롯본기학교', 'tokyo-roppongi', 'common', 100, 1, 10, 5, 20, 30, 25, -210, -110),
('bld-tokyo-045', 'Ginza Bank', '긴자은행', 'tokyo-ginza', 'common', 100, 1, 10, 5, 25, 18, 15, 70, -210),
('bld-tokyo-046', 'Shibuya Park', '시부야공원', 'tokyo-shibuya', 'common', 100, 1, 10, 5, 5, 35, 30, -270, 270),
('bld-tokyo-047', 'Shinjuku Garden', '신주쿠교엔', 'tokyo-shinjuku', 'common', 100, 1, 10, 5, 5, 40, 35, 170, 160),
('bld-tokyo-048', 'Akiba Shrine', '아키바신사', 'tokyo-akihabara', 'common', 100, 1, 10, 5, 15, 18, 15, 80, 30),
('bld-tokyo-049', 'Roppongi Clinic', '롯본기병원', 'tokyo-roppongi', 'common', 100, 1, 10, 5, 18, 16, 14, -230, -140),
('bld-tokyo-050', 'Ginza Florist', '긴자꽃집', 'tokyo-ginza', 'common', 100, 1, 10, 5, 8, 10, 8, 150, -240);

-- ═══════════════════════════════════════════════════════════════
-- NEW YORK (뉴욕) — 5 구역: manhattan, brooklyn, queens, bronx, staten
-- ═══════════════════════════════════════════════════════════════

-- Legendary (2)
INSERT INTO buildings (id, name, name_ko, region_code, rarity, base_income, level, defense_power, garrison_capacity, visual_height, visual_width, visual_depth, position_x, position_z) VALUES
('bld-ny-001', 'Empire State Building', '엠파이어스테이트빌딩', 'newyork-manhattan', 'legendary', 5000, 1, 500, 100, 450, 30, 30, 0, 0),
('bld-ny-002', 'Statue of Liberty', '자유의여신상', 'newyork-staten', 'legendary', 5000, 1, 500, 100, 100, 25, 25, 300, -300);

-- Epic (5)
INSERT INTO buildings (id, name, name_ko, region_code, rarity, base_income, level, defense_power, garrison_capacity, visual_height, visual_width, visual_depth, position_x, position_z) VALUES
('bld-ny-003', 'One World Trade Center', '원월드트레이드센터', 'newyork-manhattan', 'epic', 1500, 1, 150, 50, 500, 25, 25, -50, -50),
('bld-ny-004', 'Central Park Tower', '센트럴파크타워', 'newyork-manhattan', 'epic', 1500, 1, 150, 50, 470, 20, 20, 80, 150),
('bld-ny-005', 'Brooklyn Bridge', '브루클린브릿지', 'newyork-brooklyn', 'epic', 1500, 1, 150, 50, 40, 100, 15, -200, -150),
('bld-ny-006', 'Yankee Stadium', '양키스타디움', 'newyork-bronx', 'epic', 1500, 1, 150, 50, 40, 80, 80, 200, 250),
('bld-ny-007', 'Citi Field', '시티필드', 'newyork-queens', 'epic', 1500, 1, 150, 50, 35, 70, 70, -250, 200);

-- Rare (8)
INSERT INTO buildings (id, name, name_ko, region_code, rarity, base_income, level, defense_power, garrison_capacity, visual_height, visual_width, visual_depth, position_x, position_z) VALUES
('bld-ny-008', 'Times Square Tower', '타임스퀘어타워', 'newyork-manhattan', 'rare', 600, 1, 60, 25, 200, 30, 25, 30, 50),
('bld-ny-009', 'Chrysler Building', '크라이슬러빌딩', 'newyork-manhattan', 'rare', 600, 1, 60, 25, 320, 22, 22, -30, 30),
('bld-ny-010', 'Barclays Center', '바클레이즈센터', 'newyork-brooklyn', 'rare', 600, 1, 60, 25, 35, 60, 55, -180, -120),
('bld-ny-011', 'USTA Tennis Center', 'USTA테니스센터', 'newyork-queens', 'rare', 600, 1, 60, 25, 30, 55, 50, -230, 180),
('bld-ny-012', 'Bronx Zoo', '브롱스동물원', 'newyork-bronx', 'rare', 600, 1, 60, 25, 15, 70, 60, 220, 200),
('bld-ny-013', 'Rockefeller Center', '록펠러센터', 'newyork-manhattan', 'rare', 600, 1, 60, 25, 260, 35, 30, 50, 100),
('bld-ny-014', 'Grand Central Terminal', '그랜드센트럴역', 'newyork-manhattan', 'rare', 600, 1, 60, 25, 50, 60, 45, -10, 80),
('bld-ny-015', 'Brooklyn Museum', '브루클린박물관', 'newyork-brooklyn', 'rare', 600, 1, 60, 25, 30, 50, 40, -220, -180);

-- Uncommon (15)
INSERT INTO buildings (id, name, name_ko, region_code, rarity, base_income, level, defense_power, garrison_capacity, visual_height, visual_width, visual_depth, position_x, position_z) VALUES
('bld-ny-016', 'Wall Street Exchange', '월스트리트거래소', 'newyork-manhattan', 'uncommon', 250, 1, 25, 10, 40, 35, 30, -20, -30),
('bld-ny-017', 'Chelsea Market', '첼시마켓', 'newyork-manhattan', 'uncommon', 250, 1, 25, 10, 25, 40, 30, -80, 50),
('bld-ny-018', 'DUMBO Warehouse', '덤보창고', 'newyork-brooklyn', 'uncommon', 250, 1, 25, 10, 20, 30, 25, -190, -100),
('bld-ny-019', 'Astoria Greek Diner', '아스토리아다이너', 'newyork-queens', 'uncommon', 250, 1, 25, 10, 12, 18, 15, -260, 160),
('bld-ny-020', 'Fordham University', '포드햄대학교', 'newyork-bronx', 'uncommon', 250, 1, 25, 10, 30, 40, 35, 180, 230),
('bld-ny-021', 'Staten Island Ferry', '스태튼아일랜드페리', 'newyork-staten', 'uncommon', 250, 1, 25, 10, 15, 30, 15, 280, -280),
('bld-ny-022', 'Madison Square Garden', '매디슨스퀘어가든', 'newyork-manhattan', 'uncommon', 250, 1, 25, 10, 35, 55, 50, 20, 30),
('bld-ny-023', 'Williamsburg Brewery', '윌리엄스버그양조장', 'newyork-brooklyn', 'uncommon', 250, 1, 25, 10, 15, 22, 18, -160, -160),
('bld-ny-024', 'Flushing Main St', '플러싱메인스트리트', 'newyork-queens', 'uncommon', 250, 1, 25, 10, 20, 20, 16, -240, 220),
('bld-ny-025', 'Arthur Ave Market', '아서애비뉴마켓', 'newyork-bronx', 'uncommon', 250, 1, 25, 10, 12, 25, 20, 200, 220),
('bld-ny-026', 'SoHo Gallery', '소호갤러리', 'newyork-manhattan', 'uncommon', 250, 1, 25, 10, 25, 18, 15, -60, -20),
('bld-ny-027', 'Brooklyn Heights Apt', '브루클린하이츠아파트', 'newyork-brooklyn', 'uncommon', 250, 1, 25, 10, 35, 20, 18, -200, -80),
('bld-ny-028', 'Jackson Heights Mall', '잭슨하이츠몰', 'newyork-queens', 'uncommon', 250, 1, 25, 10, 18, 30, 25, -270, 190),
('bld-ny-029', 'Pelham Bay Park', '펠럼베이파크', 'newyork-bronx', 'uncommon', 250, 1, 25, 10, 5, 50, 45, 240, 260),
('bld-ny-030', 'Staten Island Mall', '스태튼아일랜드몰', 'newyork-staten', 'uncommon', 250, 1, 25, 10, 20, 40, 35, 260, -260);

-- Common (20)
INSERT INTO buildings (id, name, name_ko, region_code, rarity, base_income, level, defense_power, garrison_capacity, visual_height, visual_width, visual_depth, position_x, position_z) VALUES
('bld-ny-031', 'Manhattan Deli', '맨해튼델리', 'newyork-manhattan', 'common', 100, 1, 10, 5, 10, 12, 10, 40, 20),
('bld-ny-032', 'Brooklyn Pizza Shop', '브루클린피자집', 'newyork-brooklyn', 'common', 100, 1, 10, 5, 10, 14, 10, -170, -140),
('bld-ny-033', 'Queens Laundromat', '퀸즈세탁소', 'newyork-queens', 'common', 100, 1, 10, 5, 8, 12, 10, -250, 170),
('bld-ny-034', 'Bronx Bodega', '브롱스보데가', 'newyork-bronx', 'common', 100, 1, 10, 5, 8, 10, 8, 210, 240),
('bld-ny-035', 'Staten Pharmacy', '스태튼약국', 'newyork-staten', 'common', 100, 1, 10, 5, 10, 12, 10, 270, -270),
('bld-ny-036', 'Midtown Office', '미드타운오피스', 'newyork-manhattan', 'common', 100, 1, 10, 5, 60, 18, 16, 60, 70),
('bld-ny-037', 'Bushwick Loft', '부시윅로프트', 'newyork-brooklyn', 'common', 100, 1, 10, 5, 20, 16, 14, -150, -130),
('bld-ny-038', 'Corona Park Cafe', '코로나파크카페', 'newyork-queens', 'common', 100, 1, 10, 5, 8, 14, 12, -235, 210),
('bld-ny-039', 'Mott Haven Studio', '모트헤이븐스튜디오', 'newyork-bronx', 'common', 100, 1, 10, 5, 15, 14, 12, 190, 250),
('bld-ny-040', 'Tottenville Shop', '토튼빌숍', 'newyork-staten', 'common', 100, 1, 10, 5, 10, 12, 10, 290, -250),
('bld-ny-041', 'Harlem Brownstone', '할렘브라운스톤', 'newyork-manhattan', 'common', 100, 1, 10, 5, 18, 14, 12, 70, 130),
('bld-ny-042', 'Park Slope Townhouse', '파크슬로프타운하우스', 'newyork-brooklyn', 'common', 100, 1, 10, 5, 15, 12, 10, -210, -100),
('bld-ny-043', 'Bayside Grocery', '베이사이드그로서리', 'newyork-queens', 'common', 100, 1, 10, 5, 8, 12, 10, -220, 230),
('bld-ny-044', 'Tremont School', '트레몬트학교', 'newyork-bronx', 'common', 100, 1, 10, 5, 20, 25, 20, 230, 210),
('bld-ny-045', 'Great Kills Park', '그레이트킬스파크', 'newyork-staten', 'common', 100, 1, 10, 5, 5, 30, 25, 250, -290),
('bld-ny-046', 'East Village Bar', '이스트빌리지바', 'newyork-manhattan', 'common', 100, 1, 10, 5, 12, 10, 8, -40, 10),
('bld-ny-047', 'Red Hook Warehouse', '레드훅창고', 'newyork-brooklyn', 'common', 100, 1, 10, 5, 15, 25, 20, -230, -90),
('bld-ny-048', 'Woodside Apt', '우드사이드아파트', 'newyork-queens', 'common', 100, 1, 10, 5, 30, 18, 16, -280, 200),
('bld-ny-049', 'Riverdale Library', '리버데일도서관', 'newyork-bronx', 'common', 100, 1, 10, 5, 15, 20, 16, 170, 270),
('bld-ny-050', 'St George Theatre', '세인트조지극장', 'newyork-staten', 'common', 100, 1, 10, 5, 20, 22, 18, 310, -280);
