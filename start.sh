#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS=()

cleanup() {
    trap - INT TERM EXIT

    if [ "${#PIDS[@]}" -gt 0 ]; then
        echo
        echo "Stopping MediKiosk services..."
        kill "${PIDS[@]}" 2>/dev/null || true
        wait "${PIDS[@]}" 2>/dev/null || true
    fi
}

fail() {
    echo "Error: $*" >&2
    exit 1
}

trap cleanup INT TERM EXIT

command -v npm >/dev/null 2>&1 || fail "npm is required but was not found."

if [ -x "$ROOT_DIR/ML/.venv/bin/python" ]; then
    PYTHON="$ROOT_DIR/ML/.venv/bin/python"
elif [ -x "$ROOT_DIR/ML/venv/bin/python" ]; then
    PYTHON="$ROOT_DIR/ML/venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON="$(command -v python3)"
else
    fail "Python 3 is required but was not found."
fi

[ -d "$ROOT_DIR/Frontend/node_modules" ] || \
    fail "Frontend dependencies are missing. Run: cd Frontend && npm install"
[ -d "$ROOT_DIR/backend/node_modules" ] || \
    fail "Backend dependencies are missing. Run: cd backend && npm install"
if "$PYTHON" -c "import uvicorn" >/dev/null 2>&1; then
    ML_RUNNER=("$PYTHON" -m uvicorn)
elif command -v uvicorn >/dev/null 2>&1; then
    ML_RUNNER=("$(command -v uvicorn)")
else
    fail "ML dependencies are missing. Run: $PYTHON -m pip install -r ML/requirements.txt"
fi

echo "Starting MediKiosk..."
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:5001"
echo "  ML API:   http://localhost:8000/docs"
echo "Press Ctrl+C to stop all services."
echo

(
    cd "$ROOT_DIR/Frontend" || exit 1
    exec npm run dev -- --host 0.0.0.0
) &
PIDS+=("$!")

(
    cd "$ROOT_DIR/backend" || exit 1
    exec npm run dev
) &
PIDS+=("$!")

(
    cd "$ROOT_DIR/ML" || exit 1
    exec "${ML_RUNNER[@]}" main:app --host 0.0.0.0 --port 8000 --reload
) &
PIDS+=("$!")

while true; do
    for pid in "${PIDS[@]}"; do
        if ! kill -0 "$pid" 2>/dev/null; then
            wait "$pid"
            status=$?
            echo "A service stopped (exit code $status). Shutting down the others." >&2
            exit "$status"
        fi
    done
    sleep 1
done
