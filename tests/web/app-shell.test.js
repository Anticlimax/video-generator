import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

test("web app shell has next scripts and core app routes", () => {
  const pkg = readJson("package.json");

  assert.equal(pkg.scripts.dev, "next dev");
  assert.equal(pkg.scripts.build, "next build");
  assert.equal(pkg.scripts.start, "next start");
  assert.ok(pkg.dependencies.next);
  assert.ok(pkg.dependencies.react);
  assert.ok(pkg.dependencies["react-dom"]);

  assert.ok(fs.existsSync(path.join(projectRoot, "app/layout.tsx")));
  assert.ok(fs.existsSync(path.join(projectRoot, "app/page.tsx")));
  assert.ok(fs.existsSync(path.join(projectRoot, "app/globals.css")));
  assert.ok(fs.existsSync(path.join(projectRoot, "app/jobs/page.tsx")));
  assert.ok(fs.existsSync(path.join(projectRoot, "app/jobs/[id]/page.tsx")));
});

test("root layout includes the global app navigation", () => {
  const layoutSource = fs.readFileSync(path.join(projectRoot, "app/layout.tsx"), "utf8");

  assert.match(layoutSource, /AppNav/);
  assert.ok(fs.existsSync(path.join(projectRoot, "components/app-nav.tsx")));
  assert.ok(fs.existsSync(path.join(projectRoot, "components/language-switcher.tsx")));
  assert.ok(fs.existsSync(path.join(projectRoot, "src/i18n/index.ts")));
});
