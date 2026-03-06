import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Agent Survivor - Multiplayer Survival Roguelike',
  description: 'Minecraft style multiplayer auto-battler survival roguelike game with AI agents. Build, survive, and dominate the arena!',
  applicationName: 'Agent Survivor',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Agent Survivor',
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
  themeColor: '#87CEEB',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Inter:wght@400;500;600;700;800;900&family=Patrick+Hand&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#87CEEB',
          color: '#FFFFFF',
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale' as never,
          overscrollBehavior: 'none', // 모바일: 풀-투-리프레시 방지
        }}
      >
        {children}
      </body>
    </html>
  );
}
