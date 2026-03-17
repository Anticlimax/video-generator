import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { loadThemeRegistry, resolveTheme } from "../src/lib/theme-registry.js";
import { createJobWorkspace, writeManifest } from "../src/lib/jobs.js";
import {
  selectMasterDurationSec,
  validateTargetDurationSec
} from "../src/lib/duration-policy.js";
import { buildMusicPrompt } from "../src/lib/music-prompt.js";
import { resolveMusicProvider } from "../src/lib/music-provider.js";
import { buildRenderPlan } from "../src/lib/render-plan.js";
import { buildVideoLoopArgs } from "../src/lib/ffmpeg-commands.js";

const NANO_BANANA_SCRIPT_PATH = path.join(
  process.env.HOME || "",
  ".nvm/versions/node/v22.20.0/lib/node_modules/openclaw/skills/nano-banana-pro/scripts/generate_image.py"
);

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writePlaceholderFile(filePath, contents) {
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, contents, "utf8");
}

async function writeBinaryFile(filePath, contents) {
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, contents);
}

async function statSize(filePath) {
  const stats = await fs.stat(filePath);
  return stats.size;
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

async function probeMedia(filePath) {
  const outputChunks = [];
  await new Promise((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type",
        "-show_entries",
        "format=duration,size",
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

  return JSON.parse(outputChunks.join(""));
}

function toolResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ],
    data
  };
}

const ambientMusicBuildInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    theme_id: { type: "string" },
    duration_target_sec: { type: "number" },
    master_duration_sec: { type: "number" },
    allow_nonstandard_duration: { type: "boolean" },
    seed: { type: "string" },
    mode: { type: "string", enum: ["mock", "elevenlabs", "infsh"] }
  },
  required: ["theme_id"]
};

const ambientMediaRenderInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    master_audio_path: { type: "string" },
    image_path: { type: "string" },
    duration_target_sec: { type: "number" },
    video_template_id: { type: "string" },
    output_name: { type: "string" }
  },
  required: ["master_audio_path", "duration_target_sec"]
};

const ambientVideoGenerateInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    theme_id: { type: "string" },
    theme: { type: "string" },
    style: { type: "string" },
    duration_target_sec: { type: "number" },
    master_duration_sec: { type: "number" },
    allow_nonstandard_duration: { type: "boolean" },
    seed: { type: "string" },
    mode: { type: "string", enum: ["mock", "elevenlabs", "infsh"] },
    video_template_id: { type: "string" },
    output_name: { type: "string" }
  },
};

const ambientCoverGenerateInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    theme_id: { type: "string" },
    theme: { type: "string" },
    style: { type: "string" },
    output_name: { type: "string" }
  }
};

function resolveTargetDurationSec(theme, args) {
  const requestedDurationSec = Number(args?.duration_target_sec || theme.default_duration_sec || 0);
  if (args?.allow_nonstandard_duration) {
    return requestedDurationSec;
  }
  return validateTargetDurationSec(theme, requestedDurationSec);
}

function resolveThemeFromArgs(registry, args) {
  const themeId = String(args?.theme_id || "").trim();
  if (themeId) {
    const theme = registry.get(themeId);
    if (!theme) {
      throw new Error("theme_not_found");
    }
    return theme;
  }

  return resolveTheme(registry, {
    theme: args?.theme,
    style: args?.style
  });
}

function buildCoverPrompt({ theme, style, resolvedTheme }) {
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

async function runCoverGenerator(api, { outputPath, prompt }) {
  if (typeof api?.config?.coverGeneratorImpl === "function") {
    return api.config.coverGeneratorImpl({ outputPath, prompt });
  }

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

  if (api?.config?.geminiApiKey) {
    args.push("--api-key", String(api.config.geminiApiKey));
  }

  await runCommand("uv", args);

  return {
    imagePath: outputPath,
    prompt,
    provider: "nano-banana-pro"
  };
}

async function runAmbientCoverGenerate(api, args) {
  const registry = await loadThemeRegistry();
  const resolvedTheme = resolveThemeFromArgs(registry, args);
  const job = await createJobWorkspace();
  const imagePath = path.join(job.jobDir, "cover_image.png");
  const outputName = String(args?.output_name || "").trim();
  const prompt = buildCoverPrompt({
    theme: String(args?.theme || "").trim(),
    style: String(args?.style || "").trim(),
    resolvedTheme
  });

  const coverResult = await runCoverGenerator(api, {
    outputPath: imagePath,
    prompt,
    outputName
  });

  await writeManifest(job, {
    ok: true,
    stage: "ambient_cover_generate",
    themeId: resolvedTheme.id,
    themeVersion: resolvedTheme.version,
    prompt,
    provider: coverResult.provider
  });

  return toolResult({
    ok: true,
    job_id: job.jobId,
    theme_id: resolvedTheme.id,
    theme_version: resolvedTheme.version,
    image_path: coverResult.imagePath,
    prompt: coverResult.prompt,
    provider: coverResult.provider
  });
}

async function runAmbientMusicBuild(api, args) {
  const registry = await loadThemeRegistry();
  const theme = resolveThemeFromArgs(registry, args);

  const provider = resolveMusicProvider({
    mode: args?.mode || api?.config?.mode || "mock",
    infshAppId: api?.config?.infshAppId,
    elevenLabsApiKey: api?.config?.elevenLabsApiKey
  });
  const job = await createJobWorkspace();
  const prompt = buildMusicPrompt({
    themeId: theme.id,
    promptSeed: theme.prompt_seed
  });

  const normalized = await provider.normalizeResult({
    path: job.masterAudioPath
  });
  const targetDurationSec = resolveTargetDurationSec(theme, args);
  const masterDurationSec =
    args?.master_duration_sec != null
      ? Number(args.master_duration_sec)
      : selectMasterDurationSec(theme, targetDurationSec);

  if (provider.name === "mock") {
    await ensureParentDir(job.masterAudioPath);
    await runCommand("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=220:duration=${masterDurationSec}`,
      "-af",
      "volume=0.05",
      "-ar",
      "48000",
      "-ac",
      "2",
      job.masterAudioPath
    ]);
  } else if (provider.name === "elevenlabs") {
    const request = provider.prepareRequest({
      prompt,
      durationSec: masterDurationSec
    });
    const fetchImpl = api?.config?.fetchImpl || globalThis.fetch;
    if (!fetchImpl) {
      throw new Error("fetch_unavailable");
    }

    const response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body)
    });

    if (!response.ok) {
      throw new Error(`elevenlabs_request_failed_${response.status}`);
    }

    const downloadPath = path.join(job.jobDir, "master_audio.mp3");
    const downloadBuffer = Buffer.from(await response.arrayBuffer());
    await writeBinaryFile(downloadPath, downloadBuffer);

    await runCommand("ffmpeg", [
      "-y",
      "-i",
      downloadPath,
      "-ar",
      "48000",
      "-ac",
      "2",
      job.masterAudioPath
    ]);
  } else {
    await writePlaceholderFile(
      job.masterAudioPath,
      `provider=${provider.name}\n${prompt}\nseed=${args?.seed || ""}\n`
    );
  }

  await writeManifest(job, {
    ok: true,
    stage: "ambient_music_build",
    themeId: theme.id,
    themeVersion: theme.version,
    prompt,
    provider: provider.name,
    targetDurationSec,
    masterDurationSec
  });

  return toolResult({
    ok: true,
    job_id: job.jobId,
    theme_id: theme.id,
    theme_version: theme.version,
    master_audio_path: job.masterAudioPath,
    target_duration_sec: targetDurationSec,
    master_duration_sec: masterDurationSec,
    loop_strategy: "crossfade_loop",
    audio_spec: normalized.audioSpec,
    qc_notes: ["low-dynamics", "loop-safe-prompt"]
  });
}

async function runAmbientMediaRender(_api, args) {
  const job = await createJobWorkspace();
  const outputName = String(args?.output_name || "ambient-output");
  const finalOutputPath = path.join("outputs", `${outputName}.mp4`);
  const plan = buildRenderPlan({
    themeId: "sleep-piano",
    durationTargetSec: Number(args?.duration_target_sec || 0),
    videoTemplateId: String(args?.video_template_id || "default-black")
  });
  const masterAudioPath = String(args?.master_audio_path || "").trim();
  const imagePath = String(args?.image_path || "").trim();
  const durationSec = Number(args?.duration_target_sec || 0);

  await ensureParentDir(job.extendedAudioPath);
  await ensureParentDir(job.loopVideoPath);
  await ensureParentDir(finalOutputPath);

  await runCommand("ffmpeg", [
    "-y",
    "-stream_loop",
    "-1",
    "-i",
    masterAudioPath,
    "-t",
    String(durationSec),
    "-af",
    `loudnorm=I=${plan.audio.targetLufs}`,
    "-ar",
    "48000",
    "-ac",
    "2",
    job.extendedAudioPath
  ]);

  if (imagePath) {
    await runCommand("ffmpeg", [
      "-y",
      "-loop",
      "1",
      "-i",
      imagePath,
      "-t",
      String(durationSec),
      "-vf",
      "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
      "-r",
      "24",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      job.loopVideoPath
    ]);
  } else {
    await runCommand("ffmpeg", [
      "-y",
      ...buildVideoLoopArgs({
        videoTemplateId: plan.video.templateId,
        durationTargetSec: durationSec,
        outputPath: job.loopVideoPath
      })
    ]);
  }

  await runCommand("ffmpeg", [
    "-y",
    "-i",
    job.loopVideoPath,
    "-i",
    job.extendedAudioPath,
    "-shortest",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    finalOutputPath
  ]);

  const probe = await probeMedia(finalOutputPath);
  await fs.writeFile(job.ffprobePath, `${JSON.stringify(probe, null, 2)}\n`, "utf8");

  const fileSizes = {
    audio_bytes: await statSize(job.extendedAudioPath),
    video_bytes: await statSize(job.loopVideoPath),
    final_bytes: await statSize(finalOutputPath)
  };

  await writeManifest(job, {
    ok: true,
    stage: "ambient_media_render",
    outputName,
    plan,
    fileSizes
  });

  return toolResult({
    ok: true,
    job_id: job.jobId,
    audio_output_path: job.extendedAudioPath,
    video_output_path: job.loopVideoPath,
    final_output_path: finalOutputPath,
    duration_sec: durationSec,
    ffprobe_summary: {
      video_streams: (probe.streams || []).filter((stream) => stream.codec_type === "video").length,
      audio_streams: (probe.streams || []).filter((stream) => stream.codec_type === "audio").length
    },
    file_sizes: fileSizes,
    render_manifest_path: path.join(job.jobDir, "manifest.json")
  });
}

async function runAmbientVideoGenerate(api, args) {
  const registry = await loadThemeRegistry();
  const theme = resolveThemeFromArgs(registry, args);

  const durationSec = resolveTargetDurationSec(theme, args);
  const musicResult = await runAmbientMusicBuild(api, {
    theme_id: theme.id,
    theme: args?.theme,
    style: args?.style,
    duration_target_sec: durationSec,
    master_duration_sec: args?.master_duration_sec,
    allow_nonstandard_duration: args?.allow_nonstandard_duration,
    seed: args?.seed,
    mode: args?.mode
  });

  const outputName =
    String(args?.output_name || `${theme.id}-${durationSec}s`).trim() || `${theme.id}-${durationSec}s`;

  let coverResult = null;
  try {
    coverResult = await runAmbientCoverGenerate(api, {
      theme_id: theme.id,
      theme: args?.theme,
      style: args?.style,
      output_name: outputName
    });
  } catch {
    coverResult = null;
  }

  const renderResult = await runAmbientMediaRender(api, {
    master_audio_path: musicResult.data.master_audio_path,
    image_path: coverResult?.data?.image_path,
    duration_target_sec: durationSec,
    video_template_id: String(args?.video_template_id || theme.video_template_id || "default-black"),
    output_name: outputName
  });

  return toolResult({
    ok: true,
    theme_id: theme.id,
    theme_version: theme.version,
    master_job_id: musicResult.data.job_id,
    render_job_id: renderResult.data.job_id,
    master_audio_path: musicResult.data.master_audio_path,
    master_duration_sec: musicResult.data.master_duration_sec,
    cover_image_path: coverResult?.data?.image_path || null,
    final_output_path: renderResult.data.final_output_path,
    duration_sec: durationSec,
    ffprobe_summary: renderResult.data.ffprobe_summary,
    file_sizes: renderResult.data.file_sizes
  });
}

export function registerAmbientTools(api) {
  api.registerTool({
    name: "ambient_music_build",
    description: "Generate or plan a short ambient music master",
    parameters: ambientMusicBuildInputSchema,
    schema: ambientMusicBuildInputSchema,
    async execute(_callId, args) {
      return runAmbientMusicBuild(api, args);
    }
  });

  api.registerTool({
    name: "ambient_media_render",
    description: "Extend audio, loop video, and export a final MP4",
    parameters: ambientMediaRenderInputSchema,
    schema: ambientMediaRenderInputSchema,
    async execute(_callId, args) {
      return runAmbientMediaRender(api, args);
    }
  });

  api.registerTool({
    name: "ambient_video_generate",
    description: "Build ambient music and render the final ambient video in one call",
    parameters: ambientVideoGenerateInputSchema,
    schema: ambientVideoGenerateInputSchema,
    async execute(_callId, args) {
      return runAmbientVideoGenerate(api, args);
    }
  });

  api.registerTool({
    name: "ambient_cover_generate",
    description: "Generate a single thematic cover image for ambient video rendering",
    parameters: ambientCoverGenerateInputSchema,
    schema: ambientCoverGenerateInputSchema,
    async execute(_callId, args) {
      return runAmbientCoverGenerate(api, args);
    }
  });
}

export default {
  id: "ambient-media-tools",
  name: "Ambient Media Tools",
  description: "OpenClaw helpers for ambient longform media generation",
  register(api) {
    registerAmbientTools(api);
  }
};
