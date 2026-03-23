import { startScheduleRunner } from "./src/core/schedules/start-runner.js";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    startScheduleRunner();
  }
}
