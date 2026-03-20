# Runway Micro-Motion Video Design

## Goal

Add an optional "micro-motion video" path to the web app so a generated video image can be animated into a short subtle motion clip using Runway image-to-video. The resulting short clip is then looped to fill the target video duration.

This should preserve the current workflow:
- music generation
- video image generation
- optional separate cover generation
- final long-form video render

## Scope

### In scope

- Add a job-level toggle to enable Runway micro-motion video generation
- Generate a short motion clip from the existing `videoImagePath`
- Use the motion clip as the visual source for final rendering instead of a static image when available
- Keep cover generation behavior unchanged
- Read Runway API key from web runtime environment

### Out of scope

- Replacing the existing image generation path
- Complex prompt editing UI for Runway-specific prompt tuning
- Motion preview before full job submission
- Multi-provider motion generation abstraction beyond the minimum needed for Runway

## User Experience

### Job form

Add a checkbox:
- `生成微动视频`

When enabled:
- the app will animate the generated video image through Runway
- the motion clip is short and subtle
- the final long video loops that clip

The existing cover flow stays the same:
- if `单独生成封面图` is off, cover reuses the video image
- if `单独生成封面图` is on, cover is generated separately

### Job detail

Show a new artifact when available:
- `微动视频`

If the job used micro-motion:
- final video preview reflects the motion-backed render
- detail page can expose the short motion clip separately for debugging and review

## Architecture

## Core additions

Add a new media service:
- `src/core/media/generate-motion-video.js`

Responsibilities:
- accept an existing image path
- upload or submit it to Runway image-to-video
- poll task completion
- download the resulting short motion clip
- normalize output into the job artifact directory

Inputs:
- `imagePath`
- `prompt`
- `durationSec` with a constrained short range, default `5`
- `runtimeConfig.runwayApiKey`
- optional `model`, default `gen4_turbo`

Outputs:
- `motionVideoPath`
- `provider`
- `taskId`

## Render integration

Extend `renderVideo` to accept:
- `motionVideoPath`

Behavior:
- if `motionVideoPath` exists, loop that video clip to target duration
- otherwise preserve existing behavior:
  - static image render if `imagePath` exists
  - procedural template fallback otherwise

## Job pipeline integration

Extend job flow in `runJob`:

1. Generate music
2. Generate video image
3. If `generateMotionVideo=true` and `videoImagePath` exists:
   - generate micro-motion clip
4. Optionally generate separate cover
5. Render final video using:
   - `motionVideoPath` if present
   - else `videoImagePath`
   - else template fallback

## Data model changes

Add fields to job record:
- `generateMotionVideo`
- `motionVideoPath`

Optional future fields:
- `motionPrompt`
- `motionProvider`

For the first version, reuse the video visual prompt as the Runway prompt seed.

## Prompt strategy

Default Runway prompt should be tightly constrained for subtle motion:

- keep the camera locked
- preserve original composition
- only subtle environmental motion
- no scene transformation
- no subject deformation
- loop-friendly, calm atmospheric movement

If the user provided a `videoVisualPrompt`, append a motion suffix instead of replacing it entirely.

## Runtime config

Web runtime should support:
- `RUNWAY_API_KEY`

Resolved into the existing core runtime config as:
- `runwayApiKey`

## Failure handling

If Runway motion generation fails:
- record the failure internally
- do not fail the whole job
- continue with the existing static-image render path

This keeps the current MVP reliable even when Runway is unavailable or rate-limited.

## Testing

Add tests for:
- job input parsing with `generateMotionVideo`
- job record persistence of `generateMotionVideo` and `motionVideoPath`
- `runJob` calling motion generation only when enabled and video image exists
- `renderVideo` preferring `motionVideoPath` over `imagePath`
- graceful fallback when Runway fails

## Recommendation

Implement this as a narrow optional provider path. Do not generalize motion providers yet. Keep the integration small, job-scoped, and failure-tolerant.
