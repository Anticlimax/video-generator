import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { generateGeminiImage } from "../../src/core/media/gemini-image.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ambient-gemini-image-"));
}

test("generateGeminiImage writes image bytes through interactions API and reports metadata", async () => {
  const rootDir = makeTempDir();
  const outputPath = path.join(rootDir, "cover.png");
  const expectedBytes = Buffer.from("fake png bytes");
  const calls = [];

  const result = await generateGeminiImage({
    apiKey: "test-key",
    prompt: "storm city at night",
    outputPath,
    clientFactory: () => ({
      interactions: {
        create: async (request) => {
          calls.push(request);
          return {
            outputs: [{ type: "image", mime_type: "image/png", data: expectedBytes }]
          };
        }
      }
    })
  });

  assert.equal(result.provider, "gemini-image");
  assert.equal(result.imagePath, outputPath);
  assert.equal(result.prompt, "storm city at night");
  assert.equal(result.model, "gemini-3-pro-image-preview");
  assert.equal(result.attemptCount, 1);
  assert.equal(result.fallbackUsed, false);
  assert.equal(fs.existsSync(outputPath), true);
  assert.deepEqual(fs.readFileSync(outputPath), expectedBytes);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, "gemini-3-pro-image-preview");
  assert.deepEqual(calls[0].response_modalities, ["image"]);
});

test("generateGeminiImage retries transient 503 failures and eventually succeeds", async () => {
  const rootDir = makeTempDir();
  const outputPath = path.join(rootDir, "cover.png");
  const expectedBytes = Buffer.from("fake png bytes");
  const calls = [];

  const result = await generateGeminiImage({
    apiKey: "test-key",
    prompt: "storm city at night",
    outputPath,
    retryBaseDelayMs: 1,
    maxAttemptsPerModel: 3,
    clientFactory: () => ({
      interactions: {
        create: async ({ model }) => {
          calls.push(model);
          if (calls.length < 3) {
            throw new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}');
          }
          return {
            outputs: [{ type: "image", mime_type: "image/png", data: expectedBytes }]
          };
        }
      }
    })
  });

  assert.equal(result.model, "gemini-3-pro-image-preview");
  assert.equal(result.attemptCount, 3);
  assert.equal(result.fallbackUsed, false);
  assert.deepEqual(calls, [
    "gemini-3-pro-image-preview",
    "gemini-3-pro-image-preview",
    "gemini-3-pro-image-preview"
  ]);
});

test("generateGeminiImage falls back to the secondary model after exhausting the primary model", async () => {
  const rootDir = makeTempDir();
  const outputPath = path.join(rootDir, "cover.png");
  const expectedBytes = Buffer.from("fake png bytes");
  const calls = [];

  const result = await generateGeminiImage({
    apiKey: "test-key",
    prompt: "storm city at night",
    outputPath,
    fallbackModel: "gemini-2.5-flash-image-preview",
    retryBaseDelayMs: 1,
    maxAttemptsPerModel: 2,
    clientFactory: () => ({
      interactions: {
        create: async ({ model }) => {
          calls.push(model);
          if (model === "gemini-3-pro-image-preview") {
            throw new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}');
          }
          return {
            outputs: [{ type: "image", mime_type: "image/png", data: expectedBytes }]
          };
        }
      }
    })
  });

  assert.equal(result.model, "gemini-2.5-flash-image-preview");
  assert.equal(result.attemptCount, 3);
  assert.equal(result.fallbackUsed, true);
  assert.deepEqual(calls, [
    "gemini-3-pro-image-preview",
    "gemini-3-pro-image-preview",
    "gemini-2.5-flash-image-preview"
  ]);
});

test("generateGeminiImage does not retry non-transient provider failures", async () => {
  const rootDir = makeTempDir();
  const outputPath = path.join(rootDir, "cover.png");
  let callCount = 0;

  await assert.rejects(
    () =>
      generateGeminiImage({
        apiKey: "test-key",
        prompt: "storm city at night",
        outputPath,
        retryBaseDelayMs: 1,
        maxAttemptsPerModel: 3,
        clientFactory: () => ({
          interactions: {
            create: async () => {
              callCount += 1;
              throw new Error("invalid_prompt");
            }
          }
        })
      }),
    /invalid_prompt/
  );

  assert.equal(callCount, 1);
});

test("generateGeminiImage rejects when no api key is available", async () => {
  const rootDir = makeTempDir();
  const outputPath = path.join(rootDir, "cover.png");
  const previousApiKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    await assert.rejects(
      () =>
        generateGeminiImage({
          prompt: "storm city at night",
          outputPath,
          apiKey: ""
        }),
      /missing_gemini_api_key/
    );
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = previousApiKey;
    }
  }
});

test("generateGeminiImage rejects when Gemini returns no image", async () => {
  const rootDir = makeTempDir();
  const outputPath = path.join(rootDir, "cover.png");

  await assert.rejects(
    () =>
      generateGeminiImage({
        apiKey: "test-key",
        prompt: "storm city at night",
        outputPath,
        clientFactory: () => ({
          interactions: {
            create: async () => ({
              outputs: [{ type: "text", text: "only text returned" }]
            })
          }
        })
      }),
    /cover_generation_no_image/
  );
});

test("generateGeminiImage rejects with timeout when Gemini does not respond", async () => {
  const rootDir = makeTempDir();
  const outputPath = path.join(rootDir, "cover.png");

  await assert.rejects(
    () =>
      generateGeminiImage({
        apiKey: "test-key",
        prompt: "storm city at night",
        outputPath,
        timeoutMs: 10,
        retryBaseDelayMs: 1,
        maxAttemptsPerModel: 1,
        clientFactory: () => ({
          interactions: {
            create: async () => new Promise(() => {})
          }
        })
      }),
    /cover_generation_timeout/
  );
});
