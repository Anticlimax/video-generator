import JobForm from "../components/job-form";

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

        <JobForm />
      </section>
    </main>
  );
}
