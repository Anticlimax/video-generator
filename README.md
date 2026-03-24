# ambient-media-tools

Deployable Next.js web app for turning a theme/style/duration prompt into an ambient video, a cover image, and an optional YouTube publish result.

The repo still carries the older OpenClaw compatibility layer for migration and helper scripts, but the Next.js app is now the primary runtime.

## Current Shape

- Next.js full-stack app
- Home page: `/`
- Jobs list: `/jobs`
- Job detail: `/jobs/[id]`
- API routes: `/api/jobs`, `/api/jobs/[id]`
- Filesystem-backed jobs in `jobs/`
- Final exports in `outputs/`
- Default music provider: `mock`
- Real music providers: `musicgpt`, `elevenlabs`
- Cover generation provider: in-repo Gemini image adapter
- Optional YouTube publish helper: `youtube-publisher`
- Legacy OpenClaw plugin entry still exists in `openclaw/index.js`

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Build for deployment:

```bash
npm run build
```

4. Start the production server:

```bash
npm run start
```

## Pages And APIs

- `/` shows the generation form
- `/jobs` shows recent jobs
- `/jobs/[id]` shows job status and results
- `POST /api/jobs` creates a job and starts the background run
- `GET /api/jobs` lists recent jobs
- `GET /api/jobs/:id` returns one job record

The form accepts:

- `theme`
- `style`
- `duration`
- `provider`
- optional `publishToYouTube`

## Job Artifacts

Each job is stored under `jobs/<job_id>/` with files such as:

- `job.json`
- `progress.json`
- `master_audio.wav`
- `extended_audio.wav`
- `loop_video.mp4`
- `ffprobe.json`

The final MP4 is written to:

- `outputs/<output_name>.mp4`

## Provider Setup

The server pipeline supports these music modes:

- `mock`
- `musicgpt`
- `elevenlabs`

The web app now generates covers through an in-repo Node Gemini provider. Optional YouTube publish still reuses the local `youtube-publisher` helper.

If you switch away from `mock`, make sure the deployment host has the required provider keys available.

## Deployment Notes

- This app is intended for a single internal machine or a private network.
- There is no login or tenancy layer yet.
- Keep the deployment behind a VPN, reverse proxy, or other private access boundary.
- Job data is filesystem-backed, so back up `jobs/` and `outputs/` together with the app if you want continuity.

## Deployment Guide

See [web-app-deployment.md](/Users/liyang/project/video-generate/docs/setup/web-app-deployment.md) for the minimal single-host setup.

## Legacy OpenClaw Setup

The older OpenClaw/TG migration notes still live at [portable-deployment.md](/Users/liyang/project/video-generate/docs/setup/portable-deployment.md).
