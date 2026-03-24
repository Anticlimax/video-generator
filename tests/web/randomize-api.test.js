import test from "node:test";
import assert from "node:assert/strict";

import { createRandomizeThemeStyleApiHandlers } from "../../src/core/jobs/randomize-api.js";

test("randomize api returns a generated theme/style pair", async () => {
  const api = createRandomizeThemeStyleApiHandlers({
    runtimeConfig: {
      geminiApiKey: "gem-key"
    },
    generateRandomThemeStyleImpl: async ({ apiKey }) => ({
      theme: `theme-from-${apiKey}`,
      style: "style-from-gemini"
    })
  });

  const response = await api.post(new Request("http://localhost/api/jobs/randomize", { method: "POST" }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.theme, "theme-from-gem-key");
  assert.equal(payload.style, "style-from-gemini");
});

test("randomize api returns 503 when the gemini key is missing", async () => {
  const api = createRandomizeThemeStyleApiHandlers({
    runtimeConfig: {},
    generateRandomThemeStyleImpl: async () => {
      throw new Error("gemini_api_key_missing");
    }
  });

  const response = await api.post(new Request("http://localhost/api/jobs/randomize", { method: "POST" }));
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.error, "gemini_api_key_missing");
});
