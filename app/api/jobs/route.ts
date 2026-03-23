import { createJobStore } from "../../../src/core/jobs/job-store.js";
import { createJobsApiHandlers } from "../../../src/core/jobs/web-api.js";
import { resolveRuntimeConfig } from "../../../src/core/config/runtime-config.js";

const store = createJobStore();
const api = createJobsApiHandlers({
  store,
  runtimeConfig: resolveRuntimeConfig(process.env)
});

export async function GET(request: Request) {
  return api.get(request);
}

export async function POST(request: Request) {
  return api.post(request);
}
