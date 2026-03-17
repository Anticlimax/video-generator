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

test("all themes define master duration defaults and tiers", async () => {
  const registry = await loadThemeRegistry();

  for (const theme of registry.values()) {
    assert.equal(typeof theme.default_master_duration_sec, "number", theme.id);
    assert.ok(theme.default_master_duration_sec > 0, theme.id);
    assert.ok(Array.isArray(theme.master_duration_tiers_sec), theme.id);
    assert.ok(theme.master_duration_tiers_sec.length > 0, theme.id);
  }
});
