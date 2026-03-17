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

test("buildVideoLoopArgs builds a drifting star field for soft-stars", () => {
  const args = buildVideoLoopArgs({
    videoTemplateId: "soft-stars",
    durationTargetSec: 120,
    outputPath: "jobs/job_001/loop_video.mp4"
  });
  const command = args.join(" ");
  assert.match(command, /color=c=0x030611/);
  assert.ok(command.split("overlay=").length - 1 >= 8);
  assert.match(command, /sqrt\(2\.25\)/);
  assert.match(command, /sqrt\(12\.25\)/);
  assert.match(command, /sqrt\(56\.25\)/);
  assert.match(command, /sqrt\(240\.25\)/);
  assert.match(command, /format=rgba/);
  assert.match(command, /geq=r='/);
  assert.match(command, /a='if\(lte/);
  assert.match(command, /sqrt\(/);
  assert.match(command, /pow\(/);
  assert.match(command, /mod\(/);
  assert.match(command, /main_w\+overlay_w/);
  assert.match(command, /sin\(t\//);
  assert.match(command, /cos\(t\//);
  assert.match(command, /c=0x9bbcff/);
  assert.match(command, /c=0xb8fff6/);
  assert.match(command, /c=0xfff3d6/);
  assert.match(command, /tmix=frames=3/);
  assert.match(command, /-map \[vout\]/);
  assert.match(command, /eq=brightness=/);
  assert.match(command, /libx264/);
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
