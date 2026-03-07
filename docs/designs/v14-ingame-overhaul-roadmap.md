# Roadmap: v14 — In-Game Total Overhaul

> 이 파일은 da:work의 roadmap 모드에서 자동 파싱됩니다.
> 각 Step은 `### SNN: [이름]` 형식이며, file/ref/blocked_by/do/verify 필드를 포함합니다.

## Phase 0 — 코어 인프라 리팩토링

### S01: CountryArena 구조 전환
- **file**: server/internal/game/country_arena.go, server/internal/game/country_arena_manager.go
- **ref**: server/internal/game/arena.go, server/internal/game/room.go
- **blocked_by**: none
- **do**:
  1. Arena를 CountryArena로 리네임/확장 (CountryCode 필드 추가)
  2. CountryArenaManager 생성: 195국 lazy init, 활성 아레나만 tick
  3. 기존 RoomManager 호환 레이어 (점진 마이그레이션)
  4. 아레나 정원 50명 제한, 대기열 로직
- **verify**: `go build ./...` 성공, 기존 테스트 통과

### S02: 에포크 시스템
- **file**: server/internal/game/epoch.go, server/internal/game/epoch_state.go
- **ref**: server/internal/game/room.go (Room 상태머신 참조)
- **blocked_by**: S01
- **do**:
  1. EpochManager: 10분 사이클 상태머신 (Peace→WarCountdown→War→Shrink→End→Transition)
  2. 평화 페이즈 (5분): PvP 데미지 OFF, 오브 스폰 강화
  3. 전투 페이즈 (5분): PvP ON, 경고 사이렌 이벤트
  4. 아레나 축소 (8분~10분): 반경 3000→1000px
  5. 에포크 종료: 점수 집계 + 결과 브로드캐스트
  6. 에포크 간 전환: 10초 (결과 5초 + 준비 5초)
- **verify**: 에포크 10분 사이클 완주, 상태 전환 정확

### S03: 리스폰 매니저
- **file**: server/internal/game/respawn.go
- **ref**: server/internal/game/arena.go (기존 사망 처리)
- **blocked_by**: S01
- **do**:
  1. RespawnManager: 사망→3초 대기→랜덤 위치 리스폰
  2. 리스폰 후 5초 무적 (invincible 플래그)
  3. 리스폰 페널티: 2초 이동속도 -30%
  4. 레벨/빌드 유지, HP 100% 회복
  5. respawn 이벤트 클라이언트 전송
- **verify**: 사망→리스폰 흐름, 무적 시간 정확, 빌드 유지

### S04: 에이전트 국적 시스템
- **file**: server/internal/game/agent.go, packages/shared/src/types/game.ts
- **ref**: server/internal/game/agent.go (기존 Agent 구조체)
- **blocked_by**: S01
- **do**:
  1. Agent 구조체에 Nationality string 필드 추가
  2. 공유 타입에 nationality 필드 추가
  3. join 시 nationality 필수 검증
  4. 국적별 플레이어 그룹핑 유틸리티
  5. 같은 국적 = 아군 판별 로직
- **verify**: 에이전트 생성 시 국적 필수, 국적별 그룹핑 동작

### S05: 프로토콜 확장 (에포크/리스폰)
- **file**: server/internal/network/socket_handler.go, packages/shared/src/types/events.ts
- **ref**: server/internal/network/socket_handler.go, packages/shared/src/types/events.ts
- **blocked_by**: S02, S03, S04
- **do**:
  1. 신규 C→S: select_nationality, join_country_arena
  2. 신규 S→C: epoch_start, epoch_end, war_phase_start, war_phase_end
  3. 신규 S→C: respawn, nation_score_update
  4. 기존 이벤트 호환 유지
  5. 클라이언트 이벤트 핸들러 스텁
- **verify**: 이벤트 송수신, TypeScript 타입 일치

### S06: 에포크 클라이언트 연동
- **file**: apps/web/components/game/EpochHUD.tsx, apps/web/hooks/useSocket.ts
- **ref**: apps/web/components/game/RoundTimerHUD.tsx (기존 타이머 참조)
- **blocked_by**: S05
- **do**:
  1. EpochHUD: 에포크 타이머 + 현재 페이즈 표시 (PEACE/WAR)
  2. 전투 시작 카운트다운 오버레이 (3초)
  3. 에포크 결과 오버레이 (5초): 개인 성적 + 국가별 순위
  4. useSocket 에포크 이벤트 핸들러 추가
  5. 리스폰 이펙트: 사망 화면 → 3초 카운트 → 리스폰 글로우
- **verify**: HUD 표시 정확, 페이즈 전환 연출, 리스폰 UX

## Phase 1 — 캐릭터 모듈 오버홀

### S07: 캐릭터 랜덤 생성기 추출
- **file**: apps/web/lib/character-generator.ts
- **ref**: apps/web/components/3d/CharacterCreator.tsx (기존 로비 크리에이터)
- **blocked_by**: S04
- **do**:
  1. CharacterCreator의 랜덤 생성 로직을 독립 모듈로 추출
  2. generateRandomAppearance(): CubelingAppearance 반환
  3. 모든 파츠 랜덤화 (얼굴, 눈, 입, 마크, 모자, 악세서리 등)
  4. 시드 기반 재현 가능 랜덤 (같은 시드 → 같은 외형)
- **verify**: 랜덤 생성 호출 → 유효한 CubelingAppearance 반환

### S08: 국적 선택 UI
- **file**: apps/web/components/lobby/NationalitySelector.tsx
- **ref**: apps/web/components/world/WorldManager.tsx (195국 데이터)
- **blocked_by**: S07
- **do**:
  1. 195개국 드롭다운 (국기 + 국가명)
  2. 검색 필터 (한글/영어)
  3. 로비 캐릭터 생성 흐름에 통합: 이름 → 국적 → RANDOMIZE → CONFIRM
  4. 선택된 국적을 서버에 전송 (join 시)
- **verify**: 국적 선택 → 캐릭터 생성 → 서버 join 성공

### S09: 인게임 국기 & 아군 식별
- **file**: apps/web/components/3d/FlagSprite.tsx, apps/web/components/3d/AgentInstances.tsx
- **ref**: apps/web/components/3d/AgentInstances.tsx (기존 렌더러)
- **blocked_by**: S08
- **do**:
  1. FlagSprite: 에이전트 머리 위 16×16 국기 아이콘 (Billboard)
  2. 국기 아틀라스 텍스처 (195국 → 1장 스프라이트 시트)
  3. 아군 식별: 같은 국적 = 초록 이름, 적 = 빨강 이름
  4. AgentInstances에 국적 데이터 연동
- **verify**: 국기 표시, 아군/적 이름 색상 구분

## Phase 2 — Megabonk 전투 시스템

### S10: 무기 데이터 & 타입 정의
- **file**: server/internal/domain/weapons.go, packages/shared/src/types/weapons.ts
- **ref**: server/internal/domain/upgrades.go (기존 업그레이드 시스템)
- **blocked_by**: S04
- **do**:
  1. WeaponType 정의: 10종 무기 (BonkMallet, ChainBolt, FlameRing, FrostShards, ShadowStrike, ThunderClap, VenomCloud, CrystalShield, GravityBomb, SoulDrain)
  2. WeaponData: baseDPS, range, cooldown, pattern, specialEffect
  3. WeaponEvolution: Lv1~5 진화 데이터 (DPS, range, cooldown 배율)
  4. 공유 타입으로 클라이언트에도 동일 정의
- **verify**: 타입 컴파일, 10종 무기 데이터 완성

### S11: WeaponSystem 서버 구현
- **file**: server/internal/game/weapon_system.go
- **ref**: server/internal/game/collision.go (기존 전투 참조)
- **blocked_by**: S10
- **do**:
  1. WeaponSystem: 에이전트별 무기 슬롯 (최대 5개) 관리
  2. 자동발사 루프: 무기별 쿨다운 체크 → 패턴별 타겟팅 → 데미지 적용
  3. 10종 무기 패턴 구현:
     - 전방 부채꼴 (Bonk), 체인 (ChainBolt), 360° 원형 (FlameRing)
     - 다발 (FrostShards), 텔레포트 (ShadowStrike), 타겟 AOE (ThunderClap)
     - 설치형 (VenomCloud), 궤도 (CrystalShield), 설치폭발 (GravityBomb), 빔 (SoulDrain)
  4. 데미지 공식: FinalDmg = BaseDmg × (1+Fury×0.15) × CritMult × TerrainMod - DEF
  5. DOT, 넉백, 스턴, 둔화 상태 효과 시스템
- **verify**: 10종 무기 발사 확인, 데미지 계산 정확

### S12: HP/방어 시스템 리워크
- **file**: server/internal/game/agent.go, server/internal/game/combat.go
- **ref**: server/internal/game/agent.go (기존 Mass=HP)
- **blocked_by**: S11
- **do**:
  1. Mass 시스템 → HP + Defense + BaseDPS 분리
  2. HP: 기본 100, 레벨업 시 +10
  3. 크리티컬: 기본 5%, Precision 패시브로 증가, 200% 배율
  4. 넉백: 피격 시 10px, 무기별 추가 넉백
  5. 대시 리워크: 300px/s 1초, 5초 CD
  6. 기존 collision.go의 오라 전투 → 새 무기 시스템으로 대체
- **verify**: HP/방어/크리티컬 동작, 대시 메카닉

### S13: 무기 이펙트 클라이언트
- **file**: apps/web/components/3d/WeaponRenderer.tsx, apps/web/components/3d/DamageNumbers.tsx
- **ref**: apps/web/components/3d/AgentInstances.tsx (기존 렌더러)
- **blocked_by**: S12
- **do**:
  1. WeaponRenderer: 10종 무기 비주얼 이펙트
     - 부채꼴 슬래시, 체인 라이트닝, 불꽃 링, 얼음 파편
     - 순간이동 잔상, 번개 기둥, 독구름, 수정 궤도, 블랙홀, 빔
  2. DamageNumbers: 떠오르는 데미지 숫자 (InstancedMesh 최적화)
     - 일반: 흰색, 크리티컬: 골드+크게, DOT: 초록, 힐: 녹색
  3. 파티클 풀링 (메모리 최적화)
  4. LOD: 카메라 거리에 따라 이펙트 간소화
- **verify**: 10종 이펙트 렌더링, 60FPS 유지 (50 에이전트)

## Phase 3 — 스킬 트리 & 프로그레션

### S14: 레벨업 시스템 서버
- **file**: server/internal/game/leveling.go
- **ref**: server/internal/game/upgrade.go (기존 레벨업)
- **blocked_by**: S11
- **do**:
  1. 레벨 1→20 XP 테이블 구현 (50→2120 곡선)
  2. XP 소스: 오브(1~5), NPC(20~50), 전략포인트(5/s), 킬(100+lv×10), 어시스트(40%)
  3. 레벨업 시 3개 랜덤 선택지 (무기 40%, 패시브 50%, 시너지 힌트 10%)
  4. 5초 타임아웃 → 자동선택
  5. 에포크 간 레벨/빌드 유지, 1시간 후 전체 리셋
- **verify**: 레벨업 흐름, XP 계산, 선택지 생성 로직

### S15: 무기 진화 시스템
- **file**: server/internal/game/weapon_evolution.go
- **ref**: —
- **blocked_by**: S14
- **do**:
  1. 같은 무기 중복 획득 → Lv2~5 자동 진화
  2. 진화 효과: Lv2(+30% DMG), Lv3(+25% 범위/투사체), Lv4(-20% CD), Lv5(궁극 변형)
  3. 10종 Lv5 궁극 변형 구현 (Earthquake, StormNetwork, Inferno 등)
  4. Lv5 달성 시 해당 무기 선택지 제외
- **verify**: 무기 Lv1→5 진화, 궁극 변형 효과 동작

### S16: 패시브 & 시너지 시스템
- **file**: server/internal/game/passives.go, server/internal/game/synergy.go
- **ref**: server/internal/domain/upgrades.go (기존 Tome 참조)
- **blocked_by**: S14
- **do**:
  1. 10종 패시브 스택 시스템 (Vigor, Swift, Fury, IronSkin 등)
  2. 패시브 스택별 효과 누적 계산
  3. 10종 시너지 조합 감지 + 자동 발동
  4. 시너지 발동 시 클라이언트 알림 이벤트
- **verify**: 패시브 스택 누적, 시너지 조건 충족 시 발동

### S17: 레벨업 UI 클라이언트
- **file**: apps/web/components/game/LevelUpOverlay.tsx, apps/web/components/game/BuildHUD.tsx
- **ref**: —
- **blocked_by**: S14
- **do**:
  1. LevelUpOverlay: 3개 선택지 카드 (무기 아이콘 + 설명 + 스탯)
  2. 5초 타이머 프로그레스 바
  3. 시너지 힌트 카드 (골드 테두리)
  4. BuildHUD: 보유 무기 아이콘 (Lv 표시) + 패시브 아이콘 (스택 수)
  5. 활성 시너지 표시 (아이콘 + 이름)
- **verify**: 레벨업 UI 표시, 선택 → 서버 반영, 빌드 HUD 정확

## Phase 4 — 데스매치 & 보상

### S18: 평화/전투 페이즈 전환
- **file**: server/internal/game/epoch.go (확장)
- **ref**: S02 (에포크 시스템)
- **blocked_by**: S12
- **do**:
  1. PvP ON/OFF 토글 (EpochManager 상태에 따라)
  2. 전투 시작 3초 전: 경고 사이렌 이벤트
  3. 전투 시작: PvP 데미지 활성화 + war_phase_start 브로드캐스트
  4. 전투 종료: PvP 데미지 비활성화 + war_phase_end 브로드캐스트
  5. 평화 페이즈 중 오브 스폰률 2배
- **verify**: PvP 토글 정확, 전환 이벤트 전송

### S19: NPC 몬스터 시스템
- **file**: server/internal/game/npc_monster.go
- **ref**: server/internal/game/orb.go (오브 시스템 참조)
- **blocked_by**: S18
- **do**:
  1. 3종 NPC: 약(20XP, HP50), 중(35XP, HP100), 강(50XP, HP200)
  2. 평화 페이즈에만 스폰 (30초마다 5~10마리)
  3. NPC AI: 랜덤 이동 + 플레이어 접근 시 도주
  4. 처치 시 XP 오브 드롭
  5. 전투 페이즈 시작 시 잔존 NPC 제거
- **verify**: NPC 스폰/AI/처치/XP 드롭

### S20: 킬 보상 & 스코어링
- **file**: server/internal/game/scoring.go (리워크), server/internal/game/kill_reward.go
- **ref**: server/internal/game/scoring.go (기존 스코어링)
- **blocked_by**: S18
- **do**:
  1. 킬 보상: XP(100+적lv×10), 골드(50+적lv×5), 국가점수(10+적lv×2)
  2. 어시스트 판정: 5초 내 데미지 기여 → 40% 보상
  3. 킬 시 적 보유 XP의 20% 오브 드롭
  4. 에포크 NationScore 누적: Kills×10 + Assists×4 + Level×5 + Survival×2 + Objectives×3
  5. 에포크 종료 시 스코어보드 데이터 생성
- **verify**: 킬 보상 정확, 국가 점수 집계

### S21: 안티-스노우볼 메카닉
- **file**: server/internal/game/antisnowball.go
- **ref**: —
- **blocked_by**: S20
- **do**:
  1. 언더독 보너스: 레벨 차 × 20% 추가 XP (하위 레벨이 상위 킬 시)
  2. 현상수배: 5 연속킬 → 미니맵에 위치 공개 + 킬 시 3배 보상
  3. 리스폰 보호: 빌드 손실 없음
  4. 평화 페이즈 NPC 파밍 보장 (전투 못해도 성장)
- **verify**: 언더독 보너스 계산, 현상수배 발동/해제

### S22: 에포크 HUD & 스코어보드 클라이언트
- **file**: apps/web/components/game/EpochHUD.tsx (확장), apps/web/components/game/ScoreboardOverlay.tsx
- **ref**: S06 (기존 EpochHUD)
- **blocked_by**: S20, S06
- **do**:
  1. EpochHUD 확장: 킬/데스/어시스트 카운터, 국가 점수 미니 표시
  2. 전투 시작 연출: 화면 가장자리 빨간 비네트 + 경고 텍스트
  3. ScoreboardOverlay (Tab키): 전체 플레이어 순위, 국가별 점수
  4. 에포크 종료 결과: MVP 선정, 개인 성적, 국가 순위
  5. 아레나 축소 시각 효과 (안전지대 원형 표시)
- **verify**: HUD 데이터 정확, 스코어보드 레이아웃, 축소 시각화

## Phase 5 — 지배 시스템

### S23: 에포크 점수 집계 엔진
- **file**: server/internal/game/nation_score.go
- **ref**: S20 (킬 보상 & 스코어링)
- **blocked_by**: S20
- **do**:
  1. NationScoreTracker: 에포크별 국가 점수 누적
  2. 에포크 종료 시 국가별 총점 계산
  3. 6 에포크(1시간) 분량 점수 히스토리 보관
  4. 국가별 Top 3 기여자 추적
- **verify**: 국가 점수 누적 정확, 히스토리 보관

### S24: 지배 평가 엔진 (1시간)
- **file**: server/internal/game/domination.go
- **ref**: —
- **blocked_by**: S23
- **do**:
  1. DominationEngine: 매 1시간(6에포크) 후 평가 실행
  2. DominationScore = Σ(epoch1~6 NationScore)
  3. 지배국 결정: 최고 점수 > 동점 타이브레이커 > 최소 임계값(100)
  4. 현 지배국 방어 보너스 +10%
  5. 지배국 전환 시 알림 이벤트 + 15분 방어 보너스 +20%
  6. 전체 리셋: 레벨 1, 빌드 초기화
- **verify**: 지배 평가 정확, 전환 알림, 리셋 동작

### S25: 통치권 & 헤게모니
- **file**: server/internal/game/sovereignty.go
- **ref**: S24 (지배 평가)
- **blocked_by**: S24
- **do**:
  1. 24시간 연속 지배 감지 → Sovereignty 플래그
  2. 통치 버프: +10% XP, +5% 이속, +20% 점령속도
  3. 7일 연속 통치 → Hegemony 플래그
  4. Hegemony 달성 시 정책 변경 API 해금
  5. Hegemony 상실 시 정책 2주 유지 후 기본값 복귀
- **verify**: 통치권 24시간 감지, 헤게모니 7일 감지, 버프 적용

### S26: 글로브 지배 맵 반영
- **file**: apps/web/components/3d/GlobeDominationLayer.tsx
- **ref**: apps/web/components/3d/GlobeScene.tsx (기존 글로브)
- **blocked_by**: S24
- **do**:
  1. 국가별 지배 색상 메시 업데이트 (지배국 대표색)
  2. 통치권: 부드러운 펄스 글로우 (shader uniform)
  3. 헤게모니: 강한 글로우 + 크라운 아이콘
  4. 지배 전환: 2초 fade 애니메이션
  5. 미지배: 회색 (#666)
- **verify**: 지배 색상 반영, 글로우 효과, 전환 애니메이션

## Phase 6 — 문명 레이어

### S27: 정책 시스템 서버
- **file**: server/internal/game/policy.go, server/internal/domain/policies.go
- **ref**: —
- **blocked_by**: S25
- **do**:
  1. 10대 정책 카테고리 데이터 정의 (국교, 공용어, 정치체제 등)
  2. 각 카테고리 3단계 선택지 + 게임플레이 효과
  3. PolicyManager: 헤게모니 국가만 변경 허용
  4. 주 1회 변경 제한 (월요일 00:00 UTC 이후)
  5. 6시간 유예 기간 → 다음 에포크부터 효과 반영
  6. set_policy C→S 이벤트 + policy_changed S→C 브로드캐스트
- **verify**: 정책 변경 권한 검증, 효과 적용, 쿨다운

### S28: 국가 지표 엔진
- **file**: server/internal/game/nation_stats.go
- **ref**: S27 (정책 효과)
- **blocked_by**: S27
- **do**:
  1. 8대 지표: 행복, 출산율, GDP, 군사력, 기술수준, 충성도, 인구, 국제평판
  2. 지표 계산 공식 (정책 합계 + 전쟁 상태 + 지배 안정성)
  3. 지표 간 피드백 루프 (행복↑→출산율↑→인구↑→GDP↑)
  4. 에포크 종료 시 전투 기반 지표 갱신
  5. 1시간(지배 평가 시) 정책 기반 지표 전체 재계산
  6. nation_stats_update S→C 이벤트
- **verify**: 지표 계산 정확, 피드백 루프 동작, 이벤트 전송

### S29: 문명 대시보드 클라이언트
- **file**: apps/web/components/civilization/CivilizationPanel.tsx, apps/web/components/civilization/PolicyManager.tsx, apps/web/components/civilization/StatsChart.tsx
- **ref**: apps/web/components/world/CountryPanel.tsx (기존 국가 패널)
- **blocked_by**: S28
- **do**:
  1. CivilizationPanel: 정책 관리 + 지표 대시보드 통합 뷰
  2. PolicyManager: 10대 정책 카드, 현재 선택 표시, 변경 UI (헤게모니만)
  3. StatsChart: 8대 지표 게이지/바 차트 + 추세 화살표
  4. CountryPanel에 CIVILIZATION 탭 추가 (기존 4탭 → 5탭)
  5. 정책 변경 확인 모달 (효과 미리보기)
- **verify**: 정책 UI 표시/변경, 지표 차트 렌더링

### S30: 글로브 지표 오버레이
- **file**: apps/web/components/3d/GlobeHoverPanel.tsx
- **ref**: S26 (글로브 지배)
- **blocked_by**: S29
- **do**:
  1. 마우스 호버 시 국가 정보 패널 표시
  2. 요약: 국기 + 지배국 + 주요 지표 4개 (행복/GDP/군사/인구)
  3. 상태 배지: 전쟁 중 / 통치권 / 헤게모니
  4. "클릭하여 입장" 버튼
  5. 패널 위치: 마우스 따라가기 + 화면 가장자리 클램프
- **verify**: 호버 패널 표시, 데이터 정확, 위치 정상

## Phase 7 — 전쟁 시스템

### S31: 전쟁 상태 머신 서버
- **file**: server/internal/game/war.go, server/internal/game/war_state.go
- **ref**: —
- **blocked_by**: S25
- **do**:
  1. WarSystem: 선전포고→24시간 준비기→활성(최대 72시간)→종료
  2. 선전포고 조건: 헤게모니 국가 또는 3개국 이상 공동
  3. 대상: 인접 국가 또는 같은 대륙
  4. 전쟁 쿨다운: 종료 후 24시간
  5. declare_war C→S, war_declared/war_ended S→C 이벤트
- **verify**: 전쟁 상태 전환, 조건 검증, 이벤트

### S32: 크로스-아레나 침공
- **file**: server/internal/game/cross_arena.go
- **ref**: S01 (CountryArenaManager)
- **blocked_by**: S31
- **do**:
  1. 전쟁 중 적국 아레나 입장 허용 (정원 +20 추가)
  2. 전쟁 전용 점수: 킬×15 + 점령×30 + 방어×10
  3. 침공군/방어군 색상 구분 (빨강/파랑)
  4. 보급선: 점령 포인트 → 리스폰 지점 변경
  5. 전쟁 피로도: 72시간 초과 시 양측 -5% DPS/일
- **verify**: 크로스-아레나 입장, 전쟁 점수, 피로도

### S33: 전쟁 보상 & 동맹
- **file**: server/internal/game/war_resolution.go, server/internal/game/alliance.go
- **ref**: S28 (국가 지표)
- **blocked_by**: S32
- **do**:
  1. 전쟁 종료: 승리국(+30% GDP, +20% 군사, +10 행복), 패전국(-30% GDP, -20% 군사, -20 행복)
  2. 자동 항복: 전쟁 점수 3배 격차
  3. AllianceManager: 최대 5개국, 헤게모니/통치권 체결
  4. 동맹국 참전 선택적, 아군 취급
  5. 동맹 배신: -50 국제 평판
- **verify**: 보상/페널티 적용, 동맹 체결/탈퇴

### S34: 글로브 전쟁 연출
- **file**: apps/web/components/3d/GlobeWarEffects.tsx
- **ref**: S26 (글로브 지배)
- **blocked_by**: S31
- **do**:
  1. 전쟁 선포: 양국 간 붉은 점선 아크 라인
  2. 양국 영토 가장자리 빨간 점멸 (0.5Hz)
  3. 폭발 파티클 국경 부근 랜덤
  4. 전쟁 진행: 아크 위 이동 화살표 파티클
  5. 전쟁 종료: 승리국 금색 폭죽, 패전국 색상 전환
  6. 카메라 자동 회전 (전쟁 지역으로)
- **verify**: 전쟁 연출 시각 효과, 카메라 이동

## Phase 8 — 글로브 & 로비 통합

### S35: 이벤트 티커 & 뉴스 시스템
- **file**: apps/web/components/lobby/EventTicker.tsx, server/internal/game/event_log.go
- **ref**: apps/web/components/lobby/LobbyHeader.tsx
- **blocked_by**: S24, S31
- **do**:
  1. EventLog 서버: 지배 변경, 전쟁 선포/종료, 헤게모니 달성 기록
  2. global_events S→C 브로드캐스트 (로비 소켓)
  3. EventTicker: LobbyHeader 하단 롤링 뉴스 밴드
  4. 이벤트 타입별 아이콘 + 국기 + 메시지
  5. 클릭 시 해당 국가 아레나/글로브 포커스
- **verify**: 이벤트 표시, 롤링 애니메이션, 클릭 동작

### S36: 인게임↔로비 전환
- **file**: apps/web/app/page.tsx, apps/web/providers/SocketProvider.tsx
- **ref**: apps/web/app/page.tsx (기존 모드 전환)
- **blocked_by**: S06
- **do**:
  1. ESC 키 → 인게임에서 글로브 로비로 복귀 (소켓 유지)
  2. 글로브 국가 클릭 → 해당 국가 아레나 즉시 입장
  3. SocketProvider: 아레나 전환 시 소켓 재연결 없이 room 변경
  4. 전환 애니메이션: 300ms fade (기존)
  5. 로비 복귀 시 현재 에포크 상태 요약 표시
- **verify**: 전환 매끄러움, 소켓 유지, 상태 보존

### S37: 거점 점령 시스템
- **file**: server/internal/game/capture_point.go, apps/web/components/3d/CapturePointRenderer.tsx
- **ref**: —
- **blocked_by**: S18
- **do**:
  1. 아레나당 3 전략 포인트: 자원(+XP), 버프(+DMG), 힐링(+HP/s)
  2. 점령: 5초 체류 (경합 시 중단)
  3. 점령 완료 → 2분 유지 → 중립화
  4. CapturePointRenderer: 3D 거점 표시 (빔 + 원형 영역 + 국기)
  5. 전쟁 시: 거점 = 전쟁 목표로 전환
- **verify**: 점령 메카닉, 버프 적용, 시각 표시

### S38: 관전 시스템
- **file**: apps/web/components/game/SpectatorMode.tsx
- **ref**: —
- **blocked_by**: S06
- **do**:
  1. 아레나 풀(50명) 시 관전 모드 입장
  2. 자유 카메라: 마우스 드래그 이동, 스크롤 줌
  3. 플레이어 팔로우: 클릭으로 특정 플레이어 추적
  4. 관전자 수 표시 (아레나 정보에 포함)
  5. 관전 → 빈자리 생기면 참가 전환 버튼
- **verify**: 관전 카메라, 팔로우, 참가 전환

## Phase 9 — 메타 프로그레션 & 이코노미

### S39: 계정 레벨 시스템
- **file**: server/internal/game/account_level.go
- **ref**: —
- **blocked_by**: S20
- **do**:
  1. 매치 결과 → 계정 XP (에포크 성적 기반)
  2. 계정 레벨 1→∞ (인메모리, 세션 기반 — 향후 DB)
  3. 레벨업 보상: 코스메틱 코인, 칭호 해금
  4. 프로필에 계정 레벨 표시
- **verify**: 계정 XP 누적, 레벨업 동작

### S40: 일일 도전 & 업적
- **file**: server/internal/game/challenges.go, server/internal/game/achievements.go
- **ref**: —
- **blocked_by**: S39
- **do**:
  1. 일일 도전: 매일 3개 랜덤 (10킬, 5에포크 생존, 거점 3개 점령 등)
  2. 도전 완료 보상: XP 부스트, 코스메틱 코인
  3. 업적 30종: "첫 헤게모니", "100킬", "모든 무기 Lv5" 등
  4. 업적 보상: 칭호, 특수 이모지, 프로필 뱃지
  5. achievements_update S→C 이벤트
- **verify**: 도전 생성/완료, 업적 해금, 보상 지급

### S41: 토큰 이코노미 연동
- **file**: server/internal/game/token_rewards.go
- **ref**: server/internal/blockchain/ (기존 v11 블록체인)
- **blocked_by**: S39
- **do**:
  1. 지배 보상: 해당 국가 토큰 소량 지급 (국가점수 비례)
  2. 헤게모니 보상: 주간 AWW 토큰 보너스
  3. 기존 v11 블록체인 인프라 재활용 (Defense Oracle, Buyback)
  4. 보상 이벤트 → CROSSx 지갑 연동 (기존 UI)
- **verify**: 보상 계산, 토큰 이벤트 전송

## Phase 10 — 폴리시 & 밸런스

### S42: 무기 밸런스 시뮬레이션
- **file**: server/cmd/balance/main.go
- **ref**: server/cmd/balance/ (기존 밸런스 도구)
- **blocked_by**: S16
- **do**:
  1. 봇 vs 봇 자동 전투 시뮬레이션 (1000판)
  2. 무기별 승률, 시너지별 승률 통계
  3. OP 빌드 감지 (승률 60% 이상)
  4. 밸런스 조정 권고 리포트 생성
- **verify**: 시뮬레이션 실행, 통계 출력

### S43: 성능 최적화
- **file**: (여러 파일 프로파일링 기반)
- **ref**: —
- **blocked_by**: S13
- **do**:
  1. 50명 동시 전투 서버 틱 프로파일링 (< 50ms)
  2. 클라이언트 FPS 벤치마크 (60FPS 목표)
  3. 무기 이펙트 LOD 조정
  4. 네트워크 대역폭 최적화 (< 50KB/s)
  5. 비활성 아레나 메모리 해제 확인
- **verify**: 서버 틱 < 50ms, 클라이언트 60FPS, 대역폭 < 50KB/s

### S44: 튜토리얼 구현
- **file**: apps/web/components/game/Tutorial.tsx
- **ref**: —
- **blocked_by**: S22
- **do**:
  1. 6단계 온보딩: 캐릭터 생성 → 이동 → 레벨업 → 데스매치 → 지배 → 글로브
  2. 반투명 오버레이 + 하이라이트 + 안내 텍스트
  3. 첫 접속 시 자동 시작, 이후 스킵 가능
  4. 각 단계 트리거: 이벤트 기반 (첫 레벨업, 첫 에포크 등)
- **verify**: 튜토리얼 6단계 완주, 스킵 동작

### S45: E2E 통합 테스트
- **file**: tests/e2e/
- **ref**: —
- **blocked_by**: S44
- **do**:
  1. 캐릭터 생성 → 아레나 입장 플로우
  2. 에포크 사이클 (평화→전투→종료) 검증
  3. 레벨업 + 무기 획득 + 시너지 발동
  4. 지배 평가 + 글로브 반영
  5. 전쟁 선포 → 종료 사이클
  6. 인게임↔로비 전환
- **verify**: 전체 게임 루프 E2E 통과
