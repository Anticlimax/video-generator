import path from "node:path";

import { createJobStore } from "../../../src/server/jobs/job-store.js";
import JobResultCard from "../../../components/job-result-card";
import JobStatusCard from "../../../components/job-status-card";

type JobDetailPageProps = {
  params: {
    id: string;
  };
};

const store = createJobStore({
  rootDir: path.join(process.cwd(), "jobs")
});

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const job = await store.getById(params.id);

  if (!job) {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow">Job</p>
          <h1>{params.id}</h1>
          <p className="lede">This job does not exist or has been removed.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell shell--detail">
      <section className="hero hero--detail">
        <div className="card card--detail-header">
          <p className="eyebrow">Job</p>
          <h1>{job.theme}</h1>
          <p className="lede">
            {job.style} · {Math.round(job.durationTargetSec)}s · {job.provider}
          </p>
          <p className="job-meta">ID: {job.id}</p>
        </div>

        <JobStatusCard job={job} />
        <JobResultCard job={job} />
      </section>
    </main>
  );
}
