import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ambient-add-vfx-"));
}

function runNodeScript(scriptPath, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      env: {
        ...process.env,
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("close", (code) => {
      resolve({
        code,
        stdout,
        stderr
      });
    });
  });
}

test("add-vfx-asset script scaffolds a new asset directory and registry entry", async () => {
  const rootDir = makeTempDir();
  const assetRoot = path.join(rootDir, "assets", "vfx");
  const registryPath = path.join(rootDir, "vfx-assets.js");
  const scriptPath = path.resolve("scripts/add-vfx-asset.mjs");

  await fsp.mkdir(assetRoot, { recursive: true });
  await fsp.writeFile(
    registryPath,
    [
      'import path from "node:path";',
      "",
      "const DEFAULT_VFX_ASSET_ROOT = path.join(process.cwd(), \"assets\", \"vfx\");",
      "",
      "const VFX_ASSET_REGISTRY = Object.freeze({",
      '  "rain-on-glass-004": Object.freeze({',
      '    id: "rain-on-glass-004",',
      '    directory: "RainOnGlass-004",',
      '    framePattern: "RainOnGlass-004.%04d.exr",',
      "    startNumber: 1001,",
      "    fps: 25,",
      "    hasAlpha: true,",
      "    recommendedOpacity: 0.95,",
      '    preferredMotionPreset: "rain"',
      "  })",
      "});",
      "",
      "export { DEFAULT_VFX_ASSET_ROOT, VFX_ASSET_REGISTRY };",
      ""
    ].join("\n"),
    "utf8"
  );

  const result = await runNodeScript(
    scriptPath,
    [
      "--id",
      "fog-layer-003",
      "--directory",
      "FogLayer-003",
      "--frame-pattern",
      "FogLayer-003.%04d.exr",
      "--start-number",
      "1001",
      "--fps",
      "25",
      "--family",
      "fog",
      "--has-alpha",
      "true",
      "--recommended-opacity",
      "0.72",
      "--preferred-motion-preset",
      "fog"
    ],
    {
      VFX_ASSET_ROOT: assetRoot,
      VFX_REGISTRY_FILE: registryPath
    }
  );

  assert.equal(result.code, 0, result.stderr);

  const assetDirectory = path.join(assetRoot, "FogLayer-003");
  const readmePath = path.join(assetDirectory, "README.md");
  assert.equal(fs.existsSync(assetDirectory), true);
  assert.equal(fs.existsSync(readmePath), true);

  const readme = await fsp.readFile(readmePath, "utf8");
  assert.match(readme, /fog-layer-003/i);
  assert.match(readme, /FogLayer-003.%04d.exr/i);

  const registrySource = await fsp.readFile(registryPath, "utf8");
  assert.match(registrySource, /"fog-layer-003": Object\.freeze/);
  assert.match(registrySource, /directory: "FogLayer-003"/);
  assert.match(registrySource, /framePattern: "FogLayer-003.%04d.exr"/);
  assert.match(registrySource, /preferredMotionPreset: "fog"/);
});

test("add-vfx-asset script fails when the asset id already exists", async () => {
  const rootDir = makeTempDir();
  const assetRoot = path.join(rootDir, "assets", "vfx");
  const registryPath = path.join(rootDir, "vfx-assets.js");
  const scriptPath = path.resolve("scripts/add-vfx-asset.mjs");

  await fsp.mkdir(assetRoot, { recursive: true });
  await fsp.writeFile(
    registryPath,
    [
      "const VFX_ASSET_REGISTRY = Object.freeze({",
      '  "rain-on-glass-004": Object.freeze({',
      '    id: "rain-on-glass-004"',
      "  })",
      "});",
      ""
    ].join("\n"),
    "utf8"
  );

  const result = await runNodeScript(
    scriptPath,
    [
      "--id",
      "rain-on-glass-004",
      "--directory",
      "RainOnGlass-004",
      "--frame-pattern",
      "RainOnGlass-004.%04d.exr",
      "--start-number",
      "1001",
      "--fps",
      "25",
      "--family",
      "rain",
      "--has-alpha",
      "true",
      "--recommended-opacity",
      "0.95",
      "--preferred-motion-preset",
      "rain"
    ],
    {
      VFX_ASSET_ROOT: assetRoot,
      VFX_REGISTRY_FILE: registryPath
    }
  );

  assert.equal(result.code, 1);
  assert.match(result.stderr, /vfx_asset_exists/i);
});
