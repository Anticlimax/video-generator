import { cookies } from "next/headers";
import JobForm from "../components/job-form";
import { defaultLocale, getDictionary, localeCookieName, normalizeLocale } from "../src/i18n";

export default async function HomePage() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value || defaultLocale);
  const dictionary = getDictionary(locale);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">{dictionary.home.eyebrow}</p>
        <h1>{dictionary.home.title}</h1>
        <p className="lede">{dictionary.home.lede}</p>

        <JobForm
          copy={{
            theme: dictionary.home.theme,
            style: dictionary.home.style,
            duration: dictionary.home.duration,
            durationHint: dictionary.home.durationHint,
            videoVisualPrompt: dictionary.home.videoVisualPrompt,
            provider: dictionary.home.provider,
            publishToYouTube: dictionary.home.publishToYouTube,
            randomize: dictionary.home.randomize,
            randomizing: dictionary.home.randomizing,
            generate: dictionary.home.generate,
            generating: dictionary.home.generating
          }}
        />
      </section>
    </main>
  );
}
