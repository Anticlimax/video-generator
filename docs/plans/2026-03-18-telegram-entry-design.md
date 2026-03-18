# Telegram Entry Design

## Goal

Define a stable Telegram control surface for the ambient video MVP so users can trigger:

- generation only
- generation plus YouTube upload

without depending on brittle fully free-form parsing.

## Recommended Entry Model

Two Telegram commands are the primary interface:

- `/ambient`
- `/ambient_publish`

User-visible meaning:

- `/ambient`: generate the local MP4 only
- `/ambient_publish`: generate the MP4 and upload it to YouTube

## Input Protocol

Preferred input format:

```text
/ambient <theme> | <style> | <duration>
/ambient_publish <theme> | <style> | <duration>
```

Examples:

```text
/ambient ocean | calm piano, soft moonlight | 30m
/ambient_publish rainy night | soft piano | 1h
```

Normalized fields:

- `theme`: free-text semantic subject or mood
- `style`: free-text musical and visual flavor
- `duration`: human-readable duration parsed into `duration_target_sec`

Execution mapping:

- `/ambient` -> `ambient_video_generate`
- `/ambient_publish` -> `ambient_video_publish`

## Why This Format

This format is the best first-pass MVP trade-off because it:

- is easy for users to learn and demo
- is easy for the bot to parse deterministically
- keeps `theme` and `style` open-ended
- avoids exposing internal `theme_id`
- separates local generation from publishing for debugging

## Natural Language Policy

Natural language is supported only as a compatibility path.

Examples:

- “生成一个 30 分钟的 ocean 主题 calm piano 视频”
- “做一个 1 小时的雨夜钢琴并上传 YouTube”

Decision rule:

- if `theme`, `style`, and `duration` are all confidently extracted, execute
- otherwise, ask for confirmation or the missing field

Low-confidence inputs should never trigger generation immediately.

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

Telegram should prefer editing one message instead of sending many messages.

The bot should poll:

- `jobs/<job_id>/progress.json`

Relevant fields:

- `stage`
- `status`
- `progress`
- `message`
- `artifacts.final_output_path`

Recommended stage-to-copy mapping:

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
进度：2/4
```

Suggested completion message:

```text
任务完成
本地文件：outputs/example.mp4
YouTube：https://www.youtube.com/watch?v=...
```

## MVP Scope

Included:

- fixed slash-command protocol
- natural-language compatibility path
- confirmation gate for ambiguous requests
- progress message editing via `progress.json`

Not included yet:

- rich Telegram inline buttons
- cancel / pause / resume controls
- playlist routing
- thumbnail review flow
- post-upload metadata editing in Telegram

## Next Implementation Step

Implement a Telegram adapter that:

1. parses `/ambient` and `/ambient_publish`
2. normalizes `theme`, `style`, and `duration_target_sec`
3. calls the matching OpenClaw tool
4. edits one Telegram message based on `progress.json`
5. posts the final local path and optional YouTube URL
