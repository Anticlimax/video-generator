import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readText(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("youtube oauth setup doc explains the refresh token env variables", () => {
  const doc = readText("docs/setup/youtube-oauth.md");

  assert.match(doc, /YOUTUBE_CLIENT_ID/);
  assert.match(doc, /YOUTUBE_CLIENT_SECRET/);
  assert.match(doc, /YOUTUBE_REFRESH_TOKEN/);
  assert.match(doc, /refresh token/i);
  assert.match(doc, /oauth/i);
});
