# Gemini Image Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make web image generation more resilient by switching to Gemini Interactions API, adding transient-failure retries, fixed model fallback, and job image metadata.

**Architecture:** Keep a single Gemini image provider in `src/core/media/gemini-image.js`, but turn it into a small state machine: try primary model with retries, then fallback model, then surface the best final error. Persist success metadata through `runJob(...)` into the job record so the web UI and failures are diagnosable.

**Tech Stack:** Node.js, `@google/genai`, existing filesystem job store, Node test runner

---

### Task 1: Add failing Gemini provider tests

**Files:**
- Modify: `tests/server/gemini-image.test.js`

**Step 1: Write the failing tests**

Add tests for:
- retry on `503` and succeed on a later attempt
- use fallback model after primary model exhaustion
- do not retry non-transient failures

**Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/server/gemini-image.test.js
```

Expected:
- FAIL because current implementation does not retry or fallback models

**Step 3: Write minimal implementation**

Implement only the minimum provider logic needed to satisfy the new tests.

**Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/server/gemini-image.test.js
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add tests/server/gemini-image.test.js src/core/media/gemini-image.js src/core/config/runtime-config.js
git commit -m "feat: add gemini image retries and fallback models"
```

### Task 2: Persist image metadata on jobs

**Files:**
- Modify: `src/core/jobs/job-types.js`
- Modify: `src/core/jobs/run-job.js`
- Test: `tests/server/run-job.test.js`

**Step 1: Write the failing test**

Add a test showing that when image generation succeeds with metadata, the job stores:
- `imageProvider`
- `imageModel`
- `imageAttemptCount`
- `imageFallbackUsed`

**Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/server/run-job.test.js
```

Expected:
- FAIL because those fields are not yet part of the job record

**Step 3: Write minimal implementation**

Update job defaults/merge logic and `runJob(...)` updates so those fields persist when the first cover generation succeeds.

**Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/server/run-job.test.js
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add src/core/jobs/job-types.js src/core/jobs/run-job.js tests/server/run-job.test.js
git commit -m "feat: persist image generation metadata on jobs"
```

### Task 3: Run focused regression

**Files:**
- No code changes required unless regressions appear

**Step 1: Run focused tests**

Run:
```bash
node --test tests/server/gemini-image.test.js tests/server/run-job.test.js tests/server/generate-cover.test.js tests/server/runtime-config.test.js tests/web/jobs-api.test.js
```

Expected:
- PASS

**Step 2: Fix any regression minimally**

Touch only files implicated by failing tests.

**Step 3: Commit final polish if needed**

```bash
git add <changed files>
git commit -m "test: cover gemini image fallback flow"
```
