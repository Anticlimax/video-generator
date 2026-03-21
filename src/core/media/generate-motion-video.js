import fs from "node:fs/promises";
import path from "node:path";

import { createJobWorkspace } from "../../lib/jobs.js";
import { buildMotionPresetPrompt, resolveMotionPresets } from "./motion-presets.js";

const RUNWAY_API_BASE_URL = "https://api.dev.runwayml.com/v1";
const RUNWAY_API_VERSION = "2024-11-06";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function extToMime(filePath) {
  const extension = path.extname(String(filePath || "")).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  return "image/png";
}

async function fileToDataUri(filePath) {
  const bytes = await fs.readFile(filePath);
  const mime = extToMime(filePath);
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function fetchJson(fetchImpl, url, options, timeoutMs, timeoutLabel) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(new Error(timeoutLabel)), Math.max(1, Number(timeoutMs) || 0))
    : null;

  try {
    const response = await fetchImpl(url, {
      ...options,
      signal: controller?.signal
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message = normalizeText(payload?.message || payload?.error || timeoutLabel);
      throw new Error(message || timeoutLabel);
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError" || error?.message === timeoutLabel) {
      throw new Error(timeoutLabel);
    }
    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function buildRunwayMotionPrompt({ theme = "", style = "", videoVisualPrompt = "", resolvedTheme = null } = {}) {
  const themeText = normalizeText(theme) || normalizeText(resolvedTheme?.label);
  const styleText = normalizeText(style) || normalizeText(resolvedTheme?.description);
  const presets = resolveMotionPresets({
    theme: themeText,
    style: styleText,
    videoVisualPrompt
  });

  return buildMotionPresetPrompt({
    theme: themeText,
    style: styleText,
    videoVisualPrompt,
    primaryPreset: presets.primaryPreset,
    secondaryPreset: presets.secondaryPreset
  });
}

async function createRunwayTask({
  apiKey,
  imagePath,
  promptText,
  durationSec,
  model = "gen4_turbo",
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = 60000
} = {}) {
  if (!apiKey) {
    throw new Error("runway_api_key_missing");
  }

  const payload = {
    model,
    promptText,
    promptImage: await fileToDataUri(imagePath),
    duration: durationSec,
    ratio: "1280:720"
  };

  return fetchJson(
    fetchImpl,
    `${RUNWAY_API_BASE_URL}/image_to_video`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": RUNWAY_API_VERSION
      },
      body: JSON.stringify(payload)
    },
    requestTimeoutMs,
    "runway_create_timeout"
  );
}

async function retrieveRunwayTask({
  apiKey,
  taskId,
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = 60000
} = {}) {
  return fetchJson(
    fetchImpl,
    `${RUNWAY_API_BASE_URL}/tasks/${taskId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": RUNWAY_API_VERSION
      }
    },
    requestTimeoutMs,
    "runway_task_timeout"
  );
}

async function downloadRunwayOutput({
  apiKey,
  outputUrl,
  outputPath,
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = 60000
} = {}) {
  const response = await fetchJson(
    fetchImpl,
    outputUrl,
    {
      method: "GET"
    },
    requestTimeoutMs,
    "runway_download_timeout"
  );

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  if (typeof response === "string") {
    await fs.writeFile(outputPath, response);
    return outputPath;
  }
  return outputPath;
}

function normalizeTaskId(payload) {
  return normalizeText(payload?.id || payload?.taskId || payload?.task_id);
}

function normalizeTaskStatus(payload) {
  return normalizeText(payload?.status).toUpperCase();
}

function normalizeTaskOutput(payload) {
  const output = payload?.output;
  if (Array.isArray(output) && output.length > 0) {
    return normalizeText(output[0]);
  }
  if (typeof output === "string") {
    return normalizeText(output);
  }
  return "";
}

export async function generateMotionVideo({
  rootDir = "jobs",
  jobDir,
  artifactPaths = {},
  now,
  randomSuffix,
  imagePath,
  theme = "",
  style = "",
  videoVisualPrompt = "",
  resolvedTheme = null,
  durationSec = 5,
  model = "gen4_turbo",
  runtimeConfig = {},
  fetchImpl = globalThis.fetch,
  sleepImpl = sleep
} = {}) {
  const resolvedNow = typeof now === "function" ? now() : now || new Date();
  const job = await createJobWorkspace({
    rootDir,
    jobDir,
    now: resolvedNow,
    randomSuffix
  });
  const motionVideoPath =
    String(artifactPaths.motionVideoPath || "").trim() || path.join(job.jobDir, "motion_video.mp4");
  const promptText = buildRunwayMotionPrompt({
    theme,
    style,
    videoVisualPrompt,
    resolvedTheme
  });
  const requestTimeoutMs = Number(runtimeConfig.runwayRequestTimeoutMs || 60000);
  const pollDelayMs = Number(runtimeConfig.runwayPollDelayMs || 5000);
  const apiKey = runtimeConfig.runwayApiKey;

  const start = await createRunwayTask({
    apiKey,
    imagePath,
    promptText,
    durationSec,
    model,
    fetchImpl,
    requestTimeoutMs
  });

  const taskId = normalizeTaskId(start);
  if (!taskId) {
    throw new Error("runway_task_id_missing");
  }

  let task = null;
  for (let attempt = 0; attempt < 72; attempt += 1) {
    task = await retrieveRunwayTask({
      apiKey,
      taskId,
      fetchImpl,
      requestTimeoutMs
    });
    const status = normalizeTaskStatus(task);
    if (status === "SUCCEEDED") {
      const outputUrl = normalizeTaskOutput(task);
      if (!outputUrl) {
        throw new Error("runway_output_missing");
      }
      await fs.mkdir(path.dirname(motionVideoPath), { recursive: true });
      const response = await fetchImpl(outputUrl);
      if (!response.ok) {
        throw new Error("runway_download_failed");
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(motionVideoPath, bytes);
      return {
        ok: true,
        jobId: job.jobId,
        jobDir: job.jobDir,
        motionVideoPath,
        provider: "runway",
        taskId,
        prompt: promptText
      };
    }
    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(
        normalizeText(task?.failureCode || task?.failure?.code || task?.failureCode || "runway_task_failed")
      );
    }
    await sleepImpl(pollDelayMs);
  }

  throw new Error("runway_motion_timeout");
}

export { buildRunwayMotionPrompt };
