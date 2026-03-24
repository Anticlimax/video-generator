# YouTube Node OAuth Uploader Design

## Goal

Replace the current web-app YouTube publish path that shells out to the local `youtube-publisher` Python helper with an in-repo Node.js uploader using Google OAuth refresh tokens and the YouTube Data API.

## Problem

The current publish flow in [youtube.js](/Users/liyang/project/video-generate/src/core/publish/youtube.js) depends on:

- a hard-coded local script path under `~/.openclaw/workspace/skills/youtube-publisher/...`
- Python runtime and `google-api-python-client`
- host-local `client_secret.json` and `token.json` layout from the OpenClaw skill

This is unsuitable for VPS/GCP deployment because:

1. The web app runtime is still coupled to a local OpenClaw skill installation.
2. Upload behavior is implemented out-of-process and parsed from subprocess output.
3. Credentials are modeled as host-local helper files rather than a normal server runtime configuration.

## Chosen Approach

Implement an in-repo Node uploader that:

- refreshes Google OAuth access tokens using a stored refresh token
- uploads the video with the YouTube Data API
- returns a structured `{ videoId, url, studioUrl }` result directly

The current `publishVideo(...)` function remains the orchestration entrypoint, but its default implementation changes from a Python subprocess to the new Node uploader.

## Scope

This change covers the web runtime only:

- `src/core/publish/youtube.js`
- runtime config
- deployment docs
- focused tests

It does **not** migrate the legacy OpenClaw adapter in the same change.

## Authentication Model

The server runtime should accept these values from environment/runtime config:

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`

Optional:

- `YOUTUBE_CHANNEL_ID` later if we want explicit verification, but not required in phase 1

The upload flow becomes:

1. Refresh access token with Google OAuth token endpoint.
2. Call YouTube resumable upload init endpoint.
3. Upload the binary video file.
4. Return canonical result links.

## Why This Approach

### Alternative 1: Move the Python helper into this repo

Pros:
- smaller behavior change

Cons:
- still requires Python
- still uses a subprocess boundary
- still not clean for cloud deployment

Rejected because it preserves the deployment problem.

### Alternative 2: Node uploader with refresh token

Pros:
- fits the current Next.js/Node runtime
- standard cloud deployment pattern
- easier error handling and retries
- easier secret management via env vars

Cons:
- requires rewriting the upload logic

Chosen because it is the correct long-term architecture.

## Architecture

### New module

Add:

- `src/core/publish/youtube-oauth.js`

Responsibilities:

- refresh access token
- initialize resumable upload
- upload file bytes
- parse YouTube response
- return structured metadata

### Existing module update

Update:

- `src/core/publish/youtube.js`

Behavior:

- keep `buildYoutubeMetadata(...)`
- keep `publishVideo(...)` as public API
- preserve `runtimeConfig.youtubeUploadImpl` override for tests
- replace default subprocess call with the new Node uploader

## Error Handling

Normalize these failure classes:

- `missing_youtube_oauth_credentials`
- `youtube_token_refresh_failed`
- `youtube_upload_init_failed`
- `youtube_upload_failed`
- `youtube_publish_parse_failed`

The existing `runJob` behavior should stay the same:

- publish failure should not fail the core media job
- instead, store `errorCode` / `errorMessage` while leaving the final video completed

## Testing

Add focused coverage for:

- metadata defaults remain unchanged
- missing OAuth credentials fail fast
- token refresh request is formed correctly
- upload init + upload success returns `videoId`, `url`, `studioUrl`
- `publishVideo(...)` continues to support injected uploader overrides
- `runJob` still records publish failures separately

## Deployment Impact

After this change, web deployment no longer requires:

- OpenClaw `youtube-publisher`
- Python
- host-local YouTube helper files

Instead it requires:

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`

This is the correct shape for VPS/GCP deployment.
