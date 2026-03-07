# PLAN: v16 실시간 뉴스 시스템

## 1. 개요

### 배경
현재 하단 뉴스 피드(`NewsFeed.tsx`)는 영어 하드코딩 데모 데이터만 표시.
소켓(`global_event`)으로 이벤트를 수신하지만 NewsFeed에 연결되지 않음.
한국어 전환 시에도 영어 뉴스만 노출되는 i18n 불일치 문제 존재.

### 목표
- 게임 이벤트를 실시간 뉴스로 변환하는 **템플릿 기반 뉴스 생성 파이프라인** 구축
- `next-intl` 기반 **다국어 뉴스 템플릿** (en/ko) 지원
- 선택적 **LLM 에포크 요약** (GPT-4o-mini) 으로 내러티브 강화
- 기존 `NewsFeed.tsx` 리팩토링 + 소켓 연결

### 핵심 원칙
- **Tier 1 (즉시)**: 템플릿 헤드라인 — 0ms, $0 비용, 완벽한 i18n
- **Tier 2 (향후)**: 문맥 인식 변형 — 드라마틱 요소 (역전극, 배신 등)
- **Tier 3 (향후)**: LLM 에포크 요약 — 비동기, 월 $30~50

## 2. 요구사항

### 기능 요구사항
- [FR-1] 서버에서 게임 이벤트 발생 시 뉴스 아이템 생성 및 WebSocket 브로드캐스트
- [FR-2] 클라이언트에서 뉴스 아이템의 `templateId` + `params`로 현재 로케일에 맞는 헤드라인 렌더링
- [FR-3] 뉴스 타입별 태그 (전쟁, 외교, 경제 등) 다국어 지원
- [FR-4] 시간 표시 ("방금", "N분 전") 다국어 지원
- [FR-5] "LIVE" 뱃지, "뉴스 아카이브", "닫기" 등 UI 크롬 다국어 지원
- [FR-6] 소켓 미연결 시 템플릿 기반 데모 뉴스 표시 (현재 로케일)

### 비기능 요구사항
- [NFR-1] 뉴스 생성 지연: < 50ms (템플릿 렌더링)
- [NFR-2] 한국어 조사 처리 (이/가, 을/를, 은/는) 자동화
- [NFR-3] 뉴스 피드 최대 50개 아이템 유지 (메모리 관리)

## 3. 기술 방향

### 아키텍처 개요
```
[Go Server]                          [Next.js Client]
GameEvent (전투/외교/경제)            NewsFeed.tsx (하단 티커)
    │                                     ▲
    ▼                                     │
NewsGenerator                        useSocket.ts
├─ EventClassifier (분류+우선순위)    ├─ 'news_update' 수신
├─ TemplateSelector (변형 선택)      ├─ NewsItem[] 상태 관리
└─ NewsItem 생성 (templateId+params) └─ locale별 렌더링
    │
    ▼
WebSocket broadcast: 'news_update'
```

### 뉴스 아이템 프로토콜
```typescript
// 서버 → 클라이언트 전송 형태
interface NewsUpdate {
  id: string;
  category: 'military' | 'territorial' | 'diplomatic' | 'economic' | 'governance' | 'faction' | 'epoch';
  priority: number;          // 0-100
  templateId: string;        // "war.declared.neutral"
  params: Record<string, string>;  // { attacker: "USA", defender: "China" }
  countryISO?: string;
  targetISO?: string;
  timestamp: number;
}
```

### 클라이언트 렌더링 방식
```typescript
// next-intl ICU MessageFormat 활용
const tNews = useTranslations('news');
const headline = tNews(item.templateId, item.params);
// en: "USA declared war on China"
// ko: "미국이 중국에 선전포고"
```

### 한국어 조사 처리
```typescript
// 받침 유무에 따른 조사 자동 선택
function particle(word: string, type: 'subject'|'object'|'topic'): string {
  const code = word.charCodeAt(word.length - 1);
  const hasBatchim = (code - 0xAC00) % 28 !== 0;
  switch(type) {
    case 'subject': return hasBatchim ? '이' : '가';
    case 'object':  return hasBatchim ? '을' : '를';
    case 'topic':   return hasBatchim ? '은' : '는';
  }
}
// "미국" → 받침 없음 → "미국이" ❌ → "미국이" (ㄱ 받침 있음) ✅
```

**단, next-intl ICU MessageFormat에서는 조사를 템플릿에 직접 포함:**
```json
// ko.json — 국가명이 이미 한국어이므로 조사를 직접 지정
"war.declared": "{attacker}이(가) {defender}에 선전포고"
```
→ 실용적으로 `이(가)` 병기 표기가 게임 UI에서 가장 일반적

## 4. 뉴스 템플릿 카탈로그

### 카테고리별 템플릿 (Tier 1 — 총 ~60개)

| 카테고리 | templateId | en | ko |
|---------|-----------|----|----|
| **군사** | war.declared | {attacker} declared war on {defender} | {attacker}이(가) {defender}에 선전포고 |
| | war.ended | War between {side1} and {side2} has ended | {side1}와(과) {side2}의 전쟁 종결 |
| | battle.started | Battle erupting in {country} — {count} agents deployed | {country}에서 전투 발발 — {count}명 배치 |
| | battle.won | {winner} wins decisive battle in {country} | {winner}이(가) {country}에서 결정적 승리 |
| | bounty.alert | Bounty placed on {target} — reward: {reward} | {target}에 현상금 — 보상: {reward} |
| **영토** | sovereignty.claimed | {faction} claims sovereignty over {country} | {faction}이(가) {country} 주권 선언 |
| | domination.change | {nation} seized control of {country} from {previous} | {nation}이(가) {previous}로부터 {country} 점령 |
| | hegemony.achieved | {faction} achieved hegemony over {region} | {faction}이(가) {region} 패권 달성 |
| **외교** | treaty.signed | Trade agreement signed between {faction1} and {faction2} | {faction1}과(와) {faction2} 무역 협정 체결 |
| | alliance.formed | {faction1} and {faction2} formed {name} alliance | {faction1}과(와) {faction2}이(가) {name} 동맹 결성 |
| | alliance.broken | {faction} withdrew from {alliance} | {faction}이(가) {alliance}에서 탈퇴 |
| **경제** | economy.surge | {resource} prices surge — {country} GDP {change} | {resource} 가격 급등 — {country} GDP {change} |
| | economy.crash | Market crash in {country} — {sector} sector hit | {country} 시장 폭락 — {sector} 부문 타격 |
| | token.pump | {token} surged {percent} in 24h | {token} 24시간 내 {percent} 급등 |
| **거버넌스** | proposal.passed | Policy proposal passed in {country}: {title} | {country} 정책 가결: {title} |
| | proposal.rejected | {country} rejected proposal: {title} | {country} 정책 부결: {title} |
| **시즌** | epoch.started | Epoch {number} begins — new era dawns | 에포크 {number} 시작 — 새 시대 개막 |
| | epoch.ended | Epoch {number} complete — {topFaction} leads | 에포크 {number} 종료 — {topFaction} 선두 |
| | season.started | Season {number} "{name}" has begun | 시즌 {number} "{name}" 개막 |

(전체 ~60개 → en.json/ko.json의 `news` 네임스페이스에 추가)

## 5. UI 크롬 i18n

### NewsFeed.tsx에서 번역 필요한 문자열

| 현재 (영어 하드코딩) | en.json 키 | ko.json 값 |
|---------------------|-----------|------------|
| LIVE | news.live | 실시간 |
| NEWS ARCHIVE | news.archive | 뉴스 아카이브 |
| CLOSE | news.close | 닫기 |
| JUST NOW | news.timeJustNow | 방금 |
| {N}M AGO | news.timeMinutesAgo | {count}분 전 |
| {N}H AGO | news.timeHoursAgo | {count}시간 전 |
| {N}D AGO | news.timeDaysAgo | {count}일 전 |
| SOVEREIGNTY | news.tag.sovereignty | 주권 |
| BATTLE | news.tag.battle | 전투 |
| VICTORY | news.tag.victory | 승리 |
| WAR | news.tag.war | 전쟁 |
| DIPLOMACY | news.tag.diplomacy | 외교 |
| ECONOMY | news.tag.economy | 경제 |
| SEASON | news.tag.season | 시즌 |
| GLOBAL | news.tag.global | 글로벌 |

## 6. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 한국어 조사 부자연스러움 | UX 저하 | `이(가)` 병기 표기 (게임 업계 표준) |
| 뉴스 과다 (이벤트 폭주) | 피로감 | 쿨다운 (같은 타입 60초), 최대 50개 유지 |
| LLM 비용 증가 | 운영비 | Tier 3는 선택적, 에포크당 1회로 제한 |
| 서버-클라이언트 타입 불일치 | 빌드 실패 | shared 패키지에 NewsItem 타입 정의 |

## 구현 로드맵

### Phase 1: NewsFeed i18n + 소켓 연결
| Task | 설명 |
|------|------|
| NewsFeed UI 크롬 i18n | LIVE, ARCHIVE, CLOSE, 시간 표시, 태그 레이블을 next-intl로 교체 |
| news 네임스페이스 추가 | en.json/ko.json에 news.* 키 추가 (UI 크롬 + 데모 템플릿) |
| 데모 뉴스 템플릿화 | generateDemoNews()를 templateId+params 기반으로 리팩토링 |
| 소켓 연결 | page.tsx에서 uiState.globalEvents → NewsFeed news prop 전달 |
| EventTicker.tsx 제거 | 사용되지 않는 데드코드 정리 |

- **design**: N (기존 UI 유지, 텍스트만 교체)
- **verify**: 한국어 전환 시 뉴스 피드 전체 한국어 표시, 빌드 성공

### Phase 2: 서버 뉴스 생성기 (Go)
| Task | 설명 |
|------|------|
| NewsItem 타입 정의 | shared 패키지에 NewsUpdate 인터페이스 추가 |
| NewsGenerator 모듈 | Go 서버에 internal/news/generator.go 생성 |
| 이벤트→뉴스 매핑 | 기존 game event를 NewsItem으로 변환하는 분류기 |
| WebSocket 브로드캐스트 | news_update 이벤트로 클라이언트에 전송 |
| 뉴스 템플릿 확장 | 60개 이상 템플릿을 en.json/ko.json에 추가 |

- **design**: N (서버 로직)
- **verify**: 게임 이벤트 발생 시 클라이언트에 뉴스 수신 확인

### Phase 3: 컨텍스트 인식 + 뉴스 허브 (향후)
| Task | 설명 |
|------|------|
| 변형 템플릿 | 역전극/배신/복수 등 드라마틱 변형 추가 |
| 시간 감쇠 점수 | HN 스타일 relevance scoring |
| 뉴스 허브 탭 | GameSystemPopup에 "World News" 탭 추가 |
| 카테고리 필터 | 군사/외교/경제 등 필터링 |

- **design**: Y (뉴스 허브 UI)
- **verify**: 뉴스 탭에서 카테고리별 필터링 동작

### Phase 4: LLM 에포크 요약 (향후)
| Task | 설명 |
|------|------|
| LLM 클라이언트 | Go 서버에 GPT-4o-mini API 연동 |
| 에포크 요약 생성 | 에포크 종료 시 주요 이벤트 요약 기사 생성 |
| 다국어 생성 | 로케일별 별도 생성 (en/ko) |
| 캐싱 | 동일 에포크 요약 재생성 방지 |

- **design**: N (기사 텍스트만)
- **verify**: 에포크 종료 후 요약 기사 표시, 월 비용 $50 이내
