type JobResultCardProps = {
  copy: {
    result: string;
    artifacts: string;
    motionProvider: string;
    motionPreset: string;
    vfxAsset: string;
    videoImage: string;
    coverImage: string;
    coverReused: string;
    motionVideo: string;
    masterAudio: string;
    finalVideo: string;
    youtubeVideoId: string;
    errorCode: string;
    errorMessage: string;
    openYouTubeVideo: string;
  };
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

export default function JobResultCard({ copy, job }: JobResultCardProps) {
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
          <p className="eyebrow">{copy.result}</p>
          <h2>{copy.artifacts}</h2>
        </div>
      </div>

      {videoImageUrl ? (
        <div className="job-preview">
          <img src={videoImageUrl} alt="Generated video image preview" className="job-preview__image" />
          <p className="job-preview__note">{copy.videoImage}</p>
        </div>
      ) : null}

      {coverUrl ? (
        <div className="job-preview">
          <img src={coverUrl} alt="Generated cover preview" className="job-preview__image" />
          {coverReusesVideoImage ? <p className="job-preview__note">{copy.coverReused}</p> : <p className="job-preview__note">{copy.coverImage}</p>}
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
          <p className="job-preview__note">{copy.motionVideo}</p>
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
        <ResultRow label={copy.motionProvider} value={job.motionProvider} />
        <ResultRow label={copy.motionPreset} value={motionPreset || null} />
        <ResultRow label={copy.vfxAsset} value={job.vfxAssetId} />
        <ResultRow label={copy.videoImage} value={job.videoImagePath} />
        <ResultRow label={copy.coverImage} value={job.coverImagePath} />
        <ResultRow label={copy.motionVideo} value={job.motionVideoPath} />
        <ResultRow label={copy.masterAudio} value={job.masterAudioPath} />
        <ResultRow label={copy.finalVideo} value={job.finalVideoPath} />
        <ResultRow label={copy.youtubeVideoId} value={job.youtubeVideoId} />
        <ResultRow label={copy.errorCode} value={job.errorCode} />
        <ResultRow label={copy.errorMessage} value={job.errorMessage} />
      </dl>

      {job.youtubeUrl ? (
        <p className="job-result__link">
          <a href={job.youtubeUrl} target="_blank" rel="noreferrer">
            {copy.openYouTubeVideo}
          </a>
        </p>
      ) : null}
    </section>
  );
}
