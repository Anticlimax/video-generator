import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createScheduleStore } from "../../src/core/schedules/schedule-store.js";
import { runSchedulesTick, listQueuedScheduleRuns } from "../../src/core/schedules/run-schedules.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ambient-run-schedules-"));
}

test("runSchedulesTick dispatches a due schedule immediately when no jobs are running", async () => {
  const rootDir = makeTempDir();
  const scheduleStore = createScheduleStore({
    rootDir: path.join(rootDir, "schedules"),
    now: () => new Date("2026-03-23T08:00:00.000Z"),
    randomSuffix: () => "qa11"
  });

  const schedule = await scheduleStore.create({
    kind: "daily",
    time: "07:30",
    timezone: "UTC",
    payload: {
      theme: "storm city",
      style: "cinematic storm ambience",
      durationTargetSec: 30,
      provider: "mock"
    }
  });
  await scheduleStore.update(schedule.id, {
    nextRunAt: "2026-03-23T07:30:00.000Z"
  });

  const createdInputs = [];
  const jobStore = {
    rootDir: path.join(rootDir, "jobs"),
    list: async () => [],
    getById: async () => null,
    update: async () => null
  };

  const result = await runSchedulesTick({
    scheduleStore,
    jobStore,
    now: new Date("2026-03-23T08:00:00.000Z"),
    createJobImpl: async ({ input }) => {
      createdInputs.push(input);
      return {
        job: {
          id: "job_1"
        }
      };
    }
  });

  assert.equal(result.enqueuedCount, 1);
  assert.equal(result.dispatched?.scheduleId, schedule.id);
  assert.equal(createdInputs.length, 1);
  assert.equal(createdInputs[0].theme, "storm city");
  const updated = await scheduleStore.getById(schedule.id);
  assert.equal(updated?.lastJobId, "job_1");
  assert.equal(updated?.lastRunAt, "2026-03-23T08:00:00.000Z");
  assert.equal(updated?.nextRunAt, "2026-03-24T07:30:00.000Z");
  assert.equal((await listQueuedScheduleRuns({ rootDir: scheduleStore.rootDir })).length, 0);
});

test("runSchedulesTick enqueues due schedules but does not dispatch while a job is already running", async () => {
  const rootDir = makeTempDir();
  const scheduleStore = createScheduleStore({
    rootDir: path.join(rootDir, "schedules"),
    now: () => new Date("2026-03-23T08:00:00.000Z"),
    randomSuffix: () => "qb22"
  });

  const schedule = await scheduleStore.create({
    kind: "daily",
    time: "07:30",
    timezone: "UTC",
    payload: {
      theme: "storm city",
      style: "cinematic storm ambience",
      durationTargetSec: 30,
      provider: "mock"
    }
  });
  await scheduleStore.update(schedule.id, {
    nextRunAt: "2026-03-23T07:30:00.000Z"
  });

  const jobStore = {
    rootDir: path.join(rootDir, "jobs"),
    list: async () => [{ id: "job_running", status: "running" }],
    getById: async () => null,
    update: async () => null
  };

  const result = await runSchedulesTick({
    scheduleStore,
    jobStore,
    now: new Date("2026-03-23T08:00:00.000Z"),
    createJobImpl: async () => {
      throw new Error("should_not_dispatch");
    }
  });

  assert.equal(result.enqueuedCount, 1);
  assert.equal(result.dispatched, null);
  const queue = await listQueuedScheduleRuns({ rootDir: scheduleStore.rootDir });
  assert.equal(queue.length, 1);
  assert.equal(queue[0].scheduleId, schedule.id);
});

test("runSchedulesTick dispatches the oldest queued run after running jobs clear", async () => {
  const rootDir = makeTempDir();
  const scheduleStore = createScheduleStore({
    rootDir: path.join(rootDir, "schedules"),
    now: () => new Date("2026-03-23T08:00:00.000Z"),
    randomSuffix: (() => {
      let tick = 0;
      return () => `qc${tick++}`;
    })()
  });

  const schedule = await scheduleStore.create({
    kind: "daily",
    time: "07:30",
    timezone: "UTC",
    payload: {
      theme: "storm city",
      style: "cinematic storm ambience",
      durationTargetSec: 30,
      provider: "mock"
    }
  });
  await scheduleStore.update(schedule.id, {
    nextRunAt: "2026-03-23T07:30:00.000Z"
  });

  let running = true;
  const jobStore = {
    rootDir: path.join(rootDir, "jobs"),
    list: async () => (running ? [{ id: "job_running", status: "running" }] : []),
    getById: async () => null,
    update: async () => null
  };

  await runSchedulesTick({
    scheduleStore,
    jobStore,
    now: new Date("2026-03-23T08:00:00.000Z"),
    createJobImpl: async () => {
      throw new Error("should_not_dispatch");
    }
  });

  running = false;
  const createdInputs = [];
  const result = await runSchedulesTick({
    scheduleStore,
    jobStore,
    now: new Date("2026-03-23T08:05:00.000Z"),
    createJobImpl: async ({ input }) => {
      createdInputs.push(input);
      return {
        job: {
          id: "job_2"
        }
      };
    }
  });

  assert.equal(result.dispatched?.scheduleId, schedule.id);
  assert.equal(createdInputs.length, 1);
  assert.equal(createdInputs[0].theme, "storm city");
  assert.equal((await listQueuedScheduleRuns({ rootDir: scheduleStore.rootDir })).length, 0);
});
