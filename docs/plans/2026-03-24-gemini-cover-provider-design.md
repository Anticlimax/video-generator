# Gemini Cover Provider Refactor Design

## Goal

Replace the current cover-image generation path that shells out to a locally installed OpenClaw skill script with an in-repo Node.js Gemini image provider, so the web app can run on VPS or Google Cloud without depending on local OpenClaw or Python setup.

## Problem

The current cover generation path in [generate-cover.js](/Users/liyang/project/video-generate/src/core/media/generate-cover.js) relies on:

- a hard-coded local path into `~/.nvm/.../openclaw/skills/nano-banana-pro/scripts/generate_image.py`
- `uv run`
- Python runtime and dynamically created `uv` environments

This creates three deployment problems:

1. Cloud machines may not have OpenClaw installed at all.
2. Even if OpenClaw exists, the skill path and Node version are machine-specific.
3. Debugging and observability are weak because the web app only sees a subprocess failure or timeout, not a first-class provider result.

## Chosen Approach

Implement a first-party Node provider inside this repo using the official `@google/genai` package and keep the existing `generateCover(...)` interface stable.

That means:

- `generate-cover.js` remains the main orchestration entrypoint.
- A new `gemini-image.js` module performs the Gemini API request and writes the PNG to disk.
- `generate-cover.js` delegates to the in-repo provider by default.
- Timeouts stay enforced in the Node layer.
- Error messages are normalized into the same cover-generation failure flow already used by `runJob`.

## Alternatives Considered

### 1. Keep Python, move script into this repo

Pros:
- Minimal API behavior drift from current implementation.

Cons:
- Still depends on Python and `uv`.
- Still awkward for cloud/container deployment.
- Still splits runtime logic across languages.

Rejected because it removes the OpenClaw dependency but keeps the bigger deployment problem.

### 2. Call Gemini REST directly with `fetch`

Pros:
- No extra dependency.

Cons:
- More brittle request/response handling.
- Less maintainable than the official SDK.

Rejected because maintainability matters more than saving one package.

### 3. Use official `@google/genai` in Node

Pros:
- Single-language runtime.
- Better fit for Next.js/server runtime.
- Easier to test and easier to deploy on VPS/GCP.

Cons:
- Adds one dependency.

Chosen because it best matches the web-app-first architecture.

## Architecture

### New module

Add:

- `src/core/media/gemini-image.js`

Responsibilities:

- accept `{ prompt, outputPath, apiKey, aspectRatio, timeoutMs }`
- call Gemini image generation through `@google/genai`
- extract the returned image bytes
- write a PNG to `outputPath`
- return `{ imagePath, provider: "gemini-image", prompt }`

### Existing module changes

Update:

- `src/core/media/generate-cover.js`

Changes:

- remove hard-coded OpenClaw skill path usage from the default path
- remove `uv run` subprocess use from the default path
- default to the in-repo Gemini Node provider
- keep `coverGeneratorImpl` injection for tests
- preserve current prompt-building behavior

### Runtime config

Keep:

- `runtimeConfig.geminiApiKey`
- `runtimeConfig.coverGenerationTimeoutMs`

No API contract changes are needed for web callers.

## Error Handling

The provider should distinguish:

- `cover_generation_timeout`
- `cover_generation_failed`
- `missing_gemini_api_key`
- `cover_generation_no_image`

`generate-cover.js` should rethrow these as ordinary `Error` objects with stable messages so `runJob` can persist them into `job.errorCode` / `job.errorMessage`.

The web product behavior should remain:

- if image generation fails and no renderable source exists, fail the job
- do not silently render black output

## Testing

Add or update tests for:

- provider writes PNG bytes to disk from a mocked Gemini response
- missing API key fails with `missing_gemini_api_key`
- timeout becomes `cover_generation_timeout`
- `generateCover(...)` default path now reports provider `gemini-image`
- `runJob` still persists concrete image-generation errors

## Non-Goals

- Replacing the legacy OpenClaw adapter in this same change
- Rewriting motion/video generation providers
- Improving Gemini prompt quality
- Changing web job input/output schema

## Migration Impact

After this refactor:

- the web app no longer depends on local OpenClaw skill installation for cover generation
- Python is no longer required for cover generation
- the remaining OpenClaw coupling becomes legacy adapter work, not a web runtime dependency
