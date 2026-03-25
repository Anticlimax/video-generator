import { createJobStore } from "../../../../src/core/jobs/job-store.js";
import { createJobsApiHandlers } from "../../../../src/core/jobs/web-api.js";
import { resolveRuntimeConfig } from "../../../../src/core/config/runtime-config.js";

const store = createJobStore();
const api = createJobsApiHandlers({
  store,
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
  return api.retry(request, { params });
}
