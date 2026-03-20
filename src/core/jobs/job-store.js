import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createJobWorkspace } from "../../lib/jobs.js";
import {
  JOB_STAGES,
  JOB_STATUSES,
  createJobRecord,
  mergeJobRecord,
  normalizeJobRecord
} from "./job-types.js";

function defaultRandomSuffix() {
  return randomUUID().replace(/-/g, "").slice(0, 4).toLowerCase();
}

function normalizeNow(now) {
  if (typeof now === "function") {
    return now();
  }
  return now || new Date();
}

function getJobFilePath(rootDir, jobId) {
  return path.join(rootDir, jobId, "job.json");
}

function mapArtifactsToTopLevel(input = {}) {
  const artifacts = input.artifacts && typeof input.artifacts === "object" ? input.artifacts : {};
  return {
    ...input,
    videoImagePath: input.videoImagePath ?? artifacts.videoImagePath,
    coverImagePath: input.coverImagePath ?? artifacts.coverImagePath,
    motionVideoPath: input.motionVideoPath ?? artifacts.motionVideoPath,
    masterAudioPath: input.masterAudioPath ?? artifacts.masterAudioPath,
    finalVideoPath: input.finalVideoPath ?? artifacts.finalVideoPath,
    youtubeUrl: input.youtubeUrl ?? artifacts.youtubeUrl,
    youtubeVideoId: input.youtubeVideoId ?? artifacts.youtubeVideoId
  };
}

async function readJobFile(jobFilePath) {
  try {
    const raw = await fs.readFile(jobFilePath, "utf8");
    return normalizeJobRecord(JSON.parse(raw));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeJobFile(jobFilePath, job) {
  await fs.mkdir(path.dirname(jobFilePath), { recursive: true });
  await fs.writeFile(jobFilePath, `${JSON.stringify(job, null, 2)}\n`, "utf8");
}

async function listJobFiles(rootDir) {
  try {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => getJobFilePath(rootDir, entry.name));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export function createJobStore({
  rootDir = "jobs",
  now = () => new Date(),
  randomSuffix = defaultRandomSuffix
} = {}) {
  async function create(input = {}) {
    const timestamp = normalizeNow(now);
    const workspace = await createJobWorkspace({
      rootDir,
      now: timestamp,
      randomSuffix
    });
    const normalizedInput = mapArtifactsToTopLevel(input);
    const job = createJobRecord({
      id: workspace.jobId,
      theme: normalizedInput.theme,
      style: normalizedInput.style,
      durationTargetSec: normalizedInput.durationTargetSec,
      masterDurationSec: normalizedInput.masterDurationSec,
      provider: normalizedInput.provider,
      publishToYouTube: normalizedInput.publishToYouTube,
      videoVisualPrompt: normalizedInput.videoVisualPrompt,
      generateSeparateCover: normalizedInput.generateSeparateCover,
      generateMotionVideo: normalizedInput.generateMotionVideo,
      coverPrompt: normalizedInput.coverPrompt,
      status: normalizedInput.status,
      stage: normalizedInput.stage,
      progress: normalizedInput.progress,
      createdAt: timestamp.toISOString(),
      updatedAt: timestamp.toISOString(),
      videoImagePath: normalizedInput.videoImagePath,
      coverImagePath: normalizedInput.coverImagePath,
      motionVideoPath: normalizedInput.motionVideoPath,
      masterAudioPath: normalizedInput.masterAudioPath,
      finalVideoPath: normalizedInput.finalVideoPath,
      youtubeUrl: normalizedInput.youtubeUrl,
      youtubeVideoId: normalizedInput.youtubeVideoId
    });

    await writeJobFile(getJobFilePath(rootDir, job.id), job);
    return job;
  }

  async function getById(jobId) {
    const jobFilePath = getJobFilePath(rootDir, jobId);
    return readJobFile(jobFilePath);
  }

  async function list({ limit } = {}) {
    const jobs = [];
    for (const jobFilePath of await listJobFiles(rootDir)) {
      const job = await readJobFile(jobFilePath);
      if (job) {
        jobs.push(job);
      }
    }

    jobs.sort((left, right) => {
      const createdAtCompare = String(right.createdAt).localeCompare(String(left.createdAt));
      if (createdAtCompare !== 0) {
        return createdAtCompare;
      }
      return String(right.id).localeCompare(String(left.id));
    });

    if (Number.isFinite(limit) && limit >= 0) {
      return jobs.slice(0, limit);
    }

    return jobs;
  }

  async function update(jobId, patch = {}) {
    const current = await getById(jobId);
    if (!current) {
      return null;
    }

    const timestamp = normalizeNow(now);
    const normalizedPatch = mapArtifactsToTopLevel(patch);
    const updated = mergeJobRecord(current, normalizedPatch, timestamp.toISOString());
    await writeJobFile(getJobFilePath(rootDir, jobId), updated);
    return updated;
  }

  return {
    rootDir,
    create,
    getById,
    list,
    update
  };
}

export {
  JOB_STAGES,
  JOB_STATUSES,
  getJobFilePath,
  mapArtifactsToTopLevel,
  normalizeNow
};
