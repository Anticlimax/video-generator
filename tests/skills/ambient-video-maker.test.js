import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("ambient-video-maker skill doc mentions required terms", () => {
  const body = fs.readFileSync(
    new URL("../../skills/ambient-video-maker/SKILL.md", import.meta.url),
    "utf8"
  );
  assert.match(body, /ambient_music_build/);
  assert.match(body, /ambient_media_render/);
  assert.match(body, /睡眠/);
  assert.match(body, /钢琴/);
});
