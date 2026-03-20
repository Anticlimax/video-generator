import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { createJobWorkspace } from "../../lib/jobs.js";
import { buildRenderPlan } from "../../lib/render-plan.js";
import { buildVideoLoopArgs } from "../../lib/ffmpeg-commands.js";

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

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
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

async function statSize(filePath) {
  const stats = await fs.stat(filePath);
  return stats.size;
}

function normalizeOutputName(value, fallback = "ambient-output") {
  const raw = String(value || "").trim();
  const base = raw || fallback;
  return base.replace(/(?:\.mp4)+$/iu, "") || fallback;
}

export async function renderVideo({
  rootDir = "jobs",
  outputRootDir = "outputs",
  now,
  randomSuffix,
  themeId = "sleep-piano",
  masterAudioPath,
  imagePath,
  durationTargetSec,
  videoTemplateId = "default-black",
  outputName = "ambient-output",
  runCommandImpl = runCommand,
  probeMediaImpl = probeMedia
} = {}) {
  const resolvedNow = typeof now === "function" ? now() : now || new Date();
  const job = await createJobWorkspace({
    rootDir,
    now: resolvedNow,
    randomSuffix
  });
  const normalizedOutputName = normalizeOutputName(outputName, "ambient-output");
  const finalOutputPath = path.join(outputRootDir, `${normalizedOutputName}.mp4`);
  const durationSec = Number(durationTargetSec || 0);
  const plan = buildRenderPlan({
    themeId,
    durationTargetSec: durationSec,
    videoTemplateId
  });

  await ensureParentDir(job.extendedAudioPath);
  await ensureParentDir(job.loopVideoPath);
  await ensureParentDir(finalOutputPath);

  await runCommandImpl("ffmpeg", [
    "-y",
    "-stream_loop",
    "-1",
    "-i",
    String(masterAudioPath),
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
    await runCommandImpl("ffmpeg", [
      "-y",
      "-loop",
      "1",
      "-i",
      String(imagePath),
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
    await runCommandImpl("ffmpeg", [
      "-y",
      ...buildVideoLoopArgs({
        videoTemplateId: plan.video.templateId,
        durationTargetSec: durationSec,
        outputPath: job.loopVideoPath
      })
    ]);
  }

  await runCommandImpl("ffmpeg", [
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

  const probe = await probeMediaImpl(finalOutputPath);
  await fs.writeFile(job.ffprobePath, `${JSON.stringify(probe, null, 2)}\n`, "utf8");

  const fileSizes = {
    audioBytes: await statSize(job.extendedAudioPath),
    videoBytes: await statSize(job.loopVideoPath),
    finalBytes: await statSize(finalOutputPath)
  };

  return {
    ok: true,
    jobId: job.jobId,
    jobDir: job.jobDir,
    audioOutputPath: job.extendedAudioPath,
    videoOutputPath: job.loopVideoPath,
    finalOutputPath,
    durationSec,
    renderPlan: plan,
    ffprobe: probe,
    ffprobeSummary: {
      videoStreams: (probe.streams || []).filter((stream) => stream.codec_type === "video").length,
      audioStreams: (probe.streams || []).filter((stream) => stream.codec_type === "audio").length
    },
    fileSizes
  };
}
