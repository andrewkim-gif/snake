# PLAN: AI World War — i18n (국제화) 지원

> **Version**: v14
> **Date**: 2026-03-07
> **Scope**: 영어(en) + 한국어(ko) 2개 언어 지원
> **Status**: Draft

---

## 1. 개요

AI World War에 다국어(i18n) 지원을 추가한다.
1단계로 영어(en)와 한국어(ko) 두 언어를 지원하며,
향후 언어 확장이 용이한 구조를 설계한다.

### 핵심 목표
- 35+ 컴포넌트의 하드코딩 텍스트를 번역 키로 교체
- 사용자가 언어를 전환할 수 있는 UI 제공
- 게임 성능에 영향 없는 경량 구현 (번들 +4KB 이하)
- 서버 텍스트(킬 메시지 등)는 구조화 데이터 → 클라이언트 번역 패턴

### 배경
- 현재 모든 UI 텍스트가 영어로 하드코딩
- `layout.tsx`에 `lang="ko"` 설정되어 있으나 실제 한국어 텍스트 없음
- 한국어 사용자와 영어 사용자 모두 타겟

---

## 2. 요구사항

### 기능 요구사항
- [FR-1] 영어/한국어 전환 가능한 언어 선택 UI
- [FR-2] 선택 언어 cookie 영속 (max-age=1년, 서버 초기 로케일 결정에도 사용)
- [FR-3] 브라우저 `Accept-Language` 헤더 기반 초기 언어 자동 감지
- [FR-4] 로비, 게임 HUD, 오버레이, 허브 페이지 전체 번역
- [FR-5] 동적 게임 텍스트 (킬 메시지, 라운드 상태) 번역 지원
- [FR-6] 날짜/숫자 포맷 로케일 대응 (1,000 vs 1.000)

### 비기능 요구사항
- [NFR-1] 번들 사이즈 증가 ≤ 5KB gzipped
- [NFR-2] 언어 전환 시 페이지 리로드 없음 (클라이언트 사이드 전환)
- [NFR-3] 번역 키 타입 안전성 (TypeScript 빌드 시 누락 키 에러)
- [NFR-4] 향후 5+ 언어 확장 시 코드 변경 최소 (JSON 파일 추가만으로)

---

## 3. 기술 방향

### 라이브러리 선정: next-intl

| 후보 | 번들 | Next.js 15 호환 | Client 컴포넌트 | 선정 |
|-------|-------|-----------------|----------------|------|
| **next-intl** | ~4KB (precompile) | 공식 지원 | `useTranslations` 훅 | **채택** |
| next-international | ~3-5KB | 지원 | `useI18n` 훅 | 대안 |
| Custom Context | 0KB | N/A | 직접 구현 | 2언어 한정시만 |
| react-intl | ~13KB | 부분 지원 | FormatMessage | 과잉 |

**next-intl 선정 근거:**
1. Next.js 15 App Router 공식 지원
2. `precompile: true`로 번들 4KB — Three.js(600KB) 대비 무시 가능
3. ICU 메시지 포맷 (복수형: `{count, plural, one {# kill} other {# kills}}`)
4. TypeScript 키 자동완성 + 빌드 시 누락 키 검출
5. 네임스페이스별 메시지 분할 로딩 가능

### URL 전략: Cookie 기반 (URL 프리픽스 없음)

```
❌ /en/game, /ko/game  → URL 변경 = 라우트 전면 재구성 필요
✅ /game (cookie: locale=ko) → 기존 URL 구조 유지
```

- 게임 특성상 URL에 언어 코드 불필요 (SEO 중요도 낮음)
- 기존 라우팅(`/`, `/(hub)/economy` 등) 변경 없음
- `cookies().get('locale')` → 서버에서 초기 로케일 결정

### 네임스페이스 구조

```
messages/
├── en.json        # 영어 (기본)
└── ko.json        # 한국어

네임스페이스 (JSON 최상위 키):
├── common         # 공유 UI: 버튼, 상태, 에러, 시간 포맷
├── nav            # 탭 바, 메뉴 아이템 (WORLD, ECONOMY, GOVERN...)
├── lobby          # 헤더, 에이전트 셋업, 튜토리얼, 캐릭터 에디터, 뉴스피드
├── game           # HUD, 킬피드, 빌드, 미니맵, XP, 레벨업, 시너지
├── overlay        # 사망, 전투결과, 카운트다운, 라운드결과
├── world          # 국가 패널, 지구본, 소버린티, GDP, 전투상태
├── economy        # 토큰, 거래소, 정책 (슬라이더 라벨, 설명)
├── governance     # 제안, 투표, 히스토리
├── faction        # 대시보드, 외교, 재무, 전쟁
├── blockchain     # 지갑, 스테이킹, 토큰 밸런스
├── profile        # 업적, 통계
├── hallOfFame     # 시즌, 타임라인
├── dashboard      # API 키, 에이전트, 전략
├── market         # 용병 마켓, 고용, 배치
└── upgrades       # 업그레이드 ID → 이름/설명 매핑 (LevelUpOverlay)
```

### 동적 게임 텍스트 패턴

**번역 가능 (구조화 데이터 → 클라이언트 템플릿):**
```
서버 전송: { type: 'kill', killer: 'Player1', victim: 'Player2' }
클라이언트:
  en: t('killMessage', { killer, victim }) → "Player1 eliminated Player2"
  ko: t('killMessage', { killer, victim }) → "Player1이(가) Player2를 처치했습니다"

서버 전송: { type: 'levelUp', choiceId: 'speed_dash', level: 3 }
클라이언트:
  en: t(`upgrades.${choiceId}.name`) → "Speed Dash"
  ko: t(`upgrades.${choiceId}.name`) → "스피드 대시"
```

**번역 제외 (v1에서 영어 유지, 향후 개선):**
| 컴포넌트 | 텍스트 유형 | 이유 |
|----------|-----------|------|
| CoachBubble | AI 코치 조언 | 서버 AI가 자연어 생성 — 번역 불가 |
| AnalystPanel | 라운드 분석 | 서버 분석 엔진이 영어 출력 |

→ 향후 서버에서 `locale` 파라미터를 받아 해당 언어로 생성하는 방식으로 확장 가능

---

## 4. 아키텍처 개요

> **핵심 제약**: `router.refresh()`는 Client Component 트리를 재마운트하여
> SocketProvider의 WebSocket 연결을 파괴한다. 따라서 **Client-side Locale Context** 패턴을 사용한다.

```
┌─────────────────────────────────────────────────────┐
│  next.config.ts                                      │
│  └─ createNextIntlPlugin({ precompile: true })       │
│     └─ wraps existing nextConfig                     │
├─────────────────────────────────────────────────────┤
│  i18n/request.ts (서버)                              │
│  └─ getRequestConfig → cookie('locale') → messages   │
│     (초기 로드 시만 사용 — 이후 전환은 클라이언트)       │
├─────────────────────────────────────────────────────┤
│  app/layout.tsx (서버 컴포넌트)                       │
│  └─ 모든 로케일 메시지 로드 (ko + en)                 │
│     └─ I18nClientWrapper ← NEW (Client Component)    │
│        ├─ locale state 관리                          │
│        ├─ NextIntlClientProvider(messages[locale])    │
│        └─ SocketProvider (WebSocket 안전!)            │
│           └─ children                                │
├─────────────────────────────────────────────────────┤
│  컴포넌트 (클라이언트)                                │
│  └─ useTranslations('namespace')                     │
│     └─ t('key') / t('key', { param: value })         │
│  └─ useLocale() → { locale, setLocale }              │
├─────────────────────────────────────────────────────┤
│  messages/en.json, messages/ko.json                  │
│  └─ 네임스페이스별 분리된 번역 키-값                   │
└─────────────────────────────────────────────────────┘
```

### I18nClientWrapper 설계

```tsx
// providers/I18nClientWrapper.tsx
'use client';
import { NextIntlClientProvider } from 'next-intl';
import { createContext, useContext, useState, useCallback } from 'react';

const LocaleContext = createContext<{
  locale: string;
  setLocale: (l: string) => void;
}>(null!);

export function I18nClientWrapper({
  initialLocale,
  allMessages,
  children,
}: {
  initialLocale: string;
  allMessages: Record<string, any>;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState(initialLocale);

  const setLocale = useCallback((newLocale: string) => {
    setLocaleState(newLocale);
    document.cookie = `locale=${newLocale};path=/;max-age=31536000`;
    document.documentElement.lang = newLocale;
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={allMessages[locale]}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);
```

### 언어 전환 플로우 (WebSocket 안전)
```
사용자 클릭 [🌐 EN/KO]
  → setLocale('en')
    → React state 변경 → NextIntlClientProvider messages 교체 (즉시)
    → document.cookie 설정 → 다음 서버 렌더에 초기값으로 반영
    → document.documentElement.lang 업데이트
  → SocketProvider 유지 (언마운트 없음!) ← 핵심
  → ❌ router.refresh() 호출 안 함
```

**트레이드오프**: 2개 로케일 JSON 동시 로드 (~10-20KB) — Three.js(600KB) + MapLibre(250KB) 대비 무시 가능.
향후 5+ 언어 확장 시에는 dynamic import로 필요 로케일만 로드하는 최적화 가능.

---

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| ~~router.refresh() WebSocket 파괴~~ | ~~연결 끊김~~ | ✅ **해결**: Client-side Locale Context 패턴으로 대체 (§4) |
| 번역 누락 키 | 빈 텍스트 표시 | TypeScript strict + `defaultTranslationValues` fallback |
| 한국어 텍스트 길이 차이 (+20~50%) | 레이아웃 깨짐 | Phase 6 한국어 레이아웃 검증 체크리스트로 전수 확인 |
| 게임 중 언어 전환 | 불필요한 리렌더 | playing 모드에서 LanguageSwitcher 비활성화 |
| next-intl + R3F 충돌 | Canvas 리렌더 | HUD는 Canvas 밖 HTML — Provider 충돌 없음 (검증 완료) |
| 서버 생성 동적 텍스트 | 영어 노출 | 구조화 데이터는 클라이언트 번역, AI 생성 텍스트는 v1 영어 유지 |
| 2언어 JSON 동시 로드 | 번들 +10-20KB | Three.js(600KB) 대비 무시 가능, 5+ 언어 시 dynamic import 전환 |

---

## 구현 로드맵
<!-- da:work Stage 0 자동 파싱 대상 -->

### Phase 1: i18n 인프라 설정
| Task | 설명 |
|------|------|
| next-intl 설치 | `npm install next-intl` in apps/web |
| next.config.ts 래핑 | `createNextIntlPlugin` 으로 기존 config 래핑 |
| i18n/request.ts 생성 | cookie 기반 로케일 감지 + Accept-Language 파싱 + 메시지 로딩 |
| I18nClientWrapper 생성 | locale state 관리 + NextIntlClientProvider 래핑 (§4 설계 참조) |
| layout.tsx 수정 | 모든 로케일 메시지 사전 로드, I18nClientWrapper 삽입, `lang` 동적 설정 |
| generateMetadata() 전환 | 정적 `export const metadata` → 동적 `generateMetadata()` (로케일별 title/description) |
| 빈 번역 파일 생성 | `messages/en.json`, `messages/ko.json` 스켈레톤 |
| TypeScript 설정 | 번역 키 타입 안전성 설정 (`global.d.ts`) |
| LanguageSwitcher 컴포넌트 | 공용 EN/KO 토글 버튼 (`useLocale()` 훅 사용, 로비+허브 양쪽에서 재사용) |

- **design**: N (설정 중심)
- **verify**: `npm run build` 성공, `useTranslations` 호출 가능 확인, 언어 전환 시 WebSocket 유지 확인

### Phase 2: 공통 + 네비게이션 번역
| Task | 설명 |
|------|------|
| common 네임스페이스 | 공유 버튼/상태/에러/시간 포맷 번역 키 작성 |
| nav 네임스페이스 | TopNavBar, BottomTabBar, MoreMenu 탭/메뉴 라벨 |
| TopNavBar 마이그레이션 | 하드코딩 → `t('nav.world')` 등으로 교체 |
| BottomTabBar 마이그레이션 | 동일 |
| MoreMenu 마이그레이션 | 동일 |

- **design**: N (텍스트 교체만)
- **verify**: 네비게이션 렌더링 확인, 빌드 성공

### Phase 3: 로비 컴포넌트 번역
| Task | 설명 |
|------|------|
| lobby 네임스페이스 | LobbyHeader, AgentSetup, Tutorial, CharacterCreator, NewsFeed 키 작성 |
| LobbyHeader | 로고, 상태, 뷰 토글 텍스트 교체 |
| page.tsx (메인) | "DEPLOYING TO ARENA...", "AGENT SETUP", "CLICK A COUNTRY TO DEPLOY" 등 |
| WelcomeTutorial | 3단계 튜토리얼 제목+설명+버튼 교체 (가장 긴 텍스트) |
| CharacterCreator | 탭 라벨, 바디타입, 카테고리, 헤어스타일 이름 교체 |
| NewsFeed | LIVE, 뉴스 타입 태그, 시간 포맷, 데모 헤드라인 교체 |
| TrainingConsole | 훈련 콘솔 UI 텍스트 교체 |
| PixelLogo | 로고 alt 텍스트 교체 |
| 언어 전환 UI (로비) | LobbyHeader에 LanguageSwitcher 삽입 |
| 언어 전환 UI (허브) | `(hub)/layout.tsx` 헤더에 LanguageSwitcher 삽입 |
| (hub)/layout.tsx 텍스트 | "AI WORLD WAR" 폴백, "ALPHA" 뱃지, "TOKEN HOLDINGS" 교체 |

- **design**: Y (언어 전환 버튼 UI)
- **verify**: 로비 + 허브 양쪽에서 EN↔KO 전환 동작 확인, WebSocket 유지 확인

### Phase 4: 게임 HUD + 오버레이 번역
| Task | 설명 |
|------|------|
| game + overlay 네임스페이스 | HUD, 킬피드, 빌드, 사망, 전투결과, 카운트다운 키 작성 |
| DeathOverlay | "Oh No!", 킬러 메시지, 스탯 라벨, 버튼 |
| BattleResultOverlay | "BATTLE COMPLETE", 순위/점수/생존 라벨, 팩션 결과 |
| CountdownOverlay | 카운트다운 텍스트 |
| RoundResultOverlay | 라운드 결과 텍스트 |
| KillFeedHUD | 킬 메시지 템플릿 (`{killer} eliminated {victim}`) |
| BuildHUD / XPBar | 빌드 선택, XP, 레벨업 텍스트 |
| CommanderHUD | 커맨더 모드 텍스트 |
| ShrinkWarning | 축소 경고 메시지 |
| SpectatorMode | "SPECTATING", "FREE CAM", "FOLLOW", "{N} watching" 등 관전 UI |
| LevelUpOverlay | "LEVEL UP! Lv.{N}", "Choose an upgrade [1][2][3]" |
| SynergyPopup | 시너지 팝업 텍스트 |
| FactionScoreboard | 팩션 점수판 라벨 |
| GameMinimap | 미니맵 UI 라벨 (있는 경우) |

**번역 제외 (서버 생성 동적 텍스트):**
- `CoachBubble` — AI 코치 메시지는 서버가 자연어로 생성 → v1에서는 영어 유지
- `AnalystPanel` — 라운드 분석 결과는 서버 생성 → v1에서는 영어 유지
- `LevelUpOverlay`의 업그레이드 이름/설명 — shared 패키지 ID → 클라이언트에서 키 매핑 (별도 `upgrades` 네임스페이스)

- **design**: N (텍스트 교체만)
- **verify**: 게임 진입 → HUD/오버레이 텍스트 표시 확인, 관전 모드 텍스트 확인

### Phase 5: 허브 페이지 번역
| Task | 설명 |
|------|------|
| world 네임스페이스 | CountryPanel 탭/섹션/전투상태 키 작성 |
| economy 네임스페이스 | PolicyPanel 슬라이더+설명, TradeMarket 리소스+탭 |
| governance 네임스페이스 | ProposalForm, VoteInterface, ProposalList, History |
| faction 네임스페이스 | FactionDashboard 5탭 전체 (멤버/영토/외교/재무/전쟁) |
| blockchain 네임스페이스 | WalletConnect, StakingPanel, TokenBalanceList |
| profile 네임스페이스 | 업적 이름+설명, 통계 라벨 |
| hallOfFame 네임스페이스 | 시즌, 카테고리, 빈 상태 |
| market 네임스페이스 | 용병 마켓, 티어, 고용/배치 |
| faction 추가 컴포넌트 | FactionDetail, FactionList, TechTree (테크 노드 이름/설명) |
| world 추가 컴포넌트 | UNCouncil (UN 의회 텍스트), WorldMap (지도 라벨) |
| blockchain 추가 컴포넌트 | CountryTokenInfo (토큰 정보 라벨) |
| hallOfFame 추가 컴포넌트 | SeasonTimeline (시즌 타임라인 라벨) |
| dashboard 네임스페이스 | API 키 관리, 에이전트, 전략 |
| 에러/로딩 페이지 | error.tsx, loading.tsx 공통 텍스트 |
| upgrades 네임스페이스 | 업그레이드 ID → 이름/설명 매핑 (LevelUpOverlay에서 사용) |

- **design**: N (텍스트 교체만)
- **verify**: 각 허브 페이지 렌더링 확인, 빌드 성공

### Phase 6: 폴리시 + 검증
| Task | 설명 |
|------|------|
| 한국어 레이아웃 검증 | 아래 체크리스트 기준으로 텍스트 길이 차이 검증 및 수정 |
| 브라우저 언어 자동감지 | i18n/request.ts에서 Accept-Language 헤더 파싱 (2언어: 간단 includes 검사) |
| 게임 중 전환 방지 | playing 모드에서 LanguageSwitcher 비활성화 또는 숨김 |
| 번역 완성도 검증 | 전체 키 매핑 검증, 누락 키 TypeScript 에러 해결 |

**한국어 레이아웃 검증 체크리스트:**
| 대상 | 영어 → 한국어 예상 길이 비율 | 검증 포인트 |
|------|--------------------------|-----------|
| 탭 바 라벨 | WORLD→월드 (-20%) | BottomTabBar 5탭 간격 확인 |
| 버튼 텍스트 | PLAY AGAIN→다시 플레이 (+20%) | 고정폭 버튼 min-width 확인 |
| 상태 뱃지 | Online→온라인 (+30%) | LobbyHeader 뱃지 넘침 확인 |
| 튜토리얼 설명 | 영어 3문장→한국어 3문장 (+30~50%) | WelcomeTutorial 패널 스크롤 확인 |
| 킬 메시지 | "Eaten by X"→"X에게 처치됨" (+50%) | DeathOverlay 텍스트 래핑 확인 |
| 업그레이드 카드 | "Choose upgrade"→"업그레이드 선택" (+40%) | LevelUpOverlay 카드 너비 확인 |
| 정책 설명 | 영어 1줄→한국어 1.5줄 (+50%) | PolicyPanel 슬라이더 라벨 래핑 확인 |

- **design**: N
- **verify**: 전체 앱 EN↔KO 전환 테스트, 빌드 성공, 모든 체크리스트 항목 통과
