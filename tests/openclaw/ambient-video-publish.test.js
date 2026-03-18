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

test("ambient_video_publish generates a video, uploads it, and returns YouTube links", async () => {
  const tools = [];
  const mp3Bytes = createMp3Buffer(2);
  const progressEvents = [];

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
      },
      youtubeUploadImpl: async ({ videoPath, title, description, tags, privacyStatus }) => {
        assert.match(videoPath, /ambient-video-publish-smoke\.mp4$/);
        assert.equal(title, "Ocean Calm Piano Smoke");
        assert.equal(description, "Uploaded from test");
        assert.deepEqual(tags, ["ambient", "ocean", "piano"]);
        assert.equal(privacyStatus, "private");
        return {
          videoId: "abc123xyz",
          url: "https://www.youtube.com/watch?v=abc123xyz",
          studioUrl: "https://studio.youtube.com/video/abc123xyz/edit"
        };
      },
      progressObserver(event) {
        progressEvents.push({
          stage: event.stage,
          status: event.status,
          progress: event.progress
        });
      }
    }
  });

  const tool = tools.find((item) => item.name === "ambient_video_publish");
  const result = await tool.execute("call_publish_1", {
    theme: "ocean",
    style: "calm piano",
    duration_target_sec: 8,
    master_duration_sec: 2,
    allow_nonstandard_duration: true,
    output_name: "ambient-video-publish-smoke",
    mode: "elevenlabs",
    youtube_title: "Ocean Calm Piano Smoke",
    youtube_description: "Uploaded from test",
    youtube_tags: ["ambient", "ocean", "piano"],
    privacy_status: "private"
  });

  assert.equal(result.data.ok, true);
  assert.match(result.data.final_output_path, /ambient-video-publish-smoke\.mp4$/);
  assert.equal(result.data.youtube_video_id, "abc123xyz");
  assert.equal(result.data.youtube_url, "https://www.youtube.com/watch?v=abc123xyz");
  assert.equal(
    result.data.youtube_studio_url,
    "https://studio.youtube.com/video/abc123xyz/edit"
  );
  assert.equal(fs.existsSync(result.data.progress_path), true);

  const progressFile = JSON.parse(fs.readFileSync(result.data.progress_path, "utf8"));
  assert.equal(progressFile.stage, "completed");
  assert.equal(progressFile.status, "done");
  assert.equal(progressFile.progress, 100);
  assert.equal(progressFile.artifacts.final_output_path, result.data.final_output_path);
  assert.equal(progressFile.artifacts.youtube_url, result.data.youtube_url);

  assert.deepEqual(
    progressEvents.map((event) => event.stage),
    ["queued", "video_generating", "youtube_uploading", "completed"]
  );
});

test("ambient_video_publish relays telegram progress updates when telegram context is provided", async () => {
  const tools = [];
  const mp3Bytes = createMp3Buffer(2);
  const relayEvents = [];

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
      },
      youtubeUploadImpl: async () => ({
        videoId: "relay123",
        url: "https://www.youtube.com/watch?v=relay123",
        studioUrl: "https://studio.youtube.com/video/relay123/edit"
      }),
      telegramProgressRelayImpl: async (event) => {
        relayEvents.push(event);
      }
    }
  });

  const tool = tools.find((item) => item.name === "ambient_video_publish");
  const result = await tool.execute("call_publish_relay_1", {
    theme: "ocean",
    style: "calm piano",
    duration_target_sec: 8,
    master_duration_sec: 2,
    allow_nonstandard_duration: true,
    output_name: "ambient-video-publish-relay",
    mode: "elevenlabs",
    youtube_title: "Ocean Calm Piano Relay",
    telegram_chat_id: "123456",
    telegram_message_id: "88"
  });

  assert.equal(result.data.ok, true);
  assert.ok(relayEvents.length > 0);
  assert.equal(relayEvents[0].telegram_chat_id, "123456");
  assert.equal(relayEvents[0].telegram_message_id, "88");
  assert.equal(relayEvents.at(-1)?.stage, "completed");
});

test("ambient_video_publish creates a telegram progress message when only chat id is provided", async () => {
  const tools = [];
  const mp3Bytes = createMp3Buffer(2);
  const startEvents = [];
  const relayEvents = [];

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
      },
      youtubeUploadImpl: async () => ({
        videoId: "relay999",
        url: "https://www.youtube.com/watch?v=relay999",
        studioUrl: "https://studio.youtube.com/video/relay999/edit"
      }),
      telegramProgressStartImpl: async (event) => {
        startEvents.push(event);
        return { messageId: "777" };
      },
      telegramProgressRelayImpl: async (event) => {
        relayEvents.push(event);
      }
    }
  });

  const tool = tools.find((item) => item.name === "ambient_video_publish");
  const result = await tool.execute("call_publish_chat_only_1", {
    theme: "ocean",
    style: "calm piano",
    duration_target_sec: 8,
    master_duration_sec: 2,
    allow_nonstandard_duration: true,
    output_name: "ambient-video-publish-chat-only",
    mode: "elevenlabs",
    telegram_chat_id: "123456"
  });

  assert.equal(result.data.ok, true);
  assert.equal(startEvents.length, 1);
  assert.equal(startEvents[0].telegram_chat_id, "123456");
  assert.equal(relayEvents.length > 0, true);
  assert.equal(relayEvents[0].telegram_message_id, "777");
  assert.equal(relayEvents.at(-1)?.stage, "completed");
});
