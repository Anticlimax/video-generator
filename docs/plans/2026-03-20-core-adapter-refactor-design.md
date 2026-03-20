# Core Adapter Refactor Design

## Goal

Reshape the repository so the ambient video workflow has one shared business core and two thin adapters:

- the Next.js web app as the primary runtime
- the OpenClaw plugin as a compatibility adapter

The refactor should reduce duplicated flow logic, unify configuration and artifacts, and make future work happen in one place.

## Current Problems

The repository currently mixes three concerns:

1. Web runtime
   - `app/*`
   - `components/*`
   - `src/server/*`

2. OpenClaw runtime
   - `openclaw/index.js`
   - plugin config and TG-era behavior

3. Shared workflow logic
   - music generation
   - cover generation
   - video rendering
   - publishing
   - job state transitions

This causes several concrete issues:

- the same business flow exists in both web and OpenClaw shaped code
- job and artifact paths are inconsistent
- runtime config is provider-specific and scattered
- the main product direction is now web-first, but the repo still reads as OpenClaw-first

## Target Architecture

The repository should converge on this structure:

```text
app/                        # Next.js pages and API routes
components/                 # Web UI components
src/core/                   # Runtime-agnostic business logic
src/core/config/            # Runtime config resolution and normalization
src/core/jobs/              # Job models, store, progress, artifacts
src/core/media/             # Music, cover, render services
src/core/pipeline/          # Generate/publish orchestration
src/core/publish/           # YouTube publish service
src/adapters/web/           # HTTP request/response mapping
src/adapters/openclaw/      # OpenClaw tool registration and mapping
openclaw/                   # Thin compatibility entry only
```

## Boundary Rules

### `src/core/*`

This is the only place where workflow behavior should live.

Rules:

- no Next.js imports
- no OpenClaw `api.registerTool`
- no Telegram-specific behavior
- no request/response objects
- only plain JavaScript objects in and out

This layer owns:

- runtime config normalization
- job creation and updates
- progress transitions
- music generation
- cover generation
- video rendering
- publishing
- error mapping

### `src/adapters/web/*`

This layer is only responsible for translating web requests into core calls.

Rules:

- validate and normalize API input
- call core pipeline
- return web-friendly JSON
- no business branching that duplicates core behavior

### `src/adapters/openclaw/*`

This layer is only responsible for translating OpenClaw tools into core calls.

Rules:

- register tools
- translate tool args into core input
- translate core output into tool output
- keep legacy OpenClaw support alive without owning the workflow

### `app/*`

This layer owns page rendering only.

Rules:

- render forms, lists, detail pages
- fetch data through web adapters or route handlers
- no media pipeline logic in components

## Data Flow

### Web Generate Flow

```text
UI form
  -> POST /api/jobs
  -> web adapter
  -> core pipeline
  -> core media services
  -> core job store
  -> outputs/jobs artifacts
  -> GET /api/jobs/:id
  -> detail page
```

### OpenClaw Compatibility Flow

```text
OpenClaw tool call
  -> openclaw adapter
  -> core pipeline
  -> core media services
  -> core job store
  -> tool result
```

## Job And Artifact Model

Short term:

- keep filesystem-backed jobs
- keep `jobs/` and `outputs/`
- preserve current APIs

But the ownership rule should change:

- one top-level web job should own the user-visible job record
- internal media stages should stop creating unrelated peer jobs for normal web execution

This is a follow-up refactor after the directory move because it changes artifact contracts.

## Configuration Model

Configuration should be normalized once in core.

Inputs may come from:

- web environment variables
- local process environment
- OpenClaw plugin config

Target shape:

```js
{
  musicProvider: "mock" | "musicgpt" | "elevenlabs",
  musicGptApiKey,
  elevenLabsApiKey,
  geminiApiKey,
  youtube: {
    enabled,
    scriptPath,
    clientSecretPath
  }
}
```

The web app should become the default owner of runtime config.

## Migration Plan

### Phase 1

Low-risk structural move.

- move `src/server/jobs/*` to `src/core/jobs/*`
- move `src/server/media/*` to `src/core/media/*`
- move `src/server/publish/*` to `src/core/publish/*`
- update imports in web app and tests
- keep behavior unchanged

### Phase 2

Introduce pipeline boundary.

- add `src/core/pipeline/generate-video.js`
- add `src/core/pipeline/publish-video.js`
- move orchestration out of route handlers and OpenClaw entrypoints

### Phase 3

Thin adapters.

- move OpenClaw registration logic into `src/adapters/openclaw/*`
- move web request parsing into `src/adapters/web/*`
- reduce `openclaw/index.js` to a thin compatibility entry

### Phase 4

Artifact and config cleanup.

- unify web job artifacts under one job directory
- centralize config resolution
- remove duplicated fallback logic from adapters

## Risks

1. Import churn can break tests and runtime paths
2. OpenClaw compatibility can drift if the adapter is not kept thin
3. Hidden path assumptions still exist, especially around cover generation and YouTube helper scripts
4. Artifact ownership changes can break existing tests if done too early

## Non-Goals

This refactor does not immediately do the following:

- remove OpenClaw support entirely
- replace filesystem storage
- add auth or multi-user support
- replace local helper scripts
- redesign the UI

## Success Criteria

The refactor is successful when:

- shared workflow logic lives under `src/core/*`
- the web app still works without behavior regression
- OpenClaw compatibility still exists but becomes adapter-only
- future workflow changes can be implemented once in core
