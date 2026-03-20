import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { generateMotionVideo, buildRunwayMotionPrompt } from "../../src/core/media/generate-motion-video.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ambient-motion-video-"));
}

test("buildRunwayMotionPrompt keeps the subtle motion constraints in place", () => {
  const prompt = buildRunwayMotionPrompt({
    theme: "rainy city",
    style: "quiet ambient",
    videoVisualPrompt: "rain on neon windows"
  });

  assert.match(prompt, /Keep the camera locked/i);
  assert.match(prompt, /rain on neon windows/i);
  assert.match(prompt, /quiet ambient/i);
});

test("generateMotionVideo creates a motion clip from Runway task output", async () => {
  const rootDir = makeTempDir();
  const jobDir = path.join(rootDir, "jobs", "job_20260321_120000_r001");
  const imagePath = path.join(jobDir, "video_image.png");
  await fs.promises.mkdir(jobDir, { recursive: true });
  await fs.promises.writeFile(imagePath, "fake png");

  const calls = [];
  const result = await generateMotionVideo({
    rootDir,
    jobDir,
    now: () => new Date("2026-03-21T12:00:00Z"),
    randomSuffix: () => "r001",
    imagePath,
    theme: "rainy city",
    style: "quiet ambient",
    videoVisualPrompt: "rain on neon windows",
    runtimeConfig: {
      runwayApiKey: "runway-key",
      runwayRequestTimeoutMs: 1000,
      runwayPollDelayMs: 0
    },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      if (url === "https://api.dev.runwayml.com/v1/image_to_video") {
        return new Response(JSON.stringify({ id: "task-123" }), { status: 200 });
      }
      if (url === "https://api.dev.runwayml.com/v1/tasks/task-123") {
        const pollCount = calls.filter((entry) => entry.url === url).length;
        if (pollCount < 2) {
          return new Response(JSON.stringify({ id: "task-123", status: "PENDING" }), {
            status: 200
          });
        }
        return new Response(
          JSON.stringify({
            id: "task-123",
            status: "SUCCEEDED",
            output: ["https://cdn.example.com/motion.mp4"]
          }),
          { status: 200 }
        );
      }
      if (url === "https://cdn.example.com/motion.mp4") {
        return new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200
        });
      }
      throw new Error(`unexpected_url:${url}`);
    },
    sleepImpl: async () => {}
  });

  assert.equal(result.ok, true);
  assert.equal(result.provider, "runway");
  assert.equal(result.taskId, "task-123");
  assert.equal(result.motionVideoPath, path.join(jobDir, "motion_video.mp4"));
  assert.equal(fs.existsSync(result.motionVideoPath), true);
  assert.equal(calls[0].url, "https://api.dev.runwayml.com/v1/image_to_video");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer runway-key");
});
