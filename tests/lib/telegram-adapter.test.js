import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTelegramConfirmationMessage,
  parseTelegramRequest,
  renderTelegramProgressMessage
} from "../../src/lib/telegram-adapter.js";

test("parseTelegramRequest parses /ambient command into generate action", () => {
  const request = parseTelegramRequest("/ambient ocean | calm piano, soft moonlight | 30m");

  assert.deepEqual(request, {
    ok: true,
    action: "generate",
    command: "ambient",
    theme: "ocean",
    style: "calm piano, soft moonlight",
    duration_target_sec: 1800
  });
});

test("parseTelegramRequest parses /ambient_publish command into publish action", () => {
  const request = parseTelegramRequest("/ambient_publish rainy night | soft piano | 1h");

  assert.deepEqual(request, {
    ok: true,
    action: "publish",
    command: "ambient_publish",
    theme: "rainy night",
    style: "soft piano",
    duration_target_sec: 3600
  });
});

test("parseTelegramRequest returns confirmation-required payload for natural language input", () => {
  const request = parseTelegramRequest("帮我做一个 30 分钟的 ocean calm piano 视频并上传 YouTube");

  assert.equal(request.ok, false);
  assert.equal(request.requires_confirmation, true);
  assert.equal(request.action, "publish");
  assert.equal(request.theme, "ocean");
  assert.equal(request.style, "calm piano");
  assert.equal(request.duration_target_sec, 1800);
});

test("buildTelegramConfirmationMessage renders the normalized request for user confirmation", () => {
  const message = buildTelegramConfirmationMessage({
    action: "publish",
    theme: "ocean",
    style: "calm piano, soft moonlight",
    duration_target_sec: 1800
  });

  assert.match(message, /theme: ocean/);
  assert.match(message, /style: calm piano, soft moonlight/);
  assert.match(message, /duration: 30m/);
  assert.match(message, /action: 生成并上传/);
  assert.match(message, /回复“确认”后开始/);
});

test("renderTelegramProgressMessage renders an in-flight progress message", () => {
  const message = renderTelegramProgressMessage({
    theme: "ocean",
    style: "calm piano, soft moonlight",
    duration_target_sec: 1800,
    stage: "music_generating",
    status: "running",
    progress: 50
  });

  assert.equal(
    message,
    [
      "任务：ocean | calm piano, soft moonlight | 30m",
      "状态：正在生成音乐",
      "进度：50%"
    ].join("\n")
  );
});

test("renderTelegramProgressMessage omits empty theme slots", () => {
  const message = renderTelegramProgressMessage({
    theme: "",
    style: "violent storm, heavy rain",
    duration_target_sec: 600,
    stage: "music_generating",
    status: "running",
    progress: 20
  });

  assert.equal(
    message,
    [
      "任务：violent storm, heavy rain | 10m",
      "状态：正在生成音乐",
      "进度：20%"
    ].join("\n")
  );
});

test("renderTelegramProgressMessage renders a completion message with local file and YouTube link", () => {
  const message = renderTelegramProgressMessage({
    theme: "ocean",
    style: "calm piano",
    duration_target_sec: 1800,
    stage: "completed",
    status: "done",
    progress: 100,
    artifacts: {
      final_output_path: "outputs/ocean.mp4",
      youtube_url: "https://www.youtube.com/watch?v=abc123"
    }
  });

  assert.equal(
    message,
    [
      "任务完成",
      "本地文件：outputs/ocean.mp4",
      "YouTube：https://www.youtube.com/watch?v=abc123"
    ].join("\n")
  );
});
