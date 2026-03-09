#!/bin/bash
# Minecraft R3F — 개발 서버 실행 스크립트

set -e

cd "$(dirname "$0")/client"

# node_modules 없으면 설치
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

echo "🎮 Starting Minecraft R3F Edition..."
echo "   → http://localhost:3000"
npm run dev
