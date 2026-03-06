import type { Metadata, Viewport } from 'next';

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
  themeColor: '#111111',
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
          href="https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Inter:wght@400;500;600;700;800;900&family=Press+Start+2P&family=Rajdhani:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#111111',
          color: '#E8E0D4',
          fontFamily: '"Rajdhani", -apple-system, BlinkMacSystemFont, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale' as never,
          overscrollBehavior: 'none',
        }}
      >
        {children}
      </body>
    </html>
  );
}
