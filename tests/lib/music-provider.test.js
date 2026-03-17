import test from "node:test";
import assert from "node:assert/strict";
import { resolveMusicProvider } from "../../src/lib/music-provider.js";

test("resolveMusicProvider defaults to mock when infsh is disabled", () => {
  const provider = resolveMusicProvider({ mode: "mock" });
  assert.equal(provider.name, "mock");
});

test("normalizeResult enforces wav 48k stereo 16-bit output spec", async () => {
  const provider = resolveMusicProvider({ mode: "mock" });
  const result = await provider.normalizeResult({ path: "tmp/input.mp3" });
  assert.equal(result.audioSpec.format, "wav");
  assert.equal(result.audioSpec.sampleRate, 48000);
  assert.equal(result.audioSpec.channels, 2);
  assert.equal(result.audioSpec.bitDepth, 16);
});
