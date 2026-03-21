type JobStatusCardProps = {
  job: {
    status: string;
    stage: string;
    progress: number;
    createdAt: string;
    updatedAt: string;
    durationTargetSec: number;
    masterDurationSec?: number | null;
    provider?: string | null;
    motionProvider?: string | null;
    motionPresetPrimary?: string | null;
    motionPresetSecondary?: string | null;
    vfxAssetId?: string | null;
    motionClipDurationSec?: number | null;
  };
  onRetry?: (() => void) | null;
  isRetrying?: boolean;
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

export default function JobStatusCard({ job, onRetry = null, isRetrying = false }: JobStatusCardProps) {
  const progress = clampProgress(job.progress);
  const motionPreset = [job.motionPresetPrimary, job.motionPresetSecondary].filter(Boolean).join(" + ");

  return (
    <section className="card job-panel">
      <div className="job-panel__header">
        <div>
          <p className="eyebrow">Status</p>
          <h2>{job.stage}</h2>
        </div>
        <span className={`job-badge job-badge--${job.status}`}>{job.status}</span>
      </div>

      {job.status === "failed" && onRetry ? (
        <div className="job-actions">
          <button type="button" className="job-action" onClick={onRetry} disabled={isRetrying}>
            {isRetrying ? "Retrying..." : "Retry job"}
          </button>
        </div>
      ) : null}

      <div className="job-progress" aria-label={`Progress ${progress}%`}>
        <div className="job-progress__bar" style={{ width: `${progress}%` }} />
      </div>

      <dl className="job-stats">
        <div>
          <dt>Progress</dt>
          <dd>{progress}%</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{Math.round(job.durationTargetSec)}s</dd>
        </div>
        <div>
          <dt>Master</dt>
          <dd>{job.masterDurationSec ? `${Math.round(job.masterDurationSec)}s` : "auto"}</dd>
        </div>
        <div>
          <dt>Provider</dt>
          <dd>{job.provider || "mock"}</dd>
        </div>
        <div>
          <dt>Motion provider</dt>
          <dd>{job.motionProvider || "none"}</dd>
        </div>
        <div>
          <dt>Motion preset</dt>
          <dd>{motionPreset || "none"}</dd>
        </div>
        <div>
          <dt>Motion clip</dt>
          <dd>{job.motionClipDurationSec ? `${Math.round(job.motionClipDurationSec)}s` : "none"}</dd>
        </div>
        <div>
          <dt>VFX asset</dt>
          <dd>{job.vfxAssetId || "none"}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatTimestamp(job.createdAt)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatTimestamp(job.updatedAt)}</dd>
        </div>
      </dl>
    </section>
  );
}
