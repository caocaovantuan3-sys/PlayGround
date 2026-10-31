#!/usr/bin/env bash
set -euo pipefail

# Per-command timing helper (only for external commands)
time_cmd() {
  /usr/bin/time -p "$@"
}

# Validate required environment variables
CAPTURE_URL="${CAPTURE_URL:?CAPTURE_URL environment variable is required}"
CAPTURE_DIR="${CAPTURE_DIR:?CAPTURE_DIR environment variable is required}"

echo "=== Capture starting ==="
echo "URL: $CAPTURE_URL"
echo "Output dir: $CAPTURE_DIR"

# Ensure output directory exists (outside source tree)
time_cmd mkdir -p "$CAPTURE_DIR"

# Chromium binary selection (command -v is a shell builtin, don't wrap with time_cmd)
CHROMIUM_BIN=""
for cand in chromium chromium-browser google-chrome google-chrome-stable; do
  if command -v "$cand" >/dev/null 2>&1; then
    CHROMIUM_BIN="$(command -v "$cand")"
    break
  fi
done

if [[ -z "$CHROMIUM_BIN" ]]; then
  echo "ERROR: No chromium browser found" >&2
  exit 1
fi

echo "Using browser: $CHROMIUM_BIN"

# Temporary profile directory (outside source)
PROFILE_DIR="$(time_cmd mktemp -d)"
trap 'time_cmd rm -rf "$PROFILE_DIR"' EXIT

# Common chromium flags for headless capture
CHROMIUM_FLAGS=(
  --headless=new
  --disable-gpu
  --no-sandbox
  --disable-dev-shm-usage
  --disable-software-rasterizer
  --disable-background-timer-throttling
  --disable-backgrounding-occluded-windows
  --disable-renderer-backgrounding
  --disable-features=TranslateUI
  --disable-ipc-flooding-protection
  --user-data-dir="$PROFILE_DIR"
  --run-all-compositor-stages-before-draw
  --virtual-time-budget=15000
)

DESKTOP_OUT="$CAPTURE_DIR/final-desktop.png"
MOBILE_OUT="$CAPTURE_DIR/final-mobile.png"

capture_view() {
  local name="$1"
  local width="$2"
  local height="$3"
  local output="$4"

  echo "Capturing $name view (${width}x${height})..."

  local tmp_profile
  tmp_profile="$(time_cmd mktemp -d)"

  local exit_code=0
  "$CHROMIUM_BIN" "${CHROMIUM_FLAGS[@]}" \
    --user-data-dir="$tmp_profile" \
    --window-size="${width},${height}" \
    --screenshot="$output" \
    "$CAPTURE_URL" 2>/dev/null || exit_code=$?

  time_cmd rm -rf "$tmp_profile"

  if [[ $exit_code -ne 0 ]]; then
    echo "ERROR: Browser failed for $name view (exit $exit_code)" >&2
    # Infrastructure/browser failure -> exit 75
    exit 75
  fi

  if [[ ! -f "$output" ]]; then
    echo "ERROR: Screenshot not produced for $name view" >&2
    exit 1
  fi

  local size
  size="$(time_cmd stat -c%s "$output" 2>/dev/null || echo 0)"
  if [[ "$size" -eq 0 ]]; then
    echo "ERROR: Empty screenshot for $name view" >&2
    exit 1
  fi

  echo "$name view captured: $output ($size bytes)"
}

# Desktop view
capture_view "desktop" 1440 900 "$DESKTOP_OUT"

# Mobile view
capture_view "mobile" 390 844 "$MOBILE_OUT"

echo "=== Capture complete ==="
echo "Desktop: $DESKTOP_OUT"
echo "Mobile: $MOBILE_OUT"

exit 0