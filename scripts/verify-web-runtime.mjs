import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

import {
  DEFAULT_VFX_ASSET_ROOT,
  listVfxAssets,
  resolveVfxAssetRoot,
  resolveVfxAssetSampleFrame
} from "../src/core/media/vfx-assets.js";

async function checkWritableDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
  const markerPath = path.join(
    directoryPath,
    `.web-runtime-check-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  await fs.writeFile(markerPath, "ok", "utf8");
  await fs.unlink(markerPath);
}

async function main() {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const assetRoot = resolveVfxAssetRoot(process.env.VFX_ASSET_ROOT || DEFAULT_VFX_ASSET_ROOT);

  const missingEnv = [
    "GEMINI_API_KEY",
    "MUSICGPT_API_KEY",
    "ELEVENLABS_API_KEY",
    "RUNWAY_API_KEY"
  ].filter((name) => !String(process.env[name] || "").trim());

  await fs.access(assetRoot);

  const assets = listVfxAssets();
  for (const asset of assets) {
    const sampleFrame = resolveVfxAssetSampleFrame(asset.id, {
      rootDir: assetRoot
    });
    await fs.access(sampleFrame);
  }

  await checkWritableDirectory(path.join(projectRoot, "jobs"));
  await checkWritableDirectory(path.join(projectRoot, "outputs"));

  const summary = {
    ok: true,
    assetRoot,
    assets: assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      family: asset.family,
      hasAlpha: asset.hasAlpha
    })),
    missingEnv
  };

  if (missingEnv.length > 0) {
    summary.warnings = missingEnv.map((name) => `${name} not set`);
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  const message = String(error?.message || error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
