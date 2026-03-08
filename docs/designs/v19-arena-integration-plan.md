# v19 아레나 통합 기획서 — 문제 진단 및 해결 방안

> 작성일: 2026-03-08 | 상태: 기획 (개선 v2)
> 검증: 11개 이슈 발견 (Critical 3 / High 5 / Medium 3), 전부 반영 완료

---

## 1. 문제 진단

사용자 의도는 명확했다: **minecraft-threejs 레퍼런스 프로젝트의 맵 엔진과 게임플레이 메커니즘을 아레나 전투 시스템의 기반으로 사용**하는 것. 현재 3가지 치명적 문제가 존재한다:

### 문제 A: 아레나가 마인크래프트 엔진을 사용하지 않음

**기대**: 아레나 전투가 절차적 복셀 지형(MCTerrain + MCNoise) 위에서 실행되고, FPS 카메라(MCCamera), 블록 인터랙션, 완전한 마인크래프트 스타일 월드를 사용.

**현실**: v18 아레나 시스템(`components/game/ar/AR*`)이 기존 엔진과 무관하게 완전히 새로 만들어짐:
- `ARTerrain.tsx` → 평평한 CircleGeometry 바닥 (복셀 지형 아님)
- `ARCamera.tsx` → 3인칭 추적 카메라 (FPS 아님)
- `ARPlayer.tsx` → 커스텀 복셀 캐릭터 (기존 AgentInstances 미사용)
- `AREntities.tsx` → 커스텀 InstancedMesh 적 (기존 적 시스템 미사용)
- `mc-types`, `mc-noise`, `mc-materials`, `mc-terrain-worker` 임포트 **0건**

**근본 원인**: da:work 파이프라인이 기존 MC 엔진 위에 구축하지 않고, 완전히 별도의 코드베이스(`ar-*`)를 생성함.

### 문제 B: 메인 게임 흐름에서 자동 전투 미작동

**기대**: 지구본에서 국가 클릭 → 자동 전투 로그라이크 아레나 진입.

**현실**: 서로 연결되지 않은 2개의 별도 시스템 존재:
1. **`/arena` (독립 테스트 페이지)** — 자동 전투(로컬 시뮬레이션) 있음. 하지만 로비 지구본과 완전히 분리. WebSocket 없음. 테스트 페이지일 뿐.
2. **`GameCanvas3D` (메인 게임)** — 지구본 클릭 시 여기로 라우팅됨. 자체 전투 시스템(오라 링, 자동 공격, 어빌리티, 오브, 에폭 시스템)이 있으나, v18 아레나 로그라이크와 **전혀 다른 시스템**.

v18 아레나 시스템은 다음으로만 존재:
- 24개 Go 서버 파일(`ar_*.go`) — 어떤 엔드포인트에도 연결 안됨
- 17개 React 컴포넌트(`AR*.tsx`) — `/arena` 테스트 페이지에서만 사용
- 메인 게임(`GameCanvas3D`)은 이들의 존재를 모름

### 문제 C: 지구본 클릭 → 이전 게임으로 진입

**기대**: 지구본에서 국가 클릭 → 새로운 아레나 로그라이크 전투 진입.

**현실**: 지구본에서 국가 클릭 → `handleQuickEnterArena()` → `socket.emit('join_country_arena')` → `GameCanvas3D` 렌더링 (새 아레나가 아닌 **기존 TPS 전투 게임**).

진입 흐름:
```
지구본 → CountryPanel → "ENTER ARENA" 버튼 → page.tsx handleEnterArena
  → socket.joinCountryArena(iso3) → joined → mode='playing' → GameCanvas3D
```

`GameCanvas3D`는 HeightmapTerrain, TPSCamera, 에폭 시스템 등을 사용하는 v16+ 멀티플레이어 TPS 게임이다. v18 아레나 로그라이크와 전혀 관련 없음.

---

## 2. 자산 비교: 현재 상태 vs 필요 사항

| 컴포넌트 | minecraft-threejs (레퍼런스) | 현재 MC 엔진 (R3F 포팅) | 현재 아레나 (AR*) | 필요 조치 |
|-----------|-------------------------------|------------------------------|---------------------|--------|
| **지형** | Perlin 노이즈 복셀, 무한 청크, 12 블록 타입 | MCTerrain.tsx — 완전 포팅, 동작함 | ARTerrain.tsx — 평면 원 | MCTerrain 사용 |
| **카메라** | FPS + PointerLock | MCCamera.tsx — 완전 포팅, 동작함 | ARCamera.tsx — 3인칭 | 아레나 전투에 TPS 유지 |
| **블록 인터랙션** | 좌클릭 파괴, 우클릭 설치 | MCBlockInteraction.tsx — 동작함 | 없음 | 아레나에 불필요 |
| **노이즈** | ImprovedNoise + 시드 | mc-noise.ts — 완전 포팅 | 없음 | mc-noise 지형 생성용 사용 |
| **재질** | 12 블록 텍스처, NearestFilter | mc-materials.ts — 동작함 | 없음 | mc-materials 사용 |
| **지형 워커** | Web Worker 청크 생성 | mc-terrain-worker.ts — 동작함 | 없음 | mc-terrain-worker 사용 |
| **플레이어 캐릭터** | 캐릭터 없음 (FPS only) | AgentInstances (큐블링) | ARPlayer (6파트 복셀) | AgentInstances 사용 |
| **자동 전투** | N/A | GameCanvas3D 자동 공격 + 오라 | arena/page.tsx 로컬 시뮬 | 메인 게임에 통합 |
| **적** | N/A | GameCanvas3D 서버 구동 봇 | AREntities (로컬 스폰) | MC 지형 위 서버 구동 |
| **게임 루프** | N/A | 서버 20Hz + 클라이언트 보간 | 클라이언트 전용 60fps | 서버 루프 사용 |

---

## 3. 해결 전략

**핵심 원칙**: 세 번째 시스템을 만들지 않는다. v18 아레나 로그라이크 메커니즘을 기존 GameCanvas3D에 **병합**하고, MCTerrain 위에서 실행한다.

### 전략 A: GameCanvas3D 지형을 MCTerrain으로 교체
현재 `GameCanvas3D`는 `HeightmapTerrain` + `ZoneTerrain`을 사용. 이를 `MCTerrain`(minecraft-threejs 레퍼런스 포팅의 절차적 복셀 월드)으로 교체:
- 국가별 절차적 지형 (seed = 국가 해시)
- 12 블록 타입의 픽셀 아트 텍스처
- Web Worker 기반 청크 렌더링
- 사용자가 원하는 마인크래프트 룩앤필

### 전략 B: v18 아레나 로그라이크 메커니즘을 GameCanvas3D에 포팅
v18 아레나 시스템의 게임 메커니즘(16 무기, 16 Tome, 10 시너지, 웨이브 스폰, 자동 전투)을 기존 서버 사이드 `country_arena.go` 전투 루프에 포팅하여, 현재 에폭 기반 전투를 교체/확장.

### 전략 C: 지구본 → 새 아레나 경험으로 연결
지구본에서 국가 클릭 시 이전 TPS 게임이 아닌 MC 지형 위의 아레나 로그라이크 경험으로 진입하도록 수정.

### 각 시스템에서 유지할 것:
- **GameCanvas3D**: TPS 카메라, AgentInstances(큐블링 캐릭터), 서버 구동 멀티플레이어, WebSocket 프로토콜, 입력 관리자, 파티클 시스템, 대미지 숫자, 포스트 프로세싱, 날씨
- **MC 엔진**: MCTerrain, MCNoise, mc-materials, mc-terrain-worker (월드)
- **v18 아레나**: 자동 전투 로직, 웨이브 스폰, XP/레벨업, Tome 선택, 캐릭터 패시브, 시너지, PvP 페이즈 (게임 메커니즘)
- **minecraft-threejs (레퍼런스)**: 지형 생성 파라미터, 블록 텍스처, 오디오 에셋

### 제거/교체할 것:
- HeightmapTerrain + ZoneTerrain → MCTerrain
- 이전 에폭 시스템 → v18 아레나 5페이즈 전투 사이클
- `/arena` 독립 페이지 → 삭제 (테스트 페이지였음)

---

## 4. 아키텍처 결정

### ADR-001: MC 지형을 아레나 바닥으로 사용
**결정**: MCTerrain(절차적 복셀)을 아레나 전투 바닥으로 사용한다.
**배경**: 사용자가 minecraft-threejs 맵 엔진을 명시적으로 원했다. 현재 아레나는 평면 원형.
**결과**: 아레나 반경이 청크 렌더 거리에 매핑. 국가 시드가 지형 변화를 결정. 적이 복셀 표면에 스폰. 플레이어가 3D 지형 위에서 전투.

### ADR-005: 좌표 시스템 — MC 블록 단위
**결정**: 아레나 전투는 MC 블록 단위로 동작 (1 블록 = 1 유닛). 아레나 반경 = N 블록 (예: 80 블록 ≈ 3.3 청크). 서버와 클라이언트 모두 블록 좌표 사용.
**배경**: MCTerrain은 정수 블록 좌표(MC_BASE_Y=30, 청크 사이즈 24)를 사용. 현재 게임은 반경 ~3000의 연속 부동소수점 사용. 근본적으로 호환 불가.
**결과**: 모든 게임 로직(이동 속도, 공격 범위, 스폰 위치)을 MC 블록 단위로 재조정. 서버 아레나 상태는 블록 좌표 사용. 클라이언트 MCNoise.getSurfaceOffset(x,z)가 에이전트 배치용 표면 Y 제공. 좌표 변환 레이어 없음 — 전체적으로 네이티브 MC 좌표 사용.

### ADR-006: 에이전트 높이 — 클라이언트 사이드 지형 샘플링
**결정**: 에이전트 Y 위치는 클라이언트에서 MCNoise.getSurfaceOffset(x, z) + MC_BASE_Y + 1로 계산. 서버는 X/Z만 추적.
**배경**: 현재 시스템은 서버가 agent.z(높이)를 `toWorld()`를 통해 전송. MCTerrain 높이는 절차적(시드 기반 노이즈)이므로 서버에 지형 메시가 없음. 전체 지형을 Go 서버에 동기화하는 것은 비현실적.
**결과**: 서버와 클라이언트가 동일 시드를 공유. 서버는 선택적으로 경계 체크용 노이즈 계산 가능(MCNoise를 Go로 포팅). 이것이 허용되는 이유: (1) 높이가 시드+위치에서 결정적, (2) 모든 클라이언트가 동일 지형을 봄, (3) 서버는 경계 체크용 근사 높이만 필요.

### ADR-007: AR* 컴포넌트 처분 계획
**결정**: AR* 컴포넌트를 선별적으로 포팅 — 유용한 것은 유지, 중복된 것은 폐기.
**배경**: `components/game/ar/`에 17개 AR* 컴포넌트 존재. 일부(ARCharacterSelect, ARHUD, ARLevelUp)는 고유 가치가 있고, 나머지(ARTerrain, ARCamera, ARPlayer)는 기존 GameCanvas3D 기능과 중복.

| AR 컴포넌트 | 처분 | 이유 |
|---|---|---|
| ARCharacterSelect | **유지** — 로비 흐름에 포팅 | 고유: 8 캐릭터+패시브 UI |
| ARHUD | **유지** — 기존 HUD에 병합 | 웨이브/타이머/킬 표시 필요 |
| ARLevelUp | **유지** — GameCanvas3D 오버레이로 포팅 | 고유: 3장 카드 Tome 선택 |
| ARDamageNumbers | **교체** — 기존 DamageNumbers 사용 | GameCanvas3D에 이미 있음 |
| ARPvPOverlay | **유지** — GameCanvas3D 오버레이로 포팅 | 킬피드, 팩션 스코어, 보스 HP |
| ARMinimap | **유지** — 기존 미니맵 확장 | 아레나 전용 미니맵 기능 |
| ARBattleRewards | **유지** — 전투 후 오버레이로 포팅 | 고유: 듀얼 토큰 보상 표시 |
| ARSpectateOverlay | **유지** — 관전 모드로 포팅 | 고유: 사망 관전 UI |
| ARNameTags | **교체** — 기존 네임태그 시스템 사용 | GameCanvas3D에 이미 있음 |
| ARTerrain | **삭제** | MCTerrain으로 교체됨 |
| ARCamera | **삭제** | TPSCamera 사용 |
| ARPlayer | **삭제** | AgentInstances 사용 |
| AREntities | **삭제** — 로직을 AgentInstances에 병합 | 적 렌더링 병합 |
| ARMobileControls | **병합** — 기존 모바일 입력에 통합 | AR 조이스틱 + 기존 모바일 터치 |
| ARProfile | **유지** — 허브에 포팅 | 라이프타임 통계 화면 |
| ARQuestPanel | **유지** — 허브에 포팅 | 퀘스트 UI |
| ARSeasonPass | **유지** — 허브에 포팅 | 시즌패스 뷰어 |

### ADR-002: TPS 카메라 유지 (FPS 아님)
**결정**: GameCanvas3D의 TPS(3인칭) 카메라를 아레나 전투에 유지한다.
**배경**: minecraft-threejs는 FPS를 사용하나, 로그라이크 오토배틀러에서는 TPS가 더 적합 — 캐릭터, 적, 전장을 볼 수 있어야 함. FPS는 건축용이지, 자동 전투 관전용이 아님.
**결과**: MCCamera.tsx(FPS)는 사용 가능하나 아레나에서 사용 안함. TPSCamera 유지. MCTerrain은 MCCamera 없이 사용.

### ADR-003: 서버 사이드 전투 (클라이언트 아님)
**결정**: 모든 아레나 전투는 서버(Go)에서 실행. 클라이언트의 requestAnimationFrame 루프에서 실행하지 않음.
**배경**: `/arena` 테스트 페이지는 전투를 로컬에서 실행. 멀티플레이어 AI 에이전트에서는 서버 권위 전투가 필수.
**결과**: v18 `ar_combat.go`(이미 작성, 1,492줄)가 실제 전투 엔진이 됨. 클라이언트는 보간된 상태만 렌더링.

### ADR-004: 단일 통합 게임 진입점
**결정**: 독립 `/arena` 페이지를 제거. 모든 아레나 진입은 로비 → 지구본 → 국가 → GameCanvas3D 흐름을 통한다.
**결과**: 하나의 게임, 하나의 진입 경로, 하나의 컴포넌트 트리. 병렬 코드베이스 없음.

---

## 5. 리스크

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| MCTerrain 아레나 성능 (50명 플레이어 + 100+ 적 + 복셀 월드) | 높음 | 렌더 거리 2청크. 최대 48×48 블록 아레나. 원거리 블록 LOD. ar_optimize.go 엔티티 풀. 목표: 드로우콜 <500, 삼각형 <2M. |
| 좌표 시스템 불일치 (MC 블록 vs 게임 부동소수점) | 높음 | ADR-005: 아레나 전체에서 MC 블록 단위 네이티브 사용. 변환 레이어 없음. 모든 게임 상수(속도, 범위, 반경)를 블록 단위로 재조정. |
| 에이전트 Y 위치 — 서버가 지형 높이 모름 | 높음 | ADR-006: MCNoise를 통한 클라이언트 사이드 지형 샘플링. 서버는 X/Z만 추적. 시드 공유로 결정적 높이 계산. 선택적으로 MCNoise를 Go로 포팅하여 서버 경계 체크. |
| ar_combat.go 연결 5개 통합 갭 | 높음 | Phase 2에서 5개 구체적 와이어링 포인트 모두 열거. 상세 작업 목록 참조. |
| 기존 GameCanvas3D 기능 파손 (날씨, 킬캠, 관전) | 중간 | 점진적 교체: 지형 먼저, 그다음 전투 루프. 기존 기능 유지하며 교체. |
| 국가별 지형 시드가 전투에 부적합한 지형 생성 가능 | 낮음 | 티어별 큐레이트된 시드 범위 사용. 지형 높이 편차 제한 (최대 ±5 블록, 전투 플레이성 확보). |
| MCTerrain Web Worker + 아레나 틱 CPU 경합 | 중간 | 아레나 모드에서 더 작은 청크(24 대신 16) 및 낮은 렌더 거리 사용. 워커는 아레나 초기화 시 1회 실행, 지속적 실행 아님. |
| 기존 기능 중복 (에폭 시스템, 빌드 시스템, 대미지 이벤트) | 중간 | 명시적 마이그레이션 맵: 에폭→5페이즈 전투, 클래식 빌드→v18 Tome 시스템, 기존 대미지 이벤트 재사용. 페이즈별 교체, 두 시스템 동시 활성화 금지. |
| MC 지형에서의 재접속 상태 | 낮음 | mc-terrain-worker는 시드로부터 생성 — 지형 상태 스냅샷 불필요. 플레이어 위치 + 전투 상태만으로 재접속 충분. |

---

## 6. 기존 기능 마이그레이션 맵

현재 GameCanvas3D에 v18 아레나와 중복되는 전투 기능이 이미 존재한다. 아래 표는 각 기능의 마이그레이션 방향을 정의한다:

| 기존 기능 | 상태 | 마이그레이션 |
|---|---|---|
| **에폭 시스템** (peace/war/shrink/end) | **교체** | → v18 5페이즈 전투 사이클 (Deploy/PvE/PvP Warning/PvP/Settlement) |
| **오라 자동 공격** (60px 범위) | **교체** | → v18 무기 자동 발사 (16 무기, 쿨다운, 투사체, 블록 단위 범위) |
| **클래식 빌드 시스템** (10 무기, 10 패시브, 8 Tome, 6 어빌리티) | **교체** | → v18 Tome 시스템 (16 Tome + 21 무기 + 10 시너지 + 8 캐릭터) |
| **DamageNumbers** | **유지** | v18 대미지 표시에 그대로 재사용 |
| **AuraRings** | **유지** | 공격 범위 인디케이터로 재사용 (블록 단위로 재조정) |
| **AgentInstances** (큐블링 캐릭터) | **유지** | 적 서브타입(좀비/스켈레톤 등)으로 확장 |
| **TPSCamera** | **유지** | 변경 없음 |
| **파티클 시스템** (MCParticles) | **유지** | 아레나 전용 파티클 추가 (XP 픽업 글로우, 무기 이펙트) |
| **포스트 프로세싱** (bloom, DOF) | **유지** | 변경 없음 |
| **날씨 시스템** | **유지** | 국가 바이옴이 날씨 결정 |
| **미니맵** | **확장** | 아레나 경계, 웨이브 인디케이터, 적 위치 추가 |
| **킬캠** | **유지** | 아레나 사망 시 트리거, 이후 관전 모드 |
| **HeightmapTerrain + ZoneTerrain** | **삭제** | → 아레나 모드가 있는 MCTerrain |
| **OrbManager** (XP 오브) | **교체** | → v18 XP 크리스탈 (OctahedronGeometry, 킬 시 서버 스폰) |
| **클래식 리더보드** | **교체** | → 아레나 스코어보드 (킬, DPS, 수집 Tome) |
| **BuildHUD** | **재연결** | 현재 `null` 렌더링. v18 Tome/무기 서버 상태에 연결. |

## 구현 로드맵

### Phase 1: MCTerrain을 GameCanvas3D에 적용
| 작업 | 설명 |
|------|------|
| MCTerrain에 아레나 모드 추가 | 새 prop: `arenaMode?: { radius: number, flattenVariance: number, seed: number }`. 설정 시: (1) 반경 내 청크만 생성, (2) getSurfaceOffset을 ±flattenVariance로 클램프, (3) 카메라 이동 시 청크 업데이트 스킵 (정적 아레나). mc-terrain-worker.ts에 경계 적용. |
| 좌표 시스템 마이그레이션 | 모든 아레나 게임 로직을 MC 블록 단위로 동작 (ADR-005). 아레나 반경 = 80 블록 (≈3.3 청크). 이동 속도 = 블록/초. 공격 범위 = 블록. 스폰 반경 = 블록. 전환기간용 `coordinate-utils.ts`에 `toMCBlock()` / `fromMCBlock()` 추가. |
| HeightmapTerrain을 MCTerrain으로 교체 | GameCanvas3D에서: HeightmapTerrain + ZoneTerrain + TerrainDeco 제거. MCTerrain을 `arenaMode={{ radius: 80, flattenVariance: 5, seed: countryHash(iso3) }}`로 추가. 나머지 자식 컴포넌트(카메라, 에이전트, 파티클 등) 유지. |
| 클라이언트 사이드 에이전트 높이 샘플링 | 에이전트 Y = MCNoise.getSurfaceOffset(x, z) + MC_BASE_Y + 1. AgentInstances.tsx의 `useFrame` 루프에 적용: 서버 상태에서 에이전트 X/Z 읽기, 노이즈에서 Y 계산. 아레나 모드에서 서버 구동 agent.z 제거. |
| 씬 조명/안개 업데이트 | 아레나 모드 시 MCScene 조명(하늘색 안개, 포인트 라이트) 적용. 국가 바이옴이 하늘 색상 결정. |
| ArenaBoundary 적응 | 현재 ArenaBoundary는 연속 반경(3000 유닛) 사용. MC 블록 단위(80 블록)로 업데이트. 시각적 경계 링을 블록 그리드에 매핑. |

- **design**: N
- **성능 예산**: 아레나 모드 목표: 드로우콜 <500, 삼각형 <2M, GPU 메모리 <200MB. MCTerrain 아레나: 최대 3×3 청크 (72×72 블록) = ~5,184 가시 블록 인스턴스. 렌더 거리 2청크. LOD: 48 유닛 이상 떨어진 블록은 간소화된 지오메트리 사용.
- **verify**: GameCanvas3D가 국가 아레나 진입 시 복셀 지형 렌더링. 에이전트가 지형 표면 위를 걸음. 아레나 경계가 블록 단위 반경에서 보임. 빌드 통과. HeightmapTerrain 참조 없음.

### Phase 2: v18 전투를 서버에 연결 (5개 통합 갭)
| 작업 | 설명 |
|------|------|
| **갭 1**: JoinCountryArena에서 CombatMode 설정 | `country_arena.go`의 `JoinCountryArena()`에서: `room.CombatMode = CombatModeArena`로 설정하고 ar_room_integration.go의 `InitArenaCombat(room)` 호출. 현재는 항상 클래식 아레나 생성. |
| **갭 2**: startRound()에서 CombatMode 분기 | `room.go`의 `startRound()` (337-366줄)에서: `if room.IsArenaCombat() { ... }` 분기 추가. 클래식 아레나 대신 v18 아레나 상태 초기화. |
| **갭 3**: tickPlaying()에서 TickArenaCombat 호출 | `room.go`의 `tickPlaying()` (227-262줄)에서: `if room.IsArenaCombat() { TickArenaCombat(room, dt) }` 분기 추가. 클래식 틱 대신 v18 전투 틱 실행. |
| **갭 4**: ar_input/ar_choose 소켓 이벤트 등록 | 소켓 핸들러(main.go 또는 handler.go)에서: `ar_input` → `RouteARInput()`과 `ar_choose` → `RouteARChoose()` 이벤트 등록. 현재 AR 소켓 이벤트 등록 0건. |
| **갭 5**: main.go에서 ar_room_integration 임포트 | `main.go` 또는 초기화 체인에서 AR 전투 통합을 임포트 및 활성화. 현재 main.go에 CombatMode 참조 0건. |
| 전투 상태 → WebSocket 브로드캐스트 | ar_combat.go 틱 결과(적 위치, HP, XP 크리스탈, 대미지 이벤트) → 직렬화 → 기존 상태 프로토콜로 룸 클라이언트에 브로드캐스트. 기존 Broadcaster 패턴 사용. |
| MC 좌표에서 웨이브 스폰 | MC 블록 단위의 적 스폰 위치. 아레나 가장자리(반경 - 5 블록)에 스폰. 서버는 적 X/Z 전송; 클라이언트가 MCNoise에서 Y 계산. |
| 서버 사이드 자동 공격 | 서버가 자동 공격 계산 (범위 내 가장 가까운 적, 블록 단위 범위), 대미지 적용, 대미지 이벤트 브로드캐스트. ar_combat.go의 `tickWeaponAutoAttack()` 재사용. |

- **design**: N
- **verify**: `go build ./...` 통과. 플레이어가 국가에 참여하면 서버가 아레나 전투 시작. 적 스폰. 자동 공격 작동. 클라이언트에 상태 브로드캐스트. 5개 갭 모두 해소 확인.

### Phase 3: 클라이언트 전투 렌더링
| 작업 | 설명 |
|------|------|
| MC 지형 위 적 렌더링 | AgentInstances를 적 서브타입(좀비/스켈레톤/슬라임/스파이더/크리퍼)으로 확장. 적 Y는 플레이어 에이전트와 동일하게 MCNoise에서 산출. 적 타입별 구분 색상/형태의 InstancedMesh. |
| XP 크리스탈 렌더링 | 지형 위에 XP 크리스탈을 OctahedronGeometry 인스턴스로 렌더링. OrbInstances 패턴을 재사용하되 XP 크리스탈 셰이더(노란 글로우) 적용. |
| BuildHUD를 서버 상태에 연결 | 현재 `BuildHUD`가 `build={null}`을 전달 — 항상 비어 있음. v18 Tome/무기 상태를 서버에서 받도록 연결. 획득 Tome, 활성 무기, 시너지 인디케이터 표시. |
| 자동 공격 시각적 피드백 | 기존 AuraRings를 공격 범위 인디케이터로 재사용. 기존 DamageNumbers를 대미지 표시에 재사용. 무기별 공격 시각 효과 추가(투사체 궤적, 슬래시 아크). |
| 레벨업 UI | ARLevelUp(3장 카드 Tome 선택)을 GameCanvas3D HTML 오버레이로 포팅. 서버가 Tome 선택지 브로드캐스트; 클라이언트 선택 중 입력 일시정지; 클라이언트가 `ar_choose` 이벤트 전송. |
| HUD 적응 | ARHUD 요소를 기존 HUD에 병합: 웨이브 카운터, 아레나 타이머, 킬 카운트, 페이즈 인디케이터 추가. 아레나 모드 시 에폭 전용 HUD 요소 제거. |
| 아레나 모드에서 클래식 전투 시각 비활성화 | `CombatMode=arena`일 때: 에폭 타이머, 클래식 리더보드, 오브 시스템 숨김. 대신 아레나 HUD 표시. 기능 플래그: page.tsx에서 `isArenaMode` prop 전달. |

- **design**: Y (HUD 레이아웃, 레벨업 팝업 디자인)
- **verify**: 복셀 지형 위에 적 표시. 킬 시 XP 크리스탈 드롭. 레벨업 팝업 표시. BuildHUD가 Tome/무기 표시. HUD에 웨이브/타이머/킬 표시. 아레나 모드에서 클래식 HUD 숨겨짐.

### Phase 4: 캐릭터 선택 + Tome + 시너지
| 작업 | 설명 |
|------|------|
| 아레나 진입 전 캐릭터 선택 | 아레나 진입 전에 ARCharacterSelect(8 캐릭터+패시브) 표시. 선택한 캐릭터가 시작 스탯/무기 결정. |
| Tome 시스템 통합 | 16 Tome의 스택 효과. 서버가 플레이어당 Tome 상태 추적. 레벨업 시 Tome 선택지를 클라이언트에 브로드캐스트. |
| 시너지 감지 | 서버가 획득 Tome에서 시너지 콤보(10 시너지) 검사. 시너지 활성화 시 시각 이펙트 브로드캐스트. |
| 무기 진화 | Tome 조합으로 트리거되는 5개 무기 진화 경로 |

- **design**: Y (로비 흐름 내 캐릭터 선택 화면)
- **verify**: 아레나 진입 전 캐릭터 선택 표시. Tome이 플레이어 스탯 수정. 시너지 정상 활성화.

### Phase 5: PvP 페이즈 + 지구본 진입 수정 + 기능 마이그레이션
| 작업 | 설명 |
|------|------|
| 에폭 시스템을 5페이즈 전투로 교체 | 서버에서 에폭 사이클(peace/war_countdown/war/shrink/end/transition) 제거. v18 5페이즈로 교체: Deploy(10초) → PvE(210초) → PvP Warning(10초) → PvP(60초) → Settlement(10초). 마이그레이션 맵: epoch.war → v18.pve, epoch.shrink → v18.pvp (아레나 수축), epoch.end → v18.settlement. |
| 팩션 PvP | PvP 페이즈에서 같은 팩션 = 아군, 다른 팩션 = 적. PvP 대미지 계수 0.4. country_arena의 기존 팩션 시스템 재사용. |
| MC 지형에서 아레나 수축 | PvP 페이즈에서 아레나 경계 수축 (블록 단위 100%→33% 반경). 경계 밖 = DOT 대미지. 시각: 경계 밖 블록 어두워짐 (이미시브 감소). |
| 지구본 → 아레나 진입 흐름 수정 | page.tsx에서: 지구본 클릭 → ARCharacterSelect(포팅된) 표시 → 캐릭터 선택 시 → `joinCountryArena(iso3, characterType)` → `isArenaMode=true`인 GameCanvas3D. 캐릭터 선택을 건너뛰는 `handleQuickEnterArena` 제거. |
| 독립 /arena 페이지 삭제 | `app/arena/` 디렉토리 + `ArenaCanvas.tsx` 제거. 17개 AR* 컴포넌트는 `components/game/ar/`에 유지 — 유지 대상(ADR-007 기준)은 GameCanvas3D에서 임포트. |
| 기능 중복 정리 | `isArenaMode`일 때 GameCanvas3D에서 제거: 클래식 빌드 시스템(10 무기+10 패시브), 클래식 리더보드, 오브 스폰, 클래식 어빌리티 시스템. v18 Tome/무기/시너지 시스템으로 교체됨. 비아레나 모드(필요 시)는 클래식 유지. |
| 모바일 컨트롤 병합 | 기존 GameCanvas3D 모바일 터치 핸들링 유지. ARMobileControls 가상 조이스틱 오버레이 병합. AR 시스템의 자동 공격 인디케이터. 단일 통합 모바일 입력 경로. |

- **design**: N
- **verify**: 전체 흐름: 지구본 클릭 → 캐릭터 선택 → MC 지형 아레나 → 자동 전투 → PvP 페이즈 → 정산. "이전 게임" 경로 없음. 에폭 시스템 제거됨. /arena 페이지 삭제됨. 모바일 컨트롤 작동.

### Phase 6: 폴리시 + 메타 시스템
| 작업 | 설명 |
|------|------|
| 토큰 보상 | ar_reward.go 듀얼 토큰 시스템 포팅. 전투 종료 시 $AWW + 국가 토큰 분배. |
| 퀘스트 시스템 | ar_quest.go 템플릿 시스템 포팅. 플레이어별 퀘스트 진행 추적. |
| 시즌패스 | ar_season.go 4주 4Era 시스템 포팅. 전투를 통한 레벨 진행. |
| 사운드 이펙트 | ar-sounds.ts (32 이벤트)를 기존 사운드 엔진에 포팅. minecraft-threejs 레퍼런스의 블록 파괴 사운드. |
| 모바일 컨트롤 | ARMobileControls가 GameCanvas3D 내에서 작동하는지 확인 (아레나 전투용 가상 조이스틱). |

- **design**: N
- **verify**: 전투 후 토큰 보상 표시. 퀘스트 추적. 시즌패스 표시. 사운드 재생. 모바일 플레이 가능.
