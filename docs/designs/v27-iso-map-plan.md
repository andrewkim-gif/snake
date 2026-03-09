# PLAN: v27 아이소메트릭 맵 — 전문 에셋 팩 통합

> **Date**: 2026-03-09 (Updated: 2026-03-09)
> **Status**: Draft → Verified & Enhanced
> **Scope**: 2,948개 전문 PNG 에셋 → PixiJS 8 아이소메트릭 맵 완전 교체
> **Goal**: 국가별 바이옴 기반 자연스러운 맵 + 구름/물/나무/소품 통합 + 낮밤/날씨/미니맵

---

## 1. 에셋 인벤토리 분석 완료

### 1.1 에셋 구조 (`apps/web/public/game/`)

```
public/game/
├── Environment/         1,876 PNG (256×256 RGBA, 4방향 N/S/E/W)
│   ├── Ground [A~J]      113종 × 4방향 = 452 파일
│   │   A(23): 풀밭/잔디        B(6): 흙/진흙         C(6): 모래
│   │   D(4): 자갈/진흙길       E(15): 돌바닥          F(6): 눈
│   │   G(22): 경작지           H(11): 늪지            I(10): 화산재
│   │   J(10): 물/해안 에지
│   ├── Wall [A~G]         104종 × 4방향 = 416 파일
│   │   A(22): 목재벽  B(11): 나무판자  C(6): 벽돌
│   │   D(19): 석조+목재  E(16): 돌벽  F(19): 장식석  G(11): 성벽
│   ├── Roof [A~G]         57종 × 4방향 = 228 파일
│   │   A(10): 초가  B(6): 나무  C(10): 기와  D(10): 천막
│   │   E(10): 금속  F(10): 돔   G(1): 성탑
│   ├── Stone [A]          22종 × 4방향 = 88 파일 (돌바닥/포장)
│   ├── Tree [A~E]         18종 × 4방향 = 72 파일 (+Shadow 1)
│   │   A(4): 활엽수  B(5): 소나무  C(1): 야자수  D(3): 고목  E(5): 관목
│   ├── Flora [A~B]        13종 × 4방향 = 52 파일 (꽃/풀/덤불)
│   ├── WallFlora [A]      14종 × 4방향 = 56 파일 (담쟁이/덩굴)
│   ├── Misc [A~E]         99종 × 4방향 = 396 파일 (소품/가구/잡동사니)
│   │   A(9): 깃발/표지판  B(60): 가구/배럴/상자  C(14): 무기/도구
│   │   D(5): 장식  E(11): 기계/수레
│   ├── Shadow [1~13]      13종 × 4방향 = 52 파일
│   ├── Door [A,C]         8종 × 4방향 = 32 파일
│   ├── Chest [A~B]        6종 × 4방향 = 24 파일
│   └── 특수: BLACK TILE, TilePreview, FirePlace, Torch, TreeTrunkBroken
│
├── Characters/          7종 × 24 애니메이션 = 168 스프라이트시트 (1920×1024)
│   ├── Player/           Idle, Walk, Run, Attack1~5, Die, TakeDamage 등
│   ├── Enemy 1~3/        몬스터 3종
│   └── NPC 1~3/          NPC 3종
│
├── Animations/
│   ├── Animated Tiles/   Water Ripples 1~13 (각 16프레임), WindMill 1~2 (17프레임)
│   ├── Destructible tiles/ 17종 폭발 애니메이션 (16~20프레임)
│   ├── Effects/          AoE, Bolt, Buff1~10, Cone, Dash, Hook, LevelUp (512×512 등)
│   └── Props/            Barrel1~3, Fire, Gas, Portal, Skeleton, Torch, Turret
│
└── Other/               Cloud1~3 (1200×300), GodRay, DashLine, AoEFire, ItemRay
```

### 1.2 에셋 명명 규칙

모든 Environment 타일은 **`{Category} {Letter}{Number}_{Direction}.png`** 패턴:
- **Category**: Ground, Wall, Roof, Stone, Tree, Flora, WallFlora, Misc, Shadow, Door, Chest
- **Letter**: 시리즈/바이옴 그룹 (A=기본, B~J=변형)
- **Number**: 해당 시리즈 내 변형 번호 (아래 1.3 참조)
- **Direction**: N/S/E/W — **카메라가 바라보는 방향** (에지 방향이 아님!)

캐릭터 시트: `1920×1024` = **15컬럼 × 8행** (확인: 128×128 프레임, 8방향)

### 1.3 에셋 픽셀 분석 결과 (검증 완료)

#### 방향(_N/_S/_E/_W)의 정확한 의미

실제 픽셀 비교 분석 결과:

| 카테고리 | N/S/E/W 차이 | 해석 |
|----------|-------------|------|
| **Ground** | 거의 동일 (diff ≈ 0.1) | 지면 타일은 방향 무관. **_S만 사용해도 충분** |
| **Wall** | 완전히 다름 (diff 10~34) | 각 방향은 **카메라 앵글별 건물 벽면 렌더**. _S=좌측 벽면, _E=우측 벽면 |
| **Roof** | 완전히 다름 (diff 11~24) | 카메라 앵글별 지붕 형태. _S와 _E는 alpha 형태까지 다름 |
| **Tree** | 약간 다름 (diff 7~8) | 나무 실루엣 미세 차이. _S 기본으로 충분 |

→ **결론**: 카메라 고정(S) 시 Ground/Tree는 _S만, Wall/Roof는 _S 사용. 향후 카메라 회전(90° 단계) 지원 시 전체 NSEW 활용.

#### Ground 타일 변형 번호의 실제 의미

Ground A 시리즈(23종) 픽셀 분석:

| 번호 | 크기 (px) | 위치 | 분류 |
|------|----------|------|------|
| A1 | 128×80 (full diamond) | 중앙 | **완전 타일** — 기본 바닥 |
| A2, A5 | 131×73 (full) | 중앙 | **완전 타일 변형** — 약간 다른 풀 패턴 |
| A3 | 83×71 (좌편향) | 좌측 | **좌측 반쪽** — 지형 경계용 |
| A4 | 91×46 (작은) | 중앙 | **코너/소형 조각** |
| A8-9 | 87~106 (우편향) | 우측 | **우측 반쪽** — 지형 경계용 |
| A10-14 | 92~131 (다양) | 중앙 | **변형 타일** — 디테일 차이 |
| A15-19 | 128×43~65 (얇은) | 중앙 | **얇은 변형** — 좁은 영역용 |
| A20-24 | 32~91 (소형) | 좌/우 | **데코/조각** — 작은 빈틈 채우기용 |

⚠️ **주의**: 번호가 center/edge/corner를 규칙적으로 구분하지 않음!
- 1~2 = 대체로 full diamond (안전한 기본 타일)
- 3+ = 크기/형태가 비규칙적 — **에셋 시각 카탈로그로 수동 분류 필요** (Phase 0)
- 시리즈마다 변형 수가 다름 (A=23, C=6, F=6) → 일률적 매핑 불가

#### 타일 배치 좌표계 (256×256 캔버스 내)

```
256×256 PNG 캔버스 내 위치:
┌─────────────────────────┐ y=0
│                         │
│     (Tree/Wall 영역)     │ y=0~175: 지면 위 오브젝트
│                         │
├── ─ ─ ─ ─ ─ ─ ─ ─ ─ ──┤ y=176
│    ◇ Ground Diamond ◇   │ y=176~255: 지면 다이아몬드
│   x=64 ←── 128px ──→ 191│ 중심: (128, 216)
└─────────────────────────┘ y=255
```

- **Ground**: 캔버스 하단 (Y=176~255), 128×80px 다이아몬드
- **Wall**: 캔버스 중~하단 (Y=73~240), Ground 위로 103px 돌출
- **Roof**: 캔버스 중~하단 (Y=103~255), Wall 위에 오버레이
- **Tree**: 캔버스 상~중 (Y=17~219), 가장 키 큰 오브젝트

→ 모든 에셋이 **같은 타일 위치에 겹쳐 배치**되도록 설계됨. 별도 Y 오프셋 불필요.

## 2. 바이옴 시스템 설계

### 2.1 6개 기후대 정의

각 국가의 `continent` + 위도/경도 + 국가 특성으로 기후대를 결정. 기후대마다 사용할 에셋 조합이 완전히 다름.

| 기후대 | Ground 주력 | Ground 보조 | Tree | Flora | Wall | Roof | 특징 |
|--------|------------|------------|------|-------|------|------|------|
| **Temperate** (온대) | A(잔디) | B(흙), E(돌바닥) | A(활엽수)+B(소나무) | A+B | A(목재)+B(판자) | A(초가)+B(나무) | 표준 마을, 풍차 |
| **Arid** (건조) | C(모래) | D(자갈), I(화산재) | D(고목, 선인장 대용) | — (없음) | C(벽돌)+D(석조) | C(기와, flat) | 모래 광야, 오아시스 |
| **Tropical** (열대) | A(잔디) | H(늪), G(경작지) | C(야자수)+E(관목) | A(풍성)+B | A(목재)+E(돌) | D(천막)+E(금속) | 밀림, 습지 |
| **Arctic** (극지) | F(눈) | A(잔디, 일부) | B(소나무) | — (없음) | F(장식석)+G(성벽) | F(돔, 두꺼운) | 눈 덮인 마을, 성채 |
| **Mediterranean** (지중해) | A(잔디) | E(돌바닥), C(모래) | A(활엽수)+E(관목) | A+B | B(판자)+C(벽돌) | B(나무)+C(기와) | 돌길 마을, 포도밭 |
| **Urban** (도시국가) | E(돌바닥) | D(자갈) | — (없음) | — (없음) | D(석조)+E(돌)+F(장식) | E(금속)+F(돔) | 포장도로, 고층 |

### 2.2 국가→기후대 매핑 (195국)

대륙 + 위도 기반 자동 매핑 규칙:

```typescript
function getClimateZone(country: CountryClientState): ClimateZone {
  const { continent, latitude, iso3 } = country;

  // 도시국가 우선
  if (['SGP', 'MCO', 'HKG', 'MAC', 'VAT', 'AND', 'LIE', 'SMR', 'MLT'].includes(iso3))
    return 'urban';

  // 위도 기반 극지
  if (Math.abs(latitude) > 60) return 'arctic';

  // 대륙 + 위도 조합
  if (continent === 'Africa') {
    if (latitude > 20 || latitude < -25) return 'arid';  // 사하라, 칼라하리
    return 'tropical';                                     // 적도 아프리카
  }
  if (continent === 'South America') {
    if (latitude < -30) return 'temperate';               // 아르헨티나 남부
    return 'tropical';                                     // 아마존
  }
  if (continent === 'Asia') {
    if (['SAU', 'IRQ', 'IRN', 'ARE', 'KWT', 'QAT', 'BHR', 'OMN', 'YEM'].includes(iso3))
      return 'arid';
    if (latitude < 10) return 'tropical';                  // 동남아
    if (latitude > 50) return 'arctic';                    // 시베리아
    return 'temperate';                                    // 동아시아
  }
  if (continent === 'Europe') {
    if (['ITA', 'GRC', 'ESP', 'PRT', 'HRV', 'CYP', 'TUR'].includes(iso3))
      return 'mediterranean';
    if (latitude > 60) return 'arctic';                    // 노르딕
    return 'temperate';                                    // 서유럽, 중유럽
  }
  if (continent === 'Oceania') {
    if (['AUS'].includes(iso3)) return 'arid';
    return 'tropical';                                     // 태평양 섬국가
  }
  if (continent === 'North America') {
    if (latitude > 55) return 'arctic';                    // 캐나다 북부
    if (latitude < 20) return 'tropical';                  // 중미, 카리브
    return 'temperate';
  }
  return 'temperate'; // fallback
}
```

### 2.3 바이옴 내 타일 선택 전략

1. **주력 Ground 70%**: 해당 기후대 메인 시리즈에서 **full diamond 변형**(1~2번)만 랜덤 선택
2. **보조 Ground 20%**: 보조 시리즈의 full diamond 변형으로 자연스러운 변화
3. **특수 Ground 10%**: 도로/건물 주변은 돌바닥(E/Stone), 해안은 J(물에지)
4. **방향 고정**: 카메라 고정 → **_S 방향만 사용** (Ground/Tree/Flora는 방향 차이 무시할 수준)
5. **반쪽/조각 타일**: 지형 경계에서 full diamond 대신 반쪽 타일(A3, A8 등) 오버레이로 부드러운 전환

> ⚠️ Phase 0에서 에셋 시각 카탈로그를 생성하여 각 번호의 full/half/corner/deco 분류를 확정한 뒤 매핑 테이블 작성

## 3. 아키텍처 — 15 Layer 렌더링 파이프라인

기존 v26의 3-Layer (tile/building/overlay) → 15-Layer 렌더링 파이프라인으로 대폭 확장.

```
아래→위 (z-order):

Layer 0:  Ground          지형 타일 (Ground A~J, 바이옴별)
Layer 1:  WaterAnim       Water Ripples AnimatedSprite (물 타일 위)
Layer 2:  StonePath       돌바닥/도로 (Stone A1~A22)
Layer 3:  Shadow          건물/나무 그림자 (Shadow 1~13)
Layer 4:  Flora           지면 식생 (Flora A~B) — 풀, 꽃, 덤불
Layer 5:  Wall            건물 벽 (Wall A~G) + Door
Layer 6:  Misc            가구/소품 (Misc A~E) — 배럴, 상자, 표지판
Layer 7:  Tree            나무 (Tree A~E)
Layer 8:  WallFlora       벽면 덩굴 (WallFlora A1~A14)
Layer 9:  Roof            건물 지붕 (Roof A~G)
Layer 10: Chest           상자/보물 (Chest A~B)
Layer 11: Citizens        시민 AnimatedSprite
Layer 12: Effects         전투/버프/건설 이펙트
Layer 13: Cloud           구름 패럴랙스 (화면 좌표계)
Layer 14: UIOverlay       호버/선택 하이라이트, 배치 프리뷰
```

### 3.1 좌표계 변경

```
v26: ISO_TILE_WIDTH = 64,  ISO_TILE_HEIGHT = 32   (원본 그대로)
v27: ISO_TILE_WIDTH = 128, ISO_TILE_HEIGHT = 64   (256px를 0.5x 스케일)
```

- 256px 원본을 다이아몬드 마스크 없이 그대로 배치 → Sprite.scale = 0.5
- 대형 맵(S등급 80×80) = 10,240 × 5,120 world px → 뷰포트 컬링 필수
- 줌 범위: 0.15(전체 조감) ~ 2.0(근접 디테일)

### 3.2 타일 배치 순서 (Depth Sorting)

아이소메트릭 depth sort는 **y-then-x** 순서:
```typescript
for (let y = 0; y < mapSize; y++) {
  for (let x = 0; x < mapSize; x++) {
    // 각 레이어를 이 순서로 배치하면 자연스러운 가림(occlusion)
    renderGround(x, y);     // Layer 0
    renderStonePath(x, y);  // Layer 2
    renderShadow(x, y);     // Layer 3
    renderFlora(x, y);      // Layer 4
    renderWall(x, y);       // Layer 5
    renderMisc(x, y);       // Layer 6
    renderTree(x, y);       // Layer 7
    renderWallFlora(x, y);  // Layer 8
    renderRoof(x, y);       // Layer 9
  }
}
```

오브젝트(Tree, Wall 등)는 **높이(height)**가 있으므로 뒤쪽 타일의 오브젝트가 앞쪽 타일의 Ground 위에 렌더되어야 함. 이를 위해 각 Container 내에서 `zIndex` = `tileX + tileY`로 설정하고 `sortableChildren = true` 적용.

### 3.3 컨테이너 구조 (PixiJS)

```typescript
const worldContainer = new Container(); // 카메라 트랜스폼 적용 대상

// 지면 레이어 (y*mapSize+x 순서로 정렬)
const groundLayer     = new Container(); // Layer 0
const waterAnimLayer  = new Container(); // Layer 1
const stonePathLayer  = new Container(); // Layer 2

// 깊이 정렬 오브젝트 레이어 (sortableChildren=true)
const shadowLayer     = new Container(); // Layer 3
const floraLayer      = new Container(); // Layer 4
const wallLayer       = new Container(); // Layer 5
const miscLayer       = new Container(); // Layer 6
const treeLayer       = new Container(); // Layer 7
const wallFloraLayer  = new Container(); // Layer 8
const roofLayer       = new Container(); // Layer 9
const chestLayer      = new Container(); // Layer 10
const citizenLayer    = new Container(); // Layer 11
const effectLayer     = new Container(); // Layer 12

// 화면 고정 레이어 (카메라 트랜스폼 미적용)
const cloudLayer      = new Container(); // Layer 13
const uiOverlay       = new Container(); // Layer 14
```

## 4. 맵 생성 알고리즘

v26의 해시 노이즈 기반 지형 생성을 확장하여, 바이옴별 다른 에셋이 자연스럽게 배치되도록 함.

### 4.1 지형 생성 파이프라인

```
Step 1: 기본 노이즈 (v26 유지)
  ├── ISO3 해시 시드 → 결정론적 pseudo-noise
  ├── 섬 형태: 중심부 육지 + 외곽 해안/물
  └── 출력: TileType[][] (Grass/Water/Mountain/Forest/Desert/Beach)

Step 2: 바이옴 매핑 (v27 신규)
  ├── 국가 기후대 → Ground 시리즈 결정
  ├── TileType → Ground 시리즈 변환:
  │     Grass → 기후대.mainGround (온대=A, 건조=C, 극지=F)
  │     Forest → 기후대.mainGround + Tree 배치 마킹
  │     Desert → C(모래) 고정
  │     Beach → J(해안에지) + C(모래)
  │     Mountain → D(자갈) + Stone + 높이맵
  │     Water → J(해안에지) + Water Ripple 마킹
  └── 출력: GroundTile[][] + DecorationMap

Step 3: 타일 변형 선택 (Auto-Variation)
  ├── 같은 바이옴 내부 → full diamond 변형 (1~2번) 중 시드 기반 랜덤
  ├── 바이옴 경계 → full diamond 기본 + 반쪽 조각 타일 오버레이 (Layer 0.5)
  ├── ⚠️ 4-bit bitmask → 번호 매핑은 Phase 0 시각 카탈로그 확정 후 결정
  └── 출력: 각 셀의 최종 Ground ID (번호 + _S 방향 고정)

Step 4: 장식 배치
  ├── Flora: 풀밭 셀의 15~25%에 랜덤 배치 (기후대별 시리즈)
  ├── Tree: Forest 셀에 80% 밀도 + 주변 Grass에 10% 밀도
  ├── Misc: 건물 인접 셀에 소품 배치 (농장→건초, 시장→상자)
  ├── Shadow: 나무/건물 뒤(SE 방향)에 자동 배치
  └── Stone: 도로/건물 주변에 돌바닥 배치
```

### 4.2 지형 경계 처리 (Revised)

기존 4-bit bitmask는 타일 번호가 규칙적이라는 가정이었으나, 실제 에셋 분석 결과 번호가 비규칙적이므로 **2단계 접근**으로 변경:

```
Stage 1: 기본 Ground 배치
  모든 셀에 해당 바이옴의 full diamond 타일 배치 (번호 1 or 2)
  시드 기반 변형 선택으로 단조로움 방지

Stage 2: 경계 오버레이 (Phase 0 카탈로그 결과에 따라)
  바이옴 경계 감지 → 경계 방향에 맞는 half/corner 타일 오버레이
  half/corner 타일 목록은 Phase 0 에셋 시각 카탈로그에서 확정

  예시 (Phase 0 후 채울 테이블):
  ┌──────────────────┬──────────────────────────────┐
  │ 경계 상황         │ 오버레이 타일 후보            │
  ├──────────────────┼──────────────────────────────┤
  │ 좌측 경계         │ A3, A21, A23, A24 (좌편향)   │
  │ 우측 경계         │ A8, A9, A20 (우편향)         │
  │ 전체 채움         │ A1, A2, A5, A10 (full)      │
  │ 작은 빈틈         │ A4, A7, A11 (소형)          │
  └──────────────────┴──────────────────────────────┘
  ※ 위 표는 예시 — Phase 0에서 이미지 확인 후 확정
```

### 4.3 국가별 고유성 보장

- **시드 기반**: ISO3 해시가 노이즈 + 타일 변형 선택에 모두 영향
- **기후대**: 같은 온대라도 KOR과 DEU는 다른 시드 → 다른 지형 형태
- **변형 랜덤**: 같은 bitmask라도 시드에 따라 다른 번호 타일 선택
- **장식 밀도**: 시드 기반으로 Flora/Tree 배치 위치가 달라짐
- **결과**: 195국 모두 고유한 맵 + 기후대별 시각적 일관성

## 5. 건물 컴포지트 시스템 (Revised)

v26의 단색 박스 → **Wall + Roof + Door 오버레이 레이어링**으로 진짜 건물처럼 보이게.

> ⚠️ **검증 결과**: 각 Wall 이미지는 **한 방향에서 본 건물 전체**이며, 타일 단위 조립 블록이 아님.
> Wall A1_S (82×168px 좌편향) + Wall A1_E (82×168px 우편향)은 38.5% 겹침 → 보완적 L/R 면이 아님.
> 따라서 **같은 타일 위치에 Wall→Door→Roof 순서로 1장씩 오버레이**하는 방식 사용.

### 5.1 건물 렌더링 방식 (Layer Stacking)

```
같은 타일 좌표에 순서대로 스프라이트 겹침:
  1. Ground (Layer 0) — 기본 바닥
  2. Wall   (Layer 5) — 건물 벽면 (_S 방향, 1장)
  3. Door   (Layer 5) — 문 오버레이 (Wall 위에, 1장)
  4. Roof   (Layer 9) — 지붕 (최상단, 1장)

모든 에셋이 256×256 캔버스 내에서 같은 기준점에 맞춰 제작되어 있으므로,
같은 tileToScreen(x,y) 좌표에 Sprite.anchor=(0.5, 1.0)로 배치하면
자동으로 정렬됨.
```

### 5.2 건물 조합 규칙

```typescript
interface BuildingComposite {
  // 벽면: 1장 Sprite (같은 타일 좌표에 배치)
  wallType: string;        // Wall 시리즈 (A~G)
  wallVariant: number;     // 사용할 번호 (1장)

  // 지붕: Wall 위에 오버레이 (같은 좌표, Layer 9)
  roofType: string;        // Roof 시리즈 (A~G)
  roofVariant: number;

  // 문: Wall 위에 오버레이 (같은 좌표, Layer 5)
  doorType: string;        // Door 시리즈 (A, C)
  doorVariant: number;

  // 장식: 건물 주변 인접 타일에 Misc 배치
  miscItems?: string[];    // Misc 소품 ID 목록
}
```

### 5.2a 건물 카테고리별 조합

| 건물 (v26 defId) | 크기 | Wall 타입 | Roof 타입 | Door | 주변 Misc |
|-----------------|------|-----------|-----------|------|-----------|
| `house` | 1×1 | A (목재) | A (초가) | A1 | B1~B5 (가구) |
| `farm` | 2×2 | B (판자) | B (나무) | A2 | E1~E3 (수레, 건초) |
| `barracks` | 2×1 | D (석조) | C (기와) | C1 | C1~C5 (무기) |
| `market` | 2×2 | C (벽돌) | D (천막) | C2 | B10~B20 (상자, 배럴) |
| `factory` | 3×2 | E (돌) | E (금속) | C3 | E5~E11 (기계) |
| `power_plant` | 2×2 | E (돌) | E (금속) | C4 | E8~E11 (기계) |
| `hospital` | 2×2 | B (판자) | A (초가) | C1 | A1~A5 (표지판) |
| `school` | 2×2 | B (판자) | A (초가) | C2 | A1~A5 (표지판) |
| `church` | 2×1 | F (장식석) | F (돔) | C5 | D1~D3 (장식) |
| `government` | 3×3 | F (장식석) | F (돔) | C6 | A6~A9 (깃발) |

### 5.2b 전체 53개 건물 시각 등급 분류 (v27 추가)

buildingDefs.ts의 53개 건물을 6개 시각 등급으로 분류하여 Wall/Roof 매핑:

| 시각 등급 | Wall 기본 | Roof 기본 | Door | 해당 건물 |
|----------|-----------|-----------|------|----------|
| **소형 목조** | A (목재) | A (초가) | A1 | house, housing, apartment, clinic, road |
| **중형 목조** | B (판자) | B (나무) | A2 | farm, logging_camp, sawmill, school, hospital, warehouse, entertainment, 각종 plantation (6종) |
| **중형 석조** | C (벽돌) | C (기와) | C2 | market, fishing_wharf, food_factory, sugar_mill, cigar_factory, textile_mill, university |
| **대형 공장** | E (돌) | E (금속) | C3 | factory, power_plant(3종), steel_mill, aluminum_smelter, plastics_plant, chemical_plant, refinery, electronics_factory, machinery_plant, semiconductor_fab, port, airport |
| **군사 시설** | D (석조+목재) | C (기와) | C1 | barracks, weapons_depot, military_base |
| **정부/종교** | F (장식석) | F (돔) | C5-6 | church, town_hall, capitol, luxury_workshop, pharma_lab, aerospace_complex |

> 각 등급은 기후대별 오버라이드 적용 (아래 5.3 참조)

### 5.3 기후대별 건물 스타일 오버라이드

기후대에 따라 Wall/Roof 타입이 자동으로 바뀜:

| 기후대 | house Wall→ | house Roof→ | barracks Wall→ | 특수 |
|--------|-----------|-------------|---------------|------|
| Temperate | A(목재) | A(초가) | D(석조) | 기본 |
| Arid | C(벽돌) | C(flat기와) | D(석조) | 창문 적음 |
| Tropical | A(목재) | D(천막) | E(돌) | 넓은 지붕 |
| Arctic | F(장식석) | F(두꺼운) | G(성벽) | 두꺼운 벽 |
| Mediterranean | B(판자) | C(기와) | C(벽돌) | 테라코타 느낌 |
| Urban | E(돌)+D | E(금속) | F(장식) | 현대적 |

### 5.4 건물 렌더링 (Revised — 오버레이 레이어링)

```typescript
function renderBuildingComposite(def: BuildingDef, tileX: number, tileY: number, climate: ClimateZone) {
  const comp = getBuildingComposite(def.id, climate);
  const { sx, sy } = tileToScreen(tileX, tileY);

  // 1×1 건물: Wall + Door + Roof를 같은 타일 좌표에 겹침
  // 256×256 에셋이 동일 기준점에 맞춰 제작되어 있어 자동 정렬됨

  // 1. Wall (Layer 5) — 건물 벽면
  const wallSprite = loadTile('Wall', comp.wallType, comp.wallVariant, 'S');
  wallSprite.anchor.set(0.5, 1.0);
  wallSprite.scale.set(0.5); // 256→128
  wallSprite.position.set(sx, sy);
  wallLayer.addChild(wallSprite);

  // 2. Door (Layer 5, Wall 위) — 문 오버레이
  const doorSprite = loadTile('Door', comp.doorType, comp.doorVariant, 'S');
  doorSprite.anchor.set(0.5, 1.0);
  doorSprite.scale.set(0.5);
  doorSprite.position.set(sx, sy);
  wallLayer.addChild(doorSprite);

  // 3. Roof (Layer 9) — 지붕
  const roofSprite = loadTile('Roof', comp.roofType, comp.roofVariant, 'S');
  roofSprite.anchor.set(0.5, 1.0);
  roofSprite.scale.set(0.5);
  roofSprite.position.set(sx, sy);
  roofLayer.addChild(roofSprite);

  // 4. 2×2+ 건물: 중심 타일에 1세트 배치 + 발자국 점유만 등록
  //    (Wall/Roof 에셋 자체가 크기를 표현하므로 반복 배치 불필요)
  //    다만 Wall 시리즈 내 큰 번호(높은 번호=넓은 벽)를 선택하여 크기감 조절
}
```

## 6. 애니메이션 시스템 (물결/구름/시민/이펙트)

### 6.1 물결 애니메이션 (Water Ripples)

- **에셋**: Water Ripples 1~13, 각 16프레임 (256×256)
- **배치**: `TileType.Water` 셀 위에 AnimatedSprite 오버레이
- **다양성**: 13종을 랜덤 배치 → 같은 물이라도 다른 물결 패턴
- **프레임레이트**: 8fps (부드러운 물결)
- **최적화**: 뷰포트 밖 물 타일은 애니메이션 정지 (`animatedSprite.playing = false`)

```typescript
function createWaterRipple(tileX: number, tileY: number, seed: number): AnimatedSprite {
  const rippleIndex = (hashTile(tileX, tileY, seed) % 13) + 1; // 1~13
  const frames = loadRippleFrames(rippleIndex); // 16 Texture[]
  const sprite = new AnimatedSprite(frames);
  sprite.animationSpeed = 8 / 60; // 8fps at 60fps ticker
  sprite.loop = true;
  sprite.scale.set(0.5); // 256→128
  sprite.position.set(...tileToScreen(tileX, tileY));
  sprite.play();
  return sprite;
}
```

### 6.2 구름 패럴랙스 (Cloud Layer)

- **에셋**: Cloud1~3.png (1200×300, 투명 배경)
- **인스턴스**: 3~5개 구름, 각각 다른 Y위치 + 속도 + 투명도
- **이동**: 화면 좌표계에서 좌→우 등속 이동 (카메라 무관)
- **속도**: 0.2~0.5 px/frame (줌 레벨과 무관)
- **투명도**: 0.25~0.5 (배경처럼 은은하게)
- **루프**: 화면 오른쪽 벗어나면 왼쪽에서 재등장

```typescript
interface CloudInstance {
  sprite: Sprite;
  speed: number;    // 0.2~0.5 px/frame
  opacity: number;  // 0.25~0.5
}

function updateClouds(clouds: CloudInstance[], screenWidth: number) {
  for (const cloud of clouds) {
    cloud.sprite.x += cloud.speed;
    if (cloud.sprite.x > screenWidth + 100) {
      cloud.sprite.x = -cloud.sprite.width - 100; // 왼쪽에서 재등장
    }
  }
}
```

### 6.3 풍차 애니메이션 (WindMill)

- **에셋**: WindMill1~2 (17프레임)
- **배치**: Temperate/Mediterranean 기후대의 Farm 건물 인접 타일에 배치
- **프레임레이트**: 6fps (느리게 회전)
- **최대 수량**: 맵당 3~5개

### 6.4 시민 스프라이트 시트

- **에셋**: Characters/Player, NPC1~3, Enemy1~3 (각 24 애니메이션 시트, 1920×1024)
- **프레임 크기**: 1920/15 = 128px 폭, 1024/8 = 128px 높이 → **128×128 프레임, 15열 × 8행**
- **방향**: 8행 = 8방향 (N/NE/E/SE/S/SW/W/NW)
- **상태→애니메이션 매핑**:

| CitizenState | 애니메이션 시트 | 행동 |
|-------------|---------------|------|
| `working` | Walk | 건물 내 천천히 이동 |
| `commuting` | Run | 집↔직장 빠르게 이동 |
| `shopping` | Walk | 시장으로 이동 |
| `resting` | Idle | 집에서 정지 |
| `protesting` | Taunt | 제자리 시위 |
| `idle` | Idle | 무작위 위치 정지 |

- **방향 감지**: 이전 위치→현재 위치 벡터 → atan2 → 8방향 인덱스 → 해당 행 프레임 선택
- **성능**: MAX_VISIBLE_CITIZENS = 100 유지, AnimatedSprite pool

### 6.5 전투/건설 이펙트

| 이벤트 | 이펙트 에셋 | 크기 | fps |
|--------|------------|------|-----|
| 건물 건설 완료 | Effects/LevelUp (15프레임) | 512×512 | 15 |
| 건물 파괴 | Destructible/Wall Wood explosion (16프레임) | 256×256 | 20 |
| 칙령 버프 | Effects/Buff1~10 (선택) | 512×512 | 12 |
| 포털 진입 | Props/PortalOpen → PortalIdle (16프레임) | 256×256 | 10 |
| 화재 | Props/Fire (16프레임) | 256×256 | 12 |
| AoE 공격 | Effects/AoE (30프레임) | 512×512 | 20 |

## 7. 성능 전략

### 7.1 메모리 관리 — 바이옴별 On-Demand 로딩

2,948 PNG를 전부 로드하면 ~700MB GPU 메모리. **바이옴별 로드**로 해결:

```
온대(Temperate) 진입 시 로드되는 에셋:
  Ground A (23종) + Ground B (6종) + Ground E (5종 도로용)
  Wall A (22종) + Wall B (11종)
  Roof A (10종) + Roof B (6종)
  Tree A (4종) + Tree B (5종)
  Flora A (7종) + Flora B (6종)
  Stone A (10종 도로용)
  Shadow (13종 공통)
  Door A (2종) + Door C (6종)
  Misc 선별 (20종)
  Cloud (3종 공통)
  → 총 ~160종 × 4방향 = ~640 PNG × 256×256 × 4byte ≈ 160MB
```

이전 바이옴 에셋은 다른 국가 진입 시 `Assets.unload()`로 해제.

### 7.2 뷰포트 컬링

```typescript
function cullViewport(layer: Container, camera: IsoCameraState, screenW: number, screenH: number) {
  const padding = ISO_TILE_WIDTH * 2; // 여유 2타일
  const viewLeft = -camera.x / camera.zoom - padding;
  const viewTop = -camera.y / camera.zoom - padding;
  const viewRight = viewLeft + screenW / camera.zoom + padding * 2;
  const viewBottom = viewTop + screenH / camera.zoom + padding * 2;

  for (const child of layer.children) {
    child.visible = (
      child.x + ISO_TILE_WIDTH > viewLeft &&
      child.x < viewRight &&
      child.y + ISO_TILE_HEIGHT > viewTop &&
      child.y < viewBottom
    );
  }
}
```

### 7.3 LOD (Level of Detail)

| 줌 레벨 | 표시 레이어 |
|---------|-----------|
| 1.5~2.0 (근접) | 전체 15 레이어 |
| 0.7~1.5 (표준) | Ground + Wall + Roof + Tree + Citizens + Cloud |
| 0.3~0.7 (조감) | Ground + Wall + Roof + Cloud (시민/Flora/Misc 숨김) |
| 0.15~0.3 (광역) | Ground + Cloud만 (미니맵 수준) |

### 7.4 애니메이션 최적화

- **물결**: 뷰포트 밖 AnimatedSprite `stop()`, 진입 시 `play()`
- **시민**: 100개 상한 유지, 가장 가까운 100명만 렌더
- **이펙트**: 동시 재생 10개 상한, 오래된 것 자동 제거
- **구름**: 항상 3~5개만 (성능 영향 미미)

### 7.5 타겟 성능

| 맵 등급 | 타일 수 | 목표 FPS | GPU 메모리 |
|---------|---------|---------|-----------|
| S (80×80) | 6,400 | 60fps | < 300MB |
| A (60×60) | 3,600 | 60fps | < 200MB |
| B (40×40) | 1,600 | 60fps | < 150MB |
| C (30×30) | 900 | 60fps | < 100MB |
| D (20×20) | 400 | 60fps | < 80MB |

## 8. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 2,948 PNG 전체 로드 → GPU 메모리 폭발 | Critical | 바이옴별 on-demand 로드 (국가당 ~160종만) |
| 128×64 타일 × 6,400셀 → 렌더 병목 | High | 뷰포트 컬링 + LOD 3단계 |
| **Ground 변형 번호가 비규칙적** | High | **Phase 0 에셋 카탈로그**로 수동 분류 후 매핑표 확정 |
| **방향 접미사 오해** → 잘못된 타일 조합 | High | 검증 완료: _NSEW=카메라 앵글. **_S만 사용** (카메라 고정) |
| **Wall/Roof 조립 방식 오인** | High | 검증 완료: 타일 조립 아님, **같은 좌표에 1장 오버레이** |
| Ground A~J 바이옴 매핑 부정확 | Medium | Phase 0+1에서 실제 이미지 확인 후 조정 |
| 스프라이트 시트 프레임 분할 규격 불명 | Medium | Phase 0에서 시트 분석 후 JSON descriptor 생성 |
| 43개 건물 텍스처 부족 | Medium | 6등급 시각 분류표로 동일 등급 건물은 같은 Wall/Roof 재사용 |
| 기후대 매핑이 일부 국가에서 부자연스러움 | Low | 195국 전체 스크린샷 테스트 → 수동 오버라이드 |
| 에셋 파일명 공백 (`Ground A1_N.png`) | Low | 텍스처 로더에서 encodeURIComponent 처리 |
| 기존 서버 CityState와 호환성 | Very Low | 서버 수정 없음 — 순수 클라이언트 교체 |
| Auto-Tiling 경계 아티팩트 | Medium | 2단계 접근(기본 full + 경계 오버레이)으로 Phase 0 카탈로그 의존 |

### Critical Decisions

1. **타일 크기 128×64**: 256px 원본의 0.5x 스케일. 줌 인 시 선명, 줌 아웃 시 적정 밀도
2. **S방향 고정**: 카메라 고정 → **_S 방향만 사용** (Ground/Tree는 방향 차이 없음, Wall/Roof는 _S가 기본 카메라 뷰)
3. **바이옴별 로드**: 국가 전환 시 이전 에셋 해제 + 새 바이옴 로드
4. **건물 = 오버레이 레이어링**: 같은 타일 좌표에 Wall→Door→Roof 순서로 1장씩 겹침 (타일 조립 아님)
5. **서버 무수정**: 렌더링만 교체, 기존 CityState 프로토콜 유지
6. **에셋 카탈로그 선행 필수**: 타일 번호가 비규칙적이므로 Phase 0에서 수동 분류 후 구현 시작
7. **53개 건물 → 6 시각 등급**: 같은 등급 건물은 동일 Wall/Roof 조합 공유, 기후대별 오버라이드

## 9. 기존 코드 버그 (수정 대상)

v26 현재 코드에서 발견된 버그로, v27 구현 시 함께 수정:

| # | 파일 | 버그 | 영향 |
|---|------|------|------|
| B-1 | `IsoTilemap.ts` + `buildingDefs.ts` | **이중 건물 정의 시스템** — IsoTilemap 내부에 `BUILDING_DEFS` (5종 하드코딩) + UI에 `buildingDefs` (53종) 별도 존재. 서로 동기화 안 됨 | 건물 렌더링과 UI가 다른 정의 참조 |
| B-2 | `iso-texture-loader.ts` | **43개 건물 텍스처 미존재** — 10개 AI 생성 텍스처만 매핑. 나머지 43개는 fallback 단색 | 대부분 건물이 단색 박스 |
| B-3 | `IsoCitizenLayer.ts` | **시민 뷰포트 컬링 없음** — 모든 시민을 매 프레임 업데이트 (MAX=100이라 큰 문제 아님) | 대형 맵에서 불필요한 연산 |
| B-4 | `IsoTilemap.ts` | **뷰포트 컬링 O(N)** — 모든 Container children을 순회하며 visible 설정 | 6,400셀 × 15레이어 = ~96,000 체크 |
| B-5 | `ConstructionPanel.tsx` | **건설 패널 5종만 표시** — IsoTilemap.BUILDING_DEFS 참조하여 53종 중 5종만 노출 | 대부분 건물을 건설 불가 |

## 10. 향후 확장 기능 (Phase 9+ 로드맵)

v27 완료 후 추가 가능한 고도화 기능들:

### 10.1 낮/밤 사이클
- PixiJS ColorMatrixFilter로 전체 worldContainer에 색온도 변경
- 틱 진행에 따라 6시(새벽, 주황)→12시(대낮, 기본)→18시(석양, 빨강)→24시(밤, 파랑) 순환
- 밤: 건물에서 Torch/Fire Props 발광 효과 (additive blending)
- 관련 에셋: Props/Torch, Props/Fire, Other/GodRay

### 10.2 날씨 시스템
- **비**: Cloud 투명도 증가 + 물결 애니메이션 속도 2배 + 파란 ColorMatrixFilter 약하게
- **눈(Arctic)**: 작은 흰 파티클 하강 (PixiJS ParticleContainer)
- **모래바람(Arid)**: 수평 파티클 + 갈색 오버레이
- 날씨 변경은 서버 이벤트 또는 틱 기반 랜덤

### 10.3 미니맵
- 화면 우측 하단 200×200px 미니맵
- Ground 색상만 축소 렌더 + 건물 위치 점 표시 + 뷰포트 사각형
- 클릭으로 카메라 이동
- PixiJS RenderTexture로 별도 렌더

### 10.4 도로 네트워크
- 건물 간 Stone A 시리즈로 자동 연결 도로 생성
- A* 경로 탐색 → 최단 경로에 Stone 타일 배치
- 시민 이동 경로가 도로를 우선 사용

### 10.5 카메라 회전 지원 (90° 단계)
- 현재 _S 고정 → N/S/E/W 4방향 카메라 지원
- 회전 시 모든 타일의 방향 접미사 변경 (Wall _S → _E 등)
- Ground는 방향 무관이므로 교체 불필요
- Wall/Roof만 동적 텍스처 교체 필요

### 10.6 건설 애니메이션
- 건물 건설 시 0%→100% 진행률에 따라 단계별 시각 변화
- Stage 1: 돌바닥만 (Stone)
- Stage 2: 벽 올라감 (Wall, 반투명→불투명)
- Stage 3: 지붕 덮임 (Roof 추가)
- 완료: LevelUp 이펙트 재생

### 10.7 행복도 시각 피드백
- 행복도 높은 구역: Flora 밀도 증가, 밝은 ColorMatrixFilter
- 행복도 낮은 구역: Flora 감소, 어두운 tint, 시민 protesting 애니메이션 증가
- 쿠데타 이벤트: 화면 흔들림 + Fire Props 배치

### 10.8 생산 체인 시각화
- 건물 클릭 시 입출력 건물을 화살표로 연결
- 원자재 건물 → 가공 건물 → 최종 건물 흐름 표시
- Graphics drawLine으로 아이소메트릭 좌표 위에 렌더

## 구현 로드맵

<!-- da:work Stage 0 파싱 대상 -->

### Phase 0: 에셋 시각 카탈로그 생성 (사전 작업)
| Task | 설명 |
|------|------|
| Ground 변형 카탈로그 | Ground A~J 각 번호별 실제 이미지 확인 → full/half/corner/deco 분류표 작성 |
| Wall/Roof 카탈로그 | Wall A~G, Roof A~G 각 번호별 크기/형태 확인 → 건물 등급별 매핑 |
| Tree/Flora 카탈로그 | Tree A~E, Flora A~B 실제 외형 확인 → 바이옴별 적합성 판단 |
| Misc 소품 카탈로그 | Misc A~E 99종 확인 → 건물/바이옴별 배치 적합성 분류 |
| 경계 타일 매핑표 확정 | Phase 0 카탈로그 기반으로 섹션 4.2의 반쪽/코너 오버레이 테이블 확정 |
| 시민 스프라이트 시트 분석 | 1920×1024 시트의 정확한 프레임 그리드 확인 (128×128 × 15×8) |

- **design**: N
- **verify**: 각 카테고리별 분류표 문서 완성. 경계 타일 매핑표 확정. 스프라이트 시트 프레임 검증

### Phase 1: 에셋 매니페스트 & 텍스처 로더 재구축
| Task | 설명 |
|------|------|
| `iso-asset-manifest.ts` 생성 | 전체 에셋 카탈로그 — 카테고리/시리즈/ID/경로 매핑. Environment 파일명 파싱 자동화 |
| `iso-biome-defs.ts` 생성 | 6 기후대 정의 + 각 기후대별 Ground/Wall/Roof/Tree/Flora 시리즈 매핑 |
| `country-biome-map.ts` 생성 | 195국 ISO3 → 기후대 매핑 함수 (continent + 위도 기반 자동 + 수동 오버라이드) |
| `iso-texture-loader.ts` 완전 재작성 | 바이옴별 on-demand 로드 + PixiJS Assets + unload 지원 + 파일명 공백 처리 |
| 타입 확장 (`types.ts`) | ClimateZone enum, BiomeDef interface, GroundTile 타입 추가 |

- **design**: N
- **verify**: `tsc --noEmit` 0 에러. 텍스처 로더가 특정 바이옴 타일만 로드하는 것 확인 (콘솔 로그). 매니페스트에 Environment 주요 에셋 포함 확인

### Phase 2: IsoTilemap 렌더링 엔진 교체
| Task | 설명 |
|------|------|
| 좌표계 변경 | `ISO_TILE_WIDTH=128`, `ISO_TILE_HEIGHT=64` + `tileToScreen`/`screenToTile` 재계산 |
| 15-Layer Container 구조 | worldContainer 내 15개 레이어 Container 생성 + 정렬 |
| Ground 렌더링 | 바이옴별 Ground 시리즈 Sprite 배치 (0.5x 스케일, S방향 기본) |
| 2단계 Auto-Tiling | 기본 full diamond 배치 + Phase 0 카탈로그 기반 경계 오버레이 (반쪽/코너 타일) |
| 뷰포트 컬링 업데이트 | 128×64 타일 크기에 맞춘 컬링 로직 + padding 조정 |
| 카메라 재조정 | 줌 범위 0.15~2.0, 초기 줌/위치 새 타일 크기 적용 |

- **design**: N
- **verify**: 아이소메트릭 맵이 바이옴별 다른 Ground 타일로 렌더링됨. 팬/줌 부드럽게 동작. 바이옴 경계에 오버레이 전환 자연스러움. 60fps 유지

### Phase 3: 장식 레이어 (Flora/Tree/Stone/Shadow/Misc)
| Task | 설명 |
|------|------|
| Flora 배치 엔진 | 풀밭 타일의 15~25%에 Flora A/B Sprite 랜덤 배치 (바이옴별) |
| Tree 배치 엔진 | Forest 지역에 Tree A~E 배치 (바이옴별 종류 선택) + 주변 확산 |
| Stone/Path 배치 | 건물 주변/도로에 Stone A 시리즈 깔기 |
| Shadow 자동 배치 | 나무/건물 SE 방향에 Shadow 1~13 오버레이 |
| Misc 소품 배치 | 건물 인접 타일에 맥락적 소품 (시장→상자, 농장→건초) |
| 깊이 정렬 | 각 오브젝트 레이어 `sortableChildren=true` + `zIndex=tileX+tileY` |

- **design**: N
- **verify**: 맵에 나무/꽃/돌/그림자/소품이 자연스럽게 분포. 기후대별 다른 나무 종류. 가림(occlusion) 정상

### Phase 4: 건물 컴포지트 시스템
| Task | 설명 |
|------|------|
| BuildingComposite 정의 | **6 시각 등급 × 6 기후대 = 36 조합**의 Wall/Roof/Door 매핑 테이블 (53개 건물 포함) |
| 건물 렌더러 재작성 | 같은 좌표에 Wall→Door→Roof 오버레이 레이어링 (anchor 0.5,1.0, scale 0.5) |
| 기후대별 스타일 오버라이드 | 같은 house라도 온대=목재, 건조=벽돌, 극지=석조 |
| WallFlora 적용 | 일부 건물 벽에 WallFlora A1~A14 랜덤 부착 (Temperate/Mediterranean) |
| 건물 배치 UI 업데이트 | 새 타일 크기에 맞춘 호버/프리뷰/선택 하이라이트 |

- **design**: N
- **verify**: 건물이 Wall+Roof+Door 조합으로 표시됨. 기후대별 다른 외관. 배치 UI 정상 동작

### Phase 5: 물 애니메이션 & 구름 패럴랙스
| Task | 설명 |
|------|------|
| Water Ripples AnimatedSprite | 물 타일 위에 13종 리플 오버레이 (8fps, 256→128 스케일) |
| 해안선 전환 타일 | Ground J 시리즈로 육지↔물 부드러운 그라데이션 |
| 구름 레이어 | Cloud1~3 Sprite × 3~5 인스턴스, 화면 좌표 패럴랙스 (0.3 투명도) |
| WindMill AnimatedSprite | 농업 바이옴 Farm 인접에 풍차 2종 배치 (6fps) |
| 물결 최적화 | 뷰포트 밖 물결 `stop()`, 진입 시 `play()` |

- **design**: N
- **verify**: 물 위에 물결 애니메이션 자연스럽게 재생. 해안선 전환 부드러움. 구름이 천천히 이동. 풍차 회전

### Phase 6: 시민 스프라이트 시트 통합
| Task | 설명 |
|------|------|
| 스프라이트 시트 분석 | Player/NPC 1920×1024 시트 → 프레임 그리드 확인 (128×128 × 15×8) |
| Spritesheet JSON 생성 | PixiJS Spritesheet descriptor 자동 생성 스크립트 |
| IsoCitizenLayer 재작성 | 3px 원 → AnimatedSprite 기반 시민 렌더 (128×128 프레임 → **24~32px 스케일다운**) |
| 상태→애니메이션 매핑 | working→Walk, commuting→Run, idle→Idle, protesting→Taunt |
| 방향 감지 | 이동 벡터 → atan2 → 8방향 인덱스 → 해당 행 프레임 |
| 시민 풀 관리 | MAX_VISIBLE_CITIZENS=100 유지, AnimatedSprite 오브젝트 풀 |

- **design**: N
- **verify**: 시민이 상태/방향에 맞는 애니메이션으로 이동. 100명 제한 내 60fps. 방향 전환 자연스러움

### Phase 7: 이펙트 & UI 통합
| Task | 설명 |
|------|------|
| 건물 건설 이펙트 | LevelUp 애니메이션 (15프레임) 건설 완료 시 재생 |
| 건물 파괴 이펙트 | Destructible 애니메이션 재생 (Wood/Stone/Clay explosion) |
| 버프/칙령 이펙트 | Buff1~10 중 선택하여 전체 화면 오버레이 |
| Props 배치 | Fire, Torch, Barrel → 건물/소품으로 배치 (일부 애니메이션) |
| ResourceHUD 아이콘 교체 | 기존 AI 생성 아이콘 → Misc 에셋 중 적합한 것으로 교체 |
| Chest 배치 | 특정 건물(market/government) 인근에 Chest A/B 배치 |

- **design**: N
- **verify**: 건설/파괴 시 이펙트 정상 재생. 불/횃불 애니메이션 동작. ResourceHUD 아이콘 표시

### Phase 8: LOD & 성능 최적화
| Task | 설명 |
|------|------|
| LOD 시스템 구현 | 줌 레벨별 레이어 표시/숨김 (3단계 LOD) |
| 텍스처 아틀라스 | 자주 쓰는 Ground+Wall 타일 → PixiJS Spritesheet 아틀라스로 배치 호출 감소 |
| 바이옴 언로드 | 국가 전환 시 이전 바이옴 에셋 `Assets.unload()` |
| 메모리 프로파일 | S등급(80×80) 맵에서 GPU 메모리 300MB 미만 확인 |
| 전체 빌드 검증 | `tsc --noEmit` 0 에러 + `next build` 성공 |
| 195국 바이옴 밸런스 | 주요 국가 10개 이상 맵 생성하여 시각 다양성 확인 |

- **design**: N
- **verify**: S등급 80×80 맵에서 60fps. GPU 메모리 300MB 미만. tsc 0 에러. 바이옴별 시각 차이 확인

## Key Technical Decisions

1. **PixiJS 8 유지**: v26과 동일. WebGL 2 렌더러, Assets API
2. **128×64 표시 타일**: 256px 에셋 × 0.5 스케일. 줌 인 시 원본 해상도 활용
3. **_S 방향 고정**: 카메라 고정 → Ground/Tree는 방향 무관, Wall/Roof는 _S 사용. 향후 카메라 회전(10.5) 시 전체 NSEW 활용
4. **2단계 Auto-Tiling**: ~~4-bit bitmask~~ → 기본 full diamond + 경계 오버레이 (타일 번호 비규칙적이므로)
5. **건물 = 오버레이 레이어링**: Wall+Door+Roof를 같은 좌표에 겹침 (타일 조립 아님). 256×256 캔버스가 동일 기준점 보장
6. **바이옴별 on-demand 로드**: 국가 진입 시 해당 기후대 에셋만 로드 (~160종)
7. **서버 무수정**: 렌더링만 교체, CityState 프로토콜 유지
8. **시민 128×128 프레임**: 1920×1024 시트 = 15열×8행 = 8방향 × 15프레임 애니메이션 → 표시 시 24~32px 스케일다운
9. **53건물 6등급**: 개별 매핑 대신 시각 등급별 공통 Wall/Roof 조합으로 통일, 기후대 오버라이드로 변화
10. **Phase 0 선행**: 에셋 시각 카탈로그가 경계 타일 매핑, 건물 조합, 소품 배치의 전제조건

## Verification

### Phase 0 검증
0. 에셋 시각 카탈로그 완성 — Ground/Wall/Roof/Tree/Flora/Misc 분류표 문서화

### 기능 검증 (Phase 1~8)
1. `npx tsc --noEmit` — 0 errors
2. `next build` — 성공
3. 온대(KOR) 맵 → 잔디+활엽수+목재건물
4. 건조(SAU) 맵 → 모래+선인장+벽돌건물
5. 열대(BRA) 맵 → 정글+야자수+천막건물
6. 극지(NOR) 맵 → 눈+침엽수+석조건물
7. 물 타일 → 물결 애니메이션 재생
8. 구름 → 화면 위 느리게 이동
9. 건물 배치 → Wall+Door+Roof 오버레이 조합 (같은 좌표)
10. 시민 → 방향별 애니메이션 (128×128 → 24~32px 스케일다운)
11. 줌 아웃 → LOD 적용 (소품/시민 숨김)
12. S등급 80×80 맵 → 60fps 유지
13. **53개 건물 모두 건설 가능** (B-5 버그 수정)
14. **모든 건물에 시각 등급별 텍스처** (B-2 버그 수정, 단색 박스 없음)
15. **바이옴 경계 전환** — 오버레이 타일로 자연스러운 그라데이션
