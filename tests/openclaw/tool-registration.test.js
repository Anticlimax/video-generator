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
    ["ambient_music_build", "ambient_media_render"]
  );
});
