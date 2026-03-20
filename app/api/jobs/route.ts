import { createJobStore } from "../../../src/core/jobs/job-store.js";
import { createJobsApiHandlers } from "../../../src/core/jobs/web-api.js";

const store = createJobStore();
const api = createJobsApiHandlers({
  store,
  runtimeConfig: {
    geminiApiKey: process.env.GEMINI_API_KEY,
    musicGptApiKey: process.env.MUSICGPT_API_KEY,
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
    runwayApiKey: process.env.RUNWAY_API_KEY
  }
});

export async function GET(request: Request) {
  return api.get(request);
}

export async function POST(request: Request) {
  return api.post(request);
}
