# YouTube Node OAuth Uploader Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the web runtime's local Python YouTube helper dependency with an in-repo Node uploader using Google OAuth refresh tokens.

**Architecture:** Keep `publishVideo(...)` as the stable orchestration entrypoint, add a dedicated Node uploader module for OAuth token refresh and resumable upload, then swap the default implementation in `src/core/publish/youtube.js`. Preserve current job semantics where publish failures do not fail the core video generation job.

**Tech Stack:** Node.js ESM, Fetch API, YouTube Data API v3, Google OAuth token endpoint, `node:test`

---

### Task 1: Add design-time runtime config fields

**Files:**
- Modify: `src/core/config/runtime-config.js`
- Test: `tests/server/runtime-config.test.js`

**Step 1: Write the failing test**

Add coverage that runtime config maps:

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`

**Step 2: Run test to verify it fails**

```bash
node --test tests/server/runtime-config.test.js
```

**Step 3: Implement the mapping**

Add the three values to `resolveRuntimeConfig(...)`.

**Step 4: Re-run the test**

```bash
node --test tests/server/runtime-config.test.js
```

**Step 5: Commit**

```bash
git add src/core/config/runtime-config.js tests/server/runtime-config.test.js
git commit -m "feat: add youtube oauth runtime config"
```

### Task 2: Create the Node YouTube OAuth uploader

**Files:**
- Create: `src/core/publish/youtube-oauth.js`
- Create: `tests/server/youtube-oauth.test.js`

**Step 1: Write the failing tests**

Cover:

- missing credentials => `missing_youtube_oauth_credentials`
- token refresh request is sent correctly
- upload init request is sent correctly
- final upload success returns canonical links

**Step 2: Run the test to verify it fails**

```bash
node --test tests/server/youtube-oauth.test.js
```

**Step 3: Write minimal implementation**

Implement:

- token refresh via `https://oauth2.googleapis.com/token`
- resumable upload init via YouTube Data API
- file upload PUT to returned upload URL
- response parsing into `{ videoId, url, studioUrl }`

**Step 4: Re-run the test**

```bash
node --test tests/server/youtube-oauth.test.js
```

**Step 5: Commit**

```bash
git add src/core/publish/youtube-oauth.js tests/server/youtube-oauth.test.js
git commit -m "feat: add node youtube oauth uploader"
```

### Task 3: Migrate publishVideo default implementation

**Files:**
- Modify: `src/core/publish/youtube.js`
- Modify: `tests/server/youtube-publish.test.js`

**Step 1: Write the failing test**

Replace the old subprocess test with one that asserts the default path uses runtime-config OAuth values and the Node uploader.

**Step 2: Run the focused tests**

```bash
node --test tests/server/youtube-publish.test.js
```

**Step 3: Implement the migration**

Refactor:

- remove hard-coded Python helper path from the default web path
- keep metadata logic unchanged
- keep `runtimeConfig.youtubeUploadImpl` override for tests
- default to the new Node OAuth uploader

**Step 4: Re-run the tests**

```bash
node --test tests/server/youtube-publish.test.js
```

**Step 5: Commit**

```bash
git add src/core/publish/youtube.js tests/server/youtube-publish.test.js
git commit -m "refactor: migrate youtube publish to node oauth uploader"
```

### Task 4: Verify job-level publish semantics remain stable

**Files:**
- Modify: `tests/server/run-job.test.js` if needed

**Step 1: Run the focused regressions**

```bash
node --test tests/server/run-job.test.js tests/server/youtube-publish.test.js tests/server/runtime-config.test.js
```

Expected: publish failures still annotate completed jobs instead of failing the core video job.

**Step 2: Commit if tests required updates**

```bash
git add tests/server/run-job.test.js
git commit -m "test: preserve publish semantics after node youtube migration"
```

### Task 5: Update deployment docs

**Files:**
- Modify: `README.md`
- Modify: `docs/setup/web-app-deployment.md`
- Optionally modify: `scripts/bootstrap-local.sh`

**Step 1: Update docs**

Remove references that the web runtime depends on local `youtube-publisher`.

Replace with:

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`

**Step 2: Run final focused regression**

```bash
node --test tests/server/youtube-oauth.test.js tests/server/youtube-publish.test.js tests/server/run-job.test.js tests/server/runtime-config.test.js tests/web/jobs-api.test.js
```

**Step 3: Commit**

```bash
git add README.md docs/setup/web-app-deployment.md scripts/bootstrap-local.sh
git commit -m "docs: update youtube publish deployment config"
```
