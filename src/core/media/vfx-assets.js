import path from "path";

const DEFAULT_VFX_ASSET_ROOT = path.join(process.cwd(), "assets", "vfx");

const VFX_ASSET_REGISTRY = Object.freeze({
  "rain-on-glass-004": Object.freeze({
    id: "rain-on-glass-004",
    name: "RainOnGlass-004",
    type: "overlay-sequence",
    family: "rain",
    tags: Object.freeze(["rain", "glass", "window", "overlay", "front-layer"]),
    directory: "RainOnGlass-004",
    framePattern: "RainOnGlass-004.%04d.exr",
    startNumber: 1001,
    fps: 25,
    hasAlpha: true,
    recommendedOpacity: 0.95,
    preferredMotionPreset: "rain",
    notes: "Bundled rain-on-glass overlay for rain scenes and front-layer window motion."
  }),
  "rain-022": Object.freeze({
    id: "rain-022",
    name: "Rain-022",
    type: "overlay-sequence",
    family: "rain",
    tags: Object.freeze(["rain", "overlay", "weather", "background"]),
    directory: "Rain-022",
    framePattern: "Rain-022.%04d.exr",
    startNumber: 1001,
    fps: 25,
    hasAlpha: false,
    recommendedOpacity: 0.85,
    preferredMotionPreset: "rain",
    notes: "Bundled fallback rain overlay for black-screen or screen-key compositing."
  })
});

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function resolveAssetRoot(rootDir = process.env.VFX_ASSET_ROOT || DEFAULT_VFX_ASSET_ROOT) {
  return path.resolve(String(rootDir || DEFAULT_VFX_ASSET_ROOT));
}

export function listVfxAssets() {
  return Object.values(VFX_ASSET_REGISTRY);
}

export function getVfxAsset(assetId) {
  const key = normalizeText(assetId);
  if (!key) {
    return null;
  }
  return VFX_ASSET_REGISTRY[key] || null;
}

export function resolveVfxAssetRoot(rootDir = process.env.VFX_ASSET_ROOT || DEFAULT_VFX_ASSET_ROOT) {
  return resolveAssetRoot(rootDir);
}

export function resolveVfxAssetPattern(assetId, { rootDir } = {}) {
  const asset = getVfxAsset(assetId);
  if (!asset) {
    throw new Error(`unknown_vfx_asset:${assetId}`);
  }
  const assetRoot = resolveVfxAssetRoot(rootDir);
  return path.join(assetRoot, asset.directory, asset.framePattern);
}

export function resolveVfxAssetSampleFrame(assetId, { rootDir } = {}) {
  const asset = getVfxAsset(assetId);
  if (!asset) {
    throw new Error(`unknown_vfx_asset:${assetId}`);
  }
  return resolveVfxAssetPattern(assetId, {
    rootDir
  }).replace(
    "%04d",
    String(asset.startNumber).padStart(4, "0")
  );
}

export function resolveVfxAssetForMotionPreset(preset) {
  const normalizedPreset = normalizeText(preset);
  if (normalizedPreset === "rain") {
    return getVfxAsset("rain-on-glass-004");
  }
  return null;
}

export function getDefaultRainOverlayAsset() {
  return getVfxAsset("rain-on-glass-004");
}

export { DEFAULT_VFX_ASSET_ROOT, VFX_ASSET_REGISTRY };
