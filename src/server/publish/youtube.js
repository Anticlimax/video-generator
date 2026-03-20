import path from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_YOUTUBE_PUBLISHER_SCRIPT_PATH = path.join(
  process.env.HOME || "",
  ".openclaw/workspace/skills/youtube-publisher/scripts/youtube_upload.py"
);

function trimText(value) {
  return String(value ?? "").trim();
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => trimText(tag)).filter(Boolean);
  }
  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((tag) => trimText(tag))
      .filter(Boolean);
  }
  return [];
}

function buildYoutubeMetadata({ theme, style, resolvedTheme }) {
  const normalizedTheme = trimText(theme);
  const normalizedStyle = trimText(style);
  const fallbackTheme = trimText(resolvedTheme?.label || resolvedTheme?.id || "Ambient");

  const title =
    normalizedTheme && normalizedStyle
      ? `${normalizedTheme} - ${normalizedStyle}`
      : normalizedTheme
        ? `${normalizedTheme} ambient video`
        : `${fallbackTheme} ambient video`;

  const description = [
    `Theme: ${normalizedTheme || fallbackTheme.toLowerCase() || "custom"}`,
    `Style: ${normalizedStyle || resolvedTheme?.music_style || "ambient"}`
  ].join("\n");

  const tags = normalizeTags([normalizedTheme || fallbackTheme.toLowerCase(), normalizedStyle]);

  return {
    title,
    description,
    tags,
    privacyStatus: "private",
    category: "10"
  };
}

function runCommand(command, args) {
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

function parseUploadOutput(output) {
  const trimmed = String(output || "").trim();
  if (!trimmed) {
    throw new Error("youtube_publish_parse_failed");
  }

  try {
    const parsed = JSON.parse(trimmed);
    const videoId =
      parsed?.videoId ||
      parsed?.video_id ||
      parsed?.result?.videoId ||
      parsed?.result?.video_id ||
      null;
    const url =
      parsed?.url ||
      parsed?.youtube_url ||
      parsed?.result?.url ||
      parsed?.result?.youtube_url ||
      null;
    const studioUrl =
      parsed?.studioUrl ||
      parsed?.studio_url ||
      parsed?.result?.studioUrl ||
      parsed?.result?.studio_url ||
      null;

    if (videoId && url) {
      return {
        videoId: String(videoId).trim(),
        url: String(url).trim(),
        studioUrl: studioUrl ? String(studioUrl).trim() : null
      };
    }
  } catch {
    // Fall through to regex parsing.
  }

  const videoIdMatch =
    trimmed.match(/视频 ID:\s*([A-Za-z0-9_-]+)/u) ||
    trimmed.match(/Video ID:\s*([A-Za-z0-9_-]+)/u) ||
    trimmed.match(/video_id:\s*([A-Za-z0-9_-]+)/iu);
  const urlMatch =
    trimmed.match(/链接:\s*(https:\/\/www\.youtube\.com\/watch\?v=[^\s]+)/u) ||
    trimmed.match(/URL:\s*(https:\/\/www\.youtube\.com\/watch\?v=[^\s]+)/iu) ||
    trimmed.match(/YouTube:\s*(https:\/\/www\.youtube\.com\/watch\?v=[^\s]+)/iu);
  const studioUrlMatch =
    trimmed.match(/Studio:\s*(https:\/\/studio\.youtube\.com\/video\/[^\s]+)/u) ||
    trimmed.match(/Studio URL:\s*(https:\/\/studio\.youtube\.com\/video\/[^\s]+)/iu) ||
    trimmed.match(/studio_url:\s*(https:\/\/studio\.youtube\.com\/video\/[^\s]+)/iu);

  if (!videoIdMatch || !urlMatch) {
    throw new Error("youtube_publish_parse_failed");
  }

  return {
    videoId: videoIdMatch[1],
    url: urlMatch[1],
    studioUrl: studioUrlMatch?.[1] || null
  };
}

export async function publishVideo({
  videoPath,
  theme = "",
  style = "",
  resolvedTheme = null,
  title,
  description,
  tags,
  privacyStatus = "private",
  category = "10",
  runtimeConfig = {},
  runCommandImpl = runCommand
} = {}) {
  const normalizedVideoPath = trimText(videoPath);
  if (!normalizedVideoPath) {
    throw new Error("missing_video_path");
  }

  const metadata = buildYoutubeMetadata({ theme, style, resolvedTheme });
  const uploadInput = {
    videoPath: normalizedVideoPath,
    title: trimText(title) || metadata.title,
    description: trimText(description) || metadata.description,
    tags: normalizeTags(tags).length > 0 ? normalizeTags(tags) : metadata.tags,
    privacyStatus: trimText(privacyStatus) || metadata.privacyStatus,
    category: trimText(category) || metadata.category
  };

  if (typeof runtimeConfig?.youtubeUploadImpl === "function") {
    const result = await runtimeConfig.youtubeUploadImpl(uploadInput);
    return {
      ok: true,
      ...uploadInput,
      videoId: result?.videoId || result?.video_id || null,
      url: result?.url || result?.youtube_url || null,
      studioUrl: result?.studioUrl || result?.studio_url || null
    };
  }

  const scriptPath =
    trimText(runtimeConfig?.youtubePublisherScriptPath) || DEFAULT_YOUTUBE_PUBLISHER_SCRIPT_PATH;
  const { stdout, stderr } = await runCommandImpl("python3", [
    scriptPath,
    "upload",
    normalizedVideoPath,
    "--title",
    uploadInput.title,
    "--description",
    uploadInput.description,
    "--privacy",
    uploadInput.privacyStatus,
    "--category",
    uploadInput.category,
    ...(uploadInput.tags.length > 0 ? ["--tags", ...uploadInput.tags] : [])
  ]);

  const parsed = parseUploadOutput(`${stdout}\n${stderr}`);
  return {
    ok: true,
    ...uploadInput,
    ...parsed
  };
}

export { buildYoutubeMetadata, normalizeTags, parseUploadOutput };
