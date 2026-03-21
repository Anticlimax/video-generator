import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveMotionPresets,
  buildMotionPresetPrompt
} from "../../src/core/media/motion-presets.js";

test("resolveMotionPresets maps rainy neon city scenes to rain plus neon", () => {
  const result = resolveMotionPresets({
    theme: "rainy night city",
    style: "cinematic neon ambience",
    videoVisualPrompt: "wet street with neon signs"
  });

  assert.deepEqual(result, {
    primaryPreset: "rain",
    secondaryPreset: "neon"
  });
});

test("resolveMotionPresets maps mysterious forest scenes to fog plus wind", () => {
  const result = resolveMotionPresets({
    theme: "mysterious forest",
    style: "dark ambient mist",
    videoVisualPrompt: "mist between trees and soft leaf sway"
  });

  assert.deepEqual(result, {
    primaryPreset: "fog",
    secondaryPreset: "wind"
  });
});

test("resolveMotionPresets maps ocean scenes to water only", () => {
  const result = resolveMotionPresets({
    theme: "ocean moonlight",
    style: "calm ambient",
    videoVisualPrompt: "soft waves under moonlight"
  });

  assert.deepEqual(result, {
    primaryPreset: "water",
    secondaryPreset: null
  });
});

test("resolveMotionPresets maps campfire scenes to fire only", () => {
  const result = resolveMotionPresets({
    theme: "campfire night",
    style: "meditative ambient",
    videoVisualPrompt: "embers and flame glow"
  });

  assert.deepEqual(result, {
    primaryPreset: "fire",
    secondaryPreset: null
  });
});

test("resolveMotionPresets falls back to none when no preset keywords match", () => {
  const result = resolveMotionPresets({
    theme: "abstract geometry",
    style: "minimal ambient",
    videoVisualPrompt: "clean symmetrical shapes"
  });

  assert.deepEqual(result, {
    primaryPreset: "none",
    secondaryPreset: null
  });
});

test("buildMotionPresetPrompt constrains motion to the selected presets", () => {
  const prompt = buildMotionPresetPrompt({
    theme: "rainy night city",
    style: "cinematic neon ambience",
    videoVisualPrompt: "wet street with neon signs",
    primaryPreset: "rain",
    secondaryPreset: "neon"
  });

  assert.match(prompt, /Keep the camera locked/i);
  assert.match(prompt, /Only animate falling rain/i);
  assert.match(prompt, /very subtle neon shimmer/i);
  assert.doesNotMatch(prompt, /cloud drift/i);
});
