import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readText(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("integrations page exists and surfaces provider env status", () => {
  const pageSource = readText("app/integrations/page.tsx");

  assert.match(pageSource, /Integrations/);
  assert.match(pageSource, /GEMINI_API_KEY/);
  assert.match(pageSource, /MUSICGPT_API_KEY/);
  assert.match(pageSource, /RUNWAY_API_KEY/);
  assert.match(pageSource, /YOUTUBE_CLIENT_ID/);
  assert.match(pageSource, /YOUTUBE_CLIENT_SECRET/);
  assert.match(pageSource, /YOUTUBE_REFRESH_TOKEN/);
  assert.match(pageSource, /dictionary\.integrations\.configured/i);
  assert.match(pageSource, /dictionary\.integrations\.missing/i);
});

test("integrations page links to youtube oauth setup guidance", () => {
  const pageSource = readText("app/integrations/page.tsx");

  assert.match(pageSource, /youtube oauth/i);
  assert.match(pageSource, /docs\/setup\/youtube-oauth\.md/);
});
