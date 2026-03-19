import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

test("ambient_music_build accepts free-text theme and style without requiring theme_id", async () => {
  const tools = [];
  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {}
  });

  const tool = tools.find((item) => item.name === "ambient_music_build");
  const result = await tool.execute("call_free_text", {
    theme: "furious fire",
    style: "heavy rock guitar, storm energy",
    duration_target_sec: 30,
    master_duration_sec: 2,
    allow_nonstandard_duration: true,
    mode: "mock"
  });

  assert.equal(result.data.ok, true);
  assert.equal(result.data.theme_id, null);
  assert.equal(result.data.target_duration_sec, 30);
  assert.equal(result.data.master_duration_sec, 2);
  assert.match(result.data.master_audio_path, /master_audio\.wav$/);

  const probe = probeJson(result.data.master_audio_path);
  assert.equal(probe.format.format_name, "wav");
  assert.ok(Number(probe.format.duration) >= 1.9);
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

test("ambient_music_build can fall back to ~/.openclaw config when local agent omits api.config", async () => {
  const tools = [];
  const mp3Bytes = createMp3Buffer(1);
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "ambient-openclaw-config-"));
  const configPath = path.join(configDir, "openclaw.json");

  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        plugins: {
          entries: {
            "ambient-media-tools": {
              enabled: true,
              config: {
                mode: "elevenlabs",
                elevenLabsApiKey: "config-file-key"
              }
            }
          }
        }
      },
      null,
      2
    )
  );

  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      configFilePath: configPath,
      fetchImpl: async (url, options) => {
        assert.equal(url, "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128");
        assert.equal(options.headers["xi-api-key"], "config-file-key");
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
  const result = await tool.execute("call_5", {
    theme_id: "sleep-piano",
    duration_target_sec: 1800,
    master_duration_sec: 1,
    mode: "elevenlabs"
  });

  assert.equal(result.data.ok, true);
  assert.match(result.data.master_audio_path, /master_audio\.wav$/);
});

test("ambient_music_build polls MusicGPT and writes a probeable wav", async () => {
  const tools = [];
  const mp3Bytes = createMp3Buffer(2);
  const fetchCalls = [];

  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      musicGptApiKey: "musicgpt-key",
      fetchImpl: async (url, options = {}) => {
        fetchCalls.push({ url, options });

        if (url === "https://api.musicgpt.com/api/public/v1/MusicAI") {
          assert.equal(options.method, "POST");
          assert.equal(options.headers.Authorization, "musicgpt-key");
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                success: true,
                task_id: "task-123",
                eta: 1
              };
            }
          };
        }

        if (url === "https://api.musicgpt.com/api/public/v1/byId?conversionType=MUSIC_AI&task_id=task-123") {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                success: true,
                status: "completed",
                audio_url: "https://files.musicgpt.test/master.mp3"
              };
            }
          };
        }

        if (url === "https://files.musicgpt.test/master.mp3") {
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

        throw new Error(`unexpected_fetch_${url}`);
      },
      sleepImpl: async () => {}
    }
  });

  const tool = tools.find((item) => item.name === "ambient_music_build");
  const result = await tool.execute("call_6", {
    theme: "mysterious forest",
    style: "ambient piano",
    duration_target_sec: 1800,
    master_duration_sec: 2,
    allow_nonstandard_duration: true,
    mode: "musicgpt"
  });

  assert.equal(fetchCalls.length, 3);
  assert.equal(result.data.ok, true);
  assert.match(result.data.master_audio_path, /master_audio\.wav$/);

  const probe = probeJson(result.data.master_audio_path);
  assert.equal(probe.format.format_name, "wav");
  assert.equal(probe.streams[0].codec_type, "audio");
  assert.equal(Number(probe.streams[0].sample_rate), 48000);
  assert.equal(probe.streams[0].channels, 2);
});

test("ambient_music_build accepts MusicGPT completion nested under conversion", async () => {
  const tools = [];
  const mp3Bytes = createMp3Buffer(2);

  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      musicGptApiKey: "musicgpt-key",
      fetchImpl: async (url, options = {}) => {
        if (url === "https://api.musicgpt.com/api/public/v1/MusicAI") {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                success: true,
                task_id: "task-456"
              };
            }
          };
        }

        if (url === "https://api.musicgpt.com/api/public/v1/byId?conversionType=MUSIC_AI&task_id=task-456") {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                success: true,
                conversion: {
                  status: "completed",
                  audio_url: "https://files.musicgpt.test/master-conversion.mp3"
                }
              };
            }
          };
        }

        if (url === "https://files.musicgpt.test/master-conversion.mp3") {
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

        throw new Error(`unexpected_fetch_${url}_${options.method || "GET"}`);
      },
      sleepImpl: async () => {}
    }
  });

  const tool = tools.find((item) => item.name === "ambient_music_build");
  const result = await tool.execute("call_7", {
    theme_id: "sleep-piano",
    duration_target_sec: 30,
    master_duration_sec: 2,
    allow_nonstandard_duration: true,
    mode: "musicgpt"
  });

  assert.equal(result.data.ok, true);
  const probe = probeJson(result.data.master_audio_path);
  assert.equal(probe.format.format_name, "wav");
});

test("ambient_music_build prefers MusicGPT conversion ids and conversion_path_wav", async () => {
  const tools = [];
  const wavBytes = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=220:duration=1",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-f",
      "wav",
      "pipe:1"
    ],
    { encoding: null }
  ).stdout;
  const seenUrls = [];

  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      musicGptApiKey: "musicgpt-key",
      fetchImpl: async (url) => {
        seenUrls.push(url);

        if (url === "https://api.musicgpt.com/api/public/v1/MusicAI") {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                success: true,
                task_id: "task-v1",
                conversion_id_1: "conv-a",
                conversion_id_2: "conv-b"
              };
            }
          };
        }

        if (url === "https://api.musicgpt.com/api/public/v1/byId?conversionType=MUSIC_AI&conversion_id=conv-a") {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                success: true,
                conversion: {
                  status: "completed",
                  conversion_path_wav: "https://files.musicgpt.test/conv-a.wav"
                }
              };
            }
          };
        }

        if (url === "https://files.musicgpt.test/conv-a.wav") {
          return {
            ok: true,
            status: 200,
            async arrayBuffer() {
              return wavBytes.buffer.slice(
                wavBytes.byteOffset,
                wavBytes.byteOffset + wavBytes.byteLength
              );
            }
          };
        }

        throw new Error(`unexpected_fetch_${url}`);
      },
      sleepImpl: async () => {}
    }
  });

  const tool = tools.find((item) => item.name === "ambient_music_build");
  const result = await tool.execute("call_8", {
    theme_id: "sleep-piano",
    duration_target_sec: 30,
    master_duration_sec: 1,
    allow_nonstandard_duration: true,
    mode: "musicgpt"
  });

  assert.equal(result.data.ok, true);
  assert.deepEqual(seenUrls, [
    "https://api.musicgpt.com/api/public/v1/MusicAI",
    "https://api.musicgpt.com/api/public/v1/byId?conversionType=MUSIC_AI&conversion_id=conv-a",
    "https://files.musicgpt.test/conv-a.wav"
  ]);

  const probe = probeJson(result.data.master_audio_path);
  assert.equal(probe.format.format_name, "wav");
});

test("ambient_music_build maps MusicGPT indexed conversion paths to the matching conversion id", async () => {
  const tools = [];
  const wavBytes = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=220:duration=1",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-f",
      "wav",
      "pipe:1"
    ],
    { encoding: null }
  ).stdout;
  const seenUrls = [];

  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      musicGptApiKey: "musicgpt-key",
      fetchImpl: async (url) => {
        seenUrls.push(url);

        if (url === "https://api.musicgpt.com/api/public/v1/MusicAI") {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                success: true,
                task_id: "task-indexed",
                conversion_id_1: "conv-1",
                conversion_id_2: "conv-2"
              };
            }
          };
        }

        if (url === "https://api.musicgpt.com/api/public/v1/byId?conversionType=MUSIC_AI&conversion_id=conv-1") {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                success: true,
                conversion: {
                  status: "COMPLETED",
                  conversion_id_1: "conv-1",
                  conversion_id_2: "conv-2",
                  conversion_path_wav_1: "https://files.musicgpt.test/conv-1.wav",
                  conversion_path_wav_2: "https://files.musicgpt.test/conv-2.wav"
                }
              };
            }
          };
        }

        if (url === "https://files.musicgpt.test/conv-1.wav") {
          return {
            ok: true,
            status: 200,
            async arrayBuffer() {
              return wavBytes.buffer.slice(
                wavBytes.byteOffset,
                wavBytes.byteOffset + wavBytes.byteLength
              );
            }
          };
        }

        throw new Error(`unexpected_fetch_${url}`);
      },
      sleepImpl: async () => {}
    }
  });

  const tool = tools.find((item) => item.name === "ambient_music_build");
  const result = await tool.execute("call_8b", {
    theme_id: "sleep-piano",
    duration_target_sec: 30,
    master_duration_sec: 1,
    allow_nonstandard_duration: true,
    mode: "musicgpt"
  });

  assert.equal(result.data.ok, true);
  assert.deepEqual(seenUrls, [
    "https://api.musicgpt.com/api/public/v1/MusicAI",
    "https://api.musicgpt.com/api/public/v1/byId?conversionType=MUSIC_AI&conversion_id=conv-1",
    "https://files.musicgpt.test/conv-1.wav"
  ]);

  const probe = probeJson(result.data.master_audio_path);
  assert.equal(probe.format.format_name, "wav");
});

test("ambient_music_build writes MusicGPT diagnostics into the job directory", async () => {
  const tools = [];
  const mp3Bytes = createMp3Buffer(1);

  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      musicGptApiKey: "musicgpt-key",
      fetchImpl: async (url) => {
        if (url === "https://api.musicgpt.com/api/public/v1/MusicAI") {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                success: true,
                task_id: "task-diag",
                conversion_id_1: "conv-diag"
              };
            }
          };
        }

        if (url === "https://api.musicgpt.com/api/public/v1/byId?conversionType=MUSIC_AI&conversion_id=conv-diag") {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                success: true,
                conversion: {
                  status: "completed",
                  conversion_path: "https://files.musicgpt.test/diag.mp3"
                }
              };
            }
          };
        }

        if (url === "https://files.musicgpt.test/diag.mp3") {
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

        throw new Error(`unexpected_fetch_${url}`);
      },
      sleepImpl: async () => {}
    }
  });

  const tool = tools.find((item) => item.name === "ambient_music_build");
  const result = await tool.execute("call-9", {
    theme_id: "sleep-piano",
    duration_target_sec: 30,
    master_duration_sec: 1,
    allow_nonstandard_duration: true,
    mode: "musicgpt"
  });

  const jobDir = path.dirname(result.data.master_audio_path);
  const startPayload = JSON.parse(
    fs.readFileSync(path.join(jobDir, "musicgpt-start.json"), "utf8")
  );
  const statusPayload = JSON.parse(
    fs.readFileSync(path.join(jobDir, "musicgpt-status-conv-diag.json"), "utf8")
  );

  assert.equal(startPayload.task_id, "task-diag");
  assert.equal(startPayload.conversion_id_1, "conv-diag");
  assert.equal(statusPayload.conversion.status, "completed");
  assert.equal(statusPayload.conversion.conversion_path, "https://files.musicgpt.test/diag.mp3");
});

test("ambient_music_build times out MusicGPT start requests instead of hanging forever", async () => {
  const tools = [];

  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      musicGptApiKey: "musicgpt-key",
      musicGptRequestTimeoutSec: 1,
      fetchImpl: async (_url, options = {}) =>
        new Promise((_, reject) => {
          if (options.signal) {
            options.signal.addEventListener(
              "abort",
              () => {
                reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
              },
              { once: true }
            );
          }
        }),
      sleepImpl: async () => {}
    }
  });

  const tool = tools.find((item) => item.name === "ambient_music_build");
  await assert.rejects(
    tool.execute("call-timeout", {
      theme_id: "sleep-piano",
      duration_target_sec: 1800,
      master_duration_sec: 30,
      mode: "musicgpt"
    }),
    /musicgpt_start_timeout/
  );
});
