import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { registerAmbientTools } from "../../openclaw/index.js";

function createSampleAudio(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=220:duration=2",
      "-ar",
      "48000",
      "-ac",
      "2",
      filePath
    ],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
}

function createSampleImage(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
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
      filePath
    ],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
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

test("ambient_media_render produces a playable mp4 with audio and video streams", async () => {
  const tools = [];
  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {}
  });

  const masterAudioPath = path.join("jobs", "job_seed", "master_audio.wav");
  createSampleAudio(masterAudioPath);

  const tool = tools.find((item) => item.name === "ambient_media_render");
  const result = await tool.execute("call_1", {
    master_audio_path: masterAudioPath,
    duration_target_sec: 4,
    video_template_id: "soft-stars",
    output_name: "sleep-piano-4m",
    mix_profile: {}
  });

  assert.equal(result.data.ok, true);
  assert.match(result.data.audio_output_path, /extended_audio\.wav$/);
  assert.match(result.data.video_output_path, /loop_video\.mp4$/);
  assert.equal(typeof result.data.file_sizes.final_bytes, "number");

  const probe = probeJson(result.data.final_output_path);
  const streamKinds = probe.streams.map((stream) => stream.codec_type).sort();
  assert.deepEqual(streamKinds, ["audio", "video"]);
  assert.ok(Number(probe.format.duration) >= 3.5);
  assert.ok(Number(probe.format.size) > 0);
});

test("ambient_media_render can render a playable mp4 from a static cover image", async () => {
  const tools = [];
  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {}
  });

  const masterAudioPath = path.join("jobs", "job_seed_static", "master_audio.wav");
  const imagePath = path.join("jobs", "job_seed_static", "cover.png");
  createSampleAudio(masterAudioPath);
  createSampleImage(imagePath);

  const tool = tools.find((item) => item.name === "ambient_media_render");
  const result = await tool.execute("call_2", {
    master_audio_path: masterAudioPath,
    image_path: imagePath,
    duration_target_sec: 4,
    output_name: "sleep-piano-static"
  });

  assert.equal(result.data.ok, true);
  const probe = probeJson(result.data.final_output_path);
  const streamKinds = probe.streams.map((stream) => stream.codec_type).sort();
  assert.deepEqual(streamKinds, ["audio", "video"]);
  assert.ok(Number(probe.format.duration) >= 3.5);
});
