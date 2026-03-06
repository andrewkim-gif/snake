#!/bin/bash
# ============================================================
# game.sh — Agent Survivor Server Management Script
# ============================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"
BIN_DIR="$SERVER_DIR/bin"
PID_FILE="$SERVER_DIR/.server.pid"

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
    echo -e "${YELLOW}Building server...${NC}"
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

# Start the server in the foreground
start_server() {
    build_server
    echo -e "${GREEN}Starting server...${NC}"
    cd "$SERVER_DIR"
    exec "$BIN_DIR/server"
}

# Start the server in the background
start_server_bg() {
    build_server
    echo -e "${GREEN}Starting server in background...${NC}"
    cd "$SERVER_DIR"
    "$BIN_DIR/server" &
    echo $! > "$PID_FILE"
    echo -e "${GREEN}Server started (PID: $(cat "$PID_FILE"))${NC}"
}

# Stop the background server
stop_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo -e "${YELLOW}Stopping server (PID: $PID)...${NC}"
            kill "$PID"
            rm -f "$PID_FILE"
            echo -e "${GREEN}Server stopped.${NC}"
        else
            echo -e "${YELLOW}Server process not running (stale PID file).${NC}"
            rm -f "$PID_FILE"
        fi
    else
        # Try to find and kill any running server process
        PIDS=$(pgrep -f "$BIN_DIR/server" 2>/dev/null || true)
        if [ -n "$PIDS" ]; then
            echo -e "${YELLOW}Stopping server processes: $PIDS${NC}"
            echo "$PIDS" | xargs kill 2>/dev/null || true
            echo -e "${GREEN}Server stopped.${NC}"
        else
            echo -e "${YELLOW}No server process found.${NC}"
        fi
    fi
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

# Print help
print_help() {
    print_header
    echo "Usage: ./game.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo -e "  ${GREEN}dev${NC}         Build and start server in background, then wait"
    echo -e "  ${GREEN}server${NC}      Build and start server in foreground"
    echo -e "  ${GREEN}build${NC}       Build all Go binaries (server, balance, loadtest)"
    echo -e "  ${GREEN}balance${NC}     Run balance simulation (pass -rounds=N -bots=N)"
    echo -e "  ${GREEN}loadtest${NC}    Run load test (pass -clients=N -duration=N -url=...)"
    echo -e "  ${GREEN}stop${NC}        Stop the running server process"
    echo -e "  ${GREEN}help${NC}        Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./game.sh dev                          # Start dev server"
    echo "  ./game.sh balance -rounds=20 -bots=50  # Run 20 rounds with 50 bots"
    echo "  ./game.sh loadtest -clients=200         # Load test with 200 clients"
    echo "  ./game.sh stop                          # Stop running server"
}

# Main command dispatch
case "${1:-help}" in
    dev)
        print_header
        start_server_bg
        echo ""
        echo -e "${CYAN}Server running. Press Ctrl+C to stop.${NC}"
        echo ""
        # Wait and forward interrupt to stop
        trap 'stop_server; exit 0' INT TERM
        wait $(cat "$PID_FILE") 2>/dev/null || true
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
    stop)
        print_header
        stop_server
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
