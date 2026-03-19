import test from "node:test";
import assert from "node:assert/strict";
import { registerAmbientTools } from "../../openclaw/index.js";

test("registerAmbientTools registers ambient_music_build and ambient_media_render", () => {
  const tools = [];
  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {}
  });

  assert.deepEqual(
    tools.map((tool) => tool.name),
    [
      "ambient_music_build",
      "ambient_media_render",
      "ambient_video_generate",
      "ambient_cover_generate",
      "ambient_video_publish"
    ]
  );
  for (const tool of tools) {
    assert.equal(typeof tool.parameters, "object");
    assert.equal(tool.parameters.type, "object");
    assert.equal(typeof tool.schema, "object");
    assert.equal(tool.schema.type, "object");
  }

  const videoTool = tools.find((tool) => tool.name === "ambient_video_generate");
  assert.ok(videoTool);
  assert.equal(Array.isArray(videoTool.parameters.required), false);
  assert.equal(videoTool.parameters.properties.theme?.type, "string");
  assert.equal(videoTool.parameters.properties.style?.type, "string");
  assert.match(videoTool.description, /Telegram/u);
  assert.match(videoTool.description, /sender_id/u);
  assert.match(videoTool.description, /telegram_chat_id/u);
  assert.match(
    videoTool.parameters.properties.telegram_chat_id?.description || "",
    /sender_id/u
  );

  const publishTool = tools.find((tool) => tool.name === "ambient_video_publish");
  assert.ok(publishTool);
  assert.equal(publishTool.parameters.properties.youtube_title?.type, "string");
  assert.equal(publishTool.parameters.properties.privacy_status?.type, "string");
  assert.match(publishTool.description, /Telegram/u);
  assert.match(publishTool.description, /telegram_chat_id/u);

  const musicTool = tools.find((tool) => tool.name === "ambient_music_build");
  assert.ok(musicTool);
  assert.equal(Array.isArray(musicTool.parameters.required), false);
  assert.equal(musicTool.parameters.properties.theme?.type, "string");
  assert.equal(musicTool.parameters.properties.style?.type, "string");
});
