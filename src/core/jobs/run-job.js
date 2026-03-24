import fs from "node:fs/promises";
import path from "node:path";

import { generateMusic } from "../media/generate-music.js";
import { generateCover } from "../media/generate-cover.js";
import { generateMotionVideo } from "../media/generate-motion-video.js";
import { generateVfxOverlayVideo } from "../media/generate-vfx-overlay-video.js";
import { resolveMotionPresets } from "../media/motion-presets.js";
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

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
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
  generateMotionVideoImpl = generateMotionVideo,
  generateVfxOverlayVideoImpl = generateVfxOverlayVideo,
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
    videoImagePath: path.join(jobDir, "video_image.png"),
    coverImagePath: path.join(jobDir, "cover_image.png"),
    motionVideoPath: path.join(jobDir, "motion_video.mp4"),
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

    let videoImageResult = null;
    let videoImageError = null;
    let coverResult = null;
    let motionVideoResult = null;
    try {
      await store.update(jobId, {
        status: "running",
        stage: "cover_generating",
        progress: 55
      });

      videoImageResult = await generateCoverImpl({
        rootDir,
        jobDir,
        artifactPaths: {
          ...artifactPaths,
          imagePath: artifactPaths.videoImagePath
        },
        theme: currentJob.theme,
        style: currentJob.style,
        resolvedTheme,
        prompt: currentJob.videoVisualPrompt || "",
        runtimeConfig
      });
    } catch (error) {
      videoImageResult = null;
      videoImageError = error;
    } finally {
      await store.update(jobId, {
        status: "running",
        stage: "cover_ready",
        progress: 70,
        videoImagePath: videoImageResult?.imagePath || null,
        coverImagePath: currentJob.generateSeparateCover ? null : videoImageResult?.imagePath || null,
        imageProvider: videoImageResult?.provider || null,
        imageModel: videoImageResult?.model || null,
        imageAttemptCount: videoImageResult?.attemptCount ?? null,
        imageFallbackUsed: videoImageResult?.fallbackUsed ?? null
      });
    }

    if (currentJob.generateMotionVideo && videoImageResult?.imagePath) {
      const motionClipDurationSec = Number(runtimeConfig.motionClipDurationSec || 5);
      try {
        await store.update(jobId, {
          status: "running",
          stage: "motion_generating",
          progress: 74
        });

        const presets = resolveMotionPresets({
          theme: currentJob.theme,
          style: currentJob.style,
          videoVisualPrompt: currentJob.videoVisualPrompt || ""
        });
        const rainOverlayPattern = String(runtimeConfig.rainVfxOverlayPattern || "").trim();
        const canUseRainVfx =
          presets.primaryPreset === "rain" &&
          rainOverlayPattern &&
          (await pathExists(rainOverlayPattern.replace("%04d", String(runtimeConfig.rainVfxStartNumber || 1001).padStart(4, "0"))));

        if (canUseRainVfx) {
          motionVideoResult = await generateVfxOverlayVideoImpl({
            rootDir,
            jobDir,
            artifactPaths: {
              ...artifactPaths,
              motionVideoPath: artifactPaths.motionVideoPath
            },
            imagePath: videoImageResult.imagePath,
            overlayPattern: rainOverlayPattern,
            assetId: String(runtimeConfig.rainVfxAssetId || "").trim() || "rain-on-glass-004",
            primaryPreset: presets.primaryPreset,
            secondaryPreset: presets.secondaryPreset,
            startNumber: Number(runtimeConfig.rainVfxStartNumber || 1001),
            durationSec: motionClipDurationSec,
            overlayOpacity: Number(runtimeConfig.rainVfxOverlayOpacity || 0.95)
          });
        } else {
          motionVideoResult = await generateMotionVideoImpl({
            rootDir,
            jobDir,
            artifactPaths: {
              ...artifactPaths,
              motionVideoPath: artifactPaths.motionVideoPath
            },
            imagePath: videoImageResult.imagePath,
            theme: currentJob.theme,
            style: currentJob.style,
            videoVisualPrompt: currentJob.videoVisualPrompt || "",
            resolvedTheme,
            durationSec: motionClipDurationSec,
            runtimeConfig
          });
        }
      } catch {
        motionVideoResult = null;
      } finally {
        await store.update(jobId, {
          status: "running",
          stage: "motion_ready",
          progress: 80,
          motionVideoPath: motionVideoResult?.motionVideoPath || null,
          motionProvider: motionVideoResult?.provider || null,
          motionPresetPrimary: motionVideoResult?.primaryPreset || null,
          motionPresetSecondary: motionVideoResult?.secondaryPreset || null,
          vfxAssetId: motionVideoResult?.assetId || null,
          motionClipDurationSec: motionVideoResult?.motionVideoPath ? motionClipDurationSec : null
        });
      }
    }

    if (currentJob.generateSeparateCover) {
      try {
        await store.update(jobId, {
          status: "running",
          stage: "cover_generating",
          progress: currentJob.generateMotionVideo ? 82 : 75
        });

        coverResult = await generateCoverImpl({
          rootDir,
          jobDir,
          artifactPaths: {
            ...artifactPaths,
            imagePath: artifactPaths.coverImagePath
          },
          theme: currentJob.theme,
          style: currentJob.style,
          resolvedTheme,
          prompt: currentJob.coverPrompt || "",
          runtimeConfig
        });
      } catch {
        coverResult = null;
      } finally {
        await store.update(jobId, {
          status: "running",
          stage: "cover_ready",
          progress: currentJob.generateMotionVideo ? 86 : 80,
          coverImagePath: coverResult?.imagePath || videoImageResult?.imagePath || null
        });
      }
    }

    await store.update(jobId, {
      status: "running",
      stage: "video_rendering",
      progress: 85
    });

    if (!videoImageResult?.imagePath && !motionVideoResult?.motionVideoPath) {
      if (videoImageError) {
        throw videoImageError;
      }
      throw new Error("image_generation_required");
    }

    const finalCoverImagePath = coverResult?.imagePath || videoImageResult?.imagePath || null;

    const renderResult = await renderVideoImpl({
      rootDir,
      outputRootDir,
      jobDir,
      artifactPaths,
      themeId: resolvedTheme?.id || "sleep-piano",
      masterAudioPath: musicResult.masterAudioPath,
      imagePath: videoImageResult?.imagePath || null,
      motionVideoPath: motionVideoResult?.motionVideoPath || null,
      durationTargetSec: currentJob.durationTargetSec,
      videoTemplateId: resolvedTheme?.video_template_id || "default-black",
      outputName: buildOutputName(currentJob)
    });

    const completedCoreJob = await store.update(jobId, {
      status: "completed",
      stage: "completed",
      progress: 100,
      videoImagePath: videoImageResult?.imagePath || null,
      coverImagePath: finalCoverImagePath,
      motionVideoPath: motionVideoResult?.motionVideoPath || null,
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
        videoImagePath: videoImageResult?.imagePath || null,
        coverImagePath: finalCoverImagePath,
        motionVideoPath: motionVideoResult?.motionVideoPath || null,
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
        videoImagePath: videoImageResult?.imagePath || null,
        coverImagePath: finalCoverImagePath,
        motionVideoPath: motionVideoResult?.motionVideoPath || null,
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
