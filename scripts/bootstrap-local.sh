#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

echo "[1/5] checking required commands"
for cmd in node python3 ffmpeg ffprobe openclaw npx; do
  require_cmd "$cmd"
done

echo "[2/5] linking ambient-media-tools plugin"
openclaw plugins install "$PROJECT_ROOT" --link

echo "[3/5] ensuring youtube-publisher skill"
if ! openclaw skills info youtube-publisher >/dev/null 2>&1; then
  npx clawhub install youtube-publisher
fi

echo "[4/5] installing python dependencies for youtube upload skill"
PYTHON_CANDIDATES=()
if command -v python3 >/dev/null 2>&1; then
  PYTHON_CANDIDATES+=("$(command -v python3)")
fi
if [[ -x /usr/local/bin/python3 ]]; then
  PYTHON_CANDIDATES+=("/usr/local/bin/python3")
fi

SEEN=""
for py in "${PYTHON_CANDIDATES[@]}"; do
  if [[ " $SEEN " == *" $py "* ]]; then
    continue
  fi
  SEEN="$SEEN $py"
  echo "  - installing for $py"
  "$py" -m pip install --user \
    httplib2 \
    google-api-python-client \
    google-auth-oauthlib \
    google-auth-httplib2
done

echo "[5/5] next required secrets/config"
cat <<'EOF'
- Configure ElevenLabs:
  openclaw config set plugins.entries.ambient-media-tools.config.mode elevenlabs
  openclaw config set plugins.entries.ambient-media-tools.config.elevenLabsApiKey 'YOUR_ELEVENLABS_API_KEY'

- Configure Gemini for nano-banana-pro passthrough:
  openclaw config set plugins.entries.ambient-media-tools.config.geminiApiKey 'YOUR_GEMINI_API_KEY'

- Put YouTube OAuth client secret at:
  ~/.openclaw/workspace/skills/youtube-publisher/client_secret.json

- Then run authorization once:
  python3 ~/.openclaw/workspace/skills/youtube-publisher/scripts/youtube_upload.py auth

- Finally verify the machine:
  ./scripts/verify-portable-setup.sh
EOF
