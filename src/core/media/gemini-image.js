import fs from "fs/promises";
import path from "path";

const DEFAULT_MODEL = "gemini-3-pro-image-preview";
const DEFAULT_IMAGE_SIZE = "1K";
const DEFAULT_ASPECT_RATIO = "16:9";
const DEFAULT_MAX_ATTEMPTS_PER_MODEL = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 750;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeBytes(data) {
  if (data == null) {
    return null;
  }

  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }

  if (typeof data === "string") {
    const raw = data.startsWith("data:") ? data.split(",").at(-1) || "" : data;
    return Buffer.from(raw, "base64");
  }

  return null;
}

function extractParts(response) {
  if (Array.isArray(response?.parts)) {
    return response.parts;
  }

  const candidateParts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(candidateParts)) {
    return candidateParts;
  }

  return [];
}

function getInlineData(part) {
  return part?.inlineData?.data ?? part?.inline_data?.data ?? null;
}

function extractInteractionOutputs(response) {
  if (Array.isArray(response?.outputs)) {
    return response.outputs;
  }

  return [];
}

function extractImageBytes(response) {
  const outputs = extractInteractionOutputs(response);
  const imageOutput = outputs.find((output) => output?.type === "image" && output?.data != null);
  const outputBytes = normalizeBytes(imageOutput?.data);
  if (outputBytes) {
    return outputBytes;
  }

  const parts = extractParts(response);
  const imagePart = parts.find((part) => getInlineData(part) != null);
  return normalizeBytes(getInlineData(imagePart));
}

function parseProviderError(error) {
  const rawMessage = String(error?.message || "").trim();
  if (!rawMessage) {
    return { code: null, status: null, rawMessage: "" };
  }

  try {
    const parsed = JSON.parse(rawMessage);
    return {
      code: Number(parsed?.error?.code || 0) || null,
      status: String(parsed?.error?.status || "").trim() || null,
      rawMessage
    };
  } catch {
    return {
      code: null,
      status: null,
      rawMessage
    };
  }
}

function isTransientProviderError(error) {
  const message = String(error?.message || "").trim();
  if (!message) {
    return false;
  }

  if (message === "cover_generation_timeout") {
    return true;
  }

  const parsed = parseProviderError(error);
  if (parsed.code === 429 || parsed.code === 503) {
    return true;
  }

  if (parsed.status === "RESOURCE_EXHAUSTED" || parsed.status === "UNAVAILABLE") {
    return true;
  }

  return false;
}

function sleep(delayMs) {
  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function getRemainingBudget(deadlineMs) {
  if (!Number.isFinite(deadlineMs)) {
    return Infinity;
  }

  return deadlineMs - Date.now();
}

function buildModelSequence(primaryModel, fallbackModel) {
  const models = [];

  if (normalizeText(primaryModel)) {
    models.push(normalizeText(primaryModel));
  }

  if (normalizeText(fallbackModel) && normalizeText(fallbackModel) !== normalizeText(primaryModel)) {
    models.push(normalizeText(fallbackModel));
  }

  return models;
}

function withTimeout(promise, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("cover_generation_timeout"));
    }, timeoutMs);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

async function createGeminiClient({ apiKey, clientFactory } = {}) {
  if (clientFactory) {
    return clientFactory({ apiKey });
  }

  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ apiKey });
}

export async function generateGeminiImage({
  prompt,
  outputPath,
  apiKey = "",
  model = DEFAULT_MODEL,
  fallbackModel = "",
  imageSize = DEFAULT_IMAGE_SIZE,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  timeoutMs = 60000,
  maxAttemptsPerModel = DEFAULT_MAX_ATTEMPTS_PER_MODEL,
  retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
  clientFactory,
  requestImpl
} = {}) {
  const resolvedPrompt = normalizeText(prompt);
  const resolvedOutputPath = normalizeText(outputPath);
  const resolvedApiKey = normalizeText(apiKey || process.env.GEMINI_API_KEY);

  if (!resolvedApiKey) {
    throw new Error("missing_gemini_api_key");
  }

  if (!resolvedPrompt) {
    throw new Error("missing_cover_prompt");
  }

  if (!resolvedOutputPath) {
    throw new Error("missing_output_path");
  }

  const client = await createGeminiClient({ apiKey: resolvedApiKey, clientFactory });
  const models = buildModelSequence(model, fallbackModel);
  const attemptLimit = Number.isFinite(Number(maxAttemptsPerModel))
    ? Math.max(1, Number(maxAttemptsPerModel))
    : DEFAULT_MAX_ATTEMPTS_PER_MODEL;
  const totalTimeoutMs = Number(timeoutMs || 0);
  const deadlineMs =
    Number.isFinite(totalTimeoutMs) && totalTimeoutMs > 0 ? Date.now() + totalTimeoutMs : Infinity;

  let lastError = null;
  let attemptCount = 0;
  let usedModel = models[0] || DEFAULT_MODEL;

  const request = async (requestedModel) => {
    if (typeof requestImpl === "function") {
      return requestImpl({
        client,
        model: requestedModel,
        prompt: resolvedPrompt,
        imageSize,
        aspectRatio
      });
    }

    return client.interactions.create({
      model: requestedModel,
      input: resolvedPrompt,
      response_modalities: ["image"]
    });
  };

  let response = null;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const currentModel = models[modelIndex];

    for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
      attemptCount += 1;
      usedModel = currentModel;

      try {
        const remainingBudgetMs = getRemainingBudget(deadlineMs);
        if (remainingBudgetMs <= 0) {
          const timeoutError = new Error("cover_generation_timeout");
          timeoutError.imageProvider = "gemini-image";
          timeoutError.imageModel = usedModel || null;
          timeoutError.imageAttemptCount = attemptCount - 1;
          timeoutError.imageFallbackUsed = normalizeText(fallbackModel)
            ? usedModel === normalizeText(fallbackModel)
            : false;
          throw timeoutError;
        }

        response = await withTimeout(request(currentModel), remainingBudgetMs);
        lastError = null;
        modelIndex = models.length;
        break;
      } catch (error) {
        lastError = error;

        if (!isTransientProviderError(error)) {
          throw error;
        }

        const isFinalAttemptForModel = attempt + 1 >= attemptLimit;
        if (isFinalAttemptForModel) {
          break;
        }

        const delayMs = Math.min(Number(retryBaseDelayMs || 0) * 2 ** attempt, Math.max(0, getRemainingBudget(deadlineMs)));
        if (delayMs <= 0) {
          break;
        }
        await sleep(delayMs);
      }
    }
  }

  if (!response) {
    const finalError = lastError || new Error("cover_generation_failed");
    finalError.imageProvider = "gemini-image";
    finalError.imageModel = usedModel || null;
    finalError.imageAttemptCount = attemptCount;
    finalError.imageFallbackUsed = normalizeText(fallbackModel)
      ? usedModel === normalizeText(fallbackModel)
      : false;
    throw finalError;
  }

  const imageBytes = extractImageBytes(response);

  if (!imageBytes || imageBytes.length === 0) {
    throw new Error("cover_generation_no_image");
  }

  await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await fs.writeFile(resolvedOutputPath, imageBytes);

  return {
    imagePath: resolvedOutputPath,
    prompt: resolvedPrompt,
    provider: "gemini-image",
    model: usedModel,
    attemptCount,
    fallbackUsed: normalizeText(fallbackModel) ? usedModel === normalizeText(fallbackModel) : false
  };
}
