# ADR-002: Channel-based Hub (Lock-free)

## Status
Accepted

## Context
WebSocket 메시지 라우팅에 두 가지 접근이 있다:
- (A) sync.RWMutex 기반: rooms map을 뮤텍스로 보호. 여러 goroutine에서 접근.
- (B) Channel-based: 단일 goroutine이 select loop에서 모든 라우팅 처리. 다른 goroutine은 channel로 요청.

## Decision
agent_arena의 channel-based Hub 패턴 채택. 단일 goroutine이 register/unregister/broadcast/roomcast/unicast를 모두 처리.

```go
func (h *Hub) Run() {
    for {
        select {
        case reg := <-h.register:    // 연결 등록
        case client := <-h.unregister: // 연결 해제
        case msg := <-h.broadcast:    // 전체 브로드캐스트
        case msg := <-h.roomcast:     // Room별 전송
        case msg := <-h.unicast:      // 개별 전송
        case <-h.done:                // 종료
            return
        }
    }
}
```

## Consequences
### Positive
- Lock-free → 데드락 불가
- 단일 소유자 원칙 → 경쟁 조건 없음
- agent_arena 프로덕션 환경에서 검증된 패턴
- Room별 격리 (rooms map 구조)

### Negative
- Hub goroutine이 단일 병목 (이론적)
- 5,000 CCU에서도 충분 (channel 처리 ~0.01ms/msg, 초당 ~100K msg 처리 가능)

## Alternatives Considered
1. **sync.RWMutex**: 단순하지만 데드락 위험, lock contention 가능
2. **sync.Map**: Go 표준이지만 복잡한 Room 라우팅에 부적합
