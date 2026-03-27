"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SchedulesListProps = {
  copy: {
    empty: string;
    enabled: string;
    disabled: string;
    next: string;
    last: string;
    never: string;
    lastJob: string;
    edit: string;
    toggle: string;
    runNow: string;
    delete: string;
    daily: string;
    weekly: string;
  };
  schedules: Array<{
    id: string;
    enabled: boolean;
    kind: string;
    time: string;
    weekday?: number | null;
    cronExpression: string;
    nextRunAt: string;
    lastRunAt?: string | null;
    lastJobId?: string | null;
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
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export default function SchedulesList({ schedules, copy }: SchedulesListProps) {
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

  async function deleteSchedule(id: string) {
    try {
      setBusyId(id);
      await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (!schedules.length) {
    return (
      <section className="card job-panel">
        <p className="lede">{copy.empty}</p>
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
                {(schedule.kind === "weekly" ? copy.weekly : copy.daily)} · {schedule.time} · cron {schedule.cronExpression}
              </span>
            </div>
            <div className="job-table__meta">
              <span className={`job-badge job-badge--${schedule.enabled ? "completed" : "queued"}`}>
                {schedule.enabled ? copy.enabled : copy.disabled}
              </span>
              <span>{copy.next}: {formatTimestamp(schedule.nextRunAt) || copy.never}</span>
              <span>{copy.last}: {formatTimestamp(schedule.lastRunAt) || copy.never}</span>
              {schedule.lastJobId ? <a className="job-action" href={`/jobs/${schedule.lastJobId}`}>{copy.lastJob}</a> : null}
              <a className="job-action" href={`/schedules/${schedule.id}`}>{copy.edit}</a>
              <button type="button" className="job-action" onClick={() => toggleSchedule(schedule.id)} disabled={busyId === schedule.id}>
                {copy.toggle}
              </button>
              <button type="button" className="job-action" onClick={() => runNow(schedule.id)} disabled={busyId === schedule.id}>
                {copy.runNow}
              </button>
              <button type="button" className="job-action" onClick={() => deleteSchedule(schedule.id)} disabled={busyId === schedule.id}>
                {copy.delete}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
