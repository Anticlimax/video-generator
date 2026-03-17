import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("smoke-local-render script exits successfully", () => {
  const result = spawnSync("bash", ["scripts/smoke-local-render.sh"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SMOKE_OK/);
});
