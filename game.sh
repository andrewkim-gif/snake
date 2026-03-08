#!/bin/bash
# ============================================================
# game.sh — Agent Survivor Server Management Script
# Runs Go server (port 9000) + Next.js client (port 9001)
# ============================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"
WEB_DIR="$PROJECT_ROOT/apps/web"
BIN_DIR="$SERVER_DIR/bin"
GO_PID_FILE="$SERVER_DIR/.server.pid"
WEB_PID_FILE="$PROJECT_ROOT/.web.pid"

GO_PORT=9000
WEB_PORT=9001

# Load .env if present (DATABASE_URL, SUPABASE_*, etc.)
# Uses grep+export to avoid shell interpretation of special chars
if [ -f "$PROJECT_ROOT/.env" ]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and blank lines
        [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
        # Strip surrounding quotes if present
        key="${line%%=*}"
        val="${line#*=}"
        val="${val%\'}" ; val="${val#\'}"
        val="${val%\"}" ; val="${val#\"}"
        export "$key=$val"
    done < "$PROJECT_ROOT/.env"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${CYAN}=== Agent Survivor ===${NC}"
    echo ""
}

ensure_bin_dir() {
    mkdir -p "$BIN_DIR"
}

# Build the Go server binary
build_server() {
    echo -e "${YELLOW}Building Go server...${NC}"
    cd "$SERVER_DIR"
    ensure_bin_dir
    go build -o "$BIN_DIR/server" ./cmd/server
    echo -e "${GREEN}Server binary built: $BIN_DIR/server${NC}"
}

# Build the balance simulation binary
build_balance() {
    echo -e "${YELLOW}Building balance tool...${NC}"
    cd "$SERVER_DIR"
    ensure_bin_dir
    go build -o "$BIN_DIR/balance" ./cmd/balance
    echo -e "${GREEN}Balance binary built: $BIN_DIR/balance${NC}"
}

# Build the load test binary
build_loadtest() {
    echo -e "${YELLOW}Building loadtest tool...${NC}"
    cd "$SERVER_DIR"
    ensure_bin_dir
    go build -o "$BIN_DIR/loadtest" ./cmd/loadtest
    echo -e "${GREEN}Loadtest binary built: $BIN_DIR/loadtest${NC}"
}

# Start the Go server in the foreground
start_server() {
    build_server
    echo -e "${GREEN}Starting Go server on port $GO_PORT...${NC}"
    cd "$SERVER_DIR"
    PORT=$GO_PORT exec "$BIN_DIR/server"
}

# Start the Go server in the background
start_server_bg() {
    build_server
    echo -e "${GREEN}Starting Go server on port $GO_PORT (background)...${NC}"
    cd "$SERVER_DIR"
    PORT=$GO_PORT "$BIN_DIR/server" &
    echo $! > "$GO_PID_FILE"
    echo -e "${GREEN}Go server started (PID: $(cat "$GO_PID_FILE"), port: $GO_PORT)${NC}"
}

# Start the Next.js dev server in the background
start_web_bg() {
    echo -e "${GREEN}Starting Next.js dev server on port $WEB_PORT (background)...${NC}"
    cd "$WEB_DIR"
    NEXT_PUBLIC_SERVER_URL="http://localhost:$GO_PORT" npx next dev -p $WEB_PORT &
    echo $! > "$WEB_PID_FILE"
    echo -e "${GREEN}Next.js dev server started (PID: $(cat "$WEB_PID_FILE"), port: $WEB_PORT)${NC}"
}

# Stop the Go server
stop_server() {
    # PID 파일로 메인 프로세스 정리
    if [ -f "$GO_PID_FILE" ]; then
        PID=$(cat "$GO_PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo -e "${YELLOW}Stopping Go server (PID: $PID)...${NC}"
            kill "$PID" 2>/dev/null || true
        fi
        rm -f "$GO_PID_FILE"
    fi
    # 항상 모든 잔존 프로세스를 정리 (좀비 방지)
    PIDS=$(pgrep -f "$BIN_DIR/server" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        COUNT=$(echo "$PIDS" | wc -l | tr -d ' ')
        echo -e "${YELLOW}Cleaning $COUNT Go server process(es)...${NC}"
        echo "$PIDS" | xargs kill 2>/dev/null || true
        sleep 0.3
        # SIGKILL로 남은 좀비 강제 종료
        PIDS=$(pgrep -f "$BIN_DIR/server" 2>/dev/null || true)
        if [ -n "$PIDS" ]; then
            echo "$PIDS" | xargs kill -9 2>/dev/null || true
        fi
    fi
    echo -e "${GREEN}Go server stopped.${NC}"
}

# Stop the Next.js dev server
stop_web() {
    if [ -f "$WEB_PID_FILE" ]; then
        PID=$(cat "$WEB_PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo -e "${YELLOW}Stopping Next.js dev server (PID: $PID)...${NC}"
            kill "$PID"
            # Also kill child processes (next dev spawns children)
            pkill -P "$PID" 2>/dev/null || true
            rm -f "$WEB_PID_FILE"
            echo -e "${GREEN}Next.js dev server stopped.${NC}"
        else
            echo -e "${YELLOW}Next.js dev server not running (stale PID file).${NC}"
            rm -f "$WEB_PID_FILE"
        fi
    else
        PIDS=$(pgrep -f "next dev.*$WEB_PORT" 2>/dev/null || true)
        if [ -n "$PIDS" ]; then
            echo -e "${YELLOW}Stopping Next.js processes: $PIDS${NC}"
            echo "$PIDS" | xargs kill 2>/dev/null || true
            echo -e "${GREEN}Next.js dev server stopped.${NC}"
        else
            echo -e "${YELLOW}No Next.js dev server process found.${NC}"
        fi
    fi
}

# Stop all services
stop_all() {
    stop_server
    stop_web
}

# Run balance simulation
run_balance() {
    build_balance
    echo -e "${GREEN}Running balance simulation...${NC}"
    echo ""
    "$BIN_DIR/balance" "$@"
}

# Run load test
run_loadtest() {
    build_loadtest
    echo -e "${GREEN}Running load test...${NC}"
    echo ""
    "$BIN_DIR/loadtest" "$@"
}

# Run AI agent simulation
run_sim() {
    local SIM_DIR="$PROJECT_ROOT/aww-agent-skill"
    echo -e "${GREEN}Running AI agent simulation...${NC}"
    echo ""
    cd "$SIM_DIR"
    npx tsx src/sim/run.ts "$@"
}

# Print help
print_help() {
    print_header
    echo "Usage: ./game.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo -e "  ${GREEN}dev${NC}         Start Go server (port $GO_PORT) + Next.js (port $WEB_PORT)"
    echo -e "  ${GREEN}server${NC}      Start Go server only in foreground (port $GO_PORT)"
    echo -e "  ${GREEN}build${NC}       Build all Go binaries (server, balance, loadtest)"
    echo -e "  ${GREEN}balance${NC}     Run balance simulation (pass -rounds=N -bots=N)"
    echo -e "  ${GREEN}loadtest${NC}    Run load test (pass -clients=N -duration=N -url=...)"
    echo -e "  ${GREEN}sim${NC}         Run AI agent simulation (pass --config <file> or --agents N)"
    echo -e "  ${GREEN}stop${NC}        Stop all running processes"
    echo -e "  ${GREEN}help${NC}        Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./game.sh dev                          # Start both servers"
    echo "  ./game.sh balance -rounds=20 -bots=50  # Run 20 rounds with 50 bots"
    echo "  ./game.sh loadtest -clients=200         # Load test with 200 clients"
    echo "  ./game.sh sim --config sim-configs/cold-war.json  # Run cold war simulation"
    echo "  ./game.sh sim --agents 5 --duration 60  # Quick sim with 5 agents"
    echo "  ./game.sh stop                          # Stop all processes"
}

# Main command dispatch
case "${1:-dev}" in
    dev)
        print_header
        # Stop any existing processes first
        stop_all 2>/dev/null || true
        echo ""
        start_server_bg
        start_web_bg
        echo ""
        echo -e "${CYAN}Go server:  http://localhost:$GO_PORT${NC}"
        echo -e "${CYAN}Game client: http://localhost:$WEB_PORT${NC}"
        echo -e "${CYAN}Press Ctrl+C to stop all.${NC}"
        echo ""
        # Wait and forward interrupt to stop all
        trap 'echo ""; stop_all; exit 0' INT TERM
        # Wait for either process to exit
        wait $(cat "$GO_PID_FILE") $(cat "$WEB_PID_FILE") 2>/dev/null || true
        ;;
    server)
        print_header
        start_server
        ;;
    build)
        print_header
        build_server
        build_balance
        build_loadtest
        echo ""
        echo -e "${GREEN}All binaries built successfully.${NC}"
        ;;
    balance)
        print_header
        shift
        run_balance "$@"
        ;;
    loadtest)
        print_header
        shift
        run_loadtest "$@"
        ;;
    sim)
        print_header
        shift
        run_sim "$@"
        ;;
    stop)
        print_header
        stop_all
        ;;
    help|--help|-h)
        print_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        print_help
        exit 1
        ;;
esac
