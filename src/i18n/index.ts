export const locales = ["zh-CN", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh-CN";
export const localeCookieName = "locale";

export function normalizeLocale(value: string | null | undefined): Locale {
  if (value === "en") {
    return "en";
  }
  return "zh-CN";
}

export const dictionaries = {
  "zh-CN": {
    app: {
      title: "环境视频工作台",
      description: "根据主题、风格和时长生成环境视频。"
    },
    nav: {
      brand: "环境视频工作台",
      create: "创建",
      jobs: "任务",
      schedules: "计划",
      integrations: "集成"
    },
    language: {
      zh: "中文",
      en: "EN"
    },
    home: {
      eyebrow: "环境视频工作台",
      title: "输入主题，即可生成视频、封面与可发布资产。",
      lede: "输入主题、描述氛围、选择时长，就能在一个页面里完成环境视频生成。",
      randomize: "随机主题与风格",
      randomizing: "生成中...",
      theme: "主题",
      style: "风格",
      duration: "时长",
      durationHint: "支持 30m、2h 或直接输入秒数。",
      videoVisualPrompt: "视频画面描述",
      provider: "提供方",
      publishToYouTube: "生成完成后上传到 YouTube",
      generate: "开始生成",
      generating: "生成中..."
    },
    jobs: {
      eyebrow: "任务",
      title: "最近生成记录",
      lede: "在这里查看任务历史、当前状态与结果链接。",
      empty: "还没有任务。先从首页创建第一条生成任务。",
      noMatch: "这个任务不存在，或已被删除。",
      retry: "重试任务",
      retrying: "重试中...",
      result: "结果",
      artifacts: "产物",
      status: "状态",
      progress: "进度",
      duration: "时长",
      master: "母带",
      provider: "提供方",
      motionProvider: "动效提供方",
      motionPreset: "动效预设",
      motionClip: "动效片段",
      vfxAsset: "特效素材",
      created: "创建时间",
      updated: "更新时间",
      videoImage: "视频主图",
      coverImage: "封面图",
      coverReused: "封面复用视频主图",
      motionVideo: "动效视频",
      masterAudio: "母带音频",
      finalVideo: "最终视频",
      youtubeVideoId: "YouTube 视频 ID",
      errorCode: "错误码",
      errorMessage: "错误信息",
      openYouTubeVideo: "打开 YouTube 视频",
      none: "无",
      auto: "自动",
      statusLabels: {
        queued: "排队中",
        running: "运行中",
        completed: "已完成",
        failed: "失败"
      },
      stageLabels: {
        queued: "排队中",
        music_generating: "生成音频",
        music_ready: "音频就绪",
        cover_generating: "生成画面",
        render_preparing: "准备合成",
        rendering: "视频合成中",
        publish_pending: "等待发布",
        publishing: "发布中",
        completed: "已完成",
        failed: "失败"
      }
    },
    schedules: {
      eyebrow: "计划",
      title: "创建每日或每周的生成计划。",
      lede: "用更简单的规则配置定时运行，系统会自动转换成基于 cron 的执行。",
      noMatch: "这个计划不存在，或已被删除。",
      editTitle: "编辑定时生成计划",
      editLede: "修改触发时间和生成参数，然后保存回计划队列。",
      type: "计划类型",
      daily: "每天",
      weekly: "每周",
      time: "时间",
      weekday: "星期",
      sunday: "周日",
      monday: "周一",
      tuesday: "周二",
      wednesday: "周三",
      thursday: "周四",
      friday: "周五",
      saturday: "周六",
      theme: "主题",
      style: "风格",
      duration: "时长",
      durationHint: "支持 30m、2h 或直接输入秒数。",
      provider: "提供方",
      publishToYouTube: "生成完成后上传到 YouTube",
      save: "保存计划",
      saving: "保存中...",
      create: "创建计划",
      creating: "创建中...",
      empty: "还没有计划。先在上方创建第一条定时生成计划。",
      enabled: "已启用",
      disabled: "已停用",
      next: "下次运行",
      last: "上次运行",
      never: "从未",
      lastJob: "最近任务",
      edit: "编辑",
      toggle: "切换启停",
      runNow: "立即执行",
      delete: "删除"
    },
    integrations: {
      eyebrow: "集成",
      title: "检查运行时提供方是否已配置。",
      lede: "这个页面只读。请通过环境变量配置对应值，然后重启应用。",
      configured: "已配置",
      missing: "缺失",
      youtubeOauth: "YouTube OAuth",
      youtubeGuide: "查看 YouTube OAuth 配置指南",
      youtubeGuideLede: "使用配置指南获取 refresh token，并将其映射到 VPS 或 Google Cloud 的环境变量。"
    }
  },
  en: {
    app: {
      title: "Ambient Video Studio",
      description: "Generate ambient videos from a theme, style, and duration."
    },
    nav: {
      brand: "Ambient Video Studio",
      create: "Create",
      jobs: "Jobs",
      schedules: "Schedules",
      integrations: "Integrations"
    },
    language: {
      zh: "中文",
      en: "EN"
    },
    home: {
      eyebrow: "Ambient Video Studio",
      title: "Turn a theme into a video, cover, and publishable asset.",
      lede: "Enter a theme, describe the mood, pick a duration, and generate an ambient video in one place.",
      randomize: "Randomize theme + style",
      randomizing: "Randomizing...",
      theme: "Theme",
      style: "Style",
      duration: "Duration",
      durationHint: "Supports 30m, 2h, or raw seconds.",
      videoVisualPrompt: "Video visual prompt",
      provider: "Provider",
      publishToYouTube: "Publish to YouTube after generation",
      generate: "Generate",
      generating: "Generating..."
    },
    jobs: {
      eyebrow: "Job",
      title: "Recent generations",
      lede: "Task history, status, and result links in one place.",
      empty: "No jobs yet. Create the first generation from the home page.",
      noMatch: "This job does not exist or has been removed.",
      retry: "Retry job",
      retrying: "Retrying...",
      result: "Result",
      artifacts: "Artifacts",
      status: "Status",
      progress: "Progress",
      duration: "Duration",
      master: "Master",
      provider: "Provider",
      motionProvider: "Motion provider",
      motionPreset: "Motion preset",
      motionClip: "Motion clip",
      vfxAsset: "VFX asset",
      created: "Created",
      updated: "Updated",
      videoImage: "Video image",
      coverImage: "Cover image",
      coverReused: "Cover reuses video image",
      motionVideo: "Motion video",
      masterAudio: "Master audio",
      finalVideo: "Final video",
      youtubeVideoId: "YouTube video id",
      errorCode: "Error code",
      errorMessage: "Error message",
      openYouTubeVideo: "Open YouTube video",
      none: "none",
      auto: "auto",
      statusLabels: {
        queued: "Queued",
        running: "Running",
        completed: "Completed",
        failed: "Failed"
      },
      stageLabels: {
        queued: "Queued",
        music_generating: "Generating audio",
        music_ready: "Audio ready",
        cover_generating: "Generating visuals",
        render_preparing: "Preparing render",
        rendering: "Rendering video",
        publish_pending: "Waiting to publish",
        publishing: "Publishing",
        completed: "Completed",
        failed: "Failed"
      }
    },
    schedules: {
      eyebrow: "Schedules",
      title: "Create daily or weekly generation schedules.",
      lede: "Configure a simple recurring run, then let the app normalize it into cron-backed execution.",
      noMatch: "This schedule does not exist or has been removed.",
      editTitle: "Edit recurring generation",
      editLede: "Update the schedule timing and generation payload, then save it back into the queue.",
      type: "Schedule type",
      daily: "Daily",
      weekly: "Weekly",
      time: "Time",
      weekday: "Weekday",
      sunday: "Sunday",
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday",
      saturday: "Saturday",
      theme: "Theme",
      style: "Style",
      duration: "Duration",
      durationHint: "Supports 30m, 2h, or raw seconds.",
      provider: "Provider",
      publishToYouTube: "Publish to YouTube after generation",
      save: "Save schedule",
      saving: "Saving...",
      create: "Create schedule",
      creating: "Creating...",
      empty: "No schedules yet. Create the first recurring generation above.",
      enabled: "enabled",
      disabled: "disabled",
      next: "Next",
      last: "Last",
      never: "never",
      lastJob: "last job",
      edit: "edit",
      toggle: "toggle",
      runNow: "run now",
      delete: "delete"
    },
    integrations: {
      eyebrow: "Integrations",
      title: "Check which runtime providers are configured.",
      lede: "This page is read-only. Configure values through environment variables, then restart the app.",
      configured: "Configured",
      missing: "Missing",
      youtubeOauth: "YouTube OAuth",
      youtubeGuide: "Open YouTube OAuth setup guide",
      youtubeGuideLede: "Use the setup guide to obtain a refresh token and map it into environment variables for VPS or Google Cloud deployment."
    }
  }
} as const;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
