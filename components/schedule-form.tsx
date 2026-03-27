"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type ScheduleFormProps = {
  mode?: "create" | "edit";
  copy: {
    type: string;
    daily: string;
    weekly: string;
    time: string;
    weekday: string;
    weekdays: [string, string, string, string, string, string, string];
    theme: string;
    style: string;
    duration: string;
    durationHint: string;
    provider: string;
    publishToYouTube: string;
    save: string;
    saving: string;
    create: string;
    creating: string;
  };
  scheduleId?: string;
  initialValues?: {
    kind?: string;
    time?: string;
    weekday?: number | null;
    theme?: string;
    style?: string;
    duration?: string;
    provider?: string;
    publishToYouTube?: boolean;
  };
};

function parseDurationToSeconds(rawValue: string) {
  const value = rawValue.trim().toLowerCase();
  if (!value) {
    throw new Error("missing_duration");
  }

  if (value.endsWith("h")) {
    const hours = Number(value.slice(0, -1));
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new Error("invalid_duration");
    }
    return Math.round(hours * 3600);
  }

  if (value.endsWith("m")) {
    const minutes = Number(value.slice(0, -1));
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new Error("invalid_duration");
    }
    return Math.round(minutes * 60);
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("invalid_duration");
  }

  return Math.round(numeric);
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "schedule_create_failed";
}

export default function ScheduleForm({
  mode = "create",
  copy,
  scheduleId,
  initialValues
}: ScheduleFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kind, setKind] = useState(initialValues?.kind || "daily");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const payload = {
        kind: String(formData.get("kind") || "daily"),
        time: String(formData.get("time") || "").trim(),
        weekday: kind === "weekly" ? Number(formData.get("weekday") || 0) : undefined,
        timezone: "UTC",
        payload: {
          theme: String(formData.get("theme") || "").trim(),
          style: String(formData.get("style") || "").trim(),
          durationTargetSec: parseDurationToSeconds(String(formData.get("duration") || "").trim()),
          provider: String(formData.get("provider") || "musicgpt").trim(),
          publishToYouTube: formData.get("publishToYouTube") === "on"
        }
      };

      const endpoint = mode === "edit" && scheduleId ? `/api/schedules/${scheduleId}` : "/api/schedules";
      const response = await fetch(endpoint, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || (mode === "edit" ? "schedule_update_failed" : "schedule_create_failed"));
      }

      router.push("/schedules");
    } catch (submitError) {
      setError(toMessage(submitError));
      setIsSubmitting(false);
    }
  }

  return (
    <form className="card form schedule-form" onSubmit={handleSubmit}>
      <label>
        {copy.type}
        <select name="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="daily">{copy.daily}</option>
          <option value="weekly">{copy.weekly}</option>
        </select>
      </label>

      <label>
        {copy.time}
        <input name="time" type="time" defaultValue={initialValues?.time || ""} required />
      </label>

      {kind === "weekly" ? (
        <label>
          {copy.weekday}
          <select name="weekday" defaultValue={String(initialValues?.weekday ?? 1)}>
            <option value="0">{copy.weekdays[0]}</option>
            <option value="1">{copy.weekdays[1]}</option>
            <option value="2">{copy.weekdays[2]}</option>
            <option value="3">{copy.weekdays[3]}</option>
            <option value="4">{copy.weekdays[4]}</option>
            <option value="5">{copy.weekdays[5]}</option>
            <option value="6">{copy.weekdays[6]}</option>
          </select>
        </label>
      ) : null}

      <label>
        {copy.theme}
        <input name="theme" placeholder="storm city" defaultValue={initialValues?.theme || ""} required />
      </label>

      <label>
        {copy.style}
        <input name="style" placeholder="cinematic storm ambience" defaultValue={initialValues?.style || ""} required />
      </label>

      <label>
        {copy.duration}
        <input name="duration" placeholder="30m or 1800" defaultValue={initialValues?.duration || ""} required />
        <span className="form-hint">{copy.durationHint}</span>
      </label>

      <label>
        {copy.provider}
        <select name="provider" defaultValue={initialValues?.provider || "musicgpt"}>
          <option value="musicgpt">MusicGPT</option>
          <option value="elevenlabs">ElevenLabs</option>
          <option value="mock">Mock</option>
        </select>
      </label>

      <label className="job-form__toggle">
        <input type="checkbox" name="publishToYouTube" defaultChecked={initialValues?.publishToYouTube || false} />
        <span>{copy.publishToYouTube}</span>
      </label>

      {error ? <p className="job-form__error">{error}</p> : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (mode === "edit" ? copy.saving : copy.creating) : mode === "edit" ? copy.save : copy.create}
      </button>
    </form>
  );
}
