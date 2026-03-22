import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readText(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("schedules page uses a dedicated schedule form component", () => {
  const pageSource = readText("app/schedules/page.tsx");
  assert.match(pageSource, /from\s+["']\.\.\/\.\.\/components\/schedule-form["']/);
  assert.match(pageSource, /<ScheduleForm\s*\/>/);
});

test("schedule form exposes daily and weekly inputs and submits to schedules api", () => {
  const formSource = readText("components/schedule-form.tsx");

  assert.match(formSource, /name=["']kind["']/);
  assert.match(formSource, /name=["']time["']/);
  assert.match(formSource, /name=["']weekday["']/);
  assert.match(formSource, /name=["']theme["']/);
  assert.match(formSource, /name=["']style["']/);
  assert.match(formSource, /name=["']duration["']/);
  assert.match(formSource, /name=["']provider["']/);
  assert.match(formSource, /name=["']publishToYouTube["']/);
  assert.match(formSource, /type=["']submit["']/);
  assert.match(formSource, /\/api\/schedules/);
});
