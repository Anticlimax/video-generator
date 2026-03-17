---
name: ambient-video-maker
description: Trigger ambient_video_generate by default, with ambient_music_build + ambient_media_render as a fallback path for debugging and recovery.
---

## Prompts / Intent Signals

- “睡眠视频” / “睡前” / “助眠”
- “钢琴” / “calm piano”
- “焦点” / “专注”
- “loop-safe” / “低变化” / “ambient music”

The skill maps aliases and keywords defined in each theme config (`sleep-piano`, `rainy-night-piano`, etc.) and asks a clarification question whenever confidence is low.

## Workflow

1. Parse theme/style/duration from user text and resolve a `theme_id` by matching text against configured aliases and keywords (fall back to a default theme and surface choices if unresolved).
2. Call `ambient_video_generate` as the default path with `[theme_id, duration_target_sec, mode, output_name]`.
3. Return the final output path, theme/version, master duration, and render summary from the one-shot tool.
4. If the one-shot path fails, fall back to `ambient_music_build` and `ambient_media_render` so the operator can isolate whether the problem is in music generation or media rendering.

## Duration Notes

- `duration_target_sec` is the final output duration.
- `master_duration_sec` is chosen automatically from the theme policy unless explicitly overridden for debugging.
- `allow_nonstandard_duration` should only be used for preview or smoke runs, not normal user requests.

*Clarification example* — “Understood your request for 睡眠钢琴, do you want the usual 1h duration or a longer stretch?”
