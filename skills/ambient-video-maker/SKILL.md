---
name: ambient-video-maker
description: Trigger ambient_music_build + ambient_media_render to deliver long-form ambient music videos from a theme.
---

## Prompts / Intent Signals

- “睡眠视频” / “睡前” / “助眠”
- “钢琴” / “calm piano”
- “焦点” / “专注”
- “loop-safe” / “低变化” / “ambient music”

The skill maps aliases and keywords defined in each theme config (`sleep-piano`, `rainy-night-piano`, etc.) and asks a clarification question whenever confidence is low.

## Workflow

1. Parse theme/style/duration from user text and resolve a `theme_id` by matching text against configured aliases and keywords (fall back to a default theme and surface choices if unresolved).
2. Call `ambient_music_build` with `[theme_id, style_override, duration, mode, timeout_sec, max_retries]`.
3. On success, call `ambient_media_render` with the master audio path plus `video_template_id`, `mix_profile`, `crossfade_duration_sec`, and `target_lufs`.
4. Return final output path, manifest path, and log of the detected theme/version.

*Clarification example* — “Understood your request for 睡眠钢琴, do you want the usual 1h duration or a longer stretch?”
