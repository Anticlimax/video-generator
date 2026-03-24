function stripCodeFence(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function buildRandomThemeStylePrompt() {
  return [
    "Generate one creative theme and one matching style for a long-form ambient video.",
    "The result must fit relaxation, focus, meditation, sleep, rainy night, forest, ocean, or night-sky style content.",
    "Avoid dialogue, characters, plot, jump-scares, meme concepts, and anything unsuitable for low-stimulation long-form playback.",
    'Return strict JSON only in this shape: {"theme":"...","style":"..."}',
    "Keep both values concise and evocative."
  ].join(" ");
}

export function extractRandomThemeStyle(text) {
  const parsed = JSON.parse(stripCodeFence(text));
  const theme = String(parsed?.theme || "").trim();
  const style = String(parsed?.style || "").trim();

  if (!theme) {
    throw new Error("random_theme_missing");
  }
  if (!style) {
    throw new Error("random_style_missing");
  }

  return { theme, style };
}

function extractTextFromGeminiResponse(payload = {}) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const parts = candidates.flatMap((candidate) =>
    Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []
  );
  const text = parts
    .map((part) => String(part?.text || "").trim())
    .filter(Boolean)
    .join("\n");

  if (!text) {
    throw new Error("gemini_randomize_empty");
  }

  return text;
}

export async function generateRandomThemeStyle({
  apiKey,
  fetchImpl = fetch
} = {}) {
  if (!String(apiKey || "").trim()) {
    throw new Error("gemini_api_key_missing");
  }

  const response = await fetchImpl(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": String(apiKey).trim()
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildRandomThemeStylePrompt()
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 1.1
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error("gemini_randomize_failed");
  }

  const payload = await response.json();
  return extractRandomThemeStyle(extractTextFromGeminiResponse(payload));
}
