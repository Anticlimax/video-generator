import path from "node:path";

import { generateMusic } from "../media/generate-music.js";
import { generateCover } from "../media/generate-cover.js";
import { renderVideo } from "../media/render-video.js";
import { publishVideo } from "../publish/youtube.js";

function toErrorCode(error) {
  const message = String(error?.message || "job_run_failed").trim();
  return message || "job_run_failed";
}

function buildOutputName(job) {
  const themePart = String(job.theme || "ambient")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const durationPart = `${Number(job.durationTargetSec || 0)}s`;
  return `${themePart || "ambient"}-${durationPart}`;
}

export async function runJob({
  jobId,
  store,
  resolvedTheme = null,
  rootDir = "jobs",
  outputRootDir = "outputs",
  runtimeConfig = {},
  generateMusicImpl = generateMusic,
  generateCoverImpl = generateCover,
  renderVideoImpl = renderVideo,
  publishVideoImpl = publishVideo
} = {}) {
  const currentJob = await store.getById(jobId);
  if (!currentJob) {
    throw new Error("job_not_found");
  }
  const resolvedRootDir = store.rootDir || rootDir;
  const jobDir = path.join(resolvedRootDir, jobId);
  const artifactPaths = {
    masterAudioPath: path.join(jobDir, "master_audio.wav"),
    coverImagePath: path.join(jobDir, "cover_image.png"),
    extendedAudioPath: path.join(jobDir, "extended_audio.wav"),
    loopVideoPath: path.join(jobDir, "loop_video.mp4"),
    ffprobePath: path.join(jobDir, "ffprobe.json")
  };

  try {
    await store.update(jobId, {
      status: "running",
      stage: "music_generating",
      progress: 20
    });

    const musicResult = await generateMusicImpl({
      rootDir,
      jobDir,
      artifactPaths,
      theme: currentJob.theme,
      style: currentJob.style,
      resolvedTheme,
      durationTargetSec: currentJob.durationTargetSec,
      masterDurationSec: currentJob.masterDurationSec,
      provider: currentJob.provider,
      mode: currentJob.provider,
      runtimeConfig
    });

    await store.update(jobId, {
      status: "running",
      stage: "music_ready",
      progress: 45,
      masterAudioPath: musicResult.masterAudioPath,
      masterDurationSec: musicResult.masterDurationSec
    });

    let coverResult = null;
    try {
      await store.update(jobId, {
        status: "running",
        stage: "cover_generating",
        progress: 55
      });

      coverResult = await generateCoverImpl({
        rootDir,
        jobDir,
        artifactPaths,
        theme: currentJob.theme,
        style: currentJob.style,
        resolvedTheme,
        runtimeConfig
      });
    } catch {
      coverResult = null;
    } finally {
      await store.update(jobId, {
        status: "running",
        stage: "cover_ready",
        progress: 70,
        coverImagePath: coverResult?.imagePath || null
      });
    }

    await store.update(jobId, {
      status: "running",
      stage: "video_rendering",
      progress: 85
    });

    const renderResult = await renderVideoImpl({
      rootDir,
      outputRootDir,
      jobDir,
      artifactPaths,
      themeId: resolvedTheme?.id || "sleep-piano",
      masterAudioPath: musicResult.masterAudioPath,
      imagePath: coverResult?.imagePath || null,
      durationTargetSec: currentJob.durationTargetSec,
      videoTemplateId: resolvedTheme?.video_template_id || "default-black",
      outputName: buildOutputName(currentJob)
    });

    const completedCoreJob = await store.update(jobId, {
      status: "completed",
      stage: "completed",
      progress: 100,
      finalVideoPath: renderResult.finalOutputPath,
      youtubeUrl: null,
      youtubeVideoId: null,
      errorCode: null,
      errorMessage: null
    });

    if (!currentJob.publishToYouTube) {
      return completedCoreJob;
    }

    await store.update(jobId, {
      status: "running",
      stage: "youtube_uploading",
      progress: 90
    });

    try {
      const publishResult = await publishVideoImpl({
        videoPath: renderResult.finalOutputPath,
        theme: currentJob.theme,
        style: currentJob.style,
        resolvedTheme,
        runtimeConfig
      });

      return store.update(jobId, {
        status: "completed",
        stage: "completed",
        progress: 100,
        finalVideoPath: renderResult.finalOutputPath,
        youtubeUrl: publishResult.url || null,
        youtubeVideoId: publishResult.videoId || null,
        errorCode: null,
        errorMessage: null
      });
    } catch (error) {
      return store.update(jobId, {
        status: "completed",
        stage: "completed",
        progress: 100,
        finalVideoPath: renderResult.finalOutputPath,
        youtubeUrl: null,
        youtubeVideoId: null,
        errorCode: toErrorCode(error),
        errorMessage: String(error?.message || "youtube_publish_failed").trim() || "youtube_publish_failed"
      });
    }
  } catch (error) {
    return store.update(jobId, {
      status: "failed",
      stage: "failed",
      errorCode: toErrorCode(error),
      errorMessage: String(error?.message || "job_run_failed").trim() || "job_run_failed"
    });
  }
}
