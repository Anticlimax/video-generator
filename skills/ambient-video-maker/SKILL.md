---
name: ambient-video-maker
description: Trigger ambient_video_generate from free-text theme/style input, with ambient_cover_generate and split build/render tools available for debugging and recovery.
---

## Prompts / Intent Signals

- “睡眠视频” / “睡前” / “助眠”
- “钢琴” / “calm piano”
- “焦点” / “专注”
- “loop-safe” / “低变化” / “ambient music”

The skill maps aliases and keywords defined in each theme config (`sleep-piano`, `rainy-night-piano`, etc.) and asks a clarification question whenever confidence is low.

## Workflow

1. Parse `theme`, `style`, and `duration` from user text.
2. Call `ambient_video_generate` as the default path with `[theme, style, duration_target_sec, mode, output_name]`.
3. Let the plugin resolve the free text to an internal `theme_id`, generate music, generate a static cover image, and render the final MP4.
4. Return the final output path, resolved `theme_id`, theme/version, master duration, and render summary from the one-shot tool.
5. If the one-shot path fails, use the fallback / 回退 path with `ambient_cover_generate` or `ambient_music_build + ambient_media_render` so the operator can isolate whether the problem is in image generation, music generation, or media rendering.

## Duration Notes

- `duration_target_sec` is the final output duration.
- `master_duration_sec` is chosen automatically from the theme policy unless explicitly overridden for debugging.
- `allow_nonstandard_duration` should only be used for preview or smoke runs, not normal user requests.

*Clarification example* — “你是想要海洋主题配钢琴，还是更偏纯环境音？确认后我按 1 小时生成。”
