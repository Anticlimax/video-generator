import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createJobStore } from "../../src/core/jobs/job-store.js";
import { runJob } from "../../src/core/jobs/run-job.js";
import { createJob } from "../../src/core/jobs/create-job.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ambient-run-job-"));
}

test("runJob advances job stages and persists final artifacts", async () => {
  const rootDir = makeTempDir();
  const store = createJobStore({
    rootDir,
    now: (() => {
      let tick = 0;
      return () => new Date(1773993600000 + tick++ * 1000);
    })(),
    randomSuffix: (() => {
      let tick = 0;
      return () => `r${tick++}x1`;
    })()
  });

  const created = await store.create({
    theme: "storm city",
    style: "cinematic storm ambience",
    durationTargetSec: 30,
    provider: "mock"
  });

  const completed = await runJob({
    jobId: created.id,
    store,
    generateMusicImpl: async () => {
      const current = await store.getById(created.id);
      assert.equal(current?.status, "running");
      assert.equal(current?.stage, "music_generating");
      assert.equal(current?.progress, 20);

      return {
        masterAudioPath: path.join(rootDir, created.id, "master_audio.wav"),
        masterDurationSec: 30,
        provider: "mock"
      };
    },
    generateCoverImpl: async () => {
      const current = await store.getById(created.id);
      assert.equal(current?.stage, "cover_generating");
      assert.equal(current?.progress, 55);
      assert.equal(current?.masterAudioPath, path.join(rootDir, created.id, "master_audio.wav"));

      return {
        imagePath: path.join(rootDir, created.id, "cover_image.png")
      };
    },
    renderVideoImpl: async () => {
      const current = await store.getById(created.id);
      assert.equal(current?.stage, "video_rendering");
      assert.equal(current?.progress, 85);
      assert.equal(current?.coverImagePath, path.join(rootDir, created.id, "cover_image.png"));

      return {
        finalOutputPath: path.join(rootDir, "outputs", "storm-city.mp4"),
        ffprobeSummary: { videoStreams: 1, audioStreams: 1 },
        fileSizes: { finalBytes: 1024 }
      };
    }
  });

  assert.equal(completed?.status, "completed");
  assert.equal(completed?.stage, "completed");
  assert.equal(completed?.progress, 100);
  assert.equal(completed?.masterAudioPath, path.join(rootDir, created.id, "master_audio.wav"));
  assert.equal(completed?.coverImagePath, path.join(rootDir, created.id, "cover_image.png"));
  assert.equal(completed?.finalVideoPath, path.join(rootDir, "outputs", "storm-city.mp4"));
  assert.equal(completed?.errorCode, null);
  assert.equal(completed?.errorMessage, null);
});

test("runJob keeps media artifacts inside the top-level web job directory", async () => {
  const rootDir = makeTempDir();
  const store = createJobStore({
    rootDir,
    now: (() => {
      let tick = 0;
      return () => new Date(1773993600000 + tick++ * 1000);
    })(),
    randomSuffix: (() => {
      let tick = 0;
      return () => `w${tick++}x9`;
    })()
  });

  const created = await store.create({
    theme: "storm city",
    style: "cinematic storm ambience",
    durationTargetSec: 30,
    provider: "mock"
  });

  const completed = await runJob({
    jobId: created.id,
    store,
    generateMusicImpl: async ({ jobDir }) => ({
      masterAudioPath: path.join(jobDir, "master_audio.wav"),
      masterDurationSec: 30,
      provider: "mock"
    }),
    generateCoverImpl: async ({ jobDir }) => ({
      imagePath: path.join(jobDir, "cover_image.png")
    }),
    renderVideoImpl: async ({ jobDir, artifactPaths, imagePath, masterAudioPath }) => {
      assert.equal(jobDir, path.join(rootDir, created.id));
      assert.equal(masterAudioPath, path.join(jobDir, "master_audio.wav"));
      assert.equal(imagePath, path.join(jobDir, "cover_image.png"));
      assert.equal(artifactPaths.extendedAudioPath, path.join(jobDir, "extended_audio.wav"));
      assert.equal(artifactPaths.loopVideoPath, path.join(jobDir, "loop_video.mp4"));
      assert.equal(artifactPaths.ffprobePath, path.join(jobDir, "ffprobe.json"));
      return {
        finalOutputPath: path.join(rootDir, "outputs", "storm-city.mp4"),
        ffprobeSummary: { videoStreams: 1, audioStreams: 1 },
        fileSizes: { finalBytes: 1024 }
      };
    }
  });

  assert.equal(completed?.status, "completed");
  assert.equal(completed?.masterAudioPath, path.join(rootDir, created.id, "master_audio.wav"));
  assert.equal(completed?.coverImagePath, path.join(rootDir, created.id, "cover_image.png"));
  assert.equal(completed?.finalVideoPath, path.join(rootDir, "outputs", "storm-city.mp4"));
});

test("runJob marks the job as failed when media generation throws", async () => {
  const rootDir = makeTempDir();
  const store = createJobStore({
    rootDir,
    now: () => new Date("2026-03-20T00:00:00Z"),
    randomSuffix: () => "fail"
  });

  const created = await store.create({
    theme: "storm city",
    style: "cinematic storm ambience",
    durationTargetSec: 30,
    provider: "mock"
  });

  const failed = await runJob({
    jobId: created.id,
    store,
    generateMusicImpl: async () => {
      throw new Error("music_provider_failed");
    }
  });

  assert.equal(failed?.status, "failed");
  assert.equal(failed?.stage, "failed");
  assert.equal(failed?.errorCode, "music_provider_failed");
  assert.equal(failed?.errorMessage, "music_provider_failed");
});

test("runJob falls back to template rendering when cover generation fails", async () => {
  const rootDir = makeTempDir();
  const store = createJobStore({
    rootDir,
    now: (() => {
      let tick = 0;
      return () => new Date(1773993600000 + tick++ * 1000);
    })(),
    randomSuffix: (() => {
      let tick = 0;
      return () => `c${tick++}x2`;
    })()
  });

  const created = await store.create({
    theme: "storm city",
    style: "cinematic storm ambience",
    durationTargetSec: 30,
    provider: "mock"
  });

  const completed = await runJob({
    jobId: created.id,
    store,
    generateMusicImpl: async () => ({
      masterAudioPath: path.join(rootDir, created.id, "master_audio.wav"),
      masterDurationSec: 30,
      provider: "mock"
    }),
    generateCoverImpl: async () => {
      throw new Error("cover_provider_unavailable");
    },
    renderVideoImpl: async ({ imagePath }) => {
      assert.equal(imagePath, null);
      return {
        finalOutputPath: path.join(rootDir, "outputs", "storm-city.mp4"),
        ffprobeSummary: { videoStreams: 1, audioStreams: 1 },
        fileSizes: { finalBytes: 1024 }
      };
    }
  });

  assert.equal(completed?.status, "completed");
  assert.equal(completed?.stage, "completed");
  assert.equal(completed?.coverImagePath, null);
  assert.equal(completed?.finalVideoPath, path.join(rootDir, "outputs", "storm-city.mp4"));
});

test("createJob schedules async execution and returns the created job immediately", async () => {
  const rootDir = makeTempDir();
  const store = createJobStore({
    rootDir,
    now: (() => {
      let tick = 0;
      return () => new Date(1773993600000 + tick++ * 1000);
    })(),
    randomSuffix: () => "bg01"
  });

  let executedJobId = null;
  const { job, runPromise } = await createJob({
    store,
    input: {
      theme: "night sky",
      style: "ambient piano",
      durationTargetSec: 45,
      provider: "mock"
    },
    runJobImpl: async ({ jobId }) => {
      executedJobId = jobId;
      await store.update(jobId, {
        status: "completed",
        stage: "completed",
        progress: 100,
        finalVideoPath: path.join(rootDir, "outputs", "night-sky.mp4")
      });
      return store.getById(jobId);
    }
  });

  assert.equal(job.status, "queued");
  assert.equal(job.stage, "queued");
  assert.equal(job.progress, 0);
  assert.equal(executedJobId, null);

  const finished = await runPromise;
  const reloaded = await store.getById(job.id);

  assert.equal(executedJobId, job.id);
  assert.equal(finished?.status, "completed");
  assert.equal(reloaded?.finalVideoPath, path.join(rootDir, "outputs", "night-sky.mp4"));
});
