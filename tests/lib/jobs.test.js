import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createJobWorkspace,
  writeManifest
} from "../../src/lib/jobs.js";

test("createJobWorkspace creates a stable job directory layout", async () => {
  const job = await createJobWorkspace({
    rootDir: "jobs",
    now: new Date("2026-03-17T10:00:00Z"),
    randomSuffix: () => "a3f2"
  });
  assert.match(job.jobId, /^job_20260317_100000_[a-z0-9]{4}$/);
  assert.equal(fs.existsSync(job.jobDir), true);
});

test("writeManifest writes manifest.json inside the job directory", async () => {
  const job = await createJobWorkspace({
    rootDir: "jobs",
    now: new Date("2026-03-17T10:00:00Z"),
    randomSuffix: () => "a3f2"
  });
  const manifestPath = await writeManifest(job, { ok: true, themeId: "sleep-piano" });
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.themeId, "sleep-piano");
});

test("createJobWorkspace generates unique ids for repeated calls on the same date", async () => {
  const first = await createJobWorkspace({
    rootDir: "jobs",
    now: new Date("2026-03-17T10:00:00Z"),
    randomSuffix: () => "a3f2"
  });
  const second = await createJobWorkspace({
    rootDir: "jobs",
    now: new Date("2026-03-17T10:00:00Z"),
    randomSuffix: () => "b4c5"
  });
  assert.notEqual(first.jobId, second.jobId);
});
