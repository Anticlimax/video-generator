import path from "path";

import ScheduleForm from "../../../components/schedule-form";
import { createScheduleStore } from "../../../src/core/schedules/schedule-store.js";

type ScheduleDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const store = createScheduleStore({
  rootDir: path.join(process.cwd(), "schedules")
});

function formatDuration(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "";
  }
  if (numeric % 3600 === 0) {
    return `${numeric / 3600}h`;
  }
  if (numeric % 60 === 0) {
    return `${numeric / 60}m`;
  }
  return String(numeric);
}

export default async function ScheduleDetailPage({ params }: ScheduleDetailPageProps) {
  const resolvedParams = await params;
  const schedule = await store.getById(resolvedParams.id);

  if (!schedule) {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow">Schedule</p>
          <h1>{resolvedParams.id}</h1>
          <p className="lede">This schedule does not exist or has been removed.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Schedule</p>
        <h1>Edit recurring generation</h1>
        <p className="lede">Update the schedule timing and generation payload, then save it back into the queue.</p>

        <ScheduleForm
          mode="edit"
          scheduleId={schedule.id}
          initialValues={{
            kind: schedule.kind,
            time: schedule.time,
            weekday: schedule.weekday,
            theme: schedule.payload.theme,
            style: schedule.payload.style,
            duration: formatDuration(schedule.payload.durationTargetSec),
            provider: schedule.payload.provider,
            publishToYouTube: schedule.payload.publishToYouTube
          }}
        />
      </section>
    </main>
  );
}
