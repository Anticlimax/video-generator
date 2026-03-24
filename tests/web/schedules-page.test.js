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
  assert.match(pageSource, /from\s+["']\.\.\/\.\.\/components\/schedules-list["']/);
  assert.match(pageSource, /<ScheduleForm\s*\/>/);
  assert.match(pageSource, /<SchedulesList\b/);
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

test("schedules list exposes toggle and run-now actions", () => {
  const listSource = readText("components/schedules-list.tsx");

  assert.match(listSource, /toggle/i);
  assert.match(listSource, /run-now/i);
  assert.match(listSource, /delete/i);
  assert.match(listSource, /\/schedules\/\$\{schedule\.id\}/);
  assert.match(listSource, /\/jobs\/\$\{schedule\.lastJobId\}/);
  assert.match(listSource, /fetch\(/i);
  assert.match(listSource, /enabled/i);
  assert.match(listSource, /nextRunAt/i);
});

test("schedule edit page reuses the schedule form component", () => {
  const pageSource = readText("app/schedules/[id]/page.tsx");
  assert.match(pageSource, /from\s+["']\.\.\/\.\.\/\.\.\/components\/schedule-form["']/);
  assert.match(pageSource, /<ScheduleForm\b/);
});

test("job form exposes a Gemini randomize action for theme and style", () => {
  const formSource = readText("components/job-form.tsx");

  assert.match(formSource, /randomize/i);
  assert.match(formSource, /\/api\/jobs\/randomize/);
  assert.match(formSource, /name=["']theme["']/);
  assert.match(formSource, /name=["']style["']/);
});
