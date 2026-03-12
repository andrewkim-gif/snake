# PLAN: V44 — 비주얼 & 게임플레이 폴리싱

## 1. 개요

### 배경
`/new` 페이지의 전투 시스템(V42)과 지형 개선(V43)이 완료되었으나,
시각적 피드백과 적 다양성이 부족하여 "킬의 쾌감"과 "전투의 긴장감"이 약합니다.

### 핵심 목표
4가지 축으로 전투 체감을 대폭 개선합니다:
1. **사망 이펙트** — 폭발적 파티클 + 화면 연출로 킬의 쾌감 극대화
2. **적 행동 다양화** — 원거리 사격 + 돌진 패턴으로 전투에 긴장감 추가
3. **아이템 비주얼** — 고유 형태 + 크기 축소로 가독성 향상
4. **지형 텍스처** — 멀티페이스 + 미사용 텍스처 활성화로 월드 품질 향상

### 검증된 기술 컨텍스트
| 항목 | 현재 상태 | 목표 |
|------|----------|------|
| 사망 파티클 | 8개 큐브, 색상 변화만 | 20개+ 다양한 크기/형태, 스파크, 보스 특수 연출 |
| 적 AI | 전부 동일 (chase → orbit) | 원거리/돌진 행동 패턴 분기 |
| 아이템 형태 | 모두 1.5 크기 색깔 큐브 | 고유 복셀 형태, 크기 0.5~0.8 |
| 잔디 텍스처 | 6면 동일 (side) | top/side/bottom 분리 |
| 블록 다양성 | 16개 중 6개만 사용 | coal, bedrock, cobblestone 등 활성화 |
| 카메라 쉐이크 | refs 존재하나 MCGameCamera 미연결 | 쉐이크 연결 + 사망/보스 트리거 |
| 화면 플래시 | useScreenFlash 존재 | 보스/엘리트 사망 시 트리거 |
| 슬로모 | 미구현 | 보스 사망 시 0.3초 슬로모션 |

## 2. 요구사항

### 기능 요구사항
| ID | 요구사항 | Priority |
|----|----------|----------|
| FR-01 | 일반 적 사망: 파티클 8→20개, 크기 다양화(0.2~0.6), 색상 그라디언트, 스파크(점 파티클) 추가 | High |
| FR-02 | 보스/엘리트 사망: 50개 대형 파티클 + 화면 플래시 0.15초 + 카메라 쉐이크 0.3초 + 슬로모 0.3초 | High |
| FR-03 | XP 오브 흡수 연출: 사망 위치에서 분출 → 곡선 궤적으로 플레이어에게 빨려감 + 수집 시 팝 이펙트 | High |
| FR-04 | MCGameCamera 쉐이크 연결: 기존 screenShakeTimer/Intensity refs를 MCGameCamera에 전달하여 활성화 | High |
| FR-05 | 원거리 적 AI: 일정 거리 유지(6~8블록) + 투사체 발사(2초 쿨다운). flying/turret 템플릿 적에 적용 | High |
| FR-06 | 돌진 적 AI: 거리 10블록에서 1초 준비 → 3배속 직선 돌진 → 2초 쿨다운. crawler/humanoid_large 적에 적용 | High |
| FR-07 | 아이템 형태 다양화: 치킨=미니 복셀 닭다리, 상자=작은 보물상자, 폭탄=구체, 자석=U자. 크기 0.5~0.8로 축소 | Medium |
| FR-08 | XP 오브 개선: 크기 0.8→0.4, 수집 시 팝 이펙트(스케일 팽창→소멸), 밝기 펄스 강화 | Medium |
| FR-09 | 잔디 블록 멀티페이스: 상단=grass_top_green, 측면=grass_block_side, 하단=dirt. 텍스처 아틀라스 사용 | Medium |
| FR-10 | 미사용 블록 텍스처 활성화: coal_ore, bedrock, cobblestone, gravel 고유 텍스처로 렌더링 | Medium |
| FR-11 | 슬로모 시스템: 보스 사망 시 gameSpeed 0.2로 0.3초간 → smoothstep 복귀. useFrame(dt * gameSpeed) | High |

### 비기능 요구사항
| ID | 요구사항 |
|----|----------|
| NFR-01 | 60fps 유지: 적 50마리 동시 사망 시에도 프레임 드롭 없음 (파티클 풀 200→500 확장) |
| NFR-02 | 메모리: 새 파티클/이펙트 Object Pool 패턴, GC 최소화 |
| NFR-03 | 텍스처: 멀티페이스용 아틀라스 1장, draw call 증가 최소화 |
| NFR-04 | 적 AI: 원거리/돌진 행동은 전체 적의 10~20%에만 적용 (밸런스) |

## 3. 기술 방향

- **파티클 시스템**: 기존 DeathParticles.tsx의 InstancedMesh 풀 확장. 큐브 외 점 파티클(Points) 레이어 추가
- **카메라 쉐이크**: MCGameCamera에 props로 screenShakeTimer/Intensity 전달 → useFrame에서 camera.position에 랜덤 오프셋
- **슬로모**: MatrixScene에 `gameSpeedRef` 추가. useFrame 내 모든 dt를 `dt * gameSpeedRef.current`로 치환
- **적 AI 분기**: Enemy 인터페이스에 `behaviorType: 'chase' | 'ranged' | 'charge'` 추가. GameLogic의 적 업데이트 루프에서 switch 분기
- **원거리 투사체**: 기존 적 투사체는 refs.enemyProjectiles로 관리 (신규 배열). EnemyRenderer에서 별도 InstancedMesh로 렌더링
- **아이템 형태**: PickupRenderer에서 타입별 고유 머지드 지오메트리 생성 (BoxGeometry 조합한 미니 복셀)
- **텍스처 아틀라스**: 잔디 블록용 3면 아틀라스 → UV 매핑으로 face별 다른 텍스처. InstancedMesh 유지하되 커스텀 ShaderMaterial 또는 face index attribute 사용

## 4. 아키텍처 개요

```
MatrixScene (Canvas + SceneContent)
  ├── MCGameCamera ← ★ 쉐이크 props 추가
  ├── GameLogic (useFrame)
  │   ├── 적 AI 루프 ← ★ behaviorType 분기 (chase/ranged/charge)
  │   ├── 적 투사체 업데이트 ← ★ 신규
  │   ├── gameSpeedRef ← ★ 슬로모 시스템
  │   └── 기존 무기/XP/콤보 시스템
  ├── DeathParticles ← ★ 파티클 수/크기/형태 업그레이드
  ├── EnemyRenderer ← ★ 적 투사체 렌더링 추가
  ├── PickupRenderer ← ★ 아이템 형태 다양화 + XP 오브 개선
  ├── MCVoxelTerrain ← ★ 멀티페이스 잔디 + 미사용 블록 텍스처
  └── PostProcessingEffects (기존 Bloom + Vignette + Flash)

types.ts
  └── Enemy ← ★ behaviorType 필드 추가

wave-system.config.ts
  └── ★ 원거리/돌진 적 스폰 비율 설정
```

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 파티클 500개 동시 렌더링 시 프레임 드롭 | 높음 | InstancedMesh 풀 + count 상한 + LOD(멀리서 파티클 생략) |
| 멀티페이스 텍스처 아틀라스 복잡도 | 중간 | face index를 vertex attribute로 전달하는 커스텀 셰이더 대신, 상단만 별도 InstancedMesh로 분리하는 간단한 접근 |
| 원거리 적 밸런스 | 중간 | 투사체 속도 느리게(5 blocks/s), 데미지 낮게(일반의 50%), 쿨다운 길게(2초) |
| 돌진 적 밸런스 | 중간 | 돌진 전 1초 예고(붉은 글로우), 돌진 후 2초 쿨다운(무방비) |
| 슬로모와 기존 타이머 충돌 | 낮음 | gameSpeedRef는 게임 로직 dt에만 적용, 실시간 쿨다운/스폰타이머는 realDt 사용 |

## 구현 로드맵

### Phase 1: 사망 이펙트 & 화면 연출 강화
| Task | 설명 |
|------|------|
| DeathParticles 업그레이드 | 일반 적 파티클 20개 + 크기 다양화(0.2~0.6) + 색상 그라디언트(밝→어둡) + 스파크 Points 레이어 추가 |
| 보스/엘리트 사망 특수 이펙트 | 50개 대형 파티클 + 엘리트 티어별 색상(silver/gold/diamond) + 시간에 따른 폭발 확산 |
| MCGameCamera 쉐이크 연결 | screenShakeTimer/Intensity refs를 props로 전달 → useFrame에서 랜덤 오프셋 적용 |
| 화면 플래시 트리거 | 보스 사망 시 triggerFlash(white, 0.8) 호출. 엘리트는 티어 색상 플래시 |
| 슬로모 시스템 | gameSpeedRef 추가, 보스 사망 시 0.2로 감소 → 0.3초 후 smoothstep 복귀. 모든 dt *= gameSpeed |

- **design**: N
- **verify**: 1) 적 사망 시 파티클 20개 이상 확인 2) 보스 사망 시 화면 플래시 + 쉐이크 + 슬로모 동작 3) 60fps 유지 (적 30마리 동시 사망)

### Phase 2: 적 행동 다양화 (원거리 + 돌진)
| Task | 설명 |
|------|------|
| Enemy 인터페이스 확장 | types.ts에 `behaviorType: 'chase' \| 'ranged' \| 'charge'` 필드 추가 |
| GameLogic AI 분기 | 적 업데이트 루프에서 behaviorType별 switch 분기: chase(기존), ranged(거리 유지+사격), charge(돌진) |
| 원거리 AI 구현 | 6~8블록 거리 유지 + 2초 쿨다운 투사체 발사 + 플레이어가 가까워지면 후퇴 |
| 돌진 AI 구현 | 10블록 거리에서 1초 준비(속도 0, 붉은 글로우) → 3배속 직선 돌진 → 벽/최대거리 도달 시 2초 쿨다운 |
| 적 투사체 시스템 | enemyProjectilesRef 배열 추가. 투사체 이동/충돌/생명주기 관리. 플레이어 히트 시 데미지 |
| 적 투사체 3D 렌더링 | EnemyRenderer 또는 별도 컴포넌트에서 InstancedMesh로 적 투사체 렌더링 |
| Wave 시스템 연동 | wave-system.config.ts에 원거리/돌진 적 스폰 비율 설정. ENGAGEMENT 이후 등장 |
| ENEMY_BASE_STATS 확장 | 원거리/돌진 전용 적 타입 base stats 추가 (ranged_drone, charge_crawler 등) |

- **design**: N
- **verify**: 1) 원거리 적이 거리 유지하며 투사체 발사 2) 돌진 적이 예고 후 돌진 3) 투사체 플레이어 히트 시 데미지 적용 4) 60fps 유지

### Phase 3: 아이템 비주얼 & XP 오브 개선
| Task | 설명 |
|------|------|
| 아이템 고유 지오메트리 | 치킨=미니 복셀 닭다리(3개 박스 조합), 상자=보물상자(2개 박스), 폭탄=구체, 자석=U자형(3개 박스). 타입별 머지드 지오메트리 |
| 아이템 크기 축소 | BoxGeometry 1.5→0.6 기본. 상자 0.8, 폭탄 0.5 등 타입별 차등 |
| XP 오브 크기 축소 | SphereGeometry radius 0.8→0.35. 스케일도 0.6~1.2 → 0.4~0.8 |
| XP 수집 팝 이펙트 | 수집 순간 스케일 1.5배 팽창 → 0으로 축소(0.15초). emissive 최대 밝기 |
| XP 흡수 곡선 궤적 | vacuum 시 직선 lerp 대신 사인파 곡선 궤적으로 빨려감. 속도 가속 |

- **design**: N
- **verify**: 1) 각 아이템 타입별 고유 형태 구분 가능 2) XP 오브 크기 감소 확인 3) 수집 시 팝 이펙트 동작 4) 60fps 유지

### Phase 4: 지형 텍스처 다양화
| Task | 설명 |
|------|------|
| 잔디 블록 멀티페이스 | 상단 면에 grass_top_green 텍스처 적용. 접근법: 잔디 상단만 별도 InstancedMesh(flat plane)로 분리하여 grass_top 텍스처 오버레이 |
| 미사용 블록 텍스처 활성화 | coal→coal_ore.png, bedrock→bedrock.png, cobblestone→cobblestone.png, gravel→gravel.png 전용 InstancedMesh 추가 |
| 블록 타입 매핑 수정 | MCVoxelTerrain의 MESH_KEY_MAP에서 coal/bedrock/cobblestone/gravel을 stone 대신 고유 키로 분리 |
| MAX_INSTANCES 조정 | 새 블록 타입별 InstancedMesh 용량 설정 (coal 5000, bedrock 3000, cobblestone 5000, gravel 3000) |

- **design**: N
- **verify**: 1) 잔디 블록 상단이 초록색 텍스처 2) coal/bedrock/cobblestone/gravel 고유 텍스처 렌더링 3) draw call 증가 ≤ 5 4) 60fps 유지

### Phase 5: E2E 검증 & 폴리싱
| Task | 설명 |
|------|------|
| TypeScript strict 검증 | tsc --noEmit 0 errors |
| 전체 기능 통합 테스트 | Phase 1-4 기능 브라우저 검증: 파티클/쉐이크/슬로모/원거리/돌진/아이템/텍스처 |
| 성능 프로파일링 | 적 50마리 + 파티클 200개 동시 렌더링 시 60fps 확인 |
| 밸런스 미세 조정 | 원거리/돌진 적 데미지/쿨다운/속도 최종 튜닝 |

- **design**: N
- **verify**: TypeScript 0 errors, 순환 참조 0, 전체 기능 동작 확인, 60fps 유지
