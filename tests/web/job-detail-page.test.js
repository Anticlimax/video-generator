import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readText(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("job detail page uses status and result components", () => {
  const pageSource = readText("app/jobs/[id]/page.tsx");
  const clientSource = readText("components/job-detail-client.tsx");
  const statusSource = readText("components/job-status-card.tsx");
  const resultSource = readText("components/job-result-card.tsx");
  const artifactRouteSource = readText("app/api/jobs/[id]/artifacts/[kind]/route.ts");
  const formSource = readText("components/job-form.tsx");

  assert.match(pageSource, /job-detail-client/i);
  assert.match(pageSource, /<JobDetailClient\b/);
  assert.match(clientSource, /setInterval/i);
  assert.match(clientSource, /fetch\(/i);
  assert.match(statusSource, /stage/i);
  assert.match(statusSource, /progress/i);
  assert.match(resultSource, /cover/i);
  assert.match(resultSource, /video/i);
  assert.match(resultSource, /视频画面图/i);
  assert.match(resultSource, /封面图/i);
  assert.match(resultSource, /微动视频/i);
  assert.match(resultSource, /复用/i);
  assert.match(resultSource, /<img/i);
  assert.match(resultSource, /<video/i);
  assert.match(resultSource, /artifacts\/video-image/i);
  assert.match(resultSource, /artifacts\/cover/i);
  assert.match(resultSource, /artifacts\/motion-video/i);
  assert.match(resultSource, /artifacts\/video/i);
  assert.match(artifactRouteSource, /readFile/i);
  assert.match(artifactRouteSource, /content-type/i);
  assert.match(artifactRouteSource, /video-image/i);
  assert.match(formSource, /videoVisualPrompt/i);
  assert.match(formSource, /generateSeparateCover/i);
  assert.match(formSource, /coverPrompt/i);
});
