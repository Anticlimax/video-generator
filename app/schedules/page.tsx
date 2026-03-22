import ScheduleForm from "../../components/schedule-form";

export default function SchedulesPage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Schedules</p>
        <h1>Create daily or weekly generation schedules.</h1>
        <p className="lede">
          Configure a simple recurring run, then let the app normalize it into cron-backed execution.
        </p>

        <ScheduleForm />
      </section>
    </main>
  );
}
