/**
 * i18n.ts - 다국어 스텁
 * app_ingame/i18n를 참조하는 코드를 위한 최소 구현
 * 한국어 기본값 반환
 */

export type Language = 'ko' | 'en' | 'es' | 'ja' | 'zh';

/** 번역 키 (기본 한국어) */
const defaultTranslations: Record<string, any> = {
  common: {
    ok: '확인',
    cancel: '취소',
    close: '닫기',
    back: '뒤로',
    next: '다음',
    start: '시작',
    retry: '재시도',
    loading: '로딩 중...',
  },
  game: {
    score: '점수',
    level: '레벨',
    hp: 'HP',
    kills: '킬',
    combo: '콤보',
    wave: '웨이브',
    boss: '보스',
    gameover: '게임 오버',
    victory: '승리',
    pause: '일시정지',
  },
  characters: {},
  enemies: {},
  weapons: {},
  skills: {},
};

/** useLanguage 훅 - 한국어 기본값 반환 */
export function useLanguage() {
  return {
    language: 'ko' as Language,
    setLanguage: (_lang: Language) => {},
    t: defaultTranslations,
  };
}

export const LANGUAGES: Language[] = ['ko', 'en', 'es', 'ja', 'zh'];
