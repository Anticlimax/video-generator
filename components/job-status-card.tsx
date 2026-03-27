type JobStatusCardProps = {
  copy: {
    retry: string;
    retrying: string;
    status: string;
    progress: string;
    duration: string;
    master: string;
    provider: string;
    motionProvider: string;
    motionPreset: string;
    motionClip: string;
    vfxAsset: string;
    created: string;
    updated: string;
    none: string;
    auto: string;
    statusLabels: Record<string, string>;
    stageLabels: Record<string, string>;
  };
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

export default function JobStatusCard({ copy, job, onRetry = null, isRetrying = false }: JobStatusCardProps) {
  const progress = clampProgress(job.progress);
  const motionPreset = [job.motionPresetPrimary, job.motionPresetSecondary].filter(Boolean).join(" + ");

  return (
    <section className="card job-panel">
      <div className="job-panel__header">
        <div>
          <p className="eyebrow">{copy.status}</p>
          <h2>{copy.stageLabels[job.stage] || job.stage}</h2>
        </div>
        <span className={`job-badge job-badge--${job.status}`}>{copy.statusLabels[job.status] || job.status}</span>
      </div>

      {job.status === "failed" && onRetry ? (
        <div className="job-actions">
          <button type="button" className="job-action" onClick={onRetry} disabled={isRetrying}>
            {isRetrying ? copy.retrying : copy.retry}
          </button>
        </div>
      ) : null}

      <div className="job-progress" aria-label={`Progress ${progress}%`}>
        <div className="job-progress__bar" style={{ width: `${progress}%` }} />
      </div>

      <dl className="job-stats">
        <div>
          <dt>{copy.progress}</dt>
          <dd>{progress}%</dd>
        </div>
        <div>
          <dt>{copy.duration}</dt>
          <dd>{Math.round(job.durationTargetSec)}s</dd>
        </div>
        <div>
          <dt>{copy.master}</dt>
          <dd>{job.masterDurationSec ? `${Math.round(job.masterDurationSec)}s` : copy.auto}</dd>
        </div>
        <div>
          <dt>{copy.provider}</dt>
          <dd>{job.provider || "mock"}</dd>
        </div>
        <div>
          <dt>{copy.motionProvider}</dt>
          <dd>{job.motionProvider || copy.none}</dd>
        </div>
        <div>
          <dt>{copy.motionPreset}</dt>
          <dd>{motionPreset || copy.none}</dd>
        </div>
        <div>
          <dt>{copy.motionClip}</dt>
          <dd>{job.motionClipDurationSec ? `${Math.round(job.motionClipDurationSec)}s` : copy.none}</dd>
        </div>
        <div>
          <dt>{copy.vfxAsset}</dt>
          <dd>{job.vfxAssetId || copy.none}</dd>
        </div>
        <div>
          <dt>{copy.created}</dt>
          <dd>{formatTimestamp(job.createdAt)}</dd>
        </div>
        <div>
          <dt>{copy.updated}</dt>
          <dd>{formatTimestamp(job.updatedAt)}</dd>
        </div>
      </dl>
    </section>
  );
}
