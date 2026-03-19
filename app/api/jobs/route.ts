import { createJobStore } from "../../../src/server/jobs/job-store.js";
import { createJobsApiHandlers } from "../../../src/server/jobs/web-api.js";

const store = createJobStore();
const api = createJobsApiHandlers({ store });

export async function GET(request: Request) {
  return api.get(request);
}

export async function POST(request: Request) {
  return api.post(request);
}
