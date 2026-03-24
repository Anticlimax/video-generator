import { generateRandomThemeStyle } from "./randomize-theme-style.js";

function jsonError(error, status) {
  return Response.json({ error }, { status });
}

export function createRandomizeThemeStyleApiHandlers({
  runtimeConfig = {},
  generateRandomThemeStyleImpl = generateRandomThemeStyle
} = {}) {
  return {
    async post() {
      try {
        const result = await generateRandomThemeStyleImpl({
          apiKey: runtimeConfig.geminiApiKey
        });
        return Response.json(result, { status: 200 });
      } catch (error) {
        const code = String(error?.message || "theme_style_randomize_failed");
        const status = code === "gemini_api_key_missing" ? 503 : 500;
        return jsonError(code, status);
      }
    }
  };
}
