import test from "node:test";
import assert from "node:assert/strict";
import { buildRenderPlan } from "../../src/lib/render-plan.js";

test("buildRenderPlan chooses crossfade_loop by default", () => {
  const plan = buildRenderPlan({
    themeId: "sleep-piano",
    durationTargetSec: 7200,
    videoTemplateId: "default-black"
  });
  assert.equal(plan.audio.loopStrategy, "crossfade_loop");
  assert.equal(plan.audio.crossfadeDurationSec, 6);
  assert.equal(plan.audio.targetLufs, -23);
  assert.equal(plan.video.templateId, "default-black");
});
