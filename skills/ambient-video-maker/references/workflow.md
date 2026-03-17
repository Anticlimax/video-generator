### Example: Sleep Piano 2h

1. User says “生成一个 2 小时 睡眠 钢琴 视频”.
2. Skill resolves `theme_id = sleep-piano` via aliases/keywords.
3. `ambient_video_generate` runs in the selected mode and returns `master_audio_path`, `master_duration_sec`, and `final_output_path`.
4. Skill replies with `final_output_path`, `theme_version`, and render summary.

## Fallback

1. If `ambient_video_generate` fails, call `ambient_music_build` first.
2. If music build succeeds, call `ambient_media_render` with the returned `master_audio_path`.
3. Use the split path to determine whether failure came from provider output or final rendering.

### Fallback Flow

1. Unrecognized text? Skill lists candidate themes and asks “哪个主题更贴合：睡眠钢琴 还是 雨夜？”
2. After selection, proceed with the normal build/render flow.
