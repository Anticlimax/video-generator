# ambient-media-tools

MVP for generating longform ambient music videos from a theme using OpenClaw, local media tooling, and procedural video templates.

## Current Shape

- Main OpenClaw tool: `ambient_video_generate`
- Default provider path: `mock/local`
- First real external provider: `ElevenLabs Music API`
- `infsh` remains optional and is not the default music source

## Main Tool

Use `ambient_video_generate` for normal requests. It runs:

1. theme resolution
2. short master generation
3. long audio extension
4. procedural video render
5. final MP4 export

The lower-level tools are still available for debugging:

- `ambient_music_build`
- `ambient_media_render`

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

## Example Calls

Standard one-shot generation:

```json
{
  "theme_id": "sleep-piano",
  "duration_target_sec": 3600,
  "mode": "elevenlabs",
  "output_name": "sleep-piano-1h"
}
```

Short smoke run with explicit master override:

```json
{
  "theme_id": "sleep-piano",
  "duration_target_sec": 8,
  "master_duration_sec": 2,
  "allow_nonstandard_duration": true,
  "mode": "mock",
  "output_name": "sleep-smoke"
}
```

## Outputs

Generated assets are written to:

- `jobs/<job_id>/master_audio.wav`
- `jobs/<job_id>/extended_audio.wav`
- `jobs/<job_id>/loop_video.mp4`
- `outputs/<output_name>.mp4`
