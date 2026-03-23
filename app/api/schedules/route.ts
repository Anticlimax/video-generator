import path from "node:path";

import { createScheduleStore } from "../../../src/core/schedules/schedule-store.js";
import { createSchedulesApiHandlers } from "../../../src/core/schedules/web-api.js";
import { createJobStore } from "../../../src/core/jobs/job-store.js";
import { resolveRuntimeConfig } from "../../../src/core/config/runtime-config.js";

const store = createScheduleStore();
const jobStore = createJobStore({
  rootDir: path.join(process.cwd(), "jobs")
});
const api = createSchedulesApiHandlers({
  store,
  jobStore,
  runtimeConfig: resolveRuntimeConfig(process.env)
});

export async function GET() {
  return api.get();
}

export async function POST(request: Request) {
  return api.post(request);
}
