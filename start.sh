#!/usr/bin/env bash
set -euo pipefail

# Per-command timing helper
time_cmd() {
  /usr/bin/time -p "$@"
}

# Change to project directory
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

PORT="${PORT:-3000}"
export PORT

echo "=== STONE THROWING 3D – VFX 2.0 Startup ==="
echo "Project: $PROJECT_DIR"
echo "Port: $PORT"

# Write deployment-output.json to OPENCODE_WEB_DIR
DEPLOYMENT_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
time_cmd mkdir -p "$DEPLOYMENT_DIR"
time_cmd printf '%s' "{\"project\":\"$PROJECT_DIR\",\"directory\":\"$PROJECT_DIR/dist\"}" > "$DEPLOYMENT_DIR/deployment-output.json"
echo "Deployment output written to $DEPLOYMENT_DIR/deployment-output.json"

# Verify dist/index.html exists
if [[ ! -f "dist/index.html" ]]; then
  echo "ERROR: dist/index.html not found" >&2
  exit 1
fi

# Serve static files from dist/ in the foreground
echo "Serving static files from dist/ on port $PORT..."
time_cmd python3 -m http.server "$PORT" --directory dist --bind 0.0.0.0