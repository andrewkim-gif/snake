'use client';

/**
 * I18nClientWrapper — Client-side Locale Context
 *
 * 핵심: router.refresh() 없이 언어 전환 → WebSocket 안전
 *
 * - layout.tsx에서 모든 로케일 메시지를 사전 로드
 * - locale state 변경만으로 NextIntlClientProvider messages 교체
 * - cookie 설정은 다음 서버 렌더 시 초기값으로 사용
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import type { SupportedLocale } from '@/i18n/request';

interface LocaleContextValue {
  locale: SupportedLocale;
  setLocale: (l: SupportedLocale) => void;
}

const LocaleContext = createContext<LocaleContextValue>(null!);

interface I18nClientWrapperProps {
  initialLocale: string;
  allMessages: Record<string, Record<string, unknown>>;
  children: React.ReactNode;
}

export function I18nClientWrapper({
  initialLocale,
  allMessages,
  children,
}: I18nClientWrapperProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(
    initialLocale as SupportedLocale,
  );

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    document.cookie = `locale=${newLocale};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = newLocale;
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider
        locale={locale}
        messages={allMessages[locale] as Record<string, unknown>}
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within <I18nClientWrapper>');
  return ctx;
}
