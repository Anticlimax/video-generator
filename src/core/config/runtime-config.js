import {
  getDefaultRainOverlayAsset,
  resolveVfxAssetPattern,
  resolveVfxAssetRoot
} from "../media/vfx-assets.js";

export function resolveRuntimeConfig(env = process.env) {
  const defaultRainAsset = getDefaultRainOverlayAsset();
  const vfxAssetRoot = resolveVfxAssetRoot(env.VFX_ASSET_ROOT);
  const geminiImageMaxAttempts = Number(env.GEMINI_IMAGE_MAX_ATTEMPTS || 3);
  const coverGenerationAttemptTimeoutMs = Number(env.COVER_GENERATION_ATTEMPT_TIMEOUT_MS || 120000);
  const configuredFallbackModel = env.GEMINI_IMAGE_FALLBACK_MODEL || null;
  const imageModelCount = configuredFallbackModel ? 2 : 1;
  const derivedCoverGenerationTimeoutMs =
    coverGenerationAttemptTimeoutMs * geminiImageMaxAttempts * imageModelCount;

  return {
    geminiApiKey: env.GEMINI_API_KEY,
    geminiImagePrimaryModel: env.GEMINI_IMAGE_PRIMARY_MODEL || "gemini-3-pro-image-preview",
    geminiImageFallbackModel: configuredFallbackModel,
    geminiImageMaxAttempts,
    musicGptApiKey: env.MUSICGPT_API_KEY,
    elevenLabsApiKey: env.ELEVENLABS_API_KEY,
    runwayApiKey: env.RUNWAY_API_KEY,
    youtubeClientId: env.YOUTUBE_CLIENT_ID,
    youtubeClientSecret: env.YOUTUBE_CLIENT_SECRET,
    youtubeRefreshToken: env.YOUTUBE_REFRESH_TOKEN,
    motionClipDurationSec: Number(env.MOTION_CLIP_DURATION_SEC || 5),
    coverGenerationAttemptTimeoutMs,
    coverGenerationTimeoutMs: Number(env.COVER_GENERATION_TIMEOUT_MS || derivedCoverGenerationTimeoutMs),
    rainVfxOverlayPattern:
      env.RAIN_VFX_OVERLAY_PATTERN ||
      resolveVfxAssetPattern(defaultRainAsset.id, { rootDir: vfxAssetRoot }),
    rainVfxAssetId: defaultRainAsset.id,
    rainVfxStartNumber: Number(env.RAIN_VFX_START_NUMBER || defaultRainAsset.startNumber || 1001),
    rainVfxOverlayOpacity: Number(
      env.RAIN_VFX_OVERLAY_OPACITY || defaultRainAsset.recommendedOpacity || 0.95
    )
  };
}
