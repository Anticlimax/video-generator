export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Ambient Video Studio</p>
        <h1>Turn a theme into a video, cover, and publishable asset.</h1>
        <p className="lede">
          Enter a theme, describe the mood, pick a duration, and generate an ambient
          video in one place.
        </p>

        <form className="card form">
          <label>
            Theme
            <input name="theme" placeholder="storm city" />
          </label>
          <label>
            Style
            <input name="style" placeholder="cinematic storm ambience" />
          </label>
          <label>
            Duration
            <input name="duration" placeholder="30m" />
          </label>
          <button type="submit">Generate</button>
        </form>
      </section>
    </main>
  );
}
