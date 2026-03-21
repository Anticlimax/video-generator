import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

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

export async function generateVfxOverlayVideo({
  rootDir = "jobs",
  jobDir,
  artifactPaths = {},
  now,
  randomSuffix,
  imagePath,
  overlayPattern,
  startNumber = 1001,
  durationSec = 5,
  outputWidth = 1280,
  outputHeight = 720,
  overlayOpacity = 0.95,
  runCommandImpl = runCommand,
  probeMediaImpl = probeMedia
} = {}) {
  if (!String(imagePath || "").trim()) {
    throw new Error("missing_image_path");
  }
  if (!String(overlayPattern || "").trim()) {
    throw new Error("missing_overlay_pattern");
  }

  const resolvedNow = typeof now === "function" ? now() : now || new Date();
  const job = await createJobWorkspace({
    rootDir,
    jobDir,
    now: resolvedNow,
    randomSuffix
  });

  const motionVideoPath =
    String(artifactPaths.motionVideoPath || "").trim() || path.join(job.jobDir, "motion_video.mp4");

  await ensureParentDir(motionVideoPath);

  await runCommandImpl("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-i",
    String(imagePath),
    "-framerate",
    "25",
    "-start_number",
    String(startNumber),
    "-i",
    String(overlayPattern),
    "-filter_complex",
    [
      `[0:v]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,`,
      `pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2,`,
      `trim=duration=${durationSec},setpts=PTS-STARTPTS[bg]`,
      `;`,
      `[1:v]scale=${outputWidth}:${outputHeight},trim=duration=${durationSec},`,
      `setpts=PTS-STARTPTS,format=rgba,colorchannelmixer=aa=${overlayOpacity}[fx]`,
      `;`,
      `[bg][fx]overlay=shortest=1:format=auto,format=yuv420p[v]`
    ].join(""),
    "-map",
    "[v]",
    "-t",
    String(durationSec),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    motionVideoPath
  ]);

  const ffprobe = await probeMediaImpl(motionVideoPath);

  return {
    ok: true,
    jobId: job.jobId,
    jobDir: job.jobDir,
    motionVideoPath,
    durationSec,
    ffprobe,
    ffprobeSummary: {
      videoStreams: (ffprobe.streams || []).filter((stream) => stream.codec_type === "video").length,
      audioStreams: (ffprobe.streams || []).filter((stream) => stream.codec_type === "audio").length
    }
  };
}
