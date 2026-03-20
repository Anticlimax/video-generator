import test from "node:test";
import assert from "node:assert/strict";

import {
  createJobsApiHandlers
} from "../../src/core/jobs/web-api.js";

function buildJsonRequest(url, body) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

test("jobs api creates a job and returns the created record", async () => {
  const createdJobs = [];
  const store = {
    create: async (input) => {
      createdJobs.push(input);
      return {
        id: "job_20260320_080000_a1b2",
        theme: input.theme,
        style: input.style,
        durationTargetSec: input.durationTargetSec,
        provider: input.provider || "musicgpt",
        status: "queued",
        stage: "queued",
        progress: 0,
        createdAt: "2026-03-20T08:00:00.000Z",
        updatedAt: "2026-03-20T08:00:00.000Z"
      };
    },
    list: async () => [],
    getById: async () => null
  };

  const api = createJobsApiHandlers({
    store,
    createJobImpl: async ({ store: injectedStore, input }) => {
      const job = await injectedStore.create(input);
      return { job, runPromise: Promise.resolve(job) };
    }
  });

  const response = await api.post(
    buildJsonRequest("http://localhost/api/jobs", {
      theme: "storm city",
      style: "cinematic storm ambience",
      durationTargetSec: 30,
      masterDurationSec: 20,
      provider: "musicgpt"
    })
  );

  assert.equal(response.status, 202);
  const payload = await response.json();
  assert.equal(payload.job.id, "job_20260320_080000_a1b2");
  assert.equal(payload.job.theme, "storm city");
  assert.equal(createdJobs.length, 1);
  assert.equal(createdJobs[0].provider, "musicgpt");
  assert.equal(createdJobs[0].masterDurationSec, 20);
});

test("jobs api lists jobs newest first", async () => {
  const store = {
    create: async () => {
      throw new Error("not used");
    },
    list: async () => [
      {
        id: "job_2",
        createdAt: "2026-03-20T08:00:02.000Z",
        theme: "second",
        style: "calm",
        durationTargetSec: 20,
        status: "running",
        stage: "music_generating",
        progress: 40
      },
      {
        id: "job_1",
        createdAt: "2026-03-20T08:00:01.000Z",
        theme: "first",
        style: "calm",
        durationTargetSec: 10,
        status: "queued",
        stage: "queued",
        progress: 0
      }
    ],
    getById: async () => null
  };

  const api = createJobsApiHandlers({ store });
  const response = await api.get(new Request("http://localhost/api/jobs"));

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.jobs.map((job) => job.id), ["job_2", "job_1"]);
});

test("jobs api returns 404 for a missing job", async () => {
  const store = {
    create: async () => {
      throw new Error("not used");
    },
    list: async () => [],
    getById: async () => null
  };

  const api = createJobsApiHandlers({ store });
  const response = await api.getById(new Request("http://localhost/api/jobs/job_missing"), {
    params: { id: "job_missing" }
  });

  assert.equal(response.status, 404);
  const payload = await response.json();
  assert.equal(payload.error, "job_not_found");
});
