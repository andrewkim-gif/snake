# PLAN: 큐블링 캐릭터 시스템 → 로비 UI 통합

> **Date**: 2026-03-06
> **Status**: Draft
> **Ref**: `docs/designs/v10-character-concept.md` (큐블링 컨셉 원본)
> **Scope**: 네트워크 외형 전송 + 로비 캐릭터 프리뷰 강화 + CharacterCreator UX 개선

---

## 1. 개요

큐블링 캐릭터 시스템(8 Phase)이 완성되었다. 그러나 현재:
- **로비**: CharacterCreator에서 설정한 appearance가 서버에 전송되지 않음 (skinId만 전송)
- **인게임**: `resolveAppearance(skinId)`로 skinId 기반 결정적 레거시 변환 (modulo) — 실제 유저 설정과 무관
- **프리뷰**: 90×90px 미니 캔버스 — 캐릭터의 매력을 보여주기엔 너무 작음

이 기획은 캐릭터 시스템을 로비 UI에 완전히 녹여내고, 네트워크를 통해 인게임까지 연결하는 것이 목표다.

### 핵심 목표

| # | 목표 | 성공 기준 |
|---|------|----------|
| 1 | 내 캐릭터가 인게임에 반영 | 로비에서 설정한 appearance가 게임에서 그대로 보임 |
| 2 | 다른 플레이어 캐릭터 식별 | 60명 각자 설정한 외형이 서로에게 보임 |
| 3 | 로비에서 캐릭터 매력 극대화 | 큰 3D 프리뷰 + 회전 + 장비 표시 |
| 4 | 캐릭터 에디터 UX 개선 | 직관적 탭, 빠른 탐색, 랜덤 생성 |

## 2. 요구사항

### 기능 요구사항
- [FR-1] joinRoom/respawn 시 packed appearance 전송 (63-bit BigInt string)
- [FR-2] Go 서버: appearance string pass-through 저장 + state broadcast 포함
- [FR-3] 클라이언트: AgentNetworkData.ap에서 appearance unpack → 캐릭터 렌더링
- [FR-4] 로비 캐릭터 프리뷰: 280px 패널 전체 활용, 드래그 회전
- [FR-5] CharacterCreator: 탭 아이콘 개선, 랜덤 버튼, 장비 이름 표시
- [FR-6] 봇 에이전트: ap 미전송 → 클라이언트에서 skinId 기반 결정적 변환 유지 (Go에서 packAppearance 재구현 불필요)

### 비기능 요구사항
- [NFR-1] 네트워크: appearance는 매 state에 `ap` 필드로 항상 포함 (~20B/agent, 60명 기준 1.2KB/tick — 24KB/s 수용 가능)
- [NFR-2] 성능: appearance cache로 매 프레임 unpack 방지
- [NFR-3] 하위 호환: skinId만 보내는 구 클라이언트도 동작 (fallback)
- [NFR-4] 번들: 로비 프리뷰 강화가 번들 사이즈 50KB 이하 증가

## 3. 기술 방향

- **프로토콜**: `packAppearance()` → BigInt string → 서버 pass-through → `unpackAppearance()`
- **캐시**: 클라이언트에서 `Map<string, CubelingAppearance>` (agentId 기반) 유지. `resolveAppearance()`는 이미 `appearanceCache?: Map<number, ...>` 파라미터 지원 — 캐시 populate 로직만 추가하면 됨. room 전환 시 캐시 전체 클리어.
- **프리뷰**: 기존 `VoxelCharacter` 컴포넌트 재활용, Canvas 크기 + 카메라만 조정
- **서버**: Go struct에 `Appearance string` 필드 추가, JSON pass-through

## 4. 기존 인프라 (활용 가능)

이미 구현되어 있어 새로 만들 필요 없는 것들:
- `packAppearance()` / `unpackAppearance()` — `packages/shared/src/types/appearance.ts` (63-bit BigInt 인코딩)
- `resolveAppearance(skinIdOrHash, appearanceCache?)` — `lib/3d/skin-migration.ts` (**이미 cache 파라미터 지원**)
- `JoinRoomPayload.appearance?: string` — `packages/shared/src/types/events.ts` (TS 타입 이미 정의됨)
- `AgentNetworkData.ap?: string` — `packages/shared/src/types/events.ts` (TS 타입 이미 정의됨)
- `VoxelCharacter` appearance prop — `components/3d/VoxelCharacter.tsx` (로비 프리뷰 이미 지원)
- `CharacterCreator` 7탭 에디터 — 완성됨, localStorage 영속성 포함
- `getCachedAppearance()` — `AgentInstances.tsx` 내부 함수 (캐시 연결만 하면 됨)

## 5. 아키텍처 개요

```
[CharacterCreator] → appearance state
        ↓
[page.tsx] → joinRoom(iso3, name, skinId, packedAppearance)
        ↓
[useSocket] → emit('join_room', { roomId, name, skinId, appearance })
        ↓
[Go Server] → JoinRoomPayload.Appearance → Agent.Appearance (string 저장)
        ↓
[State Broadcast] → AgentNetworkData.ap (매 state에 항상 포함, ~20B/agent)
        ↓
[Other Clients] → ap 있으면 unpackAppearance() → appearanceCache.set(agentId, appearance)
        ↓
[AgentInstances] → resolveAppearanceFn → cache hit → real appearance 렌더링
```

## 6. 현재 상태 분석 (Gap Analysis)

| 영역 | 현재 | 목표 | 간극 |
|------|------|------|------|
| joinRoom | `(roomId, name, skinId)` | `+ appearance string` | 클라이언트+서버 수정 |
| respawn | `(name, skinId)` | `+ appearance string` | ⚠️ v10 1-life 모드로 서버에서 무시됨 — 우선순위 낮음 |
| Go JoinRoomPayload | `SkinID int` | `+ Appearance string` | Go struct 수정 |
| Go RespawnPayload | `SkinID int` | `+ Appearance string` | Go struct 수정 (v10에서 무시되지만 하위호환) |
| AgentNetworkData.ap | 정의됨 but 미사용 | 서버에서 populate | 직렬화 로직 수정 |
| resolveAppearance | skinId 기반 결정적 변환 (modulo) | 실제 appearance 사용 | cache populate만 추가 (인프라 존재) |
| 로비 프리뷰 | 90×90px 미니 캔버스 | 280px 풀패널 3D | Canvas+카메라 확대 |
| CharacterCreator | 기능적 완성 | UX 개선 | 시각적 polish |
| 봇 appearance | skinId 기반 결정적 변환 | ap="" (미전송) → skinId fallback 유지 | Go에서 pack 불필요 (변경 없음) |

## 7. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 구 클라이언트 호환 | appearance 없는 유저가 기본 외형 | skinId fallback 유지 (resolveAppearance cache miss → modulo 변환) |
| 네트워크 사이즈 | ap 매 state 포함 ~20B/agent | 60명 × 20B = 1.2KB/tick, 20Hz에서 24KB/s — WebSocket 기준 수용 가능 |
| Go 서버 수정 범위 | 콜체인 9개 파일 시그니처 변경 | string pass-through만, 파싱/검증 없음. 컴파일러가 누락 잡아줌 |
| 로비 프리뷰 성능 | 큰 Canvas가 모바일에서 느릴 수 | devicePixelRatio 제한 1.5, 모바일 높이 150px |
| 캐시 무효화 | 재접속 시 stale appearance | room 전환/disconnect 시 캐시 전체 clear |

---

## 구현 로드맵
<!-- da:work Stage 0 자동 파싱 대상 -->

### Phase 1: 네트워크 Appearance Wire-up (클라이언트 + 서버 동시)

> ⚠️ 클라이언트와 서버는 동시에 수정해야 테스트 가능. 하나의 Phase로 통합.

**클라이언트 (TypeScript):**

| Task | 파일 | 설명 |
|------|------|------|
| useSocket joinRoom 확장 | `hooks/useSocket.ts` | `joinRoom(roomId, name, skinId, appearance?)` — `packAppearance()` 결과를 string으로 전송 |
| useSocket respawn 확장 | `hooks/useSocket.ts` | `respawn(name, skinId, appearance?)` — v10 1-life 모드로 서버 무시하지만 미래 대비 |
| page.tsx appearance 전달 | `app/page.tsx` | `handleEnterArena`에서 `packAppearance(appearance).toString()` 후 joinRoom에 전달 |
| Appearance 캐시 구현 | `lib/3d/appearance-cache.ts` (신규) | `Map<string, CubelingAppearance>` — state 수신 시 `ap` 필드에서 unpack 후 캐싱. room 전환 시 clear. |
| resolveAppearance 연결 | `lib/3d/skin-migration.ts` | **이미 `appearanceCache` 파라미터 지원** — 캐시를 AgentInstances에 전달만 하면 됨 |
| GameCanvas3D 캐시 연결 | `components/game/GameCanvas3D.tsx` | appearance cache ref를 AgentInstances에 전달, state 수신 콜백에서 캐시 populate |
| TS RespawnPayload 확장 | `packages/shared/src/types/events.ts` | RespawnPayload에 `appearance?: string` 필드 추가 (하위 호환) |

**서버 (Go) — 전체 콜체인 수정:**

| Task | 파일 | 설명 |
|------|------|------|
| JoinRoomPayload 확장 | `server/internal/ws/protocol.go` | `Appearance string \`json:"appearance,omitempty"\`` 필드 추가 |
| RespawnPayload 확장 | `server/internal/ws/protocol.go` | 동일 (v10에서 무시되지만 하위호환) |
| 이벤트 핸들러 수정 | `server/cmd/server/main.go:190-210` | `payload.Appearance` 추출, `JoinRoom()`에 전달 |
| Agent struct 확장 | `server/internal/domain/types.go` | `Agent`에 `Appearance string` 필드 추가 |
| StateAgent struct 확장 | `server/internal/domain/events.go` | `Appearance string \`json:"ap,omitempty"\`` 필드 추가 |
| RoomManager 시그니처 | `server/internal/game/room_manager.go` | `JoinRoom()`, `QuickJoin()`, `joinRoomLocked()` — appearance 파라미터 추가 |
| Room.AddPlayer 시그니처 | `server/internal/game/room.go` | `AddPlayer(id, name, appearance string, skinID int)` |
| CountryArena 시그니처 | `server/internal/world/country_arena.go` | `AddPlayer()`, `AddPlayerWithFaction()` — appearance 전달 |
| NewAgent 호출 | `server/internal/game/agent.go` | Agent 생성 시 appearance 저장 |
| serializeAgent 수정 | `server/internal/game/serializer.go` | `sa.Appearance = a.Appearance` 추가 (매 state에 항상 포함) |
| Bot — ap 미전송 | `server/internal/game/bot.go` | 봇은 Appearance="" → 클라이언트에서 skinId fallback 사용 |

- **design**: N (로직 중심)
- **verify**: `go build ./...` 성공 + `npm run build` 성공 + joinRoom emit에 appearance 포함 확인

### Phase 2: 로비 캐릭터 프리뷰 강화
| Task | 설명 |
|------|------|
| CharacterPreviewPanel 컴포넌트 | 280px 너비 전체 활용하는 3D 프리뷰 패널 (높이 ~200px) |
| 드래그 회전 | 마우스/터치 드래그로 캐릭터 Y축 회전 |
| 자동 회전 | 3초 미조작 시 천천히 자동 회전 (0.3 rad/s) |
| 향상된 조명 | 3-point lighting (key + fill + rim) + 바닥 그림자 |
| 장비 표시 | VoxelCharacter에서 장비(모자/무기/등) 시각적 표현 |
| 모바일 대응 | 모바일: 프리뷰 높이 150px, dpr 제한 1.5 |

- **design**: Y (UI 프리뷰 개선)
- **verify**: 로비에서 캐릭터 프리뷰가 패널 전체 너비로 렌더링, 드래그 회전 동작

### Phase 3: CharacterCreator UX 개선
| Task | 설명 |
|------|------|
| 탭 아이콘 + 활성 표시 | 각 탭에 이모지/아이콘 + 활성 탭 하단 인디케이터 |
| 랜덤 버튼 | 🎲 버튼 — 랜덤 appearance 즉시 생성 |
| 장비 이름 표시 | 장비 선택 시 이름 + 레어리티 표시 |
| 프리셋 미리보기 | 프리셋 카드에 미니 3D 썸네일 (선택 전 미리보기) |
| 색상 피커 개선 | 색상 스워치를 2줄 그리드로 정리, 선택 테두리 강화 |
| 초기화 버튼 | 기본 appearance로 리셋하는 버튼 |

- **design**: Y (UI 개선)
- **verify**: 랜덤 버튼 클릭 시 appearance 변경, 탭 전환 시 아이콘 활성 표시

### Phase 4: 통합 테스트 + 폴리시
| Task | 설명 |
|------|------|
| 풀 플로우 테스트 | 로비 → 캐릭터 설정 → joinRoom → 인게임 appearance 반영 확인 |
| 다중 클라이언트 테스트 | 2개 탭에서 각기 다른 appearance → 서로에게 올바르게 보이는지 |
| localStorage 영속성 | 새로고침 후 appearance 복원 확인 |
| 하위 호환 테스트 | appearance 없이 joinRoom → skinId fallback 동작 확인 |
| 성능 프로파일링 | 로비 프리뷰 FPS, appearance cache 메모리 사용량 측정 |

- **design**: N
- **verify**: 빌드 성공, 로비→게임 풀 플로우에서 캐릭터 외형 일치
