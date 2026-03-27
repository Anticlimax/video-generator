import path from "path";
import { cookies } from "next/headers";

import { createJobStore } from "../../../src/core/jobs/job-store.js";
import JobDetailClient from "../../../components/job-detail-client";
import { defaultLocale, getDictionary, localeCookieName, normalizeLocale } from "../../../src/i18n";

type JobDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const store = createJobStore({
  rootDir: path.join(process.cwd(), "jobs")
});

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value || defaultLocale);
  const dictionary = getDictionary(locale);
  const resolvedParams = await params;
  const job = await store.getById(resolvedParams.id);

  if (!job) {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow">{dictionary.jobs.eyebrow}</p>
          <h1>{resolvedParams.id}</h1>
          <p className="lede">{dictionary.jobs.noMatch}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell shell--detail">
      <section className="hero hero--detail">
        <JobDetailClient
          initialJob={job}
          copy={{
            eyebrow: dictionary.jobs.eyebrow,
            retry: dictionary.jobs.retry,
            retrying: dictionary.jobs.retrying,
            result: dictionary.jobs.result,
            artifacts: dictionary.jobs.artifacts,
            status: dictionary.jobs.status,
            progress: dictionary.jobs.progress,
            duration: dictionary.jobs.duration,
            master: dictionary.jobs.master,
            provider: dictionary.jobs.provider,
            motionProvider: dictionary.jobs.motionProvider,
            motionPreset: dictionary.jobs.motionPreset,
            motionClip: dictionary.jobs.motionClip,
            vfxAsset: dictionary.jobs.vfxAsset,
            created: dictionary.jobs.created,
            updated: dictionary.jobs.updated,
            videoImage: dictionary.jobs.videoImage,
            coverImage: dictionary.jobs.coverImage,
            coverReused: dictionary.jobs.coverReused,
            motionVideo: dictionary.jobs.motionVideo,
            masterAudio: dictionary.jobs.masterAudio,
            finalVideo: dictionary.jobs.finalVideo,
            youtubeVideoId: dictionary.jobs.youtubeVideoId,
            errorCode: dictionary.jobs.errorCode,
            errorMessage: dictionary.jobs.errorMessage,
            openYouTubeVideo: dictionary.jobs.openYouTubeVideo,
            none: dictionary.jobs.none,
            auto: dictionary.jobs.auto,
            statusLabels: dictionary.jobs.statusLabels,
            stageLabels: dictionary.jobs.stageLabels
          }}
        />
      </section>
    </main>
  );
}
