---
name: ambient-video-maker
description: Trigger ambient_video_generate from free-text theme/style input, with ambient_cover_generate and split build/render tools available for debugging and recovery.
---

## OpenClaw + tgbot

This skill is designed to work behind OpenClaw when a linked `tgbot` forwards Telegram messages into the agent.

- 自然语言可以继续作为默认入口
- `/ambient` 和 `/ambient_publish` 作为更稳定的显式入口
- 当消息解析置信度低时，先确认再执行
- 执行中优先基于 `progress.json` 输出阶段化进度消息
- 对完整 slash command 直接执行，不先追问
- 不暴露内部 tool、内部参数、`theme_id`、fallback 或实现细节
- 对 Telegram 入站消息，优先从标准上下文字段中提取并透传：
  - DM 场景优先用 `Conversation info` 里的 `sender_id` 作为 `telegram_chat_id`
  - 如果存在 `To` / `From=telegram:<chat_id>`，也可直接提取为 `telegram_chat_id`
  - 如果存在 `MessageThreadId`，提取为 `telegram_thread_id`
  - 不要把入站用户消息的 `message_id` 当成可编辑的 bot message id
  - 调用 `ambient_video_generate` / `ambient_video_publish` 时，能拿到 `telegram_chat_id` 就必须传入 tool args；plugin 会自己创建可编辑的进度消息

## Prompts / Intent Signals

- “睡眠视频” / “睡前” / “助眠”
- “钢琴” / “calm piano”
- “焦点” / “专注”
- “loop-safe” / “低变化” / “ambient music”

The skill maps aliases and keywords defined in each theme config (`sleep-piano`, `rainy-night-piano`, etc.) and asks a clarification question whenever confidence is low.

## Workflow

1. Parse `theme`, `style`, and `duration` from user text or slash command input.
2. If the message matches `/ambient <theme> | <style> | <duration>`, call `ambient_video_generate` and 直接执行.
3. If the message matches `/ambient_publish <theme> | <style> | <duration>`, call `ambient_video_publish` and 直接执行.
4. For natural language, call `ambient_video_generate` as the default path only when `theme`, `style`, and `duration_target_sec` are clear enough; otherwise ask a clarification question first.
5. For Telegram sessions, map direct-message `sender_id` to `telegram_chat_id`; if `To=telegram:<chat_id>` or `From=telegram:<chat_id>` is present, that also works. Map `MessageThreadId` to `telegram_thread_id` whenever present. Do not reuse inbound user `message_id` as the edit target.
6. Let the plugin resolve the free text to an internal canonical theme family, generate music, generate a static cover image, and render the final MP4.
7. Return the final output path, resolved internal theme family, theme/version, master duration, and render summary from the one-shot tool.
8. If the one-shot path fails, use the fallback / 回退 path with `ambient_cover_generate` or `ambient_music_build + ambient_media_render` so the operator can isolate whether the problem is in image generation, music generation, or media rendering.

## Reply Policy

- 对自然语言，优先保持简洁回复，不重复底层实现细节
- 不暴露内部 tool 名、内部参数名、`theme_id`、fallback、prompt 构造、分步实现策略
- 不要向用户说 `ambient_video_generate`、`ambient_video_publish`、`ambient_music_build`、`allow_nonstandard_duration`
- 低置信度时先确认，不直接开跑
- 任务执行中，按阶段回报：
  - `正在生成音乐`
  - `正在生成封面图`
  - `正在合成视频`
  - `正在上传 YouTube`
- 完成后统一返回：
  - 本地输出路径
  - 如果有上传，再返回 YouTube 链接
- 输出文件名要规范，不能出现重复扩展名，例如 `.mp4.mp4`
- 默认对用户只展示他们原始主题和风格，不展示内部 `theme_id`

### Completion Formats

- `/ambient`

```text
已生成完成

文件：<final_output_path>
时长：<duration>
主题：<theme>
风格：<style>
```

- `/ambient_publish`

```text
已生成并上传完成

文件：<final_output_path>
时长：<duration>
主题：<theme>
风格：<style>
YouTube：<youtube_url>
```

## Duration Notes

- `duration_target_sec` is the final output duration.
- `master_duration_sec` is chosen automatically from the theme policy unless explicitly overridden for debugging.
- `allow_nonstandard_duration` should only be used for preview or smoke runs, not normal user requests.

*Clarification example* — “你是想要海洋主题配钢琴，还是更偏纯环境音？确认后我按 1 小时生成。”
