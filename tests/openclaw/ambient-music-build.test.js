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
    duration_target_sec: 30,
    seed: "seed-2",
    mode: "infsh"
  });

  assert.equal(result.data.ok, true);
  assert.equal(result.data.audio_spec.format, "wav");
  assert.match(result.data.master_audio_path, /master_audio\.wav$/);
});

test("ambient_music_build can construct an elevenlabs provider from plugin config", async () => {
  const tools = [];
  const pcmBytes = Buffer.alloc(44100 * 2 * 2, 0);
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
          return pcmBytes.buffer.slice(
            pcmBytes.byteOffset,
            pcmBytes.byteOffset + pcmBytes.byteLength
          );
        }
      })
    }
  });

  const tool = tools.find((item) => item.name === "ambient_music_build");
  const result = await tool.execute("call_3", {
    theme_id: "sleep-piano",
    duration_target_sec: 30,
    seed: "seed-3",
    mode: "elevenlabs"
  });

  assert.equal(result.data.ok, true);
  assert.equal(result.data.audio_spec.format, "wav");
  assert.match(result.data.master_audio_path, /master_audio\.wav$/);
});

test("ambient_music_build writes a probeable wav when elevenlabs returns pcm audio", async () => {
  const tools = [];
  let fetchCalls = 0;
  const sampleRate = 44100;
  const channels = 2;
  const durationSec = 2;
  const pcmBytes = Buffer.alloc(sampleRate * channels * durationSec * 2, 0);

  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      elevenLabsApiKey: "test-key",
      fetchImpl: async (url, options) => {
        fetchCalls += 1;
        assert.equal(url, "https://api.elevenlabs.io/v1/music?output_format=pcm_44100");
        assert.equal(options.method, "POST");
        assert.equal(options.headers["xi-api-key"], "test-key");
        return {
          ok: true,
          status: 200,
          async arrayBuffer() {
            return pcmBytes.buffer.slice(
              pcmBytes.byteOffset,
              pcmBytes.byteOffset + pcmBytes.byteLength
            );
          }
        };
      }
    }
  });

  const tool = tools.find((item) => item.name === "ambient_music_build");
  const result = await tool.execute("call_4", {
    theme_id: "sleep-piano",
    duration_target_sec: durationSec,
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
