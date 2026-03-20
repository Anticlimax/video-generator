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

export default function JobForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generateSeparateCover, setGenerateSeparateCover] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const theme = String(formData.get("theme") || "").trim();
    const style = String(formData.get("style") || "").trim();
    const durationRaw = String(formData.get("duration") || "").trim();
    const provider = String(formData.get("provider") || "musicgpt").trim();
    const publishToYouTube = formData.get("publishToYouTube") === "on";
    const videoVisualPrompt = String(formData.get("videoVisualPrompt") || "").trim();
    const generateSeparateCoverValue = formData.get("generateSeparateCover") === "on";
    const coverPrompt = String(formData.get("coverPrompt") || "").trim();

    try {
      const payload = {
        theme,
        style,
        durationTargetSec: parseDurationToSeconds(durationRaw),
        provider,
        publishToYouTube,
        videoVisualPrompt,
        generateSeparateCover: generateSeparateCoverValue,
        coverPrompt
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
        视频画面描述
        <textarea
          name="videoVisualPrompt"
          placeholder="storm clouds over neon towers"
          rows={4}
        />
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

      <label className="job-form__toggle">
        <input
          type="checkbox"
          name="generateSeparateCover"
          checked={generateSeparateCover}
          onChange={(event) => setGenerateSeparateCover(event.target.checked)}
        />
        <span>单独生成封面图</span>
      </label>

      {generateSeparateCover ? (
        <label>
          封面图描述
          <textarea
            name="coverPrompt"
            placeholder="cinematic thunderstorm poster art"
            rows={4}
          />
        </label>
      ) : null}

      {error ? <p className="job-form__error">{error}</p> : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Generating..." : "Generate"}
      </button>
    </form>
  );
}
