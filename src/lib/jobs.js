import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

function buildStamp(now) {
  const iso = now.toISOString();
  const date = iso.slice(0, 10).replace(/-/g, "");
  const time = iso.slice(11, 19).replace(/:/g, "");
  return `${date}_${time}`;
}

function defaultRandomSuffix() {
  return randomUUID().replace(/-/g, "").slice(0, 4).toLowerCase();
}

export async function createJobWorkspace({
  rootDir = "jobs",
  now = new Date(),
  randomSuffix = defaultRandomSuffix
} = {}) {
  const stamp = buildStamp(now);
  const suffix = randomSuffix();
  const jobId = `job_${stamp}_${suffix}`;
  const jobDir = path.join(rootDir, jobId);

  await fs.mkdir(jobDir, { recursive: true });

  return {
    jobId,
    jobDir,
    masterAudioPath: path.join(jobDir, "master_audio.wav"),
    extendedAudioPath: path.join(jobDir, "extended_audio.wav"),
    loopVideoPath: path.join(jobDir, "loop_video.mp4"),
    finalOutputPath: path.join(jobDir, "output.mp4"),
    ffprobePath: path.join(jobDir, "ffprobe.json"),
    progressPath: path.join(jobDir, "progress.json")
  };
}

export async function writeManifest(job, manifest) {
  const file = path.join(job.jobDir, "manifest.json");
  await fs.writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return file;
}

export async function writeProgress(job, progress) {
  await fs.writeFile(job.progressPath, `${JSON.stringify(progress, null, 2)}\n`, "utf8");
  return job.progressPath;
}
