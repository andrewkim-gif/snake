/**
 * Minecraft R3F — Production Static Server
 *
 * Next.js 빌드 결과물을 서빙하는 간단한 Express 서버.
 * 개발 시에는 `cd ../client && npm run dev` 사용을 권장합니다.
 *
 * 프로덕션 배포:
 *   1. cd ../client && npm run build
 *   2. cd ../server && npm start
 */

const express = require('express')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3001

// Next.js 빌드 결과 (.next/standalone 또는 out/) 서빙
const clientBuildDir = path.join(__dirname, '..', 'client', 'out')

app.use(express.static(clientBuildDir))

// SPA 폴백
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildDir, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`[MC Server] Minecraft R3F server running at http://localhost:${PORT}`)
})
