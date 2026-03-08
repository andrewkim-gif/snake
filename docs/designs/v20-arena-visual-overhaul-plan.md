# PLAN: v20 Arena Visual Overhaul — 몬스터/캐릭터/이펙트 완전 리디자인

## 1. 개요

Arena 모드의 4가지 시각적 결함을 완전 수정하는 플랜:
1. **몬스터 지형 관통** — 지표면 위가 아닌 반 블록 아래에 배치
2. **캐릭터 이상** — 얼굴/눈/머리카락 없음, 팔다리 피벗 오류, 2상태 애니메이션
3. **몬스터 디자인** — 단일 0.8³ 큐브 (타입별 색상만 다름)
4. **공격 이펙트 부재** — 투사체/무기 VFX/히트 이펙트/킬 이펙트 없음

## 2. Root Cause 분석

<!-- 각 이슈 상세 원인 -->

### 2.1 몬스터 지형 관통

**원인**: `localY = terrainY - MC_BASE_Y + halfHeight` 공식에서 `+0.5` (블록 표면 오프셋) 누락.
MCTerrain 블록은 Y 좌표 중심에 배치되므로, 표면은 `blockY + 0.5`. 현재 코드는 블록 중심에 엔티티를 배치하여 반 블록 매몰.

**영향 파일**:
- `AREntities.tsx:121` — 적 Y
- `AREntities.tsx:159` — XP 크리스탈 Y
- `ARPlayer.tsx:132` — 플레이어 Y
- `ARNameTags.tsx:217` — 이름태그 Y
- `ARStatusEffects.tsx:159` — 상태이상 링 Y

### 2.2 캐릭터 비주얼 이상

| 문제 | 원인 | 비교 (Classic) |
|------|------|----------------|
| 얼굴 없음 | `MeshLambertMaterial({ color: 0xffe0bd })` 단색 | `HeadGroupManager` + 12 눈 스타일 + 8 입 스타일 |
| 머리카락 없음 | 헤드 = 단색 큐브 | 16 헤어스타일 텍스처 |
| 팔다리 모션 이상 | 기하 중심 피벗 (회전축 = 중앙) | `translate(0, -size/2, 0)` — 어깨/엉덩이 피벗 |
| 2상태만 존재 | idle/walking sin 스윙만 | 10+ 상태 (`IDLE/WALK/BOOST/ATTACK/HIT/DEATH/SPAWN/LEVELUP/VICTORY/COLLECT`) |
| 스킨 없음 | 하드코딩 4색 | `CubelingAppearance` + 24종 스킨 팔레트 |

### 2.3 몬스터 디자인

현재: **단일 `boxGeometry(0.8, 0.8, 0.8)` InstancedMesh** — 5종 적이 색상만 다른 동일 큐브.

| 적 타입 | 현재 | 기대 |
|---------|------|------|
| zombie | 초록 큐브 | MC 좀비 (6파트 큐블링, 초록 피부, 찢어진 옷) |
| skeleton | 회색 큐브 | MC 스켈레톤 (가늘고 긴 팔다리, 흰색) |
| slime | 연초록 큐브 | MC 슬라임 (반투명 구체, 내부 코어) |
| spider | 갈색 큐브 | MC 거미 (낮고 넓은 체형, 8 다리) |
| creeper | 라임 큐브 | MC 크리퍼 (키 큰 체형, 얼굴 패턴) |

### 2.4 공격 이펙트 부재

Classic 모드에서 존재하지만 Arena에서 **`!isArenaMode` 가드로 비활성화**된 VFX:

| Classic 컴포넌트 | 역할 | Arena 등가물 |
|-----------------|------|-------------|
| `WeaponRenderer` | 10종 무기 파티클 VFX | **없음** |
| `AbilityEffects` | 6종 어빌리티 이펙트 | **없음** |
| `BuildEffects` | 빌드별 글로우/잔상/보호막 | **없음** |
| `AuraRings` | 전투 오라 링 | ARPlayer 오라만 |
| `DamageNumbers` | 플로팅 대미지 | ARDamageNumbers (작동) |

서버가 보내는 데이터는 준비됨:
- `ARProjectileNet[]` — 투사체 (보간 시스템 추적 중, 렌더러 없음)
- `ar_damage` 이벤트 — 대미지 (ARDamageNumbers 소비 중)
- `ar_kill`, `ar_elite_explosion`, `ar_boss_spawn` — **어떤 VFX도 소비 안 함**

---

## 3. 기술 방향

### 아키텍처 접근
- **InstancedMesh 유지** — 200+ 적 렌더링에 필수. 단, 단일 큐브 → **타입별 멀티파트 InstancedMesh 그룹**
- **적 모델**: 각 타입별 3-6파트 구성 (바디/헤드/팔/다리 등). 타입당 별도 InstancedMesh 세트
- **프레임 예산**: 모든 useFrame priority=0, 60fps 목표
- **텍스처**: CanvasTexture로 프로시저럴 생성 (외부 에셋 로딩 불안정성 회피)

### 성능 제약
- **적 최대 200개** × **타입 5종** × **파트 최대 6개** = 최악 6000 인스턴스
- **실제**: 타입당 ~40개 × 3-4 InstancedMesh = ~800 인스턴스 (충분히 가능)
- **투사체**: 최대 100개 (작은 빌보드 스프라이트)
- **이펙트**: InstancedMesh 기반 파티클 (최대 200개)

---

## 4. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 적 타입별 멀티파트 InstancedMesh 성능 | draw call 증가 | 타입당 3-4파트로 제한, LOD 유지 |
| 프로시저럴 텍스처 품질 | 픽셀 아트 부자연스러움 | MC 4x4~8x8 해상도 참조, 의도적 복셀 스타일 |
| 캐릭터 리팩토링 범위 | ARPlayer 전체 재작성 | 기존 `cubeling-proportions.ts` + `cubeling-textures.ts` 재활용 |
| 투사체 타이밍 | 서버 20Hz → 클라이언트 60fps 보간 미스매치 | 기존 ar-interpolation 시스템 활용 (이미 projectile 추적 중) |

---

## 구현 로드맵

### Phase 1: 지형 관통 핫픽스 (+0.5 블록 오프셋)
| Task | 설명 |
|------|------|
| AREntities 적 Y 수정 | `localY = terrainY - MC_BASE_Y + 0.5 + finalScale * 0.5` — 블록 표면 위 배치 |
| AREntities 크리스탈 Y 수정 | `localY = terrainY - MC_BASE_Y + 0.5 + floatOffset` |
| ARPlayer Y 수정 | `localY = terrainY - MC_BASE_Y + 0.5 + 1` (발바닥 = 블록 표면) |
| ARNameTags Y 수정 | `localY = terrainY - MC_BASE_Y + 0.5 + heightOffset` |
| ARStatusEffects Y 수정 | `localY = terrainY - MC_BASE_Y + 0.5 + 0.1` |

- **design**: N
- **verify**: 플레이어/적/크리스탈이 블록 표면 위에 서있음. 블록 관통 없음.

### Phase 2: ARPlayer 캐릭터 리디자인 — 큐블링 + 얼굴 + 애니메이션
| Task | 설명 |
|------|------|
| 피벗 수정 | 팔/다리 geometry에 `translate(0, -size/2, 0)` 적용 — 어깨/엉덩이 피벗 |
| 얼굴 텍스처 추가 | `cubeling-textures.ts` 의 `getHeadTexture()` 활용하여 눈/입/머리카락 렌더링 |
| 스킨 시스템 연결 | `CubelingAppearance` 기반 topColor/bottomColor/skinTone/hairColor 적용 |
| 공격 애니메이션 추가 | useFrame 내 공격 상태 감지: 팔 스윙 (근접), 조준 포즈 (원거리) |
| 피격 반응 추가 | 데미지 수신 시: 빨간 플래시 (머티리얼 color 깜빡임) + 살짝 넉백 |
| 사망 애니메이션 추가 | 스핀 + 낙하 + 축소 소멸 (classic DEATH 상태 참조) |

- **design**: N (기존 cubeling 에셋 재활용)
- **verify**: 플레이어 캐릭터에 얼굴(눈/입) 표시됨. 팔다리가 어깨/엉덩이에서 자연스럽게 스윙. 공격/피격/사망 모션 확인.

### Phase 3: 몬스터 멀티파트 리디자인
| Task | 설명 |
|------|------|
| 몬스터 파트 정의 | 타입별 파트 스펙 정의: zombie(6파트), skeleton(6파트), slime(2파트:외피+코어), spider(3파트:몸통+머리+다리군), creeper(4파트:머리+몸+다리2) |
| 몬스터 프로시저럴 텍스처 | CanvasTexture로 각 타입의 얼굴/몸통/팔다리 텍스처 생성 (MC 스타일 4px~8px) |
| AREntities 멀티파트 리팩토링 | 단일 InstancedMesh → 타입별 파트 InstancedMesh 그룹. useFrame에서 각 파트 매트릭스 업데이트 |
| 걷기 애니메이션 추가 | 적 이동 감지 (보간 delta) → 팔다리 sin 스윙 애니메이션 (ARPlayer 방식) |
| 엘리트/미니보스 차별화 | 엘리트: 1.3x 스케일 + 골드 오라 링. 미니보스: 1.8x + 붉은 오라 + 왕관 파트 |
| 슬라임 특수 렌더링 | 반투명 외피 (octahedronGeometry → sphereGeometry) + 불투명 내부 코어. 바운스 애니메이션 |

- **design**: N (MC 레퍼런스 기반 코딩)
- **verify**: 5종 적이 시각적으로 뚜렷하게 구별됨. 걷기 모션 있음. 엘리트/미니보스 차별화 확인.

### Phase 4: 투사체 렌더링 (ARProjectiles)
| Task | 설명 |
|------|------|
| ARProjectiles.tsx 생성 | InstancedMesh 기반 투사체 렌더링. ar_state.projectiles에서 읽기 |
| 보간 위치 적용 | interpRef에서 projectile renderX/renderZ 읽어 60fps 부드러운 이동 |
| 타입별 비주얼 | 무기 타입 → 투사체 형태 매핑 (화살→길쭉한 박스, 파이어볼→오렌지 구, 얼음→파란 팔면체) |
| 트레일 이펙트 | 투사체 뒤에 짧은 파티클 트레일 (3-5프레임 잔상, fade out) |
| GameCanvas3D 마운트 | AR 그룹 내에 `<ARProjectiles>` 추가 |

- **design**: N
- **verify**: 공격 시 투사체가 적을 향해 날아감. 타입별 색상/형태 구별. 트레일 표시.

### Phase 5: 히트/킬/보스 이펙트 (ARCombatVFX)
| Task | 설명 |
|------|------|
| ARCombatVFX.tsx 생성 | 이벤트 큐 소비형 파티클 이펙트 시스템 |
| 히트 이펙트 | ar_damage 이벤트 → 타겟 위치에 히트 스파크 파티클 (4-6개, 방사형, 0.3초) |
| 킬 이펙트 | ar_kill 이벤트 → 사망 위치에 XP 파편 + 연기 파티클 (8-10개, 상승, 0.5초) |
| 엘리트 폭발 | ar_elite_explosion → 원형 폭발 링 + 파편 다수 (반경 기반, 1초) |
| 보스 출현 | ar_boss_spawn → 화면 중앙 문구 "BOSS INCOMING" + 어두운 비네팅 (2초) |
| 보스 처치 | ar_boss_defeated → 대형 폭발 + 보상 파티클 비 (3초) |
| 근접 슬래시 | 플레이어 공격 시 (무기 타입 = melee) → 반원 슬래시 호 이펙트 (0.2초) |

- **design**: N
- **verify**: 적 타격 시 히트 스파크 발생. 적 처치 시 파편 + 연기. 보스 출현/처치 연출 확인.
