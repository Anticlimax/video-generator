"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SchedulesListProps = {
  schedules: Array<{
    id: string;
    enabled: boolean;
    kind: string;
    time: string;
    weekday?: number | null;
    cronExpression: string;
    nextRunAt: string;
    lastRunAt?: string | null;
    payload: {
      theme: string;
      style: string;
      durationTargetSec: number;
      provider: string;
    };
  }>;
};

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "never";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export default function SchedulesList({ schedules }: SchedulesListProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleSchedule(id: string) {
    try {
      setBusyId(id);
      await fetch(`/api/schedules/${id}`, { method: "POST" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function runNow(id: string) {
    try {
      setBusyId(id);
      await fetch(`/api/schedules/${id}/run-now`, { method: "POST" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (!schedules.length) {
    return (
      <section className="card job-panel">
        <p className="lede">No schedules yet. Create the first recurring generation above.</p>
      </section>
    );
  }

  return (
    <section className="card job-panel">
      <div className="job-table">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="job-table__row">
            <div className="job-table__main">
              <strong>{schedule.payload.theme}</strong>
              <span>
                {schedule.payload.style} · {Math.round(schedule.payload.durationTargetSec)}s · {schedule.payload.provider}
              </span>
              <span>
                {schedule.kind} · {schedule.time} · cron {schedule.cronExpression}
              </span>
            </div>
            <div className="job-table__meta">
              <span className={`job-badge job-badge--${schedule.enabled ? "completed" : "queued"}`}>
                {schedule.enabled ? "enabled" : "disabled"}
              </span>
              <span>Next: {formatTimestamp(schedule.nextRunAt)}</span>
              <span>Last: {formatTimestamp(schedule.lastRunAt)}</span>
              <button type="button" className="job-action" onClick={() => toggleSchedule(schedule.id)} disabled={busyId === schedule.id}>
                toggle
              </button>
              <button type="button" className="job-action" onClick={() => runNow(schedule.id)} disabled={busyId === schedule.id}>
                run-now
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
