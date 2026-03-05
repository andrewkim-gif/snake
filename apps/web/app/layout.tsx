import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crosnake - Multiplayer Snake Game',
  description: 'Minecraft 스타일 멀티플레이어 스네이크 게임',
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
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
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
        }}
      >
        {children}
      </body>
    </html>
  );
}
