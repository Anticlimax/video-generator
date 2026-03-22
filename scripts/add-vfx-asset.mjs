import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseBoolean(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  throw new Error("invalid_boolean");
}

function parseNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`invalid_${label}`);
  }
  return number;
}

function normalizeId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value == null) {
      throw new Error("invalid_arguments");
    }
    args[key.slice(2)] = value;
  }

  const id = normalizeId(args.id);
  if (!id) {
    throw new Error("missing_id");
  }

  const directory = String(args.directory || "").trim();
  const framePattern = String(args["frame-pattern"] || "").trim();
  const family = String(args.family || "").trim().toLowerCase();
  const preferredMotionPreset = String(args["preferred-motion-preset"] || "").trim().toLowerCase();

  if (!directory) {
    throw new Error("missing_directory");
  }
  if (!framePattern) {
    throw new Error("missing_frame_pattern");
  }
  if (!family) {
    throw new Error("missing_family");
  }
  if (!preferredMotionPreset) {
    throw new Error("missing_preferred_motion_preset");
  }

  return {
    id,
    directory,
    framePattern,
    startNumber: parseNumber(args["start-number"], "start_number"),
    fps: parseNumber(args.fps, "fps"),
    family,
    hasAlpha: parseBoolean(args["has-alpha"]),
    recommendedOpacity: parseNumber(args["recommended-opacity"], "recommended_opacity"),
    preferredMotionPreset,
    name: String(args.name || directory).trim() || directory,
    notes: String(args.notes || `TODO: describe ${id}`).trim(),
    tags: String(args.tags || family)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  };
}

function buildRegistryEntry(asset) {
  const tagList = asset.tags.map((tag) => `"${tag}"`).join(", ");
  return [
    `  "${asset.id}": Object.freeze({`,
    `    id: "${asset.id}",`,
    `    name: "${asset.name}",`,
    '    type: "overlay-sequence",',
    `    family: "${asset.family}",`,
    `    tags: Object.freeze([${tagList}]),`,
    `    directory: "${asset.directory}",`,
    `    framePattern: "${asset.framePattern}",`,
    `    startNumber: ${asset.startNumber},`,
    `    fps: ${asset.fps},`,
    `    hasAlpha: ${asset.hasAlpha},`,
    `    recommendedOpacity: ${asset.recommendedOpacity},`,
    `    preferredMotionPreset: "${asset.preferredMotionPreset}",`,
    `    notes: "${asset.notes.replace(/"/g, '\\"')}"`,
    "  })"
  ].join("\n");
}

function insertRegistryEntry(source, asset) {
  if (source.includes(`"${asset.id}": Object.freeze(`)) {
    throw new Error("vfx_asset_exists");
  }

  const marker = "const VFX_ASSET_REGISTRY = Object.freeze({";
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error("vfx_registry_marker_missing");
  }

  const closeIndex = source.indexOf("});", markerIndex);
  if (closeIndex < 0) {
    throw new Error("vfx_registry_close_missing");
  }

  const beforeClose = source.slice(0, closeIndex).trimEnd();
  const needsComma = !beforeClose.endsWith("{");
  const entry = buildRegistryEntry(asset);

  return `${beforeClose}${needsComma ? "," : ""}\n${entry}\n${source.slice(closeIndex)}`;
}

async function writeAssetReadme(assetRoot, asset) {
  const assetDir = path.join(assetRoot, asset.directory);
  await fs.mkdir(assetDir, { recursive: true });
  const readmePath = path.join(assetDir, "README.md");
  const readme = [
    `# ${asset.name}`,
    "",
    `- id: \`${asset.id}\``,
    `- family: \`${asset.family}\``,
    `- frame pattern: \`${asset.framePattern}\``,
    `- start number: \`${asset.startNumber}\``,
    `- fps: \`${asset.fps}\``,
    `- has alpha: \`${asset.hasAlpha}\``,
    `- recommended opacity: \`${asset.recommendedOpacity}\``,
    `- preferred motion preset: \`${asset.preferredMotionPreset}\``,
    "",
    "Put the source frames for this asset in this directory.",
    "Then run `./scripts/verify-web-runtime.sh` to confirm the runtime can resolve the sequence."
  ].join("\n");
  await fs.writeFile(readmePath, `${readme}\n`, "utf8");
}

async function main() {
  const asset = parseArgs(process.argv.slice(2));
  const assetRoot = path.resolve(process.env.VFX_ASSET_ROOT || path.join(process.cwd(), "assets", "vfx"));
  const registryPath = path.resolve(
    process.env.VFX_REGISTRY_FILE || path.join(process.cwd(), "src", "core", "media", "vfx-assets.js")
  );

  const registrySource = await fs.readFile(registryPath, "utf8");
  const updatedSource = insertRegistryEntry(registrySource, asset);

  await writeAssetReadme(assetRoot, asset);
  await fs.writeFile(registryPath, updatedSource, "utf8");

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        assetId: asset.id,
        assetRoot,
        assetDirectory: path.join(assetRoot, asset.directory),
        registryPath
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  fail(String(error?.message || error));
});
