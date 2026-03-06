# PLAN: 큐블링 캐릭터 시스템 → 로비 UI 통합

> **Date**: 2026-03-06
> **Status**: Draft
> **Ref**: `docs/designs/v10-character-concept.md` (큐블링 컨셉 원본)
> **Scope**: 네트워크 외형 전송 + 로비 캐릭터 프리뷰 강화 + CharacterCreator UX 개선

---

## 1. 개요

큐블링 캐릭터 시스템(8 Phase)이 완성되었다. 그러나 현재:
- **로비**: CharacterCreator에서 설정한 appearance가 서버에 전송되지 않음 (skinId만 전송)
- **인게임**: `resolveAppearance(skinId)`로 해시 기반 랜덤 생성 — 실제 유저 설정과 무관
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
- [FR-6] 봇 에이전트: 다양한 랜덤 appearance 생성 (반복 방지)

### 비기능 요구사항
- [NFR-1] 네트워크: appearance는 join 시 1회 전송, 이후 state에는 hash만 포함
- [NFR-2] 성능: appearance cache로 매 프레임 unpack 방지
- [NFR-3] 하위 호환: skinId만 보내는 구 클라이언트도 동작 (fallback)
- [NFR-4] 번들: 로비 프리뷰 강화가 번들 사이즈 50KB 이하 증가

## 3. 기술 방향

- **프로토콜**: `packAppearance()` → BigInt string → 서버 pass-through → `unpackAppearance()`
- **캐시**: 클라이언트에서 `Map<agentId, CubelingAppearance>` 유지, join 시 수신
- **프리뷰**: 기존 `VoxelCharacter` 컴포넌트 재활용, Canvas 크기 + 카메라만 조정
- **서버**: Go struct에 `Appearance string` 필드 추가, JSON pass-through

## 4. 아키텍처 개요

```
[CharacterCreator] → appearance state
        ↓
[page.tsx] → joinRoom(iso3, name, skinId, packedAppearance)
        ↓
[useSocket] → emit('join_room', { roomId, name, skinId, appearance })
        ↓
[Go Server] → JoinRoomPayload.Appearance → Agent.Appearance (string 저장)
        ↓
[State Broadcast] → AgentNetworkData.ap (첫 state에만 포함)
        ↓
[Other Clients] → unpackAppearance(ap) → appearanceCache.set(agentId, appearance)
        ↓
[AgentInstances] → resolveAppearanceFn → cache hit → real appearance 렌더링
```

## 5. 현재 상태 분석 (Gap Analysis)

| 영역 | 현재 | 목표 | 간극 |
|------|------|------|------|
| joinRoom | `(roomId, name, skinId)` | `+ appearance string` | 클라이언트+서버 수정 |
| respawn | `(name, skinId)` | `+ appearance string` | 클라이언트+서버 수정 |
| Go JoinRoomPayload | `SkinID int` | `+ Appearance string` | Go struct 수정 |
| Go RespawnPayload | `SkinID int` | `+ Appearance string` | Go struct 수정 |
| AgentNetworkData.ap | 정의됨 but 미사용 | 서버에서 populate | 직렬화 로직 수정 |
| resolveAppearance | skinId hash 기반 랜덤 | 실제 appearance 사용 | cache + fallback |
| 로비 프리뷰 | 90×90px 미니 캔버스 | 280px 풀패널 3D | Canvas+카메라 확대 |
| CharacterCreator | 기능적 완성 | UX 개선 | 시각적 polish |
| 봇 appearance | skinId 기반 랜덤 | 다양한 preset 기반 | 서버 봇 생성 로직 |

## 6. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 구 클라이언트 호환 | appearance 없는 유저가 기본 외형 | skinId fallback 유지 |
| 네트워크 사이즈 | appearance string ~20바이트 | join 시 1회만, state는 hash |
| Go 서버 수정 범위 | 여러 파일 수정 필요 | pass-through만 (검증 최소화) |
| 로비 프리뷰 성능 | 큰 Canvas가 모바일에서 느릴 수 | devicePixelRatio 제한 |

---

## 구현 로드맵
<!-- da:work Stage 0 자동 파싱 대상 -->

### Phase 1: 네트워크 Appearance Wire-up (클라이언트)
| Task | 설명 |
|------|------|
| useSocket joinRoom 확장 | `joinRoom(roomId, name, skinId, appearance?)` — packed appearance string 전송 |
| useSocket respawn 확장 | `respawn(name, skinId, appearance?)` — 리스폰 시에도 appearance 전송 |
| page.tsx appearance 전달 | `handleEnterArena`에서 `packAppearance(appearance)` 후 joinRoom에 전달 |
| Appearance 캐시 매니저 | `Map<agentId, CubelingAppearance>` — joined/state에서 수신한 ap 캐싱 |
| resolveAppearance 개선 | cache hit → 실제 appearance / miss → skinId fallback (기존 로직) |
| GameCanvas3D appearance 전달 | GameCanvas3D에 appearance prop 추가, AgentInstances에 캐시 연결 |

- **design**: N (로직 중심)
- **verify**: joinRoom emit에 appearance 포함 확인, resolveAppearance가 캐시 우선 참조

### Phase 2: 서버 Appearance Pass-through (Go)
| Task | 설명 |
|------|------|
| Go JoinRoomPayload 확장 | `Appearance string` 필드 추가 (JSON: `appearance`) |
| Go RespawnPayload 확장 | `Appearance string` 필드 추가 |
| Agent struct 확장 | `domain.Agent`에 `Appearance string` 필드 추가 |
| Room join 로직 수정 | JoinRoom에서 appearance를 Agent에 저장 |
| State serializer 수정 | AgentNetworkData 직렬화 시 `ap` 필드에 appearance 포함 (첫 state만) |
| Bot appearance 생성 | 봇 생성 시 랜덤 appearance string 생성 (사전 정의 preset 8종) |

- **design**: N (서버 로직)
- **verify**: Go build 성공, join 시 appearance가 state broadcast에 포함되는지 확인

### Phase 3: 로비 캐릭터 프리뷰 강화
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

### Phase 4: CharacterCreator UX 개선
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

### Phase 5: 통합 테스트 + 폴리시
| Task | 설명 |
|------|------|
| 풀 플로우 테스트 | 로비 → 캐릭터 설정 → joinRoom → 인게임 appearance 반영 확인 |
| 다중 클라이언트 테스트 | 2개 탭에서 각기 다른 appearance → 서로에게 올바르게 보이는지 |
| localStorage 영속성 | 새로고침 후 appearance 복원 확인 |
| 하위 호환 테스트 | appearance 없이 joinRoom → skinId fallback 동작 확인 |
| 성능 프로파일링 | 로비 프리뷰 FPS, appearance cache 메모리 사용량 측정 |

- **design**: N
- **verify**: 빌드 성공, 로비→게임 풀 플로우에서 캐릭터 외형 일치
