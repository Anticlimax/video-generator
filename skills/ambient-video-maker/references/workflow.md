### Example: Ocean Piano 2h

1. User says “生成一个 2 小时 海洋主题的舒缓钢琴视频”.
2. Skill extracts `theme = ocean`, `style = soothing piano`, `duration_target_sec = 7200`.
3. `ambient_video_generate` resolves the free text to an internal theme family, builds a short master, generates a static cover image, and renders the final MP4.
4. Skill replies with `final_output_path`, resolved `theme_id`, `theme_version`, and render summary.

## Fallback

1. If `ambient_video_generate` fails during cover generation, call `ambient_cover_generate` directly to isolate the image step.
2. If music generation is the suspected issue, call `ambient_music_build` first.
3. If music build succeeds, call `ambient_media_render` with the returned `master_audio_path` and optional `image_path`.
4. Use the split path to determine whether failure came from provider output, cover generation, or final rendering.

### Fallback Flow

1. Unrecognized text? Skill lists candidate theme families and asks “你更想要海洋、睡眠夜空，还是冥想氛围？”
2. After selection, proceed with the normal build/render flow.
