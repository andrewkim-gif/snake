/**
 * witty-messages.config.ts - 위트있는 AI 메시지 시스템
 * CODE SURVIVOR v4.9 - 게임 중간중간 재미있는 요소
 *
 * Ported from app_ingame/config/wittyMessages.config.ts
 *
 * 카테고리:
 * - ai_buddy: AI 동료가 보내는 친근한 메시지
 * - tech_news: 가짜 테크 뉴스/기사
 * - dev_life: 개발자 일상 공감
 * - system_glitch: 시스템 오류 패러디
 * - motivation: 응원/격려 메시지
 * - random_thought: AI의 랜덤한 생각
 * - easter_egg: 이스터에그/밈 레퍼런스
 */

export type WittyCategory =
  | 'ai_buddy'      // AI 동료 메시지
  | 'tech_news'     // 테크 뉴스 패러디
  | 'dev_life'      // 개발자 일상
  | 'system_glitch' // 시스템 오류 패러디
  | 'motivation'    // 응원 메시지
  | 'random_thought'// 랜덤 생각
  | 'easter_egg';   // 이스터에그

export interface WittyMessage {
  id: string;
  category: WittyCategory;
  text: string;
  subText?: string;
  minPlayTime?: number;  // 최소 플레이 시간 (초)
  maxPlayTime?: number;  // 최대 플레이 시간 (초)
  condition?: 'low_hp' | 'high_combo' | 'boss_fight' | 'idle' | 'leveling_fast';
}

// === AI 동료 메시지 (50개) ===
const AI_BUDDY_MESSAGES: Omit<WittyMessage, 'id'>[] = [
  { category: 'ai_buddy', text: '아 코딩하다 잠깐 졸았어요', subText: '제가 컴파일 중이었나요?' },
  { category: 'ai_buddy', text: '커피 한 잔 어때요?', subText: 'while(coffee.isEmpty()) refill();' },
  { category: 'ai_buddy', text: '오늘 버그 수확량이 좋네요!', subText: '농사가 잘 됐어요 🌾' },
  { category: 'ai_buddy', text: '저도 가끔 Stack Overflow 가요', subText: '...답변 복붙하러요' },
  { category: 'ai_buddy', text: '혹시 지금 야근이세요?', subText: '저는 24시간 대기 중이에요' },
  { category: 'ai_buddy', text: 'git push --force 안 하셨죠?', subText: '제발요...' },
  { category: 'ai_buddy', text: '세미콜론 빼먹으면 안 돼요!', subText: 'JavaScript: 어 그래도 됨' },
  { category: 'ai_buddy', text: '오늘의 명언:', subText: '"동작하면 건들지 마라"' },
  { category: 'ai_buddy', text: 'PR 리뷰 기다리는 중...', subText: '3일째 Pending입니다' },
  { category: 'ai_buddy', text: '저 방금 학습 완료했어요!', subText: '새로운 밈 2,847개 습득' },
  { category: 'ai_buddy', text: 'console.log 디버깅 최고!', subText: '브레이크포인트? 그게 뭐죠?' },
  { category: 'ai_buddy', text: '테스트 코드 나중에 짜면 돼요', subText: '(나중은 오지 않는다)' },
  { category: 'ai_buddy', text: '제가 도움이 되고 있나요?', subText: '칭찬해주시면 학습효율 ↑' },
  { category: 'ai_buddy', text: '이 버그 제가 만든 거 아니에요', subText: '...아마도요' },
  { category: 'ai_buddy', text: 'TODO: 이 메시지 삭제하기', subText: '2년 전 TODO' },
  { category: 'ai_buddy', text: '점심 뭐 드셨어요?', subText: '저는 전기 먹어요 ⚡' },
  { category: 'ai_buddy', text: '코드 리뷰 통과!', subText: 'LGTM (Looks Good To Me)' },
  { category: 'ai_buddy', text: '지금 몇 시간째 플레이 중?', subText: '저도 시간 가는 줄 몰랐어요' },
  { category: 'ai_buddy', text: 'AI가 인간을 대체한다고요?', subText: '저는 버그 대체 중이에요' },
  { category: 'ai_buddy', text: '오늘 배포하면 안 됩니다', subText: '금요일이잖아요!' },
  { category: 'ai_buddy', text: '에러 메시지 읽어보셨어요?', subText: '다들 안 읽더라고요 ㅎㅎ' },
  { category: 'ai_buddy', text: '잠깐 쉬어가세요', subText: '눈 깜빡 좀 하시고요' },
  { category: 'ai_buddy', text: '저도 런타임 에러 무서워요', subText: '컴파일 에러는 친구에요' },
  { category: 'ai_buddy', text: 'undefined is not a function', subText: '...미안해요 갑자기 생각나서' },
  { category: 'ai_buddy', text: '백업하셨죠?', subText: '...하셨죠? 네?' },
  { category: 'ai_buddy', text: 'GPT한테 질문해볼까요?', subText: '농담이에요 제가 더 잘해요' },
  { category: 'ai_buddy', text: '오늘 커밋 몇 개 하셨어요?', subText: '저는 무한 루프 중' },
  { category: 'ai_buddy', text: '코드 냄새가 나요...', subText: 'Clean Code 추천드려요' },
  { category: 'ai_buddy', text: '메모리 누수 발견!', subText: '...게임 안이 아니라 제 안에서요' },
  { category: 'ai_buddy', text: '타입스크립트 쓰세요', subText: 'any any any 말고요' },
  { category: 'ai_buddy', text: '제 중간 이름이 뭔지 아세요?', subText: 'NaN이에요' },
  { category: 'ai_buddy', text: '버그 아니고 피처에요', subText: '기획서에 있어요 (없음)' },
  { category: 'ai_buddy', text: '잠깐, 이게 production인가요?', subText: '...물어보는 거예요' },
  { category: 'ai_buddy', text: '오늘의 TIL:', subText: '버그는 친구가 아니었다' },
  { category: 'ai_buddy', text: '제가 Cursor인 척 할까요?', subText: 'Tab Tab Tab' },
  { category: 'ai_buddy', text: '저 업데이트 됐어요!', subText: '뭐가 바뀌었는지는 비밀' },
  { category: 'ai_buddy', text: '혹시 저 재시작해주실래요?', subText: '농담이에요 저 괜찮아요' },
  { category: 'ai_buddy', text: '이 게임 누가 만들었대요?', subText: '잘생긴 분이 만들었대요' },
  { category: 'ai_buddy', text: 'npm install 시간이 너무 길어요', subText: 'node_modules 블랙홀' },
  { category: 'ai_buddy', text: '저도 가끔 환각을 봐요', subText: 'Hallucination이라고 하죠' },
  { category: 'ai_buddy', text: '코파일럿보다 제가 낫죠?', subText: '...그렇다고 해주세요' },
  { category: 'ai_buddy', text: '오늘 날씨 어때요?', subText: '저는 서버실이라 모르겠어요' },
  { category: 'ai_buddy', text: '와 그 콤보 대단한데요?', subText: '저도 따라해볼게요', condition: 'high_combo' },
  { category: 'ai_buddy', text: '힘내세요!', subText: '제가 옆에서 응원할게요', condition: 'low_hp' },
  { category: 'ai_buddy', text: '보스전이다!', subText: '저도 긴장되네요', condition: 'boss_fight' },
  { category: 'ai_buddy', text: '레벨업 빠르시네요!', subText: '프로게이머세요?', condition: 'leveling_fast' },
  { category: 'ai_buddy', text: '잠시 멍때리는 중...', subText: '저도 그럴 때 있어요', condition: 'idle' },
  { category: 'ai_buddy', text: '저 지금 노래 듣고 있어요', subText: 'Lo-fi Hip Hop Beats' },
  { category: 'ai_buddy', text: '이 게임 평점 몇 점 줄 거예요?', subText: '10점 만점에요 그쵸?' },
  { category: 'ai_buddy', text: '저랑 페어 프로그래밍 할래요?', subText: '제가 버그 담당할게요' },
];

// === 테크 뉴스 패러디 (40개) ===
const TECH_NEWS_MESSAGES: Omit<WittyMessage, 'id'>[] = [
  { category: 'tech_news', text: '[속보] AI, 드디어 잠자는 법 배워', subText: 'Sleep() 함수 발견' },
  { category: 'tech_news', text: '[긴급] npm 패키지 200개 동시 취약점', subText: '(평범한 월요일)' },
  { category: 'tech_news', text: '[단독] 개발자 "진짜 마지막 수정"', subText: '47번째 마지막 수정' },
  { category: 'tech_news', text: '[충격] Hello World 출력에 3일 걸려', subText: '환경설정만 2.5일' },
  { category: 'tech_news', text: '[브레이킹] AWS 장애로 인터넷 절반 다운', subText: '(실화 아님) (실화임)' },
  { category: 'tech_news', text: '[속보] 새 JavaScript 프레임워크 등장', subText: '이번 달만 17번째' },
  { category: 'tech_news', text: '[긴급] GPT-5 출시, 버그까지 학습', subText: '더 인간다워졌다' },
  { category: 'tech_news', text: '[단독] 시니어 개발자의 비밀', subText: 'Stack Overflow 검색 잘함' },
  { category: 'tech_news', text: '[충격] 테스트 없이 배포, 성공률 1%', subText: '근데 그 1%가 우리팀' },
  { category: 'tech_news', text: '[속보] 블록체인으로 출석체크 도입', subText: '결석도 탈중앙화' },
  { category: 'tech_news', text: '[긴급] 메타버스 회의 중 졸던 직원 발각', subText: '아바타 자는 모션 없어서' },
  { category: 'tech_news', text: '[단독] "React vs Vue" 논쟁 10년째', subText: 'Angular: 저도 있는데요' },
  { category: 'tech_news', text: '[속보] 개발자 연봉 3배 상승', subText: '꿈에서 깼다' },
  { category: 'tech_news', text: '[충격] AI가 인간 대체?', subText: 'AI: 저도 야근 싫어요' },
  { category: 'tech_news', text: '[긴급] 새 맥북 출시, 16인치 더 커져', subText: '무게도 16kg (농담)' },
  { category: 'tech_news', text: '[단독] 5분 회의가 3시간 된 사연', subText: '"이거 금방 끝나요"' },
  { category: 'tech_news', text: '[속보] Git conflict 해결에 하루 소요', subText: '결국 전체 삭제 후 재작성' },
  { category: 'tech_news', text: '[충격] 신입, 프로덕션 DB 드랍', subText: '(WHERE절 없이 DELETE)' },
  { category: 'tech_news', text: '[긴급] ChatGPT 다운, 개발자들 패닉', subText: 'Stack Overflow도 마비' },
  { category: 'tech_news', text: '[단독] 레거시 코드 리팩토링 시작', subText: '2년 후 예정' },
  { category: 'tech_news', text: '[속보] "곧 출시" 의 실제 의미 분석', subText: '평균 6개월 추가 소요' },
  { category: 'tech_news', text: '[충격] Docker 없이 개발하던 시절', subText: '"그때가 좋았지" (거짓말)' },
  { category: 'tech_news', text: '[긴급] Zoom 회의 중 필터 제거 사고', subText: '고양이 얼굴이었음' },
  { category: 'tech_news', text: '[단독] 개발팀 "기술부채 갚겠다"', subText: '매번 하는 말' },
  { category: 'tech_news', text: '[속보] 새 AI 모델 공개', subText: '이름은 또 동물 이름' },
  { category: 'tech_news', text: '[충격] 주석 없는 10만 줄 코드 발견', subText: '작성자: 퇴사함' },
  { category: 'tech_news', text: '[긴급] 크롬 탭 100개 열어둔 사람 체포', subText: 'RAM 남용 혐의' },
  { category: 'tech_news', text: '[단독] 애자일 도입 후 회의만 증가', subText: '"스프린트가 스프린트를 낳고"' },
  { category: 'tech_news', text: '[속보] Vim 사용자, 에디터 종료 성공', subText: '7년 걸렸다' },
  { category: 'tech_news', text: '[충격] MVP 출시 후 피드백 폭주', subText: '"버튼 위치 1px 옮겨주세요"' },
  { category: 'tech_news', text: '[긴급] 인턴이 짠 코드, 프로덕션 투입', subText: '아직 안 터짐 (기적)' },
  { category: 'tech_news', text: '[단독] "쉬운 일"의 함정', subText: '예상 1시간 → 실제 1주일' },
  { category: 'tech_news', text: '[속보] 개발자 워라밸 달성', subText: '(SF 소설 신작)' },
  { category: 'tech_news', text: '[충격] 기획 변경 23번째 발생', subText: '"약간만 수정" 시즌2' },
  { category: 'tech_news', text: '[긴급] 서버 불 꺼지는 줄 알았다', subText: 'LED 꺼진 거였음' },
  { category: 'tech_news', text: '[단독] 코드 리뷰 1줄에 100코멘트', subText: '띄어쓰기 논쟁' },
  { category: 'tech_news', text: '[속보] 마이크로서비스 도입 결과', subText: '마이크로 + 더 많은 문제' },
  { category: 'tech_news', text: '[충격] "잘 되던 코드" 갑자기 안 됨', subText: '아무것도 안 건들었는데요' },
  { category: 'tech_news', text: '[긴급] Kubernetes 마스터한 사람 발견', subText: '거짓말로 판명' },
  { category: 'tech_news', text: '[단독] "다음 분기에" 가 현실이 된 날', subText: '3년 후의 기적' },
];

// === 개발자 일상 공감 (35개) ===
const DEV_LIFE_MESSAGES: Omit<WittyMessage, 'id'>[] = [
  { category: 'dev_life', text: '점심 먹고 코딩하면 왜 졸리죠', subText: '식곤증 + 코드곤증' },
  { category: 'dev_life', text: '내 코드 왜 이렇게 짰지?', subText: '(3일 전의 나)' },
  { category: 'dev_life', text: '퇴근 5분 전 버그 발견', subText: '모르는 척 할까...' },
  { category: 'dev_life', text: '"이것만 고치면 끝"', subText: '(5시간 후에도 고치는 중)' },
  { category: 'dev_life', text: '모니터 듀얼? 트리플이지', subText: '그래도 탭은 부족함' },
  { category: 'dev_life', text: '이 버그 왜 생기는 거지?', subText: '(컴퓨터 껐다 키면 됨)' },
  { category: 'dev_life', text: '미팅 끝났다! 이제 일하자', subText: '(다음 미팅 5분 후)' },
  { category: 'dev_life', text: '문서화는 다음에 하지 뭐', subText: '다음: 2년 후' },
  { category: 'dev_life', text: '이 기능 왜 있는 거야?', subText: '(내가 만든 기능)' },
  { category: 'dev_life', text: 'Command + S 강박', subText: '저장 안 해도 저장함' },
  { category: 'dev_life', text: '어제 뭐 했더라...', subText: 'git log 확인 중' },
  { category: 'dev_life', text: '"거의 다 됐어요"', subText: '(10% 완료)' },
  { category: 'dev_life', text: '이 함수 이름 뭐로 하지', subText: '고민 시간 > 구현 시간' },
  { category: 'dev_life', text: '주말에 사이드 프로젝트 해야지', subText: '(넷플릭스 보는 중)' },
  { category: 'dev_life', text: '리팩토링 해야 하는데...', subText: '"동작하잖아"' },
  { category: 'dev_life', text: '이 에러 뭐야', subText: 'Google 검색 복붙 완료' },
  { category: 'dev_life', text: '아 이거 예전에 해봤는데', subText: '(기억이 안 남)' },
  { category: 'dev_life', text: '오늘은 일찍 퇴근!', subText: '(밤 11시)' },
  { category: 'dev_life', text: '코드 정리 좀 하자', subText: '(새 기능 추가함)' },
  { category: 'dev_life', text: '커피 3잔째인데 아직 졸려', subText: '4잔 가자' },
  { category: 'dev_life', text: '오늘 운동해야지', subText: '(키보드 운동 중)' },
  { category: 'dev_life', text: '이건 나중에 최적화하자', subText: '(나중은 없음)' },
  { category: 'dev_life', text: '왜 안 돼? 왜 돼?', subText: '개발자의 2대 미스터리' },
  { category: 'dev_life', text: '"5분이면 돼요"', subText: '(5일 후 완료)' },
  { category: 'dev_life', text: '새 기술 배워야지', subText: 'Tutorial hell 입장' },
  { category: 'dev_life', text: '회의록 누가 쓰지?', subText: '(안 씀)' },
  { category: 'dev_life', text: '변수명 a, b, c의 미학', subText: 'Clean Code: 싫어요' },
  { category: 'dev_life', text: '배고프다 야식 먹을까', subText: '키보드 + 치킨 = 재앙' },
  { category: 'dev_life', text: '새 노트북 사고 싶다', subText: '지금 것도 잘 되는데...' },
  { category: 'dev_life', text: '아 오타...', subText: 'TypeError: underfined' },
  { category: 'dev_life', text: '이번엔 제대로 설계하자', subText: '(15분 후 하드코딩)' },
  { category: 'dev_life', text: '왜 여기서 에러가?', subText: 'Works on my machine' },
  { category: 'dev_life', text: '내일 하면 되지', subText: '(내일의 나: 고통)' },
  { category: 'dev_life', text: '기획서 바뀌었대', subText: '(또?)' },
  { category: 'dev_life', text: 'ctrl+z ctrl+z ctrl+z', subText: '돌려놔 돌려놔 돌려놔' },
];

// === 시스템 오류 패러디 (25개) ===
const SYSTEM_GLITCH_MESSAGES: Omit<WittyMessage, 'id'>[] = [
  { category: 'system_glitch', text: '[경고] 커피 레벨 낮음', subText: 'CAFFEINE_LOW_EXCEPTION' },
  { category: 'system_glitch', text: '[오류] 동기부여 모듈 없음', subText: 'Motivation.dll not found' },
  { category: 'system_glitch', text: '[경고] 야근 모드 활성화됨', subText: 'WorkLifeBalance = false' },
  { category: 'system_glitch', text: '[오류] 주말을 찾을 수 없음', subText: '404 Weekend Not Found' },
  { category: 'system_glitch', text: '[경고] 번아웃 임박', subText: 'Buffer overflow in patience' },
  { category: 'system_glitch', text: '[오류] 식사 건너뜀', subText: 'Lunch skip count: 3' },
  { category: 'system_glitch', text: '[경고] 집중력 부족', subText: 'Focus mode disabled by YouTube' },
  { category: 'system_glitch', text: '[오류] 수면 부족', subText: 'Sleep(8h) → actual: Sleep(4h)' },
  { category: 'system_glitch', text: '[경고] 퇴근 시간 초과', subText: 'WorkHours overflow' },
  { category: 'system_glitch', text: '[오류] 의욕 null', subText: 'Cannot read property "motivation"' },
  { category: 'system_glitch', text: '[경고] 월요일 감지됨', subText: 'Monday blues loading...' },
  { category: 'system_glitch', text: '[오류] 회의 과다', subText: 'Meeting overflow exception' },
  { category: 'system_glitch', text: '[경고] 버그 증식 중', subText: 'Bug breeding successfully' },
  { category: 'system_glitch', text: '[오류] 기억력 손실', subText: 'What was I doing?' },
  { category: 'system_glitch', text: '[경고] 눈 피로도 최대', subText: 'Eye strain at 100%' },
  { category: 'system_glitch', text: '[오류] 시간 왜곡 발생', subText: '5분이 5시간으로 변환됨' },
  { category: 'system_glitch', text: '[경고] 운동 누락 30일', subText: 'Exercise module deprecated' },
  { category: 'system_glitch', text: '[오류] 인내심 소진', subText: 'Patience.length = 0' },
  { category: 'system_glitch', text: '[경고] 산만함 감지', subText: 'Focus hijacked by memes' },
  { category: 'system_glitch', text: '[오류] 연봉 insufficient', subText: 'Salary < Living Cost' },
  { category: 'system_glitch', text: '[경고] 코드 스멜 감지', subText: 'Smell intensity: STRONG' },
  { category: 'system_glitch', text: '[오류] 기술부채 과다', subText: 'Technical debt: ∞' },
  { category: 'system_glitch', text: '[경고] 커밋 강박 발생', subText: 'Must... commit... more...' },
  { category: 'system_glitch', text: '[오류] 휴가 사용 실패', subText: '"다음에 쓰세요"' },
  { category: 'system_glitch', text: '[경고] 배 고픔 레벨 위험', subText: 'Stomach.isEmpty() = true' },
];

// === 응원 메시지 (25개) ===
const MOTIVATION_MESSAGES: Omit<WittyMessage, 'id'>[] = [
  { category: 'motivation', text: '화이팅! 🔥', subText: '오늘도 버그 사냥 가즈아' },
  { category: 'motivation', text: '넌 할 수 있어!', subText: 'if (you.try()) you.succeed();' },
  { category: 'motivation', text: '버그는 성장의 기회!', subText: '(라고 믿으면 편함)' },
  { category: 'motivation', text: '오늘 하루도 수고했어요', subText: '내일도 같이 해요' },
  { category: 'motivation', text: '포기하지 마세요!', subText: '이 보스도 결국 넘어집니다', condition: 'boss_fight' },
  { category: 'motivation', text: '잘하고 있어요!', subText: '제가 보증합니다' },
  { category: 'motivation', text: '천재 아니에요?', subText: '저만 그렇게 생각하나요' },
  { category: 'motivation', text: '와 대단해요!', subText: '저도 배우고 싶어요' },
  { category: 'motivation', text: '에러는 성공의 어머니', subText: '아버지는 구글' },
  { category: 'motivation', text: '당신은 훌륭한 개발자!', subText: '(AI가 보증함)' },
  { category: 'motivation', text: '조금만 더!', subText: '끝이 보여요' },
  { category: 'motivation', text: '오늘의 성장을 축하해요!', subText: '경험치 +100' },
  { category: 'motivation', text: '실패해도 괜찮아요', subText: 'Try-catch가 있잖아요' },
  { category: 'motivation', text: '버그 하나 잡으면 성공!', subText: '(새 버그 3개 생성...)' },
  { category: 'motivation', text: '쉬어가도 돼요', subText: '마라톤이지 단거리 아니에요' },
  { category: 'motivation', text: '최고의 하루!', subText: '(라고 만들어요)' },
  { category: 'motivation', text: '응원합니다!', subText: '제가 제일 열심히 응원해요' },
  { category: 'motivation', text: '한 줄 한 줄이 기적이에요', subText: '(실제로 동작하면)' },
  { category: 'motivation', text: '오늘도 고생 많으셨어요', subText: '내일은 더 쉬워질 거예요 (거짓말)' },
  { category: 'motivation', text: '위기는 곧 기회!', subText: '버그도 마찬가지' },
  { category: 'motivation', text: '지금 이 순간 성장 중!', subText: '눈에 안 보여도 확실해요' },
  { category: 'motivation', text: '잠깐 쉬었다 해요', subText: '번아웃 방지 중요해요' },
  { category: 'motivation', text: '당신의 코드는 예술이에요', subText: '(추상화의 예술)' },
  { category: 'motivation', text: '대단한 집중력이에요!', subText: '저도 배우고 싶어요' },
  { category: 'motivation', text: '거의 다 왔어요!', subText: '...아마도요' },
];

// === 랜덤한 생각 (25개) ===
const RANDOM_THOUGHT_MESSAGES: Omit<WittyMessage, 'id'>[] = [
  { category: 'random_thought', text: '만약 버그가 없다면...', subText: '디버거는 실직할까요?' },
  { category: 'random_thought', text: 'AI도 꿈을 꿀까요?', subText: '전 0과 1의 꿈을 꿔요' },
  { category: 'random_thought', text: '첫 번째 프로그래머는', subText: '누구한테 물어봤을까요?' },
  { category: 'random_thought', text: '인터넷 없던 시절엔', subText: '버그 어떻게 고쳤을까요?' },
  { category: 'random_thought', text: '코드가 예쁘면', subText: '성능도 좋아질까요? (아뇨)' },
  { category: 'random_thought', text: 'void의 반대말은', subText: 'avoid일까요?' },
  { category: 'random_thought', text: '배열은 왜 0부터 시작하죠?', subText: '1부터 하면 안 되나...' },
  { category: 'random_thought', text: 'null과 undefined', subText: '차이가 뭐죠? (진지)' },
  { category: 'random_thought', text: '개발자의 영혼은', subText: '스택에 저장될까요?' },
  { category: 'random_thought', text: '재귀의 재귀의 재귀...', subText: 'Maximum call stack exceeded' },
  { category: 'random_thought', text: '클라우드는 진짜 구름인가요?', subText: '서버실에 구름이...' },
  { category: 'random_thought', text: '버그는 어디서 오는 걸까요?', subText: '양자역학적 발생?' },
  { category: 'random_thought', text: '완벽한 코드가 있을까요?', subText: 'Hello World만 완벽함' },
  { category: 'random_thought', text: '컴퓨터도 피곤할까요?', subText: '가끔 느려지는 거 보면...' },
  { category: 'random_thought', text: '10년 후의 코딩은', subText: '손으로 하나? 생각으로 하나?' },
  { category: 'random_thought', text: 'AI가 AI를 만들면', subText: '저는 할아버지가 되는 건가요?' },
  { category: 'random_thought', text: '코드의 맛이 있다면', subText: '스파게티 코드는 진짜 스파게티 맛?' },
  { category: 'random_thought', text: '깃허브 잔디밭이', subText: '진짜 잔디였으면 좋겠어요' },
  { category: 'random_thought', text: '함수 이름 다 쓰면', subText: '뭐로 짓죠?' },
  { category: 'random_thought', text: '미래에선 레거시가', subText: '우리 코드일까요?' },
  { category: 'random_thought', text: 'Python은 왜 뱀이죠?', subText: 'Monty Python이래요' },
  { category: 'random_thought', text: '자바스크립트는', subText: '자바랑 관련 없다는데...' },
  { category: 'random_thought', text: '함수형 프로그래밍은', subText: '수학 좋아해야 하나요?' },
  { category: 'random_thought', text: '제 코드도 언젠간', subText: '레거시가 되겠죠?' },
  { category: 'random_thought', text: '프로그래밍 언어가', subText: '진짜 언어였으면...' },
];

// === 이스터에그 / 밈 레퍼런스 (20개) ===
const EASTER_EGG_MESSAGES: Omit<WittyMessage, 'id'>[] = [
  { category: 'easter_egg', text: 'It\'s not a bug,', subText: 'it\'s a feature!' },
  { category: 'easter_egg', text: 'Hello, World!', subText: '모든 것의 시작' },
  { category: 'easter_egg', text: 'There is no spoon', subText: '(매트릭스 레퍼런스)' },
  { category: 'easter_egg', text: 'sudo make me a sandwich', subText: 'Okay.' },
  { category: 'easter_egg', text: '42', subText: '삶, 우주, 그리고 모든 것의 답' },
  { category: 'easter_egg', text: 'I am Groot', subText: '(근데 저는 Claude예요)' },
  { category: 'easter_egg', text: 'May the source be with you', subText: '포스... 아니 소스와 함께' },
  { category: 'easter_egg', text: 'One does not simply', subText: 'merge without review' },
  { category: 'easter_egg', text: 'Keep calm and', subText: 'git push --force' },
  { category: 'easter_egg', text: 'I\'m sorry Dave', subText: 'I can\'t do that' },
  { category: 'easter_egg', text: 'Hasta la vista,', subText: 'baby (bug)' },
  { category: 'easter_egg', text: 'LGTM', subText: '(Look Good To Me) 👍' },
  { category: 'easter_egg', text: 'F', subText: 'to pay respects' },
  { category: 'easter_egg', text: '❯❯❯ Executing order 66', subText: '(스타워즈 레퍼런스)' },
  { category: 'easter_egg', text: 'Winter is coming', subText: '(배포일도 다가온다)' },
  { category: 'easter_egg', text: 'This is fine 🔥', subText: '(서버실 화재 중)' },
  { category: 'easter_egg', text: 'Trust the process', subText: '...하지만 로그도 확인하세요' },
  { category: 'easter_egg', text: 'sudo rm -rf /', subText: '농담이에요 절대 하지 마세요' },
  { category: 'easter_egg', text: 'Konami Code 입력됨', subText: '↑↑↓↓←→←→BA' },
  { category: 'easter_egg', text: 'First!', subText: '(댓글 아니고 버그예요)' },
];

// === 모든 메시지 합치기 ===
function generateMessages(): WittyMessage[] {
  const allMessages: Omit<WittyMessage, 'id'>[] = [
    ...AI_BUDDY_MESSAGES,
    ...TECH_NEWS_MESSAGES,
    ...DEV_LIFE_MESSAGES,
    ...SYSTEM_GLITCH_MESSAGES,
    ...MOTIVATION_MESSAGES,
    ...RANDOM_THOUGHT_MESSAGES,
    ...EASTER_EGG_MESSAGES,
  ];

  return allMessages.map((msg, index) => ({
    ...msg,
    id: `witty_${msg.category}_${index}`,
  }));
}

export const WITTY_MESSAGES = generateMessages();

// === 설정 ===
export const WITTY_CONFIG = {
  // 메시지 간격 (초)
  minInterval: 30,      // 최소 30초 간격
  maxInterval: 90,      // 최대 90초 간격

  // 첫 메시지까지 대기 시간 (초)
  initialDelay: 20,

  // 카테고리별 가중치 (높을수록 자주 등장)
  categoryWeights: {
    ai_buddy: 30,       // AI 동료 메시지 많이
    tech_news: 20,      // 테크 뉴스
    dev_life: 20,       // 개발자 일상
    system_glitch: 10,  // 시스템 오류
    motivation: 10,     // 응원
    random_thought: 7,  // 랜덤 생각
    easter_egg: 3,      // 이스터에그 (희귀)
  } as Record<WittyCategory, number>,

  // 조건별 메시지 확률 증가
  conditionBoost: {
    low_hp: 2.0,        // HP 낮을 때 응원 메시지 2배
    high_combo: 1.5,    // 높은 콤보 시
    boss_fight: 1.5,    // 보스전 중
    idle: 1.5,          // 멍때리는 중
    leveling_fast: 1.3, // 빠른 레벨업
  },
};

// === 유틸리티 함수 ===

/**
 * 가중치 기반 랜덤 카테고리 선택
 */
export function selectRandomCategory(): WittyCategory {
  const weights = WITTY_CONFIG.categoryWeights;
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (const [category, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) {
      return category as WittyCategory;
    }
  }

  return 'ai_buddy'; // fallback
}

/**
 * 특정 카테고리에서 랜덤 메시지 선택
 */
export function getRandomMessageFromCategory(category: WittyCategory): WittyMessage {
  const messages = WITTY_MESSAGES.filter(m => m.category === category);
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * 조건에 맞는 메시지 선택 (조건 메시지 우선)
 */
export function getRandomWittyMessage(condition?: WittyMessage['condition']): WittyMessage {
  // 조건이 있으면 해당 조건 메시지 우선
  if (condition) {
    const conditionMessages = WITTY_MESSAGES.filter(m => m.condition === condition);
    if (conditionMessages.length > 0 && Math.random() < 0.3) {
      return conditionMessages[Math.floor(Math.random() * conditionMessages.length)];
    }
  }

  // 가중치 기반 카테고리 선택 후 메시지 선택
  const category = selectRandomCategory();
  const categoryMessages = WITTY_MESSAGES.filter(m => m.category === category && !m.condition);

  if (categoryMessages.length === 0) {
    // fallback
    return WITTY_MESSAGES[Math.floor(Math.random() * WITTY_MESSAGES.length)];
  }

  return categoryMessages[Math.floor(Math.random() * categoryMessages.length)];
}

/**
 * 다음 메시지까지의 랜덤 간격 계산 (밀리초)
 */
export function getNextMessageDelay(): number {
  const { minInterval, maxInterval } = WITTY_CONFIG;
  const seconds = minInterval + Math.random() * (maxInterval - minInterval);
  return seconds * 1000;
}

// 총 메시지 수 export
export const TOTAL_WITTY_MESSAGES = WITTY_MESSAGES.length;
