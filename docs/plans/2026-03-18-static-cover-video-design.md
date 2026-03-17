# Ambient Video 静态图成片方案设计

> 状态：Draft v1
> 日期：2026-03-18
> 作用：将视频层从“程序化模板优先”调整为“AI 生成单张主题图 + 静态视频导出”的 MVP 设计说明

## 1. 背景

当前 MVP 的音频层已经基本跑通，但视频层仍然依赖少量受控模板。这个设计适合固定主题，但会直接限制用户输入的开放程度。

如果用户输入可以自由扩展到：

- ocean piano
- deep forest ambient
- warm sunset meditation
- rainy city night

那么继续要求用户传固定 `theme_id`，会和产品预期不匹配。

问题的核心不是音乐生成能力不足，而是视频模板层太受限。

## 2. 设计目标

本轮调整的目标是：

1. 允许用户更自由地输入主题和风格
2. 减少视频层对固定模板的依赖
3. 保持 MVP 开发量可控
4. 保留当前音频链路和一键生成入口

本轮不追求动态视频特效升级，只追求：

- 主题匹配更自然
- 视频成片链路更简单
- 更适合快速扩展主题空间

## 3. 核心决策

### 3.1 视频层改为“单张图 + 静态成片”

视频部分不再优先选择程序化模板，而是：

1. 根据用户输入主题生成一张 `16:9` 图像
2. 使用 `ffmpeg -loop 1` 将单张图延展到整段音频长度
3. 与长音频合成最终 `mp4`

这意味着视频层从“受控模板系统”变成“受控提示词 + 图像生成”。

### 3.2 用户输入从固定 `theme_id` 转向自由文本

用户主输入改为：

- `theme`
- `style`
- `duration`

内部仍可保留 `theme_id` 作为兼容字段，但不再要求用户显式传入。

### 3.3 固定模板只保留为 fallback

程序化模板不删除，但角色调整为：

- 图像生成失败时的 fallback
- 无外部生图能力时的保底路径

## 4. 产品形态

### 4.1 用户输入

最小输入：

- `theme`

推荐输入：

- `theme`
- `style`
- `duration`

示例：

- `theme = ocean`
- `style = calm piano`
- `duration = 3600`

### 4.2 系统输出

系统输出保持不变：

- 最终 `mp4`
- 母带音频
- 长音频
- 生成图片
- manifest

新增的中间产物：

- `cover_image.png`

## 5. 新数据流

```text
user input
  -> parse theme/style/duration
  -> build music prompt
  -> build short master
  -> extend long audio
  -> build image prompt
  -> generate cover image
  -> loop static image to target duration
  -> mux audio + image-video
  -> ffprobe verify
  -> output.mp4 + manifest
```

## 6. 组件调整

### 6.1 `ambient_video_generate`

继续作为主入口，不新增用户侧工具名。

职责调整为：

1. 解析自由文本主题和风格
2. 生成音乐
3. 生成封面图
4. 将静态图铺满整段音频
5. 输出最终成品

### 6.2 新增 `ambient_cover_generate`

建议新增一个薄工具：

- 输入：
  - `theme`
  - `style`
  - `aspect_ratio`
  - `output_path`
- 输出：
  - `image_path`
  - `prompt`
  - `provider`

职责：

- 把用户主题转换为适合静态长时视频背景的图像 prompt
- 调用生图能力生成一张图
- 统一导出到本地路径

### 6.3 `ambient_media_render`

职责简化为两条分支之一：

1. `image_path` 存在时：走静态图视频渲染
2. `video_template_id` 存在时：走旧模板渲染

MVP 默认优先走 `image_path` 分支。

## 7. Prompt 约束

### 7.1 音乐 Prompt

音乐 prompt 应更多接受用户自由输入，但仍加边界：

- low dynamics
- no drums
- long-form listening
- loop-safe
- soft transitions

### 7.2 图片 Prompt

图片 prompt 不能简单照搬用户主题，而要加入长时观看约束：

- cinematic ambient background
- low stimulation
- soft lighting
- no text
- no people close-up
- no strong action
- composition suitable for long static video
- 16:9

## 8. 优点

这条路线的优点是：

1. 用户输入更自然，不再被固定主题 id 限制
2. 视频层开发量更低
3. 新主题扩展成本更低
4. 更贴近“先打通产品 MVP”的目标

## 9. 风险

### 9.1 图片质量波动

不同 provider 的生图质量会波动，因此需要：

- 加统一 prompt 约束
- 保留 fallback 模板

### 9.2 静态视频视觉单调

静态图成片会比轻动态模板更单调，但对当前 MVP 是可接受的。

第一阶段重点是：

- 任意主题能出成品
- 音乐和视觉调性不冲突

而不是追求强动态视觉表现。

### 9.3 输出路径语义变化

新增 `cover_image.png` 后，manifest 和 jobs 目录结构需要同步调整。

## 10. 范围控制

本轮只做：

- 自由文本主题输入
- 静态图生成
- 静态图视频导出

本轮不做：

- 动态镜头运动
- Ken Burns 动画
- 多图轮播
- 图转视频
- 复杂模板混剪

## 11. 推荐实现顺序

1. 新增封面图工具与 provider 抽象
2. 调整 `ambient_video_generate` 输入模型
3. 给 `ambient_media_render` 增加静态图分支
4. 用 OpenClaw 本地 smoke 跑通自由文本主题成片
5. 再决定是否保留旧程序化模板为默认或 fallback
