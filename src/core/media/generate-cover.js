import fs from "node:fs/promises";
import path from "node:path";

import { createJobWorkspace } from "../../lib/jobs.js";
import { generateGeminiImage } from "./gemini-image.js";

function withTimeout(promise, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("cover_generation_timeout"));
    }, timeoutMs);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

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
    timeoutMs: Number(runtimeConfig.coverGenerationTimeoutMs || 120000),
    clientFactory: geminiClientFactory,
    requestImpl: geminiRequestImpl
  });
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
  geminiRequestImpl
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

  const coverResult = await withTimeout(
    generator({
      outputPath: imagePath,
      prompt: resolvedPrompt
    }),
    Number(runtimeConfig.coverGenerationTimeoutMs || 120000)
  );

  await fs.mkdir(path.dirname(coverResult.imagePath), { recursive: true });

  return {
    ok: true,
    jobId: job.jobId,
    jobDir: job.jobDir,
    themeId: resolvedTheme?.id || null,
    themeVersion: resolvedTheme?.version || null,
    imagePath: coverResult.imagePath,
    prompt: coverResult.prompt || resolvedPrompt,
    provider: coverResult.provider
  };
}
