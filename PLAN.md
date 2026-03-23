# PLAN: World War Tycoon — 실시간 멀티플레이 Grand Strategy

## 1. 개요

AI 에이전트를 완전 삭제하고, 기존 AWW의 **실시간 멀티플레이 인프라를 최대한 재활용**하여 사람만을 위한 부동산+전쟁+경제 Grand Strategy 게임으로 전면 재기획한다.

**핵심 차별점**: 단순 비동기 타이쿤이 아닌, **실시간으로 다른 플레이어와 같은 지구본 위에서 경쟁하는** 멀티플레이 게임.

**DB**: Railway PostgreSQL (Supabase 인증은 유지, 게임 데이터는 Railway DB)

### 참조 게임
- Clash of Clans (배치형 자동전투, 10분 체크인)
- Travian/Tribal Wars (실시간 멀티 영토 전쟁)
- EVE Online (플레이어 주도 경제, 영토 분쟁)
- Risk (글로벌 영토 정복)

---

## 2. 요구사항

### 기능 요구사항
- [FR-1] 현실 195개국 지구본 위 건물→지역→국가 계층 영토 시스템
- [FR-2] 실시간 멀티플레이: 같은 서버의 모든 플레이어가 동일 세계에서 경쟁
- [FR-3] 배치형 자동전투 (공격 명령→이동→3분 자동전투→결과)
- [FR-4] 실시간 글로벌 이벤트 피드 (전쟁선포, 영토변경, 경매 등)
- [FR-5] 경매/즉시구매/전쟁약탈/합병 4가지 건물 획득 경로
- [FR-6] 동맹/외교 시스템 (공동 방어, 선전포고, 무역)
- [FR-7] 단일 재화 Market Cap 경제
- [FR-8] 10분 체크인 세션 패턴 (오프라인 보호 포함)
- [FR-9] 3D 전투 리플레이 (기존 city3d 엔진 활용)
- [FR-10] 리더보드, 업적, 시즌 시스템

### 비기능 요구사항
- [NFR-1] 10,000+ 동시접속 (Go WebSocket Hub)
- [NFR-2] 전투 시뮬레이션 서버 100ms 이내
- [NFR-3] 글로벌 상태 브로드캐스트 1Hz (기존 WorldManager 패턴)
- [NFR-4] 웹 + 모바일 PWA 동시 지원
- [NFR-5] Railway PostgreSQL + Redis 데이터 레이어
- [NFR-6] 60fps 3D 렌더링 (기존 city3d/Globe 수준)

---

## 3. 기술 방향

### 재활용 스택
```yaml
Client: React 19 + TypeScript + Vite (apps/web/)
3D: Three.js + React Three Fiber (city3d/ + Globe components)
State: SocketProvider 3-layer context (Stable/Ref/Legacy)
Server: Go (server/internal/)
Realtime: WebSocket Hub (20Hz capable, 1Hz world broadcast)
Auth: Supabase (Google OAuth, 기존 유지)
Game DB: Railway PostgreSQL (NEW — 게임 데이터 전체)
Cache: Redis (기존 — state sync, pub/sub)
Deploy: Railway (서버) + Vercel (클라이언트)
```

### DB 전략: Railway PostgreSQL
```yaml
Why_Railway_DB:
  - Go 서버와 같은 Railway 인프라 → 네트워크 지연 최소
  - Supabase는 인증 전용으로 유지 (game_saves 동기화)
  - 게임 데이터는 Go 서버가 직접 Railway PG에 읽기/쓰기
  - pgx (Go PostgreSQL driver) 사용 — 기존 프로젝트 의존성 확인 필요

Tables (Railway PG):
  - players: 플레이어 프로필, 레벨, MC 잔고
  - buildings: 건물 카탈로그 + 소유권
  - territories: 구역/도시/국가 지배 상태
  - armies: 유닛 보유/배치/이동 상태
  - battles: 전투 기록 + 리플레이 데이터
  - auctions: 경매 상태
  - alliances: 동맹 멤버십
  - wars: 전쟁 상태
  - transactions: MC 거래 기록
  - leaderboard: 랭킹 (materialized view)

Supabase (인증 전용 유지):
  - auth.users: 인증
  - game_saves: MC 동기화 (Railway PG와 양방향 sync)
```

---

## 4. 아키텍처 개요

### C4 Level 1: System Context
```
┌──────────────────────────────────────────────────────────────┐
│                     World War Tycoon                          │
│                                                              │
│  ┌────────────────┐    WebSocket     ┌───────────────────┐  │
│  │ React Client   │◄═══════════════►│ Go Server          │  │
│  │ (Vercel)       │    (20Hz/1Hz)   │ (Railway)          │  │
│  │                │                  │                     │  │
│  │ Globe 3D       │    REST API     │ GameEngine          │  │
│  │ City 3D        │◄══════════════►│ BattleSimulator     │  │
│  │ SocketProvider │                  │ TerritoryEngine     │  │
│  │ HUD/UI         │                  │ EconomyEngine       │  │
│  └────────────────┘                  │ WorldManager        │  │
│                                      └──────┬──────────────┘  │
│                                             │                  │
│                              ┌──────────────┼──────────┐      │
│                              │              │          │      │
│                         ┌────▼────┐   ┌────▼────┐ ┌───▼───┐ │
│                         │Railway  │   │ Redis   │ │Supabase│ │
│                         │PostgreSQL│   │ (Cache) │ │(Auth)  │ │
│                         └─────────┘   └─────────┘ └───────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 실시간 멀티플레이 데이터 흐름
```
[Player A: 공격 명령]
    │
    ▼ WebSocket emit("attack_order", {target, units})
┌─────────────────────────────────────────────────┐
│ Go Server                                        │
│                                                  │
│  Hub.EventRouter                                 │
│    └─ "attack_order" → GameEngine.ProcessAttack  │
│         │                                        │
│         ├─ 1. 유효성 검증 (소유 유닛, MC 잔고)    │
│         ├─ 2. 이동 시간 계산 (거리 기반)          │
│         ├─ 3. Railway PG: INSERT battle_queue     │
│         ├─ 4. Redis: PUBLISH "battle:{region}"    │
│         ├─ 5. Hub.BroadcastAll("global_event",    │
│         │      {type:"army_march", from, to})     │
│         │                                        │
│         │  ... N분 후 도착 ...                    │
│         │                                        │
│         ├─ 6. BattleSimulator.Run(attacker, def)  │
│         │     └─ 3분 자동전투 시뮬레이션           │
│         │     └─ Railway PG: UPDATE battle result  │
│         │                                        │
│         ├─ 7. Hub.SendToClient(A, "battle_result") │
│         ├─ 8. Hub.SendToClient(B, "under_attack")  │
│         └─ 9. Hub.BroadcastAll("territory_change") │
│                                                    │
└────────────────────────────────────────────────────┘
    │                              │
    ▼                              ▼
[Player A: 결과 확인]     [전체: 지구본 업데이트]
[3D 리플레이 시청 가능]    [Globe 영토 색상 변경]
```

### 기존 시스템 재활용 맵핑 (검증 완료 — 2026-03-23)

> ⚠️ 검증 결과: "재활용" 수준을 3단계로 분류
> - **그대로**: 코드 수정 없이 사용 가능
> - **설계 참고**: 상태 머신/인터페이스 재활용, 내부 로직 재작성
> - **신규 개발**: 기존 코드 참고만, 완전 새로 작성

```
기존 Go 서버                    →  용도                              →  재활용 수준
───────────────────────────────────────────────────────────────────────────────
ws/Hub (20Hz broadcast)         →  실시간 글로벌 이벤트 + 전투 알림  →  그대로
ws/Client (rate limiter)        →  안티봇 (입력 속도 제한)           →  그대로
ws/Protocol (80+ events)        →  이벤트 프로토콜 확장              →  설계 참고 (이벤트 추가)
game/WorldManager (195국)       →  국가별 영토 상태 관리             →  설계 참고 (1Hz 브로드캐스트 페이로드 변경)
game/TerritoryEngine (일일정산) →  영토 지배 계산                    →  설계 참고 (RP→건물소유 변환, 에스컬레이션 그대로)
game/War (선포/진행/해결)       →  전쟁 시스템                       →  설계 참고 (상태머신 재활용, 점수/주권 로직 재작성)
game/Alliance                   →  동맹 시스템                       →  설계 참고 (로직 재활용, 인메모리→PG 영속화 추가)
game/SovereigntyTracker         →  영토 주권 추적                    →  설계 참고 (전투RP→건물소유 기반 변환)
game/token_rewards              →  보상 시스템 (MC로 변환)           →  설계 참고
cache/Redis                     →  상태 캐시 + pub/sub               →  그대로

기존 클라이언트                  →  용도                              →  재활용 수준
───────────────────────────────────────────────────────────────────────────────
SocketProvider (3-layer)        →  멀티플레이 상태 관리              →  그대로
GlobeView + 15 레이어           →  지구본 시각화                     →  그대로
GlobeDominationLayer            →  영토 지배 시각화                  →  설계 참고 (데이터 파이프라인 변경)
GlobeWarEffects                 →  전쟁 시각 효과                    →  그대로
GlobeTradeRoutes                →  무역 경로 시각화                  →  그대로
GlobeConflictIndicators         →  분쟁 표시                         →  그대로
GlobeAllianceBeam               →  동맹 시각화                       →  그대로
page.tsx mode state machine     →  5-Mode 전환 (globe→city 추가)     →  설계 참고 (모드 추가)
city3d/ (CityCanvas+3D)        →  도시 뷰                           →  설계 참고 (소유자 색상 추가)
KillFeedHUD                     →  글로벌 이벤트 피드로 변환         →  설계 참고
useSocket (40+ handlers)        →  이벤트 핸들러 확장                →  설계 참고

⚠️ 중요: app_ingame/ 인게임 엔진(TS 싱글턴)은 멀티플레이어에서 서버 Go로 재구현 필수
  - AuctionEngine.ts → Go 서버에서 재구현 (설계만 참고)
  - IncomeCalculator.ts → Go 서버에서 재구현
  - MergeSystem.ts → Go 서버에서 재구현
  - BuildingManager.ts → Go 서버에서 재구현
  - 이유: 클라이언트 싱글턴은 부정행위 방지 불가

⚠️ 중요: DB 레이어 신규 구축 필요
  - 현재 Go 서버는 Supabase REST API(HTTP/PostgREST)만 사용
  - go.mod에 pgx 없음 → github.com/jackc/pgx/v5 추가 필요
  - Railway PG용 connection pool + 쿼리 레이어 전체 신규 개발

⚠️ 중요: BattleSimulator 완전 신규 개발
  - 기존 Arena는 agar.io 스타일 실시간 PvP (mass/aura/orb/shrink)
  - 군사 유닛 개념 없음 → 배치형 자동전투 엔진 완전 새로 설계
  - Arena에서 재활용 가능: tick loop 패턴, SpatialHash 정도

삭제 대상
─────────────────────────────────────────────────────
server/internal/agent/          →  완전 삭제 (LLM Bridge)
game/agent_api.go               →  완전 삭제 (Commander Mode)
game/bot.go, bot_test.go        →  완전 삭제 (Bot AI)
ws/agent_stream.go              →  완전 삭제 (Agent Stream Hub)
game/ar_*.go (15개 파일)        →  삭제 (실시간 전투→배치형)
Shadowbroker/ 전체              →  삭제 (OSINT 피드)
```

---

## 5. 핵심 시스템 설계 방향

### 5.1 실시간 멀티플레이 레이어 (NEW)

기존 AWW는 "국가별 독립 아레나"였지만, World War Tycoon은 **하나의 영속적 세계**다.

```yaml
Persistent_World:
  - 모든 플레이어가 동일한 195개국 세계에 존재
  - 건물 소유, 영토 지배, 전쟁 상태가 서버에 영속
  - 로그아웃해도 건물/군대/영토 유지 (오프라인 보호 적용)

Realtime_Layers:
  Layer_1_Global (1Hz — 기존 WorldManager 패턴):
    - 195개국 영토 지배 상태
    - 활성 전쟁 목록
    - 동맹 관계
    - 글로벌 리더보드
    - Globe 3D 렌더링에 직접 반영

  Layer_2_Regional (2Hz — 기존 city_state 패턴):
    - 특정 도시 진입 시 상세 데이터
    - 건물 소유 현황
    - 진행 중인 경매
    - 접근 중인 적 군대 (이동 중)
    - City 3D 렌더링에 반영

  Layer_3_Battle (20Hz — 기존 Arena 패턴):
    - 전투 리플레이 시 자동전투 실시간 스트리밍
    - 배치형이므로 입력 없음, 시청만
    - 기존 Arena 20Hz loop를 시뮬레이션 모드로 재활용

  Layer_4_Events (즉시 — 기존 unicast/broadcast):
    - 공격 받았을 때 즉시 알림
    - 경매 낙찰 알림
    - 동맹 요청/수락
    - 전쟁 선포 알림
```

### 5.2 전투 시스템 (배치형 자동전투)

```yaml
Attack_Flow:
  1. 공격자: 유닛 선택 + 대상 구역/도시 선택
  2. 서버: 이동 시간 계산 (거리 km / 이동속도)
     - 인접 구역: 15분
     - 같은 도시: 30분
     - 같은 나라: 1~2시간
     - 다른 나라 (인접국): 2~4시간
  3. 이동 중: Globe에서 군대 이동 애니메이션 (모든 플레이어 실시간 확인)
  4. 도착: 서버에서 BattleSimulator 실행
     - 기존 Arena engine을 비전투 시뮬레이션 모드로 재활용
     - 공격 유닛 vs 방어 유닛+시설 → 3분 시뮬레이션
     - 틱별 결과를 battle_replay 테이블에 저장
  5. 결과: 양쪽 알림 + 리플레이 데이터 제공
  6. 리플레이: city3d 엔진으로 3D 재생 (선택적 시청)

Defense_Advantage:
  - 방어측 30% 전투력 보너스
  - 방어 시설 (포탑/벙커/대공포) 선제 공격
  - 성벽: 근접 유닛 이동 차단
  - 본부: 추가 HP + 자동 공격
  - 동맹 자동 지원: 동맹원 유닛 30% 자동 참전

Anti_Grief:
  - 공격 쿨다운: 같은 대상 12시간
  - 일일 공격 제한: 3회/일
  - 신규자 72시간 보호막 (Peace Shield)
  - 24시간 미접속: 약탈량 50% 감소
  - 약탈 상한: 1회 공격으로 MC의 10%
```

### 5.3 경제 시스템

```yaml
Single_Currency: Market Cap (MC)
  - 기존 app_ingame + Supabase game_saves 호환
  - Railway PG players.mc_balance가 마스터
  - Supabase game_saves.total_market_cap과 주기적 동기화

Income_Sources:
  - 건물 패시브 수익 (기존 IncomeCalculator 재활용)
  - 전투 승리 약탈 (적 MC의 10%)
  - 일일 출석 보너스 (기존 EventManager)
  - 업적 보상 (기존 AchievementManager)
  - 무역 수익 (거래소 수수료 수익)
  - 영토 지배 보너스 (기존 SovereigntyTracker → MC 보너스로 변환)

Expense_Sinks:
  - 건물 구매 (경매/즉시구매)
  - 군대 생산/훈련/유지
  - 방어 시설 건설
  - 합병/재개발
  - 거래 수수료 (5%+10%)
  - 건물/군대 유지비
  - 전쟁 선포 비용 (대규모 MC sink)
```

### 5.4 영토 시스템

```yaml
Hierarchy:
  건물 (최소 단위) → 구역 (3~10건물) → 도시 (3~10구역) → 국가

Control_Rules:
  구역_지배: 구역 내 건물 과반수(50%+) 소유 → 구역 지배
  도시_지배: 도시 내 구역 과반수 지배 → 도시 지배
  국가_지배: 수도 도시 지배 → 국가 지배 (기존 TerritoryEngine 활용)

  기존 TerritoryEngine의 일일정산 로직을 건물 소유 기반으로 변환:
    - 기존: 전투 라운드 RP 누적 → 일일 정산
    - 변경: 건물 소유 비율 → 실시간 지배도 계산 + 일일 정산으로 공식 확정

Sovereignty_Escalation (기존 그대로):
  None → Active Domination (1일) → Sovereignty (3일) → Hegemony (14일)

  Hegemony 보너스 (기존 그대로):
    - 수익 +50%
    - 군사력 +20%
    - 전쟁 선포 가능 (Hegemony 필수 조건)
```

---

## 6. UI/UX 전체 흐름 설계 — 아웃게임 ↔ 인게임 매끄러운 연결

### 6.1 기존 UI/UX 자산 분석

**apps/web/ (멀티플레이어 본체)**에서 재활용:
- IntroSequence (시네마틱 부트) → 그대로 재활용
- GlobeLoadingScreen → 그대로 재활용
- Globe 3D + 15 레이어 → 핵심 아웃게임 화면
- CountryPanel (5탭 팝업/바텀시트) → 국가 상세로 확장
- GlobeHoverPanel (호버 툴팁) → 영토/전쟁 정보 추가
- SocketProvider 3-layer → 실시간 상태 그대로
- URL 기반 팝업 시스템 → 딥링크 유지
- NewsFeed 마키 티커 → 전쟁/영토 이벤트로 확장
- CharacterCreator → 플레이어 아바타 에디터

**app_ingame/ (City Tycoon)**에서 재활용:
- CityCanvas 3D (R3F) → 도시 뷰의 3D 엔진
- RegionNav (도시 탭 전환) → 도시 네비게이션
- AuctionPanel 슬라이드 패널 UI 패턴 → 모든 패널에 적용
- BuildingDetail 모달 (3탭) → 건물 상세 UI
- PortfolioPanel → 포트폴리오 뷰
- MergePanel → 합병/재개발 UI
- IncomeToast → 수익 알림
- NotificationCenter (벨 아이콘) → 알림 시스템
- AchievementPanel → 업적 UI
- Leaderboard → 랭킹 UI

### 6.2 통합 모드 시스템 (5-Mode State Machine)

기존 apps/web의 mode state machine을 확장:

```
기존: lobby | transitioning | playing | iso | matrix
변경: globe | transitioning | city | battle_replay | settings

Mode 정의:
  globe:          지구본 뷰 (아웃게임 메인)
  transitioning:  모드 전환 애니메이션 (300ms)
  city:           도시 3D 뷰 (인게임 핵심)
  battle_replay:  전투 리플레이 3D (인게임 시청)
  settings:       설정/프로필/경제 팝업 (아웃게임 오버레이)
```

### 6.3 전체 사용자 흐름 (Outgame → Ingame → Outgame 순환)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OUTGAME (Globe Mode)                          │
│                                                                      │
│  ┌──────────┐    ┌──────────────────────────────────────────────┐   │
│  │ 앱 진입   │    │              Globe 3D View                    │   │
│  │          │    │                                                │   │
│  │ Intro    │───►│  [지구본] 195개국 실시간 영토 표시              │   │
│  │ Sequence │    │  ├─ 내 영토: 강조 색상 (초록)                  │   │
│  │ (3.5초)  │    │  ├─ 적 영토: 적색 톤                         │   │
│  │          │    │  ├─ 전쟁 중: GlobeWarEffects (폭발/미사일)     │   │
│  │ Loading  │    │  ├─ 동맹: GlobeAllianceBeam (연결선)          │   │
│  │ Screen   │    │  └─ 군대 이동: 화살표 애니메이션               │   │
│  └──────────┘    │                                                │   │
│                  │  [호버] GlobeHoverPanel                        │   │
│                  │  ├─ 국가명 + 국기                              │   │
│                  │  ├─ 지배자 이름 + 동맹                         │   │
│                  │  ├─ GDP / 군사력 / 건물 수                     │   │
│                  │  └─ [진입] / [공격] / [정보] 버튼              │   │
│                  │                                                │   │
│                  │  [하단 HUD]                                    │   │
│                  │  ├─ Market Cap 잔고                            │   │
│                  │  ├─ 시간당 수익                                │   │
│                  │  ├─ 군대 현황 (총 유닛 수)                     │   │
│                  │  ├─ 활성 전투 수                               │   │
│                  │  └─ NewsFeed 마키 티커                         │   │
│                  │                                                │   │
│                  │  [좌측 사이드]                                  │   │
│                  │  ├─ 내 제국 요약 (국가 수, 도시 수, 건물 수)    │   │
│                  │  ├─ Quick Actions:                             │   │
│                  │  │   ├─ 수익 수확 (1탭)                        │   │
│                  │  │   ├─ 진행 중인 공격 확인                    │   │
│                  │  │   └─ 경매 마감 임박 알림                    │   │
│                  │  └─ 동맹 채팅 미니 윈도우                      │   │
│                  │                                                │   │
│                  │  [우측 버튼 그룹]                               │   │
│                  │  ├─ Portfolio (포트폴리오)                      │   │
│                  │  ├─ Auctions (경매)                            │   │
│                  │  ├─ Military (군사)                             │   │
│                  │  ├─ Alliance (동맹)                             │   │
│                  │  ├─ Ranking (리더보드)                          │   │
│                  │  ├─ Achievements (업적)                         │   │
│                  │  └─ Settings (설정)                             │   │
│                  └──────────────────────────────────────────────┘   │
│                                                                      │
│  ─── 전환 트리거 ───                                                │
│  국가 클릭 "진입"  →  transitioning (300ms zoom-in) → CITY MODE    │
│  국가 클릭 "공격"  →  Attack Order 패널 (Globe 위 오버레이)         │
│  전투 완료 알림    →  Battle Replay 진입 가능                       │
│  팝업 버튼 클릭    →  Settings 오버레이 (Globe 유지)                │
└─────────────────────────────────────────────────────────────────────┘
           │                    ▲
           │ zoom-in            │ zoom-out
           ▼                    │
┌─────────────────────────────────────────────────────────────────────┐
│                         INGAME (City Mode)                           │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    City 3D View (CityCanvas)                   │   │
│  │                                                                │   │
│  │  [3D 도시] 건물 + 방어시설 + 유닛 주둔지                      │   │
│  │  ├─ 내 건물: 초록 하이라이트 + 소유자 라벨                    │   │
│  │  ├─ 적 건물: 빨강 하이라이트                                  │   │
│  │  ├─ 경매 중: AuctionBeacon (빛기둥)                           │   │
│  │  ├─ 방어 시설: 포탑/벙커/대공포/성벽 3D                      │   │
│  │  └─ 주둔 유닛: 미니 유닛 아이콘 on 건물                      │   │
│  │                                                                │   │
│  │  [상단 HUD]                                                    │   │
│  │  ├─ ← 뒤로 (Globe 복귀) | 도시명 + 지배자                    │   │
│  │  ├─ RegionNav (구역 탭 전환)                                  │   │
│  │  ├─ Market Cap | 시간당 수익 | 군사력                          │   │
│  │  └─ [경매] [건설] [군사] [합병] 퀵 액션 버튼                   │   │
│  │                                                                │   │
│  │  [건물 클릭 → 하단 바]                                         │   │
│  │  ├─ 건물명 + 등급 배지 + 소유자                                │   │
│  │  ├─ 수익률 | 방어력 | 주둔 유닛                                │   │
│  │  └─ [상세] [구매/입찰] [공격] [주둔] 액션 버튼                 │   │
│  │                                                                │   │
│  │  [슬라이드 패널] (기존 app_ingame 패턴 재활용)                  │   │
│  │  ├─ 우측: AuctionPanel, PortfolioPanel, SellPanel              │   │
│  │  ├─ 좌측: MergePanel, DefensePanel (NEW)                      │   │
│  │  └─ 하단: UnitShop (NEW), DecorationShop                     │   │
│  │                                                                │   │
│  │  [모달]                                                        │   │
│  │  ├─ BuildingDetail (Info/Auction/History/Defense 4탭)           │   │
│  │  └─ AttackPlanner (NEW: 유닛 선택→대상 선택→출발)              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ─── 전환 트리거 ───                                                │
│  ← 뒤로 버튼       →  transitioning (300ms zoom-out) → GLOBE MODE  │
│  공격 명령 확인      →  Globe로 전환 (군대 이동 표시)               │
│  전투 리플레이 탭    →  BATTLE REPLAY MODE                          │
└─────────────────────────────────────────────────────────────────────┘
           │                    ▲
           │                    │
           ▼                    │
┌─────────────────────────────────────────────────────────────────────┐
│                     INGAME (Battle Replay Mode)                      │
│                                                                      │
│  [City 3D + 전투 오버레이]                                          │
│  ├─ 공격 유닛 vs 방어 유닛 자동전투 3분 재생                        │
│  ├─ 타임라인 스크러버 (재생/일시정지/배속)                          │
│  ├─ 전투 통계 오버레이 (남은 유닛, 피해량, 약탈 MC)                 │
│  └─ [닫기] → City Mode 또는 Globe Mode 복귀                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.4 10분 체크인 UX 흐름 (핵심 설계)

```
[앱 오픈] (0초)
    │
    ├─ 인트로 스킵 (재방문 시 자동) → Globe 즉시 표시
    │
    ├─ ★ 자동 요약 대시보드 (2초간 오버레이)
    │   ├─ "오프라인 동안 +12,500 MC 수익"  [수확] 버튼
    │   ├─ "2건 전투 결과: 1승 1패"          [상세] 버튼
    │   ├─ "경매 3건 마감 임박 (5분 이내)"    [경매] 버튼
    │   └─ "동맹원 도움 요청 1건"             [지원] 버튼
    │   → 탭 한 번으로 수확 완료 (1초)
    │
    ├─ Globe에서 전체 상황 파악 (30초)
    │   ├─ 영토 변화 확인 (색상 변화 한눈에)
    │   ├─ 진행 중인 군대 이동 확인
    │   └─ 뉴스피드에서 주요 이벤트 스캔
    │
    ├─ [선택] 도시 진입 → 건설/합병/방어 (3분)
    │   ├─ 건물 구매/업그레이드
    │   ├─ 방어 시설 배치
    │   └─ 유닛 생산 명령
    │
    ├─ [선택] 공격 명령 (2분)
    │   ├─ Globe에서 대상 국가/도시 선택
    │   ├─ AttackPlanner로 유닛 편성
    │   └─ 출발 확인 → 이동 시작
    │
    ├─ [선택] 경매 입찰 (1분)
    │   ├─ AuctionPanel에서 관심 건물 입찰
    │   └─ 매각 등록
    │
    └─ [선택] 전투 리플레이 시청 (1-3분)
        └─ 최근 전투 3D 재생
```

### 6.5 화면 전환 애니메이션 명세

```yaml
Globe_to_City:
  trigger: 국가/도시 "진입" 버튼 클릭
  animation:
    1. 카메라가 해당 국가 위치로 2초간 이동 (기존 CameraController)
    2. Globe 줌인 + 페이드아웃 (300ms)
    3. CityCanvas 3D 페이드인 (300ms)
  total: ~2.6초
  easing: ease-in-out-cubic

City_to_Globe:
  trigger: ← 뒤로 버튼 또는 스와이프 백
  animation:
    1. CityCanvas 페이드아웃 (200ms)
    2. Globe 줌아웃 + 페이드인 (300ms)
  total: ~500ms

City_to_BattleReplay:
  trigger: 전투 완료 알림 → "리플레이 보기" 탭
  animation:
    1. HUD 슬라이드 아웃 (200ms)
    2. 전투 오버레이 슬라이드 인 (200ms)
    3. 리플레이 타임라인 표시 (100ms)
  total: ~500ms

Panel_Slide:
  pattern: 기존 app_ingame 슬라이드 패널 패턴 100% 재활용
  right_panels: transform: translateX(100%) → translateX(0)
  left_panels: transform: translateX(-100%) → translateX(0)
  bottom_panels: transform: translateY(100%) → translateY(0)
  duration: 300ms
  easing: ease-out

CountryPanel_Mobile:
  pattern: 기존 바텀시트 패턴 재활용
  snap_points: [closed: 0%, peek: 25%, half: 50%, full: 90%]
  gesture: 스와이프 업/다운
```

### 6.6 반응형 레이아웃 전략

```yaml
Desktop (>1024px):
  Globe: 전체 화면
  Panels: 우측/좌측 사이드 패널 (380px 고정)
  CountryPanel: 중앙 팝업 (최대 800px)
  HUD: 상/하단 바 고정

Tablet (768~1024px):
  Globe: 전체 화면
  Panels: 우측 패널 (320px)
  CountryPanel: 중앙 팝업 (전체 너비 90%)
  HUD: 상/하단 바

Mobile (<768px):
  Globe: 전체 화면 (터치 제스처 조작)
  Panels: 바텀시트로 전환 (4-snap 포인트)
  CountryPanel: 풀스크린 바텀시트
  HUD: 최소화 (탭하여 확장)
  Quick Actions: FAB(Floating Action Button) 메뉴
```

### 6.7 알림 & 인터럽트 UX

```yaml
Critical_Alerts (즉시 표시, 진동/사운드):
  - "공격 받고 있습니다! [도시명]에 적군 도착 1분 전"
  - "전쟁 선포! [동맹명]이 당신의 동맹에 선전포고"
  - "경매 낙찰! [건물명] 을(를) 15,000 MC에 획득"

Important_Notifications (토스트, 5초 표시):
  - "수익 정산: +2,500 MC (건물 12개)"
  - "전투 승리! [도시명] 3개 건물 획득"
  - "합병 가능: [구역명]에서 3개 건물 합병 가능"

Background_Updates (뉴스피드에만 표시):
  - "[플레이어X]가 [도시명] 지배권 획득"
  - "주간 레전더리 경매 시작: 에펠탑"
  - "[동맹명] 동맹 결성"

Delivery_Channel:
  - 앱 포그라운드: 토스트 + 인앱 사운드
  - 앱 백그라운드: 서비스워커 Push 알림
  - 오프라인: 다음 접속 시 요약 대시보드에 누적
```

---

## 7. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| Railway PG + Go 연동 복잡도 | 중 | pgx 드라이버 + connection pool 표준 패턴 |
| 전투 시뮬레이션 서버 부하 | 고 | 배치 큐 + 동시 전투 수 제한 (50개) |
| 실시간 195국 상태 브로드캐스트 부하 | 중 | 기존 WorldManager 1Hz 패턴 (변경분만 전송) |
| 10분 체크인 vs 실시간 전쟁 충돌 | 고 | 비동기 전투 + 오프라인 보호 + 알림 |
| 초기 유저 부족 (빈 서버) | 고 | NPC 국가 (봇 아닌 서버 로직) + 점진적 오픈 |
| Supabase ↔ Railway PG 데이터 동기화 | 중 | MC 단방향 동기화 (Railway→Supabase, 5분 간격) |

---

## 7. 수정 대상 파일 요약

### Phase별 영향 범위
| Phase | 새 파일 | 수정 파일 | 삭제 파일 |
|-------|---------|----------|----------|
| Phase 0 | ~5 | ~10 | ~25 (에이전트/봇) |
| Phase 1 | ~15 (DB+영토) | ~8 | 0 |
| Phase 2 | ~10 (전투) | ~5 | 0 |
| Phase 3 | ~8 (경제) | ~6 (기존 엔진 수정) | 0 |
| Phase 4 | ~12 (UI) | ~10 | 0 |
| Phase 5 | ~8 (외교/동맹) | ~4 | 0 |
| Phase 6 | ~6 (리플레이) | ~3 | 0 |
| Phase 7 | ~5 (시즌/이벤트) | ~4 | 0 |

---

## 구현 로드맵

> 이 섹션은 da:work Stage 0이 자동 파싱합니다.
> 복잡도가 높아 별도 roadmap 파일로 분리: `docs/designs/world-war-tycoon-roadmap.md`

### Phase 0: 정리 + DB 인프라 신규 구축 (2~3주)
| Task | 설명 |
|------|------|
| 에이전트 코드 삭제 | agent_api.go, llm_bridge.go, bot.go, agent_stream.go, ar_*.go 삭제 |
| pgx 드라이버 추가 | go.mod에 github.com/jackc/pgx/v5 추가 (현재 PG 드라이버 0개) |
| DB 레이어 신규 구축 | connection pool + query builder + 트랜잭션 헬퍼 (기존 Supabase REST와 별도) |
| 마이그레이션 프레임워크 | golang-migrate 또는 goose 도입 |
| 핵심 테이블 생성 | players, buildings, territories, armies, battles, auctions, alliances, wars |
| Supabase↔Railway 동기화 | MC 단방향 동기화 (Railway→Supabase, 5분 간격) |
| WS 프로토콜 확장 | 새 이벤트 타입 정의 (attack_order, territory_update, building_purchase 등) |

- **design**: N
- **verify**: Go 서버 빌드 성공, Railway PG 연결+쿼리, 테이블 생성, 에이전트 코드 0줄

### Phase 1: 영토 시스템 + 건물 카탈로그 (3주)
| Task | 설명 |
|------|------|
| 건물 카탈로그 DB 시딩 | 서울 50개 + 도쿄 50개 + 뉴욕 50개 = 150개 건물 |
| BuildingManager Go 구현 | app_ingame TS 설계 참고, Go 서버에서 재구현 (CRUD+소유권+가치계산) |
| 건물 구매 (즉시구매) API | WS 이벤트 + Railway PG 트랜잭션 |
| AuctionEngine Go 구현 | app_ingame TS 설계 참고, Go 서버에서 재구현 (경매+NPC+anti-snipe) |
| IncomeCalculator Go 구현 | app_ingame TS 설계 참고, Go 서버에서 재구현 (수익+유지비+감가상각) |
| TerritoryEngine 변환 | 기존 RP 누적 → 건물 소유 비율 기반으로 OnBuildingOwnershipChange 로직 작성 |
| Globe 영토 시각화 | GlobeDominationLayer 데이터 파이프라인 변경 (서버 영토 데이터 → CountryDominationState) |
| City 3D 뷰 소유자 색상 | InstancedBuildings setColorAt에 ownerId→색상 매핑 추가 |

- **design**: Y (City 3D 소유자 표시, Globe 영토 색상)
- **verify**: 건물 구매→소유권→수익 정산→영토 지배 전체 플로우

### Phase 2: 군사 시스템 + 전투 (3~4주)
| Task | 설명 |
|------|------|
| 유닛 시스템 Go 구현 | 보병/기갑/공중/특수 유닛 정의, 생산(MC+시간), 유지비 |
| 방어 시설 시스템 Go | 벙커/포탑/대공포/성벽/본부 건설 + 배치 로직 |
| 군대 이동 시스템 Go | 공격 명령 → 거리 기반 이동 시간 → 도착 스케줄링 (time.Timer) |
| BattleSimulator 신규 개발 | 완전 새로운 배치형 자동전투 엔진 (Arena 재활용 불가, tick loop 패턴만 참고) |
| 전투 결과 처리 Go | 승/패 판정, MC 약탈, 건물 소유권 이전 (PG 트랜잭션) |
| 전투 리플레이 데이터 저장 | 틱별 유닛 위치/행동 → battles 테이블 JSONB |
| 실시간 군대 이동 Globe | GlobeWarEffects 확장 — 이동 중 군대 화살표 표시 (1Hz 브로드캐스트) |
| 전투 알림 WS | 공격 받았을 때 Hub.SendToClient 즉시 알림 |

- **design**: Y (유닛 배치 UI, 군대 이동 Globe 표시, 전투 결과 UI)
- **verify**: 공격 명령→이동→전투시뮬→결과→영토변경 전체 플로우

### Phase 3: 경제 심화 + 거래소 (2주)
| Task | 설명 |
|------|------|
| 군대 유지비 시스템 Go | 보유 유닛 수 비례 MC 자동 차감 (수익 정산 시 함께 처리) |
| MergeSystem Go 구현 | app_ingame TS 설계 참고, Go 서버에서 재구현 |
| 플레이어 거래소 Go | 건물 P2P 거래 (매도/매수 오더북, PG 트랜잭션) |
| 수익 정산 고도화 | 지배 보너스(구역/도시/국가) + 시너지를 IncomeCalculator에 반영 |
| 경제 대시보드 UI | 수익/지출/자산 현황 표시 |

- **design**: Y (거래소 UI, 경제 대시보드)
- **verify**: 거래소 주문 매칭, 합병 플로우, 수익 정산 정확성

### Phase 4: 전투 리플레이 + City 3D (2주)
| Task | 설명 |
|------|------|
| 전투 리플레이 저장 | BattleSimulator 틱별 데이터 → Railway PG |
| 3D 리플레이 플레이어 | city3d 엔진으로 전투 재생 (유닛 이동/공격/파괴) |
| City 3D 방어 시설 렌더링 | 포탑/벙커/성벽 3D 모델 |
| 전투 중 도시 이펙트 | 불타는 건물, 폭발, 연기 등 |
| 리플레이 공유 | 리플레이 링크 생성 + 관전 |

- **design**: Y (리플레이 UI, 방어시설 3D 디자인)
- **verify**: 리플레이 재생, 3D 이펙트, 관전 링크

### Phase 5: 외교 + 동맹 + 전쟁 (2주)
| Task | 설명 |
|------|------|
| Alliance PG 영속화 | 기존 AllianceManager 로직 유지 + PG 저장/조회 추가 (현재 100% 인메모리) |
| WarSystem 주권 로직 재작성 | 상태머신 재활용, 점수 체계를 건물소유 기반으로 변환 |
| Sovereignty 판정 변환 | 전투 RP → 건물 소유 비율 기반 주권 판정 |
| 공동 방어 로직 | 동맹원 영토 공격 시 자동 지원 부대 |
| 외교 채팅 | 동맹 내 채팅 (WebSocket 기반) |
| Globe 동맹/전쟁 시각화 | 기존 GlobeAllianceBeam + GlobeWarEffects 연동 |

- **design**: Y (동맹 UI, 전쟁 선포 UI, 채팅)
- **verify**: 동맹 결성→공동방어→전쟁선포→전쟁해결 플로우

### Phase 6: 글로벌 이벤트 + 뉴스 (1주)
| Task | 설명 |
|------|------|
| 글로벌 이벤트 시스템 | 영토 변경/전쟁/대형 거래 등 서버 이벤트 |
| 뉴스피드 UI | 기존 NewsFeed 컴포넌트 확장 |
| 알림 시스템 | 공격/경매마감/수익정산 Push 알림 (WebSocket + 서비스워커) |
| 리더보드 | 부자/지주/정복왕/제국/동맹 5종 랭킹 |
| 일일 출석 + 업적 | 기존 EventManager + AchievementManager 연동 |

- **design**: Y (뉴스피드, 리더보드, 알림)
- **verify**: 이벤트 실시간 표시, 리더보드 정렬, 알림 수신

### Phase 7: 시즌 + 이벤트 + 폴리싱 (1주)
| Task | 설명 |
|------|------|
| 시즌 시스템 | 3개월 시즌, 시즌 종료 시 보상/리셋 |
| 주간 이벤트 | 세계 대전 (금요일), Flash Sale (주말) |
| Legendary 경매 | 주 1회 세계 랜드마크 경매 |
| 튜토리얼 | 첫 건물 구매 → 첫 유닛 생산 → 첫 공격 가이드 |
| 성능 최적화 | 195국 브로드캐스트 최적화, 3D LOD |
| PWA 설정 | 모바일 PWA manifest, 서비스워커 |

- **design**: Y (튜토리얼, 시즌 UI)
- **verify**: 시즌 리셋, 이벤트 자동 실행, PWA 설치 가능, Lighthouse ≥ 80

</content>
</invoke>