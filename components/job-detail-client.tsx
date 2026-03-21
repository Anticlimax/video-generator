"use client";

import { useEffect, useState } from "react";

import JobResultCard from "./job-result-card";
import JobStatusCard from "./job-status-card";

type JobRecord = {
  id: string;
  theme: string;
  style: string;
  status: string;
  stage: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  durationTargetSec: number;
  masterDurationSec?: number | null;
  provider?: string | null;
  videoImagePath?: string | null;
  coverImagePath?: string | null;
  motionVideoPath?: string | null;
  masterAudioPath?: string | null;
  finalVideoPath?: string | null;
  youtubeUrl?: string | null;
  youtubeVideoId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  videoVisualPrompt?: string | null;
  generateSeparateCover?: boolean;
  generateMotionVideo?: boolean;
  coverPrompt?: string | null;
  motionProvider?: string | null;
  motionPresetPrimary?: string | null;
  motionPresetSecondary?: string | null;
  vfxAssetId?: string | null;
  motionClipDurationSec?: number | null;
};

type JobDetailClientProps = {
  initialJob: JobRecord;
};

function isTerminalStatus(status: string) {
  return status === "completed" || status === "failed";
}

export default function JobDetailClient({ initialJob }: JobDetailClientProps) {
  const [job, setJob] = useState(initialJob);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (isTerminalStatus(job.status)) {
      return undefined;
    }

    let isCancelled = false;
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${job.id}`, {
          cache: "no-store"
        });
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        if (!isCancelled && payload?.job) {
          setJob(payload.job);
        }
      } catch {
        // keep the current snapshot and retry on the next interval
      }
    }, 2000);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [job.id, job.status]);

  async function handleRetry() {
    try {
      setIsRetrying(true);
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: "POST"
      });
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      if (payload?.job) {
        window.location.href = `/jobs/${payload.job.id}`;
      }
    } catch {
      // keep the current job visible if retry fails
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <>
      <div className="card card--detail-header">
        <p className="eyebrow">Job</p>
        <h1>{job.theme}</h1>
        <p className="lede">
          {job.style} · {Math.round(job.durationTargetSec)}s · {job.provider}
        </p>
        <p className="job-meta">ID: {job.id}</p>
      </div>

      <JobStatusCard job={job} onRetry={handleRetry} isRetrying={isRetrying} />
      <JobResultCard job={job} />
    </>
  );
}
