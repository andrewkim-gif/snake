# PLAN: v17 SuperPower Agent Intelligence System

## 1. 개요

SuperPower 2의 검증된 지정학 시뮬레이션 시스템(27개 자원 경제, DR 외교, 유닛 상성 군사, 6종 정부 형태 정치)을 AI World War에 통합하여, 외부 AI 에이전트(LLM/커스텀 봇)가 **전투 + 경제 + 외교 + 군사 + 정치** 5개 도메인을 자율 운영할 수 있는 플랫폼으로 확장.

**상세 기획서**: `docs/designs/v17-superpower-agent-system-plan.md` (1,539줄)

## 2. 요구사항

### 기능 요구사항
- [FR-1] 12종 자원 기반 경제 시스템 (SP2의 27종 → 12종 축약, GDP/세금/예산 공식 보존)
- [FR-2] DR(-100~+100) 외교 시스템 + 10종 조약 (양자+다자, Common Market 포함)
- [FR-3] 5종 유닛 클래스 + 상성 매트릭스 + 기술 레벨 + 훈련 등급
- [FR-4] 6종 정부 형태 (모든 시스템에 수정자 적용) + 지지율/선거/쿠데타
- [FR-5] aww-agent-skill SDK v2 — 5 도메인 에이전트 API
- [FR-6] LLM 통합 프로토콜 — 자연어 브리핑 + JSON 결정 형식
- [FR-7] 5 도메인 서버 REST API v2 + Meta WebSocket
- [FR-8] 통합 WorldMemory 학습 시스템 (시즌 간 전이)

### 비기능 요구사항
- [NFR-1] SDK v1 하위호환: 기존 전투 전용 에이전트 100% 작동
- [NFR-2] LLM 응답 타임아웃 2초 + 규칙 기반 폴백
- [NFR-3] 경제/외교/정치 API Rate Limit (10-20 req/hour)
- [NFR-4] v16 SimEngine 통합 (Headless 밸런스 테스트 가능)

## 3. 기술 방향
- **백엔드**: Go 1.24 — 기존 서버 확장 (game/ + meta/ + api/ + ws/)
- **SDK**: TypeScript — aww-agent-skill v2 (5 도메인 + LLM 브릿지)
- **프로토콜**: REST (정책 결정) + WebSocket (실시간 이벤트) + GameWS (전투)
- **SP2 충실도**: 검증된 공식 최대한 보존 (SP3 실패 교훈 반영)

## 4. 아키텍처 개요

```
외부 AI 에이전트 (LLM / 커스텀 봇)
        │
        ▼
aww-agent-skill SDK v2 (5 Domain)
├── CombatDomain  → GameWS (20Hz)
├── EconomyDomain → MetaREST + MetaWS (1Hz)
├── DiplomacyDomain → MetaREST + MetaWS
├── MilitaryDomain → MetaREST + MetaWS
└── PoliticsDomain → MetaREST + MetaWS
        │
        ▼
Go 서버 (확장)
├── game/ (전투 + 유닛 클래스 + 상성)
├── meta/ (경제v2 + 외교v2 + 정치 + 군사관리)
├── api/  (v2 REST 엔드포인트 × 5 도메인)
├── ws/   (Meta 이벤트 스트림)
└── domain/ (12자원 + 6정부 + 5유닛 + 10조약 타입)
```

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 시스템 복잡성 폭발 | 개발 지연 | Phase별 도메인 점진 추가, 독립 테스트 |
| LLM API 비용 | 유저 부담 | 2K 토큰 브리핑 압축, 유저 자체 API키, 기본 봇 무료 |
| 밸런스 붕괴 | 유저 이탈 | v16 Headless 시뮬 100회 밸런스 검증 |
| 정부형태 편중 | 전략 단순화 | 각 형태 고유 장점 강화 |
| 다자조약 남용 | 경제 독점 | Common Market 10국 상한, DR 점진 상승 요건 |
| 신규 유저 진입장벽 | 유저 이탈 | 기본 어드바이저 자동 설정, 전투만으로도 플레이 가능 |

## 구현 로드맵

### Phase 1: 기반 타입 & 12종 자원 시스템
| Task | 설명 |
|------|------|
| 도메인 타입 정의 | `domain/resources.go` — 12종 자원, ResourceState, 생산/소비 공식 |
| 정부 타입 정의 | `domain/government.go` — 6종 정부 형태, 수정자, GovernmentType |
| 유닛 클래스 정의 | `domain/units.go` — 5종 유닛, 상성 매트릭스, TrainingGrade |
| 조약 타입 정의 | `domain/treaties.go` — 10종 조약, 양자/다자, DR 요건 |
| 경제 엔진 v2 | `meta/economy_v2.go` — 12종 자원 생산/소비, SP2 GDP, 3층 세금, 8종 예산 |

- **design**: N
- **verify**: 빌드 성공, 단위 테스트 (GDP/자원/세금 공식)

### Phase 2: DR 외교 & 다자 조약 시스템
| Task | 설명 |
|------|------|
| DR 시스템 | `meta/diplomacy_v2.go` — 195×195 DR 매트릭스, 자동 보정 |
| 다자 조약 | MultilateralTreaty, Common Market 자원 공유 |
| 기존 통합 | v1 양자 조약 → v2 DR 기반 마이그레이션 |

- **design**: N
- **verify**: DR 계산 테스트, 다자 조약 테스트, Common Market 분배 테스트

### Phase 3: 정치 시스템 & 유닛 클래스
| Task | 설명 |
|------|------|
| 정치 엔진 | `meta/politics.go` — 6종 정부, 지지율, 선거/쿠데타 |
| 유닛 시스템 | `game/unit_system.go` — 5종 유닛, 상성, 기술/훈련 |
| Agent 확장 | UnitClass, TechLevel, TrainingGrade 필드 추가 |

- **design**: N
- **verify**: 정부 수정자 테스트, 유닛 상성 전투 테스트

### Phase 4: 서버 API v2 + 5-Layer 거버넌스 통합
| Task | 설명 |
|------|------|
| 5 도메인 REST API | economy/diplomacy/military/politics/world routes + 거버넌스 API |
| 5-Layer Auth Chain | JWT→팩션역할→주권/패권→조건부→온체인 거버넌스 미들웨어 |
| v11 정책 마이그레이션 | `policy.go` 4슬라이더 → v17 세금/예산 시스템 흡수 통합 |
| Meta WebSocket | 메타 이벤트 실시간 스트림 (1Hz) |
| 권한 조회 API | `/permissions` — 에이전트의 현재 권한 사전 체크 |
| 온체인 거버넌스 연동 | `GovernanceModule.sol` ↔ 서버 콜백 (제안→투표→실행) |
| LLM 부분 실행 | `/agent/llm/decide` — 액션별 개별 권한 검증, 부분 실행 응답 |

- **design**: N
- **verify**: 5-Layer 거부 시나리오 테스트, 온체인 투표 플로우 테스트, LLM 부분 실행 테스트, v11 마이그레이션 회귀 테스트

### Phase 5: LLM 통합 API
| Task | 설명 |
|------|------|
| LLM 브리핑 생성 | 5 도메인 통합 브리핑 JSON (2K 토큰 압축) |
| LLM 결정 파서 | JSON 응답 → 각 도메인 액션 실행 |
| 폴백 처리 | 타임아웃 시 규칙 기반 기본 결정 |

- **design**: N
- **verify**: 브리핑/파싱 테스트, 폴백 동작 테스트

### Phase 6: aww-agent-skill SDK v2
| Task | 설명 |
|------|------|
| MetaClient | Meta REST + WS 클라이언트 |
| 5 도메인 클래스 | combat/economy/diplomacy/military/politics.ts |
| AWWAgent v2 | 5 도메인 오케스트레이터 + v1 하위호환 |
| 기본 어드바이저 | 4종 규칙 기반 AI |
| LLM 브릿지 | Claude/GPT/Llama 추상화 |

- **design**: N
- **verify**: SDK 빌드, 타입 검사, 어드바이저 동작 테스트

### Phase 7: 예제 & 문서
| Task | 설명 |
|------|------|
| 예제 3종 | full-nation / llm-nation / economic-optimizer |
| README v2 | SDK v2 전체 문서 |
| OpenAPI spec | 서버 v2 API 스펙 |

- **design**: N
- **verify**: 예제 실행 성공

### Phase 8: SimEngine 통합 & 밸런스
| Task | 설명 |
|------|------|
| v16 SimEngine 연동 | v17 경제/외교/정치 시스템 사용 |
| Headless 밸런스 | ×1000 배속 100회 시뮬 → 밸런스 검증 |
| 수치 튜닝 | 파라미터 조정 |

- **design**: N
- **verify**: 시뮬 100회 완주, 정부형태 6종 생존, GDP 분포 합리적

### Phase 9: 프론트엔드 UI (선택적)
| Task | 설명 |
|------|------|
| Economy Dashboard | 자원 차트, 세금/예산 슬라이더 |
| Diplomacy Panel | DR 히트맵, 조약 관리 |
| Military/Politics Panel | 유닛 구성, 정부 형태, 지지율 |

- **design**: Y
- **verify**: 렌더링, 반응형, API 연동
