import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { loadThemeRegistry } from "../src/lib/theme-registry.js";
import { createJobWorkspace, writeManifest } from "../src/lib/jobs.js";
import {
  selectMasterDurationSec,
  validateTargetDurationSec
} from "../src/lib/duration-policy.js";
import { buildMusicPrompt } from "../src/lib/music-prompt.js";
import { resolveMusicProvider } from "../src/lib/music-provider.js";
import { buildRenderPlan } from "../src/lib/render-plan.js";
import { buildVideoLoopArgs } from "../src/lib/ffmpeg-commands.js";

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
    duration_target_sec: { type: "number" },
    master_duration_sec: { type: "number" },
    allow_nonstandard_duration: { type: "boolean" },
    seed: { type: "string" },
    mode: { type: "string", enum: ["mock", "elevenlabs", "infsh"] },
    video_template_id: { type: "string" },
    output_name: { type: "string" }
  },
  required: ["theme_id"]
};

function resolveTargetDurationSec(theme, args) {
  const requestedDurationSec = Number(args?.duration_target_sec || theme.default_duration_sec || 0);
  if (args?.allow_nonstandard_duration) {
    return requestedDurationSec;
  }
  return validateTargetDurationSec(theme, requestedDurationSec);
}

async function runAmbientMusicBuild(api, args) {
  const registry = await loadThemeRegistry();
  const theme = registry.get(String(args?.theme_id || "").trim());
  if (!theme) {
    throw new Error("theme_not_found");
  }

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

  await runCommand("ffmpeg", [
    "-y",
    ...buildVideoLoopArgs({
      videoTemplateId: plan.video.templateId,
      durationTargetSec: durationSec,
      outputPath: job.loopVideoPath
    })
  ]);

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
  const theme = registry.get(String(args?.theme_id || "").trim());
  if (!theme) {
    throw new Error("theme_not_found");
  }

  const durationSec = resolveTargetDurationSec(theme, args);
  const musicResult = await runAmbientMusicBuild(api, {
    theme_id: theme.id,
    duration_target_sec: durationSec,
    master_duration_sec: args?.master_duration_sec,
    allow_nonstandard_duration: args?.allow_nonstandard_duration,
    seed: args?.seed,
    mode: args?.mode
  });

  const outputName =
    String(args?.output_name || `${theme.id}-${durationSec}s`).trim() || `${theme.id}-${durationSec}s`;

  const renderResult = await runAmbientMediaRender(api, {
    master_audio_path: musicResult.data.master_audio_path,
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
}

export default {
  id: "ambient-media-tools",
  name: "Ambient Media Tools",
  description: "OpenClaw helpers for ambient longform media generation",
  register(api) {
    registerAmbientTools(api);
  }
};
