import { createJob } from "../jobs/create-job.js";

function toTrimmedString(value) {
  return String(value ?? "").trim();
}

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return Boolean(value);
}

function parseOptionalNumber(value) {
  if (value == null || value === "") {
    return undefined;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error("invalid_number");
  }
  return number;
}

function parseRequiredNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`invalid_${label}`);
  }
  return number;
}

function parsePayload(body = {}) {
  const theme = toTrimmedString(body.theme);
  const style = toTrimmedString(body.style);
  if (!theme) {
    throw new Error("missing_theme");
  }
  if (!style) {
    throw new Error("missing_style");
  }

  return {
    theme,
    style,
    durationTargetSec: parseRequiredNumber(body.durationTargetSec, "duration_target_sec"),
    masterDurationSec: parseOptionalNumber(body.masterDurationSec),
    provider: toTrimmedString(body.provider || "mock") || "mock",
    publishToYouTube: parseBoolean(body.publishToYouTube),
    videoVisualPrompt: toTrimmedString(body.videoVisualPrompt) || undefined,
    generateSeparateCover: parseBoolean(body.generateSeparateCover),
    generateMotionVideo: parseBoolean(body.generateMotionVideo),
    coverPrompt: toTrimmedString(body.coverPrompt) || undefined
  };
}

function parseCreateScheduleInput(body = {}) {
  const kind = toTrimmedString(body.kind).toLowerCase();
  const time = toTrimmedString(body.time);
  const timezone = toTrimmedString(body.timezone) || "UTC";
  if (kind !== "daily" && kind !== "weekly") {
    throw new Error("invalid_schedule_kind");
  }
  if (!time) {
    throw new Error("missing_schedule_time");
  }

  return {
    enabled: body.enabled == null ? true : parseBoolean(body.enabled),
    kind,
    time,
    weekday: kind === "weekly" ? parseRequiredNumber(body.weekday, "weekday") : undefined,
    timezone,
    payload: parsePayload(body.payload || {})
  };
}

function parseUpdateScheduleInput(body = {}) {
  return parseCreateScheduleInput(body);
}

function jsonError(error, status) {
  return Response.json({ error }, { status });
}

function getScheduleIdFromRequest(request, context = {}) {
  const explicitId = toTrimmedString(context?.params?.id);
  if (explicitId) {
    return explicitId;
  }
  try {
    const url = new URL(request.url);
    return toTrimmedString(url.pathname.split("/").filter(Boolean).at(-1));
  } catch {
    return "";
  }
}

export function createSchedulesApiHandlers({
  store = null,
  createJobImpl = createJob,
  jobStore = null,
  runtimeConfig = {}
} = {}) {
  if (!store) {
    throw new Error("missing_store");
  }

  return {
    async post(request) {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonError("invalid_json", 400);
      }

      let input;
      try {
        input = parseCreateScheduleInput(body);
      } catch (error) {
        return jsonError(String(error?.message || "invalid_schedule_input"), 400);
      }

      try {
        const schedule = await store.create(input);
        return Response.json({ schedule }, { status: 201 });
      } catch (error) {
        return jsonError(String(error?.message || "schedule_create_failed"), 500);
      }
    },

    async get() {
      const schedules = await store.list();
      return Response.json({ schedules }, { status: 200 });
    },

    async getById(request, context = {}) {
      const scheduleId = getScheduleIdFromRequest(request, context);
      if (!scheduleId) {
        return jsonError("missing_schedule_id", 400);
      }

      const schedule = await store.getById(scheduleId);
      if (!schedule) {
        return jsonError("schedule_not_found", 404);
      }

      return Response.json({ schedule }, { status: 200 });
    },

    async toggle(request, context = {}) {
      const scheduleId = getScheduleIdFromRequest(request, context);
      if (!scheduleId) {
        return jsonError("missing_schedule_id", 400);
      }

      const schedule = await store.getById(scheduleId);
      if (!schedule) {
        return jsonError("schedule_not_found", 404);
      }

      const updated = await store.update(scheduleId, {
        enabled: !schedule.enabled
      });

      return Response.json({ schedule: updated }, { status: 200 });
    },

    async runNow(request, context = {}) {
      const scheduleId = getScheduleIdFromRequest(request, context);
      if (!scheduleId) {
        return jsonError("missing_schedule_id", 400);
      }

      const schedule = await store.getById(scheduleId);
      if (!schedule) {
        return jsonError("schedule_not_found", 404);
      }
      if (!jobStore && createJobImpl === createJob) {
        return jsonError("missing_job_store", 500);
      }

      try {
        const created = await createJobImpl({
          store: jobStore,
          input: schedule.payload,
          runtimeConfig
        });
        const nowIso = new Date().toISOString();
        await store.update(scheduleId, {
          lastRunAt: nowIso,
          lastJobId: created?.job?.id || null
        });
        return Response.json({ job: created.job }, { status: 202 });
      } catch (error) {
        return jsonError(String(error?.message || "schedule_run_now_failed"), 500);
      }
    },

    async patch(request, context = {}) {
      const scheduleId = getScheduleIdFromRequest(request, context);
      if (!scheduleId) {
        return jsonError("missing_schedule_id", 400);
      }

      const existing = await store.getById(scheduleId);
      if (!existing) {
        return jsonError("schedule_not_found", 404);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return jsonError("invalid_json", 400);
      }

      let input;
      try {
        input = parseUpdateScheduleInput(body);
      } catch (error) {
        return jsonError(String(error?.message || "invalid_schedule_input"), 400);
      }

      try {
        const updated = await store.update(scheduleId, input);
        return Response.json({ schedule: updated }, { status: 200 });
      } catch (error) {
        return jsonError(String(error?.message || "schedule_update_failed"), 500);
      }
    },

    async delete(request, context = {}) {
      const scheduleId = getScheduleIdFromRequest(request, context);
      if (!scheduleId) {
        return jsonError("missing_schedule_id", 400);
      }

      const existing = await store.getById(scheduleId);
      if (!existing) {
        return jsonError("schedule_not_found", 404);
      }

      try {
        const deleted = await store.delete(scheduleId);
        return Response.json({ deleted }, { status: 200 });
      } catch (error) {
        return jsonError(String(error?.message || "schedule_delete_failed"), 500);
      }
    }
  };
}

export { parseCreateScheduleInput, parseUpdateScheduleInput, getScheduleIdFromRequest };
