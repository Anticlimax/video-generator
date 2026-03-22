import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { buildCronExpression, computeNextRunAt } from "./cron.js";

function normalizeNow(now) {
  if (typeof now === "function") {
    return now();
  }
  return now || new Date();
}

function defaultRandomSuffix() {
  return randomUUID().replace(/-/g, "").slice(0, 4).toLowerCase();
}

function buildStamp(now) {
  const iso = now.toISOString();
  const date = iso.slice(0, 10).replace(/-/g, "");
  const time = iso.slice(11, 19).replace(/:/g, "");
  return `${date}_${time}`;
}

function normalizeText(value, label) {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new Error(`missing_${label}`);
  }
  return text;
}

function normalizeOptionalText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeBoolean(value, fallback = false) {
  if (value == null) {
    return fallback;
  }
  return Boolean(value);
}

function normalizeNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`invalid_${label}`);
  }
  return number;
}

function normalizePayload(payload = {}) {
  return {
    theme: normalizeText(payload.theme, "theme"),
    style: normalizeText(payload.style, "style"),
    durationTargetSec: normalizeNumber(payload.durationTargetSec, "duration_target_sec"),
    masterDurationSec:
      payload.masterDurationSec == null || payload.masterDurationSec === ""
        ? null
        : normalizeNumber(payload.masterDurationSec, "master_duration_sec"),
    provider: normalizeOptionalText(payload.provider) || "mock",
    publishToYouTube: normalizeBoolean(payload.publishToYouTube),
    videoVisualPrompt: normalizeOptionalText(payload.videoVisualPrompt),
    generateSeparateCover: normalizeBoolean(payload.generateSeparateCover),
    generateMotionVideo: normalizeBoolean(payload.generateMotionVideo),
    coverPrompt: normalizeOptionalText(payload.coverPrompt)
  };
}

function getScheduleFilePath(rootDir, scheduleId) {
  return path.join(rootDir, scheduleId, "schedule.json");
}

function normalizeScheduleRecord(input = {}) {
  const kind = normalizeText(input.kind, "kind").toLowerCase();
  const time = normalizeText(input.time, "time");
  const timezone = normalizeOptionalText(input.timezone) || "UTC";
  const createdAt = normalizeText(input.createdAt, "created_at");
  const updatedAt = normalizeText(input.updatedAt, "updated_at");
  const weekday = kind === "weekly" ? normalizeNumber(input.weekday, "weekday") : null;
  const cronExpression =
    normalizeOptionalText(input.cronExpression) ||
    buildCronExpression({
      kind,
      time,
      weekday
    });
  const nextRunAt =
    normalizeOptionalText(input.nextRunAt) ||
    computeNextRunAt({
      kind,
      time,
      weekday,
      now: createdAt
    });

  return {
    id: normalizeText(input.id, "id"),
    enabled: normalizeBoolean(input.enabled, true),
    kind,
    time,
    weekday,
    cronExpression,
    timezone,
    payload: normalizePayload(input.payload),
    lastRunAt: normalizeOptionalText(input.lastRunAt),
    nextRunAt,
    lastJobId: normalizeOptionalText(input.lastJobId),
    createdAt,
    updatedAt
  };
}

async function readScheduleFile(scheduleFilePath) {
  try {
    const raw = await fs.readFile(scheduleFilePath, "utf8");
    return normalizeScheduleRecord(JSON.parse(raw));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeScheduleFile(scheduleFilePath, schedule) {
  await fs.mkdir(path.dirname(scheduleFilePath), { recursive: true });
  await fs.writeFile(scheduleFilePath, `${JSON.stringify(schedule, null, 2)}\n`, "utf8");
}

async function listScheduleFiles(rootDir) {
  try {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => getScheduleFilePath(rootDir, entry.name));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export function createScheduleStore({
  rootDir = "schedules",
  now = () => new Date(),
  randomSuffix = defaultRandomSuffix
} = {}) {
  async function create(input = {}) {
    const timestamp = normalizeNow(now);
    const scheduleId = `schedule_${buildStamp(timestamp)}_${randomSuffix()}`;

    const schedule = normalizeScheduleRecord({
      id: scheduleId,
      enabled: input.enabled,
      kind: input.kind,
      time: input.time,
      weekday: input.weekday,
      timezone: input.timezone,
      payload: input.payload,
      createdAt: timestamp.toISOString(),
      updatedAt: timestamp.toISOString()
    });

    await writeScheduleFile(getScheduleFilePath(rootDir, schedule.id), schedule);
    return schedule;
  }

  async function getById(scheduleId) {
    return readScheduleFile(getScheduleFilePath(rootDir, scheduleId));
  }

  async function list({ limit } = {}) {
    const schedules = [];
    for (const scheduleFilePath of await listScheduleFiles(rootDir)) {
      const schedule = await readScheduleFile(scheduleFilePath);
      if (schedule) {
        schedules.push(schedule);
      }
    }

    schedules.sort((left, right) => {
      const createdAtCompare = String(right.createdAt).localeCompare(String(left.createdAt));
      if (createdAtCompare !== 0) {
        return createdAtCompare;
      }
      return String(right.id).localeCompare(String(left.id));
    });

    if (Number.isFinite(limit) && limit >= 0) {
      return schedules.slice(0, limit);
    }

    return schedules;
  }

  async function update(scheduleId, patch = {}) {
    const current = await getById(scheduleId);
    if (!current) {
      return null;
    }

    const timestamp = normalizeNow(now).toISOString();
    const merged = normalizeScheduleRecord({
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: timestamp,
      payload: patch.payload ? { ...current.payload, ...patch.payload } : current.payload
    });

    await writeScheduleFile(getScheduleFilePath(rootDir, scheduleId), merged);
    return merged;
  }

  return {
    rootDir,
    create,
    getById,
    list,
    update
  };
}
