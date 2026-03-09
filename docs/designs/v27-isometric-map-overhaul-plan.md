# PLAN: v27 Isometric Map Overhaul — Professional Asset Integration

> **Date**: 2026-03-09
> **Scope**: v26 아이소메트릭 렌더링 시스템을 전문 에셋 팩(2,948 PNG)으로 교체
> **Goal**: 각 국가 특성에 따른 유기적 맵 생성 + 구름/오브젝트/애니메이션 통합

---

## 1. 현황 분석

### 현재 시스템 (v26)
- **타일 크기**: 64x32 (다이아몬드 프로젝션)
- **지형 6종**: Grass/Water/Mountain/Forest/Desert/Beach — 단색 다이아몬드 또는 AI 생성 64x32 PNG
- **건물 5종**: House/Farm/Barracks/Road/Market — 단색 아이소메트릭 박스 Graphics
- **시민**: 3px 원 또는 12px AI 생성 스프라이트
- **맵 생성**: 클라이언트 해시 노이즈 (국가 ISO3 시드) → island 형태
- **레이어**: tileLayer → buildingLayer → overlayLayer → citizenLayer

### 전문 에셋 팩 (apps/web/public/game/)
- **2,948 PNG 파일**, 256x256 RGBA
- **4방향 변형**: 모든 타일 N/S/E/W 회전
- **카테고리**: Ground(113), Wall(104), Roof(57), Stone(22), Tree(18), Misc(99), Flora(13), WallFlora(14), Door(8), Chest(6), Shadow(13)
- **구름**: Cloud1~3 (1200x300)
- **캐릭터**: 7종 × 24 애니메이션 (1920x1024 스프라이트 시트)
- **애니메이션**: Water Ripples(13), WindMill(2), Destructible(17), Effects(14), Props(11)

### 핵심 변화
| 항목 | v26 | v27 |
|------|-----|-----|
| 타일 크기 | 64×32 | 256×256 (아이소 다이아몬드로 표시) |
| 지형 종류 | 6 단색 | 113 Ground + 22 Stone + 전환 타일 |
| 건물 | 단색 박스 | Wall+Roof+Door 조합 (자동 생성 건물) |
| 장식 | 없음 | Flora(13) + Tree(18) + Misc(99) + WallFlora(14) |
| 그림자 | 없음 | Shadow(13종) 오버레이 |
| 구름 | 없음 | Cloud(3종) 패럴랙스 레이어 |
| 물 애니메이션 | 없음 | Water Ripples(13종 × 16프레임) |
| 시민 | 3px 원 | 1920×1024 스프라이트 시트 (8방향 + 24 애니메이션) |

---

## 2. 에셋 카탈로그 & 바이옴 매핑

### 2.1 Ground 타일 분류 (A~J → 바이옴 매핑)

| Letter | 추정 바이옴 | 타일 수 | 용도 |
|--------|------------|---------|------|
| **A** | 풀밭/잔디 (Grass) | 23 | 기본 초원 지형 + 전환 에지 |
| **B** | 흙/진흙 (Dirt) | 6 | 경작지, 도로 주변 |
| **C** | 모래 (Sand) | 6 | 사막, 해변 |
| **D** | 자갈/진흙길 (Gravel) | 4 | 도로, 광산 주변 |
| **E** | 돌바닥 (Stone Floor) | 15 | 도시 포장, 성 내부 |
| **F** | 눈 (Snow) | 6 | 극지 국가 |
| **G** | 경작지 (Farmland) | 22 | 농업 국가 + 전환 에지 |
| **H** | 늪지 (Swamp) | 11 | 열대 습지 국가 |
| **I** | 화산재 (Volcanic) | 10 | 화산 지역 |
| **J** | 물/해안 (Water Edge) | 10 | 해안선 전환 타일 |

### 2.2 국가 바이옴 매핑 시스템

서버의 195개 국가를 **6개 기후대**로 분류하고, 각 기후대에 Ground/Tree/Flora 타일을 매핑:

| 기후대 | Ground | Tree | Flora | Wall | Roof | 예시 국가 |
|--------|--------|------|-------|------|------|-----------|
| **Temperate** (온대) | A(풀)+B(흙) | A+B | A+B | A+B | A+B | KOR, JPN, DEU, FRA |
| **Arid** (건조) | C(모래)+D(자갈) | D(선인장) | — | C+D | C | SAU, EGY, IRQ, AUS |
| **Tropical** (열대) | A(풀)+H(늪) | B+C+E | A+B | A+E | D+E | BRA, IDN, THA, NGA |
| **Arctic** (극지) | F(눈)+A | D(침엽수) | — | F+G | F | RUS, CAN, NOR, ISL |
| **Mediterranean** (지중해) | A(풀)+E(돌) | A+E | A+B | B+C | B+C | ITA, GRC, ESP, TUR |
| **Urban** (도시국가) | E(돌)+D(자갈) | — | — | D+E+F | E+F | SGP, MCO, HKG |

### 2.3 타일 Auto-Tiling 규칙

Ground 타일 내 번호는 **에지/코너 전환 타일**:
- **1**: 전체 채움 (center)
- **2~10**: 4방향 에지 (N/S/E/W) + 4 코너 (NE/NW/SE/SW) + 내부 코너
- **11+**: 변형/디테일 (풀 길이, 꽃, 돌멩이 등)

Wang Tile / Marching Squares 기반 자동 전환:
- 같은 바이옴 인접 → center 타일
- 다른 바이옴 인접 → 해당 방향 에지 타일
- 물↔땅 → J시리즈 해안선 전환

---

## 3. 아키텍처 설계

### 3.1 타일 좌표계 변경

```
v26: ISO_TILE_WIDTH=64, ISO_TILE_HEIGHT=32
v27: ISO_TILE_WIDTH=128, ISO_TILE_HEIGHT=64  (256px 에셋을 1/2 스케일)
     또는 런타임에 256→128 다운스케일 (GPU에서)
```

256px 원본을 그대로 쓰면 30x30 맵 = 7,680x3,840px → 너무 큼.
**128x64 다이아몬드** (256px 에셋을 0.5배 스케일)로 렌더하고, 줌 인 시 원본 해상도 활용.

### 3.2 렌더링 레이어 파이프라인 (아래→위)

```
Layer 0: Ground       — 지형 타일 (Ground A~J × 방향)
Layer 1: Water Anim   — Water Ripples 애니메이션 (물 타일 위)
Layer 2: Stone/Path   — 돌바닥, 도로 (Stone A1~A22)
Layer 3: Shadow       — 건물/나무 그림자 (Shadow 1~13)
Layer 4: Wall         — 건물 벽 (Wall A~G) + Door
Layer 5: Misc/Props   — 가구/소품 (Misc A~E)
Layer 6: Flora        — 지면 식생 (Flora A~B)
Layer 7: Tree         — 나무 (Tree A~E)
Layer 8: WallFlora    — 벽면 덩굴 (WallFlora A1~A14)
Layer 9: Roof         — 건물 지붕 (Roof A~G)
Layer 10: Chest       — 상자/보물
Layer 11: Citizens    — 시민 스프라이트
Layer 12: Effects     — 전투/버프 이펙트
Layer 13: Cloud       — 구름 패럴랙스 (화면 위 떠다님)
Layer 14: UI Overlay  — 호버, 선택 하이라이트
```

### 3.3 건물 시스템 재설계

v26의 단색 박스 → **Wall + Roof + Door 조합으로 자동 생성**:

```
건물 = Wall 타일 × 발자국 크기 + Roof 타일 × 상단 + Door 1개
```

| 건물 카테고리 | Wall 타입 | Roof 타입 | 크기 | Door |
|-------------|----------|----------|------|------|
| Residential (house) | A (목재) | A (초가) | 1×1 | A1 |
| Farm | B (나무) | B (나무) | 2×2 | A2 |
| Barracks | D (석조+나무) | C (기와) | 2×1 | C1 |
| Market | C (벽돌) | D (천막) | 2×2 | C2 |
| Factory | E (돌) | E (금속) | 3×2 | C3 |
| Government | F (장식석) | F (돔) | 3×3 | C4 |
| Hospital/School | B (나무) | A (초가) | 2×2 | C1 |

기후대별 Wall/Roof 변형:
- Temperate: Wall A+B, Roof A+B
- Arid: Wall C+D, Roof C (flat)
- Tropical: Wall A+E, Roof D+E (넓은 지붕)
- Arctic: Wall F+G, Roof F (두꺼운 눈 지붕)

### 3.4 구름 시스템

`Cloud1~3.png` (1200×300) → 화면 위를 느리게 패럴랙스 이동:
- 3~5개 구름 인스턴스, 랜덤 Y 위치
- 속도: 0.2~0.5 px/frame (줌 무관)
- 투명도: 0.3~0.6 (반투명)
- 카메라 이동과 독립 (화면 좌표계에서 이동)

### 3.5 물 애니메이션

Water Ripples 1~13 (16프레임 × 256×256):
- 물 타일 위에 AnimatedSprite 오버레이
- 13종을 랜덤 배치 (같은 물 타일이라도 다른 리플)
- 프레임레이트: 8fps (부드러운 물결)

### 3.6 시민 스프라이트 시트 통합

1920×1024 스프라이트 시트 → **PixiJS AnimatedSprite**:
- 프레임 추출: 각 시트에서 개별 프레임 슬라이스
- 상태→애니메이션: working→Walk, commuting→Run, shopping→Walk, resting→Idle, protesting→Taunt, idle→Idle
- 8방향: 시트의 행(row)이 방향별 프레임
- 이동 방향에 따라 스프라이트 방향 자동 결정

---

## 4. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 2,948 PNG 일괄 로드 → 메모리 폭발 | High | 바이옴별 on-demand 로딩 (해당 기후대 타일만) |
| 256px 타일 × 6400셀(S등급) → GPU 과부하 | High | 0.5배 스케일 + 뷰포트 컬링 + LOD |
| Ground 타일 A~J 정확한 바이옴 매칭 불확실 | Medium | Phase 1에서 시각 확인 후 매핑 조정 |
| 스프라이트 시트 프레임 분할 규격 불명 | Medium | Phase 1에서 실제 시트 열어서 분석 |
| 기존 서버 CityState와 호환성 | Low | 서버 코드 수정 없음 — 클라이언트만 교체 |

---

## 5. 기술 방향

- **PixiJS 8** 유지 (v26과 동일)
- **타일 크기**: 128×64 화면 표시 (256px 에셋 0.5배)
- **텍스처 로딩**: PixiJS Assets API + Spritesheet descriptor
- **자동 타일링**: 4-bit bitmask (16 패턴) 기반 타일 선택
- **건물 조합**: Wall+Roof+Door 컴포지트 → Container로 묶기
- **구름**: Tiling Sprite + 화면 좌표 패럴랙스
- **물**: AnimatedSprite (PixiJS 8)
- **시민**: AnimatedSprite + Spritesheet JSON
- **서버 수정**: 없음 (순수 클라이언트 렌더링 오버홀)

---

## 구현 로드맵

<!-- da:work Stage 0 파싱 대상 -->

### Phase 1: 에셋 카탈로그 & 텍스처 로더 재구축
| Task | 설명 |
|------|------|
| 에셋 시각 확인 | Ground A~J 대표 타일 5개씩 실제 이미지 확인하여 바이옴 매핑 확정 |
| 에셋 매니페스트 생성 | `iso-asset-manifest.ts` — 전체 에셋 카탈로그 (카테고리/ID/경로/바이옴) |
| 바이옴 정의 | `iso-biome-defs.ts` — 6 기후대 × Ground/Wall/Roof/Tree/Flora 매핑 |
| 텍스처 로더 재구축 | `iso-texture-loader.ts` 완전 재작성 — 바이옴별 on-demand 로드 + PixiJS Assets |
| 국가→바이옴 매핑 | `country-biome-map.ts` — 195국 ISO3 → 기후대 매핑 테이블 |

- **design**: N
- **verify**: 텍스처 로더가 바이옴별 타일을 정상 로드, 콘솔 에러 0

### Phase 2: 타일맵 렌더링 엔진 교체
| Task | 설명 |
|------|------|
| 좌표계 변경 | ISO_TILE_WIDTH=128, ISO_TILE_HEIGHT=64 + tileToScreen/screenToTile 재계산 |
| Ground 렌더링 | 바이옴별 Ground 타일 Sprite 배치 (0.5배 스케일, N방향 기본) |
| Auto-Tiling | 4-bit bitmask 기반 에지/코너 전환 타일 자동 선택 |
| 뷰포트 컬링 | 확대된 타일에 맞춘 컬링 로직 업데이트 |
| 카메라 초기값 | 새 타일 크기에 맞는 줌 범위(0.15~2.0) + 초기 위치 조정 |

- **design**: N
- **verify**: 30×30 맵이 바이옴별 다른 지형으로 렌더링, 부드러운 팬/줌

### Phase 3: 건물 조합 시스템 & 장식
| Task | 설명 |
|------|------|
| 건물 컴포지트 렌더러 | Wall+Roof+Door 타일을 Container로 묶어 건물 생성 |
| 바이옴별 건물 스타일 | 기후대→Wall/Roof 타입 자동 선택 |
| Flora 배치 | 빈 풀밭 타일에 Flora 랜덤 배치 (밀도: 15~25%) |
| Tree 배치 | Forest 지역에 Tree 타일 배치 (바이옴별 종류) |
| Shadow 오버레이 | 건물/나무 뒤에 Shadow 타일 배치 |
| Misc/소품 배치 | 건물 주변에 Misc 소품 랜덤 배치 (시장→상점 소품, 농장→건초 등) |

- **design**: N
- **verify**: 건물이 Wall+Roof+Door 조합으로 표시, 나무/꽃/그림자 배치 확인

### Phase 4: 물 애니메이션 & 구름 패럴랙스
| Task | 설명 |
|------|------|
| Water Ripples AnimatedSprite | 물 타일 위에 13종 리플 애니메이션 오버레이 (8fps) |
| 해안선 전환 타일 | Ground J시리즈로 육지↔물 부드러운 전환 |
| 구름 레이어 | Cloud1~3 TilingSprite, 화면 좌표 패럴랙스 이동 (0.3 투명도) |
| WindMill 애니메이션 | 농업 바이옴 풍차 AnimatedSprite 배치 |

- **design**: N
- **verify**: 물 위에 물결 애니메이션, 해안선 자연스러운 전환, 구름 느리게 이동

### Phase 5: 시민 스프라이트 시트 통합
| Task | 설명 |
|------|------|
| 스프라이트 시트 분석 | Player/NPC 시트 프레임 그리드 파악 (프레임 크기, 행/열) |
| Spritesheet JSON 생성 | PixiJS Spritesheet descriptor 생성 스크립트 |
| AnimatedSprite 시민 | IsoCitizenLayer를 AnimatedSprite 기반으로 재작성 |
| 상태→애니메이션 매핑 | working→Walk, commuting→Run, idle→Idle 등 |
| 방향 감지 | 이동 벡터 → 8방향 중 가장 가까운 방향 스프라이트 선택 |

- **design**: N
- **verify**: 시민이 상태/방향에 맞는 애니메이션으로 이동, 60fps 유지

### Phase 6: 이펙트 & UI 통합
| Task | 설명 |
|------|------|
| 건물 건설 이펙트 | 건설 완료 시 LevelUp 이펙트 재생 |
| 건물 파괴 이펙트 | Destructible 애니메이션 (Wood/Stone/Clay explosion) |
| 버프 이펙트 | 칙령 발동 시 Buff 1~10 중 선택 재생 |
| 포털 이펙트 | Globe→Iso 전환 시 Portal Open/Idle 애니메이션 |
| 건물 배치 UI | 새 타일 크기에 맞춘 호버/선택/배치 프리뷰 |
| ResourceHUD 아이콘 | 기존 AI 아이콘 → Misc 에셋 중 적합한 것으로 교체 |

- **design**: N
- **verify**: 건설/파괴/버프 이펙트 정상 재생, 배치 UI 정상 동작

### Phase 7: 성능 최적화 & 밸런스
| Task | 설명 |
|------|------|
| LOD 시스템 | 줌 아웃 시 Flora/Shadow/WallFlora 숨김, 더 줌 아웃 시 Ground만 표시 |
| 텍스처 아틀라스 | 자주 쓰는 타일 → PixiJS Spritesheet 아틀라스로 배치 호출 감소 |
| 메모리 프로파일 | 바이옴별 로드/언로드로 GPU 메모리 300MB 미만 유지 |
| 바이옴 밸런스 | 195국 전체 맵 생성 테스트, 시각 다양성 확인 |
| tsc + 빌드 검증 | tsc --noEmit 0 에러, next build 성공 |

- **design**: N
- **verify**: 60fps @ 80×80 S등급 맵, GPU 메모리 300MB 미만, tsc 0 에러
