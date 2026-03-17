import test from "node:test";
import assert from "node:assert/strict";
import {
  selectMasterDurationSec,
  validateTargetDurationSec
} from "../../src/lib/duration-policy.js";

test("selectMasterDurationSec chooses a shorter master for long sleep-piano outputs", () => {
  const theme = {
    id: "sleep-piano",
    master_duration_tiers_sec: [
      { max_target_sec: 1800, master_duration_sec: 120 },
      { max_target_sec: 7200, master_duration_sec: 180 },
      { master_duration_sec: 240 }
    ]
  };

  assert.equal(selectMasterDurationSec(theme, 1800), 120);
  assert.equal(selectMasterDurationSec(theme, 3600), 180);
  assert.equal(selectMasterDurationSec(theme, 10800), 240);
});

test("validateTargetDurationSec accepts configured target durations", () => {
  const theme = {
    id: "sleep-piano",
    allowed_duration_sec: [1800, 3600, 7200]
  };

  assert.equal(validateTargetDurationSec(theme, 3600), 3600);
});

test("validateTargetDurationSec rejects durations outside the configured list", () => {
  const theme = {
    id: "sleep-piano",
    allowed_duration_sec: [1800, 3600, 7200]
  };

  assert.throws(
    () => validateTargetDurationSec(theme, 2400),
    /duration_not_allowed/
  );
});
