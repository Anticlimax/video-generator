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

test("infsh provider requires an explicit app id and builds a runnable request", () => {
  const provider = resolveMusicProvider({
    mode: "infsh",
    infshAppId: "example/ambient-audio@latest"
  });

  const request = provider.prepareRequest({
    prompt: "soft ambient piano",
    durationSec: 120
  });

  assert.equal(provider.name, "infsh");
  assert.equal(request.command, "infsh");
  assert.equal(request.args[0], "app");
  assert.equal(request.args[1], "run");
  assert.equal(request.args[2], "example/ambient-audio@latest");
  assert.equal(request.args[3], "--input");
  assert.match(request.args[4], /soft ambient piano/);
});

test("infsh provider rejects missing app id", () => {
  assert.throws(
    () => resolveMusicProvider({ mode: "infsh" }),
    /infsh_app_id_required/
  );
});
