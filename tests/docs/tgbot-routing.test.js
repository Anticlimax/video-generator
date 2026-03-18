import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("ambient-video-maker skill doc describes tgbot natural language and slash-command entry", () => {
  const body = fs.readFileSync(
    new URL("../../skills/ambient-video-maker/SKILL.md", import.meta.url),
    "utf8"
  );

  assert.match(body, /tgbot/i);
  assert.match(body, /自然语言/);
  assert.match(body, /\/ambient/);
  assert.match(body, /\/ambient_publish/);
  assert.match(body, /直接执行/);
  assert.match(body, /不暴露/);
  assert.match(body, /theme_id/);
  assert.match(body, /ambient_video_generate/);
  assert.match(body, /sender_id/);
  assert.match(body, /telegram_chat_id/);
});

test("openclaw tgbot routing doc defines progress and completion messaging", () => {
  const body = fs.readFileSync(
    new URL("../../docs/plans/2026-03-18-openclaw-tgbot-routing.md", import.meta.url),
    "utf8"
  );

  assert.match(body, /OpenClaw \+ tgbot/i);
  assert.match(body, /progress\.json/);
  assert.match(body, /自然语言/);
  assert.match(body, /任务完成/);
  assert.match(body, /不暴露.*内部/i);
  assert.match(body, /不能出现重复扩展名/);
  assert.match(body, /sender_id/);
  assert.match(body, /messageId/);
});
