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

function toMessage(error) {
  return error instanceof Error ? error.message : "job_create_failed";
}

type JobFormProps = {
  copy: {
    theme: string;
    style: string;
    duration: string;
    durationHint: string;
    videoVisualPrompt: string;
    provider: string;
    publishToYouTube: string;
    randomize: string;
    randomizing: string;
    generate: string;
    generating: string;
  };
};

export default function JobForm({ copy }: JobFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [theme, setTheme] = useState("");
  const [style, setStyle] = useState("");

  async function handleRandomize() {
    try {
      setError(null);
      setIsRandomizing(true);
      const response = await fetch("/api/jobs/randomize", {
        method: "POST"
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || "theme_style_randomize_failed");
      }
      setTheme(String(body?.theme || "").trim());
      setStyle(String(body?.style || "").trim());
    } catch (randomizeError) {
      setError(toMessage(randomizeError));
    } finally {
      setIsRandomizing(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const themeValue = String(formData.get("theme") || "").trim();
    const styleValue = String(formData.get("style") || "").trim();
    const durationRaw = String(formData.get("duration") || "").trim();
    const provider = String(formData.get("provider") || "musicgpt").trim();
    const publishToYouTube = formData.get("publishToYouTube") === "on";
    const videoVisualPrompt = String(formData.get("videoVisualPrompt") || "").trim();

    try {
      const payload = {
        theme: themeValue,
        style: styleValue,
        durationTargetSec: parseDurationToSeconds(durationRaw),
        provider,
        publishToYouTube,
        videoVisualPrompt
      };

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "job_create_failed");
      }

      const body = await response.json();
      const jobId = body?.job?.id;
      if (!jobId) {
        throw new Error("job_id_missing");
      }

      router.push(`/jobs/${jobId}`);
    } catch (submitError) {
      setError(toMessage(submitError));
      setIsSubmitting(false);
    }
  }

  return (
    <form className="card form job-form" onSubmit={handleSubmit}>
      <label>
        {copy.theme}
        <input
          name="theme"
          placeholder="storm city"
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
          required
        />
      </label>

      <label>
        {copy.style}
        <input
          name="style"
          placeholder="cinematic storm ambience"
          value={style}
          onChange={(event) => setStyle(event.target.value)}
          required
        />
      </label>

      <button type="button" className="job-action" onClick={handleRandomize} disabled={isRandomizing || isSubmitting}>
        {isRandomizing ? copy.randomizing : copy.randomize}
      </button>

      <label>
        {copy.duration}
        <input name="duration" placeholder="30m or 1800" required />
        <span className="form-hint">{copy.durationHint}</span>
      </label>

      <label>
        {copy.videoVisualPrompt}
        <textarea
          name="videoVisualPrompt"
          placeholder="storm clouds over neon towers"
          rows={4}
        />
      </label>

      <label>
        {copy.provider}
        <select name="provider" defaultValue="musicgpt">
          <option value="musicgpt">MusicGPT</option>
          <option value="elevenlabs">ElevenLabs</option>
          <option value="mock">Mock</option>
        </select>
      </label>

      <label className="job-form__toggle">
        <input type="checkbox" name="publishToYouTube" />
        <span>{copy.publishToYouTube}</span>
      </label>

      {error ? <p className="job-form__error">{error}</p> : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? copy.generating : copy.generate}
      </button>
    </form>
  );
}
