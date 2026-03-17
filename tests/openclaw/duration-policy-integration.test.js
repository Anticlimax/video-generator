import test from "node:test";
import assert from "node:assert/strict";
import { registerAmbientTools } from "../../openclaw/index.js";

test("ambient_music_build picks a shorter master duration than the final sleep-piano target", async () => {
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
    mode: "mock"
  });

  assert.equal(result.data.master_duration_sec, 180);
});

test("ambient_video_generate rejects a target duration outside the theme allowlist", async () => {
  const tools = [];
  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {}
  });

  const tool = tools.find((item) => item.name === "ambient_video_generate");

  await assert.rejects(
    () =>
      tool.execute("call_2", {
        theme_id: "sleep-piano",
        duration_target_sec: 2400,
        mode: "mock"
      }),
    /duration_not_allowed/
  );
});
