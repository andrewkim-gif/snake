# Roadmap: v12 게임플레이 폴리시

> da:work roadmap 모드 호환. 각 Step은 `### SNN:` 형식.
> 참조: docs/designs/v12-gameplay-polish-plan.md

## Phase 0 — 즉시 게임 시작 (Critical Path)

### S01: 서버 — joined 이벤트에 terrainTheme 추가
- **file**: server/internal/ws/protocol.go, server/internal/world/country_arena.go, server/internal/game/room.go
- **ref**: packages/shared/src/types/events.ts (JoinedPayload)
- **blocked_by**: none
- **do**:
  1. protocol.go: JoinedPayload에 `TerrainTheme string` 필드 추가
  2. country_arena.go: GetJoinedEvent()에서 ca.TerrainTheme을 페이로드에 포함
  3. room.go: RoomConfig에 TerrainTheme 필드 추가, GetJoinedPayload()에서 전달
  4. shared types: JoinedPayload에 terrainTheme?: string 추가
- **verify**: `go build ./...` 성공, joined 이벤트에 terrainTheme 포함 확인

### S02: 서버 — CountdownSec 0초 + 봇 즉시 스폰
- **file**: server/internal/world/world_manager.go, server/internal/game/room.go, server/internal/game/bot.go
- **ref**: server/internal/world/world_config.go
- **blocked_by**: none
- **do**:
  1. WorldConfig.CountdownSec 기본값을 0으로 변경 (또는 3초)
  2. room.go: CountdownSec=0이면 즉시 startRound() 호출
  3. bot.go: round_start 시 봇 즉시 스폰 보장 (지연 없이)
  4. 테스트: MinPlayersToStart=1일 때 즉시 시작 확인
- **verify**: 플레이어 1명 참가 → 0~3초 내 playing 상태 전환

### S03: 서버 — scoring + round_end sovereignty + battle_complete 이벤트
- **file**: server/internal/game/scoring.go (신규), server/internal/ws/protocol.go, server/internal/world/country_arena.go, server/internal/game/room.go
- **ref**: server/internal/world/sovereignty.go, docs/designs/v11-world-war-plan.md §4.1 §5.1
- **blocked_by**: S01
- **do**:
  1. scoring.go 신규: CalcBattleScore(alive, kills, level, damage, survivalSec) → 생존: Base100+kills×15+level×10+damage×0.5 / 사망: kills×15+level×10+damage×0.5+survivalSec×2
  2. protocol.go: RoundEndPayload에 WinnerFaction, SovereigntyChange, TopPlayers(+score), ScoringBreakdown 필드 추가
  3. protocol.go: BattleCompletePayload 신규 정의 (cooldown 종료 시)
  4. country_arena.go: round_end 시 scoring.go로 스코어 계산 + sovereignty 전환 (20% 우위 + 최소 3명 규칙)
  5. room.go: cooldown → waiting 전환 시 battle_complete 이벤트 emit
  6. room.go: 리스폰 비활성화 (1 life, 30초 grace period만 유지)
- **verify**: round_end에 스코어링 + sovereignty 데이터 포함, cooldown 후 battle_complete 수신

### S04: 클라이언트 — 이벤트 핸들러 + 1-life + 자동 복귀
- **file**: apps/web/hooks/useSocket.ts, apps/web/app/page.tsx
- **ref**: apps/web/components/game/GameCanvas3D.tsx
- **blocked_by**: S03
- **do**:
  1. useSocket.ts: joined 이벤트에서 terrainTheme 저장 (UiState에 추가)
  2. useSocket.ts: battle_complete 이벤트 핸들러 추가
  3. UiState에 terrainTheme, battleResult, isSpectating 필드 추가
  4. **death 이벤트 → isSpectating=true (리스폰 비활성, 관전 모드 전환)**
  5. page.tsx: battle_complete 수신 → 10초 후 자동 leaveRoom() + mode='lobby'
  6. GameCanvas3D에 terrainTheme prop 전달
  7. **respawn 버튼 비활성화** (1-life 시스템: 사망 후 배틀 종료까지 관전)
- **verify**: 국가 클릭 → 즉시 게임 시작, 사망 → 관전 모드, 배틀 종료 → 10초 후 로비 복귀

## Phase 1 — 캐릭터 얼굴 수정 + 프리셋

### S05: VoxelCharacter 얼굴 방향 수정
- **file**: apps/web/components/3d/VoxelCharacter.tsx
- **ref**: apps/web/components/3d/HeadGroupManager.tsx
- **blocked_by**: none
- **do**:
  1. BoxGeometry face 매핑 코멘트를 정확하게 수정: [+X,-X,+Y,-Y,+Z,-Z]
  2. +Z face = 정면(얼굴) 확정, 모든 material 배열 검증
  3. 캐릭터 기본 rotation 확인: 정면이 카메라를 향하는지
  4. 로비 프리뷰에서 얼굴이 정면에 보이는지 테스트
- **verify**: 로비에서 캐릭터 정면에 얼굴 표시

### S06: HeadGroupManager 인게임 얼굴 동기화
- **file**: apps/web/components/3d/HeadGroupManager.tsx, apps/web/lib/3d/agent-textures.ts
- **ref**: apps/web/components/3d/VoxelCharacter.tsx (S05 결과)
- **blocked_by**: S05
- **do**:
  1. HeadGroupManager의 material 배열을 VoxelCharacter과 동일하게 정리
  2. agent-textures.ts의 face 인덱스 코멘트 수정
  3. 인게임에서 에이전트 이동 방향에 따라 head mesh rotation 적용
  4. EyeInstances.tsx의 eye overlay 위치도 +Z face 기준으로 확인
- **verify**: 인게임에서 모든 에이전트 얼굴이 이동 방향 정면에 표시

### S07: 캐릭터 테마 프리셋 8종
- **file**: apps/web/components/lobby/CharacterCreator.tsx, packages/shared/src/types/appearance.ts
- **ref**: —
- **blocked_by**: S05
- **do**:
  1. THEMED_PRESETS 배열 정의 (8종):
     - Soldier: 카모 패턴, 헬멧, 녹색, 부츠
     - Hacker: 후드, 검정, 바이저 눈, 키보드 백아이템
     - Scientist: 흰 가운, 고글, 대머리/단발
     - Ninja: 검정, 마스크 입, 카타나 무기
     - Pilot: 비행모자, 고글, 갈색 자켓
     - Medic: 흰색, 레드크로스 마킹, 의료가방
     - Pirate: 안대(eye), 해적모자, 갈고리 무기
     - Robot: 은색, 바이저, 안테나 헤어, 메탈 부츠
  2. CharacterCreator 프리셋 탭에 8종 카드 그리드 추가
  3. 각 프리셋 선택 시 appearance 전체 덮어쓰기
- **verify**: 8종 프리셋 선택 → 3D 프리뷰 반영

### S08: 테마 기반 랜덤 생성
- **file**: apps/web/components/lobby/CharacterCreator.tsx
- **ref**: —
- **blocked_by**: S07
- **do**:
  1. "랜덤" 버튼 → 테마 카테고리 드롭다운 (전체/군사/사이버/자연/판타지)
  2. 카테고리별 색상 범위 + 장비 풀 제한
  3. 완전 랜덤도 유지 (기존 기능)
- **verify**: 카테고리 선택 후 랜덤 → 해당 테마 범위 내 생성

## Phase 2 — 6종 국가별 테마 맵 + 전투 보너스

### S09a: 서버 — 테마별 전투 보너스 엔진
- **file**: server/internal/game/terrain_bonus.go (신규), server/internal/game/agent.go, server/internal/game/room.go
- **ref**: docs/designs/v11-world-war-plan.md §4.4 (terrain combat bonuses)
- **blocked_by**: S01
- **do**:
  1. terrain_bonus.go 신규: TerrainModifiers struct {SpeedMult, DamageMult, VisionMult, OrbMult, ShrinkMult float64}
  2. GetTerrainModifiers(theme string) 함수:
     - "forest": DamageReceiveMult=0.8 (나무 근처)
     - "desert": SpeedMult=0.9, VisionMult=1.2
     - "mountain": DPSMult=1.15, SpeedMult=0.85
     - "urban": RangedDamageMult=0.7
     - "arctic": SpeedMult=0.8, OrbMult=0.7
     - "island": ShrinkMult=1.5
  3. room.go: Room 초기화 시 terrainTheme에서 modifiers 로드
  4. agent.go: 매 틱 ApplyTerrainModifiers() — 이동속도/데미지에 modifier 적용
  5. arena shrink: ShrinkMult를 ArenaShrinkRate에 곱하기
- **verify**: `go build ./...` 성공, forest 테마에서 데미지 0.8x 확인, island에서 쉬링크 1.5x 확인

### S09: 테마별 텍스처 시스템
- **file**: apps/web/lib/3d/terrain-textures.ts (신규)
- **ref**: apps/web/components/3d/VoxelTerrain.tsx (기존 Canvas 텍스처)
- **blocked_by**: none
- **do**:
  1. createTerrainTextures(theme: TerrainTheme) 함수
  2. 각 테마별 Canvas 텍스처 세트 생성:
     - ground, side, accent, water, special
  3. 16×16 픽셀아트 스타일 유지 (NearestFilter)
  4. 테마별 색상 팔레트 정의
- **verify**: 6종 텍스처 세트 생성 확인, 각 < 50KB

### S10: Forest 테마 구현
- **file**: apps/web/components/3d/VoxelTerrain.tsx, apps/web/components/3d/TerrainDeco.tsx
- **ref**: apps/web/lib/3d/terrain-textures.ts (S09)
- **blocked_by**: S09
- **do**:
  1. VoxelTerrain: theme="forest" → 초록 잔디 텍스처, 이끼 바위
  2. TerrainDeco: 나무 25개 (기존 대비 +5), 꽃 40개, 버섯 10개
  3. 낙엽 파티클 (저밀도, 5개/초)
  4. 안개 효과 (FogExp2, density 0.008)
  5. **전투 보너스 시각 표시**: 나무 근처 -20% 피격 → 나무 주변 녹색 오라 (optional indicator)
- **verify**: forest 테마 렌더링, 60FPS, 시각적 차별성

### S11: Desert 테마 구현
- **file**: apps/web/components/3d/VoxelTerrain.tsx, apps/web/components/3d/TerrainDeco.tsx
- **ref**: apps/web/lib/3d/terrain-textures.ts (S09)
- **blocked_by**: S09
- **do**:
  1. 모래 텍스처 (#C4A661 베이스 + 변형), 사구(낮은 언덕)
  2. 데코: 선인장 15개, 바위 20개, 오아시스 1개 (물 원)
  3. 열기 이펙트 (화면 상단 distortion? → 단순 파티클로 대체)
  4. 밝은 조명 (DirectionalLight intensity 1.5)
- **verify**: desert 테마 렌더링, sand 색상 확인

### S12: Mountain 테마 구현
- **file**: apps/web/components/3d/VoxelTerrain.tsx, apps/web/components/3d/TerrainDeco.tsx
- **ref**: —
- **blocked_by**: S09
- **do**:
  1. 회색 바위 텍스처, 높은 언덕 (높이 3-5, 기존 1-2)
  2. 눈 덮인 봉우리 (높이 4+ → 흰색 top 텍스처)
  3. 데코: 침엽수 10개, 바위 30개, 동굴 입구 2개
  4. 어두운 조명 + 안개 (FogExp2 density 0.012)
- **verify**: mountain 테마 렌더링, 고도차 체감

### S13: Urban 테마 구현
- **file**: apps/web/components/3d/VoxelTerrain.tsx, apps/web/components/3d/TerrainDeco.tsx
- **ref**: —
- **blocked_by**: S09
- **do**:
  1. 콘크리트 텍스처 (#808080), 도로 라인 (#FFFF00 줄)
  2. 건물 블록 (8×12×8, 4×20×4 등 다양한 크기) 15개
  3. 가로등 (얇은 기둥 + emissive 구) 10개
  4. 자동차 블록 (데코) 5개
- **verify**: urban 테마 렌더링, 건물 사이 이동 가능

### S14: Arctic 테마 구현
- **file**: apps/web/components/3d/VoxelTerrain.tsx, apps/web/components/3d/TerrainDeco.tsx
- **ref**: —
- **blocked_by**: S09
- **do**:
  1. 눈 텍스처 (#E8E8F0), 얼음 블록 (반투명 #88BBFF)
  2. 빙산 데코 (큰 얼음 블록 5개, 불규칙 형태)
  3. 눈 파티클 (하강, 20개/초, 느린 속도)
  4. 파란 톤 조명 (DirectionalLight color #AABBFF)
- **verify**: arctic 테마 렌더링, 눈 파티클 동작

### S15: Island 테마 구현
- **file**: apps/web/components/3d/VoxelTerrain.tsx, apps/web/components/3d/TerrainDeco.tsx
- **ref**: —
- **blocked_by**: S09
- **do**:
  1. 모래 해변 텍스처 (중앙 잔디, 외곽 모래, 최외곽 물)
  2. 야자수 데코 8개 (구부러진 trunk + 잎 canopy)
  3. 물 테두리 (아레나 경계 외곽에 반투명 파란 평면)
  4. 작은 아레나 느낌 (기존 radius 유지, 시각적으로 섬 느낌)
- **verify**: island 테마 렌더링, 해변 경계 표시

### S16: VoxelTerrain 테마 통합 + 서버 연결
- **file**: apps/web/components/3d/VoxelTerrain.tsx, apps/web/components/game/GameCanvas3D.tsx
- **ref**: S01 (joined 이벤트의 terrainTheme), S09a (terrain_bonus.go)
- **blocked_by**: S01, S09a, S10, S11, S12, S13, S14, S15
- **do**:
  1. VoxelTerrain에 terrainTheme prop 추가
  2. theme에 따라 createTerrainTextures(theme) + placeDecorations(theme) 분기
  3. GameCanvas3D에서 uiState.terrainTheme을 VoxelTerrain에 전달
  4. 테마 없으면 기본 forest 폴백
  5. **테마별 전투 보너스 HUD 표시**: 입장 시 "Desert: -10% Speed, +20% Vision" 토스트 메시지
- **verify**: 6종 국가에서 각각 다른 맵 + 전투 보너스 HUD 표시

## Phase 3 — 스킬 발동 이펙트

### S17: AbilityEffects.tsx 기반 구조
- **file**: apps/web/components/3d/AbilityEffects.tsx (신규)
- **ref**: apps/web/components/3d/MCParticles.tsx, apps/web/components/3d/BuildEffects.tsx
- **blocked_by**: none
- **do**:
  1. 에이전트 네트워크 데이터에서 activeAbility 상태 읽기
  2. 어빌리티 타입별 이펙트 렌더링 분기
  3. InstancedMesh 기반 이펙트 풀링
  4. 이펙트 수명 관리 (0.5~2초)
  5. GameCanvas3D에 AbilityEffects 컴포넌트 추가
- **verify**: 컴포넌트 마운트 성공, 빈 상태에서 에러 없음

### S18: 서버 — ability_triggered 이벤트
- **file**: server/internal/game/agent.go, server/internal/game/room.go, server/internal/ws/protocol.go
- **ref**: server/internal/domain/upgrades.go
- **blocked_by**: none
- **do**:
  1. protocol.go: AbilityTriggeredPayload {agentId, abilityType, targetX, targetY, level}
  2. agent.go: 어빌리티 발동 시 이벤트 emit
  3. room.go: ability_triggered를 클라이언트에 broadcast
  4. state 패킷에 각 에이전트의 activeAbility 필드 추가 (또는 별도 이벤트)
- **verify**: 어빌리티 발동 시 ability_triggered 이벤트 전송

### S19: 6종 어빌리티 이펙트 렌더링
- **file**: apps/web/components/3d/AbilityEffects.tsx
- **ref**: S17, S18
- **blocked_by**: S17, S18
- **do**:
  1. Venom Aura: 초록 파티클 링 (에이전트 반경 60px, 저밀도)
  2. Shield Burst: 파란 반구 SphereGeometry → scale 0→1 (0.3초) → 페이드
  3. Lightning Strike: 노란 CylinderGeometry (타겟 연결) + 화면 전체 플래시
  4. Speed Dash: BuildEffects의 기존 trail 강화 + 바닥 스피드라인
  5. Mass Drain: 보라 빔 (thin cylinder) + 타겟→시전자 파티클 이동
  6. Gravity Well: 보라 TorusGeometry 소용돌이 + 중심으로 빨려드는 파티클
- **verify**: 각 어빌리티 발동 시 해당 이펙트 표시, FPS 영향 < 5%

## Phase 4 — 배틀 결과 + 점령 UI

### S20: BattleResultOverlay 컴포넌트 + 관전 모드
- **file**: apps/web/components/game/BattleResultOverlay.tsx (신규 또는 기존 RoundResultOverlay 확장), apps/web/components/game/SpectatorMode.tsx (신규)
- **ref**: apps/web/components/game/RoundResultOverlay.tsx, docs/designs/v11-world-war-plan.md §4.1
- **blocked_by**: S03, S04
- **do**:
  1. 배틀 종료 시 전체화면 오버레이
  2. 승리 팩션 이름 + 색상 + 아이콘
  3. 점령 변화: "KOREA: [Red] → [Blue] (Sovereignty Lv2)"
  4. **개인 스코어 (v11 공식)**: 생존=Base100+kills×15+level×10+damage×0.5 / 사망=kills×15+level×10+damage×0.5+survivalSec×2
  5. 10초 자동 복귀 타이머 + "재배치" 버튼
  6. "같은 국가 재진입" 버튼
  7. **SpectatorMode.tsx**: 사망 후 자유 카메라 관전 (미니맵 클릭으로 이동, 다른 에이전트 팔로우)
  8. **1-life 처리**: 사망 → 관전 모드 전환 (리스폰 버튼 비활성) → 배틀 종료까지 대기
- **verify**: 배틀 종료 → 스코어링 표시 → 10초 후 로비, 사망 시 관전 모드 정상 동작

### S21: 지구본 실시간 점령 반영 + 주권 전환 규칙
- **file**: apps/web/components/world/GlobeView.tsx, apps/web/hooks/useSocket.ts, server/internal/world/sovereignty.go
- **ref**: server/internal/world/world_manager.go (broadcastCountriesState), docs/designs/v11-world-war-plan.md §5.1-5.2
- **blocked_by**: S03
- **do**:
  1. sovereignty.go: 주권 전환 조건 검증 — **승리 팩션이 기존 대비 20% 이상 우위 + 최소 3명 에이전트 참여**
  2. sovereignty.go: 5단계 주권 레벨 (Lv1 약한 영향 → Lv5 완전 점령) + 단계별 보너스 표시
  3. countries_state 브로드캐스트에 factionColor + sovereigntyLevel 포함
  4. GlobeView에서 국가 폴리곤 색상을 팩션 색상 + 투명도(Lv에 비례)로 렌더링
  5. 점령 변경 시 색상 전환 애니메이션 (1초 fade) + 승리 이펙트
- **verify**: 배틀 승리 → 20%+3명 조건 충족 시만 주권 변경, 지구본 색상+Lv 반영

## Phase 5 — 인게임 HUD 폴리시

### S22: 빌드 HUD 아이콘화
- **file**: apps/web/components/game/BuildHUD.tsx
- **ref**: —
- **blocked_by**: none
- **do**:
  1. 톰 스택을 텍스트(SPD×3) → 아이콘(검 아이콘 ×3) 변경
  2. 어빌리티를 쿨다운 타이머 원형 표시
  3. 활성 시너지 아이콘 (골드 테두리)
- **verify**: 빌드 상태 한눈에 파악 가능

### S23: 미니맵 + 팩션 스코어보드
- **file**: apps/web/components/game/MinimapHUD.tsx, apps/web/components/game/FactionScoreboard.tsx (신규)
- **ref**: —
- **blocked_by**: S03
- **do**:
  1. 미니맵 상단에 "KOREA (Tier A)" 국가 이름 표시
  2. FactionScoreboard: 현재 배틀의 팩션별 점수 (킬/생존/레벨)
  3. 실시간 업데이트 (state 패킷에서 추출)
- **verify**: 팩션 스코어보드 표시, 실시간 갱신

### S24: 킬피드 + 사운드 훅
- **file**: apps/web/components/game/KillFeedHUD.tsx, apps/web/hooks/useAudio.ts (신규)
- **ref**: —
- **blocked_by**: none
- **do**:
  1. 킬피드: 슬라이드 인 + 3초 후 페이드 아웃 애니메이션
  2. useAudio 훅: 기본 SFX (킬, 레벨업, 어빌리티 발동)
  3. 테마별 앰비언스 (forest: 새소리, desert: 바람, arctic: 바람+크랙)
  4. 음소거 토글 버튼
- **verify**: 킬 발생 시 피드 애니메이션, 사운드 재생
