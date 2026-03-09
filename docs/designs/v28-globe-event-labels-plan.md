# PLAN: v28 — Globe Event Labels (3D 뉴스 브리핑 라벨)

## 1. 개요

지구본 위에서 발생하는 주요 이벤트(전쟁, 교역, 동맹, 제재 등)를 해당 국가 위치에
**뉴스 브리핑 스타일 라벨**로 표시한다. 현재는 아크 이펙트와 뉴스 티커(하단 바)만
있어서 "어느 나라에서 무슨 일이 일어나고 있는지" 직관적으로 파악하기 어렵다.

**핵심 컨셉**: NewsFeed 하단 티커의 "뉴스 타입 태그" 디자인을 3D 지구본 위에
leader-line(꺾인 연결선)으로 국가에 부착하여, **지도와 함께 회전하며 10초간
표시 후 페이드아웃**하는 3D 라벨 시스템.

### 레퍼런스 디자인 (기존 NewsFeed 태그)
```
┌─────────┐
│ WAR     │  ← borderRadius: 0, border: 1px solid ${color}40
└─────────┘     font: Space Grotesk 10px 700, color: event-specific
```

## 2. 요구사항

### 기능 요구사항
- [FR-1] **이벤트 라벨**: 글로벌 이벤트 발생 시 해당 국가 위에 뉴스 태그 스타일 라벨 표시
- [FR-2] **Leader Line**: 국가 centroid에서 라벨까지 꺾인 선(elbow connector)으로 연결
- [FR-3] **아크 키워드 태그**: 두 국가 간 아크 이펙트의 중간점에 이벤트 유형 키워드 표시
- [FR-4] **라벨 수명**: 약 10초간 표시 후 페이드아웃 (fade-in 0.3s → 유지 ~9s → fade-out 0.7s)
- [FR-5] **지구본 동기 회전**: 라벨이 3D 공간에 부착되어 지구본과 함께 자연스럽게 회전
- [FR-6] **뒷면 은닉**: 지구본 뒷면으로 넘어간 라벨은 자동으로 투명하게 숨김
- [FR-7] **최대 동시 표시**: 성능을 위해 최대 8개 라벨 동시 표시, 초과 시 가장 오래된 것 제거

### 비기능 요구사항
- [NFR-1] **성능**: InstancedMesh + CanvasTexture 아틀라스로 드로우콜 최소화 (GlobeCountryLabels 패턴). 아틀라스 해상도는 `Math.min(devicePixelRatio, 2)` 반영
- [NFR-2] **디자인 일관성**: NewsFeed 태그와 동일한 색상 체계 (EFFECT_COLORS), 동일한 타이포그래피
- [NFR-3] **LOD**: 원거리(>350)에서는 라벨 숨김, 중거리에서는 키워드만 표시
- [NFR-4] **기존 시스템 비침범**: GlobeCountryLabels 위 고도에 배치, 기존 이펙트와 충돌 없음

## 3. 디자인 상세

### 3.1 이벤트 라벨 (Event Briefing Label)

국가 centroid 위에 표시되는 주요 라벨. NewsFeed TickerItem의 3D 버전.

```
                ┌───────────────────────────────┐
                │ ▪ WAR  South Korea attacked   │  ← 뉴스 브리핑 라벨
                └───────────────────┬───────────┘
                                    │ (수직 하강)
                                    └──── (수평 연결)
                                         │
                                         ● 국가 centroid
```

**라벨 구성요소**:
1. **배경**: `rgba(9, 9, 11, 0.85)` (OVERLAY.bg와 동일) + `border: 1px solid ${eventColor}40`
2. **이벤트 태그**: 좌측에 `[WAR]` / `[TRADE]` / `[ALLIANCE]` 등 — 이벤트 컬러 bold
3. **브리핑 텍스트**: 우측에 짧은 뉴스 헤드라인 — `SK.textPrimary` (#ECECEF)
4. **전체 크기**: 약 160-200px x 24px (CanvasTexture 해상도)

**색상 매핑**: `EFFECT_COLORS` 그대로 사용
| 이벤트 | 태그 텍스트 | 색상 |
|--------|------------|------|
| war | WAR | #FF3333 |
| alliance | ALLY | #3388FF |
| trade | TRADE | #33CC66 |
| resource | MINE | #CCAA33 |
| spy | INTEL | #9955CC |
| sanction | SANCT | #CC6633 |
| nuke | NUKE | #FFAA33 |
| epoch | EPOCH | #FFCC44 |

### 3.2 Leader Line (꺾인 연결선)

라벨에서 국가까지 L자 형태의 꺾인 선. 라벨이 국가 직상방이 아닌 약간 오프셋된
위치에 떠있고, 꺾인 선이 자연스럽게 연결한다.

```
    [LABEL] ─────┐
                  │  (수직 하강, 이벤트 컬러)
                  │
                  ● country centroid
```

**구현**:
- `THREE.Line` (BufferGeometry, 3개 점: 라벨 하단 → 꺾임점 → centroid)
- 색상: 해당 이벤트의 `COLORS_BASE[type]` (non-HDR, Bloom 제외)
- 투명도: 라벨과 동기화 (fade-in/out)
- 굵기: 기본 1px (WebGL Line 제한)

**오프셋 전략**: centroid의 **surface normal 방향**(= 구 중심→centroid 단위 벡터)으로
+6~8 단위 오프셋하여 라벨 위치를 결정. 이 방식은 월드 공간에서 고정되어
지구본과 함께 회전하므로 3D 공간 부착이 자연스럽다.
카메라-로컬 right/up 오프셋은 매 프레임 위치가 변하여 회전과 동기화되지 않음.
라벨은 centroid 직상방(법선 방향)에 위치하고, Leader Line이 수직으로 연결.

### 3.3 아크 키워드 태그 (Arc Midpoint Tag)

두 국가를 잇는 아크 이펙트(전쟁, 교역, 동맹 등)의 **중간점(t=0.5)** 위에
작은 키워드 태그를 표시. NewsFeed 태그와 동일한 시각 언어.

```
         ╭─── arc line ───╮
         │                 │
    [FROM]     [WAR]     [TO]     ← 아크 중간에 키워드 태그
         │                 │
         ╰─────────────────╯
```

**디자인**:
- NewsFeed 태그와 동일: `borderRadius: 0`, `border: 1px solid ${color}40`, bold 텍스트
- 색상: 해당 아크 이펙트의 `EFFECT_COLORS[type]` — 아크 라인과 같은 색
- 크기: 약 60x20px (태그 텍스트만)
- Billboard (항상 카메라를 향함)
- 위치: 아크 커브의 t=0.5 지점 + 약간의 법선 오프셋(아크 위쪽)

**텍스트 매핑**: 아크 이펙트별 짧은 키워드
| 아크 이펙트 | 키워드 | 연결 컴포넌트 |
|------------|--------|---------------|
| GlobeWarEffects | WAR | wars prop |
| GlobeTradeRoutes | TRADE | tradeRoutes prop |
| GlobeAllianceBeam | ALLY | alliances prop |
| GlobeSanctionBarrier | SANCT | sanctions prop |
| GlobeSpyTrail | INTEL | spyOps prop |
| GlobeNukeEffect | NUKE | (nuke event) |

### 3.4 애니메이션 타임라인

```
t=0.0s   t=0.3s          t=9.3s   t=10.0s
  │────────│───────────────│────────│
  fade-in   sustained       fade-out  removed
  (0→1)    (opacity=1)      (1→0)
```

- **Fade-in**: 0.3초, `easeOutCubic` (TIMING.EVENT_ENTER와 동일)
- **Sustained**: ~9초, opacity 1.0
- **Fade-out**: 0.7초, `easeInQuad`
- **총 수명**: 10초
- Leader line과 태그의 opacity는 동기화

### 3.5 LOD 동작

| LOD Tier | 거리 | 이벤트 라벨 | 아크 태그 | Leader Line |
|----------|------|------------|----------|-------------|
| close | <200 | 태그 + 헤드라인 | 키워드 | 보임 |
| mid | 200-350 | 태그만 | 키워드 | 보임 (얇게) |
| far | >350 | 숨김 | 숨김 | 숨김 |

### 3.6 고도 배치 (Z-Stacking)

```
고도 (radius + offset)
  │
  │  +6~8    ── 이벤트 라벨 (Event Briefing Label)
  │  +4~5    ── Leader Line 꺾임점
  │  +2.5    ── GlobeCountryLabels (기존 국가 이름)
  │  +1.5    ── Conflict Icons (기존)
  │  +1.0    ── Arcs, Spy trails
  │  +0.5    ── Surface glow
  │   0      ── Globe surface
```

이벤트 라벨은 기존 국가 이름 라벨(+2.5+landmark+1.0) 위에 배치하되,
+6~8 범위로 국가 이름과 충분한 간격 확보. 기존 +10~12는 너무 높아
지구본과의 시각적 연결감이 약해지므로 하향 조정.

### 3.7 renderOrder

**`effect-constants.ts`의 `RENDER_ORDER` 객체에 명시적으로 추가** (Phase 1에서 수행):
```typescript
// Layer 9: 이벤트 라벨 (110-119) — effect-constants.ts RENDER_ORDER에 추가
EVENT_LABEL_LINE:   110,   // Leader line
EVENT_LABEL_TAG:    112,   // Event briefing label
ARC_KEYWORD_TAG:    115,   // Arc midpoint keyword tag
```

## 4. 기술 방향

### 렌더링 방식: CanvasTexture + InstancedMesh (Billboard)

기존 `GlobeCountryLabels` 패턴을 그대로 활용:
1. 오프스크린 Canvas에 라벨 텍스트를 미리 렌더링 (아틀라스). Canvas 해상도에 `Math.min(devicePixelRatio, 2)` 배율 적용하여 DPR 2+ 기기에서도 선명한 텍스트 보장
2. InstancedMesh + custom ShaderMaterial로 Billboard 표시
3. per-instance attribute: position, opacity, atlas-row, tint-color
4. useFrame에서 수명 관리 + backface 체크 + LOD

**아크 키워드 태그도 같은 방식**: 별도의 작은 아틀라스(8종 키워드)를
미리 그려놓고, InstancedMesh로 아크 중간점에 Billboard 배치.

### 데이터 흐름 (듀얼 데이터 소스)

**이벤트 라벨**과 **아크 키워드 태그**는 서로 다른 데이터 소스에서 구동된다:

| 요소 | 데이터 소스 | 위치 정보 |
|------|------------|----------|
| 이벤트 라벨 + Leader Line | `newsItems: NewsItem[]` (globalEvents에서 변환) | `newsItem.countryCode` → centroid 조회 |
| 아크 키워드 태그 | 각 아크 이펙트 prop (wars, tradeRoutes, alliances 등) | `from`/`to` ISO3 → centroid → midpoint 자체 계산 |

```
[소스 1] useSocket (globalEvents[]) → page.tsx → newsItems: NewsItem[] (countryCode 포함)
              ↓
[소스 2] useSocket (wars[], tradeRoutes[], alliances[], sanctions[], spyOps[], nukes[])
              ↓
         WorldView → GlobeView
              ↓
         GlobeEventLabels (NEW) ← newsItems + countryCentroids + wars/trades/alliances/...
              ↓
         ├── Event Briefing Labels (소스 1: newsItems → countryCode → centroid)
         ├── Leader Lines (소스 1: centroid → label position)
         └── Arc Keyword Tags (소스 2: from/to → centroid → midpoint 자체 계산)
```

**아크 중간점 계산**: 각 아크 컴포넌트의 내부 커브에 직접 접근하지 않고,
`from`/`to` centroid + `ARC_HEIGHT[type]`을 사용하여 `createArcCurve()`로
자체적으로 중간점을 계산한다 (effect-utils.ts의 기존 유틸 활용).

**ISO3 미포함 이벤트 처리**: 서버의 일부 이벤트(epoch_change 등)는
countryCode가 없을 수 있다. 이 경우 이벤트 라벨은 표시하지 않고
기존 NewsFeed 티커에서만 표시한다.

### 새 컴포넌트

| 컴포넌트 | 역할 | 위치 |
|---------|------|------|
| `GlobeEventLabels` | 메인 오케스트레이터 | `components/3d/GlobeEventLabels.tsx` |

단일 컴포넌트 내에서 3가지 요소(라벨, 라인, 아크 태그)를 모두 관리.
각각 별도 InstancedMesh/BufferGeometry로 구성하되, 하나의 group에 묶음.

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 라벨 겹침 | 같은 지역 다수 이벤트 시 라벨이 겹침 | 국가당 1개만 표시, 큐잉 (오래된 것 먼저 제거) |
| 드로우콜 | InstancedMesh로 최소화되지만 아틀라스 크기 증가 | max 8 라벨 + max 8 아크태그 = 3 드로우콜 |
| CanvasTexture 업데이트 비용 | 새 이벤트마다 아틀라스 redraw | 8슬롯 순환 버퍼, 변경된 슬롯만 부분 업데이트 |
| **countryCode 파이프라인 누락** (Critical) | `useSocket.ts`가 `global_event`에서 countryCode 버림 → 라벨 표시 불가 | **Phase 0에서 선행 수정** — countryCode/targetCode 필드 보존 |
| ISO3 미포함 이벤트 | `epoch_change`, 일부 글로벌 이벤트에 countryCode 없음 | countryISO 없는 이벤트는 라벨 미표시 (티커만). 대상: epoch_change, season_change 등 |
| 아크 중간점 계산 | 각 아크 컴포넌트 내부 커브에 직접 접근 불가 | `createArcCurve(from, to, ARC_HEIGHT[type])`로 자체 계산. effect-utils.ts 기존 유틸 활용 |
| 아틀라스 해상도와 DPR | DPR 2+ 기기에서 텍스트가 흐릿할 수 있음 | Canvas 해상도에 `Math.min(devicePixelRatio, 2)` 적용 — GlobeCountryLabels와 동일 패턴 |

---

## 구현 로드맵

### Phase 0: 데이터 파이프라인 수정 (선행 필수)

| Task | 설명 |
|------|------|
| useSocket countryCode 파이프라인 복구 | `useSocket.ts:1036` — `global_event` 핸들러에서 `countryCode`, `targetCode`, `countryName`, `targetName` 필드를 보존하도록 수정. 현재는 `{ type, message }`만 추출하여 위치 정보 유실 |
| NewsItem 타입 확장 | `NewsItem` 인터페이스에 `countryCode?: string`, `targetCode?: string` 필드 추가 |
| page.tsx newsItems 변환 보강 | `globalEvents → newsItems` 변환 시 countryCode/targetCode를 포함하여 전달 |

- **design**: N
- **verify**: 빌드 성공, `console.log`로 newsItem에 countryCode 포함 확인

### Phase 1: 이벤트 라벨 + Leader Line 기반 구축

| Task | 설명 |
|------|------|
| GlobeEventLabels 컴포넌트 생성 | CanvasTexture 아틀라스(8슬롯) + InstancedMesh billboard 기본 골격 |
| Leader Line 렌더링 | 국가 centroid → 꺾임점 → 라벨 위치 3점 Line geometry |
| 수명 관리 시스템 | 10초 타이머 + fade-in/out + 최대 8개 풀 |
| GlobeView 통합 | newsItems prop 추가, GlobeEventLabels 마운트 |

- **design**: N (기존 디자인 시스템 활용)
- **verify**: 빌드 성공, 글로브에 라벨 표시 확인, 10초 후 페이드아웃

### Phase 2: 아크 키워드 태그

| Task | 설명 |
|------|------|
| 아크 중간점 키워드 태그 | 8종 키워드 소형 아틀라스 + InstancedMesh billboard |
| 아크 데이터 연동 | wars/tradeRoutes/alliances/sanctions/spyOps에서 from/to 추출, midpoint 계산 |
| 색상 동기화 | 아크 이펙트 색상과 태그 색상 통일 (EFFECT_COLORS 참조) |

- **design**: N
- **verify**: 빌드 성공, 아크 위에 키워드 태그 표시, 아크와 같은 색상 확인

### Phase 3: LOD + 뒷면 은닉 + 최적화

| Task | 설명 |
|------|------|
| Backface 은닉 | dot(normal, cameraDir) 기반 opacity=0 (기존 패턴) |
| LOD 3단계 | close=풀, mid=태그만, far=숨김 (LOD_DISTANCE 상수 활용) |
| 국가당 1개 제한 | 같은 국가 중복 라벨 방지, 큐잉 로직 |
| renderOrder 배정 | RENDER_ORDER 상수에 EVENT_LABEL 추가 (110-119) |
| reduced-motion 대응 | prefers-reduced-motion 시 fade 없이 즉시 표시/숨김 |

- **design**: N
- **verify**: 빌드 성공, 뒷면 라벨 숨김 확인, 원거리 숨김 확인, 성능 프로파일
