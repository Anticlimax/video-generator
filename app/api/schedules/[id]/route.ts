import { createScheduleStore } from "../../../../src/core/schedules/schedule-store.js";
import { createSchedulesApiHandlers } from "../../../../src/core/schedules/web-api.js";

const store = createScheduleStore();
const api = createSchedulesApiHandlers({ store });

export async function GET(request: Request, context: { params: { id: string } }) {
  return api.getById(request, context);
}
