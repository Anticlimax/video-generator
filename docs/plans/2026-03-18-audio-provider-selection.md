# Ambient Audio Provider 选型结论

> 状态：Decision v1
> 日期：2026-03-18
> 作用：为 MVP 的“短母带生成服务”确定默认选型方向，避免继续将不稳定或未验证通道当作默认依赖

## 1. 背景

本项目的核心链路是：

1. 解析主题
2. 生成 2 到 10 分钟短母带
3. 将短母带扩展成长音频
4. 贴合程序化视频模板
5. 导出最终 MP4

当前真正影响 MVP 成败的，不是“有没有很多模型名字”，而是：

- 是否能稳定生成短母带
- 是否适合低变化环境音乐
- 是否容易接入到现有 OpenClaw plugin 架构
- 是否有足够清晰的 API 和商用边界

## 2. 结论

当前推荐的 provider 策略是：

1. `mock/local` 作为默认保底路径
2. `ElevenLabs Music API` 作为第一真实外部 provider
3. `Mubert API` 作为第二候选 provider
4. `Gemini Lyria RealTime` 作为实验性路线
5. `infsh` 不作为当前默认 provider，只保留为未来扩展接口

## 3. 为什么不把 infsh 当默认方案

`infsh` CLI 本身可用，但在当前检索结果下，并没有找到可直接拿来做音频生成默认依赖的公开 app。

实际检查结果是：

- `infsh app list --category audio` 返回空结果
- 因此当前无法确认一个公开、稳定、可直接配置的 `infshAppId`

所以 `infsh` 现在的合理定位是：

- 保留 provider 适配层接口
- 不作为当前 MVP 的默认音频生成来源
- 等未来拿到明确可用的 app id 后再接入

## 4. 候选方案判断

### 4.1 ElevenLabs Music API

推荐等级：最高

原因：

- 官方明确提供 Music API
- 有较低门槛的开发者方案
- API 化路径清晰
- 比较适合作为“先生成短母带，再做本地扩展”的外部生成器

适合本项目的点：

- 更接近“直接生成一段音乐”
- 成本门槛相对低
- 接入复杂度比实时流式音乐 API 更低

当前风险：

- 还需要验证在“助眠 / 冥想 / 低变化环境音乐”场景中的实际质量
- 输出规格仍需要统一转换到本项目的标准格式

## 4.2 Mubert API

推荐等级：第二

原因：

- 产品定位非常贴近背景音乐、UGC、长内容
- 官方对 royalty-free 和内容平台场景表达更直接

适合本项目的点：

- 很贴“助眠 / 专注 / 冥想背景音乐”
- 商用和平台使用路径更明确

当前风险：

- 价格门槛明显更高
- 不适合作为第一阶段最便宜的默认接入方案

## 4.3 Gemini Lyria RealTime

推荐等级：实验性

原因：

- 官方确实开放了音乐生成能力
- 但 API 形态是实时流式 WebSocket，而不是最简单的离线生成文件接口

适合本项目的点：

- 未来很适合做互动式创作、实时 preview、边听边调

当前风险：

- 对当前 MVP 来说接入复杂度偏高
- 不适合作为第一真实 provider

## 5. MVP 的最终建议

在当前阶段，建议明确如下：

- 默认路径：`mock/local`
- 第一真实外部 provider：`ElevenLabs Music API`
- 第二候选：`Mubert API`
- `Gemini Lyria RealTime` 进入后续实验路线
- `infsh` 仅保留接口，不再作为默认依赖

## 6. 对现有代码与文档的影响

应该同步调整：

- README 中不再把 `infsh` 表述为默认方案
- 技术设计里将 `infsh` 从“唯一外部生成路径”改为“可选扩展接口”
- 实现计划里将“先接 infsh”改为“先评估并接 ElevenLabs Music API”
- provider 抽象保持不变，但默认策略改为：
  - `mock`
  - `elevenlabs`
  - `mubert`
  - `gemini-experimental`
  - `infsh-optional`

## 7. 当前决策

本项目截至 2026-03-18 的音频 provider 决策为：

- 架构保留多 provider 适配层
- 当前 MVP 不依赖 `infsh`
- 下一优先动作应围绕 `ElevenLabs Music API` 做接入设计与实现
