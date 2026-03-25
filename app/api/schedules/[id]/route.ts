import path from "path";

import { createScheduleStore } from "../../../../src/core/schedules/schedule-store.js";
import { createSchedulesApiHandlers } from "../../../../src/core/schedules/web-api.js";
import { createJobStore } from "../../../../src/core/jobs/job-store.js";
import { resolveRuntimeConfig } from "../../../../src/core/config/runtime-config.js";

const store = createScheduleStore();
const jobStore = createJobStore({
  rootDir: path.join(process.cwd(), "jobs")
});
const api = createSchedulesApiHandlers({
  store,
  jobStore,
  runtimeConfig: resolveRuntimeConfig(process.env)
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const params = await context.params;
  return api.getById(request, { params });
}

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;
  return api.toggle(request, { params });
}

export async function PATCH(request: Request, context: RouteContext) {
  const params = await context.params;
  return api.patch(request, { params });
}

export async function DELETE(request: Request, context: RouteContext) {
  const params = await context.params;
  return api.delete(request, { params });
}
