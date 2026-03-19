import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { createJobWorkspace } from "../../lib/jobs.js";
import { selectMasterDurationSec, validateTargetDurationSec } from "../../lib/duration-policy.js";
import { buildMusicPrompt } from "../../lib/music-prompt.js";
import { resolveMusicProvider } from "../../lib/music-provider.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function writeBinaryFile(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents);
}

async function writeJsonFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs, timeoutLabel) {
  const normalizedTimeoutMs = Math.max(1, Number(timeoutMs) || 0);
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(new Error(timeoutLabel)), normalizedTimeoutMs)
    : null;

  try {
    return await fetchImpl(url, {
      ...options,
      signal: controller?.signal
    });
  } catch (error) {
    if (error?.name === "AbortError" || error?.message === timeoutLabel) {
      throw new Error(timeoutLabel);
    }
    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function readMusicGptAudioUrl(payload, conversionId = "") {
  const normalizedConversionId = String(conversionId || "").trim();
  const conversionPayload =
    payload?.conversion || payload?.result?.conversion || payload?.data?.conversion || null;

  if (normalizedConversionId && conversionPayload) {
    const conversionId1 = String(
      conversionPayload?.conversion_id_1 ||
        payload?.conversion_id_1 ||
        payload?.result?.conversion_id_1 ||
        payload?.data?.conversion_id_1 ||
        ""
    ).trim();
    const conversionId2 = String(
      conversionPayload?.conversion_id_2 ||
        payload?.conversion_id_2 ||
        payload?.result?.conversion_id_2 ||
        payload?.data?.conversion_id_2 ||
        ""
    ).trim();

    if (normalizedConversionId === conversionId1) {
      return conversionPayload?.conversion_path_wav_1 || conversionPayload?.conversion_path_1 || null;
    }

    if (normalizedConversionId === conversionId2) {
      return conversionPayload?.conversion_path_wav_2 || conversionPayload?.conversion_path_2 || null;
    }
  }

  return (
    payload?.conversion_path_wav ||
    payload?.result?.conversion_path_wav ||
    payload?.data?.conversion_path_wav ||
    payload?.conversion?.conversion_path_wav ||
    payload?.result?.conversion?.conversion_path_wav ||
    payload?.data?.conversion?.conversion_path_wav ||
    payload?.conversion_path ||
    payload?.result?.conversion_path ||
    payload?.data?.conversion_path ||
    payload?.conversion?.conversion_path ||
    payload?.result?.conversion?.conversion_path ||
    payload?.data?.conversion?.conversion_path ||
    payload?.audio_url ||
    payload?.result?.audio_url ||
    payload?.data?.audio_url ||
    payload?.conversion?.audio_url ||
    payload?.result?.conversion?.audio_url ||
    payload?.data?.conversion?.audio_url ||
    payload?.audioUrl ||
    payload?.result?.audioUrl ||
    payload?.data?.audioUrl ||
    payload?.conversion?.audioUrl ||
    payload?.result?.conversion?.audioUrl ||
    payload?.data?.conversion?.audioUrl ||
    null
  );
}

function isMusicGptCompleted(payload) {
  const status = String(
    payload?.status ||
      payload?.result?.status ||
      payload?.data?.status ||
      payload?.conversion?.status ||
      payload?.result?.conversion?.status ||
      payload?.data?.conversion?.status ||
      ""
  )
    .trim()
    .toLowerCase();
  return status === "completed" || status === "success" || status === "done";
}

function isMusicGptFailed(payload) {
  const status = String(
    payload?.status ||
      payload?.result?.status ||
      payload?.data?.status ||
      payload?.conversion?.status ||
      payload?.result?.conversion?.status ||
      payload?.data?.conversion?.status ||
      ""
  )
    .trim()
    .toLowerCase();
  return status === "failed" || status === "error" || status === "cancelled";
}

function resolveTargetDurationSec(resolvedTheme, durationTargetSec, allowNonstandardDuration) {
  const requested = Number(durationTargetSec || resolvedTheme?.default_duration_sec || 0);
  if (allowNonstandardDuration) {
    return requested;
  }
  if (!resolvedTheme) {
    return requested;
  }
  return validateTargetDurationSec(resolvedTheme, requested);
}

export async function generateMusic({
  rootDir = "jobs",
  now,
  randomSuffix,
  theme = "",
  style = "",
  resolvedTheme = null,
  durationTargetSec,
  masterDurationSec,
  allowNonstandardDuration = false,
  mode = "mock",
  runtimeConfig = {},
  runCommandImpl = runCommand,
  fetchImpl = globalThis.fetch,
  sleepImpl = sleep
} = {}) {
  const provider = resolveMusicProvider({
    mode: mode || runtimeConfig.mode || "mock",
    infshAppId: runtimeConfig.infshAppId,
    elevenLabsApiKey: runtimeConfig.elevenLabsApiKey,
    musicGptApiKey: runtimeConfig.musicGptApiKey
  });
  const requestTimeoutMs = Number(provider.requestTimeoutSec || 30) * 1000;
  const resolvedNow = typeof now === "function" ? now() : now || new Date();
  const job = await createJobWorkspace({
    rootDir,
    now: resolvedNow,
    randomSuffix
  });
  const targetDuration = resolveTargetDurationSec(
    resolvedTheme,
    durationTargetSec,
    allowNonstandardDuration
  );
  const finalMasterDurationSec =
    masterDurationSec != null
      ? Number(masterDurationSec)
      : selectMasterDurationSec(resolvedTheme || {}, targetDuration);
  const prompt = buildMusicPrompt({
    themeId: resolvedTheme?.id || null,
    promptSeed: resolvedTheme?.prompt_seed || null,
    theme: String(theme || "").trim(),
    style: String(style || "").trim()
  });
  const normalized = await provider.normalizeResult({
    path: job.masterAudioPath
  });

  if (provider.name === "mock") {
    await runCommandImpl("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=220:duration=${finalMasterDurationSec}`,
      "-af",
      "volume=0.05",
      "-ar",
      "48000",
      "-ac",
      "2",
      job.masterAudioPath
    ]);
  } else if (provider.name === "elevenlabs") {
    if (!fetchImpl) {
      throw new Error("fetch_unavailable");
    }

    const request = provider.prepareRequest({
      prompt,
      durationSec: finalMasterDurationSec
    });
    const response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body)
    });

    if (!response.ok) {
      throw new Error(`elevenlabs_request_failed_${response.status}`);
    }

    const downloadPath = path.join(job.jobDir, "master_audio.mp3");
    await writeBinaryFile(downloadPath, Buffer.from(await response.arrayBuffer()));
    await runCommandImpl("ffmpeg", [
      "-y",
      "-i",
      downloadPath,
      "-ar",
      "48000",
      "-ac",
      "2",
      job.masterAudioPath
    ]);
  } else if (provider.name === "musicgpt") {
    if (!fetchImpl) {
      throw new Error("fetch_unavailable");
    }

    const startRequest = provider.prepareRequest({
      prompt,
      style: String(style || "").trim() || resolvedTheme?.music_style || "",
      durationSec: finalMasterDurationSec
    });
    const startResponse = await fetchWithTimeout(
      fetchImpl,
      startRequest.url,
      {
        method: startRequest.method,
        headers: startRequest.headers,
        body: JSON.stringify(startRequest.body)
      },
      requestTimeoutMs,
      "musicgpt_start_timeout"
    );

    if (!startResponse.ok) {
      throw new Error(`musicgpt_request_failed_${startResponse.status}`);
    }

    const startPayload = await startResponse.json();
    await writeJsonFile(path.join(job.jobDir, "musicgpt-start.json"), startPayload);
    const taskId = String(startPayload?.task_id || startPayload?.taskId || "").trim();
    if (!taskId) {
      throw new Error("musicgpt_task_id_missing");
    }

    const conversionIds = [
      startPayload?.conversion_id_1,
      startPayload?.conversion_id_2,
      startPayload?.conversionId1,
      startPayload?.conversionId2
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    const deadline = Date.now() + provider.timeoutSec * 1000;
    let audioUrl = null;

    while (Date.now() < deadline) {
      const lookupTargets = conversionIds.length > 0
        ? conversionIds.map((conversionId) => ({ conversionId }))
        : [{ taskId }];

      for (const lookupTarget of lookupTargets) {
        const statusRequest = provider.prepareStatusRequest(lookupTarget);
        const statusResponse = await fetchWithTimeout(
          fetchImpl,
          statusRequest.url,
          {
            method: statusRequest.method,
            headers: statusRequest.headers
          },
          requestTimeoutMs,
          "musicgpt_status_timeout"
        );

        if (!statusResponse.ok) {
          throw new Error(`musicgpt_status_failed_${statusResponse.status}`);
        }

        const statusPayload = await statusResponse.json();
        const statusSuffix = lookupTarget.conversionId || lookupTarget.taskId || "unknown";
        await writeJsonFile(
          path.join(job.jobDir, `musicgpt-status-${statusSuffix}.json`),
          statusPayload
        );

        audioUrl = readMusicGptAudioUrl(statusPayload, lookupTarget.conversionId);
        if (audioUrl && isMusicGptCompleted(statusPayload)) {
          break;
        }

        if (isMusicGptFailed(statusPayload)) {
          throw new Error("musicgpt_generation_failed");
        }
      }

      if (audioUrl) {
        break;
      }

      await sleepImpl(1000);
    }

    if (!audioUrl) {
      throw new Error("musicgpt_generation_timeout");
    }

    const downloadResponse = await fetchWithTimeout(
      fetchImpl,
      audioUrl,
      { method: "GET" },
      requestTimeoutMs,
      "musicgpt_download_timeout"
    );

    if (!downloadResponse.ok) {
      throw new Error(`musicgpt_download_failed_${downloadResponse.status}`);
    }

    const downloadPath = path.join(job.jobDir, "master_audio.mp3");
    await writeBinaryFile(downloadPath, Buffer.from(await downloadResponse.arrayBuffer()));
    await runCommandImpl("ffmpeg", [
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
    throw new Error(`unsupported_music_provider_${provider.name}`);
  }

  return {
    ok: true,
    jobId: job.jobId,
    jobDir: job.jobDir,
    themeId: resolvedTheme?.id || null,
    themeVersion: resolvedTheme?.version || null,
    prompt,
    provider: provider.name,
    masterAudioPath: job.masterAudioPath,
    targetDurationSec: targetDuration,
    masterDurationSec: finalMasterDurationSec,
    audioSpec: normalized.audioSpec
  };
}
