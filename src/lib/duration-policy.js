function toPositiveNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error("duration_invalid");
  }
  return number;
}

function genericMasterDurationSec(targetDurationSec) {
  if (targetDurationSec <= 1800) {
    return 120;
  }
  if (targetDurationSec <= 7200) {
    return 180;
  }
  return 240;
}

export function validateTargetDurationSec(theme, durationSec) {
  const normalizedDurationSec = toPositiveNumber(durationSec);
  const allowedDurations = Array.isArray(theme?.allowed_duration_sec)
    ? theme.allowed_duration_sec.map(Number).filter((value) => Number.isFinite(value) && value > 0)
    : [];

  if (allowedDurations.length > 0 && !allowedDurations.includes(normalizedDurationSec)) {
    throw new Error("duration_not_allowed");
  }

  return normalizedDurationSec;
}

export function selectMasterDurationSec(theme, targetDurationSec) {
  const normalizedTargetDurationSec = toPositiveNumber(targetDurationSec);
  const tiers = Array.isArray(theme?.master_duration_tiers_sec)
    ? theme.master_duration_tiers_sec
    : [];

  for (const tier of tiers) {
    const masterDurationSec = Number(tier?.master_duration_sec);
    if (!Number.isFinite(masterDurationSec) || masterDurationSec <= 0) {
      continue;
    }

    const maxTargetSec = Number(tier?.max_target_sec);
    if (!Number.isFinite(maxTargetSec) || normalizedTargetDurationSec <= maxTargetSec) {
      return masterDurationSec;
    }
  }

  const fallbackDurationSec = Number(theme?.default_master_duration_sec);
  if (Number.isFinite(fallbackDurationSec) && fallbackDurationSec > 0) {
    return fallbackDurationSec;
  }

  return genericMasterDurationSec(normalizedTargetDurationSec);
}
