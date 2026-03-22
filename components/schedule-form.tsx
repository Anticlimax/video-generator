"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

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

export default function ScheduleForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kind, setKind] = useState("daily");

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

      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "schedule_create_failed");
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
        Schedule type
        <select name="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </label>

      <label>
        Time
        <input name="time" type="time" required />
      </label>

      {kind === "weekly" ? (
        <label>
          Weekday
          <select name="weekday" defaultValue="1">
            <option value="0">Sunday</option>
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
            <option value="6">Saturday</option>
          </select>
        </label>
      ) : null}

      <label>
        Theme
        <input name="theme" placeholder="storm city" required />
      </label>

      <label>
        Style
        <input name="style" placeholder="cinematic storm ambience" required />
      </label>

      <label>
        Duration
        <input name="duration" placeholder="30m" required />
      </label>

      <label>
        Provider
        <select name="provider" defaultValue="musicgpt">
          <option value="musicgpt">MusicGPT</option>
          <option value="elevenlabs">ElevenLabs</option>
          <option value="mock">Mock</option>
        </select>
      </label>

      <label className="job-form__toggle">
        <input type="checkbox" name="publishToYouTube" />
        <span>Publish to YouTube after generation</span>
      </label>

      {error ? <p className="job-form__error">{error}</p> : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create schedule"}
      </button>
    </form>
  );
}
