#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/5] plugin status"
openclaw plugins info ambient-media-tools

echo "[2/5] quick test suite"
cd "$PROJECT_ROOT"
node --test \
  tests/lib/telegram-adapter.test.js \
  tests/openclaw/tool-registration.test.js \
  tests/openclaw/ambient-video-generate.test.js

echo "[3/5] youtube credential files"
YOUTUBE_SKILL_DIR="${HOME}/.openclaw/workspace/skills/youtube-publisher"
if [[ ! -f "${YOUTUBE_SKILL_DIR}/client_secret.json" ]]; then
  echo "missing ${YOUTUBE_SKILL_DIR}/client_secret.json" >&2
  exit 1
fi
if [[ ! -f "${YOUTUBE_SKILL_DIR}/token.json" ]]; then
  echo "missing ${YOUTUBE_SKILL_DIR}/token.json; run youtube auth first" >&2
  exit 1
fi

echo "[4/5] openclaw local generate smoke"
openclaw agent --local --agent main --json \
  --message 'Use the ambient_video_generate tool with theme ocean, style calm piano, soft moonlight, duration_target_sec 30, master_duration_sec 30, allow_nonstandard_duration true, mode mock, output_name portable-verify-smoke. Return only the tool result.'

echo "[5/5] portable setup looks ready"
