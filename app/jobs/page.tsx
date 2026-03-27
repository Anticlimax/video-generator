import path from "path";
import { cookies } from "next/headers";

import { createJobStore } from "../../src/core/jobs/job-store.js";
import JobsTable from "../../components/jobs-table";
import { defaultLocale, getDictionary, localeCookieName, normalizeLocale } from "../../src/i18n";

const store = createJobStore({
  rootDir: path.join(process.cwd(), "jobs")
});

export default async function JobsPage() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value || defaultLocale);
  const dictionary = getDictionary(locale);
  const jobs = await store.list({ limit: 50 });

  return (
    <main className="shell">
      <section className="hero hero--detail">
        <div className="card card--detail-header">
          <p className="eyebrow">{dictionary.nav.jobs}</p>
          <h1>{dictionary.jobs.title}</h1>
          <p className="lede">{dictionary.jobs.lede}</p>
        </div>

        <JobsTable
          jobs={jobs}
          copy={{
            empty: dictionary.jobs.empty,
            statusLabels: dictionary.jobs.statusLabels,
            stageLabels: dictionary.jobs.stageLabels
          }}
        />
      </section>
    </main>
  );
}
