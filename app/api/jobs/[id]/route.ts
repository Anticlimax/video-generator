import { createJobStore } from "../../../../src/core/jobs/job-store.js";
import { createJobsApiHandlers } from "../../../../src/core/jobs/web-api.js";

const store = createJobStore();
const api = createJobsApiHandlers({ store });

export async function GET(request: Request, context: { params: { id: string } }) {
  return api.getById(request, context);
}

export async function POST(request: Request, context: { params: { id: string } }) {
  return api.retry(request, context);
}
