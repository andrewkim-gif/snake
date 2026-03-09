import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Minecraft R3F Edition',
  description: 'Minecraft-style voxel world built with React Three Fiber',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 0, overflow: 'hidden', background: '#000' }}>
        {children}
      </body>
    </html>
  )
}
