# ADR-008: Authentication Strategy (Guest + OAuth Hybrid)

## Status
Accepted

## Context
스네이크 게임은 캐주얼 게임이므로 즉시 플레이가 핵심이다.
그러나 리더보드와 스킨 시스템을 위해 인증 기능도 필요하다.
"로그인 없이 바로 플레이 + 원하면 계정 연결" 전략이 필요하다.

## Decision
**Anonymous First + Progressive Authentication** 전략을 채택한다.

흐름:
```
1. 첫 방문 → Supabase Anonymous Sign-In (자동, 무인증)
   → 즉시 게임 플레이 가능
   → 게스트 이름 자동 생성 ("Player_xxxx")

2. 게임 중 → 점수는 메모리에만 (DB 미저장)
   → 리더보드에 "Guest" 표시

3. 원할 때 → "계정 연결" 버튼 (Post-MVP)
   → Supabase OAuth (Google/GitHub)
   → Anonymous 세션을 인증 계정으로 업그레이드
   → 이후 점수 DB 저장 + 리더보드 등록

4. 재방문 → JWT refresh token으로 자동 로그인
   → 인증된 사용자는 이름/스킨 유지
```

JWT 설계:
- Expiry: 1시간 (access token)
- Refresh: 7일 (refresh token)
- Claims: { sub, role, aud }
- Game Server 인증: Socket.IO handshake에 JWT 전달
  → 서버에서 Supabase Admin API로 검증

## Consequences
- **Positive**: 즉시 플레이 (로그인 장벽 없음)
- **Positive**: 점진적 전환으로 사용자 이탈 최소화
- **Positive**: Supabase 내장 기능 활용 (구현 비용 최소)
- **Negative**: Guest 데이터는 영구 저장 불가 (브라우저 세션 한정)
- **Negative**: Anonymous 세션 관리 (Supabase MAU 카운트 소모)

## Alternatives Considered
1. **필수 로그인**: 즉시 플레이 불가, 이탈률 증가
2. **localStorage 기반 자체 인증**: 보안 취약, 기기 간 동기화 불가
3. **Firebase Auth**: Supabase 이미 사용 중, 추가 서비스 불필요
