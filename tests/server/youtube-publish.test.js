import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createJobStore } from "../../src/server/jobs/job-store.js";
import { publishVideo } from "../../src/server/publish/youtube.js";
import { runJob } from "../../src/server/jobs/run-job.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ambient-youtube-publish-"));
}

test("publishVideo builds metadata defaults and delegates to an injected uploader", async () => {
  const videoPath = path.join(makeTempDir(), "final.mp4");
  fs.writeFileSync(videoPath, "video");

  let capturedInput = null;
  const result = await publishVideo({
    videoPath,
    theme: "storm city",
    style: "cinematic storm ambience",
    runtimeConfig: {
      youtubeUploadImpl: async (input) => {
        capturedInput = input;
        return {
          videoId: "abc123",
          url: "https://www.youtube.com/watch?v=abc123",
          studioUrl: "https://studio.youtube.com/video/abc123/edit"
        };
      }
    }
  });

  assert.deepEqual(capturedInput, {
    videoPath,
    title: "storm city - cinematic storm ambience",
    description: "Theme: storm city\nStyle: cinematic storm ambience",
    tags: ["storm city", "cinematic storm ambience"],
    privacyStatus: "private",
    category: "10"
  });
  assert.equal(result.ok, true);
  assert.equal(result.videoId, "abc123");
  assert.equal(result.url, "https://www.youtube.com/watch?v=abc123");
  assert.equal(result.studioUrl, "https://studio.youtube.com/video/abc123/edit");
});

test("publishVideo shells out and parses the publisher output", async () => {
  const videoPath = path.join(makeTempDir(), "final.mp4");
  fs.writeFileSync(videoPath, "video");

  let commandSeen = null;
  const result = await publishVideo({
    videoPath,
    theme: "ocean",
    style: "calm piano",
    runtimeConfig: {
      youtubePublisherScriptPath: "/tmp/youtube_upload.py"
    },
    runCommandImpl: async (command, args) => {
      commandSeen = { command, args };
      return {
        stdout:
          "视频 ID: abc999\n链接: https://www.youtube.com/watch?v=abc999\nStudio: https://studio.youtube.com/video/abc999/edit\n",
        stderr: ""
      };
    }
  });

  assert.equal(commandSeen?.command, "python3");
  assert.equal(commandSeen?.args[0], "/tmp/youtube_upload.py");
  assert.equal(commandSeen?.args[1], "upload");
  assert.equal(commandSeen?.args[2], videoPath);
  assert.equal(result.videoId, "abc999");
  assert.equal(result.url, "https://www.youtube.com/watch?v=abc999");
  assert.equal(result.studioUrl, "https://studio.youtube.com/video/abc999/edit");
});

test("runJob publishes to YouTube when requested and keeps the core job completed", async () => {
  const rootDir = makeTempDir();
  const store = createJobStore({
    rootDir,
    now: (() => {
      let tick = 0;
      return () => new Date(1773993600000 + tick++ * 1000);
    })(),
    randomSuffix: () => "pub1"
  });

  const created = await store.create({
    theme: "ocean",
    style: "calm piano",
    durationTargetSec: 30,
    provider: "mock",
    publishToYouTube: true
  });

  const completed = await runJob({
    jobId: created.id,
    store,
    generateMusicImpl: async () => ({
      masterAudioPath: path.join(rootDir, created.id, "master_audio.wav"),
      masterDurationSec: 30,
      provider: "mock"
    }),
    generateCoverImpl: async () => ({
      imagePath: path.join(rootDir, created.id, "cover_image.png")
    }),
    renderVideoImpl: async () => ({
      finalOutputPath: path.join(rootDir, "outputs", "ocean-calm.mp4"),
      ffprobeSummary: { videoStreams: 1, audioStreams: 1 },
      fileSizes: { finalBytes: 2048 }
    }),
    publishVideoImpl: async (input) => {
      assert.equal(input.videoPath, path.join(rootDir, "outputs", "ocean-calm.mp4"));
      assert.equal(input.theme, "ocean");
      assert.equal(input.style, "calm piano");
      return {
        videoId: "yt-123",
        url: "https://www.youtube.com/watch?v=yt-123",
        studioUrl: "https://studio.youtube.com/video/yt-123/edit"
      };
    }
  });

  assert.equal(completed.status, "completed");
  assert.equal(completed.stage, "completed");
  assert.equal(completed.youtubeVideoId, "yt-123");
  assert.equal(completed.youtubeUrl, "https://www.youtube.com/watch?v=yt-123");
  assert.equal(completed.errorCode, null);
  assert.equal(completed.errorMessage, null);
});

test("runJob records publish failure separately without failing the core job", async () => {
  const rootDir = makeTempDir();
  const store = createJobStore({
    rootDir,
    now: () => new Date("2026-03-20T10:00:00Z"),
    randomSuffix: () => "pub2"
  });

  const created = await store.create({
    theme: "ocean",
    style: "calm piano",
    durationTargetSec: 30,
    provider: "mock",
    publishToYouTube: true
  });

  const completed = await runJob({
    jobId: created.id,
    store,
    generateMusicImpl: async () => ({
      masterAudioPath: path.join(rootDir, created.id, "master_audio.wav"),
      masterDurationSec: 30,
      provider: "mock"
    }),
    generateCoverImpl: async () => ({
      imagePath: path.join(rootDir, created.id, "cover_image.png")
    }),
    renderVideoImpl: async () => ({
      finalOutputPath: path.join(rootDir, "outputs", "ocean-calm.mp4"),
      ffprobeSummary: { videoStreams: 1, audioStreams: 1 },
      fileSizes: { finalBytes: 2048 }
    }),
    publishVideoImpl: async () => {
      throw new Error("youtube_upload_failed");
    }
  });

  assert.equal(completed.status, "completed");
  assert.equal(completed.stage, "completed");
  assert.equal(completed.finalVideoPath, path.join(rootDir, "outputs", "ocean-calm.mp4"));
  assert.equal(completed.youtubeUrl, null);
  assert.equal(completed.youtubeVideoId, null);
  assert.equal(completed.errorCode, "youtube_upload_failed");
  assert.equal(completed.errorMessage, "youtube_upload_failed");
});
