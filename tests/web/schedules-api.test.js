import test from "node:test";
import assert from "node:assert/strict";

import { createSchedulesApiHandlers } from "../../src/core/schedules/web-api.js";

function buildJsonRequest(url, body) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

test("schedules api creates a schedule and returns the created record", async () => {
  const createdSchedules = [];
  const store = {
    create: async (input) => {
      createdSchedules.push(input);
      return {
        id: "schedule_20260322_080000_a1b2",
        enabled: true,
        kind: input.kind,
        time: input.time,
        weekday: input.weekday ?? null,
        cronExpression: input.kind === "daily" ? "30 9 * * *" : "15 21 * * 5",
        timezone: input.timezone || "UTC",
        payload: input.payload,
        lastRunAt: null,
        nextRunAt: "2026-03-22T09:30:00.000Z",
        lastJobId: null,
        createdAt: "2026-03-22T08:00:00.000Z",
        updatedAt: "2026-03-22T08:00:00.000Z"
      };
    },
    list: async () => [],
    getById: async () => null,
    update: async () => null
  };

  const api = createSchedulesApiHandlers({ store });
  const response = await api.post(
    buildJsonRequest("http://localhost/api/schedules", {
      kind: "daily",
      time: "09:30",
      timezone: "UTC",
      payload: {
        theme: "storm city",
        style: "cinematic storm ambience",
        durationTargetSec: 30,
        provider: "musicgpt"
      }
    })
  );

  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.schedule.id, "schedule_20260322_080000_a1b2");
  assert.equal(createdSchedules.length, 1);
  assert.equal(createdSchedules[0].kind, "daily");
  assert.equal(createdSchedules[0].payload.theme, "storm city");
});

test("schedules api lists schedules newest first", async () => {
  const store = {
    create: async () => {
      throw new Error("not used");
    },
    list: async () => [
      {
        id: "schedule_2",
        createdAt: "2026-03-22T08:00:02.000Z",
        kind: "weekly",
        time: "21:15",
        weekday: 5,
        cronExpression: "15 21 * * 5",
        timezone: "UTC",
        payload: { theme: "second", style: "calm", durationTargetSec: 20, provider: "mock" },
        enabled: true,
        nextRunAt: "2026-03-27T21:15:00.000Z",
        lastRunAt: null,
        lastJobId: null,
        updatedAt: "2026-03-22T08:00:02.000Z"
      },
      {
        id: "schedule_1",
        createdAt: "2026-03-22T08:00:01.000Z",
        kind: "daily",
        time: "09:30",
        weekday: null,
        cronExpression: "30 9 * * *",
        timezone: "UTC",
        payload: { theme: "first", style: "calm", durationTargetSec: 10, provider: "mock" },
        enabled: true,
        nextRunAt: "2026-03-23T09:30:00.000Z",
        lastRunAt: null,
        lastJobId: null,
        updatedAt: "2026-03-22T08:00:01.000Z"
      }
    ],
    getById: async () => null,
    update: async () => null
  };

  const api = createSchedulesApiHandlers({ store });
  const response = await api.get(new Request("http://localhost/api/schedules"));

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.schedules.map((schedule) => schedule.id), ["schedule_2", "schedule_1"]);
});

test("schedules api returns 404 for a missing schedule", async () => {
  const store = {
    create: async () => {
      throw new Error("not used");
    },
    list: async () => [],
    getById: async () => null,
    update: async () => null
  };

  const api = createSchedulesApiHandlers({ store });
  const response = await api.getById(new Request("http://localhost/api/schedules/schedule_missing"), {
    params: { id: "schedule_missing" }
  });

  assert.equal(response.status, 404);
  const payload = await response.json();
  assert.equal(payload.error, "schedule_not_found");
});

test("schedules api toggles enabled state", async () => {
  const store = {
    create: async () => {
      throw new Error("not used");
    },
    list: async () => [],
    getById: async (scheduleId) =>
      scheduleId === "schedule_1"
        ? {
            id: "schedule_1",
            enabled: true,
            kind: "daily",
            time: "09:30",
            weekday: null,
            cronExpression: "30 9 * * *",
            timezone: "UTC",
            payload: { theme: "storm city", style: "calm", durationTargetSec: 30, provider: "mock" },
            nextRunAt: "2026-03-23T09:30:00.000Z",
            lastRunAt: null,
            lastJobId: null,
            createdAt: "2026-03-22T08:00:00.000Z",
            updatedAt: "2026-03-22T08:00:00.000Z"
          }
        : null,
    update: async (_scheduleId, patch) => ({
      id: "schedule_1",
      enabled: patch.enabled,
      kind: "daily",
      time: "09:30",
      weekday: null,
      cronExpression: "30 9 * * *",
      timezone: "UTC",
      payload: { theme: "storm city", style: "calm", durationTargetSec: 30, provider: "mock" },
      nextRunAt: "2026-03-23T09:30:00.000Z",
      lastRunAt: null,
      lastJobId: null,
      createdAt: "2026-03-22T08:00:00.000Z",
      updatedAt: "2026-03-22T08:05:00.000Z"
    })
  };

  const api = createSchedulesApiHandlers({ store });
  const response = await api.toggle(new Request("http://localhost/api/schedules/schedule_1/toggle", { method: "POST" }), {
    params: { id: "schedule_1" }
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.schedule.enabled, false);
});

test("schedules api runs a schedule immediately by creating a job", async () => {
  const createdInputs = [];
  const createdRuntimeConfigs = [];
  const schedule = {
    id: "schedule_1",
    enabled: true,
    kind: "daily",
    time: "09:30",
    weekday: null,
    cronExpression: "30 9 * * *",
    timezone: "UTC",
    payload: {
      theme: "storm city",
      style: "calm",
      durationTargetSec: 30,
      provider: "mock"
    },
    nextRunAt: "2026-03-23T09:30:00.000Z",
    lastRunAt: null,
    lastJobId: null,
    createdAt: "2026-03-22T08:00:00.000Z",
    updatedAt: "2026-03-22T08:00:00.000Z"
  };
  const store = {
    create: async () => {
      throw new Error("not used");
    },
    list: async () => [],
    getById: async (scheduleId) => (scheduleId === "schedule_1" ? schedule : null),
    update: async (_scheduleId, patch) => ({
      ...schedule,
      ...patch
    })
  };

  const api = createSchedulesApiHandlers({
    store,
    runtimeConfig: {
      runwayApiKey: "runway-key"
    },
    createJobImpl: async ({ input, runtimeConfig }) => {
      createdInputs.push(input);
      createdRuntimeConfigs.push(runtimeConfig);
      return {
        job: { id: "job_1" }
      };
    }
  });

  const response = await api.runNow(new Request("http://localhost/api/schedules/schedule_1/run-now", { method: "POST" }), {
    params: { id: "schedule_1" }
  });

  assert.equal(response.status, 202);
  const payload = await response.json();
  assert.equal(payload.job.id, "job_1");
  assert.equal(createdInputs.length, 1);
  assert.equal(createdInputs[0].theme, "storm city");
  assert.equal(createdRuntimeConfigs[0].runwayApiKey, "runway-key");
});

test("schedules api updates an existing schedule", async () => {
  const schedule = {
    id: "schedule_1",
    enabled: true,
    kind: "daily",
    time: "09:30",
    weekday: null,
    cronExpression: "30 9 * * *",
    timezone: "UTC",
    payload: {
      theme: "storm city",
      style: "calm",
      durationTargetSec: 30,
      provider: "mock"
    },
    nextRunAt: "2026-03-23T09:30:00.000Z",
    lastRunAt: null,
    lastJobId: null,
    createdAt: "2026-03-22T08:00:00.000Z",
    updatedAt: "2026-03-22T08:00:00.000Z"
  };

  const updates = [];
  const store = {
    create: async () => {
      throw new Error("not used");
    },
    list: async () => [],
    getById: async (scheduleId) => (scheduleId === "schedule_1" ? schedule : null),
    update: async (_scheduleId, patch) => {
      updates.push(patch);
      return {
        ...schedule,
        ...patch,
        payload: {
          ...schedule.payload,
          ...(patch.payload || {})
        }
      };
    },
    delete: async () => false
  };

  const api = createSchedulesApiHandlers({ store });
  const response = await api.patch(
    buildJsonRequest("http://localhost/api/schedules/schedule_1", {
      kind: "weekly",
      time: "21:15",
      weekday: 5,
      timezone: "UTC",
      payload: {
        theme: "night rain",
        style: "noir ambience",
        durationTargetSec: 600,
        provider: "musicgpt"
      }
    }),
    { params: { id: "schedule_1" } }
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.schedule.kind, "weekly");
  assert.equal(payload.schedule.weekday, 5);
  assert.equal(payload.schedule.payload.theme, "night rain");
  assert.equal(updates.length, 1);
});

test("schedules api deletes an existing schedule", async () => {
  const store = {
    create: async () => {
      throw new Error("not used");
    },
    list: async () => [],
    getById: async (scheduleId) => (scheduleId === "schedule_1" ? { id: "schedule_1" } : null),
    update: async () => null,
    delete: async (scheduleId) => scheduleId === "schedule_1"
  };

  const api = createSchedulesApiHandlers({ store });
  const response = await api.delete(new Request("http://localhost/api/schedules/schedule_1", { method: "DELETE" }), {
    params: { id: "schedule_1" }
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.deleted, true);
});
