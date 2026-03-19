import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  JOB_STAGES,
  JOB_STATUSES,
  createJobStore
} from "../../src/server/jobs/job-store.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ambient-job-store-"));
}

test("job store exposes the supported statuses and stages", () => {
  assert.deepEqual(JOB_STATUSES, ["queued", "running", "completed", "failed"]);
  assert.deepEqual(JOB_STAGES, [
    "queued",
    "music_generating",
    "music_ready",
    "cover_generating",
    "cover_ready",
    "video_rendering",
    "youtube_uploading",
    "completed",
    "failed"
  ]);
});

test("job store can create, read, list, and update jobs", async () => {
  const rootDir = makeTempDir();
  const store = createJobStore({
    rootDir,
    now: () => new Date("2026-03-20T08:00:00Z"),
    randomSuffix: () => "a1b2"
  });

  const created = await store.create({
    theme: "storm city",
    style: "cinematic storm ambience",
    durationTargetSec: 30,
    provider: "musicgpt"
  });

  assert.equal(created.id, "job_20260320_080000_a1b2");
  assert.equal(created.theme, "storm city");
  assert.equal(created.style, "cinematic storm ambience");
  assert.equal(created.durationTargetSec, 30);
  assert.equal(created.status, "queued");
  assert.equal(created.stage, "queued");
  assert.equal(created.progress, 0);
  assert.equal(created.masterAudioPath, null);
  assert.equal(fs.existsSync(path.join(rootDir, created.id, "job.json")), true);

  const loaded = await store.getById(created.id);
  assert.equal(loaded?.id, created.id);
  assert.equal(loaded?.theme, "storm city");

  const list = await store.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, created.id);

  const updated = await store.update(created.id, {
    stage: "music_generating",
    status: "running",
    progress: 25,
    masterAudioPath: "/tmp/master_audio.wav"
  });

  assert.equal(updated.stage, "music_generating");
  assert.equal(updated.status, "running");
  assert.equal(updated.progress, 25);
  assert.equal(updated.masterAudioPath, "/tmp/master_audio.wav");

  const reloaded = await store.getById(created.id);
  assert.equal(reloaded?.stage, "music_generating");
  assert.equal(reloaded?.status, "running");
  assert.equal(reloaded?.progress, 25);
  assert.equal(reloaded?.masterAudioPath, "/tmp/master_audio.wav");
});

test("job store lists newest jobs first", async () => {
  const rootDir = makeTempDir();
  const store = createJobStore({
    rootDir,
    now: (() => {
      let tick = 0;
      return () => new Date(1773926400000 + tick++ * 1000);
    })(),
    randomSuffix: (() => {
      let tick = 0;
      return () => `x${tick++}y${tick}`;
    })()
  });

  const first = await store.create({
    theme: "first",
    style: "calm",
    durationTargetSec: 10,
    provider: "mock"
  });
  const second = await store.create({
    theme: "second",
    style: "calm",
    durationTargetSec: 20,
    provider: "mock"
  });

  const list = await store.list();
  assert.deepEqual(list.map((job) => job.id), [second.id, first.id]);
});
