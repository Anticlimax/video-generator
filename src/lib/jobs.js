import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

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
  jobDir,
  now = new Date(),
  randomSuffix = defaultRandomSuffix
} = {}) {
  const resolvedJobDir = jobDir || path.join(rootDir, `job_${buildStamp(now)}_${randomSuffix()}`);
  const jobId = path.basename(resolvedJobDir);

  await fs.mkdir(resolvedJobDir, { recursive: true });

  return {
    jobId,
    jobDir: resolvedJobDir,
    masterAudioPath: path.join(resolvedJobDir, "master_audio.wav"),
    extendedAudioPath: path.join(resolvedJobDir, "extended_audio.wav"),
    loopVideoPath: path.join(resolvedJobDir, "loop_video.mp4"),
    finalOutputPath: path.join(resolvedJobDir, "output.mp4"),
    ffprobePath: path.join(resolvedJobDir, "ffprobe.json"),
    progressPath: path.join(resolvedJobDir, "progress.json")
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
