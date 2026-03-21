import { createJobStore } from "../../../src/core/jobs/job-store.js";
import { createJobsApiHandlers } from "../../../src/core/jobs/web-api.js";
import {
  getDefaultRainOverlayAsset,
  resolveVfxAssetPattern,
  resolveVfxAssetRoot
} from "../../../src/core/media/vfx-assets.js";

const store = createJobStore();
const defaultRainAsset = getDefaultRainOverlayAsset();
const vfxAssetRoot = resolveVfxAssetRoot(process.env.VFX_ASSET_ROOT);
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
      resolveVfxAssetPattern(defaultRainAsset.id, { rootDir: vfxAssetRoot }),
    rainVfxAssetId: defaultRainAsset.id,
    rainVfxStartNumber: Number(process.env.RAIN_VFX_START_NUMBER || defaultRainAsset.startNumber || 1001),
    rainVfxOverlayOpacity: Number(
      process.env.RAIN_VFX_OVERLAY_OPACITY || defaultRainAsset.recommendedOpacity || 0.95
    )
  }
});

export async function GET(request: Request) {
  return api.get(request);
}

export async function POST(request: Request) {
  return api.post(request);
}
