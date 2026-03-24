import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { createJobWorkspace } from "../../lib/jobs.js";

const NANO_BANANA_SCRIPT_PATH = path.join(
  process.env.HOME || "",
  ".nvm/versions/node/v22.20.0/lib/node_modules/openclaw/skills/nano-banana-pro/scripts/generate_image.py"
);

function runCommand(command, args, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 0);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    let settled = false;
    let timeoutId = null;

    function finish(callback) {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      callback();
    }

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
        finish(() => reject(new Error("cover_generation_timeout")));
      }, timeoutMs);
    }

    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      if (code === 0) {
        finish(() => resolve());
        return;
      }
      finish(() => reject(new Error(`${command} exited with code ${code}\n${stderr}`)));
    });
  });
}

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

  await runCommandImpl("uv", args, {
    timeoutMs: Number(runtimeConfig.coverGenerationTimeoutMs || 60000)
  });

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

  const coverResult = await withTimeout(
    generator({
      outputPath: imagePath,
      prompt: resolvedPrompt
    }),
    Number(runtimeConfig.coverGenerationTimeoutMs || 60000)
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
