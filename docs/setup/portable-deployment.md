# Portable Deployment

## Goal

Move the ambient generation and publish workflow to another computer with minimal manual setup.

## Required Runtime

Install these before bootstrapping:

- Node.js
- Python 3
- ffmpeg
- ffprobe
- OpenClaw
- `npx`

## Project Bootstrap

From the project root:

```bash
./scripts/bootstrap-local.sh
```

This script does four important things:

1. checks the required local commands
2. links the `ambient-media-tools` plugin into OpenClaw
3. ensures `youtube-publisher` is installed
4. installs YouTube upload Python dependencies into both:
   - the active `python3`
   - `/usr/local/bin/python3` when present

The second interpreter install matters because local OpenClaw agent runs may use a different Python than your interactive shell.

## Required Secrets

After bootstrap, configure the primary provider:

```bash
openclaw config set plugins.entries.ambient-media-tools.config.mode musicgpt
openclaw config set plugins.entries.ambient-media-tools.config.musicGptApiKey 'YOUR_MUSICGPT_API_KEY'
openclaw config set plugins.entries.ambient-media-tools.config.geminiApiKey 'YOUR_GEMINI_API_KEY'
```

Optional fallback provider:

```bash
openclaw config set plugins.entries.ambient-media-tools.config.elevenLabsApiKey 'YOUR_ELEVENLABS_API_KEY'
```

## YouTube OAuth

Do not rely on copying old machine tokens blindly as the primary path.

Preferred setup:

1. place `client_secret.json` at:
   `~/.openclaw/workspace/skills/youtube-publisher/client_secret.json`
2. run:

```bash
python3 ~/.openclaw/workspace/skills/youtube-publisher/scripts/youtube_upload.py auth
```

This creates:

- `~/.openclaw/workspace/skills/youtube-publisher/token.json`

## Verify the New Machine

Run:

```bash
./scripts/verify-portable-setup.sh
```

This verifies:

- plugin load state
- core tests
- YouTube credential files
- a real OpenClaw local generate smoke

## What Not To Copy Into Git

Keep these out of version control:

- MusicGPT API key
- Gemini API key
- ElevenLabs API key
- `client_secret.json`
- `token.json`

## Recommended Move Checklist

1. install system dependencies
2. clone the repo
3. run `./scripts/bootstrap-local.sh`
4. configure API keys
5. place `client_secret.json`
6. run YouTube auth
7. run `./scripts/verify-portable-setup.sh`

After that, the machine should be ready for:

- `ambient_video_generate`
- `ambient_video_publish`
- Telegram-host integration via [telegram-adapter.js](/Users/liyang/project/video-generate/src/lib/telegram-adapter.js)
