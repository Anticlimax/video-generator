### Example: Sleep Piano 2h

1. User says “生成一个 2 小时 睡眠 钢琴 视频”.
2. Skill resolves `theme_id = sleep-piano` via aliases/keywords.
3. `ambient_music_build` runs in `mock` mode, returns `master_audio_path`.
4. `ambient_media_render` loops `default-black`, applies `crossfade=6`, normalizes to -23 LUFS, muxes audio/video, writes manifest.
5. Skill replies with `final_output_path` and `manifest`.

### Fallback Flow

1. Unrecognized text? Skill lists candidate themes and asks “哪个主题更贴合：睡眠钢琴 还是 雨夜？”
2. After selection, proceed with the normal build/render flow.
