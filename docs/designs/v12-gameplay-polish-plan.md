# PLAN: v12 게임플레이 폴리시 & 핵심 기능 완성

> v11 기획 대비 현재 구현 갭을 해소하고, 실제 플레이어블한 게임 경험을 완성하는 기획

## 1. 개요

### 배경
v11 서버 인프라(WorldManager, 16개 메타 엔진, 195국 아레나, 팩션/외교/경제)는 완성되었으나,
**실제 게임 경험**(들어가서 플레이하는 것)에 치명적인 갭이 존재한다.

### 핵심 문제 5가지
| # | 문제 | 심각도 | 근본 원인 |
|---|------|--------|----------|
| 1 | 캐릭터 얼굴 방향 오류 + 개성 부족 | High | BoxGeometry face mapping 혼란 + 단조로운 프리셋 |
| 2 | 게임 진입 후 오래 기다려야 시작 | Critical | CountdownSec=10 + 아레나 초기화 지연 + R3F 마운트 시간 |
| 3 | 맵이 평면 — 국가별 변화 없음 | High | VoxelTerrain 단일 grass 테마, TerrainTheme 미전파 |
| 4 | 스킬 이펙트 부재 / 빌드 체감 약함 | Medium | 시스템 구현됨(8톰+6어빌+10시너지), 시각 피드백 부족 |
| 5 | 5분 배틀 후 점령 결과 안보임 | High | sovereignty 계산은 되지만 결과 UI 없음, auto-return 없음 |

### 목표
- 국가 클릭 → 3초 내 게임 시작 (CountdownSec 0 + 빠른 마운트)
- 6종 국가별 테마 맵 (Forest/Desert/Mountain/Urban/Arctic/Island)
- 캐릭터 얼굴 정면 고정 + 개성 있는 프리셋 8종 추가
- 스킬 발동 시 눈에 보이는 이펙트 6종
- 배틀 종료 → 점령 결과 표시 → 자동 로비 복귀

## 2. 요구사항

### 기능 요구사항
- [FR-1] **캐릭터 얼굴 정면 렌더링**: VoxelCharacter / HeadGroupManager에서 +Z face가 항상 카메라를 향하도록 보장. 인게임에서도 로비 프리뷰와 동일한 얼굴 방향.
- [FR-2] **캐릭터 프리셋 8종 추가**: 군인/해커/과학자/닌자/파일럿/의사/해적/로봇 테마. 각각 고유 색상 조합 + 장비 + 헤어.
- [FR-3] **랜덤 생성 개선**: 현재 완전 랜덤 → 테마 기반 랜덤 (예: "군사 계열" 랜덤 → 카모 패턴 + 헬멧 + 녹색 계열)
- [FR-4] **즉시 게임 시작**: CountdownSec=0 (또는 3초 max). 플레이어 1명이면 봇과 즉시 시작.
- [FR-5] **R3F 프리로드**: 로비에서 GameCanvas3D를 숨긴 채 미리 마운트하여 전환 시 즉시 표시.
- [FR-6] **6종 국가별 테마 맵 + 전투 보너스**: terrainTheme를 서버→클라이언트 전파. VoxelTerrain이 테마별 텍스처/오브젝트/색상 변경. **각 테마에 v11 §4.4 전투 보너스 적용** (서버에서 계산):
  - Forest: 나무 多, 초록 지형, 이끼 바위 | **전투: 나무 뒤에서 -20% 피격 데미지**
  - Desert: 모래 텍스처, 선인장, 바위, 오아시스 | **전투: -10% 이동속도, +20% 시야 범위**
  - Mountain: 높은 고도차, 눈 덮인 봉우리, 바위 | **전투: +15% DPS, -15% 이동속도**
  - Urban: 콘크리트 바닥, 건물 블록, 가로등 | **전투: -30% 원거리 데미지 (건물 차폐)**
  - Arctic: 눈/얼음 텍스처, 빙산, 오로라 파티클 | **전투: -20% 이동속도, -30% 오브 생성량**
  - Island: 모래+물 테두리, 야자수, 작은 아레나 | **전투: 작은 아레나 + 빠른 쉬링크 (1.5x 속도)**
- [FR-7] **스킬 발동 이펙트 6종**: 각 Ability 발동 시 고유 파티클/메시 이펙트
  - Venom Aura: 초록 독안개 파티클
  - Shield Burst: 파란 반구 확장 + 깨지는 효과
  - Lightning Strike: 노란 볼트 메시 + 플래시
  - Speed Dash: 파란 잔상 트레일 강화 (현재 부분 구현)
  - Mass Drain: 보라 빔 연결선 + 흡수 파티클
  - Gravity Well: 보라 소용돌이 + 끌려오는 파티클
- [FR-8] **배틀 종료 결과 오버레이**: 승리 팩션, 점령 변화, 개인 스코어 표시. **v11 §4.1 스코어링 공식 적용**:
  - 생존 시: Base 100 + (킬 × 15) + (레벨 × 10) + (데미지 × 0.5)
  - 사망 시: (킬 × 15) + (레벨 × 10) + (데미지 × 0.5) + (생존시간초 × 2)
- [FR-8.1] **1 Life 배틀**: v11 설계에 따라 **리스폰 없음** (라운드당 1 라이프). 사망 시 관전 모드 → 배틀 종료까지 대기 → 결과 오버레이 → 자동 복귀. (초반 30초 grace period만 유지)
- [FR-9] **자동 로비 복귀**: 배틀 종료 10초 후 자동으로 로비 복귀 (또는 "재배치" 버튼). 사망 시에도 배틀 종료까지 관전 후 결과와 함께 복귀.
- [FR-10] **점령 결과 지구본 반영**: 배틀 결과로 바뀐 국가 색상이 로비 지구본에 즉시 반영. **v11 §5.1 주권 전환 규칙**: 승리 팩션이 기존 주권 대비 20% 이상 우위 + 최소 3명 에이전트 참여 시 주권 변경. 5단계 주권 레벨 (Lv1 약한 영향 → Lv5 완전 점령)

### 비기능 요구사항
- [NFR-1] **성능**: 60 에이전트 + 6종 테마 맵에서 60FPS 유지 (모바일 30FPS)
- [NFR-2] **메모리**: 테마 텍스처 lazy load, 미사용 테마 GC (동시 1개 테마만 GPU에)
- [NFR-3] **로딩**: 국가 클릭 → 게임 렌더링까지 3초 이내
- [NFR-4] **번들**: 테마별 텍스처 각 < 200KB (총 < 1.2MB)
- [NFR-5] **호환**: WebGL2 필수, WebGPU 옵션

## 3. 기술 방향
- **프론트엔드**: Next.js 15 + React Three Fiber (R3F) + Three.js (기존 유지)
- **3D 렌더링**: InstancedMesh 기반 복셀 (기존 유지), 테마별 Canvas 텍스처 생성 확장
- **서버**: Go WebSocket (기존 유지), `joined` 이벤트에 `terrainTheme` 필드 추가
- **상태 전파**: joined 이벤트 확장 → `{id, roomId, roomState, timeRemaining, terrainTheme}`
- **이펙트**: MCParticles.tsx 확장 (기존 6종 → 12종) + AbilityEffects.tsx 신규 (메시 기반 이펙트)
- **캐릭터**: VoxelCharacter.tsx 얼굴 방향 수정 + 프리셋 시스템 추가
- **배틀 결과**: 서버 `round_end` 이벤트에 `sovereignty_change` 데이터 포함

## 4. 아키텍처 변경점
### 서버 변경
```
server/internal/game/room.go
  - GetJoinedPayload() → terrainTheme 필드 추가
  - round_end 이벤트 → sovereignty 결과 + 스코어링 breakdown 포함
  - battle_complete 이벤트 신규 (cooldown 종료 시)
  - 리스폰 비활성화 (1 life per battle, 30초 grace period만)

server/internal/game/terrain_bonus.go (★ 신규)
  - TerrainModifiers struct {SpeedMult, DamageMult, VisionMult, OrbMult, ShrinkMult}
  - GetTerrainModifiers(theme string) → 테마별 전투 보너스 반환
  - Forest: 나무 근처 DamageReceiveMult=0.8
  - Desert: SpeedMult=0.9, VisionMult=1.2
  - Mountain: DPSMult=1.15, SpeedMult=0.85
  - Urban: RangedDamageMult=0.7
  - Arctic: SpeedMult=0.8, OrbMult=0.7
  - Island: ShrinkMult=1.5
  - agent.go: ApplyTerrainModifiers() 매 틱 적용

server/internal/game/scoring.go (★ 신규)
  - CalcBattleScore(alive bool, kills, level int, damage, survivalSec float64) int
  - 생존: Base100 + kills×15 + level×10 + damage×0.5
  - 사망: kills×15 + level×10 + damage×0.5 + survivalSec×2

server/internal/world/country_arena.go
  - terrainTheme을 Room에 전달
  - ProcessBattleResult() 결과를 round_end 페이로드에 포함
  - 주권 전환: 20% 우위 + 최소 3명 규칙 검증

server/internal/ws/protocol.go
  - JoinedPayload에 TerrainTheme string 추가
  - RoundEndPayload에 SovereigntyChange, TopPlayers, ScoringBreakdown 추가
  - BattleCompletePayload 신규
```

### 클라이언트 변경
```
apps/web/components/3d/VoxelTerrain.tsx
  - terrainTheme prop 수신 → 6종 텍스처/오브젝트 분기
  - createTerrainTextures(theme) 함수
  - placeDecorations(theme, arenaRadius) 함수

apps/web/components/3d/VoxelCharacter.tsx
  - 얼굴 face index 확정 (+Z = front)
  - HeadGroupManager 동기화

apps/web/components/3d/AbilityEffects.tsx (신규)
  - 6종 어빌리티 시각 이펙트
  - 에이전트 상태에서 activeAbility 읽어 표시

apps/web/components/game/BattleResultOverlay.tsx (신규)
  - 배틀 종료 후 점령 결과 + 개인 스코어
  - 10초 카운트다운 → 자동 로비 복귀

apps/web/hooks/useSocket.ts
  - battle_complete 이벤트 핸들러
  - joined 이벤트에서 terrainTheme 저장
```

### 데이터 흐름
```
[서버] CountryArena.terrainTheme
  → Room.GetJoinedPayload()
  → WebSocket "joined" {terrainTheme: "desert"}
  → [클라이언트] GameCanvas3D.terrainTheme
  → VoxelTerrain(theme="desert")
  → createDesertTextures() + placeDesertDecorations()

[서버] Room.endRound()
  → CountryArena.ProcessBattleResult()
  → SovereigntyEngine.Process()
  → round_end {winner, sovereigntyChange}
  → [클라이언트] BattleResultOverlay
  → 10초 후 leaveRoom() → lobby
```

## 5. 리스크
| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 6종 테마 텍스처 메모리 초과 | GPU OOM on 모바일 | lazy load + 동시 1테마만 GPU, 텍스처 256px max |
| InstancedMesh 드로콜 증가 | FPS 저하 | 테마별 데코 상한 (나무 20, 꽃 30 etc) |
| 얼굴 방향 수정 시 기존 프리뷰 깨짐 | 로비 프리뷰 회귀 | VoxelCharacter + HeadGroupManager 동시 수정 |
| 즉시 시작(CountdownSec=0) 시 봇 스폰 타이밍 | 빈 아레나 | 봇 즉시 스폰 보장 (BotManager.SpawnBots on round_start) |
| battle_complete 이벤트 누락 | 플레이어 아레나에 갇힘 | 클라이언트 타임아웃 fallback (roundDuration + 30초 후 강제 복귀) |
| 테마별 전투 보너스 밸런스 | 특정 테마 과도한 유/불리 | 시즌 1 데이터 수집 → Era별 보너스 미세 조정 |
| 1-life 시스템 사망 후 관전 | 관전 UX 부족 | 미니맵 + 자유 카메라 관전 모드 제공 |

## 구현 로드맵
### Phase 1: 즉시 게임 시작 (Critical Path)
| Task | 설명 |
|------|------|
| CountdownSec 0초로 변경 | WorldConfig.CountdownSec=0, 봇 즉시 스폰 보장 |
| joined 이벤트에 terrainTheme 추가 | JoinedPayload에 TerrainTheme 필드, CountryArena→Room 전달 |
| battle_complete 이벤트 추가 | cooldown 종료 시 플레이어에게 broadcast, 자동 로비 복귀 |
| round_end에 sovereignty 결과 포함 | 승리 팩션, 점령 변화 데이터를 페이로드에 추가 |
| 클라이언트 이벤트 핸들러 | useSocket.ts에 battle_complete + terrainTheme 처리 |

- **design**: N
- **verify**: 국가 클릭 → 3초 내 게임 시작, 5분 후 결과 표시 + 자동 복귀

### Phase 2: 캐릭터 얼굴 수정 + 프리셋 추가
| Task | 설명 |
|------|------|
| 얼굴 방향 통일 | VoxelCharacter.tsx + HeadGroupManager.tsx에서 +Z=정면 확정, 코멘트 정리 |
| 캐릭터 회전 수정 | 인게임에서 이동 방향으로 몸체 회전 시 얼굴이 항상 전방을 향하도록 |
| 테마 프리셋 8종 | PRESETS 배열에 군인/해커/과학자/닌자/파일럿/의사/해적/로봇 추가 |
| 테마 기반 랜덤 | "랜덤" 버튼 → 테마 카테고리 선택 후 해당 테마 내에서 랜덤 |
| 프리셋 미리보기 UI | CharacterCreator 프리셋 탭에 8종 카드 그리드 |

- **design**: Y (캐릭터 프리셋 비주얼)
- **verify**: 로비 프리뷰 얼굴 정면, 인게임 캐릭터 얼굴 정면, 8종 프리셋 선택 가능

### Phase 3: 6종 국가별 테마 맵 + 전투 보너스
| Task | 설명 |
|------|------|
| **서버: 테마 전투 보너스 엔진** | **terrain_bonus.go 신규** — 테마별 이동속도/데미지/시야/오브/쉬링크 modifier 적용 |
| 테마별 텍스처 시스템 | createTerrainTextures(theme) — 6종 Canvas 텍스처 세트 생성 |
| Forest 테마 | 초록 잔디 + 나무 20+ + 이끼 바위 + 연못 | **-20% 피격 데미지 (나무 근처)** |
| Desert 테마 | 모래 텍스처 + 선인장 + 바위 + 오아시스 | **-10% 이동, +20% 시야** |
| Mountain 테마 | 회색 바위 + 높은 고도차 + 눈 덮인 봉우리 | **+15% DPS, -15% 이동** |
| Urban 테마 | 콘크리트 + 건물 블록 + 가로등 + 도로 라인 | **-30% 원거리 데미지** |
| Arctic 테마 | 눈 텍스처 + 얼음 블록 + 빙산 + 눈 파티클 | **-20% 이동, -30% 오브** |
| Island 테마 | 모래 해변 + 물 테두리 + 야자수 + 작은 반경 | **1.5x 쉬링크 속도** |
| VoxelTerrain 통합 | terrainTheme prop으로 분기, 텍스처/데코 동적 생성 |
| TerrainDeco 확장 | 3-zone 시스템에 테마별 오브젝트 배치 분기 |

- **design**: Y (6종 맵 비주얼 디자인)
- **verify**: 각 테마 맵 렌더링 확인, 60FPS 유지, 텍스처 < 200KB/테마, **서버에서 전투 보너스 정상 적용**

### Phase 4: 스킬 발동 이펙트
| Task | 설명 |
|------|------|
| AbilityEffects.tsx 신규 | 에이전트 activeAbility 상태 읽어 이펙트 렌더링 |
| Venom Aura 이펙트 | 초록 독안개 파티클 링 (에이전트 주변) |
| Shield Burst 이펙트 | 파란 반구 확장 → 깨지는 파티클 |
| Lightning Strike 이펙트 | 노란 볼트 메시 (타겟 연결) + 화면 플래시 |
| Speed Dash 이펙트 | 파란 잔상 3개 강화 + 바닥 스피드 라인 |
| Mass Drain 이펙트 | 보라 빔 + 타겟→시전자 흡수 파티클 |
| Gravity Well 이펙트 | 보라 소용돌이 원 + 끌려오는 작은 파티클 |
| 서버 이벤트 추가 | ability_triggered 이벤트 (시전자 ID, 어빌리티 타입, 타겟 좌표) |
| MCParticles 확장 | ABILITY_VENOM, ABILITY_SHIELD 등 6종 파티클 타입 추가 |

- **design**: Y (이펙트 비주얼)
- **verify**: 각 어빌리티 발동 시 이펙트 표시, 성능 영향 < 5% FPS

### Phase 5: 배틀 결과 + 점령 UI
| Task | 설명 |
|------|------|
| BattleResultOverlay.tsx | 배틀 종료 화면 — 승리팩션/점령변화/개인스코어/킬수/레벨. **v11 스코어링 공식 적용** |
| 사망→관전 모드 | 1-life: 사망 시 자유 카메라 관전 모드 (미니맵 + 관전 UI) |
| 자동 복귀 타이머 | 10초 카운트다운 + "재배치" 버튼 + 자동 leaveRoom() |
| 지구본 실시간 반영 | sovereignty 변경 → countries_state 브로드캐스트 → 지구본 색상 변경 |
| 주권 전환 규칙 적용 | **20% 우위 + 최소 3명** 조건 충족 시만 주권 변경, 5단계 레벨 표시 |
| 로비 "최근 전투" 패널 | 최근 3개 배틀 결과 카드 (어느 국가에서 누가 이겼는지) |
| round_end 페이로드 확장 | Go 서버: winner faction, sovereignty change, top players, **scoring breakdown** 데이터 |

- **design**: Y (결과 오버레이 UI + 관전 모드 UI)
- **verify**: 배틀 종료 → 결과 표시 → 10초 후 로비 복귀, 지구본 색상 반영, **사망 시 관전 모드 동작**

### Phase 6: 인게임 HUD 폴리시
| Task | 설명 |
|------|------|
| 빌드 HUD 개선 | 현재 톰/어빌리티 스택을 아이콘으로 표시 (텍스트→비주얼) |
| 미니맵 국가 이름 표시 | 미니맵 상단에 "KOREA (Tier A)" 표시 |
| 킬피드 애니메이션 | 킬 발생 시 슬라이드 인 + 페이드 아웃 |
| 팩션 스코어보드 | 현재 배틀의 팩션별 점수 실시간 표시 |
| 테마별 BGM/SFX 훅 | useAudio 훅 + 테마별 앰비언스 (숲 새소리, 사막 바람 등) |

- **design**: Y (HUD 레이아웃)
- **verify**: 빌드 상태 가시성, 미니맵 정보 표시, 킬피드 동작
