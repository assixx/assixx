#!/bin/bash
# =============================================================================
# free-port.sh - Frees a port before starting development server
#
# Usage: ./scripts/free-port.sh [PORT]
# Default: PORT=3002 (NestJS local dev)
#
# Why this exists:
# - When dev server crashes or terminal closes, the port may remain occupied
# - This script ensures clean start by killing any zombie processes
# - Called automatically by `pnpm run dev` via predev hook
# =============================================================================

PORT=${1:-3002}
SCRIPT_NAME=$(basename "$0")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[$SCRIPT_NAME]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[$SCRIPT_NAME]${NC} $1"
}

log_error() {
    echo -e "${RED}[$SCRIPT_NAME]${NC} $1"
}

# Check if port is in use
check_port() {
    lsof -i :"$PORT" -t 2>/dev/null
}

# Kill process on port
kill_port() {
    local pids
    pids=$(check_port)

    if [ -z "$pids" ]; then
        log_info "Port $PORT is free. Ready to start."
        return 0
    fi

    log_warn "Port $PORT is in use by PID(s): $pids"

    # Get process info for logging
    for pid in $pids; do
        local proc_info
        proc_info=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
        log_warn "  - PID $pid: $proc_info"
    done

    # Kill processes
    log_info "Killing process(es) on port $PORT..."

    # First try graceful SIGTERM
    for pid in $pids; do
        kill "$pid" 2>/dev/null
    done

    # Wait briefly for graceful shutdown
    sleep 1

    # Check if still running, force kill if needed
    pids=$(check_port)
    if [ -n "$pids" ]; then
        log_warn "Process still running. Force killing..."
        for pid in $pids; do
            kill -9 "$pid" 2>/dev/null
        done
        sleep 0.5
    fi

    # Verify port is free
    if [ -z "$(check_port)" ]; then
        log_info "Port $PORT is now free."
        return 0
    else
        log_error "Failed to free port $PORT!"
        return 1
    fi
}

# Main
kill_port
exit $?
