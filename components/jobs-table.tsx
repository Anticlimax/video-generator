type JobsTableProps = {
  copy: {
    empty: string;
    statusLabels: Record<string, string>;
    stageLabels: Record<string, string>;
  };
  jobs: Array<{
    id: string;
    theme: string;
    style: string;
    status: string;
    stage: string;
    progress: number;
    createdAt: string;
    durationTargetSec: number;
  }>;
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function clampProgress(progress: number) {
  if (!Number.isFinite(progress)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(progress)));
}

export default function JobsTable({ jobs, copy }: JobsTableProps) {
  if (!jobs.length) {
    return (
      <section className="card job-panel">
        <p className="lede">{copy.empty}</p>
      </section>
    );
  }

  return (
    <section className="card job-panel">
      <div className="job-table">
        {jobs.map((job) => {
          const progress = clampProgress(job.progress);

          return (
            <a key={job.id} className="job-table__row" href={`/jobs/${job.id}`}>
              <div className="job-table__main">
                <strong>{job.theme}</strong>
                <span>
                  {job.style} · {Math.round(job.durationTargetSec)}s
                </span>
              </div>
              <div className="job-table__meta">
                <span className={`job-badge job-badge--${job.status}`}>{copy.statusLabels[job.status] || job.status}</span>
                <span>{copy.stageLabels[job.stage] || job.stage}</span>
                <span>{progress}%</span>
                <span>{formatTimestamp(job.createdAt)}</span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
