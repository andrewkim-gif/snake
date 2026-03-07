# PLAN: GameSystem 팝업 한국어 완전 적용 + 탭 UI 개선

## 1. 개요
GameSystem 팝업의 허브 페이지들이 `next-intl` 번역을 사용하지 않고 영어를 하드코딩하고 있어,
한국어 설정에서도 영어가 그대로 노출됨. 탭 네비게이션의 폰트가 너무 작고 상단에 붙어 있어 가독성 개선 필요.

## 2. 문제 분석

### 2-1. 하드코딩된 영어 (총 54곳)

| 파일 | 하드코딩 수 | 주요 항목 |
|------|------------|----------|
| economy/tokens/page.tsx | 10 | 'Total Market Cap', 'Total Staked', 'Token Rankings' 등 |
| economy/policy/page.tsx | 4 | 'Nation', 'Republic of Korea', 'Loading...' |
| factions/page.tsx | 8 | 'Active Factions', 'Total Members', 'Territories', 'GDP' |
| governance/page.tsx | 7 | 'Total Proposals', 'Active Voting', 'Passed', 'Rejected' |
| hall-of-fame/page.tsx | 8 | 'Total Seasons', 'Total Records', 'Season' |
| profile/page.tsx | 2 | 'Connected:', 'Loading achievements...' |
| SettingsContent.tsx | 6 | 'Language', 'Sound', 'Controls', 'Coming soon' |
| GameSystemPopup.tsx | 3 | 'LOADING...', 'DASHBOARD', 'Coming soon' |
| 기타 (trade, market, new, history) | 6 | 각종 Loading 텍스트 |

### 2-2. 탭 UI 문제
- **폰트 크기**: 메인 탭 `11px`, 서브 탭 `11px` → 너무 작음
- **상단 여백**: 탭 바가 팝업 최상단에 바로 붙어 있음 (padding-top 없음)
- **아이콘 크기**: 14px → 작음

## 3. 기술 방향

### 번역 적용 방식
- 각 허브 페이지에 이미 `useTranslations` import가 있으므로, 기존 번역 훅 활용
- `ko.json`에 누락된 키만 추가 (대부분 이미 존재)
- `en.json`에도 동일 키 추가하여 양방향 일관성 유지

### 탭 UI 개선 방식
- PopupTabNav.tsx의 인라인 스타일 수정
- 메인 탭: fontSize `11px` → `13px`, padding 증가
- 서브 탭: fontSize `11px` → `12px`
- 팝업 상단에 padding-top 추가 (탭 바가 아래로 내려감)
- 아이콘: 14px → 16px

## 4. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 번역 키 불일치 | 빈 텍스트 표시 | en.json/ko.json 동시 업데이트 |
| 탭 오버플로우 (폰트 증가) | 탭이 넘침 | overflow-x: auto 이미 적용됨 |
| 모바일 가독성 | 탭 텍스트 잘림 | 아이콘만 표시 breakpoint 고려 |

## 구현 로드맵

### Phase 1: 탭 UI 스타일 개선
| Task | 설명 |
|------|------|
| PopupTabNav 스타일 수정 | 메인 탭 폰트 13px, 아이콘 16px, padding 증가 |
| 상단 여백 추가 | GameSystemPopup에 탭 바 위 패딩 추가 |
| 서브 탭 폰트 증가 | 서브 탭 12px, padding 약간 증가 |

- **design**: Y
- **verify**: 팝업 열어서 탭 가독성 확인, 모바일 오버플로우 확인

### Phase 2: 번역 키 추가 (en.json + ko.json)
| Task | 설명 |
|------|------|
| Stat 라벨 키 추가 | totalMarketCap, totalStaked, activeFactions 등 |
| Panel 타이틀 키 추가 | marketCapRanking, tokenRankings, defenseBuffMap 등 |
| Settings 키 추가 | language, sound, controls, comingSoon |
| Hall of Fame 추가 키 | totalSeasons, totalRecords, peakPlayers 등 |
| 공통 로딩 텍스트 키 | loadingAchievements, loadingDashboard 등 |

- **design**: N
- **verify**: JSON 파싱 오류 없음, 키 일관성 확인

### Phase 3: 허브 페이지 번역 적용
| Task | 설명 |
|------|------|
| economy/tokens 번역 적용 | 10개 하드코딩 → useTranslations |
| economy/policy 번역 적용 | 4개 하드코딩 → useTranslations |
| factions/page 번역 적용 | 8개 하드코딩 → useTranslations |
| governance/page 번역 적용 | 7개 하드코딩 → useTranslations |
| hall-of-fame/page 번역 적용 | 8개 하드코딩 → useTranslations |
| profile/page 번역 적용 | 2개 하드코딩 → useTranslations |
| SettingsContent 번역 적용 | 6개 하드코딩 → useTranslations |
| GameSystemPopup 번역 적용 | 3개 하드코딩 → useTranslations |
| 기타 소규모 페이지 번역 적용 | trade, market, new, history 각 1개 |

- **design**: N
- **verify**: 한국어 설정에서 모든 허브 탭 영어 없음 확인

### Phase 4: 최종 검증
| Task | 설명 |
|------|------|
| 전체 탭 한국어 스크린 확인 | 7개 메인 탭 + 서브 탭 전수 검사 |
| 영어 모드 정상 확인 | en 설정에서도 깨짐 없이 표시 |
| 빌드 검증 | next build 성공 확인 |

- **design**: N
- **verify**: 빌드 성공, 양 언어 모두 정상 렌더링
