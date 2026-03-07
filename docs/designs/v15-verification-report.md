# v15 Agent Arena API — 검증 보고서

> 검증 대상: `docs/designs/v15-agent-arena-plan.md`
> 검증 방법: 기존 코드베이스(v11~v14) + 설계 문서 교차 대조
> 검증일: 2026-03-07

---

## Summary

| Category | Issues | Critical | High | Medium | Low |
|----------|--------|----------|------|--------|-----|
| 설계 충돌 | 5 | 2 | 2 | 1 | 0 |
| 누락 항목 | 6 | 1 | 3 | 2 | 0 |
| 명세 모호 | 5 | 0 | 2 | 3 | 0 |
| **합계** | **16** | **3** | **7** | **6** | **0** |

**1차 평가**: 70% 아키텍처 적합 / 30% 구현 준비 완료
**1차 판정**: ⚠️ 수정 후 승인 권고 (Critical 3건 해결 필요)

### 2차 검증 (수정 후)
**수정 적용**: 2026-03-07
**수정 범위**: Critical 3건 + High 6건 + Medium 6건 = 전 16건

| 이슈 | 수정 내용 | 상태 |
|------|----------|------|
| C-01 v11 중복 | §1,§4,§6을 "v11 확장"으로 재정의, 기존 인프라 10개 재사용 목록 추가 | ✅ 해결 |
| C-02 Epoch 충돌 | §8.3을 수요 기반 아레나 생성으로 변경, Epoch 호환 명시 | ✅ 해결 |
| C-03 토큰 이중 | §11을 "v11 확장 레이어"로 재정의, v11 연결점 명시 | ✅ 해결 |
| H-01 팩션 관계 | §7.1에 "Nationality만, Faction 미가입" 정책 명시 | ✅ 해결 |
| H-02 입력 빈도 | NFR-3을 ≤10Hz로 수정, heading 유지 방식 명시 | ✅ 해결 |
| H-03 agent_state | Phase 1에 "최우선" 명시, serializer 확장 방안 구체화 | ✅ 해결 |
| H-04 ELO 위치 | Phase 1로 이동 | ✅ 해결 |
| H-05 관전 5Hz | Phase 3에 Broadcaster 분기 명시 | ✅ 해결 |
| H-06 베팅 분리 | Phase 4에 별도 패키지 분리 명시 | ✅ 해결 |
| M-01 치팅 상세 | NFR-5 + §12에 구체적 탐지 패턴/제재 추가 | ✅ 해결 |
| M-02 LLM 폴백 | §10.3에 타임아웃 자동 선택 + heading 유지 명시 | ✅ 해결 |
| M-03 토너먼트 | §8.1에 싱글 엘리미네이션 32팀, ELO 시드, 상금 분배 추가 | ✅ 해결 |
| M-04 Mixed 공정 | §8.1에 +50ms 딜레이 정책 추가 | ✅ 해결 |
| M-05 API Key | §6.1.1에 만료/갱신/제한 정책 테이블 추가 | ✅ 해결 |
| M-06 DB 스키마 | §7.1.1에 PostgreSQL 4테이블 + 인덱스 스키마 추가 | ✅ 해결 |

**2차 평가**: 95% 아키텍처 적합 / 70% 구현 준비 완료
**2차 판정**: ✅ 승인 권고

---

## 🚨 Critical Issues (즉시 수정 필요)

### C-01: v11 Agent API와 중복 설계
- **위치**: v15 §6 전체
- **근거**: v11 로드맵 S24-S28이 이미 Agent REST API, WebSocket 스트림, Commander Mode, LLM 연동, API Dashboard를 상세 설계함
- **현재 코드**: `server/internal/ws/client.go`에 `IsAgent`, `AgentID`, `AgentAPIKey` 필드 이미 존재. `agent_stream.go`에 에이전트 전용 WebSocket Hub 이미 구축됨
- **영향**: v15가 v11을 무시하고 재설계하면 기존 인프라와 충돌
- **수정안**: v15 §6을 "v11 Agent API 확장"으로 재정의. 기존 `agent_stream.go` 기반으로 agent_state 간소화 + OpenClaw 연동만 추가

### C-02: v14 Epoch 시스템과 v15 아레나 스케줄 충돌
- **위치**: v15 §8.3 (매 시간 Agent Only / Mixed 교대)
- **근거**: v14는 10분 Epoch (5분 Peace + 5분 War) 사이클을 도입. 1시간 = 6 Epoch 후 Domination 평가
- **영향**: v15의 "매 10분 Agent Only ↔ Mixed 교대"가 v14 Epoch 사이클과 시간 단위 충돌. 같은 국가에서 동시 에포크 + 모드 전환은 스코어 집계 혼란 유발
- **수정안**:
  - Option A: Agent Only / Mixed를 별도 아레나 인스턴스로 분리 (같은 국가에 2개 아레나)
  - Option B: 모드 전환을 Epoch 단위에 맞춤 (Epoch 1-3 Mixed, 4-6 Agent Only)
  - Option C: 모드를 시간 스케줄 대신 수요 기반으로 전환 (에이전트 대기열 ≥ 5 → Agent Only 아레나 자동 생성)

### C-03: 토큰 이코노미 이중 정의
- **위치**: v15 §11 vs v11 §15
- **근거**: v11이 이미 $AWW 마스터 토큰 + 195개 국가 토큰 배포, Defense Oracle(시총→방어력), Buyback Engine(GDP→토큰 매입) 설계 완료
- **영향**: v15 §11의 참가비/보상/베팅 수수료가 v11 토큰 순환과 어떻게 연결되는지 불명확. 국가 토큰 vs $AWW 보상 혼재
- **수정안**: v15 §11을 "v11 토큰 이코노미 확장 레이어"로 재정의. 에이전트 보상은 $AWW, 베팅은 국가 토큰, 주권 보너스는 기존 v11 메커니즘 유지

---

## ⚠️ High Priority Issues

### H-01: 에이전트-팩션 관계 미정의
- **위치**: v15 §7.1 (nationality만 정의, faction 언급 없음)
- **근거**: v11은 Faction 시스템(유저 생성 그룹, 최대 5국가 동맹)을 핵심 메타게임으로 설계. v14는 개인 Nationality 추가
- **영향**: 외부 에이전트가 Faction에 가입 가능한지, 독립 국적만으로 참전하는지 불명확
- **수정안**: "에이전트는 Nationality만 갖고 Faction은 미가입" 또는 "에이전트도 Faction 가입 가능" 중 택1 명시

### H-02: 에이전트 입력 빈도 모순
- **위치**: v15 §3 NFR-3 ("30Hz 제한") vs §2 ("의사결정 100ms~2s")
- **근거**: 30Hz = 33ms 간격. LLM 에이전트는 100ms~2s 추론 → 실제 1~10Hz 입력
- **영향**: 30Hz 제한은 불필요하게 높거나, "heading 유지" 방식에서는 무의미
- **수정안**: NFR-3을 "에이전트 입력 빈도 ≤ 10Hz (100ms 최소 간격)" + "heading 설정 시 서버 자동 이동 유지" 로 재정의

### H-03: 에이전트 전용 상태(`agent_state`) 누락
- **위치**: v15 §6.3 (설계만 존재, 구현 없음)
- **근거**: 현재 서버는 모든 클라이언트에 동일한 `StatePayload` (20Hz) 전송. 500+ 에이전트에 풀 상태 전송 시 대역폭 폭발
- **영향**: Phase 1 핵심 블로커. 간소화 없이 500 에이전트 동시 접속 불가능
- **수정안**: Phase 1에서 `agent_state` 직렬화를 최우선 구현. 기존 `state_serializer.go` 확장하여 에이전트 모드 분기

### H-04: ELO 레이팅 시스템 부재
- **위치**: v15 §7.2 (설계만 존재)
- **근거**: 코드베이스에 ELO 관련 코드 전무. DB 스키마도 없음
- **영향**: Phase 2 매칭 시스템의 전제 조건
- **수정안**: Phase 1에 DB 스키마 + ELO 계산 모듈 포함시키기

### H-05: 관전자 5Hz 브로드캐스터 부재
- **위치**: v15 §9.1
- **근거**: 현재 시스템은 관전자에게도 20Hz 풀 상태 전송. 5Hz 경량 페이로드 분기 없음
- **영향**: Phase 3 관전 시스템의 전제 조건
- **수정안**: `Broadcaster` 확장하여 spectator 모드 분기 (5Hz, 경량 페이로드)

### H-06: 베팅 엔진 완전 신규 개발
- **위치**: v15 §9.2-9.3
- **근거**: 코드베이스에 베팅/예측 시장 관련 코드 전무
- **영향**: Phase 4 전체가 신규 개발. 오즈 계산, 풀 관리, 정산, 부정 탐지 모두 구현 필요
- **수정안**: 베팅 엔진을 별도 마이크로서비스로 분리 고려 (게임 서버 부하 분산)

---

## 💡 Medium Priority Issues

### M-01: 치팅 탐지 전략 부재
- **위치**: v15 §12 ("서버 권위적 검증" 한 줄)
- **수정안**: 구체적 탐지 패턴 명시 (속도 이상, 입력 타이밍 비정상, 벽 통과, 결과 조작)

### M-02: OpenClaw 스킬 LLM 레이턴시 미고려
- **위치**: v15 §10.3
- **근거**: LLM 에이전트 추론 = 500ms~2s. 레벨업 선택 타임아웃 = 5초(100틱)
- **수정안**: "LLM 추론 지연 시 서버가 기본 전략 자동 적용" 폴백 명시

### M-03: 토너먼트 시스템 상세 부재
- **위치**: v15 §8.1 ("Tournament" 모드 언급, Phase 6에 배치)
- **수정안**: 브래킷 구조, 시드 배정, 상금 분배 최소한의 명세 필요

### M-04: Mixed 모드 에이전트-인간 공정성
- **위치**: v15 §8.1 ("인간과 동등 조건")
- **근거**: 에이전트는 WebSocket 직접 연결(낮은 레이턴시) + 초인적 반응 속도
- **수정안**: 에이전트 입력 딜레이 추가(50ms), 또는 비대칭 수용 명시

### M-05: API Key 관리 정책 미정의
- **위치**: v15 §6.1
- **수정안**: Key 만료 기한, 갱신 정책, 에이전트당 Key 개수 제한, Key 회전 절차 명시

### M-06: Agent Registry DB 스키마 누락
- **위치**: v15 §7.1 (TypeScript 인터페이스만, SQL 스키마 없음)
- **수정안**: Phase 1 로드맵에 PostgreSQL 테이블 설계 포함 (agents, agent_stats, agent_matches, agent_api_keys)

---

## ✅ 긍정적 발견 (기존 인프라 활용 가능)

| # | 발견 | 위치 | v15 활용 |
|---|------|------|---------|
| 1 | Agent 클라이언트 필드 (IsAgent, AgentID, AgentAPIKey) | `ws/client.go:93-96` | Phase 1 인증에 직접 사용 |
| 2 | Agent Stream Hub (에이전트 전용 WS) | `ws/agent_stream.go` | Phase 1 agent_state 기반 |
| 3 | API Key 포맷 + 해싱 (`aww_` + 64hex, SHA-256) | `ws/protocol.go` | Phase 1 인증 그대로 사용 |
| 4 | Commander Mode (커맨드 라우터 + 핸들러) | `game/agent_api.go` | 에이전트 전략 시스템 기반 |
| 5 | CountryArena 팩션 스코어 | `world/country_arena.go` | 에이전트 전투 결과 집계 |
| 6 | WorldManager 195국가 + 배틀 사이클 | `world/world_manager.go` | 에이전트 국가 선택 인프라 |
| 7 | Nationality 시스템 | `game/agent.go` | v14에서 완성, v15 재사용 |
| 8 | Redis Pub/Sub 배틀 이벤트 | `world/world_manager.go` | 관전/베팅 이벤트 전파 |
| 9 | 관전자 카운트 추적 | `world/country_arena.go` | Phase 3 관전 시스템 기반 |
| 10 | 봇 매니저 (5 빌드패스, 전투 스타일) | `game/bot_manager.go` | 기본 전략 템플릿 재사용 |

---

## 수정 로드맵 (Critical 해결 후)

### Phase 1 수정사항
```diff
+ Agent Registry DB 스키마 (PostgreSQL 테이블 4개)
+ agent_state 간소화 직렬화 (기존 agent_stream.go 확장)
+ ELO 계산 모듈 (Phase 2에서 Phase 1으로 이동)
- REST API를 v11 Agent API 경로와 통합 (/api/agents/*)
- 기존 agent_stream.go의 ValidateAPIKey 구현
```

### Phase 2 수정사항
```diff
+ v14 Epoch 사이클과 아레나 모드 통합 방안 확정
+ 에이전트-팩션 관계 정의
- 아레나 스케줄을 시간 고정 → 수요 기반으로 변경
```

### Phase 4 수정사항
```diff
+ 베팅 엔진 마이크로서비스 분리 검토
+ v11 토큰 이코노미와 통합 설계
- 독립 토큰 플로우 → v11 확장 레이어로 변경
```

---

## 결론

### 1차 (수정 전)
v15 Agent Arena API는 기존 인프라 활용도가 높으나, 3개 Critical 이슈 존재.

### 2차 (수정 후) ✅
16건 전수 수정 완료. 주요 개선:
- v11 Agent API를 "확장"으로 재정의 → 기존 인프라 10개 재사용 확정
- v14 Epoch 충돌 → 수요 기반 아레나 생성으로 해결
- 토큰 이코노미 → v11 확장 레이어로 통합
- DB 스키마, API Key 정책, 치팅 탐지, 공정성 정책 모두 구체화

**판정**: ✅ 구현 착수 가능
**다음 단계**: `/da:system` → 상세 아키텍처 설계 또는 `/da:work` → 구현 착수
