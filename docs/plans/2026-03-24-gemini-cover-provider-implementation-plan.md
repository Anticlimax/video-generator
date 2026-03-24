# Gemini Cover Provider Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the web app's cover-image generation path with an in-repo Node.js Gemini provider instead of a local OpenClaw/Python script.

**Architecture:** Add a dedicated `gemini-image` provider module in `src/core/media`, keep `generateCover(...)` as the public orchestration entrypoint, and migrate its default implementation to the Node provider. Preserve current runtime config and job error behavior while removing the web runtime dependency on local OpenClaw skill installation.

**Tech Stack:** Node.js ESM, Next.js server runtime, `@google/genai`, `node:test`

---

### Task 1: Add the Gemini SDK dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Add the dependency**

Add `@google/genai` to `dependencies`.

**Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: lockfile updates and install completes successfully.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add google genai sdk"
```

### Task 2: Create the Node Gemini image provider

**Files:**
- Create: `src/core/media/gemini-image.js`
- Test: `tests/server/gemini-image.test.js`

**Step 1: Write the failing tests**

Cover:

- writes returned image bytes to `outputPath`
- fails with `missing_gemini_api_key` when no key exists
- maps timeouts to `cover_generation_timeout`
- fails with `cover_generation_no_image` if no image part is returned

**Step 2: Run the test to verify it fails**

Run:

```bash
node --test tests/server/gemini-image.test.js
```

Expected: FAIL because the provider module does not exist yet.

**Step 3: Write the minimal implementation**

Implement:

- SDK client creation
- image generation request
- image byte extraction
- PNG write to disk
- normalized error mapping

**Step 4: Run the test to verify it passes**

Run:

```bash
node --test tests/server/gemini-image.test.js
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/media/gemini-image.js tests/server/gemini-image.test.js
git commit -m "feat: add node gemini image provider"
```

### Task 3: Migrate generate-cover to the Node provider

**Files:**
- Modify: `src/core/media/generate-cover.js`
- Modify: `tests/server/generate-cover.test.js`

**Step 1: Write the failing test**

Add coverage that the default generator path reports `provider: "gemini-image"` and uses the Node provider when no injected generator is supplied.

**Step 2: Run the test to verify it fails**

Run:

```bash
node --test tests/server/generate-cover.test.js
```

Expected: FAIL because the current default implementation still shells out to the OpenClaw Python script.

**Step 3: Write the minimal implementation**

Refactor:

- remove the hard-coded OpenClaw script path from the default web path
- delegate default generation to the new `gemini-image` provider
- preserve prompt resolution and timeout semantics
- keep `coverGeneratorImpl` support for tests

**Step 4: Run the test to verify it passes**

Run:

```bash
node --test tests/server/generate-cover.test.js
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/media/generate-cover.js tests/server/generate-cover.test.js
git commit -m "refactor: migrate cover generation to node gemini provider"
```

### Task 4: Verify job-level error behavior still works

**Files:**
- Modify: `tests/server/run-job.test.js`

**Step 1: Write or update failing tests**

Ensure:

- concrete image-generation errors still flow into failed jobs
- missing image sources still fail the job

**Step 2: Run the focused tests**

Run:

```bash
node --test tests/server/run-job.test.js tests/server/runtime-config.test.js
```

Expected: PASS after migration.

**Step 3: Commit**

```bash
git add tests/server/run-job.test.js tests/server/runtime-config.test.js
git commit -m "test: preserve job error semantics for node cover provider"
```

### Task 5: Final verification and cleanup

**Files:**
- Optionally modify: `README.md`
- Optionally modify: `docs/setup/web-app-deployment.md`

**Step 1: Run focused regression**

```bash
node --test tests/server/gemini-image.test.js tests/server/generate-cover.test.js tests/server/run-job.test.js tests/server/runtime-config.test.js tests/web/jobs-api.test.js
```

Expected: all pass.

**Step 2: Run broader regression if needed**

```bash
node --test
```

Expected: full suite stays green.

**Step 3: Update deployment docs if wording still mentions OpenClaw/Python for cover generation**

**Step 4: Commit**

```bash
git add README.md docs/setup/web-app-deployment.md
git commit -m "docs: update cover provider deployment notes"
```
