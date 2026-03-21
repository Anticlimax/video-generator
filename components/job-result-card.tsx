type JobResultCardProps = {
  job: {
    id: string;
    videoImagePath?: string | null;
    coverImagePath?: string | null;
    motionVideoPath?: string | null;
    masterAudioPath?: string | null;
    finalVideoPath?: string | null;
    youtubeUrl?: string | null;
    youtubeVideoId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    motionProvider?: string | null;
    motionPresetPrimary?: string | null;
    motionPresetSecondary?: string | null;
    vfxAssetId?: string | null;
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
  const videoImageUrl = job.videoImagePath ? `/api/jobs/${job.id}/artifacts/video-image` : null;
  const coverUrl = job.coverImagePath ? `/api/jobs/${job.id}/artifacts/cover` : null;
  const motionVideoUrl = job.motionVideoPath ? `/api/jobs/${job.id}/artifacts/motion-video` : null;
  const videoUrl = job.finalVideoPath ? `/api/jobs/${job.id}/artifacts/video` : null;
  const coverReusesVideoImage = Boolean(job.videoImagePath && job.coverImagePath && job.videoImagePath === job.coverImagePath);
  const motionPreset = [job.motionPresetPrimary, job.motionPresetSecondary].filter(Boolean).join(" + ");

  return (
    <section className="card job-panel">
      <div className="job-panel__header">
        <div>
          <p className="eyebrow">Result</p>
          <h2>Artifacts</h2>
        </div>
      </div>

      {videoImageUrl ? (
        <div className="job-preview">
          <img src={videoImageUrl} alt="Generated video image preview" className="job-preview__image" />
          <p className="job-preview__note">视频画面图</p>
        </div>
      ) : null}

      {coverUrl ? (
        <div className="job-preview">
          <img src={coverUrl} alt="Generated cover preview" className="job-preview__image" />
          {coverReusesVideoImage ? <p className="job-preview__note">封面复用视频画面图</p> : <p className="job-preview__note">封面图</p>}
        </div>
      ) : null}

      {motionVideoUrl ? (
        <div className="job-preview">
          <video
            src={motionVideoUrl}
            controls
            preload="metadata"
            className="job-preview__video"
          />
          <p className="job-preview__note">微动视频</p>
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
        <ResultRow label="Motion provider" value={job.motionProvider} />
        <ResultRow label="Motion preset" value={motionPreset || null} />
        <ResultRow label="VFX asset" value={job.vfxAssetId} />
        <ResultRow label="视频画面图" value={job.videoImagePath} />
        <ResultRow label="封面图" value={job.coverImagePath} />
        <ResultRow label="微动视频" value={job.motionVideoPath} />
        <ResultRow label="Master audio" value={job.masterAudioPath} />
        <ResultRow label="Final video" value={job.finalVideoPath} />
        <ResultRow label="YouTube video id" value={job.youtubeVideoId} />
        <ResultRow label="Error code" value={job.errorCode} />
        <ResultRow label="Error message" value={job.errorMessage} />
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
