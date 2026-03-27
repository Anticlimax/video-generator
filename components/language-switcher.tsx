"use client";

import { useRouter } from "next/navigation";

import { localeCookieName, locales, type Locale } from "../src/i18n";

type LanguageSwitcherProps = {
  locale: Locale;
  labels: {
    zh: string;
    en: string;
  };
};

export default function LanguageSwitcher({ locale, labels }: LanguageSwitcherProps) {
  const router = useRouter();

  function setLocale(nextLocale: Locale) {
    if (nextLocale === locale) {
      return;
    }

    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div className="language-switcher" role="group" aria-label="Language switcher">
      {locales.map((entry) => (
        <button
          key={entry}
          type="button"
          className={`language-switcher__button ${entry === locale ? "language-switcher__button--active" : ""}`}
          onClick={() => setLocale(entry)}
          aria-pressed={entry === locale}
        >
          {entry === "zh-CN" ? labels.zh : labels.en}
        </button>
      ))}
    </div>
  );
}
