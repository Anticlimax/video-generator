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

## Telegram Entry

Recommended first-pass Telegram commands:

- `/ambient`: generate only
- `/ambient_publish`: generate and upload to YouTube

Preferred command format:

```text
/ambient <theme> | <style> | <duration>
/ambient_publish <theme> | <style> | <duration>
```

Examples:

```text
/ambient ocean | calm piano, soft moonlight | 30m
/ambient_publish rainy night | soft piano | 1h
```

Telegram handlers should normalize these fields before calling the plugin:

- `theme` -> free-text theme input
- `style` -> free-text style input
- `duration` -> parsed to `duration_target_sec`
- action -> `ambient_video_generate` or `ambient_video_publish`

Natural language can be supported as a compatibility path, but not as the primary entry.

Recommended natural-language policy:

- Prefer slash-command parsing first
- If the message is not a command, try to extract `theme`, `style`, and `duration`
- Execute only when all three fields are confidently resolved
- If any field is missing or ambiguous, send a confirmation prompt before starting

Suggested confirmation message:

```text
我理解为：
theme: ocean
style: calm piano, soft moonlight
duration: 30m
action: 生成并上传

回复“确认”后开始。
```

Recommended Telegram progress UX:

- Keep a single message and edit it through the job lifecycle
- Read `jobs/<job_id>/progress.json`
- Map `stage`, `status`, `progress`, and final artifacts into human-readable updates

Suggested progress message shape:

```text
任务：ocean | calm piano, soft moonlight | 30m
状态：正在生成音乐
进度：2/4
```

Suggested completion message shape:

```text
任务完成
本地文件：outputs/example.mp4
YouTube：https://www.youtube.com/watch?v=...
```

Reusable helper module for TG host integration:

- [telegram-adapter.js](/Users/liyang/project/video-generate/src/lib/telegram-adapter.js)

It provides:

- slash-command parsing for `/ambient` and `/ambient_publish`
- natural-language compatibility parsing with confirmation-required output
- confirmation message rendering
- progress message rendering from `progress.json`

## Outputs

Generated assets are written to:

- `jobs/<job_id>/master_audio.wav`
- `jobs/<job_id>/cover_image.png`
- `jobs/<job_id>/extended_audio.wav`
- `jobs/<job_id>/loop_video.mp4`
- `outputs/<output_name>.mp4`

## Portable Setup

For a new machine, use:

- [bootstrap-local.sh](/Users/liyang/project/video-generate/scripts/bootstrap-local.sh)
- [verify-portable-setup.sh](/Users/liyang/project/video-generate/scripts/verify-portable-setup.sh)
- [portable-deployment.md](/Users/liyang/project/video-generate/docs/setup/portable-deployment.md)
