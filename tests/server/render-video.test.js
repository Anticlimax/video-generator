import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { renderVideo } from "../../src/core/media/render-video.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ambient-render-video-"));
}

test("renderVideo creates audio, video, and final output artifacts", async () => {
  const rootDir = makeTempDir();
  const outputDir = path.join(rootDir, "outputs");
  const sourceAudioPath = path.join(rootDir, "input.wav");
  const sourceImagePath = path.join(rootDir, "cover.png");
  await fs.promises.writeFile(sourceAudioPath, "source wav");
  await fs.promises.writeFile(sourceImagePath, "source png");

  const commands = [];

  const result = await renderVideo({
    rootDir,
    outputRootDir: outputDir,
    now: () => new Date("2026-03-20T09:20:00Z"),
    randomSuffix: () => "r123",
    masterAudioPath: sourceAudioPath,
    imagePath: sourceImagePath,
    durationTargetSec: 12,
    outputName: "storm-output",
    runCommandImpl: async (command, args) => {
      commands.push({ command, args });
      const outputPath = args[args.length - 1];
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.promises.writeFile(outputPath, "generated");
    },
    probeMediaImpl: async () => ({
      streams: [{ codec_type: "video" }, { codec_type: "audio" }],
      format: { duration: "12.0", size: "1234" }
    })
  });

  assert.equal(result.jobId, "job_20260320_092000_r123");
  assert.equal(result.durationSec, 12);
  assert.equal(result.finalOutputPath, path.join(outputDir, "storm-output.mp4"));
  assert.equal(fs.existsSync(result.audioOutputPath), true);
  assert.equal(fs.existsSync(result.videoOutputPath), true);
  assert.equal(fs.existsSync(result.finalOutputPath), true);
  assert.deepEqual(result.ffprobeSummary, {
    videoStreams: 1,
    audioStreams: 1
  });
  assert.deepEqual(commands.map((entry) => entry.command), ["ffmpeg", "ffmpeg", "ffmpeg"]);
});

test("renderVideo writes artifacts into the provided job workspace", async () => {
  const rootDir = makeTempDir();
  const outputDir = path.join(rootDir, "outputs");
  const jobDir = path.join(rootDir, "jobs", "job_20260320_092000_web01");
  const sourceAudioPath = path.join(jobDir, "master_audio.wav");
  const sourceImagePath = path.join(jobDir, "cover.png");
  await fs.promises.mkdir(jobDir, { recursive: true });
  await fs.promises.writeFile(sourceAudioPath, "source wav");
  await fs.promises.writeFile(sourceImagePath, "source png");

  const result = await renderVideo({
    rootDir,
    outputRootDir: outputDir,
    jobDir,
    artifactPaths: {
      extendedAudioPath: path.join(jobDir, "extended_audio.wav"),
      loopVideoPath: path.join(jobDir, "loop_video.mp4"),
      ffprobePath: path.join(jobDir, "ffprobe.json")
    },
    now: () => new Date("2026-03-20T09:20:00Z"),
    randomSuffix: () => "r123",
    masterAudioPath: sourceAudioPath,
    imagePath: sourceImagePath,
    durationTargetSec: 12,
    outputName: "storm-output",
    runCommandImpl: async (command, args) => {
      const outputPath = args[args.length - 1];
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.promises.writeFile(outputPath, "generated");
    },
    probeMediaImpl: async () => ({
      streams: [{ codec_type: "video" }, { codec_type: "audio" }],
      format: { duration: "12.0", size: "1234" }
    })
  });

  assert.equal(result.jobDir, jobDir);
  assert.equal(result.audioOutputPath, path.join(jobDir, "extended_audio.wav"));
  assert.equal(result.videoOutputPath, path.join(jobDir, "loop_video.mp4"));
  assert.equal(result.finalOutputPath, path.join(outputDir, "storm-output.mp4"));
});

test("renderVideo prefers a motion video path when provided", async () => {
  const rootDir = makeTempDir();
  const outputDir = path.join(rootDir, "outputs");
  const jobDir = path.join(rootDir, "jobs", "job_20260320_092000_web02");
  const sourceAudioPath = path.join(jobDir, "master_audio.wav");
  const motionVideoPath = path.join(jobDir, "motion.mp4");
  await fs.promises.mkdir(jobDir, { recursive: true });
  await fs.promises.writeFile(sourceAudioPath, "source wav");
  await fs.promises.writeFile(motionVideoPath, "motion mp4");

  const commands = [];

  const result = await renderVideo({
    rootDir,
    outputRootDir: outputDir,
    jobDir,
    artifactPaths: {
      extendedAudioPath: path.join(jobDir, "extended_audio.wav"),
      loopVideoPath: path.join(jobDir, "loop_video.mp4"),
      ffprobePath: path.join(jobDir, "ffprobe.json")
    },
    now: () => new Date("2026-03-20T09:20:00Z"),
    randomSuffix: () => "r456",
    masterAudioPath: sourceAudioPath,
    motionVideoPath,
    durationTargetSec: 12,
    outputName: "storm-output",
    runCommandImpl: async (command, args) => {
      commands.push({ command, args });
      const outputPath = args[args.length - 1];
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.promises.writeFile(outputPath, "generated");
    },
    probeMediaImpl: async () => ({
      streams: [{ codec_type: "video" }, { codec_type: "audio" }],
      format: { duration: "12.0", size: "1234" }
    })
  });

  assert.equal(result.finalOutputPath, path.join(outputDir, "storm-output.mp4"));
  assert.equal(commands.length, 3);
  assert.equal(commands[1].args.includes(motionVideoPath), true);
  assert.equal(commands[1].args.includes("-stream_loop"), true);
});
