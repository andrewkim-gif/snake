# PLAN: V42 — /new 3D 스킬 & 자동 전투 시스템 통합

## 1. 개요

### 배경
/new 페이지(MatrixScene.tsx)는 MC 블록 좌표 기반 3D 월드에서 동작하지만,
전투 시스템이 고정 25 데미지 auto-attack 하나뿐이다.
기존 2D MatrixApp에는 55종 스킬, 20+ 무기, 콤보, 엘리트 몬스터, 골드/상점 등
완전한 뱀서류 시스템이 구축되어 있으나 좌표계 불일치(픽셀 vs 블록)로 직접 연결이 불가능하다.

### 핵심 목표
MC 블록 좌표 네이티브로 동작하는 전투/스킬 시스템을 구축하여,
"킬 → XP → 레벨업 → 스킬 선택 → 파워업 → 더 강한 적" 도파민 루프를 완성한다.

### 검증된 기술 제약 (da:verify 결과)
| 항목 | 기존 2D 시스템 | /new 3D (MC 블록) | 호환성 |
|------|--------------|------------------|--------|
| 좌표 단위 | 픽셀 (0~6000) | 블록 (0~120) | ❌ 50배 차이 |
| 무기 속도 | 350-600 px/s | 필요: 5-20 blocks/s | ❌ |
| 무기 범위 | 40-300 px | 필요: 2-10 blocks | ❌ |
| 충돌 반경 | 3-40 px | 필요: 0.5-2 blocks | ❌ |
| 3D 렌더러 WORLD_SCALE | 1/50 (pixel→3D) | 필요: 1 (block=3D) | ❌ |
| Z축 매핑 | `-py` (부호 반전) | `py` (반전 없음) | ❌ |

**결론**: 옵션 A — 블록 좌표 네이티브 시스템 구축 (기존 시스템 로직 참고, 수치는 블록 스케일로 재설계)

## 2. 요구사항

### 기능 요구사항
- [FR-01] 무기 자동 발사: 장착 무기(최대 5개)가 쿨다운 기반으로 자동 발사
- [FR-02] 투사체 시스템: 블록 좌표 기반 이동, 적 충돌, 생명주기 관리
- [FR-03] 레벨업 루프: XP 임계값 도달 → 게임 일시정지 → 4개 스킬 카드 선택 → 재개
- [FR-04] 스킬 트리 연결: useSkillBuild의 5카테고리 4티어 스킬 풀 활용
- [FR-05] 3D 투사체 렌더링: 6개 기존 3D 무기 렌더러 수정 후 마운트
- [FR-06] 콤보 킬 시스템: 11티어 콤보로 XP/데미지 배율 증가
- [FR-07] Wave 난이도: 시간 기반 적 강화 + 스폰 패턴 변화
- [FR-08] 엘리트 몬스터: 100-300킬마다 강화 적 출현 + 특수 드롭
- [FR-09] 분기 진화: Lv.11 Path A/B 선택, Lv.20 궁극기 해금

### 비기능 요구사항
- [NFR-01] 성능: 60fps 유지 (적 50마리 + 투사체 100개 동시)
- [NFR-02] 메모리: 투사체/파티클 Object Pool로 GC 최소화
- [NFR-03] 모바일: 터치 입력 지원 (기존 MobileControls3D 활용)

## 3. 기술 방향

- **좌표계**: MC 블록 좌표 (1 block = 1 Three.js unit) — 변환 레이어 없음
- **무기 로직**: 기존 weapons.ts의 발사 패턴(각도, 반사, 관통 등)을 참고하되 수치는 블록 스케일
- **투사체 타입**: 기존 Projectile 인터페이스 재사용 (position/velocity는 블록 단위)
- **렌더링**: 기존 3D 무기 렌더러 6개 복사 후 수정 (WORLD_SCALE=1, Z부호 반전 제거, 원본 보존)
- **상태 관리**: Refs 기반 (React state 아닌 mutable refs로 60fps 유지)
- **레벨업 UI**: 기존 MatrixLevelUp 컴포넌트를 Canvas 외부 DOM 오버레이로 마운트
- **XP 필드**: Player.nextLevelXp (required 필드, XP_THRESHOLDS[level] 참조)
- **WeaponStats 블록 변환 공식**: `area /= 10` (40px→4 blocks), `speed /= 50` (450px/s→9 blocks/s), `knockback /= 10` (35px→3.5 blocks). damage/cooldown/duration/amount/pierce는 스케일 무관이므로 변경 없음

## 4. 아키텍처 개요

```
/new Page
  ├── MatrixScene.tsx (Canvas + SceneContent)
  │   ├── GameLogic (useFrame) ← ★ 무기 발사 + 투사체 업데이트 추가
  │   ├── MCGameCamera
  │   ├── MCVoxelTerrain
  │   ├── VoxelCharacter
  │   ├── EnemyRenderer
  │   ├── PickupRenderer
  │   ├── SwingArc (기존)
  │   ├── DeathParticles (기존)
  │   ├── SkillWeapons3D ← ★ 신규 (블록 좌표 네이티브)
  │   ├── MeleeWeapons3D ← ★ 기존 수정
  │   ├── RangedWeapons3D ← ★ 기존 수정
  │   └── HUD/UI (기존)
  │
  ├── useBlockWeapons.ts ← ★ 신규 Hook (블록 좌표 무기 발사/업데이트)
  ├── useSkillBuild (기존 재사용)
  ├── useCombo (기존 재사용)
  │
  └── DOM Overlays (Canvas 외부)
      ├── MatrixLevelUp ← ★ 연결
      ├── BranchSelectModal ← ★ 연결
      ├── GameHUD3D (기존)
      └── WeaponSlots3D (기존)
```

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 투사체 100개+ 시 프레임 드롭 | 높음 | InstancedMesh 배칭 + Object Pool + count 제한 |
| useSkillBuild의 WeaponStats가 픽셀 기반 | 중간 | 블록 스케일 변환 함수 1개로 중앙화 |
| 레벨업 중 게임 일시정지 구현 복잡도 | 낮음 | useFrame 내 early return + paused ref |
| 기존 3D 렌더러 수정 시 2D 모드 영향 | 중간 | 렌더러 복사 후 수정 (원본 보존) |

## 구현 로드맵

### Phase 1: 블록 좌표 무기 시스템 코어
| Task | 설명 |
|------|------|
| useBlockWeapons Hook | 블록 좌표 기반 무기 발사 + 투사체 업데이트 + 충돌 검사. 초기 6종: whip(근접 휩쓸기), wand(유도 탄), knife(직선 투척), bow(관통 화살), garlic(플레이어 주변 오라), bible(공전 궤도) |
| block-weapon-stats.ts | 블록 스케일 무기 스탯 변환. 공식: `area = px_area / 10` (whip 40px→4블록), `speed = px_speed / 50` (wand 450px/s→9블록/s), `knockback = px_kb / 10`. 데미지/쿨다운/지속시간은 변경 없음 |
| GameLogic 통합 | useFrame에서 useBlockWeapons 호출, 기존 25dmg auto-attack → 무기 시스템으로 교체 |
| projectilesRef 연결 | GameRefs에 투사체 배열 활성화, 투사체 생명주기 관리 |

- **design**: N
- **verify**: 무기 발사 시 투사체 생성 확인, 적 충돌 시 데미지 적용, 쿨다운 정상 작동

### Phase 2: 3D 투사체 렌더링
| Task | 설명 |
|------|------|
| BlockSkillWeapons.tsx | 기존 SkillWeapons.tsx 복사 → WORLD_SCALE=1, Z부호 반전 제거, 지형 높이 적용 |
| BlockMeleeWeapons.tsx | 근접 무기 3D 이펙트 (whip/garlic/bible 등) |
| SceneContent 마운트 | 새 렌더러들을 MatrixScene SceneContent에 추가 |

- **design**: N
- **verify**: 1) 투사체 position(블록 좌표)과 3D mesh position이 일치 (오차 ±0.5 block 이내) 2) 투사체가 지형 높이 + 1.5 block 위에서 이동 3) 적 20마리 + 투사체 50개 동시 렌더링 시 60fps 유지 (NFR-01)

### Phase 3: 레벨업 & 스킬 트리 연결
| Task | 설명 |
|------|------|
| /new page.tsx 확장 | page.tsx에 useSkillBuild + useCombo hook 마운트, MatrixLevelUp/BranchSelectModal DOM overlay 렌더링 추가. gameRefs를 page에서 생성하여 MatrixScene에 주입 |
| XP 임계값 체크 | GameLogic에서 player.xp >= player.nextLevelXp (XP_THRESHOLDS 배열 참조) 감지 → 일시정지 |
| MatrixLevelUp 마운트 | Canvas 외부 DOM 오버레이로 레벨업 카드 UI 렌더링 (onSelect만 필수 prop) |
| useSkillBuild 연결 | 레벨업 시 generateLevelUpChoices() → 4개 옵션 → 선택 → 무기 레벨 증가 |
| 일시정지/재개 | pausedRef를 page.tsx에서 생성 → MatrixScene props로 전달 → GameLogic useFrame early return |
| WeaponStats 블록 변환 | 변환 유틸리티: `toBlockStats(stats: WeaponStats): WeaponStats`. 공식: area/=10, speed/=50, knockback/=10. damage/cooldown/duration/amount/pierce 변경 없음 |

- **design**: N (기존 MatrixLevelUp UI 재사용)
- **verify**: 레벨업 시 게임 멈춤 → 카드 선택 → 새 무기 획득 → 게임 재개 → 무기 발사 확인

### Phase 4: 콤보 & Wave 난이도
| Task | 설명 |
|------|------|
| useCombo 연결 | 킬 시 콤보 카운터 증가, 11티어 배율 적용 (XP/데미지) |
| Wave 시스템 | 시간 기반 적 강화 (HP/데미지/속도 스케일링) + 새 적 타입 등장 |
| 엘리트 몬스터 | 100-300킬마다 silver/gold/diamond 티어 엘리트 스폰 |
| Phase 전환 연출 | SKIRMISH → ENGAGEMENT → SHOWDOWN 텍스트 배너 |

- **design**: N
- **verify**: 콤보 티어 변화 시 XP 배율 증가, 시간 경과에 따라 적 강도 증가

### Phase 5: 분기 진화 & 폴리싱
| Task | 설명 |
|------|------|
| BranchSelectModal 연결 | Lv.11 도달 시 Path A/B 선택 UI |
| 궁극기 해금 | Lv.20 도달 시 Ultimate 무기 활성화 + 전체 화면 이펙트 |
| PostProcessing 활성화 | Bloom + Vignette 이펙트 켜기 (주석 해제 + 튜닝) |
| 피드백 강화 | 크리티컬 연타 텍스트, 킬 이펙트 에스컬레이션, 콤보 시각 피드백 |

- **design**: N
- **verify**: Lv.11 분기 선택 동작, Lv.20 궁극기 발동, Bloom 이펙트 정상 렌더링
