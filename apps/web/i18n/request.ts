import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export const SUPPORTED_LOCALES = ['en', 'ko'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'ko';

function detectLocaleFromAcceptLanguage(acceptLang: string): SupportedLocale {
  // 2언어만이므로 간단한 includes 검사
  if (acceptLang.includes('ko')) return 'ko';
  if (acceptLang.includes('en')) return 'en';
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  // Priority 1: cookie에 저장된 사용자 선택
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value;

  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as SupportedLocale)) {
    return {
      locale: cookieLocale,
      messages: (await import(`../messages/${cookieLocale}.json`)).default,
    };
  }

  // Priority 2: Accept-Language 헤더에서 감지
  const headerStore = await headers();
  const acceptLang = headerStore.get('accept-language') ?? '';
  const locale = detectLocaleFromAcceptLanguage(acceptLang);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
