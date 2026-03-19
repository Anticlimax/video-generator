# Web App Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the ambient generation workflow as a deployable Next.js web app that creates videos from theme/style input without relying on OpenClaw sessions or Telegram.

**Architecture:** A single Next.js app provides the UI and API routes. Media generation runs on the server host using extracted Node service modules for music generation, cover generation, ffmpeg rendering, and optional YouTube publish. Job metadata is persisted separately from media artifacts so the UI can poll progress safely.

**Tech Stack:** Next.js, React, Node.js, SQLite, ffmpeg, ffprobe

---

### Task 1: Scaffold The Web App Shell

**Files:**
- Create: `app/page.tsx`
- Create: `app/jobs/[id]/page.tsx`
- Create: `app/jobs/page.tsx`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Modify: `package.json`

**Step 1: Write the failing smoke test**

Add a test file that asserts the project exposes a web app entry layout and a job creation page component.

**Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL because app files do not exist.

**Step 3: Add the minimal Next.js shell**

Create the app directory and pages with placeholder content:

- home page with form placeholders
- jobs list page placeholder
- job detail page placeholder

Add package scripts for the app:

- `dev`
- `build`
- `start`
- existing `test`

**Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS for the new app-shell smoke.

**Step 5: Commit**

```bash
git add app package.json
git commit -m "feat: scaffold web app shell"
```

### Task 2: Extract Job Domain Model

**Files:**
- Create: `src/server/jobs/job-store.js`
- Create: `src/server/jobs/job-types.js`
- Test: `tests/server/job-store.test.js`

**Step 1: Write the failing test**

Write tests that assert a job can be:

- created
- loaded by id
- listed
- updated by stage/status/progress

**Step 2: Run test to verify it fails**

Run: `node --test tests/server/job-store.test.js`
Expected: FAIL because the store does not exist.

**Step 3: Write minimal implementation**

Implement a job store abstraction with filesystem-backed persistence first, but keep the API shaped so it can be swapped to SQLite cleanly.

**Step 4: Run test to verify it passes**

Run: `node --test tests/server/job-store.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/jobs tests/server/job-store.test.js
git commit -m "feat: add web job store"
```

### Task 3: Extract Media Services From OpenClaw Plugin Logic

**Files:**
- Create: `src/server/media/generate-music.js`
- Create: `src/server/media/generate-cover.js`
- Create: `src/server/media/render-video.js`
- Modify: `src/lib/music-provider.js`
- Test: `tests/server/generate-music.test.js`
- Test: `tests/server/generate-cover.test.js`
- Test: `tests/server/render-video.test.js`

**Step 1: Write the failing tests**

Cover:

- music generation returns a normalized audio artifact
- cover generation returns an image path
- render produces an mp4 artifact

**Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/server/generate-music.test.js tests/server/generate-cover.test.js tests/server/render-video.test.js
```

Expected: FAIL because server media services do not exist.

**Step 3: Write minimal implementation**

Extract logic from `openclaw/index.js` into plain async functions that accept normal inputs instead of OpenClaw tool payloads.

**Step 4: Run test to verify it passes**

Run the same test command.
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/media src/lib/music-provider.js tests/server
git commit -m "refactor: extract media services from openclaw plugin"
```

### Task 4: Build The Job Runner

**Files:**
- Create: `src/server/jobs/run-job.js`
- Create: `src/server/jobs/create-job.js`
- Modify: `src/lib/jobs.js`
- Test: `tests/server/run-job.test.js`

**Step 1: Write the failing test**

Write a test that:

- creates a job
- runs it asynchronously
- updates stage/progress
- persists final artifacts

**Step 2: Run test to verify it fails**

Run: `node --test tests/server/run-job.test.js`
Expected: FAIL because no runner exists.

**Step 3: Write minimal implementation**

Implement:

- job creation
- background execution
- progress transitions
- final success/failure persistence

**Step 4: Run test to verify it passes**

Run: `node --test tests/server/run-job.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/jobs src/lib/jobs.js tests/server/run-job.test.js
git commit -m "feat: add async job runner"
```

### Task 5: Add Create/List/Detail APIs

**Files:**
- Create: `app/api/jobs/route.ts`
- Create: `app/api/jobs/[id]/route.ts`
- Test: `tests/web/jobs-api.test.js`

**Step 1: Write the failing test**

Add API tests for:

- create job
- list jobs
- get job detail

**Step 2: Run test to verify it fails**

Run: `node --test tests/web/jobs-api.test.js`
Expected: FAIL because the API routes do not exist.

**Step 3: Write minimal implementation**

Implement route handlers that:

- validate input
- create jobs
- return job details from the store

**Step 4: Run test to verify it passes**

Run: `node --test tests/web/jobs-api.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api tests/web/jobs-api.test.js
git commit -m "feat: add jobs api routes"
```

### Task 6: Build The New Job UI

**Files:**
- Modify: `app/page.tsx`
- Create: `components/job-form.tsx`
- Test: `tests/web/job-form.test.js`

**Step 1: Write the failing test**

Test that the form includes:

- theme input
- style input
- duration input
- provider select
- publish toggle
- submit button

**Step 2: Run test to verify it fails**

Run: `node --test tests/web/job-form.test.js`
Expected: FAIL because the form is still placeholder UI.

**Step 3: Write minimal implementation**

Build the form and submit to `POST /api/jobs`.

**Step 4: Run test to verify it passes**

Run: `node --test tests/web/job-form.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add app/page.tsx components tests/web/job-form.test.js
git commit -m "feat: add job creation form"
```

### Task 7: Build The Job Detail UI

**Files:**
- Modify: `app/jobs/[id]/page.tsx`
- Create: `components/job-status-card.tsx`
- Create: `components/job-result-card.tsx`
- Test: `tests/web/job-detail-page.test.js`

**Step 1: Write the failing test**

Test that job detail renders:

- stage
- progress
- cover preview
- video preview
- artifact links
- publish result when present

**Step 2: Run test to verify it fails**

Run: `node --test tests/web/job-detail-page.test.js`
Expected: FAIL because detail page is placeholder UI.

**Step 3: Write minimal implementation**

Render polled job data and show live status updates.

**Step 4: Run test to verify it passes**

Run: `node --test tests/web/job-detail-page.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add app/jobs components tests/web/job-detail-page.test.js
git commit -m "feat: add job detail page"
```

### Task 8: Add Jobs List UI

**Files:**
- Modify: `app/jobs/page.tsx`
- Create: `components/jobs-table.tsx`
- Test: `tests/web/jobs-page.test.js`

**Step 1: Write the failing test**

Test that the jobs page renders a list of recent jobs with links and statuses.

**Step 2: Run test to verify it fails**

Run: `node --test tests/web/jobs-page.test.js`
Expected: FAIL because jobs page is placeholder UI.

**Step 3: Write minimal implementation**

Render recent jobs from the API.

**Step 4: Run test to verify it passes**

Run: `node --test tests/web/jobs-page.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add app/jobs/page.tsx components tests/web/jobs-page.test.js
git commit -m "feat: add jobs list page"
```

### Task 9: Add Optional YouTube Publish Path

**Files:**
- Create: `src/server/publish/youtube.js`
- Modify: `src/server/jobs/run-job.js`
- Test: `tests/server/youtube-publish.test.js`

**Step 1: Write the failing test**

Test that when publish is requested:

- video generation still succeeds
- YouTube publish is attempted
- publish success/failure is stored separately

**Step 2: Run test to verify it fails**

Run: `node --test tests/server/youtube-publish.test.js`
Expected: FAIL because publish is not integrated into the job runner.

**Step 3: Write minimal implementation**

Reuse the existing upload logic behind a plain server module.

**Step 4: Run test to verify it passes**

Run: `node --test tests/server/youtube-publish.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/publish src/server/jobs tests/server/youtube-publish.test.js
git commit -m "feat: add youtube publish to web jobs"
```

### Task 10: Document Deployment And Local Ops

**Files:**
- Modify: `README.md`
- Create: `docs/setup/web-app-deployment.md`

**Step 1: Write the missing-doc checklist**

List:

- required env vars
- ffmpeg requirement
- provider config
- start/build commands
- storage paths

**Step 2: Run verification**

Run:

```bash
node --test
```

Expected: PASS

**Step 3: Write docs**

Document:

- local run
- deploy assumptions
- job cleanup expectations
- internal-use security caveat

**Step 4: Commit**

```bash
git add README.md docs/setup/web-app-deployment.md
git commit -m "docs: add web app deployment guide"
```

