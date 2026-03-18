# OpenClaw + tgbot Routing

## Goal

Define how a linked Telegram bot should route user messages into OpenClaw so the existing `ambient-video-maker` skill can keep using:

- 自然语言
- slash command
- 阶段化进度消息

without introducing a separate standalone bot service.

## Current Assumption

The Telegram bot is already linked to OpenClaw and can forward user messages into the main agent.

That means the routing problem is not:

- building a new Telegram bot host

It is:

- standardizing how Telegram text should be interpreted
- standardizing how progress and completion messages should be sent back

## Entry Policy

Two stable explicit commands:

- `/ambient`
- `/ambient_publish`

Recommended formats:

```text
/ambient <theme> | <style> | <duration>
/ambient_publish <theme> | <style> | <duration>
```

Examples:

```text
/ambient ocean | calm piano, soft moonlight | 30m
/ambient_publish rainy night | soft piano | 1h
```

Natural language remains enabled.

Examples:

- “生成一个 30 分钟的海洋钢琴视频”
- “帮我做一个 1 小时的雨夜钢琴并上传 YouTube”

## Routing Rule

1. If the incoming Telegram text matches `/ambient`, route to `ambient_video_generate`
2. If it matches `/ambient_publish`, route to `ambient_video_publish`
3. Complete slash commands should be executed directly, not followed by a style-choice question
4. Otherwise treat it as natural language
5. If natural language extraction is high confidence, execute
5. If confidence is low, reply with a confirmation message instead of starting immediately

## Reply Guardrails

- 不暴露内部实现、内部工具名、内部参数名、`theme_id`、fallback、prompt 构造或“我先换一种更稳的写法”这类开发者语言
- 不对完整 `/ambient` 或 `/ambient_publish` 输入先给多选题
- 默认只展示用户原始主题和风格，不展示内部归类结果
- 不能出现重复扩展名，例如 `.mp4.mp4`

## Confirmation Policy

Suggested confirmation message:

```text
我理解为：
theme: ocean
style: calm piano, soft moonlight
duration: 30m
action: 生成并上传

回复“确认”后开始。
```

## Progress Messaging

Preferred behavior:

- edit one Telegram message through the whole lifecycle

Progress source:

- `jobs/<job_id>/progress.json`

Important fields:

- `stage`
- `status`
- `progress`
- `message`
- `artifacts.final_output_path`
- `artifacts.youtube_url`

Telegram context to forward into tool args whenever available:

- direct-message `sender_id` -> `telegram_chat_id`
- `To=telegram:<chat_id>` or `From=telegram:<chat_id>` -> `telegram_chat_id`
- `MessageThreadId` -> `telegram_thread_id`

Important:

- do not treat inbound user `message_id` as the editable bot message id
- once `telegram_chat_id` is available, the plugin should send its own placeholder progress message, capture the returned bot `messageId`, and then edit that message through the rest of the run
- without `telegram_chat_id`, the plugin can still generate media, but it cannot update Telegram progress in place

Recommended stage mapping:

- `queued` -> `任务已创建`
- `video_generating` -> `正在生成视频`
- `theme_resolved` -> `已解析主题`
- `music_generating` -> `正在生成音乐`
- `music_ready` -> `音乐已生成`
- `cover_generating` -> `正在生成封面图`
- `cover_ready` -> `封面图已生成`
- `video_rendering` -> `正在合成视频`
- `youtube_uploading` -> `正在上传 YouTube`
- `completed` -> `任务完成`
- `failed` -> `任务失败`

Suggested in-flight message:

```text
任务：ocean | calm piano, soft moonlight | 30m
状态：正在生成音乐
进度：50%
```

Suggested completion message:

```text
任务完成
本地文件：outputs/example.mp4
YouTube：https://www.youtube.com/watch?v=...
```

For generate-only requests:

```text
已生成完成

文件：outputs/example.mp4
时长：10 分钟
主题：暴躁火焰
风格：摇滚
```

For generate-and-upload requests:

```text
已生成并上传完成

文件：outputs/example.mp4
时长：10 分钟
主题：暴躁火焰
风格：摇滚
YouTube：https://www.youtube.com/watch?v=...
```

## Why This Is The Right Boundary

This keeps responsibilities in the right place:

- OpenClaw + tgbot handles message ingress and message editing
- `ambient-video-maker` handles intent and tool orchestration
- plugin tools handle generation, rendering, and publishing

It avoids building a second Telegram host while still making the bot replies predictable.
