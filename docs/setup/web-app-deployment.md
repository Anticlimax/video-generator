# Web App Deployment

## Goal

Deploy the ambient generation workflow as a single Next.js web app on a machine you control.

This is an internal-use setup:

- no login
- no tenancy
- no public multi-user hardening yet
- filesystem-backed jobs and outputs

## What Runs On The Host

The deployment host runs:

- the Next.js app
- the job store under `jobs/`
- rendered videos under `outputs/`
- local media adapters for music, cover generation, video rendering, and optional YouTube publish

Bundled VFX metadata is documented in [vfx-assets.md](/Users/liyang/project/video-generate/docs/setup/vfx-assets.md). The runtime expects the bundled rain overlay to be mounted under `assets/vfx` unless `VFX_ASSET_ROOT` overrides it.

## Required Runtime

Install these on the deployment machine:

- Node.js
- npm
- Python 3
- ffmpeg
- ffprobe

If you want non-mock media providers, also configure:

- `MUSICGPT_API_KEY`
- `ELEVENLABS_API_KEY`
- `GEMINI_API_KEY`
- `RUNWAY_API_KEY`
- `MOTION_CLIP_DURATION_SEC`
- `RAIN_VFX_OVERLAY_PATTERN`
- `RAIN_VFX_START_NUMBER`
- `RAIN_VFX_OVERLAY_OPACITY`
- `VFX_ASSET_ROOT`

Recommended operational baseline:

- keep the app behind a VPN, private network, or reverse proxy with access control
- run it on a machine where local file writes to the repo directory are allowed
- keep `jobs/` and `outputs/` on persistent storage if you want history to survive restarts
- mount bundled VFX assets on the host, or set `VFX_ASSET_ROOT` to the directory that contains them

## Bootstrap

From the project root:

```bash
npm install
```

For local development:

```bash
npm run dev
```

For deployment:

```bash
npm run build
npm run start
```

Before launching a new machine or image, run:

```bash
./scripts/verify-web-runtime.sh
```

Use a process manager if the machine should recover automatically after reboot.

## First Deploy Path

The safest first deploy is:

1. start with the `mock` music provider
2. verify that `/`, `/jobs`, and `/jobs/[id]` load
3. create a short job
4. confirm the job record appears under `jobs/`
5. confirm the rendered MP4 appears under `outputs/`

If you want real music generation, the server side supports `musicgpt` and `elevenlabs`, but the process must be able to reach the corresponding provider credentials before those modes are used.

## Optional Provider Setup

The current server modules accept these modes and helpers:

- `mock`
- `musicgpt`
- `elevenlabs`
- `geminiApiKey` for cover generation
- `runwayApiKey` for image-to-video micro-motion

For publish mode, keep the legacy YouTube helper configured on the host:

1. place `client_secret.json` where the local YouTube helper expects it
2. run the OAuth authorization flow once
3. keep the resulting token file on the deployment host

If you do not want YouTube publishing, leave the publish checkbox off in the UI or the `publishToYouTube` field false in the API request.

## Pages And APIs

The deployed app exposes:

- `/` for job creation
- `/jobs` for history
- `/jobs/[id]` for job detail
- `POST /api/jobs` for job creation
- `GET /api/jobs` for job listing
- `GET /api/jobs/:id` for job lookup

The job payload accepts:

- `theme`
- `style`
- `duration`
- `provider`
- `publishToYouTube`

## Storage Layout

The app writes deterministic artifacts into the repo root:

- `jobs/<job_id>/job.json`
- `jobs/<job_id>/progress.json`
- `jobs/<job_id>/master_audio.wav`
- `jobs/<job_id>/extended_audio.wav`
- `jobs/<job_id>/loop_video.mp4`
- `jobs/<job_id>/ffprobe.json`
- `outputs/<output_name>.mp4`

Back up both `jobs/` and `outputs/` together if you want to preserve generated work.

## VFX Assets

Use the bundled rain overlay asset registry instead of hard-coding paths in deployment notes.

- Registry: [vfx-assets.md](/Users/liyang/project/video-generate/docs/setup/vfx-assets.md)
- Default asset root: `assets/vfx`
- Override: `VFX_ASSET_ROOT`
- Default rain overlay pattern:
  - `assets/vfx/RainOnGlass-004/RainOnGlass-004.%04d.exr`
- Default rain overlay start number:
  - `1001`
- Default rain overlay opacity:
  - `0.95`

## Upgrade Notes

- There is no auth layer yet, so do not expose the app publicly without adding one.
- The UI and API are ready to host the workflow. Cover generation now runs through the in-repo Node Gemini provider; YouTube publish still relies on the host-local helper.
- The deployment host should keep the bundled rain overlay assets available; `./scripts/verify-web-runtime.sh` will fail fast if they are missing.
- If you later split media generation into a background worker, the job store and API routes can stay as they are.
