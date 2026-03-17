import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("package is configured as an ESM OpenClaw plugin", () => {
  const pkg = JSON.parse(
    fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")
  );
  const manifest = JSON.parse(
    fs.readFileSync(new URL("../../openclaw.plugin.json", import.meta.url), "utf8")
  );
  assert.equal(pkg.type, "module");
  assert.equal(pkg.name, manifest.id);
  assert.deepEqual(pkg.openclaw.extensions, ["./openclaw/index.js"]);
  assert.equal(pkg.scripts.test, "node --test");
});
