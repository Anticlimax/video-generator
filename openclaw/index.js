import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { loadThemeRegistry } from "../src/lib/theme-registry.js";
import { createJobWorkspace, writeManifest } from "../src/lib/jobs.js";
import { buildMusicPrompt } from "../src/lib/music-prompt.js";
import { resolveMusicProvider } from "../src/lib/music-provider.js";
import { buildRenderPlan } from "../src/lib/render-plan.js";

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writePlaceholderFile(filePath, contents) {
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, contents, "utf8");
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

async function runAmbientMusicBuild(api, args) {
  const registry = await loadThemeRegistry();
  const theme = registry.get(String(args?.theme_id || "").trim());
  if (!theme) {
    throw new Error("theme_not_found");
  }

  const provider = resolveMusicProvider({
    mode: args?.mode || api?.config?.mode || "mock"
  });
  const job = await createJobWorkspace();
  const prompt = buildMusicPrompt({
    themeId: theme.id,
    promptSeed: theme.prompt_seed
  });

  const normalized = await provider.normalizeResult({
    path: job.masterAudioPath
  });
  const durationSec = Number(args?.duration_target_sec || theme.default_duration_sec || 0);

  if (provider.name === "mock") {
    await ensureParentDir(job.masterAudioPath);
    await runCommand("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=220:duration=${durationSec}`,
      "-af",
      "volume=0.05",
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
    provider: provider.name
  });

  return toolResult({
    ok: true,
    job_id: job.jobId,
    theme_id: theme.id,
    theme_version: theme.version,
    master_audio_path: job.masterAudioPath,
    master_duration_sec: durationSec,
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
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=1280x720:r=24",
    "-t",
    String(durationSec),
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    job.loopVideoPath
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

export function registerAmbientTools(api) {
  api.registerTool({
    name: "ambient_music_build",
    description: "Generate or plan a short ambient music master",
    async execute(_callId, args) {
      return runAmbientMusicBuild(api, args);
    }
  });

  api.registerTool({
    name: "ambient_media_render",
    description: "Extend audio, loop video, and export a final MP4",
    async execute(_callId, args) {
      return runAmbientMediaRender(api, args);
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
