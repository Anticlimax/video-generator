import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { generateRainLayerDemo } from "../../src/core/media/generate-rain-layer-demo.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ambient-rain-layer-demo-"));
}

test("generateRainLayerDemo creates a playable rain demo clip from a static image", async () => {
  const rootDir = makeTempDir();
  const imagePath = path.join(rootDir, "source.png");
  fs.writeFileSync(imagePath, "fake image");

  const written = [];

  const result = await generateRainLayerDemo({
    rootDir,
    imagePath,
    outputName: "rain-layer-demo",
    frameGeneratorImpl: async ({ framesDir, frameCount }) => {
      await fs.promises.mkdir(framesDir, { recursive: true });
      for (let index = 0; index < frameCount; index += 1) {
        const framePath = path.join(framesDir, `frame-${String(index).padStart(4, "0")}.png`);
        await fs.promises.writeFile(framePath, "frame");
        written.push(framePath);
      }
    },
    runCommandImpl: async (_command, args) => {
      const outputPath = args[args.length - 1];
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.promises.writeFile(outputPath, "video");
    },
    probeMediaImpl: async () => ({
      streams: [{ codec_type: "video" }],
      format: { duration: "5.0", size: "1234" }
    })
  });

  assert.equal(written.length > 0, true);
  assert.equal(result.durationSec, 5);
  assert.equal(fs.existsSync(result.outputPath), true);
  assert.deepEqual(result.ffprobeSummary, {
    videoStreams: 1,
    audioStreams: 0
  });
});
