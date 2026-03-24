import test from "node:test";
import assert from "node:assert/strict";

import { resolveRuntimeConfig } from "../../src/core/config/runtime-config.js";

test("resolveRuntimeConfig maps env into runtime config", () => {
  const config = resolveRuntimeConfig({
    GEMINI_API_KEY: "gem-key",
    MUSICGPT_API_KEY: "music-key",
    ELEVENLABS_API_KEY: "el-key",
    RUNWAY_API_KEY: "run-key",
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
  assert.equal(config.motionClipDurationSec, 8);
  assert.equal(config.coverGenerationTimeoutMs, 15000);
  assert.equal(config.rainVfxOverlayPattern, "/tmp/rain.%04d.exr");
  assert.equal(config.rainVfxStartNumber, 1005);
  assert.equal(config.rainVfxOverlayOpacity, 0.72);
});
