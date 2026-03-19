import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildCoverPrompt, generateCover } from "../../src/server/media/generate-cover.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ambient-generate-cover-"));
}

test("buildCoverPrompt keeps free-text theme and style in the prompt", () => {
  const prompt = buildCoverPrompt({
    theme: "mysterious forest",
    style: "soft moonlit ambience",
    resolvedTheme: {
      label: "Meditation Ambient",
      description: "airy, calm, low stimulation"
    }
  });

  assert.match(prompt, /mysterious forest/i);
  assert.match(prompt, /soft moonlit ambience/i);
  assert.match(prompt, /low stimulation/i);
});

test("generateCover creates a cover artifact through the injected generator", async () => {
  const rootDir = makeTempDir();
  const calls = [];

  const result = await generateCover({
    rootDir,
    now: () => new Date("2026-03-20T09:10:00Z"),
    randomSuffix: () => "c123",
    theme: "mysterious forest",
    style: "soft moonlit ambience",
    outputName: "forest-cover",
    coverGeneratorImpl: async ({ outputPath, prompt }) => {
      calls.push({ outputPath, prompt });
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.promises.writeFile(outputPath, "fake png");
      return {
        imagePath: outputPath,
        prompt,
        provider: "test-cover-provider"
      };
    }
  });

  assert.equal(result.jobId, "job_20260320_091000_c123");
  assert.equal(result.provider, "test-cover-provider");
  assert.equal(result.imagePath, path.join(rootDir, result.jobId, "cover_image.png"));
  assert.equal(fs.existsSync(result.imagePath), true);
  assert.equal(calls.length, 1);
});
