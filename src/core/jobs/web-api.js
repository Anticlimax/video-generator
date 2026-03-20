import { createJob } from "./create-job.js";

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

function parseDurationTargetSec(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error("invalid_duration_target_sec");
  }
  return number;
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

function parseCreateJobInput(body = {}) {
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
    durationTargetSec: parseDurationTargetSec(body.durationTargetSec ?? body.duration_target_sec),
    masterDurationSec: parseOptionalNumber(body.masterDurationSec ?? body.master_duration_sec),
    provider: toTrimmedString(body.provider || body.mode || "mock") || "mock",
    publishToYouTube: parseBoolean(body.publishToYouTube ?? body.publish_to_youtube),
    videoTemplateId: toTrimmedString(body.videoTemplateId || body.video_template_id) || undefined,
    outputName: toTrimmedString(body.outputName || body.output_name) || undefined,
    seed: toTrimmedString(body.seed) || undefined
  };
}

function jsonError(error, status) {
  return Response.json({ error }, { status });
}

function getJobIdFromRequest(request, context = {}) {
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

export function createJobsApiHandlers({
  store,
  createJobImpl = createJob
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
        input = parseCreateJobInput(body);
      } catch (error) {
        return jsonError(String(error?.message || "invalid_job_input"), 400);
      }

      try {
        const created = await createJobImpl({ store, input });
        return Response.json({ job: created.job }, { status: 202 });
      } catch (error) {
        return jsonError(String(error?.message || "job_create_failed"), 500);
      }
    },

    async get(request) {
      const url = new URL(request.url);
      const limit = url.searchParams.get("limit");
      const parsedLimit = limit == null || limit === "" ? undefined : Number(limit);
      const jobs = await store.list({
        limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined
      });
      return Response.json({ jobs }, { status: 200 });
    },

    async getById(request, context = {}) {
      const jobId = getJobIdFromRequest(request, context);
      if (!jobId) {
        return jsonError("missing_job_id", 400);
      }

      const job = await store.getById(jobId);
      if (!job) {
        return jsonError("job_not_found", 404);
      }

      return Response.json({ job }, { status: 200 });
    }
  };
}

export { parseCreateJobInput, getJobIdFromRequest };
