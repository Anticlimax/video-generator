import path from "node:path";

import { createJobStore } from "../jobs/job-store.js";
import { createScheduleStore } from "./schedule-store.js";
import { runSchedulesTick } from "./run-schedules.js";
import { resolveRuntimeConfig } from "../config/runtime-config.js";

const RUNNER_KEY = "__ambientScheduleRunner";

function resolveIntervalMs(env = process.env) {
  const parsed = Number(env.SCHEDULE_TICK_INTERVAL_MS || 60000);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 60000;
  }
  return parsed;
}

function shouldEnableRunner(env = process.env) {
  const explicit = String(env.ENABLE_SCHEDULE_RUNNER || "").trim().toLowerCase();
  if (explicit === "true") {
    return true;
  }
  if (explicit === "false") {
    return false;
  }
  return env.NODE_ENV === "production";
}

export function startScheduleRunner({
  env = process.env,
  setIntervalImpl = setInterval,
  tickImpl = runSchedulesTick
} = {}) {
  if (!shouldEnableRunner(env)) {
    return null;
  }

  const globalState = globalThis;
  if (globalState[RUNNER_KEY]?.timer) {
    return globalState[RUNNER_KEY];
  }

  const scheduleStore = createScheduleStore({
    rootDir: path.join(process.cwd(), "schedules")
  });
  const jobStore = createJobStore({
    rootDir: path.join(process.cwd(), "jobs")
  });
  const runtimeConfig = resolveRuntimeConfig(env);
  const intervalMs = resolveIntervalMs(env);

  const tick = () =>
    Promise.resolve(
      tickImpl({
        scheduleStore,
        jobStore,
        runtimeConfig
      })
    ).catch((error) => {
      console.error("[schedules] tick failed", error);
    });

  const timer = setIntervalImpl(tick, intervalMs);
  if (typeof timer?.unref === "function") {
    timer.unref();
  }

  const runner = {
    intervalMs,
    scheduleStore,
    jobStore,
    runtimeConfig,
    timer
  };
  globalState[RUNNER_KEY] = runner;
  void tick();
  return runner;
}

export function resetScheduleRunnerForTests() {
  delete globalThis[RUNNER_KEY];
}

export { shouldEnableRunner, resolveIntervalMs };
