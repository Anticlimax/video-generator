import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAudioExtendArgs,
  buildVideoLoopArgs
} from "../../src/lib/ffmpeg-commands.js";

test("buildVideoLoopArgs uses a procedural fallback for default-black", () => {
  const args = buildVideoLoopArgs({
    videoTemplateId: "default-black",
    durationTargetSec: 7200,
    outputPath: "jobs/job_001/loop_video.mp4"
  });
  assert.ok(args.includes("color=c=black"));
});

test("buildAudioExtendArgs includes crossfade and loudnorm filters", () => {
  const args = buildAudioExtendArgs({
    inputPath: "jobs/job_001/master.wav",
    outputPath: "jobs/job_001/extended.wav",
    durationTargetSec: 7200,
    crossfadeDurationSec: 6,
    targetLufs: -23
  });
  assert.ok(args.join(" ").includes("acrossfade"));
  assert.ok(args.join(" ").includes("loudnorm=I=-23"));
});
