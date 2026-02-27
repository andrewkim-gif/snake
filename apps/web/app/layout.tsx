import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Snake Arena - Multiplayer Snake Game',
  description: 'snake.io 스타일 실시간 멀티플레이어 스네이크 게임',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#0F1923',
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
