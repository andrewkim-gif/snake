# ADR-001: Go + Raw WebSocket (Socket.IO 대체)

## Status
Accepted

## Context
현재 서버는 TypeScript + Socket.IO로 구성되어 있다. v10에서 Go로 재작성 시:
- Go의 Socket.IO 호환 라이브러리(`go-socket.io`)는 불안정하고 유지보수 부족
- Socket.IO 자체 프로토콜 오버헤드 (polling fallback, 패킷 프레이밍, heartbeat)가 게임 서버에서 불필요
- 기존 Go 프로젝트(agent_arena, agent_verse)에서 gorilla/websocket을 검증

## Decision
gorilla/websocket + 커스텀 JSON 프로토콜 `{"e": "event", "d": {...}}` 사용.
클라이언트에 경량 WebSocket 어댑터(GameSocket class, ~80줄)를 추가하여 기존 emit/on 인터페이스 유지.

## Consequences
### Positive
- 검증된 Go WebSocket 라이브러리 사용
- Socket.IO 오버헤드 제거 (순수 WS 프레임만 사용)
- 추후 바이너리 프로토콜(MessagePack) 전환 용이
- 기존 Go 프로젝트 패턴 재사용

### Negative
- 클라이언트 useSocket.ts 수정 필요 (1개 파일)
- Socket.IO 자동 재연결 → 수동 구현 필요 (exponential backoff)
- Socket.IO rooms/namespace 기능 → Hub에서 직접 구현

## Alternatives Considered
1. **go-socket.io**: 불안정, 유지보수 중단 위험
2. **Socket.IO 프록시**: 복잡도 증가, 레이턴시 추가
3. **gRPC-Web**: 브라우저 호환성 제한, 양방향 스트리밍 복잡
