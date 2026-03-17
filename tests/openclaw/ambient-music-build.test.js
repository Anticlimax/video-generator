import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { registerAmbientTools } from "../../openclaw/index.js";

function probeJson(filePath) {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,sample_rate,channels",
      "-show_entries",
      "format=duration,format_name",
      "-of",
      "json",
      filePath
    ],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

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

  const probe = probeJson(result.data.master_audio_path);
  assert.equal(probe.format.format_name, "wav");
  assert.equal(probe.streams[0].codec_type, "audio");
  assert.equal(Number(probe.streams[0].sample_rate), 48000);
  assert.equal(probe.streams[0].channels, 2);
  assert.ok(Number(probe.format.duration) >= 239);
});
