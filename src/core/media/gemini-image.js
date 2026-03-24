import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_MODEL = "gemini-3-pro-image-preview";
const DEFAULT_IMAGE_SIZE = "1K";
const DEFAULT_ASPECT_RATIO = "16:9";

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
  imageSize = DEFAULT_IMAGE_SIZE,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  timeoutMs = 60000,
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

  const request = async () => {
    if (typeof requestImpl === "function") {
      return requestImpl({
        client,
        model,
        prompt: resolvedPrompt,
        imageSize,
        aspectRatio
      });
    }

    return client.models.generateContent({
      model,
      contents: resolvedPrompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          imageSize,
          aspectRatio
        }
      }
    });
  };

  const response = await withTimeout(request(), Number(timeoutMs || 0));
  const parts = extractParts(response);
  const imagePart = parts.find((part) => getInlineData(part) != null);
  const imageBytes = normalizeBytes(getInlineData(imagePart));

  if (!imageBytes || imageBytes.length === 0) {
    throw new Error("cover_generation_no_image");
  }

  await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await fs.writeFile(resolvedOutputPath, imageBytes);

  return {
    imagePath: resolvedOutputPath,
    prompt: resolvedPrompt,
    provider: "gemini-image",
    model
  };
}
