import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import AppNav from "../components/app-nav";
import { defaultLocale, getDictionary, localeCookieName, normalizeLocale } from "../src/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ambient Video Studio",
  description: "Generate ambient videos from a theme, style, and duration."
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value || defaultLocale);
  const dictionary = getDictionary(locale);

  return (
    <html lang={locale}>
      <body>
        <AppNav
          locale={locale}
          labels={{
            brand: dictionary.nav.brand,
            create: dictionary.nav.create,
            jobs: dictionary.nav.jobs,
            schedules: dictionary.nav.schedules,
            integrations: dictionary.nav.integrations,
            languageZh: dictionary.language.zh,
            languageEn: dictionary.language.en
          }}
        />
        {children}
      </body>
    </html>
  );
}
