"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "../src/i18n";
import LanguageSwitcher from "./language-switcher";

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type AppNavProps = {
  locale: Locale;
  labels: {
    brand: string;
    create: string;
    jobs: string;
    schedules: string;
    integrations: string;
    languageZh: string;
    languageEn: string;
  };
};

export default function AppNav({ locale, labels }: AppNavProps) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: labels.create },
    { href: "/jobs", label: labels.jobs },
    { href: "/schedules", label: labels.schedules },
    { href: "/integrations", label: labels.integrations }
  ];

  return (
    <header className="app-nav">
      <nav className="app-nav__inner" aria-label="Primary">
        <Link href="/" className="app-nav__brand">
          {labels.brand}
        </Link>

        <div className="app-nav__controls">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`app-nav__link ${isActive(pathname, link.href) ? "app-nav__link--active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
          <LanguageSwitcher locale={locale} labels={{ zh: labels.languageZh, en: labels.languageEn }} />
        </div>
      </nav>
    </header>
  );
}
