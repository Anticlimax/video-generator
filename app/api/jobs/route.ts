import path from "node:path";

import { createJobStore } from "../../../src/core/jobs/job-store.js";
import { createJobsApiHandlers } from "../../../src/core/jobs/web-api.js";

const store = createJobStore();
const api = createJobsApiHandlers({
  store,
  runtimeConfig: {
    geminiApiKey: process.env.GEMINI_API_KEY,
    musicGptApiKey: process.env.MUSICGPT_API_KEY,
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
    runwayApiKey: process.env.RUNWAY_API_KEY,
    motionClipDurationSec: Number(process.env.MOTION_CLIP_DURATION_SEC || 5),
    rainVfxOverlayPattern:
      process.env.RAIN_VFX_OVERLAY_PATTERN ||
      path.join(process.cwd(), "assets", "vfx", "RainOnGlass-004", "RainOnGlass-004.%04d.exr"),
    rainVfxStartNumber: Number(process.env.RAIN_VFX_START_NUMBER || 1001),
    rainVfxOverlayOpacity: Number(process.env.RAIN_VFX_OVERLAY_OPACITY || 0.95)
  }
});

export async function GET(request: Request) {
  return api.get(request);
}

export async function POST(request: Request) {
  return api.post(request);
}
