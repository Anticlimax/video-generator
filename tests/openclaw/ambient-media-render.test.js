import test from "node:test";
import assert from "node:assert/strict";
import { registerAmbientTools } from "../../openclaw/index.js";

test("ambient_media_render returns stable output paths, ffprobe_summary, and file sizes", async () => {
  const tools = [];
  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {}
  });

  const tool = tools.find((item) => item.name === "ambient_media_render");
  const result = await tool.execute("call_1", {
    master_audio_path: "jobs/job_seed/master_audio.wav",
    duration_target_sec: 240,
    video_template_id: "default-black",
    output_name: "sleep-piano-4m",
    mix_profile: {}
  });

  assert.equal(result.data.ok, true);
  assert.match(result.data.audio_output_path, /extended_audio\.wav$/);
  assert.match(result.data.video_output_path, /loop_video\.mp4$/);
  assert.equal(result.data.ffprobe_summary.video_streams, 1);
  assert.equal(result.data.ffprobe_summary.audio_streams, 1);
  assert.equal(typeof result.data.file_sizes.final_bytes, "number");
});
