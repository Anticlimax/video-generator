function normalizeTime(value) {
  const text = String(value ?? "").trim();
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) {
    throw new Error("invalid_schedule_time");
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error("invalid_schedule_time");
  }
  return {
    text,
    hours,
    minutes
  };
}

function normalizeKind(value) {
  const kind = String(value ?? "").trim().toLowerCase();
  if (kind !== "daily" && kind !== "weekly") {
    throw new Error("invalid_schedule_kind");
  }
  return kind;
}

function normalizeWeekday(value) {
  const weekday = Number(value);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new Error("invalid_schedule_weekday");
  }
  return weekday;
}

function toDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid_schedule_now");
  }
  return date;
}

export function buildCronExpression({ kind, time, weekday } = {}) {
  const normalizedKind = normalizeKind(kind);
  const { hours, minutes } = normalizeTime(time);

  if (normalizedKind === "daily") {
    return `${minutes} ${hours} * * *`;
  }

  return `${minutes} ${hours} * * ${normalizeWeekday(weekday)}`;
}

export function computeNextRunAt({ kind, time, weekday, now } = {}) {
  const normalizedKind = normalizeKind(kind);
  const { hours, minutes } = normalizeTime(time);
  const current = toDate(now);

  const next = new Date(current);
  next.setUTCSeconds(0, 0);
  next.setUTCHours(hours, minutes, 0, 0);

  if (normalizedKind === "daily") {
    if (next <= current) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next.toISOString();
  }

  const targetWeekday = normalizeWeekday(weekday);
  const currentWeekday = current.getUTCDay();
  let deltaDays = (targetWeekday - currentWeekday + 7) % 7;
  if (deltaDays === 0 && next <= current) {
    deltaDays = 7;
  }
  next.setUTCDate(next.getUTCDate() + deltaDays);
  return next.toISOString();
}
