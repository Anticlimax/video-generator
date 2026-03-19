import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { generateMusic } from "../../src/server/media/generate-music.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ambient-generate-music-"));
}

test("generateMusic builds a mock ambient master artifact", async () => {
  const rootDir = makeTempDir();
  const calls = [];

  const result = await generateMusic({
    rootDir,
    now: () => new Date("2026-03-20T09:00:00Z"),
    randomSuffix: () => "m123",
    theme: "storm city",
    style: "cinematic storm ambience",
    durationTargetSec: 30,
    masterDurationSec: 10,
    mode: "mock",
    runCommandImpl: async (command, args) => {
      calls.push({ command, args });
      const outputPath = args[args.length - 1];
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.promises.writeFile(outputPath, "fake wav");
    }
  });

  assert.equal(result.jobId, "job_20260320_090000_m123");
  assert.equal(result.provider, "mock");
  assert.equal(result.targetDurationSec, 30);
  assert.equal(result.masterDurationSec, 10);
  assert.equal(result.audioSpec.format, "wav");
  assert.equal(result.masterAudioPath, path.join(rootDir, result.jobId, "master_audio.wav"));
  assert.match(result.prompt, /storm city/i);
  assert.equal(fs.existsSync(result.masterAudioPath), true);
  assert.deepEqual(calls.map((entry) => entry.command), ["ffmpeg"]);
});
