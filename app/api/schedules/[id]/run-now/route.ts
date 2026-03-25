import path from "path";

import { createScheduleStore } from "../../../../../src/core/schedules/schedule-store.js";
import { createSchedulesApiHandlers } from "../../../../../src/core/schedules/web-api.js";
import { createJobStore } from "../../../../../src/core/jobs/job-store.js";
import { resolveRuntimeConfig } from "../../../../../src/core/config/runtime-config.js";

const store = createScheduleStore();
const jobStore = createJobStore({
  rootDir: path.join(process.cwd(), "jobs")
});
const api = createSchedulesApiHandlers({
  store,
  jobStore,
  runtimeConfig: resolveRuntimeConfig(process.env)
});

export async function POST(request: Request, context: { params: { id: string } }) {
  return api.runNow(request, context);
}
