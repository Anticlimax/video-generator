# Ambient Video 静态图成片实现计划

> 日期：2026-03-18
> 依赖：`docs/plans/2026-03-18-static-cover-video-design.md`

## 任务 1：输入模型调整

- 让 `ambient_video_generate` 支持 `theme` / `style` 文本输入
- 保留 `theme_id` 兼容旧调用
- 明确优先级：`theme_id` > `theme`

## 任务 2：封面图工具

- 新增 `ambient_cover_generate`
- 输出 `image_path`
- 统一 `16:9` 导出

## 任务 3：图片 provider 抽象

- 先接一个可用生图 provider
- 失败时回退到程序化默认图

## 任务 4：静态图渲染分支

- `ambient_media_render` 支持 `image_path`
- 用 `ffmpeg -loop 1` 导出等长静态视频

## 任务 5：一键链路整合

- `ambient_video_generate`
  - music build
  - cover generate
  - media render

## 任务 6：文档和 smoke

- README 增加新调用方式
- 增加一条真实 OpenClaw smoke：
  - `theme=ocean`
  - `style=calm piano`
  - `duration=8`
