export function buildMusicPrompt({ themeId, promptSeed }) {
  return [
    "Create ambient instrumental music.",
    "Low dynamics.",
    "Avoid percussion.",
    "Loop-safe ending and beginning.",
    `Theme: ${themeId}.`,
    `Seed: ${promptSeed}.`
  ].join(" ");
}
