import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerAmbientTools } from "../../openclaw/index.js";

test("ambient_cover_generate writes a cover image through the configured generator", async () => {
  const tools = [];
  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {
      coverGeneratorImpl: async ({ outputPath, prompt }) => {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, "fake-image");
        return {
          imagePath: outputPath,
          prompt,
          provider: "mock-cover"
        };
      }
    }
  });

  const tool = tools.find((item) => item.name === "ambient_cover_generate");
  const result = await tool.execute("call_1", {
    theme: "ocean",
    style: "calm piano",
    output_name: "cover-smoke"
  });

  assert.equal(result.data.ok, true);
  assert.equal(result.data.provider, "mock-cover");
  assert.match(result.data.image_path, /cover_image\.png$/);
  assert.equal(fs.existsSync(result.data.image_path), true);
  assert.match(result.data.prompt, /ocean/i);
  assert.match(result.data.prompt, /calm piano/i);
});
