#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting AI Stock Assistant..."

# Start backend in background
echo "Starting backend on port 5000..."
cd "$SCRIPT_DIR/backend" && npm run dev &
BACKEND_PID=$!

# Start frontend in background
echo "Starting frontend on port 3000..."
cd "$SCRIPT_DIR/frontend" && npm start &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "Services running:"
echo "  Backend:  http://localhost:5000"
echo "  Frontend: http://localhost:3000"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop all services"

# Handle shutdown
cleanup() {
  echo ""
  echo "Stopping services..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  echo "Done."
  exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for both processes
wait
