# PLAN: v29b — 인게임 HUD 수정 + 국가별 게임 진입

## Context

v29 faithful port 완료 후 두 가지 이슈 발견:

### 이슈 1: 인게임 HUD 안 나옴
**근본 원인**: `apps/web` 프로젝트에 **Tailwind CSS가 설치되어 있지 않음**.
MatrixHUD, ArenaHUD, MatrixLevelUp, MatrixResult 등 모든 UI 컴포넌트가 Tailwind 클래스(`absolute`, `flex`, `z-10`, `text-white` 등)를 사용하지만, 프로젝트에 tailwindcss 패키지/설정이 없어 모든 스타일이 무시됨.

- HUD 컴포넌트는 DOM에 **마운트는 됨** (게임 상태 머신 정상)
- 하지만 `absolute` 포지셔닝, `z-index`, 색상, 크기 등 **모든 Tailwind 클래스가 무효**
- 결과: 캔버스 아래에 밀리거나 크기 0으로 collapsed

### 이슈 2: 국가 선택 → 게임 진입 플로우 미연결
**현재 상태**: 좌하단 디버그용 "ENTER MATRIX" 버튼으로만 진입 가능.
글로브에서 국가 선택 → "ENTER [국가명]" → `mode: 'iso'` (IsoCanvas)로 진입됨. Matrix 게임과 무관.

**목표**: 글로브에서 국가 선택 → "ENTER [국가명]" → Matrix 인트로 → MatrixApp(국가 정보 포함) 진입

## Critical Files

### 이슈 1 (HUD)
- `apps/web/components/game/matrix/MatrixHUD.tsx` — Tailwind 49개 className → inline style 변환
- `apps/web/components/game/matrix/ArenaHUD.tsx` — Tailwind className → inline style 변환
- `apps/web/components/game/matrix/MatrixLevelUp.tsx` — Tailwind className → inline style 변환
- `apps/web/components/game/matrix/MatrixResult.tsx` — Tailwind className → inline style 변환
- `apps/web/components/game/matrix/MatrixApp.tsx` — Tailwind className → inline style 변환 (있다면)

### 이슈 2 (국가 진입)
- `apps/web/app/page.tsx:304-312` — handleManageCountry: iso→matrix 전환
- `apps/web/app/page.tsx:415-418` — MatrixApp props에 국가 정보 전달
- `apps/web/app/page.tsx:685-712` — "ENTER MATRIX" 디버그 버튼 제거
- `apps/web/components/game/matrix/MatrixApp.tsx:75-80` — MatrixAppProps에 국가 props 추가
- `apps/web/components/game/matrix/MatrixIntro.tsx` — "THE MATRIX" → "ENTERING [국가명]"
- `apps/web/components/3d/GlobeHoverPanel.tsx:262-286` — 호버 패널 버튼 연결
- `apps/web/components/world/CountryPanel.tsx:959-981` — 패널 footer 버튼 연결

## Key Technical Decisions

### 1. HUD 스타일링: Tailwind → inline style 변환 (Tailwind 설치하지 않음)
**이유**: `apps/web`은 inline style 기반 프로젝트. Tailwind 설치는 기존 스타일링과 충돌 위험.
모든 HUD 컴포넌트의 `className="..."` → `style={{...}}` 변환.

### 2. 국가 진입: handleManageCountry 경로 변경
**현재**: 국가 클릭 → handleManageCountry → `mode: 'iso'`
**변경**: 국가 클릭 → handleManageCountry → `showMatrixIntro = true` + 국가 정보 저장 → Matrix 게임
IsoCanvas 경로는 별도 "MANAGE CITY" 버튼으로 유지 (기존 기능 보존).

### 3. MatrixApp에 국가 정보 전달
MatrixAppProps에 `countryIso3`, `countryName` 추가. 현재는 UI 표시용으로만 사용 (국가별 에이전트/맵 환경은 이후 개발).

## 구현 로드맵

### Phase 1: HUD inline style 변환
| Task | 설명 |
|------|------|
| MatrixHUD 변환 | 49개 Tailwind className → inline style (absolute, z-index, flex, 색상, 크기) |
| ArenaHUD 변환 | Tailwind className → inline style |
| MatrixLevelUp 변환 | Tailwind className → inline style |
| MatrixResult 변환 | Tailwind className → inline style |
| MatrixApp 변환 | 오케스트레이터 내 Tailwind className → inline style (있다면) |
| MatrixPause 변환 | 일시정지 오버레이 Tailwind → inline style |

- **design**: N
- **verify**: 게임 진입 후 HUD 표시 확인 — HP바, XP바, 무기 슬롯, 타이머, 킬수, 리더보드 정상 렌더링. `next build` 성공.

### Phase 2: 국가 선택 → Matrix 진입 연결
| Task | 설명 |
|------|------|
| page.tsx 상태 추가 | `matrixCountry: { iso3, name }` 상태 추가 |
| handleManageCountry 수정 | `mode: 'iso'` → `showMatrixIntro = true` + matrixCountry 저장 |
| MatrixApp props 확장 | `countryIso3`, `countryName` props 추가 |
| page.tsx MatrixApp 연결 | `<MatrixApp countryIso3={...} countryName={...} />` |
| MatrixIntro 국가 표시 | "THE MATRIX" → "ENTERING [국가명]" 또는 "BATTLE FOR [국가명]" |
| 디버그 버튼 제거 | 좌하단 "ENTER MATRIX" 디버그 버튼 삭제 |
| IsoCanvas 경로 보존 | CountryPanel에 "MANAGE CITY" 버튼 별도 유지 (iso 모드용) |

- **design**: N
- **verify**: 글로브 → 국가 호버/클릭 → "ENTER [국가명]" → Matrix 인트로(국가명 표시) → 게임 시작 → ESC → 로비 복귀. `next build` 성공.

## Verification
1. `next build` — 성공
2. 글로브 로비 정상 표시
3. 국가 호버 → "ENTER [국가명]" 버튼 표시
4. 클릭 → Matrix 인트로 (국가명 포함)
5. 게임 시작 → **HUD 정상 표시** (HP바, XP바, 무기 슬롯, 타이머)
6. **ArenaHUD** 정상 표시 (생존자 수, 킬피드, 리더보드)
7. 레벨업 → **MatrixLevelUp** 모달 정상 표시
8. 게임 오버 → **MatrixResult** 정상 표시
9. ESC → 일시정지 → **MatrixPause** 정상 표시
10. "Exit" → 글로브 로비 복귀
