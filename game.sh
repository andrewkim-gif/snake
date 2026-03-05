#!/bin/bash
# Agent Survivor — Go 서버 + Next.js 프론트엔드 동시 실행
# Usage: ./game.sh [start|stop|restart|build|logs]

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

WEB_PORT=9002
SERVER_PORT=9001

# ─── Go 설치 확인 ───
check_go() {
  if ! command -v go &>/dev/null; then
    echo -e "${RED}Go is not installed.${NC}"
    echo "Install Go 1.24+: https://go.dev/dl/"
    echo "  macOS: brew install go"
    exit 1
  fi
  GO_VERSION=$(go version | grep -oE 'go[0-9]+\.[0-9]+' | head -1)
  echo -e "${GREEN}✓ ${GO_VERSION}${NC}"
}

# ─── Node 설치 확인 + 의존성 설치 ───
check_node() {
  if ! command -v node &>/dev/null; then
    echo -e "${RED}Node.js is not installed.${NC}"
    echo "Install Node 20+: https://nodejs.org/"
    exit 1
  fi
  NODE_VERSION=$(node -v)
  echo -e "${GREEN}✓ Node ${NODE_VERSION}${NC}"

  # 루트 node_modules 없으면 npm install
  if [ ! -d "$ROOT/node_modules" ]; then
    echo -e "${YELLOW}Installing npm dependencies...${NC}"
    npm install
  fi
}

# ─── Go 서버 빌드 ───
build_server() {
  echo -e "${CYAN}Building Go server...${NC}"
  cd "$ROOT/server"
  go build -o "$ROOT/server/agent-survivor" ./cmd/server/
  if [ $? -ne 0 ]; then
    echo -e "${RED}Go build failed!${NC}"
    exit 1
  fi
  # 데이터 디렉토리 생성
  mkdir -p "$ROOT/server/data/meta"
  mkdir -p "$ROOT/server/data/training"
  echo -e "${GREEN}✓ Build successful${NC}"
  cd "$ROOT"
}

stop_all() {
  echo -e "${YELLOW}Stopping Agent Survivor...${NC}"
  # PID 파일로 정확한 프로세스 종료
  if [ -f /tmp/agent-survivor-server.pid ]; then
    kill $(cat /tmp/agent-survivor-server.pid) 2>/dev/null
    rm -f /tmp/agent-survivor-server.pid
  fi
  if [ -f /tmp/agent-survivor-web.pid ]; then
    kill $(cat /tmp/agent-survivor-web.pid) 2>/dev/null
    rm -f /tmp/agent-survivor-web.pid
  fi
  # 포트 기반 fallback
  lsof -ti:$WEB_PORT 2>/dev/null | xargs kill -9 2>/dev/null
  lsof -ti:$SERVER_PORT 2>/dev/null | xargs kill -9 2>/dev/null
  sleep 0.5
  echo -e "${GREEN}Stopped.${NC}"
}

start_all() {
  # 포트 충돌 방지
  if lsof -ti:$WEB_PORT >/dev/null 2>&1 || lsof -ti:$SERVER_PORT >/dev/null 2>&1; then
    echo -e "${YELLOW}Existing processes found, stopping first...${NC}"
    stop_all
  fi

  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  🎮 Agent Survivor v10${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  # 환경 확인
  check_go
  check_node

  # Go 서버 빌드
  build_server

  # Go 서버 시작
  echo -e "${CYAN}Starting Go server on :$SERVER_PORT...${NC}"
  PORT=$SERVER_PORT \
  CORS_ORIGIN="http://localhost:$WEB_PORT" \
  "$ROOT/server/agent-survivor" > /tmp/agent-survivor-server.log 2>&1 &
  SERVER_PID=$!
  echo $SERVER_PID > /tmp/agent-survivor-server.pid

  # 서버 health check 대기
  for i in {1..20}; do
    if curl -s http://localhost:$SERVER_PORT/health >/dev/null 2>&1; then
      echo -e "${GREEN}✓ Go server ready${NC}"
      break
    fi
    sleep 0.5
  done

  if ! curl -s http://localhost:$SERVER_PORT/health >/dev/null 2>&1; then
    echo -e "${RED}Server failed to start!${NC}"
    echo "  tail -f /tmp/agent-survivor-server.log"
    kill $SERVER_PID 2>/dev/null
    exit 1
  fi

  # Next.js dev 서버 시작
  echo -e "${CYAN}Starting Next.js on :$WEB_PORT...${NC}"
  cd "$ROOT/apps/web"
  NEXT_PUBLIC_SERVER_URL="http://localhost:$SERVER_PORT" \
  npx next dev --port $WEB_PORT -H 0.0.0.0 > /tmp/agent-survivor-web.log 2>&1 &
  WEB_PID=$!
  echo $WEB_PID > /tmp/agent-survivor-web.pid
  cd "$ROOT"

  # Next.js 준비 대기
  for i in {1..30}; do
    if curl -s http://localhost:$WEB_PORT >/dev/null 2>&1; then
      echo -e "${GREEN}✓ Next.js ready${NC}"
      break
    fi
    sleep 1
  done

  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  Game:    http://localhost:$WEB_PORT${NC}"
  echo -e "${GREEN}  Server:  http://localhost:$SERVER_PORT${NC}"
  echo -e "${GREEN}  Health:  http://localhost:$SERVER_PORT/health${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "${YELLOW}Logs:${NC}"
  echo "  Server: tail -f /tmp/agent-survivor-server.log"
  echo "  Web:    tail -f /tmp/agent-survivor-web.log"
  echo ""
  echo -e "${YELLOW}Press Ctrl+C to stop${NC}"

  # Ctrl+C 핸들링
  trap 'echo ""; stop_all; exit 0' INT TERM

  # 두 프로세스 모두 대기
  wait $SERVER_PID $WEB_PID 2>/dev/null
}

show_logs() {
  echo -e "${CYAN}Server log:${NC}"
  tail -20 /tmp/agent-survivor-server.log 2>/dev/null || echo "(no log)"
  echo ""
  echo -e "${CYAN}Web log:${NC}"
  tail -20 /tmp/agent-survivor-web.log 2>/dev/null || echo "(no log)"
}

case "${1:-start}" in
  start)   start_all ;;
  stop)    stop_all ;;
  restart) stop_all; sleep 1; start_all ;;
  build)   check_go; build_server ;;
  logs)    show_logs ;;
  *)
    echo "Usage: ./game.sh [start|stop|restart|build|logs]"
    exit 1
    ;;
esac
