# Ambient Longform Video Generator 技术设计

> 状态：Draft v1
> 日期：2026-03-17
> 依赖前置文档：`docs/plans/2026-03-17-ambient-video-product-baseline.md`

## 1. 设计目标

本设计服务于第一阶段 MVP，目标是以最少新增开发量完成以下能力：

- 根据主题生成环境音乐
- 将短母带稳定扩展成长音频
- 为音频贴合合适的视频模板
- 导出一个可直接播放的长视频成品

本设计强调：

- 优先复用 OpenClaw / ClawHub 已有能力
- 将自定义代码收缩到“编排”和“薄封装”
- 先做稳纯环境音乐，不先做复杂自然声景和复杂视频生成

## 2. 关键技术决策

### 2.1 整体采用 Skill + 薄 Plugin 架构

推荐架构：

- 一个编排型 skill：`ambient-video-maker`
- 一个薄媒体 plugin：`ambient-media-tools`

原因：

- 纯 skill 虽然开发更快，但会把过多命令细节暴露给 agent
- 重 plugin 会显著增加开发量，与本项目目标不符
- skill 负责理解任务和选择路径，plugin 负责把脆弱的媒体处理步骤封装稳定

### 2.2 音乐生成采用“短母带 + 长时扩展”

第一阶段不追求“一次生成 2 小时音乐”，而采用：

1. 生成 2 到 10 分钟短环境音乐母带
2. 识别或预设合适的循环区间
3. 通过本地处理扩展到目标时长

原因：

- 更适合睡眠、专注、冥想等低变化场景
- 更容易提升稳定性
- 成本和失败率都更低

### 2.3 视频层使用主题模板和循环扩展

视频层不做复杂 AI 长视频生成，而是：

1. 按主题选择一个视频模板
2. 将模板循环或缓动扩展到与音频等长
3. 最终进行 mux 合成

这条路线对 MVP 最合适，因为视频在该场景中承担的是氛围承载作用，不是主要创作对象。

### 2.4 MVP 优先使用程序化模板并默认串行执行

为控制开发量和版权风险，第一阶段内置视频模板优先采用 `ffmpeg` 可直接生成或轻处理得到的程序化模板，不依赖第三方实拍素材库。

同时，MVP 阶段默认按串行任务执行，不引入队列系统，也不承诺并发渲染体验。任务并发控制和预览模式留到后续阶段。

## 3. 复用的现有能力

当前设计优先复用以下能力：

- OpenClaw skill 作为工作流入口
- 本地 `ffmpeg` 负责扩展、拼接和导出
- `agent-tools` skill 负责连接外部 AI 生成能力
- 可选 ClawHub skill：
  - `video-frames`
  - `ffmpeg-video-editor`
  - `ffmpeg-cli`
  - `audio`
  - `audio-mastering-cli`

MVP 不强依赖所有外部 skill 都预先安装，但架构会优先兼容它们。

## 4. 系统组件

### 4.1 `ambient-video-maker` skill

职责：

- 识别用户输入中的主题、时长、风格
- 将主题解析为标准化主题配置
- 决定调用哪种音频生成路径
- 调用 plugin 工具完成长音频和最终视频合成
- 向用户返回生成状态、输出路径和失败原因

该 skill 本质上是“产品逻辑编排层”，不应该承担复杂媒体细节。

### 4.2 `ambient-media-tools` plugin

职责：

- 将环境音乐构建和媒体合成封装为稳定工具
- 把脆弱的 `ffmpeg` 命令和本地文件组织逻辑隐藏在工具内部
- 产出结构化结果，便于 skill 继续编排

建议第一阶段只做两个核心工具：

#### 工具一：`ambient_music_build`

输入：

- `theme_id`
- `style_override`
- `duration_target_sec`
- `seed`
- `mode`
- `timeout_sec`
- `max_retries`

输出：

- `master_audio_path`
- `master_duration_sec`
- `loop_strategy`
- `theme_version`
- `audio_spec`
- `qc_notes`

职责：

- 根据主题模板构造音乐 prompt
- 通过 `agent-tools` 或后端适配器生成短母带
- 将结果标准化为统一音频格式
- 记录本次生成参数

#### 工具二：`ambient_media_render`

输入：

- `master_audio_path`
- `duration_target_sec`
- `video_template_id`
- `output_name`
- `mix_profile`
- `crossfade_duration_sec`
- `target_lufs`

输出：

- `audio_output_path`
- `video_output_path`
- `final_output_path`
- `duration_sec`
- `ffprobe_summary`
- `file_sizes`
- `render_manifest_path`

职责：

- 将短母带扩展成长音频
- 将视频模板循环到目标时长
- 将音频和视频合成为最终成品
- 输出本次渲染的 manifest

### 4.3 主题配置层

建议以配置文件驱动，不把主题逻辑写死在 prompt 中。

第一阶段建议增加：

- `config/themes/sleep-piano.json`
- `config/themes/rainy-night-piano.json`
- `config/themes/deep-focus.json`
- `config/themes/meditation-ambient.json`

每个主题配置至少包括：

- `id`
- `version`
- `label`
- `description`
- `aliases`
- `keywords`
- `music_style`
- `prompt_seed`
- `default_duration_sec`
- `allowed_duration_sec`
- `video_template_id`
- `crossfade_duration_sec`
- `target_lufs`
- `mix_profile`
- `tags`

### 4.4 视频模板库

建议本地维护一个小型模板库：

- `assets/video-templates/default-black/`
- `assets/video-templates/soft-stars/`
- `assets/video-templates/gradient-drift/`

每个模板至少提供：

- 模板元数据
- `source_type`
- `license`
- 程序化生成参数或引用的本地素材信息

MVP 阶段所有内置模板都应满足：

- `source_type = procedural`
- `license = internal-generated`

这样可以避免在第一阶段引入版权审核流程。

### 4.5 音乐 Provider 适配层

`ambient_music_build` 不应直接绑死某个生成服务，而应通过 provider 适配层工作。

第一阶段 provider 接口至少要稳定以下内容：

- `provider_id`
- `app_id`
- `timeout_sec`
- `max_retries`
- `prepareRequest()`
- `run()`
- `normalizeResult()`

统一输出规范：

- `wav`
- `48kHz`
- `stereo`
- `16-bit`

如果外部服务返回格式不符合规范，应先本地转码再交给后续渲染步骤。

## 5. 推荐目录结构

建议第一阶段采用如下目录：

```text
video-generate/
  docs/
    plans/
  config/
    themes/
  assets/
    video-templates/
  plugins/
    ambient-media-tools/
  jobs/
    <job-id>/
      input.json
      master_audio.*
      extended_audio.*
      loop_video.*
      output.mp4
      manifest.json
  outputs/
```

其中：

- `config/themes` 保存主题模板
- `assets/video-templates` 保存可循环视频底片
- `jobs` 保存中间产物，便于追查失败
- `outputs` 保存最终导出成品

## 6. 数据流

```text
user input
  -> skill intent parse
  -> theme resolve (aliases / keywords / defaults)
  -> ambient_music_build
  -> short master normalize + loop QC
  -> ambient_media_render
  -> audio extend
  -> loudness normalize
  -> procedural video loop
  -> mux
  -> ffprobe verify
  -> output.mp4 + manifest.json
```

## 7. 核心处理流程

### 7.1 输入解析阶段

用户示例输入：

“做一个 2 小时睡眠主题视频，音乐偏简单钢琴。”

skill 需要从中解析：

- `theme = sleep`
- `style = piano-minimal`
- `duration = 7200`

如果用户未提供时长，则使用主题默认时长。

### 7.2 主题解析阶段

skill 从主题配置中取出：

- 音乐 prompt 模板
- 默认视频模板
- 混音参数
- 默认导出规格

主题解析结果应是结构化对象，而不是直接拼接为一句自由文本。

第一阶段建议由 skill 层完成自然语言意图识别和模糊匹配：

- 先按 `aliases`
- 再按 `keywords`
- 最后再走默认模板或候选提示

plugin 层只接受标准化后的 `theme_id`，不负责处理自由文本。

### 7.3 短母带生成阶段

`ambient_music_build` 根据主题模板构造标准化 prompt，再调用外部生成能力。

第一阶段推荐的生成策略：

- 目标片段长度：180 到 360 秒
- 风格：低变化、低动态、重复性较强
- 主乐器优先：钢琴、柔和 pad、轻环境氛围层
- 避免：鼓点明显、强情绪推进、突然停顿、突发高频音色
- prompt 中显式要求：首尾音色接近、结尾不要硬停、适合无缝循环

第一阶段 provider 默认策略：

- `mock` 为稳定保底路径
- `infsh` 为唯一外部生成路径
- `timeout_sec` 默认 `180`
- `max_retries` 默认 `1`

provider 输出在进入渲染链路前统一归一化为：

- `wav`
- `48kHz`
- `stereo`
- `16-bit`

### 7.4 长音频扩展阶段

`ambient_media_render` 将短母带扩展为目标时长。

建议第一阶段支持两种扩展策略：

1. 简单循环
2. 交叉淡化循环

默认优先使用交叉淡化循环，以降低循环点突兀。

第一阶段的基线方案明确为：

- 默认 `crossfade_duration_sec = 6`
- 每个主题可在配置中覆盖，推荐范围 `5-8` 秒
- 第一版只做“首尾交叉淡化”，不做复杂频谱切点搜索

为了让这个方案在 MVP 阶段更可控，应增加一个轻量 QC：

- 比较母带头部 N 秒和尾部 N 秒的 RMS 能量差异
- 其中 `N = crossfade_duration_sec`
- 若差异超过阈值，则记入 `qc_notes`

第一阶段阈值建议：

- RMS 差异大于 `4 dB` 视为高风险循环

第一阶段回退策略建议为：

- 先尝试缩短交叉淡化时长
- 若仍不稳定，则回退到简单循环并保留告警
- 必要时允许上层选择重新生成短母带

在长音频扩展完成后，应统一执行 loudness normalization。

默认目标：

- `target_lufs = -23`

该值可由主题配置覆盖，但 MVP 阶段不需要按主题做复杂差异化调音。

### 7.5 视频扩展阶段

系统根据主题选择视频模板，并采用以下策略之一：

1. 直接循环
2. 慢速变焦或轻微位移后再循环

第一阶段推荐以“直接循环 + 程序化模板”为主，不在运行时引入复杂视觉特效。

程序化模板优先级建议为：

1. 默认黑屏
2. 轻微星空噪点
3. 低速渐变流动

这三类模板足够支撑 MVP 阶段的大多数睡眠、冥想、专注场景。

### 7.6 最终合成阶段

最终由本地 `ffmpeg` 完成：

- 长音频写出
- 响度标准化
- 视频时长对齐
- 音视频 mux
- 输出最终 `mp4`
- 最终文件探测验证

渲染完成后写出 `manifest.json`，记录：

- 输入参数
- 主题版本
- 使用的模板
- 输出文件路径
- 关键处理参数
- 文件大小
- `ffprobe` 摘要

MVP 阶段至少应做的产物验证包括：

- 时长是否接近目标值
- 最终文件是否同时包含音频流和视频流
- 容器和编码是否可被 `ffprobe` 正常读取

## 8. 工具接口设计

### 8.1 `ambient_music_build` 返回结构

建议返回：

```json
{
  "ok": true,
  "job_id": "job_20260317_143022_a3f2",
  "master_audio_path": "jobs/job_20260317_143022_a3f2/master_audio.wav",
  "master_duration_sec": 240,
  "loop_strategy": "crossfade_loop",
  "theme_id": "sleep-piano",
  "theme_version": "1.0.0",
  "audio_spec": {
    "format": "wav",
    "sample_rate": 48000,
    "channels": 2,
    "bit_depth": 16
  },
  "qc_notes": [
    "low-dynamics",
    "soft-piano",
    "tail-safe-for-loop"
  ]
}
```

### 8.2 `ambient_media_render` 返回结构

建议返回：

```json
{
  "ok": true,
  "job_id": "job_20260317_143022_a3f2",
  "audio_output_path": "jobs/job_20260317_143022_a3f2/extended_audio.wav",
  "video_output_path": "jobs/job_20260317_143022_a3f2/loop_video.mp4",
  "final_output_path": "outputs/sleep-piano-2h.mp4",
  "duration_sec": 7200,
  "ffprobe_summary": {
    "video_streams": 1,
    "audio_streams": 1
  },
  "file_sizes": {
    "audio_bytes": 4147200000,
    "video_bytes": 512000000,
    "final_bytes": 638000000
  },
  "render_manifest_path": "jobs/job_20260317_143022_a3f2/manifest.json"
}
```

## 9. 配置驱动策略

主题配置应成为整个系统的稳定中心。

推荐原则：

- 用户语言可以自由，但内部必须映射到固定主题 ID
- 主题配置必须有版本号
- 所有默认值由主题配置提供
- 生成 prompt 尽量模板化
- 视频模板选择尽量配置化

这样做的收益是：

- 降低 prompt 漂移
- 降低 agent 每次自由判断的波动
- 更容易扩展新主题

## 10. 失败处理与回退

第一阶段必须对失败进行分段定位。

### 10.1 音乐生成失败

返回：

- 是外部生成失败
- 还是生成结果时长/风格不合格

回退策略：

- 重试一次同主题
- 使用保底 prompt
- 必要时切换到更简单的主题模板
- 若 provider 超时，则按 `max_retries` 重试后报错

### 10.2 长音频扩展失败

通常是：

- 文件读取失败
- 参数错误
- 循环段不适合扩展

回退策略：

- 切换到简单循环
- 缩短交叉淡化区间
- 必要时跳过响度标准化并仅输出调试产物供排查

### 10.3 视频合成失败

通常是：

- 模板缺失
- 编码参数不兼容
- 时长未对齐

回退策略：

- 切换到默认黑屏模板
- 降级为更稳的编码参数

## 11. 可观测性

MVP 阶段至少要有文件级可观测性。

每个任务建议落盘：

- `input.json`
- `resolved-theme.json`
- `manifest.json`
- 中间音频文件
- 中间视频文件
- `ffprobe.json`
- 可选 `ffmpeg-progress.log`

这样可以在没有复杂后端系统的前提下，快速定位失败点。

## 12. 成本与复杂度控制

本项目最重要的架构约束是控制复杂度。

因此第一阶段明确不做：

- 多模型自动评审体系
- 复杂音频分析
- 在线任务编排平台
- 数据库存储
- 大规模素材管理后台
- 预览模式
- 自动任务队列
- 完整存储清理系统

只要本地目录、配置文件、OpenClaw skill、薄 plugin 和 `ffmpeg` 能闭环，就符合 MVP 目标。

## 13. 分阶段实现建议

### Phase 1

- 建主题配置
- 接一个环境音乐生成路径
- 做长音频扩展
- 接视频模板循环
- 导出最终成品

### Phase 2

- 增加更多主题
- 增强循环质量
- 支持 8 小时内容
- 加入预览模式
- 增加批量生成能力
- 增加清理脚本和存储管理

### Phase 3

- 引入更丰富音色和主题风格
- 加入自然声景与环境音乐混合
- 加入封面图和发布链路

## 14. 设计结论

第一阶段推荐的最终技术方案是：

- 用 `ambient-video-maker` skill 作为编排入口
- 用 `ambient-media-tools` plugin 封装最脆弱的媒体处理步骤
- 用主题配置驱动音乐 prompt、视频模板和导出策略
- 用短母带无缝扩展成长音频
- 用模板视频循环贴合成长视频

这是当前在“开发量最小”和“稳定性可控”之间最合适的方案。
