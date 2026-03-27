import path from "path";
import { cookies } from "next/headers";

import ScheduleForm from "../../../components/schedule-form";
import { createScheduleStore } from "../../../src/core/schedules/schedule-store.js";
import { defaultLocale, getDictionary, localeCookieName, normalizeLocale } from "../../../src/i18n";

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
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value || defaultLocale);
  const dictionary = getDictionary(locale);
  const resolvedParams = await params;
  const schedule = await store.getById(resolvedParams.id);

  if (!schedule) {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow">{dictionary.schedules.eyebrow}</p>
          <h1>{resolvedParams.id}</h1>
          <p className="lede">{dictionary.schedules.noMatch}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">{dictionary.schedules.eyebrow}</p>
        <h1>{dictionary.schedules.editTitle}</h1>
        <p className="lede">{dictionary.schedules.editLede}</p>

        <ScheduleForm
          mode="edit"
          copy={{
            type: dictionary.schedules.type,
            daily: dictionary.schedules.daily,
            weekly: dictionary.schedules.weekly,
            time: dictionary.schedules.time,
            weekday: dictionary.schedules.weekday,
            weekdays: [
              dictionary.schedules.sunday,
              dictionary.schedules.monday,
              dictionary.schedules.tuesday,
              dictionary.schedules.wednesday,
              dictionary.schedules.thursday,
              dictionary.schedules.friday,
              dictionary.schedules.saturday
            ],
            theme: dictionary.schedules.theme,
            style: dictionary.schedules.style,
            duration: dictionary.schedules.duration,
            durationHint: dictionary.schedules.durationHint,
            provider: dictionary.schedules.provider,
            publishToYouTube: dictionary.schedules.publishToYouTube,
            save: dictionary.schedules.save,
            saving: dictionary.schedules.saving,
            create: dictionary.schedules.create,
            creating: dictionary.schedules.creating
          }}
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
