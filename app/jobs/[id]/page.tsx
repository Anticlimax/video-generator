import path from "path";

import { createJobStore } from "../../../src/core/jobs/job-store.js";
import JobDetailClient from "../../../components/job-detail-client";

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
        <JobDetailClient initialJob={job} />
      </section>
    </main>
  );
}
