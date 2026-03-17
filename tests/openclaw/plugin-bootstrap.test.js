import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("package is configured as an ESM OpenClaw plugin", () => {
  const pkg = JSON.parse(
    fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")
  );
  assert.equal(pkg.type, "module");
  assert.deepEqual(pkg.openclaw.extensions, ["./openclaw/index.js"]);
  assert.equal(pkg.scripts.test, "node --test");
});
