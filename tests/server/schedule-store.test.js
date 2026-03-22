import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createScheduleStore } from "../../src/core/schedules/schedule-store.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ambient-schedule-store-"));
}

test("schedule store can create, read, list, and update schedules", async () => {
  const rootDir = makeTempDir();
  const store = createScheduleStore({
    rootDir,
    now: () => new Date("2026-03-22T08:00:00.000Z"),
    randomSuffix: () => "s1a2"
  });

  const created = await store.create({
    kind: "daily",
    time: "09:30",
    timezone: "UTC",
    payload: {
      theme: "storm city",
      style: "cinematic storm ambience",
      durationTargetSec: 30,
      provider: "musicgpt"
    }
  });

  assert.equal(created.id, "schedule_20260322_080000_s1a2");
  assert.equal(created.kind, "daily");
  assert.equal(created.time, "09:30");
  assert.equal(created.cronExpression, "30 9 * * *");
  assert.equal(created.enabled, true);
  assert.equal(created.payload.theme, "storm city");
  assert.equal(created.nextRunAt, "2026-03-22T09:30:00.000Z");

  const loaded = await store.getById(created.id);
  assert.equal(loaded?.id, created.id);
  assert.equal(loaded?.payload.style, "cinematic storm ambience");

  const updated = await store.update(created.id, {
    enabled: false,
    lastRunAt: "2026-03-22T09:30:00.000Z",
    lastJobId: "job_1"
  });

  assert.equal(updated?.enabled, false);
  assert.equal(updated?.lastRunAt, "2026-03-22T09:30:00.000Z");
  assert.equal(updated?.lastJobId, "job_1");

  const list = await store.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, created.id);
});

test("schedule store lists newest schedules first", async () => {
  const rootDir = makeTempDir();
  const store = createScheduleStore({
    rootDir,
    now: (() => {
      let tick = 0;
      return () => new Date(1774166400000 + tick++ * 1000);
    })(),
    randomSuffix: (() => {
      let tick = 0;
      return () => `s${tick++}z9`;
    })()
  });

  const first = await store.create({
    kind: "daily",
    time: "09:30",
    timezone: "UTC",
    payload: { theme: "first", style: "calm", durationTargetSec: 10, provider: "mock" }
  });
  const second = await store.create({
    kind: "weekly",
    time: "21:15",
    weekday: 5,
    timezone: "UTC",
    payload: { theme: "second", style: "calm", durationTargetSec: 20, provider: "mock" }
  });

  const list = await store.list();
  assert.deepEqual(list.map((schedule) => schedule.id), [second.id, first.id]);
});
