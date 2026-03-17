import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const THEMES_DIR = path.join(ROOT_DIR, "config", "themes");

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

export async function loadThemeRegistry() {
  const entries = await fs.readdir(THEMES_DIR, { withFileTypes: true });
  const registry = new Map();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const filePath = path.join(THEMES_DIR, entry.name);
    const theme = JSON.parse(await fs.readFile(filePath, "utf8"));
    registry.set(theme.id, theme);
  }

  return registry;
}

export function resolveTheme(registry, input) {
  const themeText = normalizeText(input?.theme);
  const styleText = normalizeText(input?.style);
  const combined = `${themeText} ${styleText}`.trim();

  let bestTheme = null;
  let bestScore = -1;

  for (const theme of registry.values()) {
    const aliases = Array.isArray(theme.aliases) ? theme.aliases : [];
    const keywords = Array.isArray(theme.keywords) ? theme.keywords : [];

    const hasAliasMatch = aliases.some((alias) =>
      combined.includes(normalizeText(alias))
    );
    if (hasAliasMatch) {
      return theme;
    }

    let score = 0;
    for (const keyword of keywords) {
      if (combined.includes(normalizeText(keyword))) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestTheme = theme;
      bestScore = score;
    }
  }

  if (bestTheme && bestScore > 0) {
    return bestTheme;
  }

  throw new Error("theme_not_found");
}
