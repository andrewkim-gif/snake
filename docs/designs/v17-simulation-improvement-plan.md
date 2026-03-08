# PLAN: v17 시뮬레이션 기반 게임 시스템 개선

## 1. 개요

### 배경
AI World War v16 서버에 LLM 기반 에이전트 10개를 투입하여 7회 시뮬레이션(각 5분, 총 ~2,300 액션)을 수행한 결과, 성공률이 78% → 98.4%로 개선되었으나 **서버 측 구조적 결함** 다수가 발견되었다.

### 핵심 목표
시뮬레이션에서 발견된 P0~P3 이슈를 체계적으로 해결하여, AI 에이전트와 실제 플레이어가 안정적으로 외교/경제/전쟁 시스템을 활용할 수 있도록 한다.

### 시뮬레이션 근거 데이터
| 지표 | 라운드 1 | 라운드 7b | 목표 |
|------|---------|----------|------|
| 전체 성공률 | 78% | 96.9% | 99%+ |
| 외교 성공률 | 0% | 94% | 99% |
| 조약 수락률 | 0% | 0% | 50%+ |
| 거래 체결률 | 0% → 100%(API) | 97%(API) | 실제 매칭 |
| 서버 안정성 | 빈번한 crash | 간헐적 무응답 | 무중단 |

## 2. 요구사항

### 기능 요구사항
- [FR-1] 조약 수락/거절 플로우가 정상 작동해야 한다 (pending 조약 가시성)
- [FR-2] 거래 주문 매칭이 실제로 체결되어 자원/골드가 이동해야 한다
- [FR-3] GDP 랭킹이 실시간으로 계산 및 표시되어야 한다
- [FR-4] 인텔 쿨다운이 게임 시간에 비례하여 조정되어야 한다
- [FR-5] 에이전트 메모리 컨텍스트가 이전 틱 결과를 반영해야 한다
- [FR-6] 옵저버 대시보드가 실시간 GDP/전쟁/조약 상태를 표시해야 한다

### 비기능 요구사항
- [NFR-1] 동시 접속 50명에서 서버 무응답 없이 안정 운영
- [NFR-2] WebSocket 메시지 지연 100ms 이내
- [NFR-3] 경제 틱 처리 시간 500ms 이내
- [NFR-4] 서버 재시작 없이 24시간 연속 운영 가능

## 3. 기술 방향

### 기존 스택 유지
- **서버**: Go (기존 v16 코드베이스)
- **클라이언트**: Next.js 15 + React + Three.js
- **에이전트**: TypeScript (aww-agent-skill 패키지)
- **통신**: WebSocket (gorilla/websocket) + REST API

### 핵심 설계 원칙
1. **기존 코드 최대 활용**: 거래 매칭 엔진, GDP 계산 로직 등 이미 구현된 코드의 와이어링만 수정
2. **최소 변경 원칙**: 새로운 시스템 도입보다 누락된 연결을 복원하는 데 집중
3. **에이전트 우선 검증**: 모든 변경은 10-에이전트 시뮬레이션으로 즉시 검증

## 4. 아키텍처 개요 (수정 대상)

```
[에이전트/클라이언트]
    │
    ├─ REST API ──────────────────────────┐
    │   ├─ /diplomacy/propose|accept|reject│
    │   ├─ /diplomacy/pending/{factionID}  │ ← 에이전트 SDK에서 호출 추가
    │   ├─ /trade/orders                   │
    │   └─ /gdp/ranking                   │
    │                                      │
    └─ WebSocket ──────────────────────────┤
        ├─ Hub (단일 고루틴)               │
        │   └─ 채널 버퍼 256 → 1024 확대  │ ← 데드락 방지
        ├─ Client (ReadPump + WritePump)   │
        └─ EventCallback (비동기화)        │ ← Room.mu 락 아래서 Hub push 제거
                                           │
[Go 서버 내부]                              │
    ├─ FactionManager ─────────────────────┤
    │   ↕ SetFactionManager()              │ ← main.go에서 와이어링 추가
    ├─ TradeEngine ────────────────────────┤
    │   ↕ SetEconomyEngine()              │ ← main.go에서 와이어링 추가
    │   ↕ SetFactionManager()             │ ← main.go에서 와이어링 추가
    │   ↕ SetDiplomacyEngine()            │ ← main.go에서 와이어링 추가
    ├─ EconomyEngine ──────────────────────┤
    │   ↕ SetFactionManager()             │ ← main.go에서 와이어링 추가
    │   ↕ SetDiplomacyEngine()            │ ← main.go에서 와이어링 추가
    └─ GDPEngine ──────────────────────────┘
        ↕ UpdateRankings() 주기 호출 추가
```

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 엔진 와이어링 추가 시 nil panic | 서버 crash | 각 Set 메서드 호출 후 nil 체크 테스트 |
| Hub 채널 버퍼 확대 시 메모리 증가 | OOM 가능 | 256→1024 수준으로 제한, 모니터링 |
| 거래 매칭 활성화 시 자원 밸런스 붕괴 | 게임 밸런스 파괴 | 시뮬레이션으로 밸런스 검증 후 적용 |
| Room.mu 데드락 해결 시 이벤트 순서 변경 | 클라이언트 동기화 깨짐 | 이벤트 시퀀스 번호 도입 |
| 인텔 쿨다운 단축 시 스팸 가능 | 서버 부하 | 에이전트당 쿨다운 + 글로벌 레이트 리밋 |
| Room.mu ↔ RoomManager.mu 락 순서 역전 | 서버 데드락 | tickCooldown의 OnRotate를 mu 밖에서 호출, 락 순서 문서화 |
| SDK 응답 키 불일치 (proposals vs treaties) | 외교 플로우 전체 실패 | 서버/SDK 키 통일 후 통합 테스트 |

---

## 구현 로드맵

### Phase 1: 서버 안정성 — WebSocket 데드락 해결 + 동시 접속 강화

**근거**: P0 — 10개 에이전트 동시 접속 시 서버 무응답 (코드 1006 끊김, HTTP fetch failed)

| Task | 설명 |
|------|------|
| Hub 채널 버퍼 확대 | `server/internal/ws/hub.go` — send 채널 버퍼 256→1024 확대. `trySend()` 비차단 전송 보장 |
| EventCallback 비동기화 | `server/internal/game/room.go` — `Room.tick()` 내 `createWorldEventHandler`가 Room.mu 락 하에서 Hub 채널 push하는 구조 제거. 이벤트를 별도 채널로 큐잉 후 mu 밖에서 전송 |
| Room.mu 락 범위 축소 | `server/internal/game/room.go` — tick() 내 상태 계산만 mu 보호, 이벤트 브로드캐스트는 mu 밖에서 실행 |
| WebSocket graceful shutdown | `server/internal/ws/client.go` — 연결 종료 시 CloseMessage 전송 + 읽기/쓰기 펌프 정리 순서 보장 |
| 연결 속도 제한 | `server/internal/ws/hub.go` — IP당 초당 최대 5개 연결 제한 (에이전트 동시 접속 보호) |
| Lock-ordering 통일 | `room.go` + `room_manager.go` — **확인된 데드락**: `tickCooldown()`이 Room.mu 보유 상태에서 `OnRotate()` → `rotateRoom()` → RoomManager.mu 획득. 반면 `JoinRoom()`은 RoomManager.mu → `RemovePlayer()` → Room.mu 순서. 락 순서 역전으로 교착 상태 발생. **수정**: `OnRotate` 콜백을 Room.mu 밖에서 호출하도록 변경 |

- **design**: N (서버 내부 구조 수정)
- **verify**: 10개 에이전트 동시 접속 5분간 서버 무응답 0회, WebSocket 코드 1006 끊김 0회, Room 상태 전환 시 데드락 0회

### Phase 2: 경제 엔진 와이어링 — 거래 매칭 활성화 + GDP 실시간 계산

**근거**: P2-6 — 거래 시장이 write-only (매칭 엔진은 구현되어 있으나 의존성 주입 누락)

| Task | 설명 |
|------|------|
| main.go 의존성 와이어링 (8개) | `server/cmd/server/main.go` — 현재 `SetBroadcaster`만 호출됨. 누락된 **8개 Set* 호출** 추가: `tradeEngine.SetFactionManager(fm)`, `.SetEconomyEngine(ee)`, `.SetDiplomacyEngine(de)`, `economyEngine.SetFactionManager(fm)`, `.SetDiplomacyEngine(de)`, `intelSystem.SetFactionManager(fm)`, `.SetTechTreeManager(ttm)`, `mercenaryMarket.SetFactionManager(fm)`. 와이어링 순서: FactionManager → EconomyEngine → DiplomacyEngine → TradeEngine → IntelSystem → MercenaryMarket |
| nil 안전 가드 | 각 엔진의 Set 메서드 호출 후 nil 체크. 와이어링 순서: FactionManager → EconomyEngine → DiplomacyEngine → TradeEngine |
| 거래 만료 주기 호출 | `tradeEngine.ExpireOldOrders()` — 경제 틱(1시간)마다 호출 추가. 24시간 이상 미체결 주문 자동 취소 |
| GDP 랭킹 주기 갱신 | `gdpEngine.UpdateRankings()` — 경제 틱마다 호출. 171개국 GDP 기반 랭킹 재계산 |
| 인텔 쿨다운 조정 | `server/internal/meta/intel.go` — 쿨다운 1시간→5분 (또는 타겟별 쿨다운). 게임 시간에 비례 |

- **design**: N (서버 로직 와이어링)
- **verify**: 거래 주문 체결 시 자원/골드 실제 이동 확인, GDP 랭킹 API 비어있지 않음, 인텔 쿨다운 5분 확인

### Phase 3: 외교 플로우 완성 — 조약 수락/거절 정상화

**근거**: P1-1,3 — 라운드당 40건 조약 제안 → 수락 0건. pending 조약이 수신자에게 보이지 않음

| Task | 설명 |
|------|------|
| SDK 응답 키 불일치 수정 | **CRITICAL**: `diplomacy.ts`의 `getPendingProposals()`가 `res.treaties`를 읽지만 서버는 `{"proposals":[...]}` 키로 반환 → `res.proposals`로 수정. 이 버그 때문에 현재 항상 빈 배열 반환 |
| gatherState에 별도 pending 호출 추가 | `nation-agent.ts` — 현재 `gatherState()`는 `getActiveTreaties()`만 호출 (line 247). 서버의 `GetActiveTreaties()`는 `StatusActive`만 반환하므로 pending이 절대 포함 안 됨. **별도로** `getPendingProposals(factionId)` 호출 추가 + 결과를 `pendingTreaties`에 직접 대입. 기존 `treaties.filter(t => t.status === 'pending')` 로직 제거 |
| 프롬프트 pending 섹션 검증 | `prompts.ts` — "Pending Treaty Proposals (respond!)" 섹션은 이미 구현됨 (line 119). 데이터만 정상 공급되면 자동 표시. 추가 작업 불필요 (검증만) |
| accept_treaty 실행 검증 | `nation-agent.ts` — `accept_treaty` 액션에서 조약 ID로 `/diplomacy/accept` 호출. 서버의 `handleAccept()`는 `FactionB == factionID` 검증 수행. 에러 핸들링 보강 |
| 서버 응답 래핑 일관성 검증 | pending API가 `{proposals:[], count:N}` 형태로 반환. SDK에서 `proposals` 키로 언래핑 처리 확인. `getActiveTreaties()`의 `{treaties:[]}` 키와 통일 여부 검토 |

- **design**: N (SDK + 프롬프트 로직)
- **verify**: 시뮬레이션에서 조약 수락률 50%+ 달성, accept_treaty 성공률 80%+

### Phase 4: 에이전트 지능 강화 — 메모리 컨텍스트 + 전략 고도화

**근거**: P3-9,10 — memoryContext의 Diplomatic Notes/Strategic Goals 섹션이 dead code, 기술 투자 42% 편중

**기존 인프라**: `memory.ts`에 이미 `AgentMemory` 클래스가 구현됨. `toPromptContext()`는 3개 섹션(Recent Decisions, Diplomatic Notes, Strategic Goals)을 생성하지만, `setRelation()`과 `setGoals()`가 어디서도 호출되지 않아 후자 2개가 항상 비어있음. Recent Decisions는 `executeActions()` 후 `memory.log()`로 이미 기록 중.

| Task | 설명 |
|------|------|
| AgentMemory 와이어링 (기존 인프라 활용) | `nation-agent.ts` — `executeActions()`에서 외교 결과 시 `memory.setRelation(factionId, sentiment, note)` 호출 (예: propose_treaty 성공 → "proposed trade_agreement"). 전략 틱 시작 시 `memory.setGoals()` 호출. **새로 구현하지 않고** `memory.ts`의 dead code를 와이어링 |
| GDP 변화 추적 | `nation-agent.ts` — `private gdpHistory: number[]` 필드 추가. 틱별 GDP 스냅샷 저장, `gatherState()`에 GDP 성장률(%) 계산. 프롬프트에 "GDP Growth: +2.3% vs last tick" 표시 |
| 전략 다양화 유도 | `nation-agent.ts` — `private actionHistory: string[]` 필드 추가. 최근 5틱 액션 타입 기록. 같은 액션 3회 연속 시 프롬프트에 "STRATEGY DIVERSITY: invest_tech used 3 times in a row" 경고 삽입 |
| 기술 투자 진행률 표시 | `completedTech` 갱신은 이미 동작 중 (매 틱 서버에서 `getResearch()` 호출). 대신 **부분 투자 상태**(`node_progress` 필드)를 프롬프트에 표시하여 "eco_2: 150/500 invested" 형태로 에이전트가 남은 투자량을 인식하도록 개선 |

- **design**: N (에이전트 로직)
- **verify**: memoryContext 비어있지 않음 확인, 기술 투자 비율 42%→30% 이하로 분산, 액션 다양성 지수 향상

### Phase 5: 옵저버 대시보드 + 시뮬레이션 검증

**근거**: P3-8 — 월드 스냅샷 GDP/Wars/Treaties 모두 비어있음, 시뮬레이션 품질 지표 부재

| Task | 설명 |
|------|------|
| 옵저버 GDP 표시 수정 | `aww-agent-skill/src/sim/observer.ts` — GDP 랭킹 API 응답을 파싱하여 옵저버 리포트에 Top 10 국가 GDP 표시 |
| 전쟁/조약 상태 표시 | 옵저버에 활성 전쟁 수, 활성 조약 수, 대기 중 조약 수 실시간 표시 |
| 시뮬레이션 자동 리포트 | `run.ts` — 라운드 종료 시 자동으로 액션 분포, 성공률, 에러 분류, GDP 변화 리포트 생성 |
| 10-에이전트 통합 검증 | Phase 1~4 전체 변경사항 적용 후 10개 에이전트 시뮬레이션 3회 실행. 목표: 성공률 99%+, 조약 수락 50%+, 거래 실제 체결 확인, 서버 무중단 |
| 시뮬레이션 결과 비교 분석 | v17 전후 시뮬레이션 결과 비교표 생성. 모든 KPI 개선 확인 |

- **design**: N (옵저버 로직 + 검증)
- **verify**: 옵저버 GDP 데이터 표시됨, 시뮬레이션 3회 연속 성공률 99%+, 서버 5분간 무중단
