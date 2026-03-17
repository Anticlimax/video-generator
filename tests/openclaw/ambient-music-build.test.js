import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerAmbientTools } from "../../openclaw/index.js";

test("ambient_music_build accepts a standardized theme_id, writes a job manifest, and records theme_version", async () => {
  const tools = [];
  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {}
  });

  const tool = tools.find((item) => item.name === "ambient_music_build");
  const result = await tool.execute("call_1", {
    theme_id: "sleep-piano",
    duration_target_sec: 240,
    seed: "seed-1",
    mode: "mock"
  });

  assert.equal(result.data.ok, true);
  assert.equal(result.data.theme_id, "sleep-piano");
  assert.equal(result.data.theme_version, "1.0.0");
  assert.match(result.data.master_audio_path, /master_audio\.wav$/);
  assert.equal(
    fs.existsSync(`jobs/${result.data.job_id}/manifest.json`),
    true
  );
});
