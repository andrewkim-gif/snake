# PLAN: Arena Combat — 3D 온라인 서바이벌 로그라이크

> v18 — Arena 메카닉 기반 멀티플레이어 자동전투 아레나
> 기존 CountryArena 시스템 + 마인크래프트 R3F 엔진 + Go WebSocket 서버 위에 구축
> **기존 v11~v17의 국가/팩션/주권 시스템을 완전히 통합**

---

## 1. 개요

### 컨셉

Arena Combat는 기존 AI World War의 **CountryArena 전투 메카닉을 대체하는 자동전투 서바이벌 로그라이크**다.
별도의 독립 게임이 아니라, **195개 국가 아레나에서 실제로 벌어지는 전투 방식** 자체를 Arena 스타일로 전환한다.

- **장르 조합**: Vampire Survivors(자동전투 + 웨이브) × Arena(3D 점프/슬라이드 + 오버크리티컬) × AI World War(국가/팩션/주권)
- **플레이 모드**:
  - **Standard Battle (5분)**: 기존 CountryArena 배틀사이클과 동일 타이밍. 국가 진입 → PvE + PvP → 주권 판정
  - **Marathon Mode (1시간)**: 특수 이벤트/주말 모드. PvE 5분 + PvP 1분 × 11사이클 + 최종 결전
- **참가자**: 국가 Tier × 인구 기반 가변 인원 (8~150명)
- **핵심 경험**: 국가 선택 → 적 처치 → XP 수집 → 레벨업 → Tome 선택 → 시너지 빌드 → PvP/팩션전 → 주권 변동

### 국가 Tier별 아레나 스케일링

기존 `CalcMaxAgents(tier, population)` 공식을 그대로 사용:

| Tier | 예시 국가 | 아레나 반경 | MaxAgents | 인간 슬롯 (40%) | 봇 (60%) |
|------|----------|-----------|-----------|---------------|---------|
| **S (초강대국)** | USA, CHN, RUS, JPN, KOR | 6000px | 최대 50 | 20 | 30 |
| **A (강대국)** | FRA, SAU, AUS, TUR, IDN | 4500px | 최대 35 | 14 | 21 |
| **B (지역강국)** | THA, ARG, SGP, NZL, CHE | 3500px | 최대 25 | 10 | 15 |
| **C (표준)** | SVK, HRV, GEO, ARM, EST | 2500px | 최대 15 | 6 | 9 |
| **D (소국)** | 소규모/도서국 | 1500px | 최대 8 | 3 | 5 |

> 실제 MaxAgents는 `floor(tierMax × clamp(log10(pop/1M) / log10(tierRefPop/1M), 0.3, 1.0))` 로그 스케일.
> 최소 보장: 5명. 예) 바티칸(D-tier, 800명) = 5명, 한국(S-tier, 51M) ≈ 34명, 미국(S-tier, 331M) = 50명.

### 기존 시스템 통합 포인트

| 기존 시스템 | v18 통합 방식 |
|------------|-------------|
| CountryArena (v14) | Arena 전투 로직이 Room의 게임 루프를 대체 |
| WorldManager (v11) | 195국 상태, 주권, 배틀사이클 스케줄링 유지 |
| terrain_bonus.go | 6종 국가 테마 전투 보정 그대로 적용 |
| biome.go (v16) | Voronoi 바이옴 6종 → 맵 내 구역별 효과 |
| NationalAI (v16/v17) | Reflexive/Tactical AI → Arena 전투 AI로 확장 |
| 팩션/주권 시스템 | PvP 결과 → 팩션 점수 → 주권 변동 트리거 |
| OperatorRegistry (v17) | 외부 AI/인간 오퍼레이터 전투 참여 경로 유지 |

### 기술 스택 요약

| 레이어 | 기술 |
|--------|------|
| 클라이언트 3D | React Three Fiber v9 + Three.js r175 + @react-three/drei |
| 클라이언트 UI | Next.js 15 + shadcn/ui + Tailwind |
| 서버 | Go 1.22 + gorilla/websocket + SpatialHash |
| 프로토콜 | WebSocket JSON (input 30Hz / state 20Hz) |
| 인프라 | Railway (서버) + Vercel (클라이언트) |
| 국가/세계 | WorldManager + CountryArenaManager + Redis 동기화 |

### 목표

1. 기존 CountryArena의 전투 메카닉을 Arena 자동전투 + 빌드 시스템으로 교체
2. 국가 특색 맵 (6종 테마 × Voronoi 바이옴)으로 195국 각각 다른 전투 경험
3. 자동전투 + 빌드 시스템으로 "쉬운 입문, 깊은 전략" 달성
4. PvE→PvP 전환으로 긴장감 유지, 결과가 팩션 주권에 실질적 영향
5. 기존 AI 계층(NationalAI/외부 Agent/인간)이 Arena 전투에서 각자 역할 수행

## 2. 핵심 게임 루프

### 듀얼 모드 구조

v18는 두 가지 모드로 운영된다:

**Mode A: Standard Battle (5분)** — 기존 CountryArena 배틀사이클
```
국가 진입 → 10초 Deploy → 4분 PvE (자동전투+빌드) → 1분 PvP (팩션전) → 주권 판정
```
기존 5분 사이클과 완벽 호환. 짧지만 빌드 선택 3~5회로 전략 차별화.

**Mode B: Marathon (1시간)** — 주말/이벤트 특수 모드
```
[매치 시작]
    │
    ▼
┌─────────────────────────────────┐
│  PvE 생존 Phase (5분)           │
│  ─────────────────────          │
│  적 웨이브 → 처치 → XP 드롭     │
│  XP 수집 → 레벨업 → Tome 선택   │
│  필드 아이템 드롭 → 장비 강화    │
│  미니보스 (Tier별 주기)          │
└──────────┬──────────────────────┘
           │ 5분 경과
           ▼
┌─────────────────────────────────┐
│  PvP 아레나 Phase (60초)        │
│  ─────────────────────          │
│  팩션별 대결 (주권 쟁탈)         │
│  축소 아레나에서 배틀로얄        │
│  탈락자 = 관전 / 생존자 복귀     │
└──────────┬──────────────────────┘
           │ ×11회 반복 (55분)
           ▼
┌─────────────────────────────────┐
│  최종 결전 (5분) + 보스          │
│  최후 팩션 = 국가 주권 획득      │
└─────────────────────────────────┘
```

### 세부 루프 (PvE Phase 내)

1. **적 스폰**: 매 3초마다 웨이브 — 라운드 번호 × Tier 배율에 비례
2. **자동 공격**: 캐릭터가 사거리 내 가장 가까운 적을 자동 타격
3. **XP 크리스탈**: 적 처치 시 드롭, 자석 범위(기본 2m, Magnet Tome으로 확장) 내 자동 수집
4. **레벨업**: XP 바 충족 시 3개 Tome 중 1개 선택 (희귀도별 가중치 적용)
5. **필드 아이템**: 엘리트/미니보스 처치 시 장비 아이템 드롭
6. **지형 활용**: 국가 테마 보정 + Voronoi 바이옴 효과 (§4 참조)

### Tier 적응형 난이도 스케일링

웨이브 수와 강도는 **국가 Tier에 따라 자동 조정**된다.
기본 테이블은 S-Tier 기준. 다른 Tier는 배율 적용.

**S-Tier 기본 난이도 (Standard 5분 / Marathon 용)**

| 시간 | 웨이브 등급 | 적 수/웨이브 | 엘리트 확률 | 미니보스 |
|------|------------|------------|------------|---------|
| 0-1분 | 1 | 8-12체 | 5% | — |
| 1-2분 | 2 | 10-15체 | 10% | — |
| 2-3분 | 3 | 12-18체 | 15% | 1체 |
| 3-4분 | 4 | 15-22체 | 25% | — |
| 4-5분 | 5 | 18-25체 | 35% | 1체 |

**Marathon 장기 난이도 (5분 이후 PvE 구간)**

| 시간 | 웨이브 등급 | 적 수 배율 | 엘리트 확률 | 미니보스 |
|------|------------|-----------|------------|---------|
| 5-15분 | 3 | 1.3× | 15% | 2체/구간 |
| 15-30분 | 4 | 1.8× | 25% | 3체/구간 |
| 30-45분 | 5 | 2.5× | 40% | 4체/구간 |
| 45-55분 | 6 | 3.5× | 60% | 연속 |

**Tier별 스케일링 배율**

| 파라미터 | S-Tier | A-Tier | B-Tier | C-Tier | D-Tier |
|----------|--------|--------|--------|--------|--------|
| 적 수 배율 | 1.0× | 0.75× | 0.55× | 0.35× | 0.2× |
| 엘리트 기본확률 | 5% | 7% | 9% | 12% | 15% |
| 미니보스 주기 | 2분 | 1.5분 | 1.5분 | 1분 | 1분 |
| XP 보정 | 1.0× | 1.1× | 1.2× | 1.4× | 1.6× |
| PvP 아레나 반경 | 30m | 25m | 20m | 15m | 12m |

> D-Tier 국가(8명)는 적이 적지만 엘리트/미니보스 비율이 높아 소수 정예 전투.
> S-Tier 국가(50명)는 대규모 웨이브에서 팀워크가 중요한 혼전.

## 3. 라운드 구조

### Mode A: Standard Battle (5분) — 주요 모드

기존 CountryArena 배틀사이클과 **동일한 5분 타이밍**. 국가별 독립 실행.

```
00:00 ─── Deploy Phase (10초) — 아레나 스폰, 팩션 표시, Grace Period
00:10 ─── PvE Phase (3분 30초) — 적 웨이브, XP, 빌드 (Tome 선택 3~5회)
03:40 ─── PvP 경고 (10초 카운트다운)
03:50 ─── PvP Phase (60초) — 팩션 간 배틀로얄, 아레나 축소
04:50 ─── Settlement (10초) — 주권 판정, 팩션 점수, 보상 분배
05:00 ─── 배틀 종료 → 15초 쿨다운 → 다음 배틀 또는 국가 로테이션
```

**Standard에서의 빌드 전략**: 3분 30초 PvE에서 레벨 5~8 도달 (Tome 3~5개).
빌드 완성이 아닌 **핵심 시너지 1개 완성**이 목표.

### Mode B: Marathon (1시간) — 이벤트 모드

주말/특수 이벤트. 동일 국가에서 장기전. 모든 참가자는 빌드를 완전히 성장시킬 수 있다.

```
00:00 ─── 매치 시작, Grace Period 30초 (무적)
00:30 ─── PvE 웨이브 시작
05:00 ─── PvP #1 (60초) — 팩션전, 생존자 감소
06:00 ─── PvE 재개, 난이도 상승
10:00 ─── PvP #2 — 팩션전
...
50:00 ─── PvP #10
55:00 ─── 최종 결전 (5분) + 최종 보스
60:00 ─── 매치 종료, 챔피언 팩션 = 국가 주권 획득
```

### PvP Phase 규칙 (양 모드 공통)

- **팩션 기반**: PvP는 개인전이 아닌 **팩션 대 팩션** — 같은 팩션은 아군 (FF 없음)
- **아레나 크기**: 국가 Tier별 (S: 30m, A: 25m, B: 20m, C: 15m, D: 12m)
- **축소**: 60초 동안 아레나 반경 → 1/3로 수축
- **장외**: 아레나 밖 = 초당 5% max HP DOT
- **생존 보너스**: PvP 생존 시 팩션 점수 보너스 + XP
- **킬 보상**: PvP 킬 1회 = 피격자 XP의 20% 흡수 + 팩션 점수 +10
- **주권 방어 보너스**: 현재 주권 팩션은 PvP에서 점수 ×1.2 (기존 시스템 그대로)

### 주권 판정 (Settlement Phase)

기존 `DetermineWinningFaction` 로직 그대로 적용:

```
팩션_점수 = 킬수 × 10 + 생존시간(초) × 1 + PvE_기여(DPS%) × 50
현재_주권_팩션: 점수 × 1.2 (방어 보너스)
주권_이전_조건: 도전 팩션 점수 > 주권 팩션 × 1.2 (20% 초과 필요)
무소유 국가: 최소 3명 이상 에이전트 필요
```

### Marathon 최종 결전 (55:00~60:00)

- 남은 전원 소환 (Tier에 따라 통상 3~15명)
- **최종 보스 "The Arena"**: HP = `생존자 수 × 50,000`, 전체 화면 AOE 공격
- 보스 DPS 기여도 → 팩션 점수 추가
- **최다 점수 팩션 = 국가 주권** (개인 챔피언 + 팩션 주권 동시 판정)

### 탈락 후 경험

- **관전 모드**: 자유 카메라 + 생존자 시점 전환
- **채팅**: 관전자 전용 채널 + 이모트 반응
- **보상**: 생존 시간 + 킬 수 + 레벨 기반 보상은 탈락 시점에 확정
- **팩션 기여**: 탈락 후에도 PvE 중 쌓은 팩션 점수는 최종 판정에 반영

## 4. 이동 시스템 (3D 차별화)

기존 MCCamera의 물리 엔진을 3인칭 전투용으로 전환한다.
Arena의 3D 이동이 Vampire Survivors와 차별화되는 핵심 요소.
**국가 테마(terrain_bonus.go)와 Voronoi 바이옴(biome.go)이 이동에 직접 영향.**

### 기본 이동

| 액션 | 키 | 속도 | 설명 |
|------|-----|------|------|
| 걷기 | WASD | 5 m/s | 기본 이동, 지형 추종 |
| 달리기 | Shift+WASD | 8 m/s | 스태미나 소비 (2초/바) |
| 점프 | Space | 8 m/s 수직 | 공중 1회, 더블 점프(Tome) |
| 슬라이드 | Shift+Space | 12 m/s | 0.5초 전방 대시, 무적 0.2초, 쿨다운 3초 |

### 고급 이동

| 액션 | 조건 | 효과 |
|------|------|------|
| 벽 점프 | 공중 + 벽 접촉 | 벽 반대 방향 반동 점프 |
| 슬로프 부스트 | 내리막 슬라이드 | 속도 ×1.5 (경사각 비례) |
| 넉백 저항 | Shield Tome 3+ | 넉백 거리 50% 감소 |
| 에어 스트레이프 | 공중 WASD | 약한 방향 전환 (관성 보존) |

### 스태미나 시스템

```
최대 스태미나: 100
달리기 소비: 50/초
슬라이드 소비: 30/회
회복: 20/초 (비달리기 시)
Speed Tome: 최대 스태미나 +20/스택, 회복 +5/스택
```

### 국가 테마별 맵 & 전투 보정 (terrain_bonus.go 통합)

기존 6종 국가 테마의 전투 보정을 그대로 적용 + Arena 추가 효과:

| 국가 테마 | 적용 국가 | 복셀 맵 특성 | 기존 전투 보정 | Arena 추가 효과 |
|----------|----------|-------------|---------------|-------------------|
| **urban** | USA, CHN, KOR, DEU, FRA, ITA, ESP | 빌딩+도로+광장+지하도 | 원거리/대시 데미지 -30% | 건물 내부 은폐, 옥상 고지대 보너스, 좁은 골목 근접 유리 |
| **desert** | SAU, EGY, AUS, IRN, IRQ, ARE, DZA, MAR | 사구+오아시스+유적+모래벽 | 속도 -10%, 시야 +20% | 모래폭풍 이벤트(5초 시야 0), 오아시스 힐존, 유적 내 보물 |
| **mountain** | CHE, PAK, TUR, AUT, CHL, PER, ETH | 절벽+동굴+봉우리+협곡 | 속도 -15%, DPS +15% | 고지대 보너스 ×2, 낙하 데미지, 동굴 미니보스 은신처 |
| **forest** | BRA, THA, VNM, NGA, COL, MYS, COD | 밀림+강+나무+덩굴 | 피격 데미지 -20% | 은신 강화(적 어그로 -50%), 강 건너기 감속, 덩굴 트랩 |
| **arctic** | RUS, CAN, SWE, NOR, FIN | 설원+빙하+동굴+오로라 | 속도 -20%, 오브 밀도 -30% | 빙판 슬라이드 거리 ×2, 냉기 저항 필요, 동상 DOT |
| **island** | JPN, GBR, IDN, PHL, SGP, NZL, TWN | 해안+절벽+밀림+화산 | 아레나 축소속도 +50% | 수중 전투 가능, 해일 이벤트, 화산 용암 지형 |

### Voronoi 바이옴 (아레나 내 구역, biome.go 통합)

각 아레나 내부는 4-6개 Voronoi 구역으로 세분화:

| 바이옴 | 이동 보정 | 시야 보정 | 지형 높이 | 전투 특성 |
|--------|----------|----------|----------|----------|
| Plains | 1.0× | 1.0× | 낮음 | 중립, 오픈 필드 |
| Forest | 1.0× | 0.7× (-30%) | 중간 (언덕) | 은신, 근접 유리 |
| Desert | 0.85× (-15%) | 1.0× | 낮음 (사구) | 시야 좋음, 이동 불리 |
| Snow | 0.9× (-10%) | 1.0× | 높음 (고원) | 슬라이드 유리, 고지대 |
| Swamp | 0.7× (-30%) | 0.6× (-40%) | 매우 낮음 | 극 불리, 고보상 (XP ×1.5) |
| Volcanic | 0.8× (-20%) | 0.5× (-50%) | 높음 (화산) | DOT 지형, 고보상 (XP ×2) |

> 국가 테마는 맵 전체 외형과 글로벌 보정, 바이옴은 맵 내 구역별 국지적 효과.
> 예) RUS(arctic) 맵에서 Snow 바이옴 구역 = 속도 -20%(테마) × 0.9(바이옴) = -28%

### 카메라 모드

- **기본**: 3인칭 후방 (캐릭터 뒤 5m, 위 3m)
- **전투 중**: 약간 줌아웃 (7m) — 시야 확보
- **PvP 진입**: 카메라 트랜지션 → 아레나 오버뷰 → 3인칭 복귀
- **관전**: 자유 카메라 (WASD+마우스) 또는 선수 추적

## 5. 전투 시스템

### 자동 공격 원리

캐릭터는 **장착 무기의 사거리 내** 가장 가까운 적을 자동으로 공격한다.
플레이어 조작은 **이동과 슬라이드/점프**에 집중하며, 공격은 완전 자동.

```
공격 주기 = 무기_기본_속도 / (1 + Attack_Speed_Tome × 0.1)
최종 데미지 = 무기_기본_데미지 × (1 + Damage_Tome × 0.15) × 크리티컬_배율 × 속성_상성
```

### 타격 판정

- **히트박스**: 무기 유형별 (근접=원뿔 60°, 원거리=레이캐스트, AOE=구체)
- **관통**: 일부 무기는 적 관통 (Projectile Pierce Tome으로 강화)
- **투사체**: 원거리 무기는 물리 시뮬레이션 (포물선, 중력 영향)
- **AOE**: 폭발/마법 무기는 범위 내 모든 적 히트 (범위 Tome 강화)

### 데미지 타입 (5종)

| 타입 | 아이콘 | 강점 | 약점 |
|------|--------|------|------|
| 물리 (Physical) | ⚔️ | 갑옷 없는 적 | 중갑 적 |
| 화염 (Fire) | 🔥 | 얼음 적, DOT 스택 | 물 지형, 화염 저항 |
| 냉기 (Frost) | ❄️ | 화염 적, 감속 | 얼음 면역 |
| 번개 (Lightning) | ⚡ | 물 지형 (범위 확대), 체인 | 접지 적 |
| 독 (Poison) | ☠️ | 장기전, 힐 감소 | 언데드, 기계 |

### 상태 이상 (Status Effects)

| 상태 | 지속 | 효과 | 스택 |
|------|------|------|------|
| 화상 (Burn) | 3초 | 0.5%/초 max HP DOT | 최대 5 (DOT 중첩) |
| 냉동 (Freeze) | 2초 | 이동속도 -50%, 3스택 시 1초 빙결 | 최대 3 |
| 감전 (Shock) | 1초 | 다음 피격 데미지 +30% | 최대 1 |
| 독 (Poison) | 5초 | 1%/초 max HP DOT + 힐 -50% | 최대 3 |
| 출혈 (Bleed) | 4초 | 이동 시 0.3%/초 max HP DOT | 최대 5 |
| 표식 (Blood Mark) | 10초 | 피격 데미지 +15% | 최대 1 |

### 크리티컬 시스템

Arena의 핵심 메카닉 — **오버크리티컬** 채택:

```
크리티컬 확률 기본: 5%
크리티컬 확률 = 기본 + (Crit_Chance_Tome × 8%)

크리티컬 발동 판정 (확률 > 100% 시 오버크리티컬):
  crit_count = floor(crit_chance / 100)  // 보장된 크리티컬 횟수
  remainder = crit_chance % 100
  if random(100) < remainder: crit_count += 1

크리티컬 배율:
  crit_count == 0: 1.0× (일반)
  crit_count == 1: 2.0×
  crit_count >= 2: (crit_count × 0.5)² + crit_count
    예) 2크리: 2.0, 3크리: 5.25, 4크리: 8.0, 5크리: 11.25
```

이 시스템은 크리티컬 확률을 100% 이상 쌓는 빌드에 지수적 보상을 제공한다.

## 6. 무기 시스템 (16종 Phase 1)

무기는 레벨업 시 선택하거나 필드 드롭으로 획득. 최대 **6개 동시 장착**.
각 무기는 독립적으로 자동 발사하며, Tome 스탯이 전역으로 적용됨.

### 티어 분류

| 티어 | 무기 | 유형 | 데미지 타입 | 기본 DPS | 사거리 |
|------|------|------|-----------|---------|--------|
| **S** | Sniper Rifle | 원거리 단일 | 물리 | 120 | 30m |
| **S** | Lightning Staff | 원거리 체인 | 번개 | 95 | 15m, 체인 3회 |
| **S** | Bow | 원거리 단일 | 물리 | 80 | 25m, 속사 |
| **S** | Revolver | 원거리 단일 | 물리 | 100 | 20m |
| **A** | Katana | 근접 관통 | 물리 | 90 | 3m, 전방 관통 |
| **A** | Fire Staff | 원거리 AOE | 화염 | 70 | 12m, 반경 4m |
| **A** | Aegis | 근접 방어 | 물리 | 40 | 2m, 블록 시 반사 |
| **A** | Wireless Dagger | 자동 유도 | 물리 | 65 | 10m, 자동 추적 |
| **A** | Black Hole | 유틸 AOE | — | 0 | 8m, 흡인 3초 |
| **B** | Axe | 근접 범위 | 물리 | 75 | 3m, 360° |
| **B** | Frostwalker | 이동 AOE | 냉기 | 50 | 이동 경로 5m |
| **B** | Flamewalker | 이동 AOE | 화염 | 55 | 이동 경로 5m |
| **B** | Poison Flask | 투척 DOT | 독 | 45 | 10m, 웅덩이 5초 |
| **B** | Landmine | 설치 트랩 | 물리 | 200 (단발) | 설치, 반경 3m |
| **B** | Shotgun | 원거리 산탄 | 물리 | 85 | 8m, 부채꼴 |
| **B** | Dice | 랜덤 | 랜덤 | 0~300 | 10m, 매 발사 랜덤 |

### 무기 업그레이드 (Weapon Level)

각 무기는 레벨업 시 선택으로 강화 가능 (최대 Lv.7):

```
Lv.1: 기본 스탯
Lv.2: 데미지 +20%
Lv.3: 공격속도 +15%
Lv.4: 사거리 +2m 또는 범위 +1m
Lv.5: 특수 효과 활성화 (무기별 고유)
Lv.6: 데미지 +30%
Lv.7 (진화): 무기 변환 — 특정 Tome 조합 시 상위 무기로 진화
```

### 무기 진화 예시

| 원본 무기 | 필요 Tome | 진화 무기 | 특수 효과 |
|----------|----------|----------|----------|
| Bow Lv.7 | Speed ×3 | Storm Bow | 화살에 체인 라이트닝 부여 |
| Katana Lv.7 | Crit ×3 | Dexecutioner | 처형 (30% HP 이하 즉사) |
| Fire Staff Lv.7 | Area ×3 | Inferno | 화면 전체 화염 폭풍 |
| Shotgun Lv.7 | Knockback ×3 | Dragon Breath | 연속 화염 방사 |
| Poison Flask Lv.7 | Curse ×2 | Pandemic | 적 간 독 전염 |

## 7. 토메(Tome) 시스템 — 패시브 스탯 북

Tome은 레벨업 시 3개 중 1개를 선택하는 **패시브 글로벌 스탯 업그레이드**.
무기와 달리 모든 무기/캐릭터에 영향을 미치며, 스택으로 누적된다.

### 핵심 Tome (16종)

| Tome | 스택당 효과 | 최대 | 태그 |
|------|-----------|------|------|
| **Damage** | 전체 데미지 +15% | 10 | 공격 |
| **Attack Speed** | 공격속도 +10% | 10 | 공격 |
| **Crit Chance** | 크리티컬 확률 +8% | 15 | 공격 |
| **Crit Damage** | 크리티컬 배율 +20% | 10 | 공격 |
| **Area** | AOE 범위 +12% | 10 | 공격 |
| **Projectile** | 투사체 수 +1, 관통 +1 | 5 | 공격 |
| **Speed** | 이동속도 +8%, 스태미나 +20 | 10 | 이동 |
| **HP** | 최대 HP +10%, HP 재생 +1/초 | 10 | 방어 |
| **Shield** | 10초마다 1회 피격 무효화 | 5 | 방어 |
| **Thorns** | 피격 시 공격자에게 반사 15% | 5 | 방어 |
| **Knockback** | 공격 넉백 +20%, 넉백 저항 +10% | 5 | 유틸 |
| **XP** | XP 획득량 +15% | 10 | 성장 |
| **Luck** | 레어 Tome/아이템 확률 +10% | 10 | 성장 |
| **Magnet** | XP 수집 범위 +1m (기본 2m) | 10 | 성장 |
| **Dodge** | 회피 확률 +5% | 10 | 방어 |
| **Cursed** | 적 수 +15%, 적 HP +10%, XP +25% | 5 | 리스크 |

### 희귀도 시스템

레벨업 시 표시되는 3개 Tome의 희귀도:

| 희귀도 | 확률 (기본) | 효과 배율 | Luck 보정 |
|--------|-----------|----------|----------|
| Common (흰) | 50% | 1.0× | — |
| Uncommon (초록) | 30% | 1.3× | +3%/Luck |
| Rare (파랑) | 15% | 1.7× | +5%/Luck |
| Epic (보라) | 4% | 2.2× | +3%/Luck |
| Legendary (금) | 1% | 3.0× | +2%/Luck |

**Legendary Tome 예**: Damage Legendary = +15% × 3.0 = +45% 데미지 (1스택으로)

### "Holy Trinity" 빌드

커뮤니티 검증 메타: **XP + Luck + Cursed** 조합

```
XP Tome ×5:  XP +75% → 빠른 레벨업 → 더 많은 Tome 선택
Luck ×5:     레어/에픽 확률 대폭 증가 → 강한 Tome 획득
Cursed ×3:   적 +45%, HP +30%, XP +75% → XP Tome과 시너지

총 XP 배율: 1.75 × 1.75 = 3.06× (일반 대비 3배 빠른 성장)
대신 적 체감 난이도 ~1.7배 → 충분한 방어 Tome이 전제
```

### Diminishing Returns (체감 수익)

특정 Tome은 과도한 스택에 체감 수익을 적용:

```
효과(n) = 기본_효과 × n^0.85  (n ≥ 5일 때)
예) Damage Tome 10스택:
  선형: 150% → 실제: 15% × 10^0.85 = 106%
```

이로써 "하나만 올인" 전략보다 분산 빌드가 유리하도록 유도.

## 8. 아이템 시스템 — 필드 드롭

아이템은 엘리트/미니보스 처치 시 필드에 드롭되는 **즉시 효과 또는 장비**.
Tome과 달리 레벨업과 무관하며, 직접 수집해야 한다.

### 아이템 카테고리

#### 즉시 사용 (수집 즉시 효과)

| 아이템 | 효과 | 드롭 확률 |
|--------|------|----------|
| Health Orb (소) | HP +10% | 30% (일반 적) |
| Health Orb (대) | HP +30% | 10% (엘리트) |
| XP Magnet | 화면 내 모든 XP 즉시 수집 | 5% (엘리트) |
| Speed Boost | 15초간 이동속도 ×2 | 8% |
| Shield Burst | 5초간 무적 | 3% (미니보스) |
| Bomb | 반경 10m 적 전체 HP 25% 데미지 | 5% |

#### 장비 아이템 (최대 3개 장착)

| 아이템 | 등급 | 효과 | 드롭처 |
|--------|------|------|--------|
| Iron Boots | Common | 넉백 저항 +30% | 엘리트 |
| Feather Cape | Uncommon | 더블 점프 활성화 | 엘리트 |
| Vampire Ring | Rare | 데미지의 3% 흡혈 | 미니보스 |
| Berserker Helm | Rare | HP 50% 이하 시 데미지 +40% | 미니보스 |
| Crown of Thorns | Epic | 피격 시 반사 25% + 1초 무적 | 미니보스 |
| Magnet Amulet | Uncommon | XP 수집 범위 +5m | 엘리트 |
| Glass Cannon | Epic | 데미지 +60%, 받는 데미지 +40% | 미니보스 |
| Frozen Heart | Rare | 피격 시 30% 확률로 주변 적 냉동 | 미니보스 |
| Lucky Clover | Uncommon | Luck +3 (Tome 3스택 상당) | 엘리트 |
| Titan Belt | Epic | HP +30%, 크기 +20%, 넉백 면역 | 보스 |

### 아이템 드롭 테이블

```
일반 적: 90% 없음, 8% Health Orb(소), 2% XP Crystal(소)
엘리트: 40% 없음, 25% Health Orb(대), 15% 즉시사용, 15% Common장비, 5% Uncommon장비
미니보스: 100% 드롭 — 30% Uncommon, 50% Rare, 15% Epic, 5% Legendary
최종보스: 100% Legendary 장비 1개 + Epic 장비 2개
```

### PvP 드롭

PvP에서 플레이어를 처치하면:
- 피격자의 **장비 아이템 1개** 랜덤 드롭 (필드에 남음)
- 피격자의 XP 20% 를 킬러가 흡수
- Tome은 드롭되지 않음 (영구 귀속)

## 9. 캐릭터 시스템 (8종 Phase 1)

각 캐릭터는 **고유 패시브**, **시작 무기**, **기본 스탯 편향**을 가진다.
Phase 1에서 8종 출시, 이후 시즌마다 추가.

### Phase 1 캐릭터 (8종)

| 캐릭터 | 패시브 | 시작 무기 | 스탯 편향 | 최적 빌드 |
|--------|--------|----------|----------|----------|
| **Striker** | 5킬마다 공속 +5% (영구) | Katana | 물리 DPS | 크리티컬 스택 |
| **Guardian** | 피격 시 2초간 방어 +20% | Aegis | 탱커 | Shield + Thorns |
| **Pyro** | 화염 데미지 +25%, 화상 지속 +1초 | Fire Staff | 화염 DOT | Area + Curse |
| **Frost Mage** | 냉기 적중 시 20% 확률 즉시 빙결 | Frostwalker | 냉기 CC | Freeze Lock |
| **Sniper** | 원거리 데미지 +20%, 사거리 +5m | Sniper Rifle | 원거리 | Crit + Damage |
| **Gambler** | 레벨업 시 4개 선택지 (기본 3) | Dice | 럭 기반 | Luck + XP |
| **Berserker** | HP 50% 이하 시 모든 데미지 +35% | Axe | 위험 DPS | Glass Cannon |
| **Shadow** | 슬라이드 후 2초간 투명 (적 타겟 불가) | Wireless Dagger | 기동 | Speed + Dodge |

### 캐릭터 성장

캐릭터 레벨은 **매치 내 한정** (메타 프로그레션과 별도):

```
레벨업 필요 XP = 50 + (현재레벨 × 30)
레벨 1→2: 80 XP
레벨 5→6: 200 XP
레벨 10→11: 350 XP
레벨 20→21: 650 XP

레벨업 보상: Tome 3개 중 1개 선택 (희귀도 = Luck 영향)
매 5레벨: 무기 1개 추가 선택 (새 무기 or 기존 무기 업그레이드)
매 10레벨: "Ultra Tome" 선택 가능 (일반 Tome 2스택 상당)
```

### 캐릭터 잠금 해제

| 캐릭터 | 잠금 해제 조건 |
|--------|---------------|
| Striker | 기본 해제 |
| Guardian | 기본 해제 |
| Pyro | 매치 누적 10분 생존 |
| Frost Mage | 단일 매치 PvP 3킬 |
| Sniper | 엘리트 50체 처치 |
| Gambler | Legendary Tome 획득 |
| Berserker | HP 10% 이하로 30초 생존 |
| Shadow | 슬라이드로 적 5체 회피 (1매치) |

## 10. 적 / AI 에이전트 시스템

### PvE 적 종류

#### 일반 몹 (5종)

| 이름 | HP | 데미지 | 속도 | 특성 |
|------|-----|--------|------|------|
| Zombie | 100 | 10 | 2 m/s | 직선 추적, 무리 |
| Skeleton | 80 | 15 | 3 m/s | 원거리 화살 (8m) |
| Slime | 150 | 8 | 1.5 m/s | 분열 (소형 2마리) |
| Spider | 60 | 12 | 5 m/s | 빠른 접근, 벽 타기 |
| Creeper | 120 | 80 (자폭) | 2.5 m/s | 근접 시 3초 후 자폭 AOE |

#### 엘리트 (일반 몹 강화판)

```
엘리트 스탯 = 일반 × 3.0
엘리트 확률 = 5% + (라운드 × 2%)
엘리트 접두사 (랜덤 1개):
  - Armored: 방어력 +50%
  - Swift: 속도 ×2
  - Vampiric: 공격 시 HP 흡수
  - Explosive: 사망 시 자폭 AOE
  - Shielded: 3초마다 1회 피격 무효화
```

#### 미니보스 (매 2분, PvE Phase)

| 이름 | HP | 패턴 | 등장 시점 |
|------|-----|------|---------|
| Golem | 5,000 × 라운드 | 지면 강타 AOE + 돌 투척 | 라운드 1+ |
| Wraith | 3,000 × 라운드 | 텔레포트 + 생명력 흡수 | 라운드 3+ |
| Dragon Whelp | 8,000 × 라운드 | 비행 + 화염 브레스 원뿔 | 라운드 5+ |
| Lich King | 10,000 × 라운드 | 소환 + 범위 냉기 | 라운드 7+ |
| The Arena | 50,000 × 생존자수 | 전체화면 AOE + 무적 페이즈 | 최종 결전 |

### AI 에이전트 시스템 — 기존 NationalAI 확장

빈 슬롯은 **기존 NationalAI 4-Layer 계층구조의 Tactical/Reflexive 레이어를 확장한 AI**가 채운다.
새로운 AI를 만드는 것이 아니라, 기존 `server/internal/game/ai_*.go` + `world/national_ai.go`의 전투 로직을 Arena 메카닉에 맞게 확장.

#### NationalAI 계층과 Arena 전투 AI 매핑

```
기존 NationalAI 4-Layer:
  Grand Strategy (24h) → 국가 간 외교/자원 배분 (변경 없음)
  Operational (1h)     → 국가 운영/병력 배치 (변경 없음)
  Tactical (10min)     → ★ 전투 진입 결정, 빌드 선택, 팩션 협력
  Reflexive (50ms)     → ★ 실시간 전투 행동 (이동/회피/타겟팅)

Arena 확장:
  Tactical Layer 확장 (ar_ai_tactical.go):
    - 입장할 국가 아레나 선택 (주권 가치 + 승률 예측)
    - 빌드 프로필 선택 (국가 테마/바이옴에 최적화)
    - PvP Phase 진입 판단 (팩션 이익 기반)
    - 팩션 동맹 플레이어와 협력 전략

  Reflexive Layer 확장 (ar_ai_reflexive.go):
    - 실시간 이동/회피/타겟팅 (기존 Reflexive 인터페이스 확장)
    - Arena 고유 행동: 슬라이드 회피, 고지대 활용, XP 수집 최적화
    - PvP에서 팩션 아군 보호, 적 팩션 우선 타겟팅
```

#### Reflexive Layer 행동 트리 (전투 중 50ms 주기)

```
Root (Selector)
├── [조건] HP < 30% → Flee (가장 먼 안전지대로 이동)
├── [조건] PvP Phase → PvP_AI
│   ├── 적 팩션 플레이어 타겟팅 (팩션 점수 높은 적 우선)
│   ├── 아군 팩션과 포메이션 유지
│   ├── 슬라이드 회피 (주기적)
│   └── 아레나 축소 시 중앙 유지
├── [조건] 엘리트/보스 근처 → Boss_AI
│   ├── 안전 거리 유지 (보스 사거리 +2m)
│   ├── AOE 회피 (빨간 영역 벗어나기)
│   └── 보스 우선 공격
└── [기본] PvE_AI
    ├── 적 밀집 지역으로 이동 (효율적 파밍)
    ├── XP 크리스탈 수집 경로 최적화
    ├── 국가 바이옴 보정 활용 (유리한 지형 선점)
    └── 고지대 선점 (terrain_bonus 활용)
```

#### Tactical Layer 빌드 전략 (전투 진입 시 1회 결정)

AI의 빌드 프로필은 **Tactical Layer가 국가 상황에 맞춰 선택**:

| 프로필 | 전략 | Tome 우선순위 | 선택 조건 |
|--------|------|-------------|----------|
| DPS Rush | 공격 올인 | Damage > Crit > Speed | 주권 쟁탈전, PvP 비중 높은 아레나 |
| Tank Wall | 생존 올인 | HP > Shield > Thorns | 수비 측 (현재 주권 보유) |
| XP Farmer | 빠른 성장 | XP > Luck > Curse | 저위험 국가, 경험치 축적 목적 |
| Balanced | 균형 | Damage > HP > Speed | 기본값, 상황 불명확 시 |
| Glass Cannon | 극 공격 | Damage > Crit > Glass Cannon | 소국(D-tier), 빠른 결전 예상 |

#### 에이전트 난이도 (국가 Tier 연동)

| 등급 | 매칭 Tier | 행동 | PvP 능력 |
|------|----------|------|---------|
| Easy | D-Tier 기본 | 직선 이동, 빌드 랜덤 | 가만히 서서 공격 |
| Normal | C/D-Tier | 기본 회피, 빌드 프로필 | 약한 적 타겟팅 |
| Hard | B/A-Tier | AOE 회피, 최적 빌드 | 슬라이드 회피 + 추적 |
| Master | S-Tier | 완벽 회피, 메타 빌드 | 프로급 움직임 |

> S-Tier 국가(미국/중국 등)에서는 Master급 AI가 다수 등장하여 경쟁 강도가 높아짐.
> D-Tier 소국에서는 Easy/Normal AI로 입문자 친화적 환경 제공.

#### OperatorRegistry 연동

v17의 OperatorRegistry를 통해 **외부 AI 오퍼레이터도 Arena 전투에 참여** 가능:

```
OperatorRegistry.RegisterCombatOperator(countryISO3, operatorConfig)
  → 해당 국가 아레나에 오퍼레이터 AI 슬롯 할당
  → Tactical/Reflexive Layer를 오퍼레이터 커스텀 로직으로 대체
  → API: POST /api/v1/operators/{id}/combat-action (50ms 주기 폴링)
```

## 11. 데미지 수식 체계

### 최종 데미지 계산

```
최종_데미지 = 무기_기본_데미지
  × (1 + Damage_Tome_효과)
  × (1 + 캐릭터_패시브_보너스)
  × 크리티컬_배율
  × 속성_상성_배율
  × (1 + 장비_보너스)
  - 적_방어력
```

### 크리티컬 배율 공식 (상세)

```python
def calc_crit_multiplier(crit_chance: float, crit_damage_bonus: float) -> float:
    """
    crit_chance: 0~∞ (100 = 100%)
    crit_damage_bonus: Crit Damage Tome 효과 (0.2 per stack)
    """
    base_crit_mult = 2.0 + crit_damage_bonus

    # 보장된 크리티컬 횟수
    guaranteed = int(crit_chance // 100)
    remainder = crit_chance % 100

    # 잔여 확률로 추가 크리티컬
    extra = 1 if random.random() * 100 < remainder else 0
    crit_count = guaranteed + extra

    if crit_count == 0:
        return 1.0
    elif crit_count == 1:
        return base_crit_mult
    else:
        # 오버크리티컬: 지수적 스케일링
        return (crit_count * 0.5) ** 2 + crit_count * (base_crit_mult - 1)
```

### 속성 상성 배율

| 공격\방어 | 물리 | 화염 | 냉기 | 번개 | 독 |
|-----------|------|------|------|------|-----|
| 물리 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |
| 화염 | 1.0 | 0.5 | 1.5 | 1.0 | 1.2 |
| 냉기 | 1.0 | 1.5 | 0.5 | 0.8 | 1.0 |
| 번개 | 1.0 | 0.8 | 1.2 | 0.5 | 1.5 |
| 독 | 1.0 | 1.0 | 1.0 | 1.5 | 0.5 |

### 방어력 감소 공식

```
실효_데미지 = 최종_데미지 × (100 / (100 + 적_방어력))

예) 데미지 1000, 방어력 50:
  1000 × (100/150) = 666.7
```

### DPS 계산

```
DPS = (기본_데미지 × Tome_배율 × 평균_크리티컬) / 공격_주기

평균_크리티컬 = (1 - crit_chance_실효) × 1.0 + crit_chance_실효 × 크리티컬_배율
공격_주기 = 무기_기본_속도 / (1 + Attack_Speed × 0.1)
```

### 적 HP 스케일링

```
적_HP(라운드, 시간분) = 기본_HP × (1 + 라운드 × 0.3) × (1 + 시간분 × 0.02)
적_데미지(라운드) = 기본_데미지 × (1 + 라운드 × 0.2)
적_수(라운드) = 기본_수 × (1 + 라운드 × 0.15) × Cursed_배율
```

## 12. 시너지 & 빌드 메타

### 시너지 트리거 시스템

특정 Tome + 무기 + 아이템 조합이 **시너지 보너스**를 활성화한다.
시너지는 개별 효과 합산 이상의 폭발적 상승을 제공.

### 기본 시너지 (10종)

| 시너지 | 조건 | 보너스 효과 |
|--------|------|-----------|
| **Infernal** | Fire 무기 + Damage ×3 + Area ×2 | 화염 데미지 +50%, 화상이 주변 적 전염 |
| **Blizzard** | Frost 무기 + Speed ×3 + Area ×2 | 이동 경로에 냉기장 생성, 범위 빙결 |
| **Thunder God** | Lightning 무기 + Crit ×3 + Attack Speed ×3 | 크리티컬 시 체인 라이트닝 자동 발사 |
| **Plague Doctor** | Poison 무기 + Curse ×2 + HP ×3 | 독 데미지 ×2, 독 적 처치 시 HP 5% 회복 |
| **Juggernaut** | Shield ×3 + HP ×3 + Thorns ×3 | 피격 무효화 시 주변 충격파, 반사 50% |
| **Glass Cannon** | Damage ×5 + Crit ×5 + HP ×0 | 데미지 ×2, HP 1로 고정 (즉사 위험) |
| **Speed Demon** | Speed ×5 + Dodge ×5 | 이동속도 비례 데미지 보너스, 잔상 생성 |
| **Holy Trinity** | XP ×5 + Luck ×5 + Cursed ×3 | XP ×3배, 레벨업마다 Legendary 확률 +5% |
| **Vampire Lord** | Crit ×3 + Vampire Ring + Berserker Helm | 크리티컬 흡혈, HP 50% 이하 시 흡혈 ×3 |
| **Fortress** | Aegis + Shield ×3 + Thorns ×2 + Guardian | 360° 실드, 블록 성공 시 2초 무적 |

### 빌드 아키타입

#### 1. DPS 빌드 (딜러)
```
핵심: Damage + Crit Chance + Crit Damage + Attack Speed
추천 캐릭터: Striker, Sniper
추천 무기: Sniper Rifle, Lightning Staff, Katana
목표: 오버크리티컬로 보스/PvP 원킬
약점: 생존력 부족, CC에 취약
```

#### 2. 탱커 빌드 (생존)
```
핵심: HP + Shield + Thorns + Dodge
추천 캐릭터: Guardian, Berserker
추천 무기: Aegis, Axe
목표: 오래 살아남아 XP 누적, PvP에서 소모전 승리
약점: 클리어 속도 느림
```

#### 3. 성장 빌드 (팜)
```
핵심: XP + Luck + Cursed + Magnet
추천 캐릭터: Gambler
추천 무기: 아무거나 (빠른 클리어용)
목표: 초반 빠른 레벨링 → 후반 전환
약점: 중반 위험 구간 (Curse 효과 선행)
```

#### 4. CC 빌드 (제어)
```
핵심: Frost/Poison 무기 + Area + Knockback
추천 캐릭터: Frost Mage, Shadow
추천 무기: Frostwalker, Poison Flask, Black Hole
목표: 적 무력화 + 안전 파밍, PvP에서 도주 불가 상태
약점: 단일 대상 DPS 부족
```

### 빌드 전환 타이밍

```
초반 (0-15분): 기본 무기 강화 + XP/Luck Tome 우선
중반 (15-35분): 핵심 시너지 완성 + 방어 Tome 추가
후반 (35-55분): 무기 진화 + 장비 최적화
최종전 (55-60분): 빌드 완성 상태로 PvP + 보스전
```

## 13. PvP 아레나 (5분마다)

### 아레나 진입

```
PvE 타이머 5:00 도달
  → 3초 경고 ("PvP Arena in 3...")
  → 모든 생존자 텔레포트 → 원형 아레나 (별도 맵)
  → 5초 Grace Period (무적, 위치 확인)
  → 60초 배틀로얄
  → 생존자 PvE 맵 복귀
```

### 아레나 맵 구조

- **형태**: 원형 플랫폼 (반경 30m), 복셀 터레인
- **지형 변형**: 라운드마다 다른 지형 (평지, 다층, 미로, 용암)
- **축소**: 60초 동안 30m → 10m (벽이 안으로 이동)
- **장외 데미지**: 벽 밖 = 초당 5% max HP

### PvP 전용 규칙

| 규칙 | 값 | 이유 |
|------|-----|------|
| 데미지 스케일링 | PvE 대비 40% | 빌드 차이 완화, 즉사 방지 |
| 최대 단일 피격 | max HP의 30% | 오버크리티컬 즉사 방지 |
| CC 지속시간 | PvE 대비 50% | 영구 CC 락 방지 |
| 힐/흡혈 | PvE 대비 50% | 무한 탱킹 방지 |
| 쿨다운 리셋 | PvP 진입 시 전체 리셋 | 공정한 시작 |

### 아레나 보상

| 결과 | 보상 |
|------|------|
| 생존 | 50 × 라운드번호 보너스 XP |
| 1킬 | 피격자 XP의 20% 흡수 |
| 연속 3킬 | "Rampage" — Epic Tome 즉시 획득 |
| 최다 킬 | "Ace" 칭호 + Rare 장비 드롭 |
| 최후 1인 (최종전) | 챔피언 보상 (메타 프로그레션) |

### PvP 매칭 밸런스

PvP 아레나 내 밸런스를 위한 추가 장치:

- **적응형 HP**: PvP 진입 시 모든 참가자 HP를 `평균_HP × 1.2`로 정규화
- **장비 비활성화 옵션**: 호스트 설정으로 장비 효과 PvP 비활성화 가능
- **부활 토큰**: 최초 1회 부활 가능 (HP 30%로 복귀, 2초 무적)

## 14. 메타 프로그레션 & 경제 — 기존 $AWW 토큰 시스템 연동

### 이중 경제 구조

Arena Combat는 기존 AI World War의 **듀얼 토큰 경제($AWW + 195개 국가 토큰)**와 완전히 통합된다.
별도의 "코인" 경제를 만들지 않고, 기존 토큰 시스템의 사용처를 확장.

```
기존 토큰 체계 (v11):
  $AWW (마스터 토큰) — 플랫폼 전체 거버넌스 + 프리미엄 구매
  $KOR, $USA, ... (195개 국가 토큰) — 국가별 주권/경제 활동

Arena 연동:
  전투 보상 → 해당 국가 토큰으로 지급 (예: 한국 아레나 → $KOR)
  프리미엄 구매 (스킨/시즌패스) → $AWW로 결제
  영구 부스트 구매 → 해당 국가 토큰 소각 (디플레이션 메커니즘)
  주권 획득 보상 → $AWW 추가 보상 (주권 보유 국가 방어 성공 시)
```

### 매치 외 프로그레션

매치 결과에 따라 영구적으로 누적되는 진행도.

#### 플레이어 프로필 레벨

```
프로필 XP = 생존시간(분) × 10 + 킬수 × 20 + 매치레벨 × 5 + 순위보너스
            + 주권기여보너스 (팩션 승리 시 ×1.5)
프로필 레벨업 보상:
  매 레벨: 해당 국가 토큰 100
  매 5레벨: 캐릭터 스킨 or 이펙트
  매 10레벨: 새 캐릭터 or 무기 잠금해제
```

#### 토큰 보상 구조

| 보상 소스 | 지급 토큰 | 규모 | 비고 |
|----------|----------|------|------|
| PvE 생존 보상 | 국가 토큰 | 생존시간 × 10 | 한국 아레나 → $KOR |
| PvP 킬 보상 | 국가 토큰 | 킬당 50 | 적 팩션 킬 시 ×2 |
| 주권 수호 보너스 | $AWW | 200 | 방어 측 팩션 승리 시 |
| 주권 탈환 보너스 | $AWW | 500 | 공격 측 팩션 주권 변경 성공 시 |
| 시즌 최종 순위 | $AWW | 순위별 차등 | 시즌 종료 정산 |

#### 토큰 사용처

| 사용처 | 결제 토큰 | 비용 | 효과 |
|--------|----------|------|------|
| 영구 스탯 부스트 | 국가 토큰 (소각) | 500 | 특정 Tome 시작 효과 +5% (영구) |
| 캐릭터 잠금해제 | $AWW | 1,000 | 조건 대체 해제 |
| 무기 잠금해제 | 국가 토큰 | 800 | 새 무기 시작 선택지 추가 |
| 스킨 구매 | $AWW | 200~2,000 | 코스메틱 |
| 이모트 구매 | 국가 토큰 | 300 | PvP/관전 중 사용 |
| 시즌 패스 | $AWW | 3,000 | 프리미엄 트랙 잠금해제 |

> **디플레이션 메커니즘**: 영구 부스트 구매 시 국가 토큰이 **소각**되어 해당 국가 토큰의 가치 상승.
> 주권 가치가 높은 S-Tier 국가에서 많은 전투가 발생 → 국가 토큰 발행량 증가 → 부스트 구매로 소각 → 경제 순환.

#### 퀘스트 시스템 (240개)

| 카테고리 | 예시 | 보상 |
|----------|------|------|
| 처치 | "좀비 1,000마리 처치" | 국가 토큰 200 + 칭호 |
| 생존 | "Standard Battle 10회 생존" | 스킨 |
| 빌드 | "시너지 5종 달성" | 무기 해제 |
| PvP | "PvP 3회 연속 생존" | 캐릭터 해제 |
| 주권 | "3개 국가 주권 탈환 기여" | $AWW 500 |
| 탐험 | "6개 테마 국가 전투 참가" | 이모트 |
| 도전 | "AFK 모드 5분 Standard 생존" | Legendary 스킨 |

#### 시즌 패스 — 기존 4주 4Era 시스템 연동

```
시즌 = AI World War의 기존 4주 시즌 (Discovery→Expansion→Empires→Reckoning)
시즌 패스: $AWW로 구매 (프리미엄 트랙)

무료 트랙: 30단계 — 국가 토큰, 기본 스킨, 이모트
프리미엄 트랙: 30단계 — Legendary 스킨, 특수 효과, 시즌 캐릭터

시즌 챌린지: 주간/일간 미션으로 패스 XP 획득
Era별 특수 미션: 각 Era 테마에 맞는 한정 도전과제
```

### 경제 밸런스

```
매치당 평균 국가 토큰 수입 (Standard 5분 기준):
  - 조기 탈락: ~80
  - 중위 생존: ~200
  - 주권 판정 기여: ~350 + 주권 보너스($AWW 200~500)

토큰 싱크:
  - 영구 부스트: 국가 토큰 소각 (무제한 스택, 체감 수익)
  - 코스메틱: $AWW 소비 (주 싱크)
  - 시즌 패스: $AWW 일괄 소비

인플레이션 방지:
  - 영구 부스트에 체감 수익 적용: 효과(n) = 기본 × n^0.7
  - 국가 토큰 일일 획득 상한: Tier별 차등 (S:5000, A:3500, B:2500, C:1500, D:800)
  - $AWW 획득은 주권 이벤트에만 연동 (무한 파밍 방지)
```

## 15. 기술 아키텍처

### 서버 아키텍처 — 기존 모듈 확장

**별도 `arena/` 패키지를 만들지 않는다.** 기존 `game/` + `world/` 패키지를 확장한다.
핵심: Arena 전투 로직이 기존 `Room`의 게임 루프를 대체/확장.

```
┌──────────────────────────────────────────────────┐
│  Go WebSocket Server (20Hz tick)                 │
│                                                  │
│  WorldManager (v11, 195국)                       │
│   └── CountryArena (world/) ← 주권/팩션 추적     │
│        └── Room (game/) ← 게임 루프              │
│             └── ★ ArenaCombat (NEW)           │
│                  ├── PvE Phase (웨이브+빌드)      │
│                  ├── PvP Phase (팩션전+축소)      │
│                  └── CombatEngine (데미지+크리티컬)│
│                                                  │
│  CountryArenaManager (v14, game/)                │
│   └── 플레이어 라우팅, 큐, 50인 캡 ← 유지       │
│                                                  │
│  기존 terrain_bonus.go, biome.go ← 그대로 활용   │
│  기존 NationalAI (v16/v17) ← Reflexive 레이어 확장│
└──────────────────────────────────────────────────┘
```

### 서버 모듈 구조 (기존 확장)

```
server/internal/
├── game/                        (기존 패키지 확장)
│   ├── country_arena.go         ← 유지 (CountryArenaManager)
│   ├── room_manager.go          ← 유지 (RoomManager)
│   ├── room.go                  ← 확장: ArenaCombat 모드 추가
│   ├── biome.go                 ← 유지 (Voronoi 바이옴)
│   ├── terrain_bonus.go         ← 유지 (국가 테마 보정)
│   ├── spatial.go               ← 유지 (SpatialHash)
│   │
│   ├── ar_combat.go             ★ NEW: Arena 전투 엔진 (자동공격, 데미지 §11)
│   ├── ar_weapon.go             ★ NEW: 무기 16종 정의 + 자동발사 로직
│   ├── ar_tome.go               ★ NEW: Tome 16종 + 희귀도 + 체감수익
│   ├── ar_item.go               ★ NEW: 아이템 드롭 + 장비 효과
│   ├── ar_synergy.go            ★ NEW: 시너지 10종 판정 + 보너스
│   ├── ar_wave.go               ★ NEW: PvE 웨이브 스포너 (Tier 적응형)
│   ├── ar_pvp.go                ★ NEW: PvP 페이즈 (아레나 축소, 팩션전)
│   ├── ar_enemy.go              ★ NEW: 적 5종 + 엘리트 + 미니보스
│   ├── ar_levelup.go            ★ NEW: 레벨업 + Tome 선택 풀 생성
│   ├── ar_entity.go             ★ NEW: Player/Enemy/Projectile 엔티티
│   └── ar_types.go              ★ NEW: Arena 전용 타입 정의
│
├── world/                       (기존 패키지 유지)
│   ├── world_manager.go         ← 유지 (배틀사이클 스케줄링)
│   ├── country_arena.go         ← 유지 (주권/팩션 추적)
│   ├── country_data.go          ← 유지 (Tier/MaxAgents)
│   └── countries_seed.go        ← 유지 (195국 시드)
│
├── ai/                          (기존 NationalAI 확장)
│   ├── national_ai.go           ← 유지 (Grand Strategy)
│   └── ar_tactical_ai.go        ★ NEW: Arena 전투 AI (Reflexive+Tactical)
│
└── network/                     (기존 확장)
    ├── socket_handler.go        ← 확장: ar_ 이벤트 라우팅 추가
    ├── broadcaster.go           ← 확장: ar_state 브로드캐스트
    └── protocol.go              ← 확장: ar_ 메시지 타입 추가
```

### Room 확장 전략

기존 `Room`에 **CombatMode** 인터페이스를 추가하여 전투 방식을 플러그인으로 교체:

```go
// game/room.go — 기존 Room 확장
type CombatMode interface {
    OnTick(delta float64)                    // 매 틱 (20Hz)
    OnPlayerJoin(player *AREntity)           // 플레이어 진입
    OnPlayerLeave(clientID string)           // 플레이어 이탈
    OnInput(clientID string, input ARInput)  // 플레이어 입력 처리
    GetState() *ARState                      // 직렬화용 상태
}

// Room.combatMode = &ArenaCombat{} (Arena 모드)
// Room.combatMode = &ClassicCombat{}  (기존 뱀 전투, 하위 호환)
```

### 클라이언트 아키텍처 (R3F)

기존 `/minecraft` 페이지가 아닌, 국가 아레나 진입 시 자동 로드:

```
apps/web/
├── components/game/             (기존 게임 컴포넌트 디렉토리)
│   ├── GameCanvas3D.tsx         ← 확장: ARCombat 컴포넌트 마운트
│   │
│   ├── mb/                      ★ NEW: Arena 전투 컴포넌트
│   │   ├── ARScene.tsx          // 3D 씬 (MCScene + 국가 테마 적용)
│   │   ├── ARTerrain.tsx        // 국가별 복셀 터레인 (테마 + 바이옴)
│   │   ├── ARCamera.tsx         // 3인칭 카메라 (MCCamera → TPS)
│   │   ├── ARPlayer.tsx         // 로컬 플레이어 캐릭터
│   │   ├── AREntities.tsx       // 적/타 플레이어 InstancedMesh
│   │   ├── ARProjectiles.tsx    // 투사체 + 파티클
│   │   ├── AREffects.tsx        // 상태이상 이펙트, 데미지 넘버
│   │   ├── ARHUD.tsx            // HP/XP/타이머/무기슬롯
│   │   ├── ARLevelUp.tsx        // Tome 선택 UI (3카드)
│   │   ├── ARPvPOverlay.tsx     // PvP 진입/결과
│   │   ├── ARMinimap.tsx        // 미니맵 (바이옴 오버레이)
│   │   └── ARDeathScreen.tsx    // 사망 + 관전
│   │
│   └── ...기존 컴포넌트 유지
│
├── hooks/
│   ├── useSocket.ts             ← 확장: ar_ 이벤트 핸들링 추가
│   └── useARState.ts            ★ NEW: Arena 전투 상태 훅
│
└── lib/
    ├── 3d/mc-*.ts               ← 유지 (MC 엔진 기반)
    └── mb/                      ★ NEW: Arena 전투 라이브러리
        ├── ar-types.ts          // 타입 정의 (서버 공유)
        ├── ar-interpolation.ts  // 엔티티 보간
        └── mb-effects.ts        // 클라이언트 이펙트
```

### 네트워크 프로토콜 (기존 확장)

기존 프로토콜에 `ar_` 접두사 이벤트 추가:

| 이벤트 | 방향 | 빈도 | 페이로드 |
|--------|------|------|---------|
| `input` | C→S | 30Hz | `{dir, slide, jump}` (기존 input 확장) |
| `ar_state` | S→C | 20Hz | `{players[], enemies[], projectiles[], items[], biome_effects[]}` |
| `ar_level_up` | S→C | 이벤트 | `{tomes: [{id, name, rarity, effect}], weapon_choice: bool}` |
| `ar_choose` | C→S | 이벤트 | `{tome_id}` 또는 `{weapon_id}` |
| `ar_pvp_start` | S→C | 이벤트 | `{arena_radius, factions[], timer}` |
| `ar_pvp_end` | S→C | 이벤트 | `{winning_faction, scores[], sovereignty_change}` |
| `ar_damage` | S→C | 이벤트 | `{target, amount, crit_count, type, status_applied}` |
| `death` | S→C | 이벤트 | `{killer_id, faction, damage_type}` (기존 확장) |
| `battle_end` | S→C | 이벤트 | `{sovereignty, faction_scores[], mvp}` (기존 유지) |

### AI 통합 (기존 4계층 활용)

```
기존 AI 계층:
  Grand Strategy (24h)  → NationalAI: 국가 전략 결정 ← 유지
  Operational (1h)      → 군사/외교/경제 결정 ← 유지
  Tactical (10min)      → ★ ar_tactical_ai.go: 빌드 전략 (Tome/무기 선택)
  Reflexive (50ms)      → ★ ar_tactical_ai.go: 이동/회피/타겟팅

Arena가 확장하는 레이어:
  Tactical: AI 빌드 프로필 (DPS Rush/Tank/XP Farm/Balanced/Glass Cannon)
  Reflexive: 이동 판단 (AOE 회피, 보스 거리 유지, XP 수집 경로)
  OperatorRegistry (v17): 외부 AI/인간이 전투 참여 시 동일 인터페이스
```

### 최적화 전략

- **엔티티 풀링**: 적/투사체는 사전 할당 풀에서 재활용 (GC 방지)
- **뷰포트 컬링**: 카메라 50m 반경 밖 엔티티 업데이트 스킵
- **LOD 시스템**: 거리별 적 렌더링 복잡도 감소 (20m 이상 = 박스)
- **Delta 인코딩**: ar_state 메시지는 변경분만 전송
- **SpatialHash**: 기존 시스템 재활용 — 적 충돌 체크 O(1) 근사
- **아레나 풀링**: 기존 WorldManager의 arenaPool (10개) 재활용
- **비활성 아레나**: `SimulateBattleStatistical()` (v16) — 물리 없이 통계적 결과

## 16. 리스크

| # | 리스크 | 영향 | 확률 | 완화 전략 |
|---|--------|------|------|----------|
| R1 | **Tier별 가변 인원 서버 부하** — S-Tier 50명 vs D-Tier 8명 아레나 동시 운영 | 195국 동시 아레나 시 서버 과부하 | 높음 | 기존 WorldManager의 50 동시 아레나 캡 + 아레나 풀링(10개 재사용) 활용. SimulateBattleStatistical()로 비활성 아레나 통계 처리 |
| R2 | **수백 적 + 수십 플레이어 동시 렌더링** | 클라이언트 프레임 드롭 | 높음 | InstancedMesh + LOD + 뷰포트 컬링. Tier별 적 상한: S=200, A=150, B=100, C=60, D=30 |
| R3 | **PvP 빌드 격차** — 레벨/장비 차이로 불공정 | 신규 플레이어 이탈 | 중간 | PvP 데미지 40% 스케일링 + HP 정규화 + 단일피격 30% 캡 + 주권 방어 보너스(20%)로 약간의 비대칭 허용 |
| R4 | **CombatMode 인터페이스 호환성** — 기존 Room 게임 루프와 Arena 로직 충돌 | 기존 기능 퇴행 | 높음 | CombatMode 인터페이스로 분리. ClassicCombat(기존)과 ArenaCombat 독립 실행. Phase 1에서 인터페이스 검증 우선 |
| R5 | **NationalAI 확장 복잡도** — 기존 4-Layer AI에 Arena 전투 AI 추가 시 레이어 간 간섭 | AI 행동 일관성 붕괴 | 중간 | Tactical/Reflexive Layer만 확장, 상위 2개 Layer(Grand Strategy/Operational) 변경 없음. 전투 AI를 별도 `ar_ai_*.go` 파일로 분리 |
| R6 | **오버크리티컬 인플레이션** | 후반 밸런스 붕괴 | 중간 | 적 HP 지수 스케일링 + PvP 크리티컬 캡(5회) + Tier별 난이도 보정 |
| R7 | **토큰 경제 불균형** — S-Tier 국가에 인구 집중 시 특정 토큰 과잉 발행 | 경제 인플레이션 | 중간 | Tier별 일일 획득 상한 + 영구 부스트 소각 메커니즘 + $AWW는 주권 이벤트에만 연동 |
| R8 | **Marathon 모드(1시간) 도중 이탈** | 장기 매치 경험 붕괴 | 중간 | Marathon은 이벤트 전용 (상시 모드 아님). Standard 5분이 기본. AI 에이전트 자동 대체 + 중도 참여 허용(레벨 보정) |
| R9 | **WebSocket 끊김/재접속** | 진행도 손실 | 중간 | 기존 Room의 재접속 핸들링 확장. 5분 매치 상태 보존 + 스냅샷 복원 |
| R10 | **모바일 성능** | 터치 조작 + 저사양 | 높음 | 간소화 모드 (적 최대 50, 파티클 off, LOD 공격적) + 자동이동 옵션 |

## 구현 로드맵

<!-- ★ da:work Stage 0이 이 섹션을 자동 파싱합니다 -->

### Phase 1: CombatMode 인터페이스 + 코어 엔진 기반
| Task | 설명 |
|------|------|
| CombatMode 인터페이스 | `game/combat_mode.go` — Room에 플러그인할 CombatMode 인터페이스 정의 + ClassicCombat(기존) 래퍼 |
| Arena 타입 정의 | `lib/3d/ar-types.ts` + `game/ar_types.go` — 엔티티, 무기, Tome, 아이템 공유 타입 |
| ArenaCombat 구현 | `game/ar_combat.go` — CombatMode 인터페이스 구현체. 자동공격 + 데미지 계산 + 웨이브 스포너 |
| 3인칭 카메라 | `components/game/ar/ARCamera.tsx` — 후방 5m, 위 3m, 마우스 회전 (MCCamera 패턴 활용) |
| 캐릭터 렌더링 | `components/game/ar/ARPlayer.tsx` — 복셀 캐릭터 + 기본 애니메이션 |
| 적 렌더링 | `components/game/ar/AREntities.tsx` — InstancedMesh 적 + HP 바 |
| XP 시스템 | 서버: `game/ar_xp.go` 드롭/수집/레벨업 — 클라이언트: XP 바 HUD |
| Tome 선택 UI | `components/game/ar/ARLevelUp.tsx` — 레벨업 시 3카드 선택 (희귀도 색상) |

- **design**: Y (3인칭 카메라, HUD, 레벨업 UI)
- **verify**: CombatMode 인터페이스 ClassicCombat 호환 테스트 + 단일 플레이어 PvE 5분 생존 + 레벨업 3회 이상

### Phase 2: 무기 + Tome + 아이템 시스템
| Task | 설명 |
|------|------|
| 무기 16종 구현 | `game/ar_weapon.go` — 각 무기 발사 패턴, 사거리, 데미지 타입 |
| 투사체 시스템 | 서버: 물리 시뮬 — 클라이언트: `components/game/ar/ARProjectiles.tsx` |
| Tome 16종 | `game/ar_tome.go` — 스탯 계산 + 체감수익 곡선 (n^0.85) |
| 아이템 드롭 | `game/ar_item.go` — 드롭 테이블 + 장비 효과 |
| 상태이상 6종 | 서버: 화상/냉동/감전/독/출혈/석화 틱 처리 |
| 크리티컬 시스템 | 서버: 오버크리티컬 수식 (§11) 전체 구현 |
| 데미지 넘버 | `components/game/ar/AREffects.tsx` — 화면 위 데미지 숫자 팝업 |

- **design**: N (로직 중심)
- **verify**: 무기 16종 발사 확인, Tome 효과 누적 확인, 크리티컬 수식 단위 테스트

### Phase 3: 캐릭터 + 시너지 + Tier별 난이도
| Task | 설명 |
|------|------|
| 캐릭터 8종 | 고유 패시브 + 시작 무기 + 스탯 편향 |
| 시너지 10종 | `game/ar_synergy.go` — 조합 판정 + 보너스 효과 활성화 |
| 무기 진화 | Lv.7 + 특정 Tome → 상위 무기 변환 |
| Tier별 난이도 | 기존 `TierConfigs` 참조: S-Tier 적×1.5/엘리트×1.3 vs D-Tier 적×0.5/엘리트×0.6 |
| 미니보스 5종 | 패턴 AI + 특수 공격 + 드롭 테이블 |
| 엘리트 시스템 | 접두사 5종 (Armored/Swift/Vampiric/Explosive/Shielded) |
| 국가 테마 맵 | `game/ar_terrain.go` — terrain_bonus.go의 6종 테마 → 복셀 맵 생성기 |

- **design**: N (시스템 로직)
- **verify**: 시너지 5종 트리거, 무기 진화 1종, Tier S vs D 난이도 차이 확인

### Phase 4: 멀티플레이어 + NationalAI 전투 확장
| Task | 설명 |
|------|------|
| Room 통합 | 기존 Room에 CombatMode 전환 로직 추가. CountryArena 진입 시 ArenaCombat 활성화 |
| Tier별 멀티 동기화 | `CalcMaxAgents` 기반 가변 인원 state 브로드캐스트 + Delta 인코딩 + 뷰포트 컬링 |
| NationalAI 전투 확장 | `game/ar_ai_tactical.go` + `ar_ai_reflexive.go` — 기존 Tactical/Reflexive Layer 확장 |
| 빌드 프로필 5종 | AI Tactical Layer가 국가 상황에 맞는 빌드 선택 |
| 플레이어 보간 | `lib/3d/ar-interpolation.ts` — 서버 상태 → 클라이언트 스무딩 |
| 팩션 표시 | 이름표에 팩션 색상 + 아군/적 구분 |

- **design**: Y (국가 선택 UI, 팩션 표시, 매칭 대기)
- **verify**: 10명 동시 접속 + AI 에이전트 정상 행동 + Tier S/D 인원 차이 확인

### Phase 5: 팩션 PvP + 주권 연동
| Task | 설명 |
|------|------|
| PvP Phase | `game/ar_pvp.go` — 기존 배틀사이클 Deploy→PvE→PvP→Settlement 연동 |
| 팩션 기반 PvP | 같은 팩션=아군, 다른 팩션=적. 팩션 기여 점수 추적 |
| 국가 테마 아레나 | terrain_bonus + biome.go 보정이 PvP에도 적용 |
| PvP 밸런스 규칙 | 데미지 40% 스케일링, HP 정규화, CC 50%, 주권 방어 ×1.2 |
| 주권 판정 연동 | `world/country_arena.go`의 DetermineWinningFaction → 전투 결과 반영 |
| 최종 보스 (Marathon) | "The Arena" — Marathon 모드 전용 최종 결전 |
| PvP 오버레이 | `components/game/ar/ARPvPOverlay.tsx` — 진입 경고, 킬 피드, 팩션 점수 |

- **design**: Y (PvP 오버레이, 킬 피드, 주권 결과 화면)
- **verify**: PvP 팩션 구분 동작, 주권 판정 트리거, Standard 5분 사이클 완주

### Phase 6: 토큰 경제 + 메타 프로그레션
| Task | 설명 |
|------|------|
| 토큰 보상 | `game/ar_reward.go` — 국가 토큰 지급 + $AWW 주권 보상 연동 |
| 프로필 시스템 | 레벨, 토큰, 퀘스트 추적 (기존 프로필 확장) |
| 퀘스트 240개 | 처치/생존/빌드/PvP/주권/탐험/도전 카테고리 |
| 시즌 패스 | 기존 4주 4Era 시스템 연동, $AWW 결제 |
| 캐릭터 잠금해제 | 조건부 해제 + $AWW 대체 |
| 사망/관전 화면 | `components/game/ar/ARDeathScreen.tsx` + 관전 카메라 |
| 미니맵 + 사운드 | `components/game/ar/ARMinimap.tsx` + 전투 사운드 |

- **design**: Y (프로필, 퀘스트 UI, 시즌 패스 UI)
- **verify**: 국가 토큰 지급 확인, 퀘스트 3종 클리어, 시즌 패스 진행

### Phase 7: 최적화 + 스트레스 테스트
| Task | 설명 |
|------|------|
| 서버 최적화 | 엔티티 풀링, SpatialHash 튜닝, GC 최소화 (기존 패턴 따름) |
| 클라이언트 최적화 | InstancedMesh LOD, 파티클 풀링, Tier별 렌더 상한 |
| Tier별 부하 테스트 | S-Tier 50명 + D-Tier 8명 동시 아레나 운영 테스트 |
| 모바일 최적화 | 간소화 모드 (Tier별 적 상한 조정), 터치 조작, 자동이동 |
| 재접속 핸들링 | 기존 Room 재접속 확장, 5분 매치 상태 보존 + 스냅샷 복원 |
| 195국 시뮬레이션 | SimulateBattleStatistical() 비활성 아레나 + 50 동시 아레나 캡 테스트 |

- **design**: N (성능 최적화)
- **verify**: S-Tier 50명 20Hz 틱 안정, 195국 동시 스케줄링, 클라이언트 60FPS, 모바일 30FPS
