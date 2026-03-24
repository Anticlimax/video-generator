function envStatus(value?: string) {
  return String(value || "").trim() ? "Configured" : "Missing";
}

const integrations = [
  {
    label: "Gemini image generation",
    envKey: "GEMINI_API_KEY",
    status: envStatus(process.env.GEMINI_API_KEY)
  },
  {
    label: "MusicGPT audio generation",
    envKey: "MUSICGPT_API_KEY",
    status: envStatus(process.env.MUSICGPT_API_KEY)
  },
  {
    label: "Runway motion video",
    envKey: "RUNWAY_API_KEY",
    status: envStatus(process.env.RUNWAY_API_KEY)
  },
  {
    label: "YouTube OAuth client id",
    envKey: "YOUTUBE_CLIENT_ID",
    status: envStatus(process.env.YOUTUBE_CLIENT_ID)
  },
  {
    label: "YouTube OAuth client secret",
    envKey: "YOUTUBE_CLIENT_SECRET",
    status: envStatus(process.env.YOUTUBE_CLIENT_SECRET)
  },
  {
    label: "YouTube refresh token",
    envKey: "YOUTUBE_REFRESH_TOKEN",
    status: envStatus(process.env.YOUTUBE_REFRESH_TOKEN)
  }
];

export default function IntegrationsPage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Integrations</p>
        <h1>Check which runtime providers are configured.</h1>
        <p className="lede">
          This page is read-only. Configure values through environment variables, then restart the
          app.
        </p>

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
                    integration.status === "Configured" ? "job-badge--completed" : "job-badge--failed"
                  }`}
                >
                  {integration.status}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>YouTube OAuth</h2>
          <p className="lede">
            Use the setup guide to obtain a refresh token and map it into environment variables for
            VPS or Google Cloud deployment.
          </p>
          <p>
            <a href="/Users/liyang/project/video-generate/docs/setup/youtube-oauth.md">
              Open YouTube OAuth setup guide
            </a>
          </p>
        </section>
      </section>
    </main>
  );
}
