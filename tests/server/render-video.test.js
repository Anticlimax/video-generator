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
