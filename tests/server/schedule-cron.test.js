import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCronExpression,
  computeNextRunAt
} from "../../src/core/schedules/cron.js";

test("buildCronExpression creates daily cron expressions", () => {
  assert.equal(
    buildCronExpression({
      kind: "daily",
      time: "09:30"
    }),
    "30 9 * * *"
  );
});

test("buildCronExpression creates weekly cron expressions", () => {
  assert.equal(
    buildCronExpression({
      kind: "weekly",
      time: "21:15",
      weekday: 5
    }),
    "15 21 * * 5"
  );
});

test("computeNextRunAt returns the same-day future run for daily schedules", () => {
  assert.equal(
    computeNextRunAt({
      kind: "daily",
      time: "09:30",
      now: "2026-03-22T08:00:00.000Z"
    }),
    "2026-03-22T09:30:00.000Z"
  );
});

test("computeNextRunAt rolls daily schedules to the next day when the time already passed", () => {
  assert.equal(
    computeNextRunAt({
      kind: "daily",
      time: "09:30",
      now: "2026-03-22T10:00:00.000Z"
    }),
    "2026-03-23T09:30:00.000Z"
  );
});

test("computeNextRunAt returns the same-week future run for weekly schedules", () => {
  assert.equal(
    computeNextRunAt({
      kind: "weekly",
      time: "09:30",
      weekday: 3,
      now: "2026-03-22T08:00:00.000Z"
    }),
    "2026-03-25T09:30:00.000Z"
  );
});

test("computeNextRunAt rolls weekly schedules to the next week when needed", () => {
  assert.equal(
    computeNextRunAt({
      kind: "weekly",
      time: "09:30",
      weekday: 0,
      now: "2026-03-22T10:00:00.000Z"
    }),
    "2026-03-29T09:30:00.000Z"
  );
});
