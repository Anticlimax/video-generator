import test from "node:test";
import assert from "node:assert/strict";
import {
  loadThemeRegistry,
  resolveTheme
} from "../../src/lib/theme-registry.js";

test("resolveTheme maps sleep piano requests to sleep-piano", async () => {
  const registry = await loadThemeRegistry();
  const theme = resolveTheme(registry, {
    theme: "助眠",
    style: "simple piano"
  });
  assert.equal(theme.id, "sleep-piano");
  assert.equal(theme.video_template_id, "soft-stars");
});

test("resolveTheme falls back to keyword scoring before failing", async () => {
  const registry = await loadThemeRegistry();
  const theme = resolveTheme(registry, {
    theme: "sleeping music",
    style: "soft piano"
  });
  assert.equal(theme.id, "sleep-piano");
});
