export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduleRunner } = await import("./src/core/schedules/start-runner.js");
    startScheduleRunner();
  }
}
