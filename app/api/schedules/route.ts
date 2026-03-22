import { createScheduleStore } from "../../../src/core/schedules/schedule-store.js";
import { createSchedulesApiHandlers } from "../../../src/core/schedules/web-api.js";

const store = createScheduleStore();
const api = createSchedulesApiHandlers({ store });

export async function GET() {
  return api.get();
}

export async function POST(request: Request) {
  return api.post(request);
}
