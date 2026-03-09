# PLAN: BGM Music Player — 로비 사운드 플레이어

> **Version**: v27
> **Created**: 2026-03-09
> **Status**: Draft

---

## 1. 개요

로비 화면 **우하단**에 미니 BGM 플레이어를 추가한다.
`apps/web/public/sounds/bgm/` 디렉토리의 MP3 파일들을 플레이리스트로 로드하여
로비 진입 시 자동(또는 수동) 재생하며, 좌하단 기존 버튼들(Agent Setup, GAME SYSTEM, LanguageSwitcher)의
**Apex Tactical UI 디자인 언어**를 그대로 따른다.

### 핵심 목표
- 로비 분위기를 살리는 BGM 재생
- 기존 UI와 완벽히 일관된 디자인
- 브라우저 autoplay 정책 준수 (사용자 인터랙션 후 재생)
- 최소한의 코드로 깔끔한 구현

---

## 2. 요구사항

### 기능 요구사항
- [FR-1] `public/sounds/bgm/*.mp3` 파일을 플레이리스트로 관리
- [FR-2] 재생/일시정지 토글 버튼
- [FR-3] 이전/다음 트랙 스킵 버튼
- [FR-4] 볼륨 조절 (슬라이더 또는 스텝 토글)
- [FR-5] 트랙 이름 + 진행률 표시 (프로그레스 바)
- [FR-6] 트랙 자동 순환 (현재 곡 끝나면 다음 곡 → 마지막이면 첫 곡)
- [FR-7] 음소거(Mute) 토글
- [FR-8] 로비 모드에서만 표시 (게임 진입 시 숨김 또는 페이드아웃)
- [FR-9] 상태 localStorage 저장 (볼륨, 음소거, 마지막 트랙 인덱스)

### 비기능 요구사항
- [NFR-1] 브라우저 Autoplay Policy: 사용자 첫 클릭/탭 후에만 재생 시작
- [NFR-2] 기존 SoundEngine과 독립 (lobby 전용 HTMLAudioElement 기반)
- [NFR-3] 모바일 대응 (작은 화면에서 축소 또는 아이콘 모드)
- [NFR-4] z-index: NewsFeed(60) 위, 기존 좌하단 패널(65)과 동일 레벨

---

## 3. 기술 방향

### 오디오 엔진
- **HTMLAudioElement** 사용 (MP3 파일 재생에 최적, Web Audio API 불필요)
- `useRef<HTMLAudioElement>` + `useState`로 React 상태 관리
- `ended` 이벤트로 자동 다음 트랙
- `timeupdate` 이벤트로 프로그레스 바 업데이트

### 컴포넌트 구조
```
BgmPlayer.tsx (단일 컴포넌트)
├── Audio element (hidden)
├── Track info bar (이름 + 프로그레스)
├── Control row (prev | play/pause | next | volume | mute)
└── localStorage persistence
```

### 디자인: Apex Tactical 스타일 통일
좌하단 버튼들의 정확한 스타일을 미러링:
- `backgroundColor: rgba(9, 9, 11, 0.88)` + `backdropFilter: blur(20px)`
- `border: 1px solid ${SK.glassBorder}` (rgba(255,255,255,0.06))
- `borderTop: 1px solid rgba(239, 68, 68, 0.4)` (레드 액센트 라인)
- `clipPath: polygon(...)` — 좌하단 대각선 컷
- `fontFamily: Space Grotesk`, `fontSize: 11px`, `color: SK.textSecondary`
- `borderRadius: 0` (모든 곳 0)
- 아이콘: `lucide-react` (Play, Pause, SkipBack, SkipForward, Volume2, VolumeX)
- 아이콘 컬러: `SK.accent` (#EF4444) 활성 상태, `SK.textMuted` 비활성

---

## 4. 아키텍처 개요

### 레이아웃 배치
```
┌─────────────────────────────────────────────────────┐
│                    3D Globe (WorldView)               │
│                                                       │
│  [Online ●]                                    (top)  │
│                                                       │
│                                                       │
│                                                       │
│                                                       │
│  [Logo]                              ┌──────────┐     │
│  [AgentSetup][GameSys][Lang]         │ BGM ▶ ♪  │     │
│  ═══════════ NewsFeed Ticker ════════│══════════│═══  │
└─────────────────────────────────────└──────────┘─────┘
```

**위치**: `position: absolute`, `bottom: NEWS_FEED_HEIGHT + 12` (= 48px), `right: 16px`
- 좌하단 버튼들과 대칭적 배치 (같은 bottom 라인)
- NewsFeed (36px) 바로 위

### 플레이어 레이아웃 (상세)
```
┌─── borderTop: red accent ──────────────────────┐
│  ♪ Track 01                    ━━━━━░░░  1:23  │  ← 트랙명 + 프로그레스
│  ⏮  ▶  ⏭   ─────○── 🔊                       │  ← 컨트롤 row
└──╱                                             │
  ╱ clipPath diagonal cut                        │
```

**컴팩트 사이즈**: ~200px 너비, ~56px 높이
- 상단 row: 트랙명(좌) + 미니 프로그레스 바 + 시간(우)
- 하단 row: 컨트롤 버튼들 + 볼륨 슬라이더

---

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 브라우저 Autoplay 차단 | BGM 미재생 | 첫 사용자 인터랙션 감지 후 play() 호출 |
| 모바일에서 공간 부족 | UI 겹침 | 모바일에서 아이콘 모드 (축소) |
| 기존 SoundEngine BGM 볼륨과 충돌 | 볼륨 이중 제어 | lobby BGM은 별도 관리, game 진입 시 fade out |
| MP3 파일 크기 (4.6MB + 3.6MB) | 초기 로딩 지연 | lazy load, 첫 곡만 preload |

---

## 6. 플레이리스트 구조

현재 파일:
| # | 파일 | 크기 | 표시 이름 |
|---|------|------|----------|
| 1 | `bgm1.mp3` | 4.6MB | Track 01 |
| 2 | `bgm2.mp3` | 3.6MB | Track 02 |

향후 확장: `bgm3.mp3`, `bgm4.mp3` 추가 시 자동 감지 (하드코딩 배열)

---

## 7. 상태 관리

```typescript
interface BgmPlayerState {
  isPlaying: boolean;
  currentTrackIndex: number;
  volume: number;        // 0.0 ~ 1.0
  isMuted: boolean;
  currentTime: number;   // seconds
  duration: number;      // seconds
}

// localStorage keys
const STORAGE_KEYS = {
  volume: 'aww-bgm-volume',
  muted: 'aww-bgm-muted',
  trackIndex: 'aww-bgm-track',
};
```

---

## 8. 인터랙션 플로우

```
1. 로비 진입 → BgmPlayer 마운트 → localStorage에서 상태 복원
2. 사용자 첫 인터랙션 (클릭/키보드) → autoplay 해금
3. Play 버튼 클릭 → audio.play() → isPlaying: true
4. 트랙 종료 → 'ended' 이벤트 → 다음 트랙 자동 재생 (순환)
5. 게임 진입 (transitioning) → volume fade out (500ms) → pause
6. 로비 복귀 → volume fade in → resume
7. 컴포넌트 언마운트 → currentTime/trackIndex 저장
```

---

## 구현 로드맵

### Phase 1: BgmPlayer 컴포넌트 구현
| Task | 설명 |
|------|------|
| BgmPlayer 컴포넌트 | `components/lobby/BgmPlayer.tsx` — HTMLAudioElement 기반 플레이어 |
| 플레이리스트 관리 | 트랙 배열, 인덱스 관리, 자동 다음 트랙 |
| 컨트롤 UI | Play/Pause, Prev/Next, Volume, Mute 버튼 |
| 프로그레스 바 | 현재 재생 위치 표시 + 클릭 시크 |
| Apex 스타일링 | 좌하단 버튼과 동일한 glass/clip-path/accent 디자인 |
| localStorage | 볼륨, 음소거, 트랙 인덱스 persist |

- **design**: Y (UI 컴포넌트)
- **verify**: 컴포넌트 렌더링, BGM 재생, 컨트롤 동작, 스타일 일관성

### Phase 2: page.tsx 통합 + 전환 처리
| Task | 설명 |
|------|------|
| page.tsx 배치 | 우하단 absolute 포지셔닝, NewsFeed 위 |
| Intro 연동 | staggered reveal 애니메이션 (좌하단과 동시) |
| 게임 전환 | transitioning/playing 시 fade out + pause |
| 로비 복귀 | 로비 복귀 시 fade in + resume |
| 모바일 대응 | 작은 화면에서 컴팩트 모드 |

- **design**: N (통합 + 로직)
- **verify**: 로비에서 표시, 게임 진입 시 숨김, 모바일 레이아웃
