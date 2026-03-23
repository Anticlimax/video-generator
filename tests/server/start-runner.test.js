import test from "node:test";
import assert from "node:assert/strict";

import {
  resetScheduleRunnerForTests,
  resolveIntervalMs,
  shouldEnableRunner,
  startScheduleRunner
} from "../../src/core/schedules/start-runner.js";

test("shouldEnableRunner defaults off outside production", () => {
  assert.equal(shouldEnableRunner({ NODE_ENV: "development" }), false);
  assert.equal(shouldEnableRunner({ NODE_ENV: "production" }), true);
  assert.equal(shouldEnableRunner({ ENABLE_SCHEDULE_RUNNER: "true", NODE_ENV: "development" }), true);
  assert.equal(shouldEnableRunner({ ENABLE_SCHEDULE_RUNNER: "false", NODE_ENV: "production" }), false);
});

test("resolveIntervalMs falls back to 60s for invalid input", () => {
  assert.equal(resolveIntervalMs({}), 60000);
  assert.equal(resolveIntervalMs({ SCHEDULE_TICK_INTERVAL_MS: "5000" }), 5000);
  assert.equal(resolveIntervalMs({ SCHEDULE_TICK_INTERVAL_MS: "0" }), 60000);
});

test("startScheduleRunner starts one singleton interval and triggers an immediate tick", async () => {
  resetScheduleRunnerForTests();
  const ticks = [];
  const timers = [];

  const runner = startScheduleRunner({
    env: {
      ENABLE_SCHEDULE_RUNNER: "true",
      SCHEDULE_TICK_INTERVAL_MS: "5000"
    },
    setIntervalImpl(callback, intervalMs) {
      const timer = {
        intervalMs,
        unrefCalled: false,
        unref() {
          this.unrefCalled = true;
        }
      };
      timers.push({ callback, intervalMs, timer });
      return timer;
    },
    tickImpl: async (payload) => {
      ticks.push(payload);
      return { enqueuedCount: 0, dispatched: null };
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(runner.intervalMs, 5000);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].intervalMs, 5000);
  assert.equal(timers[0].timer.unrefCalled, true);
  assert.equal(ticks.length, 1);

  const second = startScheduleRunner({
    env: {
      ENABLE_SCHEDULE_RUNNER: "true",
      SCHEDULE_TICK_INTERVAL_MS: "5000"
    },
    setIntervalImpl() {
      throw new Error("should_not_create_second_timer");
    }
  });

  assert.equal(second, runner);
  resetScheduleRunnerForTests();
});
