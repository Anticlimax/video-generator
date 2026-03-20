import path from "node:path";

import { createJobStore } from "../../src/server/jobs/job-store.js";
import JobsTable from "../../components/jobs-table";

const store = createJobStore({
  rootDir: path.join(process.cwd(), "jobs")
});

export default async function JobsPage() {
  const jobs = await store.list({ limit: 50 });

  return (
    <main className="shell">
      <section className="hero hero--detail">
        <div className="card card--detail-header">
          <p className="eyebrow">Jobs</p>
          <h1>Recent generations</h1>
          <p className="lede">Task history, status, and result links in one place.</p>
        </div>

        <JobsTable jobs={jobs} />
      </section>
    </main>
  );
}
