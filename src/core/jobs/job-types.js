export const JOB_STATUSES = Object.freeze(["queued", "running", "completed", "failed"]);

export const JOB_STAGES = Object.freeze([
  "queued",
  "music_generating",
  "music_ready",
  "cover_generating",
  "cover_ready",
  "motion_generating",
  "motion_ready",
  "video_rendering",
  "youtube_uploading",
  "completed",
  "failed"
]);

const DEFAULT_ARTIFACT_FIELDS = Object.freeze({
  videoImagePath: null,
  coverImagePath: null,
  motionVideoPath: null,
  masterAudioPath: null,
  finalVideoPath: null,
  youtubeUrl: null,
  youtubeVideoId: null
});

const DEFAULT_ERROR_FIELDS = Object.freeze({
  errorCode: null,
  errorMessage: null
});

const DEFAULT_MOTION_FIELDS = Object.freeze({
  motionProvider: null,
  motionPresetPrimary: null,
  motionPresetSecondary: null,
  vfxAssetId: null,
  motionClipDurationSec: null
});

function assertValidEnum(value, validValues, label) {
  if (!validValues.includes(value)) {
    throw new Error(`invalid_${label}`);
  }
}

function assertFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`invalid_${label}`);
  }
}

function normalizeText(value, label) {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new Error(`missing_${label}`);
  }
  return text;
}

function normalizeOptionalText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeOptionalNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const number = Number(value);
  assertFiniteNumber(number, "number");
  return number;
}

function normalizeProgress(value) {
  if (value == null) {
    return 0;
  }
  const number = Number(value);
  assertFiniteNumber(number, "progress");
  return number;
}

function normalizeArtifacts(record = {}) {
  return {
    videoImagePath: normalizeOptionalText(record.videoImagePath),
    coverImagePath: normalizeOptionalText(record.coverImagePath),
    motionVideoPath: normalizeOptionalText(record.motionVideoPath),
    masterAudioPath: normalizeOptionalText(record.masterAudioPath),
    finalVideoPath: normalizeOptionalText(record.finalVideoPath),
    youtubeUrl: normalizeOptionalText(record.youtubeUrl),
    youtubeVideoId: normalizeOptionalText(record.youtubeVideoId)
  };
}

function normalizeMotionFields(record = {}) {
  return {
    motionProvider: normalizeOptionalText(record.motionProvider),
    motionPresetPrimary: normalizeOptionalText(record.motionPresetPrimary),
    motionPresetSecondary: normalizeOptionalText(record.motionPresetSecondary),
    vfxAssetId: normalizeOptionalText(record.vfxAssetId),
    motionClipDurationSec: normalizeOptionalNumber(record.motionClipDurationSec)
  };
}

export function createJobRecord(input = {}) {
  const id = normalizeText(input.id, "id");
  const theme = normalizeText(input.theme, "theme");
  const style = normalizeText(input.style, "style");
  const durationTargetSec = Number(input.durationTargetSec);
  assertFiniteNumber(durationTargetSec, "durationTargetSec");

  const status = input.status ?? "queued";
  const stage = input.stage ?? "queued";
  assertValidEnum(status, JOB_STATUSES, "status");
  assertValidEnum(stage, JOB_STAGES, "stage");

  const createdAt = normalizeText(input.createdAt, "createdAt");
  const updatedAt = normalizeText(input.updatedAt, "updatedAt");

  return {
    id,
    theme,
    style,
    durationTargetSec,
    masterDurationSec: normalizeOptionalNumber(input.masterDurationSec),
    provider: normalizeOptionalText(input.provider) || "mock",
    publishToYouTube: Boolean(input.publishToYouTube),
    videoVisualPrompt: normalizeOptionalText(input.videoVisualPrompt),
    generateSeparateCover: Boolean(input.generateSeparateCover),
    generateMotionVideo: Boolean(input.generateMotionVideo),
    coverPrompt: normalizeOptionalText(input.coverPrompt),
    status,
    stage,
    progress: normalizeProgress(input.progress),
    createdAt,
    updatedAt,
    ...DEFAULT_ARTIFACT_FIELDS,
    ...normalizeArtifacts(input),
    ...DEFAULT_MOTION_FIELDS,
    ...normalizeMotionFields(input),
    ...DEFAULT_ERROR_FIELDS,
    errorCode: normalizeOptionalText(input.errorCode),
    errorMessage: normalizeOptionalText(input.errorMessage)
  };
}

export function mergeJobRecord(existing, patch = {}, nowIso) {
  const { artifacts: _artifacts, ...restPatch } = patch;
  const merged = {
    ...existing,
    ...restPatch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: normalizeText(nowIso, "updatedAt"),
    masterAudioPath:
      restPatch.masterAudioPath !== undefined
        ? normalizeOptionalText(restPatch.masterAudioPath)
        : existing.masterAudioPath,
    videoImagePath:
      restPatch.videoImagePath !== undefined
        ? normalizeOptionalText(restPatch.videoImagePath)
        : existing.videoImagePath,
    coverImagePath:
      restPatch.coverImagePath !== undefined
        ? normalizeOptionalText(restPatch.coverImagePath)
        : existing.coverImagePath,
    motionVideoPath:
      restPatch.motionVideoPath !== undefined
        ? normalizeOptionalText(restPatch.motionVideoPath)
        : existing.motionVideoPath,
    motionProvider:
      restPatch.motionProvider !== undefined
        ? normalizeOptionalText(restPatch.motionProvider)
        : existing.motionProvider,
    motionPresetPrimary:
      restPatch.motionPresetPrimary !== undefined
        ? normalizeOptionalText(restPatch.motionPresetPrimary)
        : existing.motionPresetPrimary,
    motionPresetSecondary:
      restPatch.motionPresetSecondary !== undefined
        ? normalizeOptionalText(restPatch.motionPresetSecondary)
        : existing.motionPresetSecondary,
    vfxAssetId:
      restPatch.vfxAssetId !== undefined
        ? normalizeOptionalText(restPatch.vfxAssetId)
        : existing.vfxAssetId,
    motionClipDurationSec:
      restPatch.motionClipDurationSec !== undefined
        ? normalizeOptionalNumber(restPatch.motionClipDurationSec)
        : existing.motionClipDurationSec,
    finalVideoPath:
      restPatch.finalVideoPath !== undefined
        ? normalizeOptionalText(restPatch.finalVideoPath)
        : existing.finalVideoPath,
    youtubeUrl:
      restPatch.youtubeUrl !== undefined
        ? normalizeOptionalText(restPatch.youtubeUrl)
        : existing.youtubeUrl,
    youtubeVideoId:
      restPatch.youtubeVideoId !== undefined
        ? normalizeOptionalText(restPatch.youtubeVideoId)
        : existing.youtubeVideoId,
    videoVisualPrompt:
      restPatch.videoVisualPrompt !== undefined
        ? normalizeOptionalText(restPatch.videoVisualPrompt)
        : existing.videoVisualPrompt,
    generateSeparateCover:
      restPatch.generateSeparateCover !== undefined
        ? Boolean(restPatch.generateSeparateCover)
        : existing.generateSeparateCover,
    generateMotionVideo:
      restPatch.generateMotionVideo !== undefined
        ? Boolean(restPatch.generateMotionVideo)
        : existing.generateMotionVideo,
    coverPrompt:
      restPatch.coverPrompt !== undefined
        ? normalizeOptionalText(restPatch.coverPrompt)
        : existing.coverPrompt,
    progress:
      restPatch.progress !== undefined ? normalizeProgress(restPatch.progress) : existing.progress,
    publishToYouTube:
      restPatch.publishToYouTube !== undefined ? Boolean(restPatch.publishToYouTube) : existing.publishToYouTube,
    status: restPatch.status ?? existing.status,
    stage: restPatch.stage ?? existing.stage,
    errorCode:
      restPatch.errorCode !== undefined ? normalizeOptionalText(restPatch.errorCode) : existing.errorCode,
    errorMessage:
      restPatch.errorMessage !== undefined
        ? normalizeOptionalText(restPatch.errorMessage)
        : existing.errorMessage
  };

  assertValidEnum(merged.status, JOB_STATUSES, "status");
  assertValidEnum(merged.stage, JOB_STAGES, "stage");
  return merged;
}

export function normalizeJobRecord(record) {
  return createJobRecord(record);
}
