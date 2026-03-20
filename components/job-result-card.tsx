type JobResultCardProps = {
  job: {
    id: string;
    coverImagePath?: string | null;
    masterAudioPath?: string | null;
    finalVideoPath?: string | null;
    youtubeUrl?: string | null;
    youtubeVideoId?: string | null;
  };
};

function ResultRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }

  return (
    <div className="job-result__row">
      <dt>{label}</dt>
      <dd>
        <code>{value}</code>
      </dd>
    </div>
  );
}

export default function JobResultCard({ job }: JobResultCardProps) {
  const coverUrl = job.coverImagePath ? `/api/jobs/${job.id}/artifacts/cover` : null;
  const videoUrl = job.finalVideoPath ? `/api/jobs/${job.id}/artifacts/video` : null;

  return (
    <section className="card job-panel">
      <div className="job-panel__header">
        <div>
          <p className="eyebrow">Result</p>
          <h2>Artifacts</h2>
        </div>
      </div>

      {coverUrl ? (
        <div className="job-preview">
          <img src={coverUrl} alt="Generated cover preview" className="job-preview__image" />
        </div>
      ) : null}

      {videoUrl ? (
        <div className="job-preview">
          <video
            src={videoUrl}
            controls
            preload="metadata"
            className="job-preview__video"
          />
        </div>
      ) : null}

      <dl className="job-result">
        <ResultRow label="Cover image" value={job.coverImagePath} />
        <ResultRow label="Master audio" value={job.masterAudioPath} />
        <ResultRow label="Final video" value={job.finalVideoPath} />
        <ResultRow label="YouTube video id" value={job.youtubeVideoId} />
      </dl>

      {job.youtubeUrl ? (
        <p className="job-result__link">
          <a href={job.youtubeUrl} target="_blank" rel="noreferrer">
            Open YouTube video
          </a>
        </p>
      ) : null}
    </section>
  );
}
