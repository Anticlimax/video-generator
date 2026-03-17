import test from "node:test";
import assert from "node:assert/strict";
import { buildMusicPrompt } from "../../src/lib/music-prompt.js";

test("buildMusicPrompt emphasizes low-dynamics piano ambient output", () => {
  const prompt = buildMusicPrompt({
    themeId: "sleep-piano",
    promptSeed: "simple piano melody"
  });
  assert.match(prompt, /low dynamics/i);
  assert.match(prompt, /simple piano/i);
  assert.doesNotMatch(prompt, /drums/i);
  assert.match(prompt, /loop/i);
});
