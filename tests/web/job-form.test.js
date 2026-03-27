import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readText(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("home page uses a dedicated job form component", () => {
  const pageSource = readText("app/page.tsx");
  assert.match(pageSource, /from\s+["']\.\.\/components\/job-form["']/);
  assert.match(pageSource, /<JobForm\b/);
});

test("job form exposes the required fields and submits to jobs api", () => {
  const formSource = readText("components/job-form.tsx");

  assert.match(formSource, /name=["']theme["']/);
  assert.match(formSource, /name=["']style["']/);
  assert.match(formSource, /name=["']duration["']/);
  assert.match(formSource, /name=["']provider["']/);
  assert.match(formSource, /name=["']publishToYouTube["']/);
  assert.doesNotMatch(formSource, /name=["']videoVisualPrompt["']/);
  assert.doesNotMatch(formSource, /name=["']generateSeparateCover["']/);
  assert.doesNotMatch(formSource, /name=["']coverPrompt["']/);
  assert.doesNotMatch(formSource, /name=["']generateMotionVideo["']/);
  assert.match(formSource, /type=["']submit["']/);
  assert.match(formSource, /\/api\/jobs/);
});

test("job form clarifies accepted duration formats", () => {
  const formSource = readText("components/job-form.tsx");

  assert.match(formSource, /placeholder=["']30m or 1800["']/);
  assert.match(formSource, /durationHint/);
});
