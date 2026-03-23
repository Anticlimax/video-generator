import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { computeNextRunAt } from "./cron.js";
import { createJob } from "../jobs/create-job.js";

function normalizeNow(now) {
  if (typeof now === "function") {
    return now();
  }
  return now || new Date();
}

function queueRoot(rootDir) {
  return path.join(rootDir, "__queue");
}

function queueFilePath(rootDir, runId) {
  return path.join(queueRoot(rootDir), `${runId}.json`);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function listQueueFiles(rootDir) {
  try {
    const entries = await fs.readdir(queueRoot(rootDir), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(queueRoot(rootDir), entry.name));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function listQueuedScheduleRuns({ rootDir = "schedules" } = {}) {
  const runs = [];
  for (const filePath of await listQueueFiles(rootDir)) {
    runs.push(await readJson(filePath));
  }
  runs.sort((left, right) => {
    const compare = String(left.enqueuedAt).localeCompare(String(right.enqueuedAt));
    if (compare !== 0) {
      return compare;
    }
    return String(left.id).localeCompare(String(right.id));
  });
  return runs;
}

async function enqueueScheduleRun({ rootDir, schedule, nowIso }) {
  const existing = await listQueuedScheduleRuns({ rootDir });
  const duplicate = existing.find((run) => run.scheduleId === schedule.id && run.dueAt === schedule.nextRunAt);
  if (duplicate) {
    return false;
  }

  const run = {
    id: `schedule_run_${nowIso.replace(/[-:.TZ]/g, "").slice(0, 14)}_${randomUUID().slice(0, 4)}`,
    scheduleId: schedule.id,
    dueAt: schedule.nextRunAt,
    enqueuedAt: nowIso,
    payload: schedule.payload
  };
  await writeJson(queueFilePath(rootDir, run.id), run);
  return true;
}

async function removeQueuedRun(rootDir, runId) {
  await fs.rm(queueFilePath(rootDir, runId), { force: true });
}

export async function runSchedulesTick({
  scheduleStore,
  jobStore,
  now = new Date(),
  createJobImpl = createJob,
  runtimeConfig = {}
} = {}) {
  if (!scheduleStore) {
    throw new Error("missing_schedule_store");
  }
  if (!jobStore) {
    throw new Error("missing_job_store");
  }

  const resolvedNow = normalizeNow(now);
  const nowIso = resolvedNow.toISOString();
  const schedules = await scheduleStore.list();
  let enqueuedCount = 0;

  for (const schedule of schedules) {
    if (!schedule.enabled) {
      continue;
    }
    if (String(schedule.nextRunAt) > nowIso) {
      continue;
    }

    const enqueued = await enqueueScheduleRun({
      rootDir: scheduleStore.rootDir,
      schedule,
      nowIso
    });

    if (enqueued) {
      enqueuedCount += 1;
    }

    await scheduleStore.update(schedule.id, {
      nextRunAt: computeNextRunAt({
        kind: schedule.kind,
        time: schedule.time,
        weekday: schedule.weekday,
        now: schedule.nextRunAt
      })
    });
  }

  const runningJobs = await jobStore.list();
  if (runningJobs.some((job) => job.status === "running")) {
    return {
      enqueuedCount,
      dispatched: null
    };
  }

  const queue = await listQueuedScheduleRuns({ rootDir: scheduleStore.rootDir });
  const nextRun = queue[0];
  if (!nextRun) {
    return {
      enqueuedCount,
      dispatched: null
    };
  }

  const created = await createJobImpl({
    store: jobStore,
    input: nextRun.payload,
    runtimeConfig
  });

  await scheduleStore.update(nextRun.scheduleId, {
    lastRunAt: nowIso,
    lastJobId: created?.job?.id || null
  });
  await removeQueuedRun(scheduleStore.rootDir, nextRun.id);

  return {
    enqueuedCount,
    dispatched: {
      scheduleId: nextRun.scheduleId,
      jobId: created?.job?.id || null
    }
  };
}
