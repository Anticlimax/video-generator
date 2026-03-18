import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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
      }),
      coverGeneratorImpl: async ({ outputPath, prompt }) => {
        const result = spawnSync(
          "ffmpeg",
          [
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=0x101828:s=1280x720:d=1",
            "-frames:v",
            "1",
            outputPath
          ],
          { encoding: "utf8" }
        );
        assert.equal(result.status, 0, result.stderr);
        return {
          imagePath: outputPath,
          prompt,
          provider: "mock-cover"
        };
      }
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

test("ambient_video_generate can resolve free-text theme and style and render via a generated cover", async () => {
  const tools = [];
  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      coverGeneratorImpl: async ({ outputPath, prompt }) => {
        const result = spawnSync(
          "ffmpeg",
          [
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=0x162033:s=1280x720:d=1",
            "-frames:v",
            "1",
            outputPath
          ],
          { encoding: "utf8" }
        );
        assert.equal(result.status, 0, result.stderr);
        return {
          imagePath: outputPath,
          prompt,
          provider: "mock-cover"
        };
      }
    }
  });

  const tool = tools.find((item) => item.name === "ambient_video_generate");
  const result = await tool.execute("call_2", {
    theme: "ocean",
    style: "ocean piano",
    duration_target_sec: 8,
    master_duration_sec: 2,
    allow_nonstandard_duration: true,
    output_name: "ambient-video-generate-free-text",
    mode: "mock"
  });

  assert.equal(result.data.ok, true);
  assert.equal(result.data.theme_id, "meditation-ambient");
  assert.match(result.data.final_output_path, /ambient-video-generate-free-text\.mp4$/);
  const probe = probeJson(result.data.final_output_path);
  const streamKinds = probe.streams.map((stream) => stream.codec_type).sort();
  assert.deepEqual(streamKinds, ["audio", "video"]);
  assert.ok(Number(probe.format.duration) >= 7.5);
});

test("ambient_video_generate writes progress.json and reports stage events", async () => {
  const tools = [];
  const progressEvents = [];

  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      progressObserver(event) {
        progressEvents.push({
          stage: event.stage,
          status: event.status,
          progress: event.progress
        });
      },
      coverGeneratorImpl: async ({ outputPath, prompt }) => {
        const result = spawnSync(
          "ffmpeg",
          [
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=0x162033:s=1280x720:d=1",
            "-frames:v",
            "1",
            outputPath
          ],
          { encoding: "utf8" }
        );
        assert.equal(result.status, 0, result.stderr);
        return {
          imagePath: outputPath,
          prompt,
          provider: "mock-cover"
        };
      }
    }
  });

  const tool = tools.find((item) => item.name === "ambient_video_generate");
  const result = await tool.execute("call_3", {
    theme: "ocean",
    style: "calm piano",
    duration_target_sec: 8,
    master_duration_sec: 2,
    allow_nonstandard_duration: true,
    output_name: "ambient-video-generate-progress",
    mode: "mock"
  });

  assert.equal(result.data.ok, true);
  assert.match(result.data.progress_path, /progress\.json$/);
  assert.equal(fs.existsSync(result.data.progress_path), true);

  const progressFile = JSON.parse(fs.readFileSync(result.data.progress_path, "utf8"));
  assert.equal(progressFile.status, "done");
  assert.equal(progressFile.stage, "completed");
  assert.equal(progressFile.progress, 100);
  assert.equal(progressFile.artifacts.final_output_path, result.data.final_output_path);
  assert.equal(progressFile.theme, "ocean");
  assert.equal(progressFile.style, "calm piano");

  assert.deepEqual(
    progressEvents.map((event) => event.stage),
    [
      "queued",
      "theme_resolved",
      "music_generating",
      "music_ready",
      "cover_generating",
      "cover_ready",
      "video_rendering",
      "completed"
    ]
  );
  assert.equal(progressEvents.at(-1)?.progress, 100);
});

test("ambient_video_generate relays progress updates when telegram context is provided", async () => {
  const tools = [];
  const relayEvents = [];

  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      telegramProgressRelayImpl: async (event) => {
        relayEvents.push(event);
      },
      coverGeneratorImpl: async ({ outputPath, prompt }) => {
        const result = spawnSync(
          "ffmpeg",
          [
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=0x162033:s=1280x720:d=1",
            "-frames:v",
            "1",
            outputPath
          ],
          { encoding: "utf8" }
        );
        assert.equal(result.status, 0, result.stderr);
        return {
          imagePath: outputPath,
          prompt,
          provider: "mock-cover"
        };
      }
    }
  });

  const tool = tools.find((item) => item.name === "ambient_video_generate");
  const result = await tool.execute("call_telegram_1", {
    theme: "ocean",
    style: "calm piano",
    duration_target_sec: 8,
    master_duration_sec: 2,
    allow_nonstandard_duration: true,
    output_name: "ambient-video-generate-telegram-progress",
    mode: "mock",
    telegram_chat_id: "123456",
    telegram_message_id: "42"
  });

  assert.equal(result.data.ok, true);
  assert.ok(relayEvents.length > 0);
  assert.equal(relayEvents[0].telegram_chat_id, "123456");
  assert.equal(relayEvents[0].telegram_message_id, "42");
  assert.equal(relayEvents.at(-1)?.stage, "completed");
});

test("ambient_video_generate normalizes output names that already include .mp4", async () => {
  const tools = [];

  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      coverGeneratorImpl: async ({ outputPath, prompt }) => {
        const result = spawnSync(
          "ffmpeg",
          [
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=0x162033:s=1280x720:d=1",
            "-frames:v",
            "1",
            outputPath
          ],
          { encoding: "utf8" }
        );
        assert.equal(result.status, 0, result.stderr);
        return {
          imagePath: outputPath,
          prompt,
          provider: "mock-cover"
        };
      }
    }
  });

  const tool = tools.find((item) => item.name === "ambient_video_generate");
  const result = await tool.execute("call_output_name_1", {
    theme: "ocean",
    style: "storm and rain",
    duration_target_sec: 8,
    master_duration_sec: 2,
    allow_nonstandard_duration: true,
    output_name: "storm-rain-10min.mp4",
    mode: "mock"
  });

  assert.equal(result.data.ok, true);
  assert.equal(result.data.final_output_path, "outputs/storm-rain-10min.mp4");
});

test("ambient_video_generate keeps unmatched free-text themes as generic input instead of forcing meditation-ambient", async () => {
  const tools = [];
  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      coverGeneratorImpl: async ({ outputPath, prompt }) => {
        const result = spawnSync(
          "ffmpeg",
          [
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=0x331111:s=1280x720:d=1",
            "-frames:v",
            "1",
            outputPath
          ],
          { encoding: "utf8" }
        );
        assert.equal(result.status, 0, result.stderr);
        return {
          imagePath: outputPath,
          prompt,
          provider: "mock-cover"
        };
      }
    }
  });

  const tool = tools.find((item) => item.name === "ambient_video_generate");
  const result = await tool.execute("call_4", {
    theme: "furious fire",
    style: "heavy rock guitar",
    duration_target_sec: 60,
    output_name: "furious-fire-generic",
    mode: "mock"
  });

  assert.equal(result.data.ok, true);
  assert.equal(result.data.theme_id, null);
  assert.match(result.data.final_output_path, /furious-fire-generic\.mp4$/);
  assert.equal(result.data.duration_sec, 60);
  const probe = probeJson(result.data.final_output_path);
  const streamKinds = probe.streams.map((stream) => stream.codec_type).sort();
  assert.deepEqual(streamKinds, ["audio", "video"]);
  assert.ok(Number(probe.format.duration) >= 59.5);
});
