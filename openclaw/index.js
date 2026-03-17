import fs from "node:fs/promises";
import path from "node:path";
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

  await writePlaceholderFile(
    job.masterAudioPath,
    `mock ambient master\n${prompt}\nseed=${args?.seed || ""}\n`
  );

  await writeManifest(job, {
    ok: true,
    stage: "ambient_music_build",
    themeId: theme.id,
    themeVersion: theme.version
  });

  return toolResult({
    ok: true,
    job_id: job.jobId,
    theme_id: theme.id,
    theme_version: theme.version,
    master_audio_path: job.masterAudioPath,
    master_duration_sec: Number(args?.duration_target_sec || theme.default_duration_sec || 0),
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

  await writePlaceholderFile(job.extendedAudioPath, "mock extended audio\n");
  await writePlaceholderFile(job.loopVideoPath, "mock loop video\n");
  await writePlaceholderFile(finalOutputPath, "mock final mp4\n");

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
    duration_sec: Number(args?.duration_target_sec || 0),
    ffprobe_summary: {
      video_streams: 1,
      audio_streams: 1
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
