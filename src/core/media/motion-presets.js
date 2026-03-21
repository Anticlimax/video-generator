function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function buildInputCorpus({ theme = "", style = "", videoVisualPrompt = "" } = {}) {
  return [theme, style, videoVisualPrompt].map(normalizeText).filter(Boolean).join(" ");
}

function hasAnyKeyword(input, keywords) {
  return keywords.some((keyword) => input.includes(keyword));
}

const PRESET_KEYWORDS = Object.freeze({
  rain: ["rain", "rainy", "storm", "stormy", "thunder", "drizzle", "downpour", "wet street", "raindrop"],
  water: ["ocean", "sea", "wave", "waves", "lake", "river", "shore", "water", "tide"],
  fire: ["fire", "flame", "flames", "campfire", "candle", "lava", "ember", "embers"],
  fog: ["fog", "mist", "misty", "haze", "cloud", "clouds", "cloudy", "smoke"],
  wind: ["wind", "windy", "breeze", "gust", "gusts", "sway", "leaves", "leaf sway", "grass"],
  stars: ["stars", "starry", "night sky", "galaxy", "cosmos", "space", "moonlight sky"],
  neon: ["neon", "cyberpunk", "city lights", "sign glow", "glow sign", "electric sign"]
});

const PRIMARY_PRIORITY = Object.freeze(["rain", "water", "fire", "fog", "wind", "stars", "neon"]);

function resolvePrimaryPreset(matches) {
  for (const preset of PRIMARY_PRIORITY) {
    if (matches.has(preset)) {
      return preset;
    }
  }
  return "none";
}

function resolveSecondaryPreset(primaryPreset, matches) {
  if (primaryPreset === "rain") {
    if (matches.has("neon")) {
      return "neon";
    }
    if (matches.has("wind")) {
      return "wind";
    }
    return null;
  }
  if (primaryPreset === "fog" && matches.has("wind")) {
    return "wind";
  }
  if (primaryPreset === "stars" && matches.has("neon")) {
    return "neon";
  }
  return null;
}

export function resolveMotionPresets({ theme = "", style = "", videoVisualPrompt = "" } = {}) {
  const input = buildInputCorpus({ theme, style, videoVisualPrompt });
  const matches = new Set();

  for (const [preset, keywords] of Object.entries(PRESET_KEYWORDS)) {
    if (hasAnyKeyword(input, keywords)) {
      matches.add(preset);
    }
  }

  const primaryPreset = resolvePrimaryPreset(matches);
  const secondaryPreset = primaryPreset === "none" ? null : resolveSecondaryPreset(primaryPreset, matches);

  return {
    primaryPreset,
    secondaryPreset
  };
}

function buildPrimaryPresetTemplate(primaryPreset) {
  if (primaryPreset === "rain") {
    return "Only animate falling rain and subtle raindrop streaks. Keep buildings, people, vehicles, and reflections stable.";
  }
  if (primaryPreset === "water") {
    return "Only animate gentle water ripples and soft wave movement. Keep shoreline, sky, rocks, and structures still.";
  }
  if (primaryPreset === "fire") {
    return "Only animate soft flame flicker and tiny ember shimmer. Keep surroundings fixed.";
  }
  if (primaryPreset === "fog") {
    return "Only animate faint drifting fog or mist. Keep trees, ground, and structures stable.";
  }
  if (primaryPreset === "wind") {
    return "Only animate very subtle leaf sway or grass movement. Keep the scene structure still.";
  }
  if (primaryPreset === "stars") {
    return "Only animate tiny star shimmer or faint atmospheric sparkle. Keep sky composition and horizon unchanged.";
  }
  if (primaryPreset === "neon") {
    return "Only animate subtle neon shimmer or weak reflected light flicker. Keep all objects and framing fixed.";
  }
  return "Only animate subtle atmospheric motion. Keep the scene nearly identical frame to frame.";
}

function buildSecondaryPresetTemplate(secondaryPreset) {
  if (secondaryPreset === "neon") {
    return "Allow very subtle neon shimmer and soft reflected light flicker only as a secondary effect.";
  }
  if (secondaryPreset === "wind") {
    return "Allow only very faint secondary wind movement in leaves or loose surface detail.";
  }
  return "";
}

export function buildMotionPresetPrompt({
  theme = "",
  style = "",
  videoVisualPrompt = "",
  primaryPreset = "none",
  secondaryPreset = null
} = {}) {
  const parts = [
    "Keep the camera locked. Preserve the original composition exactly.",
    "No scene transformation. No object deformation. No extra motion beyond the selected atmospheric effects.",
    "Loop-friendly subtle motion only."
  ];

  const promptText = String(videoVisualPrompt || "").trim();
  if (promptText) {
    parts.push(promptText);
  }
  if (String(theme || "").trim()) {
    parts.push(`Theme: ${String(theme).trim()}.`);
  }
  if (String(style || "").trim()) {
    parts.push(`Style: ${String(style).trim()}.`);
  }

  parts.push(buildPrimaryPresetTemplate(primaryPreset));

  const secondary = buildSecondaryPresetTemplate(secondaryPreset);
  if (secondary) {
    parts.push(secondary);
  }

  return parts.join(" ");
}
