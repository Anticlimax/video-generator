import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readText(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("jobs page uses a dedicated jobs table and links to job details", () => {
  const pageSource = readText("app/jobs/page.tsx");
  const tableSource = readText("components/jobs-table.tsx");

  assert.match(pageSource, /from\s+["']\.\.\/\.\.\/components\/jobs-table["']/);
  assert.match(pageSource, /<JobsTable\b/);
  assert.match(tableSource, /jobs/i);
  assert.match(tableSource, /href/i);
});
