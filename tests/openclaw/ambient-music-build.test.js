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
    duration_target_sec: 3600,
    seed: "seed-1",
    mode: "mock"
  });

  assert.equal(result.data.ok, true);
  assert.equal(result.data.theme_id, "sleep-piano");
  assert.equal(result.data.theme_version, "1.0.0");
  assert.equal(result.data.target_duration_sec, 3600);
  assert.equal(result.data.master_duration_sec, 180);
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
  assert.ok(Number(probe.format.duration) >= 179);
});

test("ambient_music_build can construct an infsh provider from plugin config", async () => {
  const tools = [];
  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      infshAppId: "example/ambient-audio@latest"
    }
  });

  const tool = tools.find((item) => item.name === "ambient_music_build");
  const result = await tool.execute("call_2", {
    theme_id: "sleep-piano",
    duration_target_sec: 3600,
    master_duration_sec: 30,
    seed: "seed-2",
    mode: "infsh"
  });

  assert.equal(result.data.ok, true);
  assert.equal(result.data.audio_spec.format, "wav");
  assert.match(result.data.master_audio_path, /master_audio\.wav$/);
});

test("ambient_music_build can construct an elevenlabs provider from plugin config", async () => {
  const tools = [];
  const mp3Bytes = createMp3Buffer(1);
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

  const tool = tools.find((item) => item.name === "ambient_music_build");
  const result = await tool.execute("call_3", {
    theme_id: "sleep-piano",
    duration_target_sec: 3600,
    master_duration_sec: 30,
    seed: "seed-3",
    mode: "elevenlabs"
  });

  assert.equal(result.data.ok, true);
  assert.equal(result.data.audio_spec.format, "wav");
  assert.match(result.data.master_audio_path, /master_audio\.wav$/);
});

test("ambient_music_build writes a probeable wav when elevenlabs returns mp3 audio", async () => {
  const tools = [];
  let fetchCalls = 0;
  const durationSec = 2;
  const mp3Bytes = createMp3Buffer(durationSec);

  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      elevenLabsApiKey: "test-key",
      fetchImpl: async (url, options) => {
        fetchCalls += 1;
        assert.equal(url, "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128");
        assert.equal(options.method, "POST");
        assert.equal(options.headers["xi-api-key"], "test-key");
        return {
          ok: true,
          status: 200,
          async arrayBuffer() {
            return mp3Bytes.buffer.slice(
              mp3Bytes.byteOffset,
              mp3Bytes.byteOffset + mp3Bytes.byteLength
            );
          }
        };
      }
    }
  });

  const tool = tools.find((item) => item.name === "ambient_music_build");
  const result = await tool.execute("call_4", {
    theme_id: "sleep-piano",
    duration_target_sec: 1800,
    master_duration_sec: durationSec,
    seed: "seed-4",
    mode: "elevenlabs"
  });

  assert.equal(fetchCalls, 1);
  const probe = probeJson(result.data.master_audio_path);
  assert.equal(probe.format.format_name, "wav");
  assert.equal(probe.streams[0].codec_type, "audio");
  assert.equal(Number(probe.streams[0].sample_rate), 48000);
  assert.equal(probe.streams[0].channels, 2);
});
