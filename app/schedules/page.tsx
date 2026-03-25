import path from "path";

import ScheduleForm from "../../components/schedule-form";
import SchedulesList from "../../components/schedules-list";
import { createScheduleStore } from "../../src/core/schedules/schedule-store.js";

const store = createScheduleStore({
  rootDir: path.join(process.cwd(), "schedules")
});

export default async function SchedulesPage() {
  const schedules = await store.list({ limit: 50 });

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Schedules</p>
        <h1>Create daily or weekly generation schedules.</h1>
        <p className="lede">
          Configure a simple recurring run, then let the app normalize it into cron-backed execution.
        </p>

        <ScheduleForm />
        <SchedulesList schedules={schedules} />
      </section>
    </main>
  );
}
