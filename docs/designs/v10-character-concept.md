# PLAN: Agent Survivor 캐릭터 리디자인 — "큐블링(Cubeling)" 컨셉

> **Date**: 2026-03-06
> **Status**: Draft
> **Scope**: 캐릭터 모델, 텍스처, 애니메이션, 장비, 커스터마이제이션 전체 리디자인
> **Engine**: Three.js (R3F) — InstancedMesh 기반 60 에이전트 실시간 렌더링

---

## 1. 개요

### 왜 리디자인하는가?

현재 캐릭터는 Minecraft Steve의 직접적인 변형이다. 6-part 박스 휴머노이드, 32 unit 높이, 1:3 머리:몸 비율.
게임의 정체성이 "마인크래프트 모드"처럼 보이는 문제가 있다.

### 목표

| # | 목표 | 핵심 지표 |
|---|------|----------|
| 1 | 픽셀/복셀 친근함 유지 | NearestFilter, 16×16 텍스처, 직교적 형태 |
| 2 | MC와 확실한 차별화 | 프로포션, 색감, 실루엣에서 즉시 구분 |
| 3 | 캐릭터 개성 극대화 | 얼굴 표정, 체형, 장비로 60명이 모두 달라 보임 |
| 4 | 풍부한 애니메이션 | idle/walk/boost 3종 → 10종 이상 상태 |
| 5 | 장비 장착 시스템 | 모자, 무기, 등 아이템, 신발의 시각적 반영 |
| 6 | 유저 커스터마이징 | 7단계 레이어 기반 캐릭터 에디터 |

### 컨셉 이름: "큐블링(Cubeling)"

**Cube + -ling** (duckling, seedling처럼 작고 귀여운 존재)
— 블록으로 태어난 작은 생명체. MC의 "인간 아바타"가 아닌, 이 세계 고유의 종족.

### 핵심 키워드
```
친근함(Friendly) × 개성(Unique) × 전투감(Combat-Ready)
```

## 2. 디자인 철학 & 차별화 전략

### 2.1 "큐블링" vs Minecraft 차별화 매트릭스

| 요소 | Minecraft Steve | 큐블링(Cubeling) | 차별화 효과 |
|------|----------------|-----------------|------------|
| **머리:몸 비율** | 25% (8/32) | **42% (10/24)** | 치비 비율 → 즉시 구분, 귀여움 |
| **전체 높이** | 32 units (키 큼) | **24 units (콤팩트)** | 통통하고 동글동글한 느낌 |
| **팔다리** | 길고 가늘다 (4×12) | **짧고 통통 (4×7)** | 뒤뚱뒤뚱 귀여운 걸음걸이 |
| **색감** | 차분한, 현실적 | **비비드, 팝아트** | 에너지 넘치는 전투 게임 느낌 |
| **표정** | 고정 텍스처 | **눈 깜빡임 + 상태별 변화** | 살아있는 느낌 |
| **실루엣** | 모두 동일 | **장비로 극적 변화** | 60명이 각자 식별 가능 |
| **걸음걸이** | 기계적 교차 스윙 | **바운스 + 힙스웨이** | 캐릭터에 성격 부여 |
| **피격 반응** | 빨간 플래시만 | **넉백 + 찌그러짐 + 플래시** | 전투의 타격감 |

### 2.2 레퍼런스 포지셔닝

```
현실적 ←——————————————————————→ 스타일라이즈드
         MC   │        Roblox │    큐블링│ Crossy Road
              │              │         │
각진 ←────────┼──────────────┼─────────┼────────────→ 둥근
              │              │    ★    │
              │              │  여기!  │
```

**영감 소스:**
- **Crossy Road**: 극단적 단순함으로 개성 폭발 → 텍스처의 힘
- **Fall Guys**: 뒤뚱뒤뚱 귀여운 움직임 → 애니메이션 바운스
- **Brawl Stars**: 작지만 장비로 실루엣 차별화 → 장비 과장
- **Risk of Rain 2**: 3D에서도 픽셀 감성 유지 → NearestFilter + 로우폴리

### 2.3 디자인 원칙

1. **"3초 규칙"**: 60명의 에이전트가 뛰어다녀도, 내 캐릭터를 3초 안에 찾을 수 있어야 한다
2. **"텍스처가 90%, 지오메트리가 10%"**: InstancedMesh 제약 → 같은 박스인데 텍스처로 완전히 다른 캐릭터
3. **"과장의 미학"**: 무기는 몸보다 크게, 모자는 머리를 덮을 만큼, 이펙트는 화려하게
4. **"실루엣 우선"**: 축소했을 때도(미니맵) 장비 실루엣으로 구분 가능
5. **"움직임이 성격"**: 같은 모델이라도 걸음걸이, 리액션이 캐릭터를 정의

## 3. 캐릭터 프로포션 & 구조

### 3.1 큐블링 바디 스펙 (기본형)

```
         ┌──────────┐
         │   HEAD   │  10 units (42%)
         │ 10×10×8  │  — 캐릭터 정체성의 핵심
         │  ◉   ◉   │  — 큰 눈 (3×2px each)
         │    ▽     │  — 코
         │   ───    │  — 입
         └────┬─────┘
         ┌────┴────┐
    ┌──┐ │  BODY   │ ┌──┐
    │AR│ │  8×7×5  │ │AR│  7 units (29%)
    │ML│ │         │ │MR│  팔: 4×7×4
    │  │ │         │ │  │  — 어깨 피벗 회전
    └──┘ └────┬────┘ └──┘
         ┌───┴───┐
         │L│   │R│     7 units (29%)
         │E│   │E│     다리: 4×7×4
         │G│   │G│     — 엉덩이 피벗 회전
         │ │   │ │
         └─┘   └─┘
    ─────────────────── Ground (Y=0)

    전체 높이: 24 units
    전체 너비: 16 units (팔 포함)
    전체 깊이: 8 units
```

### 3.2 바디 파트 상세

| 파트 | 크기 (W×H×D) | 피벗 포인트 | 오프셋 (X, Y, Z) | 역할 |
|------|-------------|-----------|-----------------|------|
| Head | 10×10×8 | center | (0, 19, 0) | 정체성, 표정, 모자 장착점 |
| Body | 8×7×5 | center | (0, 10.5, 0) | 갑옷/의상 표시, 등 장비 부착 |
| ArmL | 4×7×4 | top-center (어깨) | (-6, 14, 0) | 걷기 스윙, 방패/보조 |
| ArmR | 4×7×4 | top-center (어깨) | (+6, 14, 0) | 걷기 스윙, 무기 장착 |
| LegL | 4×7×4 | top-center (엉덩이) | (-2, 7, 0) | 걷기 스윙, 신발 표시 |
| LegR | 4×7×4 | top-center (엉덩이) | (+2, 7, 0) | 걷기 스윙, 신발 표시 |

> **오프셋 설명**: X=좌우(L=-/R=+), Y=높이(ground=0), Z=앞뒤(기본 0)
> ArmL X=-6: body 폭 8/2=4 + arm 폭 4/2=2 = 6 (몸통 측면에 밀착)
> LegL X=-2: body 폭 중앙에서 약간 벌림 (자연스러운 걷기 위해)

### 3.3 MC 대비 프로포션 비교

```
  MC Steve (32u)          큐블링 (24u)
  ┌──┐   8u (25%)        ┌────┐  10u (42%)  ★ 머리 비중 UP
  └──┘                    │◉ ◉│
  ┌──┐                    └──┬─┘
  │  │  12u (37%)        ┌──┴──┐  7u (29%)  ★ 몸통 축소
  │  │                    └──┬──┘
  │  │                    ┌─┴─┐
  │  │  12u (37%)        │   │   7u (29%)  ★ 다리 축소
  └──┘                    └───┘
```

### 3.4 질량(Mass) 기반 스케일링

현재 시스템의 로그 스케일 유지하되, 큐블링에 맞게 조정:

```typescript
// 기존: scale = 1.0 + Math.log2(mass / 10) * 0.3
// 신규: 머리는 덜 커지고, 몸통이 더 커지는 비대칭 스케일
const baseScale = 1.0 + Math.log2(mass / 10) * 0.25;
const headScale = 1.0 + Math.log2(mass / 10) * 0.15;  // 머리는 천천히
const bodyScale = 1.0 + Math.log2(mass / 10) * 0.30;  // 몸통은 빠르게

// mass=10  → base 1.0,  head 1.0,  body 1.0   (기본)
// mass=50  → base 1.58, head 1.35, body 1.70  (중간 성장)
// mass=100 → base 1.83, head 1.49, body 1.99  (최대 근접)
```

→ 성장할수록 "통통한 전사" 느낌 (머리는 유지, 몸이 커짐)

### 3.5 바디 타입 변형 (4종)

| 타입 | 스케일 조정 | 시각적 특징 | 히트박스 |
|------|-----------|-----------|---------|
| **Standard** | 1.0× 전체 | 기본 큐블링 | 동일 |
| **Slim** | body W×0.85, arm W×0.75 | 날렵한 체형, Alex풍 | 동일 |
| **Chunky** | body W×1.15, limb W×1.1 | 통통, 탱커 느낌 | 동일 |
| **Tall** | body H×1.2, leg H×1.15 | 키 큰 변형, 28u 높이 | 동일 |

> ⚠️ **히트박스는 체형과 무관** — 순수 코스메틱. hr(hitbox radius)는 서버에서 mass 기반 산출.

### 3.6 VoxelCharacter 월드유닛 변환 (로비 프리뷰)

AgentInstances는 게임 좌표(pixel-unit), VoxelCharacter는 R3F 월드 유닛 사용.
변환 비율: **16 pixel-unit = 1 world-unit** (현재와 동일)

| 파트 | 게임 좌표 (px) | 월드 유닛 | 현재 월드 유닛 |
|------|--------------|----------|-------------|
| Head | 10×10×8 | 0.625×0.625×0.5 | 0.5×0.5×0.5 |
| Body | 8×7×5 | 0.5×0.4375×0.3125 | 0.5×0.75×0.25 |
| Arm | 4×7×4 | 0.25×0.4375×0.25 | 0.25×0.75×0.25 |
| Leg | 4×7×4 | 0.25×0.4375×0.25 | 0.25×0.75×0.25 |
| **Total Height** | **24** | **1.5** | 2.0 |

> 로비 프리뷰의 총 높이가 2.0 → 1.5로 줄어듦. 카메라/레이아웃 조정 필요.

### 3.7 서버 프로토콜 확장

현재 `AgentNetworkData.k` (skinId: number)를 CubelingAppearance로 확장:

```typescript
// 방법: join_room 시 appearance 전송 → 서버 저장 → 다른 클라이언트에 중계
// 인게임 state broadcast는 기존 k(skinId) 대신 appearanceHash 사용
// appearanceHash → CubelingAppearance 매핑은 클라이언트 캐시

// join_room 이벤트 확장:
socket.emit('join_room', {
  roomId: string,
  name: string,
  appearance: CubelingAppearance,  // NEW: 8바이트 인코딩
});

// AgentNetworkData 변경:
interface AgentNetworkData {
  // ... 기존 필드 유지
  k: number;    // ← skinId → appearanceHash (하위 호환)
  ap?: number;  // NEW: appearance packed bits (첫 state에만 포함)
}
```

## 4. 텍스처 시스템

### 4.1 텍스처 전략: "같은 박스, 다른 세계"

InstancedMesh는 모든 인스턴스가 동일 지오메트리를 공유한다.
따라서 **텍스처가 캐릭터 차별화의 90%를 담당**한다.

```
지오메트리(동일) + 텍스처(개별) = 무한 캐릭터 조합
     □              🎨              → 🧙‍♂️🧛🤖👸🦊🐸
```

### 4.2 텍스처 해상도 & 렌더링

| 항목 | 값 | 이유 |
|------|---|------|
| 해상도 | **16×16** per face | 픽셀아트 감성 최적 사이즈 |
| 필터링 | `NearestFilter` | 선명한 픽셀 엣지 (블러 없음) |
| Mipmap | `false` | 텍스처가 작아 불필요 |
| ColorSpace | `SRGBColorSpace` | 정확한 색 재현 |
| 생성 방식 | **Canvas 2D 프로시저럴** | 런타임 생성, 파일 불필요 |

### 4.3 머리 텍스처 (정체성의 핵심)

```
  ← 16px →
  ┌────────────────┐ ↑
  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │ Row 0-2: 머리카락/이마
  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │
  │▓▓██▓▓▓▓▓▓██▓▓▓▓│ │ 3
  │▓▓██▓▓▓▓▓▓██▓▓▓▓│ │ Row 3-6: 눈 (3×2px each) ★ MC보다 50% 크게
  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │ 5
  │▓▓▓▓▓▓██▓▓▓▓▓▓▓▓│ │ Row 7: 코 (2×1px)
  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │ 7
  │▓▓▓▓████████▓▓▓▓│ │ Row 8-9: 입 (6×2px) ★ 다양한 표정
  │▓▓▓▓████████▓▓▓▓│ │ 9
  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │
  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│ │ Row 12-13: 볼/턱 라인 (둥근 느낌 음영)
  │░░▒▒▒▒▒▒▒▒▒▒▒▒░░│ │ Row 14-15: 모서리 어둡게 → 둥근 착시 ★
  └────────────────┘ ↓ 16px

  ★ 핵심: 모서리 2px를 어둡게 처리하면 박스인데 둥글게 보임!
```

**눈 스타일 (3×2 픽셀, 12종):**

```
Default   Angry    Cute     Cool     Wink     Dot
■□■       ■□■      □■□      ■■■      ■□■      □□□
■□■       □□■      ■□■      □□■      □□□      □■□

Sleepy    Star     Heart    X-Eyes   Visor    Spiral
─□─       ★□★      ♥□♥      ✕□✕      ▓▓▓      ◎□◎
□□□       □□□      □□□      □□□      ▓▓▓      □□□
```

**입 스타일 (6×2 픽셀, 8종):**

```
Smile    Neutral  Grin     Frown    Open     Fangs    Cat      Zigzag
 ____     ____     ████     ‾‾‾‾    ████     ▼  ▼     ω        /\/\
/    \    ────     ████     \__/    │  │     ████     ────     \/\/
```

### 4.4 몸통/팔/다리 텍스처

**몸통 (8×7 face, 16×16 텍스처):**
```
Row 0-1:  목/어깨 라인 (bodyColor 약간 어두움)
Row 2-5:  의상 메인 영역 + pattern 적용
Row 6:    벨트 라인 (secondaryColor)
Col 0,15: 측면 음영 (둥근 착시)
```

**팔 (4×7 face):**
```
Row 0-4:  소매 (bodyColor)
Row 5-6:  손 (skinTone) ★ MC에 없는 "손" 표현
```

**다리 (4×7 face):**
```
Row 0-4:  바지/하의 (legColor)
Row 5-6:  신발 (darkened legColor or 장비 색상)
```

### 4.5 색상 팔레트: 비비드 팝

MC의 차분한 톤 대신 **비비드 팝아트 팔레트** 사용:

```
기본 12색 (채도 UP):
🔴 #FF4444 Hot Red      🟠 #FF8844 Tangerine
🟡 #FFDD44 Sunshine     🟢 #44DD44 Lime
🔵 #4488FF Sky Blue     🟣 #AA44FF Violet
⚪ #F0F0F0 Cloud White  ⚫ #333333 Charcoal
🩷 #FF88AA Bubblegum    🩵 #44DDDD Cyan
🤎 #AA6644 Cocoa        🫧 #88DDAA Mint
```

### 4.6 "둥근 착시" 셰이딩 기법

모든 파트의 텍스처 가장자리를 어둡게 처리하여 BoxGeometry인데 둥글게 보이게:

```typescript
function applyRoundingShade(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // 모서리 4px을 그라데이션으로 어둡게
  const gradient = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.35, w/2, h/2, Math.min(w,h)*0.55);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');      // 중앙: 투명
  gradient.addColorStop(1, 'rgba(0,0,0,0.15)');   // 가장자리: 약간 어둡게
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}
```

→ 이 기법 하나로 "박스 캐릭터"에서 "둥근 캐릭터"로 인식 전환

## 5. 애니메이션 시스템

### 5.1 애니메이션 상태 머신

```
                    ┌──────────┐
          spawn ──→ │   IDLE   │ ←── levelup 끝
                    └──┬───┬───┘
              vel>5 ↓   ↑ vel<5   ↑ 0.3s
                 ┌──┴───┴──┐     ┌──┴──┐
                 │   WALK   │────→│ HIT │ ←── 피격 시
                 └──┬───┬───┘     └─────┘
          boost ↓   ↑
              ┌──┴───┴──┐        ┌───────┐
              │  BOOST   │───────→│ DEATH │ → 제거
              └──────────┘ alive  └───────┘
                          =false
         ┌────────┐  ┌─────────┐  ┌──────────┐
         │ ATTACK │  │ LEVELUP │  │ COLLECT  │
         └────────┘  └─────────┘  └──────────┘
           (오버레이 — 기본 이동 상태 위에 블렌딩)
```

### 5.2 10가지 애니메이션 상태 상세

#### ① IDLE (대기)
```
머리:  Y회전 ±10° (3초 주기, 좌우 둘러보기)
       Y위치 ±0.3 (2초 주기, 미세 호흡)
몸통:  Y스케일 0.98~1.02 (2초 주기, 호흡)
       X위치 ±0.5 (3초 주기, 무게중심 이동)
팔L:   X회전 ±5° (1.5초 주기)
팔R:   X회전 ∓5° (팔L 반대 위상)
다리:  거의 정지 (±1° 미세 흔들림)
눈:    3~5초마다 깜빡임 (텍스처 스왑, 0.15초간)
```

#### ② WALK (걷기)
```
머리:  Y위치 +1→0→+1 (스텝 주기 동기화, 바운스)
몸통:  Y위치 +0.5→0→+0.5 (반 바운스)
       Z회전 ±3° (힙 스웨이 — MC에 없는 개성!)
팔L:   X회전 +25°→-25° (걷기 주기)
팔R:   X회전 -25°→+25° (교차 스윙)
다리L: X회전 -25°→+25° (팔과 반대)
다리R: X회전 +25°→-25°
주기:  freq = min(velocity / 80, 3.5) Hz
       amp  = 0.44 rad (≈25°)
```

#### ③ BOOST (대시/부스트)
```
몸통:  X회전 15° (앞으로 기울임)
       Y스케일 0.92 (찌그러짐 = 속도감)
       X스케일 1.06 (옆으로 퍼짐)
머리:  X회전 10° (함께 기울임)
팔L:   X회전 -60° 고정 (뒤로 젖힘)
팔R:   X회전 -60° 고정
다리:  걷기의 2배속 + 진폭 1.3배
이펙트: 뒤에 속도선 파티클 (선택)
```

#### ④ ATTACK (자동전투 공격)
```
0.00s: 팔R X회전 → -30° (뒤로 빼기)
0.10s: 팔R X회전 → +90° (앞으로 휘두르기)
       몸통 Y회전 +15° (타겟 방향 트위스트)
0.25s: 팔R 원래 위치로 복귀
0.40s: 완료 → 이전 상태 복귀
무기 장착 시: 무기가 팔 궤적 따라감
전체 duration: 0.4초
```

#### ⑤ HIT (피격)
```
0.00s: 전체 X회전 -20° (뒤로 넉백)
       스케일 X→1.1, Y→0.9 (찌그러짐)
       색상 → 흰색 플래시 (0.08초)
0.08s: 색상 복귀
0.15s: 스케일 복귀 (스프링 바운스)
0.30s: X회전 복귀 → 이전 상태
전체 duration: 0.3초
```

#### ⑥ DEATH (사망)
```
Option A — "코미컬 퐁":
  0.0s: Y축 720° 회전 시작 + Y위치 +10 (점프)
  0.3s: Y위치 최고점
  0.6s: 착지 + 스케일 → 0 (쪼그라듦)
  0.8s: 완전 소멸 + 별 파티클 4개 퍼짐

Option B — "블록 붕괴":
  0.0s: 전체 경직 (0.2초)
  0.2s: 각 파트가 물리 시뮬레이션으로 분리 낙하
        (6개 박스가 각각 랜덤 방향으로 튕기며 떨어짐)
  1.0s: 파트들 페이드아웃

Option C — "먼지":
  0.0s: Y스케일 120% (살짝 부풀기)
  0.15s: 스케일 → 0 (빠른 축소)
  0.15s~: 먼지 파티클 구름 (0.5초)
```

#### ⑦ SPAWN (등장)
```
0.0s: 스케일 0 (보이지 않음)
0.1s: 스케일 → 1.3 (바운스 오버슈트)
0.2s: 스케일 → 0.9 (살짝 작아짐)
0.3s: 스케일 → 1.05
0.4s: 스케일 → 1.0 (안착)
이펙트: 착지 시 원형 웨이브 링
```

#### ⑧ LEVEL UP (레벨업)
```
0.0s: Y위치 +12 (점프!)
      팔L Z회전 -90° (만세!)
      팔R Z회전 +90°
0.3s: 최고점 + 별 파티클 버스트
0.5s: 착지 + Y위치 0
0.7s: 스케일 바운스 (1.0→1.1→1.0)
0.8s: 완료 → 이전 상태
이펙트: 골든 글로우 링 + ✦ 파티클
```

#### ⑨ VICTORY (승리)
```
반복 루프:
  0.0s: 점프 Y+8
  0.2s: 팔 교대 만세 (L→R→L)
  0.4s: 착지 + 몸통 Y회전 ±30° (흥겨운 춤)
  0.6s: 다시 점프
이펙트: 색종이 파티클 지속
```

#### ⑩ COLLECT (아이템 획득)
```
0.0s: 팔R X회전 +45° (앞으로 뻗기)
      머리 타겟 방향 Y회전
0.1s: 팔R 복귀
0.2s: 완료
이펙트: +1 텍스트 팝업 (옵셔널)
duration: 0.2초 (매우 짧음)
```

### 5.3 눈 깜빡임 시스템

```typescript
interface BlinkState {
  nextBlinkTime: number;  // 다음 깜빡임 시각
  blinking: boolean;      // 현재 깜빡이는 중
  blinkStart: number;     // 깜빡임 시작 시각
}

// 3~5초 랜덤 간격으로 눈 깜빡임
// 깜빡임 동안 눈 텍스처를 "closed" 버전으로 스왑
// duration: 0.15초 (빠르게)
// 피격/사망 시에는 깜빡임 중단
```

> **기술 노트**: InstancedMesh에서 인스턴스별 텍스처 스왑은 불가능.
> 해결: 눈 텍스처에 "열린/닫힌" 두 프레임을 세로로 배치하고
> UV offset을 셰이더 어트리뷰트로 제어, 또는
> 눈 부분만 별도 InstancedMesh로 분리 (draw call +1)

### 5.4 애니메이션 블렌딩 & 전환

```typescript
interface AnimationState {
  current: AnimState;
  previous: AnimState;
  blendFactor: number;     // 0=previous, 1=current
  blendDuration: number;   // 전환 시간
  elapsedInState: number;  // 현재 상태 경과 시간
}

// 전환 시간:
// IDLE ↔ WALK: 0.15초 (부드러운 시작/정지)
// WALK → BOOST: 0.1초 (빠른 전환)
// ANY → HIT: 0초 (즉시 반응)
// ANY → DEATH: 0초
// SPAWN → IDLE: 0.2초

// 블렌딩 공식:
// finalRotation = lerp(prevRotation, currRotation, easeInOut(blendFactor))
```

### 5.5 바운스 물리 (큐블링의 핵심 개성)

MC와 가장 큰 차이: **모든 움직임에 바운스**

```typescript
function cubelingBounce(elapsed: number, walkFreq: number): number {
  // 걸을 때 위아래 바운스 (사인 절대값 = 발 딛을 때마다 올라감)
  const bounce = Math.abs(Math.sin(elapsed * walkFreq * Math.PI * 2)) * 1.5;
  return bounce; // Y 오프셋으로 적용
}

function cubelingHipSway(elapsed: number, walkFreq: number): number {
  // 걸을 때 좌우 흔들림 (친근한 뒤뚱뒤뚱)
  return Math.sin(elapsed * walkFreq * Math.PI) * 0.05; // Z 회전으로 적용
}
```

## 6. 장비 & 액세서리 시스템

### 6.1 장비 부착점 시스템

```
              ★ HEAD_TOP (모자/헬멧)
         ┌────┴────┐
         │   HEAD   │
         │ ★FACE    │ ← HEAD_FRONT (마스크/고글)
         └────┬─────┘
         ┌────┴────┐
    ★──┐ │  BODY   │ ┌──★ ← HAND_R (무기)
  HAND_L │    ★     │ │     HAND_L (방패)
    └──┘ │  BACK    │ └──┘
         └────┬────┘
              ★ ← BACK (망토/날개/배낭)
         ┌───┴───┐
         │       │
         │       │
         └─★─┘ └─★─┘ ← FEET (신발/부츠)
```

**부착점 좌표 (24-unit 캐릭터 기준):**

| 부착점 | 상대 좌표 (x, y, z) | 부모 파트 | 장비 예시 |
|--------|--------------------|---------:|----------|
| HEAD_TOP | (0, +5.5, 0) | Head | 헬멧, 왕관, 마법사 모자 |
| HEAD_FRONT | (0, 0, +4.5) | Head | 마스크, 고글, 얼굴 장식 |
| HAND_R | (0, -4, +2) | ArmR | 검, 도끼, 지팡이, 트라이던트 |
| HAND_L | (0, -4, +2) | ArmL | 방패, 횃불, 책 |
| BACK | (0, 0, -3) | Body | 망토, 날개, 배낭, 화살통 |
| FEET | (0, -3.5, 0) | LegL/R | 부츠 (텍스처 오버레이) |

### 6.2 장비 카테고리 & 렌더링 전략

#### 모자/머리 장비 (HEAD_TOP)

**렌더링**: 별도 InstancedMesh (draw call +1)

```
지오메트리: 모자 유형별 2~3종
┌──────────┐    ┌──────────┐    ┌────────────┐
│ Helmet   │    │  Hat     │    │  Crown     │
│ 11×6×9  │    │ 12×4×12 │    │ 10×3×10   │
│ (반구형) │    │ (넓은)  │    │ (얇은링)  │
└──────────┘    └──────────┘    └────────────┘
```

| 모자 | 지오메트리 타입 | 텍스처 | 언락 조건 |
|------|---------------|--------|----------|
| 철 헬멧 | Helmet | 회색 금속 | Common |
| 금 헬멧 | Helmet | 노란 금속 | 10 킬 |
| 다이아 헬멧 | Helmet | 파란 보석 | 50 킬 |
| 마법사 모자 | Hat | 보라 별무늬 | 위자드 빌드 |
| 왕관 | Crown | 금+보석 | 1st Place |
| 호박 | Helmet | 주황 잭오랜턴 | 시즌 |
| 꽃 화관 | Crown | 형형색색 | Common |
| 바이킹 뿔 | Hat | 갈색+뿔 | 전사 빌드 |

#### 무기 (HAND_R)

**렌더링**: 별도 InstancedMesh, 무기 형태별 2종 지오메트리

```
Blade (검/도끼):        Staff (지팡이/삼지창):
  ┌─┐ 2×8×1              │ 1×10×1
  │ │                     │
  ├─┤ ← 가드              ●  ← 끝 장식
  │ │ ← 손잡이
  └─┘
```

| 무기 | 타입 | 크기 | 색상 | 언락 |
|------|------|------|------|------|
| 다이아 검 | Blade | 2×8×1 | 파란 빛 | 50 킬 |
| 철 도끼 | Blade | 3×7×1 | 회색 | Common |
| 마법 지팡이 | Staff | 1×10×1 | 보라+빛 | 위자드 |
| 트라이던트 | Staff | 2×10×1 | 청록 | 가디언 |
| 횃불 | Staff | 1×8×1 | 주황 불꽃 | Common |
| 활 | Blade | 1×8×2 | 갈색 | 레인저 |

#### 등 장비 (BACK)

**렌더링**: 별도 InstancedMesh, PlaneGeometry 기반 (얇은 판)

```
Cape (망토):      Wings (날개):       Pack (배낭):
  ┌──┐              ∧   ∧              ┌──┐
  │  │             / \ / \             │  │
  │  │            /   V   \            │  │
  │  │           /         \           ├──┤
  └──┘                                 └──┘
  6×8×0.5       10×8×0.5              4×5×3
```

| 등 장비 | 타입 | 특수 효과 | 언락 |
|---------|------|----------|------|
| 빨간 망토 | Cape | 걸을 때 살랑거림 (Z 회전) | Common |
| 천사 날개 | Wings | idle 때 미세 펄럭임 | 100 킬 |
| 엔더 날개 | Wings | 보라색 파티클 | Rare |
| 배낭 | Pack | 정적 | Common |
| 화살통 | Pack | 레인저 빌드 | Uncommon |

### 6.3 장비 애니메이션 연동

장비는 부착된 파트의 매트릭스를 상속받아 자연스럽게 움직임:

```typescript
// 무기: ArmR 매트릭스 × 로컬 오프셋
weaponMatrix = armRMatrix × translateMatrix(0, -4, 2);

// 모자: Head 매트릭스 × 로컬 오프셋
hatMatrix = headMatrix × translateMatrix(0, 5.5, 0);

// 망토: Body 매트릭스 × 로컬 오프셋 + 자체 물리
capeMatrix = bodyMatrix × translateMatrix(0, 0, -3) × capePhysicsRotation;
```

**망토 물리 (간단한 시뮬레이션):**
```typescript
// 이동 속도에 따라 뒤로 펄럭임
const capeAngle = Math.min(velocity * 0.01, 0.5); // 최대 30° 뒤로
const capeWave = Math.sin(elapsed * 3) * 0.05;     // 미세 펄럭임
capeRotationX = capeAngle + capeWave;
```

### 6.4 Draw Call 예산 (Color-Tint + Grouping 전략 반영)

| 카테고리 | 전략 | Draw Calls (최악) | Draw Calls (평균) |
|---------|------|-------------------|-------------------|
| Body (패턴 4종) | 패턴별 IM + setColorAt | 4 | 3 |
| ArmL | 단일 IM + setColorAt | 1 | 1 |
| ArmR | 단일 IM + setColorAt | 1 | 1 |
| LegL | 단일 IM + setColorAt | 1 | 1 |
| LegR | 단일 IM + setColorAt | 1 | 1 |
| Head (얼굴 조합별) | 얼굴별 IM + setColorAt | 15 | 10 |
| Eyes (깜빡임) | 단일 IM | 1 | 1 |
| 모자 (형태 3종) | 형태별 IM + setColorAt | 3 | 2 |
| 무기 (형태 2종) | 형태별 IM + setColorAt | 2 | 1 |
| 등 장비 | 단일 IM + setColorAt | 1 | 1 |
| 오라 링 (기존) | 단일 IM | 1 | 1 |
| **합계** | | **31** | **~23** |

> 현재 7 → 목표 ~25. 60 에이전트가 **전원 다르게** 보이면서도 30 이하 draw calls
> 참고: 단순 BoxGeometry (삼각형 12개)이므로 GPU 부하는 draw call 수에 비해 극히 낮음
> 비활성 그룹 (해당 패턴/얼굴 에이전트 0명)의 IM은 count=0으로 자동 스킵

## 7. 커스터마이제이션 시스템

### 7.1 커스터마이제이션 7단계 레이어

```
Layer 7: 이펙트    │ 트레일, 오라, 이모트, 스폰     │ ← 최상위 (특수)
Layer 6: 장비      │ 모자, 무기, 등, 신발            │ ← 실루엣 변화
Layer 5: 머리카락  │ 스타일 16종 + 컬러 16색          │ ← 개성
Layer 4: 의상      │ 상의색 + 하의색 + 패턴 8종       │ ← 코디
Layer 3: 얼굴      │ 눈12 × 입8 × 마킹8 = 768 조합  │ ← 감정/표현
Layer 2: 피부      │ 스킨톤 12종                     │ ← 기본 정체성
Layer 1: 체형      │ 4 바디타입 × 3 사이즈            │ ← 실루엣 기초
─────────────────────────────────────────────────────
```

### 7.2 조합 수 산출

```
Layer 1: 4 × 3 = 12 체형
Layer 2: 12 피부톤
Layer 3: 12 × 8 × 8 = 768 얼굴
Layer 4: 12 × 12 × 8 = 1,152 의상
Layer 5: 16 × 16 = 256 헤어
Layer 6: 8 × 6 × 5 × 8 = 1,920 장비
Layer 7: 8 × 6 × 8 × 6 = 2,304 이펙트

총 이론적 조합: 12 × 12 × 768 × 1,152 × 256 × 1,920 × 2,304
             ≈ 1.48 × 10^16 (1.48경 가지)
```

> 모든 플레이어가 독특한 캐릭터를 가질 수 있음

### 7.3 캐릭터 에디터 UI

```
┌─────────────────────────────────────────────────────┐
│  ✦ CHARACTER CREATOR                           [X]  │
├─────────────┬───────────────────────────────────────┤
│             │  [체형][피부][얼굴][의상][헤어][장비][FX] │
│   ┌─────┐  ├───────────────────────────────────────┤
│   │     │  │                                       │
│   │ 3D  │  │  ┌───┐ ┌───┐ ┌───┐ ┌───┐            │
│   │미리 │  │  │옵1│ │옵2│ │옵3│ │옵4│            │
│   │보기 │  │  └───┘ └───┘ └───┘ └───┘            │
│   │     │  │  ┌───┐ ┌───┐ ┌───┐ ┌───┐            │
│   │ ↻   │  │  │옵5│ │옵6│ │옵7│ │옵8│            │
│   │회전 │  │  └───┘ └───┘ └───┘ └───┘            │
│   │     │  │                                       │
│   └─────┘  │  Color: ● ● ● ● ● ● ● ●            │
│             │         ● ● ● ●                      │
│  [🎲Random] │                                       │
├─────────────┴───────────────────────────────────────┤
│  [Reset]              [Save Preset]         [Done]  │
└─────────────────────────────────────────────────────┘
```

**UI 특징:**
- 좌측: R3F 미니 캔버스 (VoxelCharacter 단독 렌더, 마우스 드래그로 360° 회전)
- 상단: 7개 탭 (레이어별)
- 중앙: 옵션 그리드 (4×2 또는 4×3, 페이지네이션)
- 하단: 컬러 피커 (해당 탭에서 색 선택 시)

### 7.4 프리셋 캐릭터 (빠른 시작용)

에디터가 부담스러운 유저를 위한 완성된 프리셋:

| 프리셋 | 컨셉 | 체형 | 눈 | 의상 | 장비 | 등급 |
|--------|------|------|---|------|------|------|
| Nova | 밝은 모험가 | Standard | Cute | 주황+흰 | 꽃화관 | Common |
| Rex | 터프 전사 | Chunky | Angry | 빨강+검정 | 철 헬멧+검 | Common |
| Pixel | 기본 큐블링 | Standard | Default | 파랑+회색 | 없음 | Common |
| Ghost | 미스터리 | Slim | Dot | 검정+보라 | 마스크 | Uncommon |
| Sage | 지혜의 마법사 | Tall | Cool | 보라+금 | 마법모자+지팡이 | Uncommon |
| Blitz | 스피드 닌자 | Slim | Visor | 회색+검정 | 두건+쿠나이 | Rare |
| Titan | 중갑 탱커 | Chunky | Angry | 은색+파랑 | 다이아헬멧+방패 | Rare |
| Phoenix | 불사조 전사 | Standard | Star | 빨강+금 | 화염 날개 | Epic |

### 7.5 데이터 구조

```typescript
interface CubelingAppearance {
  // Layer 1: 체형
  bodyType: 'standard' | 'slim' | 'chunky' | 'tall';
  bodySize: 'small' | 'medium' | 'large';

  // Layer 2: 피부
  skinTone: number; // 0-11 인덱스

  // Layer 3: 얼굴
  eyeStyle: number;     // 0-11
  mouthStyle: number;   // 0-7
  marking: number;      // 0-7 (none, stripes, creeper, ...)

  // Layer 4: 의상
  topColor: number;     // 0-11
  bottomColor: number;  // 0-11
  pattern: number;      // 0-7

  // Layer 5: 헤어
  hairStyle: number;    // 0-15
  hairColor: number;    // 0-15

  // Layer 6: 장비
  hat: number;          // 0-8 (0=none)
  weapon: number;       // 0-6 (0=none)
  backItem: number;     // 0-5 (0=none)
  footwear: number;     // 0-8 (0=none)

  // Layer 7: 이펙트
  trailEffect: number;  // 0-7 (0=none)
  auraEffect: number;   // 0-5 (0=none)
  emote: number;        // 0-7 (0=none)
  spawnEffect: number;  // 0-5 (0=none)
}

// 네트워크 전송 시 압축: 각 필드를 비트로 인코딩
// bodyType:2 + bodySize:2 + skinTone:4 + eye:4 + mouth:3 + marking:3
// + topColor:4 + bottomColor:4 + pattern:3 + hairStyle:4 + hairColor:4
// + hat:4 + weapon:3 + backItem:3 + footwear:4
// + trail:3 + aura:3 + emote:3 + spawn:3 = 63 bits ≈ 8 bytes
// (현재 skinId 1바이트에서 8바이트로 증가, 최초 join 시 1회만 전송)
```

### 7.6 텍스처 캐싱 전략

```typescript
// 캐시 키: 외형 데이터의 해시
const cacheKey = hashAppearance(appearance);
const textureCache: Map<string, CubelingTextures> = new Map();

interface CubelingTextures {
  head: THREE.CanvasTexture;   // 6면 텍스처
  body: THREE.CanvasTexture;
  arm: THREE.CanvasTexture;
  leg: THREE.CanvasTexture;
  timestamp: number;           // LRU 캐시 관리
}

// 최대 120 캐시 (60 현재 + 60 이전/교체 버퍼)
// LRU 정책으로 오래된 텍스처 해제
```

### 7.7 언락 시스템 (성취 기반)

| 등급 | 언락 조건 예시 | 해당 아이템 수 |
|------|--------------|-------------|
| **Common** | 기본 제공 | 체형, 기본 색상, 기본 장비 (~60%) |
| **Uncommon** | 10 플레이, 첫 킬 | 추가 패턴, 직업 프리셋 (~20%) |
| **Rare** | 50 킬, 3연승 | MC 몹 테마, 고급 장비 (~12%) |
| **Epic** | 시너지 발견, 특수 퀘스트 | 전설 빌드 외형 (~5%) |
| **Legendary** | 1000 킬, 10연승 | 극한 도전 보상 (~3%) |

> 가챠/과금 없음 — 순수 성취 기반. 게임 플레이로만 언락.

## 8. Three.js 기술 아키텍처

### 8.1 InstancedMesh 아키텍처 (Color-Tint + Grouping)

```
AgentInstances.tsx (메인 렌더러 — 바디 파트)
├── bodyMeshes[4]:   패턴별 IM<BoxGeo(8,7,5), whiteMat, 60>  + setColorAt ★
├── armLMesh:        IM<BoxGeo(4,7,4), whiteMat, 60>          + setColorAt ★
├── armRMesh:        IM<BoxGeo(4,7,4), whiteMat, 60>          + setColorAt ★
├── legLMesh:        IM<BoxGeo(4,7,4), whiteMat, 60>          + setColorAt ★
├── legRMesh:        IM<BoxGeo(4,7,4), whiteMat, 60>          + setColorAt ★
│
HeadGroupManager.tsx (얼굴 그룹 관리자)
├── headMeshMap:     Map<FaceKey, IM<BoxGeo(10,10,8), faceMat, 60>>
│                    — 얼굴(눈+입) 조합별 동적 생성 (~10그룹)
│                    — 각 IM에 setColorAt으로 머리카락/피부톤 차별화
│
EyeInstances.tsx (눈 깜빡임)
├── eyeMesh:         IM<PlaneGeo(4,2), eyeMat, 60>  + UV offset
│
EquipmentInstances.tsx (장비)
├── hatMeshes[3]:    형태별 IM + setColorAt (Helmet/Hat/Crown)
├── weaponMeshes[2]: 형태별 IM + setColorAt (Blade/Staff)
├── backMesh:        IM<PlaneGeo(6,8), whiteMat, 60> + setColorAt
│
AuraRings.tsx (기존)
└── auraMesh:        IM<RingGeo, mat, 60>

★ = setColorAt()으로 인스턴스별 고유 색상 (추가 draw call 없음)
```

### 8.2 머티리얼 전략: "Color-Tint + Texture Grouping"

> **⚠️ 핵심 기술 결정 (ADR-001)**
> 현재 코드는 "dominant skin" 방식으로 **60명 전원이 동일 텍스처**를 공유한다.
> 큐블링의 핵심 목표인 "60명이 모두 달라 보임"을 위해 새로운 전략이 필수.

**선택한 접근법: setColorAt() + 텍스처 그룹핑 하이브리드**

```
┌─────────────────────────────────────────────────────────┐
│ Body/Arms/Legs:                                         │
│   1 InstancedMesh per part × setColorAt() per instance  │
│   → 인스턴스별 고유 색상 (draw call 추가 없음!)          │
│   → 패턴별 그룹핑 (solid/striped/dotted/gradient)       │
│                                                         │
│ Head:                                                   │
│   얼굴 텍스처(눈+입) 조합별 InstancedMesh 그룹핑         │
│   → 같은 얼굴 에이전트끼리 1 InstancedMesh 공유          │
│   → 색상(머리카락/피부톤)은 setColorAt()로 차별화        │
│                                                         │
│ Equipment:                                              │
│   장비 형태별 InstancedMesh + setColorAt()               │
│   → 같은 형태 다른 색상 가능                            │
└─────────────────────────────────────────────────────────┘
```

**Three.js setColorAt() 동작 원리:**
```typescript
// setColorAt()은 instanceColor InstancedBufferAttribute를 사용
// material.color × instanceColor = 최종 색상 (곱연산)
// material.color = white(1,1,1)로 설정하면 instanceColor가 그대로 반영

const mesh = new THREE.InstancedMesh(geometry, material, 60);
const color = new THREE.Color();

// 에이전트 0: 빨간 옷
color.set('#FF4444');
mesh.setColorAt(0, color);

// 에이전트 1: 파란 옷
color.set('#4488FF');
mesh.setColorAt(1, color);

mesh.instanceColor!.needsUpdate = true;
// → 추가 draw call 없이 인스턴스별 고유 색상!
```

**패턴별 그룹핑 (body/arm/leg):**
```typescript
// 패턴 4종 → 4 InstancedMesh per part
// 각 IM은 해당 패턴의 base texture 사용, 색상은 setColorAt

const bodyMeshes = {
  solid:    new InstancedMesh(bodyGeo, solidMat, 60),    // 단색 패턴
  striped:  new InstancedMesh(bodyGeo, stripedMat, 60),  // 줄무늬 패턴
  dotted:   new InstancedMesh(bodyGeo, dottedMat, 60),   // 도트 패턴
  gradient: new InstancedMesh(bodyGeo, gradientMat, 60), // 그라데이션
};

// 에이전트 배분: pattern에 따라 해당 IM에 할당
// solidMat.color = white → setColorAt이 최종 색상 결정
```

**얼굴 그룹핑 (head):**
```typescript
// 활성 얼굴 조합: 실제 동시 접속자의 눈+입 조합
// 평균 8~12 그룹 (60명 중 많은 인원이 같은 얼굴 공유)
// 각 그룹의 InstancedMesh는 해당 얼굴 텍스처 사용

type FaceKey = `${number}-${number}`; // "eyeStyle-mouthStyle"
const headMeshMap = new Map<FaceKey, InstancedMesh>();

// 새 얼굴 조합 등장 시 동적 생성
function getHeadMesh(eyeStyle: number, mouthStyle: number): InstancedMesh {
  const key: FaceKey = `${eyeStyle}-${mouthStyle}`;
  if (!headMeshMap.has(key)) {
    const mat = createHeadMaterial(eyeStyle, mouthStyle);
    headMeshMap.set(key, new InstancedMesh(headGeo, mat, 60));
  }
  return headMeshMap.get(key)!;
}
// 머리카락/피부톤은 setColorAt으로 차별화
```

**왜 이 접근법인가 (대안 비교):**

| 접근법 | Draw Calls | 구현 난이도 | 시각 다양성 | 선택 |
|--------|-----------|-----------|-----------|------|
| ~~dominant skin (현재)~~ | 7 | 쉬움 | ❌ 전원 동일 | 탈락 |
| ~~skinId별 그룹핑~~ | 60×6=360 | 쉬움 | ✅ 완전 | 탈락(성능) |
| ~~DataArrayTexture+Shader~~ | 12 | 매우 높음 | ✅ 완전 | 탈락(복잡도) |
| **Color-Tint + Grouping** | **~25** | **중간** | **✅ 충분** | **✅ 채택** |

### 8.3 애니메이션 파이프라인

```
useFrame (priority 0, 매 프레임)
│
├── 1. Read server state (interpolated positions)
│
├── 2. Per-agent state machine update
│   ├── Determine animation state (idle/walk/boost/hit/...)
│   ├── Update blend factor (state 전환 중이면)
│   └── Update elapsed time in state
│
├── 3. Compute per-part transforms (6 파트 × 60 에이전트 = 360 매트릭스)
│   ├── Base position (world coords)
│   ├── + Animation offset (state-dependent rotations)
│   ├── + Bounce physics (Y offset)
│   ├── + Scale (mass-based)
│   └── = Final matrix4
│
├── 4. Update InstancedMesh matrices
│   ├── headMesh.setMatrixAt(i, headMatrix)
│   ├── bodyMesh.setMatrixAt(i, bodyMatrix)
│   ├── armL/R, legL/R ...
│   └── instanceMatrix.needsUpdate = true
│
├── 5. Equipment matrices (부착점 기반)
│   ├── hatMesh.setMatrixAt(i, headMatrix × hatOffset)
│   ├── weaponMesh.setMatrixAt(i, armRMatrix × weaponOffset)
│   └── backMesh.setMatrixAt(i, bodyMatrix × backOffset)
│
└── 6. Visibility (장비 없는 에이전트는 scale=0으로 숨김)
```

### 8.4 눈 깜빡임 기술적 해결

InstancedMesh에서 인스턴스별 텍스처 변경이 불가하므로:

**접근법 A: 눈 전용 InstancedMesh 분리** (권장)
```
headMesh: 머리 본체 (눈 영역 비움)
eyeMesh:  InstancedMesh<PlaneGeometry(4,2), Material, 60>
  → 머리 앞면에 배치
  → 인스턴스별 UV offset으로 열린/닫힌 눈 전환
  → draw call +1 (총 13)
```

**접근법 B: 셰이더 기반 UV 애니메이션**
```glsl
// Custom vertex shader attribute
attribute float eyeState; // 0.0 = open, 1.0 = closed
varying float vEyeState;

// Fragment shader에서 eyeState에 따라 UV 영역 선택
// 텍스처에 열린 눈 + 닫힌 눈을 세로로 배치
```

**Phase 1**: 접근법 A (구현 간단, draw call 비용 미미)
**Phase 2**: 접근법 B (셰이더 통합으로 draw call 절약)

### 8.5 파일 구조 (예상)

```
apps/web/
├── components/3d/
│   ├── AgentInstances.tsx       ← 리팩토링 (새 프로포션 + Color-Tint)
│   ├── HeadGroupManager.tsx     ← NEW (얼굴 그룹별 IM 관리)
│   ├── EquipmentInstances.tsx   ← NEW (장비 렌더링 + setColorAt)
│   ├── EyeInstances.tsx         ← NEW (눈 깜빡임)
│   ├── VoxelCharacter.tsx       ← 리팩토링 (로비 프리뷰, 1.5u 높이)
│   └── ...
├── lib/3d/
│   ├── agent-textures.ts        ← 대폭 리팩토링 (흰색 base + colorAt)
│   ├── cubeling-proportions.ts  ← NEW (프로포션 상수 + X/Y/Z 오프셋)
│   ├── animation-state-machine.ts ← NEW (10 상태 + 블렌딩 + 바운스)
│   ├── equipment-data.ts        ← NEW (장비 데이터 + 부착점 좌표)
│   └── skin-migration.ts        ← NEW (skinId→Appearance 매핑)
└── components/lobby/
    └── CharacterCreator.tsx     ← NEW (캐릭터 에디터 UI)

packages/shared/src/
├── types/
│   └── appearance.ts            ← NEW (CubelingAppearance + 비트 인코딩)
└── constants/
    └── cubeling.ts              ← NEW (스킨톤, 색상, 장비, 프리셋)
```

## 9. 리스크

| 리스크 | 영향 | 확률 | 완화 전략 |
|--------|------|------|----------|
| 프로포션 변경 시 히트박스 불일치 | 게임플레이 혼란 | 낮음 | 히트박스는 서버 mass 기반, 시각적 크기와 분리 |
| Color-Tint 전략으로 draw call ~25 | FPS 하락 | 낮음 | 비활성 그룹 count=0 스킵, 단순 지오메트리라 GPU 부하 미미 |
| 얼굴 그룹 IM 동적 생성/삭제 | 메모리 누수 | 중간 | 접속 해제 시 미사용 그룹 dispose, 주기적 cleanup |
| 텍스처 캐시 메모리 증가 (~60 텍스처 세트) | OOM on 저사양 | 낮음 | LRU 캐시 60개 상한, Canvas 해상도 유지 (16×16) |
| 10종 애니메이션 상태 전환 복잡도 | 버그, 떨림 | 높음 | 상태 머신 프레임워크 먼저 구축 → 단계적 상태 추가 |
| 캐릭터 에디터 UI 개발 공수 | 일정 지연 | 중간 | Phase 1에서는 프리셋만, 에디터는 Phase 6 |
| 네트워크 외형 데이터 증가 (1B→8B) | 대역폭 | 낮음 | join 시 1회만 전송, 인게임은 hash 매핑 |
| 기존 24 스킨과 호환성 | 기존 유저 데이터 | 중간 | Phase 1에서 즉시 매핑 테이블 구축 |
| 눈 깜빡임 인스턴스 분리 시 Z-fighting | 시각 깨짐 | 중간 | polygonOffset 또는 Z-bias로 해결 |
| setColorAt() 색상 곱연산 한계 | 패턴 색 부정확 | 낮음 | base texture를 흰색 기반으로 제작, color tint가 원본색 반영 |

## 구현 로드맵

<!-- ★ da:work Stage 0이 이 섹션을 자동 파싱합니다 -->

### Phase 1: 기반 타입 + 프로포션 + 스킨 마이그레이션
| Task | 설명 |
|------|------|
| CubelingAppearance 타입 정의 | shared 패키지에 외형 인터페이스 + 상수 + 비트 인코딩 유틸 |
| skinId→Appearance 매핑 테이블 | 기존 24 스킨을 CubelingAppearance로 1:1 변환 (하위 호환) |
| 프로포션 상수 모듈 | cubeling-proportions.ts — 24-unit 파트 크기/오프셋 (X,Y,Z 전부) |
| 비비드 팝 색상 팔레트 | 12색 비비드 + 12 스킨톤 + 둥근 착시 셰이딩 유틸 |
| AgentInstances 프로포션 변경 | 32u→24u, head 10×10×8, arm/leg 4×7×4, 오프셋 전체 변경 |
| VoxelCharacter 프로포션 변경 | 로비 프리뷰 월드유닛 변환 (총 높이 2.0→1.5) |

- **design**: N (모델 구조 변경)
- **verify**: 로비/게임 캐릭터 정상 렌더링, 기존 24 스킨 정상 표시, 비율 시각 확인

### Phase 2: Color-Tint 머티리얼 시스템
| Task | 설명 |
|------|------|
| setColorAt 기반 body/arm/leg 렌더링 | dominant skin 방식 → 인스턴스별 고유 색상 |
| 패턴별 InstancedMesh 그룹핑 (body) | solid/striped/dotted/gradient 4그룹 분리 |
| 얼굴 텍스처 그룹핑 (head) | eye+mouth 조합별 동적 InstancedMesh 생성/관리 |
| 머리카락/피부톤 setColorAt | head IM에 인스턴스별 색상 적용 |
| 텍스처 캐시 관리자 리팩토링 | LRU 캐시 + 미사용 얼굴 그룹 자동 dispose |
| 서버 프로토콜 확장 | join_room에 appearance 전송, AgentNetworkData.ap 추가 |

- **design**: N (렌더링 아키텍처)
- **verify**: 60 에이전트 각각 다른 색상/얼굴 표시, draw call ≤ 30, 기존 기능 정상

### Phase 3: 텍스처 시스템 고도화
| Task | 설명 |
|------|------|
| 머리 텍스처 리팩토링 | 큰 눈(3×2), 입(6×2), 둥근 착시 셰이딩 |
| 눈 스타일 12종 구현 | Default~Spiral 12종 프로시저럴 생성 |
| 입 스타일 8종 구현 | Smile~Zigzag 8종 |
| 머리카락 텍스처 시스템 | 16 스타일 × 16 색상 (흰색 base + colorAt) |
| 몸통/팔/다리 텍스처 | 패턴 base 텍스처(흰색) + colorAt, 손/신발 표현 |

- **design**: N (텍스처 로직)
- **verify**: 12눈×8입 조합 렌더링 확인, 패턴 시각 품질, 색상 정확도

### Phase 4A: 애니메이션 상태 머신 프레임워크
| Task | 설명 |
|------|------|
| AnimationStateMachine 클래스 | 상태 정의, 전환 조건, 블렌딩 팩터 관리 |
| 바운스 물리 시스템 | 걷기 바운스 + 힙스웨이 (cos 기반 smooth 곡선) |
| IDLE 리팩토링 | 호흡 + 좌우 둘러보기 + 무게중심 이동 |
| WALK 리팩토링 | 교차 스윙 + Y 바운스 + Z 힙스웨이 |
| BOOST 리팩토링 | 앞 기울임 + 팔 잠금 + 2배속 다리 |
| 상태 전환 블렌딩 | lerp 기반 0.1~0.2초 전환 (기존 if/else → 상태 머신) |

- **design**: N (애니메이션 프레임워크)
- **verify**: idle/walk/boost 상태 전환 부드러움, 기존 동작과 시각적 동등 이상

### Phase 4B: 전투/이벤트 애니메이션 추가
| Task | 설명 |
|------|------|
| ATTACK 애니메이션 | 자동전투 공격 모션 (팔R 휘두르기 0.4초) |
| HIT 애니메이션 | 넉백 + 찌그러짐 + 흰색 플래시 (0.3초) |
| DEATH 애니메이션 | "코미컬 퐁" 기본 구현 (720° 스핀 + 축소) |
| SPAWN 애니메이션 | 스케일 바운스 (0→1.3→0.9→1.0, 0.4초) |
| LEVELUP 애니메이션 | 점프 + 만세 포즈 (0.8초) |
| VICTORY/COLLECT | 승리 춤 루프 + 짧은 팔 뻗기 |

- **design**: N (애니메이션 추가)
- **verify**: 모든 신규 상태 정상 트리거/전환, 60 에이전트 동시 30FPS 이상

### Phase 5: 장비 & 액세서리 시스템
| Task | 설명 |
|------|------|
| 장비 데이터 모듈 | equipment-data.ts — 모자/무기/등/신발 정의 + 부착점 |
| EquipmentInstances 컴포넌트 | 형태별 IM + setColorAt (모자 3IM, 무기 2IM, 등 1IM) |
| 부착점 매트릭스 연산 | 부모 파트 매트릭스 상속 + 로컬 오프셋 |
| 모자 8종 + 무기 6종 텍스처 | 프로시저럴 Canvas 생성 (흰색 base) |
| 등 아이템 5종 | 망토/날개/배낭 + 속도 기반 망토 회전 |
| 장비 visibility 관리 | 미착용 에이전트는 해당 IM에서 제외 (count 관리) |

- **design**: N (렌더링 로직)
- **verify**: 장비 장착/해제 정상, 부착점 추종, 총 draw call ≤ 30

### Phase 6: 눈 깜빡임 & 표정 시스템
| Task | 설명 |
|------|------|
| EyeInstances 컴포넌트 | 눈 전용 InstancedMesh (PlaneGeometry) + Z-bias |
| 눈 깜빡임 로직 | 에이전트 ID 시드 기반 3~5초 랜덤 간격, 0.15초 duration |
| 상태별 표정 변화 | HIT→찡그림, DEATH→X눈, LEVELUP→별눈 |
| polygonOffset 적용 | Z-fighting 방지 (머리 앞면과 눈 면 분리) |

- **design**: N
- **verify**: 깜빡임 자연스러움, 60명 동시 비동기 깜빡임, Z-fighting 없음

### Phase 7: 캐릭터 에디터 UI
| Task | 설명 |
|------|------|
| CharacterCreator 레이아웃 | 좌측 3D 프리뷰 + 우측 7탭 옵션 그리드 |
| 체형/피부/얼굴/헤어 탭 | 옵션 그리드 + 색상 선택 + 실시간 반영 |
| 의상/장비/이펙트 탭 | 장비 그리드 + 컬러 피커 |
| Random/Reset/Save | 랜덤 생성 + 초기화 + localStorage 저장 |
| 프리셋 8종 | 빠른 시작용 완성된 캐릭터 |
| 네트워크 동기화 완성 | join 시 CubelingAppearance → 서버 → 다른 클라이언트 |

- **design**: Y (캐릭터 에디터 UI)
- **verify**: 에디터 옵션 동작, 3D 프리뷰 실시간 반영, 저장/불러오기, 멀티플레이어 동기화

### Phase 8: 폴리싱 & 최적화
| Task | 설명 |
|------|------|
| 성능 프로파일링 | 60 에이전트 + 장비 + 애니메이션 FPS 벤치마크 |
| 모바일 최적화 | 원거리 에이전트 애니메이션 축소, 장비 LOD |
| 미사용 IM 정리 최적화 | 얼굴 그룹 GC, 장비 그룹 cleanup 주기 |
| 언락 시스템 연동 | 성취 기반 장비 해금 로직 + UI 표시 |

- **design**: N
- **verify**: 60fps@60에이전트(데스크탑), 30fps(모바일), 전체 기능 정상
