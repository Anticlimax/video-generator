const COMMAND_PATTERN =
  /^\/(?<command>ambient|ambient_publish)\s+(?<theme>[^|]+)\|(?<style>[^|]+)\|(?<duration>.+)$/i;

const STAGE_LABELS = {
  queued: "任务已创建",
  video_generating: "正在生成视频",
  theme_resolved: "已解析主题",
  music_generating: "正在生成音乐",
  music_ready: "音乐已生成",
  cover_generating: "正在生成封面图",
  cover_ready: "封面图已生成",
  video_rendering: "正在合成视频",
  youtube_uploading: "正在上传 YouTube",
  completed: "任务完成",
  failed: "任务失败"
};

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function actionFromCommand(command) {
  return command === "ambient_publish" ? "publish" : "generate";
}

function parseDurationToken(token) {
  const value = normalizeWhitespace(token).toLowerCase();
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|分钟|h|hr|hrs|hour|hours|小时)$/i);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  if (["s", "sec", "secs", "second", "seconds"].includes(unit)) {
    return Math.round(amount);
  }
  if (["m", "min", "mins", "minute", "minutes", "分钟"].includes(unit)) {
    return Math.round(amount * 60);
  }
  return Math.round(amount * 3600);
}

function formatDurationShort(seconds) {
  if (seconds % 3600 === 0) {
    return `${seconds / 3600}h`;
  }
  if (seconds % 60 === 0) {
    return `${seconds / 60}m`;
  }
  return `${seconds}s`;
}

function buildTaskSummary(progress) {
  const parts = [];
  if (progress.theme) {
    parts.push(progress.theme);
  }
  if (progress.style) {
    parts.push(progress.style);
  }
  if (typeof progress.duration_target_sec === "number") {
    parts.push(formatDurationShort(progress.duration_target_sec));
  }
  return parts.join(" | ");
}

function parseSlashCommand(text) {
  const match = text.match(COMMAND_PATTERN);
  if (!match?.groups) {
    return null;
  }

  const durationTargetSec = parseDurationToken(match.groups.duration);
  if (!durationTargetSec) {
    return {
      ok: false,
      error: "invalid_duration",
      requires_confirmation: false
    };
  }

  return {
    ok: true,
    action: actionFromCommand(match.groups.command.toLowerCase()),
    command: match.groups.command.toLowerCase(),
    theme: normalizeWhitespace(match.groups.theme),
    style: normalizeWhitespace(match.groups.style),
    duration_target_sec: durationTargetSec
  };
}

function parseNaturalLanguage(text) {
  const normalized = normalizeWhitespace(text);
  const durationMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*(分钟|小时|seconds?|secs?|minutes?|mins?|hours?|hrs?|m|h|s)/i
  );
  if (!durationMatch) {
    return {
      ok: false,
      requires_confirmation: false,
      error: "missing_duration"
    };
  }

  const durationTargetSec = parseDurationToken(`${durationMatch[1]}${durationMatch[2]}`);
  if (!durationTargetSec) {
    return {
      ok: false,
      requires_confirmation: false,
      error: "invalid_duration"
    };
  }

  const action = /上传|youtube|publish/i.test(normalized) ? "publish" : "generate";
  const afterDuration = normalized.slice(durationMatch.index + durationMatch[0].length);
  const beforeVideo = afterDuration.split(/视频|音乐|video/i)[0];
  const content = normalizeWhitespace(
    beforeVideo
      .replace(/^[的个条段\s]+/u, "")
      .replace(/主题/gu, " ")
      .replace(/并上传.*$/iu, "")
      .replace(/^一个/u, "")
  );

  if (!content) {
    return {
      ok: false,
      requires_confirmation: false,
      error: "missing_theme_style"
    };
  }

  const tokens = content.split(/\s+/).filter(Boolean);
  const theme = tokens[0] || null;
  const style = tokens.slice(1).join(" ") || null;

  return {
    ok: false,
    requires_confirmation: true,
    action,
    theme,
    style,
    duration_target_sec: durationTargetSec
  };
}

export function parseTelegramRequest(text) {
  const normalized = normalizeWhitespace(text);
  if (normalized.startsWith("/")) {
    return (
      parseSlashCommand(normalized) || {
        ok: false,
        requires_confirmation: false,
        error: "invalid_command_format"
      }
    );
  }

  return parseNaturalLanguage(normalized);
}

export function buildTelegramConfirmationMessage({
  action,
  theme,
  style,
  duration_target_sec
}) {
  const actionLabel = action === "publish" ? "生成并上传" : "仅生成";
  return [
    "我理解为：",
    `theme: ${theme || "未识别"}`,
    `style: ${style || "未识别"}`,
    `duration: ${formatDurationShort(duration_target_sec)}`,
    `action: ${actionLabel}`,
    "",
    "回复“确认”后开始。"
  ].join("\n");
}

export function renderTelegramProgressMessage(progress) {
  if (progress.stage === "completed" || progress.status === "done") {
    const lines = ["任务完成"];
    if (progress.artifacts?.final_output_path) {
      lines.push(`本地文件：${progress.artifacts.final_output_path}`);
    }
    if (progress.artifacts?.youtube_url) {
      lines.push(`YouTube：${progress.artifacts.youtube_url}`);
    }
    return lines.join("\n");
  }

  const taskSummary = buildTaskSummary(progress);
  return [
    `任务：${taskSummary || "处理中"}`,
    `状态：${STAGE_LABELS[progress.stage] || progress.message || progress.stage}`,
    `进度：${typeof progress.progress === "number" ? `${progress.progress}%` : "--"}`
  ].join("\n");
}
