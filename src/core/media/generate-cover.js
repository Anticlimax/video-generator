import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

import { createJobWorkspace } from "../../lib/jobs.js";
import { generateGeminiImage } from "./gemini-image.js";

const TARGET_WIDTH = 1280;
const TARGET_HEIGHT = 720;
const TARGET_ASPECT = TARGET_WIDTH / TARGET_HEIGHT;
const ASPECT_EPSILON = 0.01;

export function buildCoverPrompt({ theme, style, resolvedTheme }) {
  const parts = [
    "Cinematic ambient background for a long-form relaxation video.",
    "Low stimulation, soft lighting, no text, no close-up people, no strong action.",
    "Composition suitable for a long static video frame.",
    "16:9 aspect ratio."
  ];

  if (theme) {
    parts.push(`Theme: ${theme}.`);
  } else if (resolvedTheme?.label) {
    parts.push(`Theme family: ${resolvedTheme.label}.`);
  }

  if (style) {
    parts.push(`Style: ${style}.`);
  }

  if (resolvedTheme?.description) {
    parts.push(`Mood guide: ${resolvedTheme.description}`);
  }

  return parts.join(" ");
}

async function runDefaultCoverGenerator({
  outputPath,
  prompt,
  runtimeConfig = {},
  geminiClientFactory,
  geminiRequestImpl
}) {
  return generateGeminiImage({
    apiKey: runtimeConfig.geminiApiKey,
    prompt,
    outputPath,
    model: runtimeConfig.geminiImagePrimaryModel,
    fallbackModel: runtimeConfig.geminiImageFallbackModel,
    timeoutMs: Number(runtimeConfig.coverGenerationAttemptTimeoutMs || 120000),
    totalTimeoutMs: Number(runtimeConfig.coverGenerationTimeoutMs || 0),
    maxAttemptsPerModel: Number(runtimeConfig.geminiImageMaxAttempts || 3),
    clientFactory: geminiClientFactory,
    requestImpl: geminiRequestImpl
  });
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}\n${stderr}`));
    });
  });
}

async function probeImage(filePath) {
  const outputChunks = [];
  await new Promise((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=width,height",
        "-of",
        "json",
        filePath
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let stderr = "";
    child.stdout.on("data", (chunk) => outputChunks.push(String(chunk)));
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffprobe exited with code ${code}\n${stderr}`));
    });
  });

  const probe = JSON.parse(outputChunks.join(""));
  return {
    width: Number(probe?.streams?.[0]?.width || 0),
    height: Number(probe?.streams?.[0]?.height || 0)
  };
}

function needsAspectNormalization({ width, height }) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return false;
  }

  return Math.abs(width / height - TARGET_ASPECT) > ASPECT_EPSILON;
}

async function normalizeImageAspect({
  imagePath,
  runCommandImpl = runCommand,
  probeImageImpl = probeImage
} = {}) {
  const dimensions = await probeImageImpl(imagePath);
  if (!needsAspectNormalization(dimensions)) {
    return {
      imagePath,
      normalized: false,
      width: dimensions.width,
      height: dimensions.height
    };
  }

  const normalizedPath = path.join(
    path.dirname(imagePath),
    `${path.basename(imagePath, path.extname(imagePath))}.normalized${path.extname(imagePath)}`
  );

  await runCommandImpl("ffmpeg", [
    "-y",
    "-i",
    String(imagePath),
    "-vf",
    `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=increase,crop=${TARGET_WIDTH}:${TARGET_HEIGHT},format=rgb24`,
    normalizedPath
  ]);
  await fs.rename(normalizedPath, imagePath);

  return {
    imagePath,
    normalized: true,
    width: TARGET_WIDTH,
    height: TARGET_HEIGHT
  };
}

export async function generateCover({
  rootDir = "jobs",
  jobDir,
  artifactPaths = {},
  now,
  randomSuffix,
  theme = "",
  style = "",
  resolvedTheme = null,
  prompt = "",
  runtimeConfig = {},
  coverGeneratorImpl,
  geminiClientFactory,
  geminiRequestImpl,
  runCommandImpl,
  probeImageImpl
} = {}) {
  const resolvedNow = typeof now === "function" ? now() : now || new Date();
  const job = await createJobWorkspace({
    rootDir,
    jobDir,
    now: resolvedNow,
    randomSuffix
  });
  const imagePath =
    String(artifactPaths.imagePath || "").trim() || path.join(job.jobDir, "cover_image.png");
  const resolvedPrompt =
    String(prompt || "").trim() ||
    buildCoverPrompt({
      theme: String(theme || "").trim(),
      style: String(style || "").trim(),
      resolvedTheme
    });

  const generator = coverGeneratorImpl
    ? coverGeneratorImpl
    : (input) =>
        runDefaultCoverGenerator({
          ...input,
          runtimeConfig,
          geminiClientFactory,
          geminiRequestImpl
        });

  const coverResult = await generator({
    outputPath: imagePath,
    prompt: resolvedPrompt
  });

  await fs.mkdir(path.dirname(coverResult.imagePath), { recursive: true });
  await normalizeImageAspect({
    imagePath: coverResult.imagePath,
    runCommandImpl,
    probeImageImpl
  });

  return {
    ok: true,
    jobId: job.jobId,
    jobDir: job.jobDir,
    themeId: resolvedTheme?.id || null,
    themeVersion: resolvedTheme?.version || null,
    imagePath: coverResult.imagePath,
    prompt: coverResult.prompt || resolvedPrompt,
    provider: coverResult.provider,
    model: coverResult.model || null,
    attemptCount: coverResult.attemptCount ?? null,
    fallbackUsed: coverResult.fallbackUsed ?? null
  };
}
