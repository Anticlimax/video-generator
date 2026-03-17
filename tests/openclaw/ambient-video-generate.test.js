import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { registerAmbientTools } from "../../openclaw/index.js";

function createMp3Buffer(durationSec = 1) {
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=220:duration=${durationSec}`,
      "-ar",
      "44100",
      "-ac",
      "2",
      "-b:a",
      "128k",
      "-f",
      "mp3",
      "pipe:1"
    ],
    { encoding: null }
  );
  assert.equal(result.status, 0, result.stderr?.toString?.() || "");
  return result.stdout;
}

function probeJson(filePath) {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type",
      "-show_entries",
      "format=duration,size",
      "-of",
      "json",
      filePath
    ],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("ambient_video_generate completes build and render in one call", async () => {
  const tools = [];
  const mp3Bytes = createMp3Buffer(2);

  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      elevenLabsApiKey: "test-key",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async arrayBuffer() {
          return mp3Bytes.buffer.slice(
            mp3Bytes.byteOffset,
            mp3Bytes.byteOffset + mp3Bytes.byteLength
          );
        }
      })
    }
  });

  const tool = tools.find((item) => item.name === "ambient_video_generate");
  const result = await tool.execute("call_1", {
    theme_id: "sleep-piano",
    duration_target_sec: 8,
    master_duration_sec: 2,
    allow_nonstandard_duration: true,
    output_name: "ambient-video-generate-smoke",
    mode: "elevenlabs"
  });

  assert.equal(result.data.ok, true);
  assert.equal(result.data.theme_id, "sleep-piano");
  assert.match(result.data.master_audio_path, /master_audio\.wav$/);
  assert.match(result.data.final_output_path, /ambient-video-generate-smoke\.mp4$/);
  assert.equal(result.data.ffprobe_summary.video_streams, 1);
  assert.equal(result.data.ffprobe_summary.audio_streams, 1);

  const probe = probeJson(result.data.final_output_path);
  const streamKinds = probe.streams.map((stream) => stream.codec_type).sort();
  assert.deepEqual(streamKinds, ["audio", "video"]);
  assert.ok(Number(probe.format.duration) >= 7.5);
  assert.ok(Number(probe.format.size) > 0);
});
