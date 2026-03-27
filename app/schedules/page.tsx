import path from "path";
import { cookies } from "next/headers";

import ScheduleForm from "../../components/schedule-form";
import SchedulesList from "../../components/schedules-list";
import { createScheduleStore } from "../../src/core/schedules/schedule-store.js";
import { defaultLocale, getDictionary, localeCookieName, normalizeLocale } from "../../src/i18n";

const store = createScheduleStore({
  rootDir: path.join(process.cwd(), "schedules")
});

export default async function SchedulesPage() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value || defaultLocale);
  const dictionary = getDictionary(locale);
  const schedules = await store.list({ limit: 50 });

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">{dictionary.schedules.eyebrow}</p>
        <h1>{dictionary.schedules.title}</h1>
        <p className="lede">{dictionary.schedules.lede}</p>

        <ScheduleForm
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
        />
        <SchedulesList
          schedules={schedules}
          copy={{
            empty: dictionary.schedules.empty,
            enabled: dictionary.schedules.enabled,
            disabled: dictionary.schedules.disabled,
            next: dictionary.schedules.next,
            last: dictionary.schedules.last,
            never: dictionary.schedules.never,
            lastJob: dictionary.schedules.lastJob,
            edit: dictionary.schedules.edit,
            toggle: dictionary.schedules.toggle,
            runNow: dictionary.schedules.runNow,
            delete: dictionary.schedules.delete,
            daily: dictionary.schedules.daily,
            weekly: dictionary.schedules.weekly
          }}
        />
      </section>
    </main>
  );
}
