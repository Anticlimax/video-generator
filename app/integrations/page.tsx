import { cookies } from "next/headers";
import { defaultLocale, getDictionary, localeCookieName, normalizeLocale } from "../../src/i18n";

function envStatus(value?: string) {
  return String(value || "").trim();
}

export default async function IntegrationsPage() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value || defaultLocale);
  const dictionary = getDictionary(locale);
  const integrations = [
    {
      label: "Gemini image generation",
      envKey: "GEMINI_API_KEY",
      configured: envStatus(process.env.GEMINI_API_KEY)
    },
    {
      label: "MusicGPT audio generation",
      envKey: "MUSICGPT_API_KEY",
      configured: envStatus(process.env.MUSICGPT_API_KEY)
    },
    {
      label: "Runway motion video",
      envKey: "RUNWAY_API_KEY",
      configured: envStatus(process.env.RUNWAY_API_KEY)
    },
    {
      label: "YouTube OAuth client id",
      envKey: "YOUTUBE_CLIENT_ID",
      configured: envStatus(process.env.YOUTUBE_CLIENT_ID)
    },
    {
      label: "YouTube OAuth client secret",
      envKey: "YOUTUBE_CLIENT_SECRET",
      configured: envStatus(process.env.YOUTUBE_CLIENT_SECRET)
    },
    {
      label: "YouTube refresh token",
      envKey: "YOUTUBE_REFRESH_TOKEN",
      configured: envStatus(process.env.YOUTUBE_REFRESH_TOKEN)
    }
  ];

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">{dictionary.integrations.eyebrow}</p>
        <h1>{dictionary.integrations.title}</h1>
        <p className="lede">{dictionary.integrations.lede}</p>

        <section className="card integrations-card">
          <div className="integrations-grid">
            {integrations.map((integration) => (
              <article key={integration.envKey} className="integration-row">
                <div>
                  <h2>{integration.label}</h2>
                  <p>{integration.envKey}</p>
                </div>
                <span
                  className={`job-badge ${
                    integration.configured ? "job-badge--completed" : "job-badge--failed"
                  }`}
                >
                  {integration.configured ? dictionary.integrations.configured : dictionary.integrations.missing}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>{dictionary.integrations.youtubeOauth}</h2>
          <p className="lede">{dictionary.integrations.youtubeGuideLede}</p>
          <p>
            <a href="/Users/liyang/project/video-generate/docs/setup/youtube-oauth.md">
              {dictionary.integrations.youtubeGuide}
            </a>
          </p>
        </section>
      </section>
    </main>
  );
}
