# Gemini Image Fallback Design

**Problem**

The web runtime still fails too often during image generation. Recent jobs show two concrete failure modes:

- Gemini returns `503 UNAVAILABLE` under load.
- The current provider only uses one SDK path and one model, so a single transient failure aborts the whole job.

The current implementation in `src/core/media/gemini-image.js` uses `client.models.generateContent(...)` with `gemini-3-pro-image-preview`. It does not retry `503`/`429`, does not try a secondary Gemini image model, and does not persist which image provider/model/attempt path was used.

**Goal**

Keep the web runtime on a pure Node.js Gemini integration, but make image generation materially more resilient:

- use the SDK's image-oriented `interactions.create(...)` path
- retry transient failures
- fall back to a secondary Gemini image model
- persist image generation metadata on the job

**Approaches**

## 1. Retry only

Keep the current provider shape, add retries for `503`, `429`, and timeout.

Pros:
- smallest code change
- no schema changes beyond attempt count if desired

Cons:
- still depends on one model
- still uses a less image-specific SDK path

## 2. Interactions API + retry + fixed model fallback

Switch to `ai.interactions.create(...)` with `response_modalities: ['image']`, retry transient failures, then fall back to a second Gemini image model in fixed priority order.

Pros:
- aligns with current SDK guidance for image output
- more resilient to model-specific load spikes
- deterministic and easy to debug

Cons:
- slightly larger change
- requires new job metadata fields

## 3. Cross-provider fallback now

Add a second non-Gemini image provider immediately.

Pros:
- strongest resilience

Cons:
- much larger surface area
- more credentials, more prompt normalization, more testing
- not necessary yet

**Recommendation**

Use approach 2 now. It is the smallest change that meaningfully improves reliability without reintroducing OpenClaw/Python coupling.

**Design**

## Provider flow

`generateGeminiImage(...)` will:

1. build a prioritized model list
2. call Gemini via `ai.interactions.create(...)`
3. retry transient failures per model
4. if the primary model still fails, try the secondary model
5. write the first successful image to disk
6. return both the file path and generation metadata

Transient failures:

- HTTP `503`
- HTTP `429`
- `cover_generation_timeout`

Retry policy:

- `3` attempts per model total
- exponential backoff with small fixed base delay
- no retry for non-transient API errors or `cover_generation_no_image`

## Model strategy

Runtime config will expose:

- `geminiImagePrimaryModel`
- `geminiImageFallbackModel`
- `geminiImageMaxAttempts`

Default behavior:

- primary model: current image preview model
- fallback model: optional second Gemini image model from env
- if no fallback model is configured, only primary runs

## Job metadata

Persist these fields on each job:

- `imageProvider`
- `imageModel`
- `imageAttemptCount`
- `imageFallbackUsed`

When the first image generation succeeds, `runJob(...)` writes the metadata. If it fails and no renderable source exists, the underlying image error is preserved as the final job error.

## Error handling

`generateGeminiImage(...)` should keep surfacing the most useful final error:

- if all attempts fail on transient API status codes, keep the last API error body/message
- if a timeout occurs on every attempt, surface `cover_generation_timeout`
- if Gemini returns no image, surface `cover_generation_no_image`

`runJob(...)` should continue to fail the job when no image or motion source exists, but now with richer metadata when image generation did succeed on a fallback path.

**Testing**

Add focused tests for:

- `interactions.create(...)` happy path writes an image
- `503` retries and eventually succeeds on the same model
- primary model exhaustion then secondary model success
- non-transient errors do not retry
- `runJob(...)` persists image metadata returned by the provider

**Out of Scope**

- cross-vendor image provider fallback
- schedule-specific image provider overrides
- image provider selection UI
