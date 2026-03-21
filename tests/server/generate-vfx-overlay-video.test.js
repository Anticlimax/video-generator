import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { generateVfxOverlayVideo } from "../../src/core/media/generate-vfx-overlay-video.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ambient-vfx-overlay-"));
}

test("generateVfxOverlayVideo composites an EXR overlay sequence over a still image", async () => {
  const rootDir = makeTempDir();
  const jobDir = path.join(rootDir, "jobs", "job_20260321_210000_vfx01");
  const imagePath = path.join(jobDir, "video_image.png");
  await fs.promises.mkdir(jobDir, { recursive: true });
  await fs.promises.writeFile(imagePath, "fake png");

  const commands = [];

  const result = await generateVfxOverlayVideo({
    rootDir,
    jobDir,
    imagePath,
    overlayPattern: "assets/vfx/RainOnGlass-004/RainOnGlass-004.%04d.exr",
    startNumber: 1001,
    durationSec: 5,
    overlayOpacity: 0.9,
    runCommandImpl: async (command, args) => {
      commands.push({ command, args });
      const outputPath = args[args.length - 1];
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.promises.writeFile(outputPath, "generated");
    },
    probeMediaImpl: async () => ({
      streams: [{ codec_type: "video" }],
      format: { duration: "5.0", size: "1234" }
    })
  });

  assert.equal(result.ok, true);
  assert.equal(result.motionVideoPath, path.join(jobDir, "motion_video.mp4"));
  assert.equal(fs.existsSync(result.motionVideoPath), true);
  assert.equal(commands.length, 1);
  assert.equal(commands[0].command, "ffmpeg");
  assert.equal(commands[0].args.includes(imagePath), true);
  assert.equal(commands[0].args.includes("assets/vfx/RainOnGlass-004/RainOnGlass-004.%04d.exr"), true);
  assert.equal(commands[0].args.includes("1001"), true);
  assert.match(commands[0].args.join(" "), /colorchannelmixer=aa=0.9/);
  assert.match(commands[0].args.join(" "), /overlay=shortest=1:format=auto/);
});
