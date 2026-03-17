export function buildRenderPlan({
  themeId,
  durationTargetSec,
  videoTemplateId
}) {
  return {
    themeId,
    durationTargetSec,
    audio: {
      loopStrategy: "crossfade_loop",
      crossfadeDurationSec: 6,
      targetLufs: -23
    },
    video: {
      templateId: videoTemplateId
    }
  };
}
