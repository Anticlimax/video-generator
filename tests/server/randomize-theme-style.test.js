import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRandomThemeStylePrompt,
  extractRandomThemeStyle,
  generateRandomThemeStyle
} from "../../src/core/jobs/randomize-theme-style.js";

test("buildRandomThemeStylePrompt asks for ambient-safe JSON output", () => {
  const prompt = buildRandomThemeStylePrompt();

  assert.match(prompt, /JSON/i);
  assert.match(prompt, /theme/i);
  assert.match(prompt, /style/i);
  assert.match(prompt, /ambient/i);
  assert.match(prompt, /long-form/i);
});

test("extractRandomThemeStyle parses plain JSON text", () => {
  const result = extractRandomThemeStyle('{"theme":"mystic forest","style":"soft foggy piano ambience"}');

  assert.equal(result.theme, "mystic forest");
  assert.equal(result.style, "soft foggy piano ambience");
});

test("extractRandomThemeStyle parses fenced JSON text", () => {
  const result = extractRandomThemeStyle('```json\n{"theme":"ocean dusk","style":"calm moonlit synth drift"}\n```');

  assert.equal(result.theme, "ocean dusk");
  assert.equal(result.style, "calm moonlit synth drift");
});

test("generateRandomThemeStyle calls Gemini REST and returns parsed theme/style", async () => {
  const requests = [];
  const result = await generateRandomThemeStyle({
    apiKey: "gem-key",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        async json() {
          return {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: '{"theme":"rainy neon alleys","style":"moody late-night city jazz ambience"}'
                    }
                  ]
                }
              }
            ]
          };
        }
      };
    }
  });

  assert.equal(result.theme, "rainy neon alleys");
  assert.equal(result.style, "moody late-night city jazz ambience");
  assert.equal(requests.length, 1);
  assert.match(String(requests[0].url), /gemini-3-flash-preview:generateContent/);
  assert.equal(requests[0].options.method, "POST");
  assert.match(String(requests[0].options.headers["x-goog-api-key"]), /gem-key/);
});

test("generateRandomThemeStyle rejects when the api key is missing", async () => {
  await assert.rejects(
    () => generateRandomThemeStyle({ apiKey: "" }),
    /gemini_api_key_missing/
  );
});
