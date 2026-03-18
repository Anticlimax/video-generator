import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { loadThemeRegistry, resolveTheme } from "../src/lib/theme-registry.js";
import { createJobWorkspace, writeManifest, writeProgress } from "../src/lib/jobs.js";
import {
  selectMasterDurationSec,
  validateTargetDurationSec
} from "../src/lib/duration-policy.js";
import { buildMusicPrompt } from "../src/lib/music-prompt.js";
import { resolveMusicProvider } from "../src/lib/music-provider.js";
import { buildRenderPlan } from "../src/lib/render-plan.js";
import { buildVideoLoopArgs } from "../src/lib/ffmpeg-commands.js";
import { renderTelegramProgressMessage } from "../src/lib/telegram-adapter.js";

const NANO_BANANA_SCRIPT_PATH = path.join(
  process.env.HOME || "",
  ".nvm/versions/node/v22.20.0/lib/node_modules/openclaw/skills/nano-banana-pro/scripts/generate_image.py"
);
const YOUTUBE_PUBLISHER_SCRIPT_PATH = path.join(
  process.env.HOME || "",
  ".openclaw/workspace/skills/youtube-publisher/scripts/youtube_upload.py"
);
const DEFAULT_OPENCLAW_CONFIG_PATH = path.join(
  process.env.HOME || "",
  ".openclaw/openclaw.json"
);

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writePlaceholderFile(filePath, contents) {
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, contents, "utf8");
}

async function writeBinaryFile(filePath, contents) {
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, contents);
}

async function statSize(filePath) {
  const stats = await fs.stat(filePath);
  return stats.size;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}\n${stderr}`));
    });
  });
}

function runCommandCapture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} exited with code ${code}\n${stderr || stdout}`));
    });
  });
}

async function probeMedia(filePath) {
  const outputChunks = [];
  await new Promise((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type",
        "-show_entries",
        "format=duration,size",
        "-of",
        "json",
        filePath
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let stderr = "";
    child.stdout.on("data", (chunk) => outputChunks.push(String(chunk)));
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffprobe exited with code ${code}\n${stderr}`));
    });
  });

  return JSON.parse(outputChunks.join(""));
}

function toolResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ],
    data
  };
}

async function emitProgress(api, job, payload) {
  const progress = {
    ...payload,
    job_id: payload.job_id || job.jobId,
    updated_at: new Date().toISOString()
  };
  await writeProgress(job, progress);

  const runtimeConfig = await resolveRuntimeConfig(api);
  if (typeof runtimeConfig?.progressObserver === "function") {
    await runtimeConfig.progressObserver(progress);
  }
  await relayTelegramProgress(runtimeConfig, progress);

  return progress;
}

async function relayTelegramProgress(runtimeConfig, progress) {
  const chatId = String(progress.telegram_chat_id || "").trim();
  const messageId = String(progress.telegram_message_id || "").trim();
  const threadId = String(progress.telegram_thread_id || "").trim();

  if (!chatId || !messageId) {
    return;
  }

  if (typeof runtimeConfig?.telegramProgressRelayImpl === "function") {
    await runtimeConfig.telegramProgressRelayImpl(progress);
    return;
  }

  const args = [
    "message",
    "edit",
    "--channel",
    "telegram",
    "--target",
    chatId,
    "--message-id",
    messageId,
    "--message",
    renderTelegramProgressMessage(progress)
  ];

  if (threadId) {
    args.push("--thread-id", threadId);
  }

  await runCommand("openclaw", args);
}

async function resolveRuntimeConfig(api) {
  const directConfig = api?.config && typeof api.config === "object" ? api.config : {};
  const needsFallback =
    !directConfig.elevenLabsApiKey &&
    !directConfig.geminiApiKey &&
    !directConfig.infshAppId &&
    !directConfig.mode;

  if (!needsFallback) {
    return directConfig;
  }

  const configPath = api?.configFilePath || directConfig?.configFilePath || DEFAULT_OPENCLAW_CONFIG_PATH;

  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    const pluginConfig =
      parsed?.plugins?.entries?.["ambient-media-tools"]?.config &&
      typeof parsed.plugins.entries["ambient-media-tools"].config === "object"
        ? parsed.plugins.entries["ambient-media-tools"].config
        : {};

    return {
      ...pluginConfig,
      ...directConfig
    };
  } catch {
    return directConfig;
  }
}

const ambientMusicBuildInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    theme_id: { type: "string" },
    duration_target_sec: { type: "number" },
    master_duration_sec: { type: "number" },
    allow_nonstandard_duration: { type: "boolean" },
    seed: { type: "string" },
    mode: { type: "string", enum: ["mock", "elevenlabs", "infsh"] }
  },
  required: ["theme_id"]
};

const ambientMediaRenderInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    master_audio_path: { type: "string" },
    image_path: { type: "string" },
    duration_target_sec: { type: "number" },
    video_template_id: { type: "string" },
    output_name: { type: "string" }
  },
  required: ["master_audio_path", "duration_target_sec"]
};

const ambientVideoGenerateInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    theme_id: { type: "string" },
    theme: { type: "string" },
    style: { type: "string" },
    duration_target_sec: { type: "number" },
    master_duration_sec: { type: "number" },
    allow_nonstandard_duration: { type: "boolean" },
    seed: { type: "string" },
    mode: { type: "string", enum: ["mock", "elevenlabs", "infsh"] },
    video_template_id: { type: "string" },
    output_name: { type: "string" },
    telegram_chat_id: { type: "string" },
    telegram_message_id: { type: "string" },
    telegram_thread_id: { type: "string" }
  },
};

const ambientCoverGenerateInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    theme_id: { type: "string" },
    theme: { type: "string" },
    style: { type: "string" },
    output_name: { type: "string" }
  }
};

const ambientVideoPublishInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    theme_id: { type: "string" },
    theme: { type: "string" },
    style: { type: "string" },
    duration_target_sec: { type: "number" },
    master_duration_sec: { type: "number" },
    allow_nonstandard_duration: { type: "boolean" },
    seed: { type: "string" },
    mode: { type: "string", enum: ["mock", "elevenlabs", "infsh"] },
    video_template_id: { type: "string" },
    output_name: { type: "string" },
    telegram_chat_id: { type: "string" },
    telegram_message_id: { type: "string" },
    telegram_thread_id: { type: "string" },
    youtube_title: { type: "string" },
    youtube_description: { type: "string" },
    youtube_tags: {
      type: "array",
      items: { type: "string" }
    },
    privacy_status: {
      type: "string",
      enum: ["private", "public", "unlisted"]
    },
    youtube_category: { type: "string" }
  }
};

function resolveTargetDurationSec(theme, args) {
  const requestedDurationSec = Number(args?.duration_target_sec || theme.default_duration_sec || 0);
  if (args?.allow_nonstandard_duration) {
    return requestedDurationSec;
  }
  return validateTargetDurationSec(theme, requestedDurationSec);
}

function resolveThemeFromArgs(registry, args) {
  const themeId = String(args?.theme_id || "").trim();
  if (themeId) {
    const theme = registry.get(themeId);
    if (!theme) {
      throw new Error("theme_not_found");
    }
    return theme;
  }

  return resolveTheme(registry, {
    theme: args?.theme,
    style: args?.style
  });
}

function buildCoverPrompt({ theme, style, resolvedTheme }) {
  const parts = [
    "Cinematic ambient background for a long-form relaxation video.",
    "Low stimulation, soft lighting, no text, no close-up people, no strong action.",
    "Composition suitable for a long static video frame.",
    "16:9 aspect ratio."
  ];

  if (theme) {
    parts.push(`Theme: ${theme}.`);
  } else if (resolvedTheme?.label) {
    parts.push(`Theme family: ${resolvedTheme.label}.`);
  }

  if (style) {
    parts.push(`Style: ${style}.`);
  }

  if (resolvedTheme?.description) {
    parts.push(`Mood guide: ${resolvedTheme.description}`);
  }

  return parts.join(" ");
}

function normalizeYoutubeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }
  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function buildYoutubeTitle({ theme, style, resolvedTheme }) {
  if (style && theme) {
    return `${theme} - ${style}`;
  }
  if (theme) {
    return `${theme} ambient video`;
  }
  return `${resolvedTheme?.label || "Ambient"} ambient video`;
}

async function runYoutubeUpload(api, args) {
  const runtimeConfig = await resolveRuntimeConfig(api);
  const videoPath = String(args.videoPath).trim();
  const title = String(args.title).trim();
  const description = String(args.description || "").trim();
  const tags = normalizeYoutubeTags(args.tags);
  const privacyStatus = String(args.privacyStatus || "private").trim();
  const category = String(args.category || "10").trim();

  if (typeof runtimeConfig?.youtubeUploadImpl === "function") {
    return runtimeConfig.youtubeUploadImpl({
      videoPath,
      title,
      description,
      tags,
      privacyStatus,
      category
    });
  }

  const commandArgs = [
    YOUTUBE_PUBLISHER_SCRIPT_PATH,
    "upload",
    videoPath,
    "--title",
    title,
    "--description",
    description,
    "--privacy",
    privacyStatus,
    "--category",
    category
  ];

  if (tags.length > 0) {
    commandArgs.push("--tags", ...tags);
  }

  const { stdout, stderr } = await runCommandCapture("python3", commandArgs);
  const output = `${stdout}\n${stderr}`;
  const videoIdMatch = output.match(/视频 ID:\s*([A-Za-z0-9_-]+)/);
  const urlMatch = output.match(/链接:\s*(https:\/\/www\.youtube\.com\/watch\?v=[^\s]+)/);
  const studioUrlMatch = output.match(/Studio:\s*(https:\/\/studio\.youtube\.com\/video\/[^\s]+)/);

  if (!videoIdMatch || !urlMatch) {
    throw new Error("youtube_upload_parse_failed");
  }

  return {
    videoId: videoIdMatch[1],
    url: urlMatch[1],
    studioUrl: studioUrlMatch?.[1] || null
  };
}

async function runCoverGenerator(api, { outputPath, prompt }) {
  const runtimeConfig = await resolveRuntimeConfig(api);

  if (typeof runtimeConfig?.coverGeneratorImpl === "function") {
    return runtimeConfig.coverGeneratorImpl({ outputPath, prompt });
  }

  const args = [
    "run",
    NANO_BANANA_SCRIPT_PATH,
    "--prompt",
    prompt,
    "--filename",
    outputPath,
    "--resolution",
    "1K",
    "--aspect-ratio",
    "16:9"
  ];

  if (runtimeConfig?.geminiApiKey) {
    args.push("--api-key", String(runtimeConfig.geminiApiKey));
  }

  await runCommand("uv", args);

  return {
    imagePath: outputPath,
    prompt,
    provider: "nano-banana-pro"
  };
}

async function runAmbientCoverGenerate(api, args) {
  const registry = await loadThemeRegistry();
  const resolvedTheme = resolveThemeFromArgs(registry, args);
  const job = await createJobWorkspace();
  const imagePath = path.join(job.jobDir, "cover_image.png");
  const outputName = String(args?.output_name || "").trim();
  const prompt = buildCoverPrompt({
    theme: String(args?.theme || "").trim(),
    style: String(args?.style || "").trim(),
    resolvedTheme
  });

  const coverResult = await runCoverGenerator(api, {
    outputPath: imagePath,
    prompt,
    outputName
  });

  await writeManifest(job, {
    ok: true,
    stage: "ambient_cover_generate",
    themeId: resolvedTheme?.id || null,
    themeVersion: resolvedTheme?.version || null,
    prompt,
    provider: coverResult.provider
  });

  return toolResult({
    ok: true,
    job_id: job.jobId,
    theme_id: resolvedTheme?.id || null,
    theme_version: resolvedTheme?.version || null,
    image_path: coverResult.imagePath,
    prompt: coverResult.prompt,
    provider: coverResult.provider
  });
}

async function runAmbientMusicBuild(api, args) {
  const registry = await loadThemeRegistry();
  const theme = resolveThemeFromArgs(registry, args);
  const runtimeConfig = await resolveRuntimeConfig(api);

  const provider = resolveMusicProvider({
    mode: args?.mode || runtimeConfig?.mode || "mock",
    infshAppId: runtimeConfig?.infshAppId,
    elevenLabsApiKey: runtimeConfig?.elevenLabsApiKey
  });
  const job = await createJobWorkspace();
  const prompt = buildMusicPrompt({
    themeId: theme?.id || null,
    promptSeed: theme?.prompt_seed || null,
    theme: String(args?.theme || "").trim(),
    style: String(args?.style || "").trim()
  });

  const normalized = await provider.normalizeResult({
    path: job.masterAudioPath
  });
  const targetDurationSec = resolveTargetDurationSec(theme || {}, args);
  const masterDurationSec =
    args?.master_duration_sec != null
      ? Number(args.master_duration_sec)
      : selectMasterDurationSec(theme || {}, targetDurationSec);

  if (provider.name === "mock") {
    await ensureParentDir(job.masterAudioPath);
    await runCommand("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=220:duration=${masterDurationSec}`,
      "-af",
      "volume=0.05",
      "-ar",
      "48000",
      "-ac",
      "2",
      job.masterAudioPath
    ]);
  } else if (provider.name === "elevenlabs") {
    const request = provider.prepareRequest({
      prompt,
      durationSec: masterDurationSec
    });
    const fetchImpl = runtimeConfig?.fetchImpl || globalThis.fetch;
    if (!fetchImpl) {
      throw new Error("fetch_unavailable");
    }

    const response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body)
    });

    if (!response.ok) {
      throw new Error(`elevenlabs_request_failed_${response.status}`);
    }

    const downloadPath = path.join(job.jobDir, "master_audio.mp3");
    const downloadBuffer = Buffer.from(await response.arrayBuffer());
    await writeBinaryFile(downloadPath, downloadBuffer);

    await runCommand("ffmpeg", [
      "-y",
      "-i",
      downloadPath,
      "-ar",
      "48000",
      "-ac",
      "2",
      job.masterAudioPath
    ]);
  } else {
    await writePlaceholderFile(
      job.masterAudioPath,
      `provider=${provider.name}\n${prompt}\nseed=${args?.seed || ""}\n`
    );
  }

  await writeManifest(job, {
    ok: true,
    stage: "ambient_music_build",
    themeId: theme?.id || null,
    themeVersion: theme?.version || null,
    prompt,
    provider: provider.name,
    targetDurationSec,
    masterDurationSec
  });

  return toolResult({
    ok: true,
    job_id: job.jobId,
    theme_id: theme?.id || null,
    theme_version: theme?.version || null,
    master_audio_path: job.masterAudioPath,
    target_duration_sec: targetDurationSec,
    master_duration_sec: masterDurationSec,
    loop_strategy: "crossfade_loop",
    audio_spec: normalized.audioSpec,
    qc_notes: ["low-dynamics", "loop-safe-prompt"]
  });
}

async function runAmbientMediaRender(_api, args) {
  const job = await createJobWorkspace();
  const outputName = String(args?.output_name || "ambient-output");
  const finalOutputPath = path.join("outputs", `${outputName}.mp4`);
  const plan = buildRenderPlan({
    themeId: "sleep-piano",
    durationTargetSec: Number(args?.duration_target_sec || 0),
    videoTemplateId: String(args?.video_template_id || "default-black")
  });
  const masterAudioPath = String(args?.master_audio_path || "").trim();
  const imagePath = String(args?.image_path || "").trim();
  const durationSec = Number(args?.duration_target_sec || 0);

  await ensureParentDir(job.extendedAudioPath);
  await ensureParentDir(job.loopVideoPath);
  await ensureParentDir(finalOutputPath);

  await runCommand("ffmpeg", [
    "-y",
    "-stream_loop",
    "-1",
    "-i",
    masterAudioPath,
    "-t",
    String(durationSec),
    "-af",
    `loudnorm=I=${plan.audio.targetLufs}`,
    "-ar",
    "48000",
    "-ac",
    "2",
    job.extendedAudioPath
  ]);

  if (imagePath) {
    await runCommand("ffmpeg", [
      "-y",
      "-loop",
      "1",
      "-i",
      imagePath,
      "-t",
      String(durationSec),
      "-vf",
      "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
      "-r",
      "24",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      job.loopVideoPath
    ]);
  } else {
    await runCommand("ffmpeg", [
      "-y",
      ...buildVideoLoopArgs({
        videoTemplateId: plan.video.templateId,
        durationTargetSec: durationSec,
        outputPath: job.loopVideoPath
      })
    ]);
  }

  await runCommand("ffmpeg", [
    "-y",
    "-i",
    job.loopVideoPath,
    "-i",
    job.extendedAudioPath,
    "-shortest",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    finalOutputPath
  ]);

  const probe = await probeMedia(finalOutputPath);
  await fs.writeFile(job.ffprobePath, `${JSON.stringify(probe, null, 2)}\n`, "utf8");

  const fileSizes = {
    audio_bytes: await statSize(job.extendedAudioPath),
    video_bytes: await statSize(job.loopVideoPath),
    final_bytes: await statSize(finalOutputPath)
  };

  await writeManifest(job, {
    ok: true,
    stage: "ambient_media_render",
    outputName,
    plan,
    fileSizes
  });

  return toolResult({
    ok: true,
    job_id: job.jobId,
    audio_output_path: job.extendedAudioPath,
    video_output_path: job.loopVideoPath,
    final_output_path: finalOutputPath,
    duration_sec: durationSec,
    ffprobe_summary: {
      video_streams: (probe.streams || []).filter((stream) => stream.codec_type === "video").length,
      audio_streams: (probe.streams || []).filter((stream) => stream.codec_type === "audio").length
    },
    file_sizes: fileSizes,
    render_manifest_path: path.join(job.jobDir, "manifest.json")
  });
}

async function runAmbientVideoGenerate(api, args) {
  const registry = await loadThemeRegistry();
  const theme = resolveThemeFromArgs(registry, args);
  const progressJob = await createJobWorkspace();
  const themeText = String(args?.theme || "").trim();
  const styleText = String(args?.style || "").trim();

  const durationSec = resolveTargetDurationSec(theme || {}, args);
  const outputName =
    String(args?.output_name || `${theme?.id || "custom"}-${durationSec}s`).trim() ||
    `${theme?.id || "custom"}-${durationSec}s`;

  const baseArtifacts = {
    master_audio_path: null,
    cover_image_path: null,
    final_output_path: null
  };
  await emitProgress(api, progressJob, {
    stage: "queued",
    status: "running",
    progress: 0,
    message: "任务已创建，等待开始处理",
    theme: themeText,
    style: styleText,
    duration_target_sec: durationSec,
    telegram_chat_id: args?.telegram_chat_id,
    telegram_message_id: args?.telegram_message_id,
    telegram_thread_id: args?.telegram_thread_id,
    artifacts: baseArtifacts
  });
  await emitProgress(api, progressJob, {
    stage: "theme_resolved",
    status: "running",
    progress: 10,
    message: theme?.id ? `主题已解析为 ${theme.id}` : "未命中预设主题族，按自由文本生成",
    theme: themeText,
    style: styleText,
    duration_target_sec: durationSec,
    telegram_chat_id: args?.telegram_chat_id,
    telegram_message_id: args?.telegram_message_id,
    telegram_thread_id: args?.telegram_thread_id,
    artifacts: baseArtifacts
  });
  await emitProgress(api, progressJob, {
    stage: "music_generating",
    status: "running",
    progress: 20,
    message: "正在生成音乐母带",
    theme: themeText,
    style: styleText,
    duration_target_sec: durationSec,
    telegram_chat_id: args?.telegram_chat_id,
    telegram_message_id: args?.telegram_message_id,
    telegram_thread_id: args?.telegram_thread_id,
    artifacts: baseArtifacts
  });

  const musicResult = await runAmbientMusicBuild(api, {
    theme_id: theme?.id,
    theme: args?.theme,
    style: args?.style,
    duration_target_sec: durationSec,
    master_duration_sec: args?.master_duration_sec,
    allow_nonstandard_duration: args?.allow_nonstandard_duration,
    seed: args?.seed,
    mode: args?.mode
  });
  const musicArtifacts = {
    ...baseArtifacts,
    master_audio_path: musicResult.data.master_audio_path
  };
  await emitProgress(api, progressJob, {
    stage: "music_ready",
    status: "running",
    progress: 45,
    message: "音乐母带已生成",
    theme: themeText,
    style: styleText,
    duration_target_sec: durationSec,
    telegram_chat_id: args?.telegram_chat_id,
    telegram_message_id: args?.telegram_message_id,
    telegram_thread_id: args?.telegram_thread_id,
    artifacts: musicArtifacts
  });

  let coverResult = null;
  await emitProgress(api, progressJob, {
    stage: "cover_generating",
    status: "running",
    progress: 55,
    message: "正在生成封面图",
    theme: themeText,
    style: styleText,
    duration_target_sec: durationSec,
    telegram_chat_id: args?.telegram_chat_id,
    telegram_message_id: args?.telegram_message_id,
    telegram_thread_id: args?.telegram_thread_id,
    artifacts: musicArtifacts
  });
  try {
    coverResult = await runAmbientCoverGenerate(api, {
      theme_id: theme?.id,
      theme: args?.theme,
      style: args?.style,
      output_name: outputName
    });
  } catch {
    coverResult = null;
  }
  const coverArtifacts = {
    ...musicArtifacts,
    cover_image_path: coverResult?.data?.image_path || null
  };
  await emitProgress(api, progressJob, {
    stage: "cover_ready",
    status: "running",
    progress: 70,
    message: coverResult?.data?.image_path ? "封面图已生成" : "封面图生成失败，已回退到默认视频模板",
    theme: themeText,
    style: styleText,
    duration_target_sec: durationSec,
    telegram_chat_id: args?.telegram_chat_id,
    telegram_message_id: args?.telegram_message_id,
    telegram_thread_id: args?.telegram_thread_id,
    artifacts: coverArtifacts
  });

  await emitProgress(api, progressJob, {
    stage: "video_rendering",
    status: "running",
    progress: 85,
    message: "正在合成静态视频与长音频",
    theme: themeText,
    style: styleText,
    duration_target_sec: durationSec,
    telegram_chat_id: args?.telegram_chat_id,
    telegram_message_id: args?.telegram_message_id,
    telegram_thread_id: args?.telegram_thread_id,
    artifacts: coverArtifacts
  });

  const renderResult = await runAmbientMediaRender(api, {
    master_audio_path: musicResult.data.master_audio_path,
    image_path: coverResult?.data?.image_path,
    duration_target_sec: durationSec,
    video_template_id: String(args?.video_template_id || theme?.video_template_id || "default-black"),
    output_name: outputName
  });
  const completedArtifacts = {
    ...coverArtifacts,
    final_output_path: renderResult.data.final_output_path
  };
  await emitProgress(api, progressJob, {
    stage: "completed",
    status: "done",
    progress: 100,
    message: "已生成完成",
    theme: themeText,
    style: styleText,
    duration_target_sec: durationSec,
    telegram_chat_id: args?.telegram_chat_id,
    telegram_message_id: args?.telegram_message_id,
    telegram_thread_id: args?.telegram_thread_id,
    artifacts: completedArtifacts
  });

  return toolResult({
    ok: true,
    theme_id: theme?.id || null,
    theme_version: theme?.version || null,
    master_job_id: musicResult.data.job_id,
    render_job_id: renderResult.data.job_id,
    master_audio_path: musicResult.data.master_audio_path,
    master_duration_sec: musicResult.data.master_duration_sec,
    cover_image_path: coverResult?.data?.image_path || null,
    final_output_path: renderResult.data.final_output_path,
    duration_sec: durationSec,
    ffprobe_summary: renderResult.data.ffprobe_summary,
    file_sizes: renderResult.data.file_sizes,
    progress_path: progressJob.progressPath
  });
}

async function runAmbientVideoPublish(api, args) {
  const registry = await loadThemeRegistry();
  const theme = resolveThemeFromArgs(registry, args);
  const publishJob = await createJobWorkspace();
  const runtimeConfig = await resolveRuntimeConfig(api);
  const themeText = String(args?.theme || "").trim();
  const styleText = String(args?.style || "").trim();

  await emitProgress(api, publishJob, {
    stage: "queued",
    status: "running",
    progress: 0,
    message: "发布任务已创建",
    theme: themeText,
    style: styleText,
    duration_target_sec: Number(args?.duration_target_sec || 0),
    telegram_chat_id: args?.telegram_chat_id,
    telegram_message_id: args?.telegram_message_id,
    telegram_thread_id: args?.telegram_thread_id,
    artifacts: {
      final_output_path: null,
      youtube_url: null
    }
  });

  await emitProgress(api, publishJob, {
    stage: "video_generating",
    status: "running",
    progress: 35,
    message: "正在生成视频",
    theme: themeText,
    style: styleText,
    duration_target_sec: Number(args?.duration_target_sec || 0),
    telegram_chat_id: args?.telegram_chat_id,
    telegram_message_id: args?.telegram_message_id,
    telegram_thread_id: args?.telegram_thread_id,
    artifacts: {
      final_output_path: null,
      youtube_url: null
    }
  });

  const videoResult = await runAmbientVideoGenerate(
    {
      ...api,
      config: {
        ...runtimeConfig,
        progressObserver: undefined
      }
    },
    args
  );
  const finalOutputPath = videoResult.data.final_output_path;

  await emitProgress(api, publishJob, {
    stage: "youtube_uploading",
    status: "running",
    progress: 85,
    message: "正在上传到 YouTube",
    theme: themeText,
    style: styleText,
    duration_target_sec: Number(args?.duration_target_sec || 0),
    telegram_chat_id: args?.telegram_chat_id,
    telegram_message_id: args?.telegram_message_id,
    telegram_thread_id: args?.telegram_thread_id,
    artifacts: {
      final_output_path: finalOutputPath,
      youtube_url: null
    }
  });

  const uploadResult = await runYoutubeUpload(
    {
      ...api,
      config: runtimeConfig
    },
    {
    videoPath: finalOutputPath,
    title: args?.youtube_title || buildYoutubeTitle({ theme: themeText, style: styleText, resolvedTheme: theme }),
    description: args?.youtube_description || `Theme: ${themeText || theme?.id || "custom"}\nStyle: ${styleText || theme?.music_style || "ambient"}`,
    tags: args?.youtube_tags || [theme?.id || "custom", ...(theme?.tags || [])],
    privacyStatus: args?.privacy_status || "private",
    category: args?.youtube_category || "10"
    }
  );

  await emitProgress(api, publishJob, {
    stage: "completed",
    status: "done",
    progress: 100,
    message: "视频已上传到 YouTube",
    theme: themeText,
    style: styleText,
    duration_target_sec: Number(args?.duration_target_sec || 0),
    telegram_chat_id: args?.telegram_chat_id,
    telegram_message_id: args?.telegram_message_id,
    telegram_thread_id: args?.telegram_thread_id,
    artifacts: {
      final_output_path: finalOutputPath,
      youtube_url: uploadResult.url
    }
  });

  return toolResult({
    ok: true,
    theme_id: videoResult.data.theme_id,
    theme_version: videoResult.data.theme_version,
    final_output_path: finalOutputPath,
    duration_sec: videoResult.data.duration_sec,
    youtube_video_id: uploadResult.videoId,
    youtube_url: uploadResult.url,
    youtube_studio_url: uploadResult.studioUrl,
    ffprobe_summary: videoResult.data.ffprobe_summary,
    file_sizes: videoResult.data.file_sizes,
    progress_path: publishJob.progressPath
  });
}

export function registerAmbientTools(api) {
  api.registerTool({
    name: "ambient_music_build",
    description: "Generate or plan a short ambient music master",
    parameters: ambientMusicBuildInputSchema,
    schema: ambientMusicBuildInputSchema,
    async execute(_callId, args) {
      return runAmbientMusicBuild(api, args);
    }
  });

  api.registerTool({
    name: "ambient_media_render",
    description: "Extend audio, loop video, and export a final MP4",
    parameters: ambientMediaRenderInputSchema,
    schema: ambientMediaRenderInputSchema,
    async execute(_callId, args) {
      return runAmbientMediaRender(api, args);
    }
  });

  api.registerTool({
    name: "ambient_video_generate",
    description: "Build ambient music and render the final ambient video in one call",
    parameters: ambientVideoGenerateInputSchema,
    schema: ambientVideoGenerateInputSchema,
    async execute(_callId, args) {
      return runAmbientVideoGenerate(api, args);
    }
  });

  api.registerTool({
    name: "ambient_cover_generate",
    description: "Generate a single thematic cover image for ambient video rendering",
    parameters: ambientCoverGenerateInputSchema,
    schema: ambientCoverGenerateInputSchema,
    async execute(_callId, args) {
      return runAmbientCoverGenerate(api, args);
    }
  });

  api.registerTool({
    name: "ambient_video_publish",
    description: "Generate an ambient video and upload it to YouTube in one call",
    parameters: ambientVideoPublishInputSchema,
    schema: ambientVideoPublishInputSchema,
    async execute(_callId, args) {
      return runAmbientVideoPublish(api, args);
    }
  });
}

export default {
  id: "ambient-media-tools",
  name: "Ambient Media Tools",
  description: "OpenClaw helpers for ambient longform media generation",
  register(api) {
    registerAmbientTools(api);
  }
};
