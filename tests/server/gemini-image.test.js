import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { generateGeminiImage } from "../../src/core/media/gemini-image.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ambient-gemini-image-"));
}

test("generateGeminiImage writes image bytes and reports gemini-image provider", async () => {
  const rootDir = makeTempDir();
  const outputPath = path.join(rootDir, "cover.png");
  const expectedBytes = Buffer.from("fake png bytes");

  const result = await generateGeminiImage({
    apiKey: "test-key",
    prompt: "storm city at night",
    outputPath,
    clientFactory: () => ({
      models: {
        generateContent: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { text: "ignored" },
                  { inlineData: { data: expectedBytes } }
                ]
              }
            }
          ]
        })
      }
    })
  });

  assert.equal(result.provider, "gemini-image");
  assert.equal(result.imagePath, outputPath);
  assert.equal(result.prompt, "storm city at night");
  assert.equal(fs.existsSync(outputPath), true);
  assert.deepEqual(fs.readFileSync(outputPath), expectedBytes);
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
          models: {
            generateContent: async () => ({
              candidates: [
                {
                  content: {
                    parts: [{ text: "only text returned" }]
                  }
                }
              ]
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
        clientFactory: () => ({
          models: {
            generateContent: async () => new Promise(() => {})
          }
        })
      }),
    /cover_generation_timeout/
  );
});
