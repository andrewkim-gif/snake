# v26 Verification Report: Isometric Nation Simulation Plan

> **Date**: 2026-03-09
> **Target**: `docs/designs/v26-isometric-nation-sim-plan.md`
> **Type**: Plan Integration Verification + Asset Readiness

---

## Summary

| Category | Issues | Critical | High | Medium | Low |
|----------|--------|----------|------|--------|-----|
| Server Integration | 3 | 0 | 1 | 2 | 0 |
| Client Integration | 2 | 0 | 1 | 1 | 0 |
| Asset Pipeline | 2 | 0 | 0 | 1 | 1 |
| Shared Types | 1 | 0 | 0 | 1 | 0 |
| Architecture | 1 | 0 | 0 | 1 | 0 |
| **Total** | **9** | **0** | **2** | **6** | **1** |

**Overall Assessment**: PASS (0 Critical) — Plan is implementable with minor adjustments noted below.

---

## High Priority Issues

### H-1: EconomyEngine.ManualTick 미존재
- **Location**: Plan §6.3 / `server/internal/meta/economy.go`
- **Evidence**: `Tick()` 메서드는 전체 195국 일괄 처리. 개별 국가 `ManualTick(iso3)` 없음.
- **Impact**: CitySimEngine에서 개별 국가 경제 틱을 트리거할 수 없음
- **Fix**: `processCountryTick(iso3)` private 메서드가 이미 존재 → public wrapper `ManualTick(iso3 string)` 추가 (5줄)
- **Plan Update**: Phase 2 task에 "EconomyEngine.ManualTick public wrapper 추가" 명시

### H-2: PixiJS 미설치 — 새 의존성
- **Location**: Plan §9.1 / `apps/web/package.json`
- **Evidence**: `pixi.js`, `@pixi/tilemap` 모두 현재 package.json에 없음
- **Impact**: Phase 1에서 설치 필요하지만 plan에 설치 step이 불명확
- **Fix**: Phase 1 첫 task에 `npm install pixi.js @pixi/tilemap` 명시
- **Plan Update**: Phase 1 task 표에 "PixiJS 8 + @pixi/tilemap 설치, tsconfig paths 설정" 추가

---

## Medium Priority Issues

### M-1: CountryClientState vs CityClientState 분리
- **Location**: Plan §5 / `apps/web/lib/globe-data.ts`
- **Evidence**: 기존 `CountryClientState`는 Globe 전용 (iso3, name, tier, GDP, battleStatus). Iso 뷰는 건물/시민/자원 재고 등 완전 다른 데이터 필요.
- **Fix**: `CityClientState` 별도 인터페이스 정의 (Plan §5에 이미 언급하고 있으나 packages/shared에 city.ts 파일 생성 필요)
- **Plan Update**: Phase 2 task에 "packages/shared/src/types/city.ts 생성" 명시

### M-2: WebSocket city_state 이벤트 등록
- **Location**: Plan §5 / `server/internal/ws/protocol.go`
- **Evidence**: `protocol.go`에 기존 이벤트 상수 존재. `EventCityState`/`EventCityCommand` 추가 가능.
- **Fix**: Phase 2에서 프로토콜 상수 추가 + hub.go에 city room broadcast 로직 추가
- **Plan Update**: 이미 Phase 2에 포함되어 있음 — OK

### M-3: Arena 코드와의 충돌 없음 확인
- **Location**: `apps/web/components/game/ar/` (29 files)
- **Evidence**: Arena 코드는 `ar/` 하위에 완전 격리됨. Iso 코드는 `iso/`에 신규 생성.
- **Fix**: 불필요 — 기존 코드 수정 없이 공존 가능
- **Plan Update**: Key Technical Decisions에 이미 명시 — OK

### M-4: shared types city.ts 신규 생성
- **Location**: `packages/shared/src/types/`
- **Evidence**: 기존 5개 파일 (game.ts, events.ts, appearance.ts, weapons.ts, index.ts). city.ts 없음.
- **Fix**: Phase 2에서 `city.ts` 생성, `index.ts`에 re-export 추가
- **Plan Update**: Phase 2 task에 명시 필요

### M-5: Globe onManageCountry prop 추가
- **Location**: `apps/web/components/world/WorldView.tsx`
- **Evidence**: 현재 `onEnterArena` prop만 존재. Iso 전환용 `onManageCountry` 추가 필요.
- **Fix**: WorldView, GlobeHoverPanel, CountryPanel에 `onManageCountry` prop 추가
- **Plan Update**: Phase 1 "Globe↔Iso 전환" task에 prop 추가 상세 명시

### M-6: AI 에셋 생성 파이프라인 정밀화 필요
- **Location**: Plan §9.3 + Phase 7
- **Evidence**: 기존 에셋 패턴: (1) 프로시저럴 OffscreenCanvas (ar-texture-loader.ts), (2) Gemini API 생성 (scripts/generate-logo.mjs), (3) 정적 PNG (public/textures/blocks/). Plan §9.3은 수량만 명시하고 da:asset 프롬프트/스타일 일관성 없음.
- **Fix**: 전체 에셋 매니페스트 + da:asset 호환 Gemini 프롬프트를 Plan에 추가 (아래 Asset Manifest 섹션)
- **Plan Update**: "## 11. 에셋 매니페스트 (da:asset)" 섹션 추가

---

## Low Priority Issues

### L-1: 에셋 크기 표준화
- **Location**: Plan §9.3
- **Evidence**: 기존 프로젝트 표준: 8x8 파티클, 16x16 엔티티, 32x32 보스, 150x150 UI. Iso 에셋은 64x32 타일 기본이나 건물/시민 크기 미정의.
- **Fix**: 에셋 크기 표준 정의 (타일 64x32, 건물 64x64~128x128, 시민 32x32, UI 아이콘 32x32)
- **Plan Update**: Asset Manifest에 크기 표준 포함

---

## Passed Checks

| 항목 | 상태 | 상세 |
|------|------|------|
| EconomyEngine 존재 | ✅ | 899줄, InitializeCountry, GDP 계산 확인 |
| DiplomacyEngine 존재 | ✅ | 1066줄, ProposeTreaty, AreAllied, IsTradeBlocked 확인 |
| WarManager 존재 | ✅ | 655줄, DeclareWar, 3-phase siege 시스템 |
| FactionManager 존재 | ✅ | 939줄, 파벌 CRUD + 역할 체계 |
| WebSocket hub.go 확장 가능 | ✅ | Room 기반 구조, BroadcastToRoom, MoveClientToRoom |
| WorldView onEnterArena 패턴 | ✅ | prop 기반 전환 — onManageCountry 추가 용이 |
| Arena 코드 격리 | ✅ | `components/game/ar/` 29개 파일 독립 |
| 디자인 시스템 호환 | ✅ | SK 토큰 (Apex Tactical) 재사용 가능 |
| 프로시저럴 텍스처 패턴 | ✅ | ar-texture-loader.ts 패턴 재사용 가능 |
| Gemini AI 생성 스크립트 | ✅ | generate-logo.mjs 패턴 재사용 가능 |

---

## Confidence Level: High
## Sources: Serena symbol analysis, file reads, codebase exploration
