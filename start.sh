#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🎬 Starting ClipMaker..."

# ── Backend ───────────────────────────────────────────────────────────────────
cd "$ROOT/backend"

if [ ! -d ".venv" ]; then
  echo "→ Creating Python virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate

echo "→ Installing backend dependencies..."
pip install -q -r requirements.txt

# Copy .env if not present
if [ -f "$ROOT/.env" ]; then
  cp "$ROOT/.env" "$ROOT/backend/.env"
elif [ ! -f "$ROOT/backend/.env" ] && [ -f "$ROOT/.env.example" ]; then
  echo "⚠️  No .env found. Copy .env.example → .env and fill in your API keys."
fi

echo "→ Starting FastAPI backend on http://localhost:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# ── Frontend ──────────────────────────────────────────────────────────────────
cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
  echo "→ Installing frontend dependencies..."
  npm install
fi

echo "→ Starting Vite frontend on http://localhost:5173"
npm run dev &
FRONTEND_PID=$!

# ── Cleanup on exit ───────────────────────────────────────────────────────────
trap "echo ''; echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM

echo ""
echo "✅ ClipMaker running!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop."
wait
