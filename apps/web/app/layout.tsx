import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { SocketProvider } from '@/providers/SocketProvider';
import { I18nClientWrapper } from '@/providers/I18nClientWrapper';
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from '@/i18n/request';

import enMessages from '@/messages/en.json';
import koMessages from '@/messages/ko.json';

const allMessages: Record<string, Record<string, unknown>> = {
  en: enMessages as unknown as Record<string, unknown>,
  ko: koMessages as unknown as Record<string, unknown>,
};

export const metadata: Metadata = {
  title: 'AI World War - Multiplayer Survival Roguelike',
  description: 'Multiplayer auto-battler survival roguelike with AI agents. Build, survive, and dominate the arena!',
  applicationName: 'AI World War',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AI World War',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#09090B',
};

async function getInitialLocale(): Promise<SupportedLocale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value;
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as SupportedLocale)) {
    return cookieLocale as SupportedLocale;
  }
  const headerStore = await headers();
  const acceptLang = headerStore.get('accept-language') ?? '';
  if (acceptLang.includes('ko')) return 'ko';
  if (acceptLang.includes('en')) return 'en';
  return DEFAULT_LOCALE;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialLocale = await getInitialLocale();

  return (
    <html lang={initialLocale} suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link
          href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css"
          rel="stylesheet"
        />
      </head>
      <body
        suppressHydrationWarning
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#09090B',
          color: '#ECECEF',
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale' as never,
          overscrollBehavior: 'none',
        }}
      >
        <I18nClientWrapper
          initialLocale={initialLocale}
          allMessages={allMessages}
        >
          <SocketProvider>
            {children}
          </SocketProvider>
        </I18nClientWrapper>
      </body>
    </html>
  );
}
