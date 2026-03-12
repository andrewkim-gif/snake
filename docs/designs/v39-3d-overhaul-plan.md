# PLAN: V39 — 3D 인게임 완전 재구현

## 1. 개요

현재 3D 인게임(MatrixScene)은 4가지 근본적 문제가 있다:

1. **맵이 이상함** — PlaneGeometry + vertex color 기반 flat mesh. MC 스타일 아님
2. **캐릭터 움직임 끊김** — Worker 60Hz tick → useFrame 직접 복사, 보간 없음
3. **공격 안 됨** — gameActive 연결 불량 + 3D 무기 렌더러 없음
4. **HUD 없음** — `/new` 페이지가 MatrixApp 우회, HUD 슬롯만 비어있음

이 기획서는 4가지를 **모두** 해결하는 로드맵이다.

---

## 2. 문제 진단

### 2.1 맵 (Terrain)

| 항목 | 로비 (MC 스타일 ✅) | 게임 (현재 ❌) | 해결 방향 |
|------|---------------------|----------------|-----------|
| 지오메트리 | PlaneGeometry 바닥 + BoxGeometry 장식 블록 | PlaneGeometry 단일 메쉬 | PlaneGeometry 유지 + 장식 블록 추가 |
| 텍스처 | 16x16 NearestFilter, 6면 멀티머티리얼 | forest 하드코딩 MeshLambertMaterial | biome별 동적 MC 텍스처 매핑 |
| 높이 | 120×120 평지 + 100-300 블록 언덕 | 연속 vertex Y 변형 (지형 메쉬) | 기존 높이맵 + 장식 블록 이산 높이 |
| 장식 | InstancedMesh 꽃/돌/잔디/연못 내장 | 별도 TerrainObjects (sparse) | biome별 InstancedMesh 장식 통합 |
| 안개 | 15-45 (가까운, 분위기 있음) | 1800-3500 (너무 멀어 효과 없음) | 800-1800 (중거리, 게임 맵 크기 고려) |
| 메모리 | 고정 크기, 한번 생성 | 청크 동적 생성/파괴, cleanup 없음 | useEffect cleanup + dispose 패턴 |

**근본 원인**: 게임 terrain은 MC 텍스처 없이 vertex color만 사용 + biome→theme 매핑 부재 + 메모리 누수

### 2.2 캐릭터 움직임

**파이프라인**: Worker `setInterval(16ms)` → `player.position += velocity * dt` → useFrame에서 `mesh.position = player.position`

**문제**: useFrame이 player.position을 **직접 복사** (lerp 없음)
- Worker tick 간에 position이 변하지 않음 → 여러 render frame에서 같은 위치
- tick 마다 discrete jump → "슥-슥-슥" 느낌
- 120Hz 디스플레이에서 특히 심함 (2 frame 정지 → 1 frame 점프)

**아이러니**: GameCamera는 `POSITION_LERP=0.08`로 부드럽게 따라가는데, 캐릭터 자체는 snap

### 2.3 전투 (공격)

**시나리오 A: `/new` 페이지** — `gameActive={true}` 하드코딩이지만 Worker 기반 update가 동작
- auto-attack 로직은 존재하나 **무기 렌더러 없음** (모든 weapon renderer가 2D Canvas용)
- 적 데미지는 가해지지만 **시각적 피드백 없음** → "공격 안 함"으로 보임

**시나리오 B: `/game` 페이지 3D 모드** — MatrixApp에서 gameRefs를 전달하지 않음
- `<MatrixScene gameActive={gameActive} />` — gameRefs prop 누락
- MatrixScene이 자체 internalRefs 사용 → MatrixApp 상태와 완전 단절

### 2.4 HUD

**`/new` 페이지**: 순수 3D 테스트 페이지 — MatrixApp 우회, HUD 컴포넌트 0개
**`/game` 페이지 3D 모드**: MatrixApp이 HUD 렌더링하지만, gameRefs 미연결로 데이터 0

---

## 3. 해결 방향

### 원칙
- **PlaneGeometry 청크 유지 + MC 텍스처로 비주얼 업그레이드** (전체 블록 InstancedMesh는 수학적으로 불가능 — 3.24M 인스턴스)
- **장식 블록만 InstancedMesh** (높이 경계에 50-100개/청크, 로비 패턴 참조)
- **biome→theme 동적 매핑** (하드코딩 'forest' 제거)
- **무한 청크 시스템은 유지** (게임 맵은 고정 120x120이 아님)
- **움직임 보간 추가** (render-time position lerp + velocity extrapolation)
- **전투 시스템 연결** (gameActive + 시각 피드백)
- **HUD 통합** (MatrixApp 경유 OR 자체 경량 HUD)
- **메모리 누수 근절** (terrain/texture dispose 패턴)

---

## 4. 기술 방향

- **Framework**: React Three Fiber (R3F) — 기존 유지
- **Terrain**: PlaneGeometry 청크 유지 + biome별 MC 텍스처 타일링 + 선택적 장식 InstancedMesh BoxGeometry
  - ⚠️ 전체 블록 InstancedMesh는 **불가능** (CHUNK_SIZE=200 × 200 = 40,000 블록/청크 × 81 청크 = 3.24M 인스턴스, WebGL 한계 ~100K)
  - 대신: PlaneGeometry(기존) + MC 16x16 텍스처 반복 타일링으로 MC 느낌 구현
  - 높이 경계/언덕에만 BoxGeometry 장식 블록 50-100개/청크 InstancedMesh
- **Textures**: terrain-textures.ts 16x16 Canvas NearestFilter (기존 로비 코드 재사용), biome별 동적 매핑
- **Movement**: useFrame 내 position lerp (`outer.position.lerp(target, factor)`) + velocity extrapolation
- **Combat**: MatrixApp gameRefs 연결 + 간단한 3D 공격 이펙트
- **HUD**: `/new` 페이지에 경량 GameHUD 컴포넌트 직접 렌더링

---

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 장식 블록 수 증가 (무한 맵) | 프레임 드랍 | 청크당 50-100개 제한, 뷰 거리 밖 청크 destroy |
| 블록 높이맵 + 엔티티 Y 동기화 | 캐릭터 떠 있음 | 블록 높이맵 lookup 함수 제공 |
| 기존 TerrainObjects 호환 | 소실 가능 | 새 terrain에 통합 또는 제거 |
| MatrixApp 상태 연결 복잡도 | 버그 | 최소 props만 연결 (gameRefs) |
| 메모리 누수 (terrain, texture) | OOM 크래시 | useEffect cleanup, singleton dispose 패턴 |
| Biome→Theme 매핑 부재 | 텍스처 단조로움 | 5 biome → 6 theme 명시적 매핑 테이블 구현 |

---

## 구현 로드맵

### Phase 1: MC 스타일 Terrain 재구현
| Task | 설명 |
|------|------|
| Biome→Theme 매핑 시스템 | `getBiomeTheme(biome)` 유틸: grass→forest, stone→mountain, concrete→urban, special→island, void→arctic. terrain.ts의 하드코딩 'forest' 제거 → biome별 동적 텍스처 |
| 청크별 MC 텍스처 타일링 | PlaneGeometry 유지 + biome별 `createTerrainTextures(theme)` 호출. RepeatWrapping + NearestFilter로 MC 픽셀 아트 느낌 |
| 장식 블록 InstancedMesh | 높이 경계/언덕에 BoxGeometry(1,1,1) 장식 블록 InstancedMesh 추가 (청크당 50-100개). 6면 멀티머티리얼 (top=ground, sides=side) |
| 장식 오브젝트 통합 | 꽃/돌/잔디를 biome별 InstancedMesh로 장식 블록 위에 배치 |
| 안개/조명 조정 | fog 범위 축소 (800-1800), 조명 톤다운 (로비와 유사하게) |
| getTerrainHeight 업데이트 | 장식 블록 영역은 이산 높이 반환, 평지는 기존 연속 높이 유지 |
| 메모리 누수 수정 | VoxelTerrain useEffect cleanup 추가 (chunk geometry/material dispose). `_mcGroundTexture` singleton dispose 패턴 구현 |

- **design**: N
- **verify**: 빌드 성공, biome별 MC 텍스처 확인, 메모리 프로파일링 안정

### Phase 2: 캐릭터 움직임 보간
| Task | 설명 |
|------|------|
| VoxelCharacter position lerp | `useFrame`에서 target position 계산 후 lerp 적용 |
| Velocity extrapolation | tick 사이 velocity 기반 예측 이동 |
| Facing lerp delta-time 보정 | `FACING_LERP`를 dt 기반으로 수정 |
| EnemyRenderer position lerp | 적 이동도 동일 보간 적용 |

- **design**: N
- **verify**: 60Hz/120Hz 모두 부드러운 이동 확인

### Phase 3: 전투 시스템 연결
| Task | 설명 |
|------|------|
| gameRefs 연결 | MatrixApp → MatrixScene에 gameRefs prop 전달 |
| gameActive 확인 | `/new` 페이지에서도 update 동작 보장 |
| 3D 공격 이펙트 | 간단한 swing arc mesh (반원 slash) + hit flash |
| 적 피격 이펙트 | 적 hit flash (emissive pulse) + 넉백 시각화 |
| 적 사망 + 리스폰 | 사망 시 파티클 → gem 드롭, 주기적 리스폰 |

- **design**: N
- **verify**: 플레이어/적 상호 공격, 데미지 넘버 표시

### Phase 4: HUD 통합
| Task | 설명 |
|------|------|
| GameHUD3D 컴포넌트 | HP바, XP바, 레벨, 점수, 킬 수 — DOM overlay |
| 미니맵 | 간단한 Canvas 미니맵 (플레이어 위치 + 적 점) |
| 무기 슬롯 표시 | 장착 무기 아이콘 + 쿨다운 게이지 |
| 모바일 컨트롤 | 터치 조이스틱 (기존 MobileControls 재사용) |

- **design**: N
- **verify**: HUD 전체 표시, 실시간 데이터 업데이트

