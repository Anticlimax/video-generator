import test from "node:test";
import assert from "node:assert/strict";

import { resolveRuntimeConfig } from "../../src/core/config/runtime-config.js";

test("resolveRuntimeConfig maps env into runtime config", () => {
  const config = resolveRuntimeConfig({
    GEMINI_API_KEY: "gem-key",
    MUSICGPT_API_KEY: "music-key",
    ELEVENLABS_API_KEY: "el-key",
    RUNWAY_API_KEY: "run-key",
    YOUTUBE_CLIENT_ID: "yt-client",
    YOUTUBE_CLIENT_SECRET: "yt-secret",
    YOUTUBE_REFRESH_TOKEN: "yt-refresh",
    GEMINI_IMAGE_PRIMARY_MODEL: "gemini-3-pro-image-preview",
    GEMINI_IMAGE_FALLBACK_MODEL: "gemini-2.5-flash-image-preview",
    GEMINI_IMAGE_MAX_ATTEMPTS: "4",
    MOTION_CLIP_DURATION_SEC: "8",
    COVER_GENERATION_TIMEOUT_MS: "15000",
    RAIN_VFX_OVERLAY_PATTERN: "/tmp/rain.%04d.exr",
    RAIN_VFX_START_NUMBER: "1005",
    RAIN_VFX_OVERLAY_OPACITY: "0.72"
  });

  assert.equal(config.geminiApiKey, "gem-key");
  assert.equal(config.musicGptApiKey, "music-key");
  assert.equal(config.elevenLabsApiKey, "el-key");
  assert.equal(config.runwayApiKey, "run-key");
  assert.equal(config.youtubeClientId, "yt-client");
  assert.equal(config.youtubeClientSecret, "yt-secret");
  assert.equal(config.youtubeRefreshToken, "yt-refresh");
  assert.equal(config.geminiImagePrimaryModel, "gemini-3-pro-image-preview");
  assert.equal(config.geminiImageFallbackModel, "gemini-2.5-flash-image-preview");
  assert.equal(config.geminiImageMaxAttempts, 4);
  assert.equal(config.motionClipDurationSec, 8);
  assert.equal(config.coverGenerationTimeoutMs, 15000);
  assert.equal(config.rainVfxOverlayPattern, "/tmp/rain.%04d.exr");
  assert.equal(config.rainVfxStartNumber, 1005);
  assert.equal(config.rainVfxOverlayOpacity, 0.72);
});

test("resolveRuntimeConfig defaults cover generation timeout to 120000ms", () => {
  const config = resolveRuntimeConfig({});

  assert.equal(config.coverGenerationTimeoutMs, 120000);
  assert.equal(config.geminiImagePrimaryModel, "gemini-3-pro-image-preview");
  assert.equal(config.geminiImageFallbackModel, null);
  assert.equal(config.geminiImageMaxAttempts, 3);
});
