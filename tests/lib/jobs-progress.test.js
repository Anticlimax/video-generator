import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createJobWorkspace,
  writeProgress
} from "../../src/lib/jobs.js";

test("writeProgress writes progress.json inside the job directory", async () => {
  const job = await createJobWorkspace({
    rootDir: "jobs",
    now: new Date("2026-03-18T04:30:00.000Z"),
    randomSuffix: () => "prog"
  });

  const progressPath = await writeProgress(job, {
    job_id: job.jobId,
    stage: "music_generating",
    status: "running",
    progress: 25,
    message: "正在生成音乐母带",
    theme: "ocean",
    style: "calm piano",
    artifacts: {
      master_audio_path: null,
      cover_image_path: null,
      final_output_path: null
    }
  });

  assert.equal(progressPath, job.progressPath);
  assert.equal(fs.existsSync(progressPath), true);

  const payload = JSON.parse(fs.readFileSync(progressPath, "utf8"));
  assert.equal(payload.stage, "music_generating");
  assert.equal(payload.status, "running");
  assert.equal(payload.progress, 25);
  assert.equal(payload.theme, "ocean");
  assert.equal(payload.style, "calm piano");
});
