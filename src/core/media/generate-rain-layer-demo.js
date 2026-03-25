import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

import { createJobWorkspace } from "../../lib/jobs.js";

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

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function buildRainOverlayFilter() {
  const farLayer = Array.from({ length: 20 }, (_, index) => ({
    x: 60 + index * 58,
    y: -20 - (index % 5) * 18,
    speed: 250 + (index % 4) * 18,
    drift: 12 + (index % 3) * 4,
    width: 1,
    height: 34 + (index % 4) * 10,
    alpha: 0.16 + (index % 3) * 0.02
  }));

  const nearLayer = Array.from({ length: 12 }, (_, index) => ({
    x: 120 + index * 92,
    y: -40 - (index % 4) * 24,
    speed: 180 + (index % 3) * 14,
    drift: 18 + (index % 2) * 6,
    width: index % 3 === 0 ? 3 : 2,
    height: 56 + (index % 4) * 16,
    alpha: index % 3 === 0 ? 0.34 : 0.26
  }));

  const layers = [...farLayer, ...nearLayer];

  const drawFilters = layers.map((layer) => {
    const xExpr = `'mod(${layer.x}+t*${layer.drift},1280)'`;
    const yExpr = `'mod(${layer.y}+t*${layer.speed},760)-40'`;
    return `drawbox=x=${xExpr}:y=${yExpr}:w=${layer.width}:h=${layer.height}:color=white@${layer.alpha}:t=fill`;
  });

  return [
    "format=rgba",
    ...drawFilters,
    "gblur=sigma=0.6:steps=1",
    "format=yuva420p"
  ].join(",");
}

async function generateRainOverlayVideo({
  outputPath,
  durationSec,
  fps,
  runCommandImpl = runCommand
}) {
  await ensureParentDir(outputPath);
  await runCommandImpl("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=black@0.0:s=1280x720:d=${durationSec}:r=${fps}`,
    "-vf",
    buildRainOverlayFilter(),
    "-c:v",
    "qtrle",
    outputPath
  ]);
}

export async function generateRainLayerDemo({
  rootDir = "jobs",
  outputRootDir = "outputs",
  jobDir,
  imagePath,
  outputName = "rain-layer-demo",
  durationSec = 5,
  fps = 24,
  now,
  randomSuffix,
  runCommandImpl = runCommand,
  probeMediaImpl = probeMedia,
  frameGeneratorImpl
} = {}) {
  const resolvedNow = typeof now === "function" ? now() : now || new Date();
  const job = await createJobWorkspace({
    rootDir,
    jobDir,
    now: resolvedNow,
    randomSuffix
  });

  const framesDir = path.join(job.jobDir, "rain-frames");
  const overlayVideoPath = path.join(job.jobDir, "rain_overlay.mov");
  const outputPath = path.join(outputRootDir, `${String(outputName).trim() || "rain-layer-demo"}.mp4`);

  if (frameGeneratorImpl) {
    await frameGeneratorImpl({
      framesDir,
      frameCount: Math.max(1, Math.round(durationSec * fps))
    });
  } else {
    await generateRainOverlayVideo({
      outputPath: overlayVideoPath,
      durationSec,
      fps,
      runCommandImpl
    });
  }

  await ensureParentDir(outputPath);

  if (frameGeneratorImpl) {
    await runCommandImpl("ffmpeg", [
      "-y",
      "-loop",
      "1",
      "-i",
      String(imagePath),
      "-framerate",
      String(fps),
      "-i",
      path.join(framesDir, "frame-%04d.png"),
      "-filter_complex",
      "[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[base];[base][1:v]overlay=shortest=1:format=auto,format=yuv420p[v]",
      "-map",
      "[v]",
      "-t",
      String(durationSec),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      outputPath
    ]);
  } else {
    await runCommandImpl("ffmpeg", [
      "-y",
      "-loop",
      "1",
      "-i",
      String(imagePath),
      "-stream_loop",
      "-1",
      "-i",
      overlayVideoPath,
      "-filter_complex",
      "[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[base];[1:v]colorkey=0x000000:0.08:0.0,format=rgba[rain];[base][rain]overlay=shortest=1:format=auto,format=yuv420p[v]",
      "-map",
      "[v]",
      "-t",
      String(durationSec),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      outputPath
    ]);
  }

  const ffprobe = await probeMediaImpl(outputPath);

  return {
    ok: true,
    jobId: job.jobId,
    jobDir: job.jobDir,
    overlayVideoPath: frameGeneratorImpl ? null : overlayVideoPath,
    framesDir: frameGeneratorImpl ? framesDir : null,
    outputPath,
    durationSec,
    ffprobe,
    ffprobeSummary: {
      videoStreams: (ffprobe.streams || []).filter((stream) => stream.codec_type === "video").length,
      audioStreams: (ffprobe.streams || []).filter((stream) => stream.codec_type === "audio").length
    }
  };
}
