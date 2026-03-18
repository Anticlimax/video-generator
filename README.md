# ambient-media-tools

MVP for generating longform ambient music videos from free-text theme/style input using OpenClaw, local media tooling, and a static AI-generated cover image.

## Current Shape

- Main OpenClaw tool: `ambient_video_generate`
- Main user input shape: `theme + style + duration_target_sec`
- Default provider path: `mock/local`
- First real external provider: `ElevenLabs Music API`
- Cover image provider: `nano-banana-pro`
- `infsh` remains optional and is not the default music source

## Main Tool

Use `ambient_video_generate` for normal requests. It runs:

1. free-text theme/style resolution
2. short master generation
3. long audio extension
4. static cover generation
5. static-image video render
5. final MP4 export

The lower-level tools are still available for debugging:

- `ambient_music_build`
- `ambient_cover_generate`
- `ambient_media_render`

User-facing requests should use free text only:

- `theme`: broad subject, scene, or mood
- `style`: musical or visual flavor layered onto the theme

`theme_id` is now an internal canonical field used for routing, duration policy, and fallback behavior. It remains available only for controlled/debug calls.

## Duration Model

- `duration_target_sec`: final output duration
- `master_duration_sec`: short master duration used before looping/extension
- `allow_nonstandard_duration`: debug-only escape hatch for preview or smoke runs

Normal user requests should only set `duration_target_sec`. The plugin will choose `master_duration_sec` from the theme policy automatically.

Current target duration allowlists are defined per theme in `config/themes/*.json`.

Example `sleep-piano` policy:

- `1800s` target -> `120s` master
- `3600s` target -> `180s` master
- `7200s` target -> `180s` master
- longer targets -> `240s` master

## ElevenLabs Setup

Install and link the plugin:

```bash
openclaw plugins install /Users/liyang/project/video-generate --link
```

Enable the plugin and configure ElevenLabs:

```bash
openclaw config set plugins.entries.ambient-media-tools.enabled true
openclaw config set plugins.entries.ambient-media-tools.config.mode elevenlabs
openclaw config set plugins.entries.ambient-media-tools.config.elevenLabsApiKey 'YOUR_ELEVENLABS_API_KEY'
```

## Nano Banana Setup

`ambient_cover_generate` uses the bundled `nano-banana-pro` OpenClaw skill. Configure a Gemini key on the plugin so the cover generator can pass it through explicitly:

```bash
openclaw config set plugins.entries.ambient-media-tools.config.geminiApiKey 'YOUR_GEMINI_API_KEY'
```

If cover generation fails, `ambient_video_generate` falls back to the procedural video template path.

## Example Calls

Standard one-shot generation with free-text theme/style:

```json
{
  "theme": "ocean",
  "style": "calm piano, soft moonlight, low stimulation",
  "duration_target_sec": 3600,
  "mode": "elevenlabs",
  "output_name": "ocean-piano-1h"
}
```

Short mock smoke run with explicit master override:

```json
{
  "theme": "sleep",
  "style": "warm ambient piano",
  "duration_target_sec": 8,
  "master_duration_sec": 2,
  "allow_nonstandard_duration": true,
  "mode": "mock",
  "output_name": "sleep-smoke"
}
```

Real provider smoke should use at least `30s` for ElevenLabs music generation. Shorter durations such as `8s` are only appropriate for mock/local verification.

```json
{
  "theme": "ocean",
  "style": "calm piano, soft moonlight, low stimulation",
  "duration_target_sec": 30,
  "master_duration_sec": 30,
  "allow_nonstandard_duration": true,
  "mode": "elevenlabs",
  "output_name": "ocean-real-smoke-30s"
}
```

Direct cover generation for debugging:

```json
{
  "theme": "night ocean",
  "style": "calm piano, deep blue, cinematic ambient background",
  "output_name": "ocean-cover"
}
```

## Outputs

Generated assets are written to:

- `jobs/<job_id>/master_audio.wav`
- `jobs/<job_id>/cover_image.png`
- `jobs/<job_id>/extended_audio.wav`
- `jobs/<job_id>/loop_video.mp4`
- `outputs/<output_name>.mp4`
