export function buildMusicPrompt({ themeId, promptSeed, theme, style }) {
  const parts = [
    "Create ambient instrumental music.",
    "Low dynamics.",
    "Avoid percussion.",
    "Loop-safe ending and beginning."
  ];

  if (theme) {
    parts.push(`Theme: ${theme}.`);
  } else if (themeId) {
    parts.push(`Theme family hint: ${themeId}.`);
  }

  if (style) {
    parts.push(`Style: ${style}.`);
  }

  if (promptSeed) {
    parts.push(`Seed: ${promptSeed}.`);
  }

  return parts.join(" ");
}
