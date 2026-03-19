# Ambient Video Web App Rebuild Design

## Goal

Replace the current OpenClaw/TG-driven workflow with a deployable web application where a user enters a theme, clicks a button, and gets:

- a generated video
- a generated cover image
- task progress
- optional YouTube publish result

The first version is for internal use only and does not require login.

## Why Rebuild

The current OpenClaw integration already proved the generation chain can work, but the interaction layer is unstable:

- tool visibility depends on agent/session state
- Telegram progress delivery depends on channel metadata and session routing
- operational behavior is harder to debug than a normal app request/response flow

The reusable part of the current codebase is the media pipeline itself, not the OpenClaw runtime surface.

## Product Scope

### In Scope

- Single internal web app
- No authentication
- Create generation job from:
  - `theme`
  - `style`
  - `duration`
  - optional provider choice
  - optional publish-to-YouTube toggle
- Show job progress
- Show cover image preview
- Show final video preview and download link
- Show publish result when enabled

### Out of Scope

- User accounts
- Multi-tenant isolation
- Billing
- Public-facing hardening
- Complex queues or distributed workers
- Telegram or OpenClaw entrypoints

## Recommended Architecture

### Option A: Next.js Full-Stack Monolith

Use a single Next.js app for:

- frontend pages
- backend route handlers
- local task orchestration

The server process runs generation jobs on the same machine using the existing Node + ffmpeg pipeline.

This is the recommended option because it minimizes rebuild cost while removing OpenClaw session complexity.

### Option B: Next.js Frontend + Separate Node API

Split UI and backend service.

This gives cleaner boundaries, but it adds deployment and local development overhead without solving a real phase-one problem.

### Option C: Thin Internal Tool UI

Server-rendered internal dashboard with minimal client interactivity.

Fastest to build, but weak as a base for later iteration.

## Recommendation

Build **Option A**.

Use Next.js as the only app, but structure generation code as isolated server modules so it can be moved into a worker later if needed.

## System Design

### Frontend

The app should have three main pages:

1. **New Job Page**
   - theme input
   - style input
   - duration input
   - provider selector
   - optional YouTube publish toggle
   - submit button

2. **Job Detail Page**
   - current stage
   - progress text
   - timestamps
   - cover image preview
   - video preview
   - output paths
   - publish result

3. **Jobs List Page**
   - recent jobs
   - status
   - duration
   - created time
   - quick links to result pages

### Backend

The web app should expose route handlers for:

- `POST /api/jobs`
- `GET /api/jobs`
- `GET /api/jobs/:id`
- optional `POST /api/jobs/:id/publish`

The backend should not depend on OpenClaw tool registration. It should call plain server modules directly.

### Execution Model

The first version should run jobs inside the deployed app host.

That means:

- request creates the job
- server starts async execution
- progress is written to local storage
- frontend polls job status

This is acceptable for an internal MVP and keeps implementation small.

## Refactor Strategy

### What To Keep

Keep and reuse the current logic from:

- `src/lib/music-provider.js`
- `src/lib/music-prompt.js`
- `src/lib/jobs.js`
- `src/lib/render-plan.js`
- `src/lib/ffmpeg-commands.js`
- `src/lib/duration-policy.js`
- selected helper logic from `openclaw/index.js`

### What To Remove From The Main Path

Do not route web requests through:

- OpenClaw plugin registration
- OpenClaw agent tools
- Telegram message relay
- OpenClaw session state

These remain historical integration code, not the main product runtime.

### New Server Modules

Add a plain service layer:

- `src/server/jobs/create-job.js`
- `src/server/jobs/run-job.js`
- `src/server/jobs/get-job.js`
- `src/server/media/generate-cover.js`
- `src/server/media/generate-music.js`
- `src/server/media/render-video.js`
- `src/server/publish/youtube.js`

These modules should expose normal async functions and write deterministic artifacts into `jobs/` and `outputs/`.

## Data Model

### Job Record

Each job should track:

- `id`
- `theme`
- `style`
- `durationTargetSec`
- `masterDurationSec`
- `provider`
- `status`
- `stage`
- `progress`
- `createdAt`
- `updatedAt`
- `coverImagePath`
- `masterAudioPath`
- `finalVideoPath`
- `youtubeUrl`
- `errorCode`
- `errorMessage`

### Storage

First version storage can remain filesystem-based:

- `jobs/<jobId>/`
- `outputs/`
- one lightweight index file or SQLite database for listing jobs

Recommendation: use **SQLite** for job metadata and keep media artifacts on disk.

This gives:

- stable listing
- filtering
- cleaner status queries
- easier future deployment than JSON file mutation

## Progress Model

Use the existing stage pattern:

- `queued`
- `music_generating`
- `music_ready`
- `cover_generating`
- `cover_ready`
- `video_rendering`
- `youtube_uploading`
- `completed`
- `failed`

Frontend should poll `GET /api/jobs/:id` every 2 seconds.

Do not use WebSocket in the first version.

## Error Handling

The UI should distinguish:

- provider timeout
- provider auth/config error
- cover generation failure with fallback
- ffmpeg render failure
- YouTube publish failure

If cover generation fails, the job may still continue with a fallback static frame path.

If YouTube publish fails, video generation should still count as successful.

## Deployment Assumptions

The deployment machine must have:

- Node.js
- ffmpeg
- ffprobe
- provider API keys
- optional YouTube OAuth files

This app is intended for a machine you control, not a serverless platform.

## Success Criteria

The rebuild is successful when:

1. a user can open a URL
2. submit theme/style/duration
3. watch progress update in the browser
4. preview the generated cover image
5. preview or download the generated video
6. optionally receive a YouTube publish result

## Risks

### Long-Running Request Pressure

Mitigation:

- return job id immediately
- perform execution asynchronously
- poll status from frontend

### Provider Instability

Mitigation:

- preserve provider abstraction
- keep `mock` mode
- keep provider-specific diagnostics

### Local File Storage Growth

Mitigation:

- add cleanup command later
- keep storage layout deterministic from the start

## Implementation Direction

Implementation should proceed in this order:

1. scaffold Next.js app shell
2. extract reusable server pipeline from OpenClaw plugin code
3. add job persistence
4. add create/list/detail APIs
5. add UI pages
6. reconnect provider and ffmpeg execution
7. add publish action

