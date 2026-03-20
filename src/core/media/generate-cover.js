import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { createJobWorkspace } from "../../lib/jobs.js";

const NANO_BANANA_SCRIPT_PATH = path.join(
  process.env.HOME || "",
  ".nvm/versions/node/v22.20.0/lib/node_modules/openclaw/skills/nano-banana-pro/scripts/generate_image.py"
);

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
  runCommandImpl = runCommand
}) {
  const args = [
    "run",
    NANO_BANANA_SCRIPT_PATH,
    "--prompt",
    prompt,
    "--filename",
    outputPath,
    "--resolution",
    "1K",
    "--aspect-ratio",
    "16:9"
  ];

  if (runtimeConfig.geminiApiKey) {
    args.push("--api-key", String(runtimeConfig.geminiApiKey));
  }

  await runCommandImpl("uv", args);

  return {
    imagePath: outputPath,
    prompt,
    provider: "nano-banana-pro"
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
  runCommandImpl = runCommand,
  coverGeneratorImpl
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
    : (input) => runDefaultCoverGenerator({ ...input, runtimeConfig, runCommandImpl });

  const coverResult = await generator({
    outputPath: imagePath,
    prompt: resolvedPrompt
  });

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
