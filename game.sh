#!/bin/bash
# Snake Arena — 서버 + 프론트엔드 동시 실행
# Usage: ./game.sh [start|stop|restart]

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

stop_all() {
  echo -e "${YELLOW}Stopping Snake Arena...${NC}"
  lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null
  lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null
  sleep 0.5
  echo -e "${GREEN}Stopped.${NC}"
}

start_all() {
  # 포트 충돌 방지
  if lsof -ti:3000 >/dev/null 2>&1 || lsof -ti:3001 >/dev/null 2>&1; then
    echo -e "${YELLOW}Existing processes found, stopping first...${NC}"
    stop_all
  fi

  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  🐍 Snake Arena${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  # 서버 시작 (백그라운드)
  echo -e "${GREEN}Starting server on :3001...${NC}"
  npx tsx watch apps/server/src/index.ts > /tmp/snake-server.log 2>&1 &
  SERVER_PID=$!

  # 서버 준비 대기
  for i in {1..10}; do
    if curl -s http://localhost:3001/health >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done

  # 프론트엔드 시작 (백그라운드)
  echo -e "${GREEN}Starting web on :3000...${NC}"
  cd apps/web && npx next dev --port 3000 -H 0.0.0.0 > /tmp/snake-web.log 2>&1 &
  cd "$ROOT"
  WEB_PID=$!

  echo ""
  echo -e "${GREEN}Server:${NC}  http://localhost:3001  (PID: $SERVER_PID)"
  echo -e "${GREEN}Web:${NC}     http://localhost:3000  (PID: $WEB_PID)"
  echo -e "${GREEN}Health:${NC}  http://localhost:3001/health"
  echo ""
  echo -e "${YELLOW}Logs:${NC}"
  echo "  Server: tail -f /tmp/snake-server.log"
  echo "  Web:    tail -f /tmp/snake-web.log"
  echo ""
  echo -e "${YELLOW}Press Ctrl+C to stop both${NC}"

  # Ctrl+C 핸들링
  trap 'echo ""; stop_all; exit 0' INT TERM

  # 두 프로세스 모두 대기
  wait $SERVER_PID $WEB_PID 2>/dev/null
}

case "${1:-start}" in
  start)   start_all ;;
  stop)    stop_all ;;
  restart) stop_all; start_all ;;
  *)
    echo "Usage: ./game.sh [start|stop|restart]"
    exit 1
    ;;
esac
