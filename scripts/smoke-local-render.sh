#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/outputs"
JOB_DIR="$ROOT_DIR/jobs/smoke-local"
OUTPUT_PATH="$OUTPUT_DIR/smoke.mp4"
FFPROBE_PATH="$JOB_DIR/ffprobe.json"
MANIFEST_PATH="$JOB_DIR/manifest.json"

mkdir -p "$OUTPUT_DIR" "$JOB_DIR"

ffmpeg -y \
  -f lavfi -i "color=c=black:s=1280x720:d=3" \
  -f lavfi -i "anullsrc=r=48000:cl=stereo" \
  -shortest \
  -c:v libx264 \
  -pix_fmt yuv420p \
  -c:a aac \
  "$OUTPUT_PATH" >/dev/null 2>&1

ffprobe -v error \
  -show_entries stream=codec_type \
  -show_entries format=duration,size \
  -of json \
  "$OUTPUT_PATH" >"$FFPROBE_PATH"

if ! grep -q '"codec_type": "video"' "$FFPROBE_PATH"; then
  echo "missing video stream" >&2
  exit 1
fi

if ! grep -q '"codec_type": "audio"' "$FFPROBE_PATH"; then
  echo "missing audio stream" >&2
  exit 1
fi

printf '{\n  "ok": true,\n  "output_path": "%s",\n  "ffprobe_path": "%s"\n}\n' \
  "$OUTPUT_PATH" \
  "$FFPROBE_PATH" >"$MANIFEST_PATH"

echo "SMOKE_OK $OUTPUT_PATH"
