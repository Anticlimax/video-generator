# Ambient Longform Video Generator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the MVP for a theme-driven longform ambient video generator that produces short ambient music masters, extends them into long audio, pairs them with low-stimulation looping visuals, and exports a final playable MP4 through an OpenClaw skill + thin plugin architecture.

**Architecture:** Use a local OpenClaw plugin as the stable execution layer and a local skill as the orchestration layer. Keep business logic configuration-driven with JSON theme files, keep media processing local via `ffmpeg`, normalize provider output into a single WAV spec, and keep the first release constrained to procedural video templates plus serial execution.

**Tech Stack:** Node.js 22 ESM, OpenClaw plugin conventions, local skill docs, JSON config, `node:test`, `ffmpeg`, shell smoke scripts.

---

**Prerequisite:** If `/Users/liyang/project/video-generate/.git` does not exist yet, run `git init` once before Task 1 Step 5.

Expected:

```text
Initialized empty Git repository in /Users/liyang/project/video-generate/.git/
```

### Task 1: Bootstrap The Plugin Workspace

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `openclaw.plugin.json`
- Test: `tests/openclaw/plugin-bootstrap.test.js`

**Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("package is configured as an ESM OpenClaw plugin", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.type, "module");
  assert.deepEqual(pkg.openclaw.extensions, ["./openclaw/index.js"]);
  assert.equal(pkg.scripts.test, "node --test");
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/openclaw/plugin-bootstrap.test.js`

Expected: FAIL with `ENOENT` for `package.json`.

**Step 3: Write minimal implementation**

```json
{
  "name": "ambient-video-generator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "openclaw": {
    "extensions": ["./openclaw/index.js"]
  },
  "scripts": {
    "test": "node --test"
  }
}
```

Add a matching `openclaw.plugin.json` with plugin id `ambient-media-tools`, a minimal `README.md`, and a `.gitignore` that covers `node_modules/`, `jobs/`, `outputs/`, and `.DS_Store`.

**Step 4: Run test to verify it passes**

Run: `node --test tests/openclaw/plugin-bootstrap.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add package.json .gitignore README.md openclaw.plugin.json tests/openclaw/plugin-bootstrap.test.js
git commit -m "chore: bootstrap ambient media plugin workspace"
```

### Task 2: Add Theme Registry And Template Metadata

**Files:**
- Create: `config/themes/sleep-piano.json`
- Create: `config/themes/rainy-night-piano.json`
- Create: `config/themes/deep-focus.json`
- Create: `config/themes/meditation-ambient.json`
- Create: `assets/video-templates/default-black/template.json`
- Create: `assets/video-templates/soft-stars/template.json`
- Create: `assets/video-templates/gradient-drift/template.json`
- Create: `src/lib/theme-registry.js`
- Test: `tests/lib/theme-registry.test.js`

**Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { loadThemeRegistry, resolveTheme } from "../../src/lib/theme-registry.js";

test("resolveTheme maps sleep piano requests to sleep-piano", async () => {
  const registry = await loadThemeRegistry();
  const theme = resolveTheme(registry, {
    theme: "助眠",
    style: "simple piano"
  });
  assert.equal(theme.id, "sleep-piano");
  assert.equal(theme.video_template_id, "default-black");
});

test("resolveTheme falls back to keyword scoring before failing", async () => {
  const registry = await loadThemeRegistry();
  const theme = resolveTheme(registry, {
    theme: "sleeping music",
    style: "soft piano"
  });
  assert.equal(theme.id, "sleep-piano");
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/lib/theme-registry.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/theme-registry.js`.

**Step 3: Write minimal implementation**

```js
export async function loadThemeRegistry() {
  return new Map([
    [
      "sleep-piano",
      {
        id: "sleep-piano",
        video_template_id: "default-black",
        aliases: ["sleep", "助眠"],
        keywords: ["sleeping music", "soft piano"]
      }
    ]
  ]);
}

export function resolveTheme(registry, input) {
  const themeText = `${input.theme} ${input.style ?? ""}`.toLowerCase();
  const sleep = registry.get("sleep-piano");
  if (sleep.aliases.some((item) => themeText.includes(String(item).toLowerCase()))) {
    return sleep;
  }
  if (sleep.keywords.some((item) => themeText.includes(String(item).toLowerCase()))) {
    return sleep;
  }
  throw new Error("theme_not_found");
}
```

Populate the four theme JSON files with stable fields:

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

Populate each template metadata JSON with:

- `id`
- `label`
- `kind`
- `relative_asset_path`
- `loop_strategy`
- `fallback_mode`
- `source_type`
- `license`

Use `default-black` as the guaranteed procedural fallback template.

**Step 4: Run test to verify it passes**

Run: `node --test tests/lib/theme-registry.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add config/themes assets/video-templates src/lib/theme-registry.js tests/lib/theme-registry.test.js
git commit -m "feat: add theme registry and template metadata"
```

### Task 3: Add Job Workspace And Manifest Utilities

**Files:**
- Create: `src/lib/jobs.js`
- Test: `tests/lib/jobs.test.js`

**Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createJobWorkspace, writeManifest } from "../../src/lib/jobs.js";

test("createJobWorkspace creates a stable job directory layout", async () => {
  const job = await createJobWorkspace({ rootDir: "jobs", now: new Date("2026-03-17T10:00:00Z") });
  assert.match(job.jobId, /^job_20260317_100000_[a-z0-9]{4}$/);
  assert.equal(fs.existsSync(job.jobDir), true);
});

test("writeManifest writes manifest.json inside the job directory", async () => {
  const job = await createJobWorkspace({ rootDir: "jobs", now: new Date("2026-03-17T10:00:00Z") });
  const manifestPath = await writeManifest(job, { ok: true, themeId: "sleep-piano" });
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.themeId, "sleep-piano");
});

test("createJobWorkspace generates unique ids for repeated calls on the same date", async () => {
  const first = await createJobWorkspace({ rootDir: "jobs", now: new Date("2026-03-17T10:00:00Z") });
  const second = await createJobWorkspace({ rootDir: "jobs", now: new Date("2026-03-17T10:00:00Z") });
  assert.notEqual(first.jobId, second.jobId);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/lib/jobs.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/jobs.js`.

**Step 3: Write minimal implementation**

```js
import fs from "node:fs/promises";
import path from "node:path";

export async function createJobWorkspace({ rootDir = "jobs", now = new Date() } = {}) {
  const stamp = now.toISOString().replace(/[-:TZ]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6);
  const jobId = `job_${stamp}_${suffix}`;
  const jobDir = path.join(rootDir, jobId);
  await fs.mkdir(jobDir, { recursive: true });
  return { jobId, jobDir };
}

export async function writeManifest(job, manifest) {
  const file = path.join(job.jobDir, "manifest.json");
  await fs.writeFile(file, JSON.stringify(manifest, null, 2));
  return file;
}
```

Also make `createJobWorkspace` predeclare these paths in its return value:

- `masterAudioPath`
- `extendedAudioPath`
- `loopVideoPath`
- `finalOutputPath`
- `ffprobePath`

**Step 4: Run test to verify it passes**

Run: `node --test tests/lib/jobs.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/jobs.js tests/lib/jobs.test.js
git commit -m "feat: add job workspace and manifest utilities"
```

### Task 4: Add Ambient Music Prompting And Provider Selection

**Files:**
- Create: `src/lib/music-prompt.js`
- Create: `src/lib/music-provider.js`
- Test: `tests/lib/music-prompt.test.js`
- Test: `tests/lib/music-provider.test.js`

**Step 1: Write the failing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildMusicPrompt } from "../../src/lib/music-prompt.js";
import { resolveMusicProvider } from "../../src/lib/music-provider.js";

test("buildMusicPrompt emphasizes low-dynamics piano ambient output", () => {
  const prompt = buildMusicPrompt({
    themeId: "sleep-piano",
    promptSeed: "simple piano melody"
  });
  assert.match(prompt, /low dynamics/i);
  assert.match(prompt, /simple piano/i);
  assert.doesNotMatch(prompt, /drums/i);
  assert.match(prompt, /loop/i);
});

test("resolveMusicProvider defaults to mock when infsh is disabled", () => {
  const provider = resolveMusicProvider({ mode: "mock" });
  assert.equal(provider.name, "mock");
});

test("normalizeResult enforces wav 48k stereo 16-bit output spec", async () => {
  const provider = resolveMusicProvider({ mode: "mock" });
  const result = await provider.normalizeResult({ path: "tmp/input.mp3" });
  assert.equal(result.audioSpec.format, "wav");
  assert.equal(result.audioSpec.sampleRate, 48000);
  assert.equal(result.audioSpec.channels, 2);
  assert.equal(result.audioSpec.bitDepth, 16);
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test tests/lib/music-prompt.test.js tests/lib/music-provider.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

**Step 3: Write minimal implementation**

```js
export function buildMusicPrompt({ themeId, promptSeed }) {
  return [
    "Create ambient instrumental music.",
    "Low dynamics.",
    "No drums.",
    "Loop-safe ending and beginning.",
    `Theme: ${themeId}.`,
    `Seed: ${promptSeed}.`
  ].join(" ");
}

export function resolveMusicProvider({ mode = "mock" } = {}) {
  return {
    name: mode === "infsh" ? "infsh" : "mock",
    timeoutSec: 180,
    maxRetries: 1,
    async normalizeResult() {
      return {
        path: "jobs/job_001/master_audio.wav",
        audioSpec: {
          format: "wav",
          sampleRate: 48000,
          channels: 2,
          bitDepth: 16
        }
      };
    }
  };
}
```

Then extend `music-provider.js` with a stable interface:

- `prepareRequest`
- `run`
- `normalizeResult`
- `timeoutSec`
- `maxRetries`

Implement `mock` first. The `infsh` branch can initially stop at request preparation and return a clear `not_implemented` error until Task 6 wires it into the plugin.

Normalize every provider result to:

- `wav`
- `48kHz`
- `stereo`
- `16-bit`

**Step 4: Run tests to verify they pass**

Run: `node --test tests/lib/music-prompt.test.js tests/lib/music-provider.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/music-prompt.js src/lib/music-provider.js tests/lib/music-prompt.test.js tests/lib/music-provider.test.js
git commit -m "feat: add ambient music prompt builder and provider selector"
```

### Task 5: Add Render Planning And FFmpeg Command Builders

**Files:**
- Create: `src/lib/render-plan.js`
- Create: `src/lib/ffmpeg-commands.js`
- Test: `tests/lib/render-plan.test.js`
- Test: `tests/lib/ffmpeg-commands.test.js`

**Step 1: Write the failing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildRenderPlan } from "../../src/lib/render-plan.js";
import { buildAudioExtendArgs, buildVideoLoopArgs, buildMuxArgs } from "../../src/lib/ffmpeg-commands.js";

test("buildRenderPlan chooses crossfade_loop by default", () => {
  const plan = buildRenderPlan({
    themeId: "sleep-piano",
    durationTargetSec: 7200,
    videoTemplateId: "default-black"
  });
  assert.equal(plan.audio.loopStrategy, "crossfade_loop");
  assert.equal(plan.audio.crossfadeDurationSec, 6);
  assert.equal(plan.audio.targetLufs, -23);
  assert.equal(plan.video.templateId, "default-black");
});

test("buildVideoLoopArgs uses a procedural fallback for default-black", () => {
  const args = buildVideoLoopArgs({
    videoTemplateId: "default-black",
    durationTargetSec: 7200,
    outputPath: "jobs/job_001/loop_video.mp4"
  });
  assert.ok(args.includes("color=c=black"));
});

test("buildAudioExtendArgs includes crossfade and loudnorm filters", () => {
  const args = buildAudioExtendArgs({
    inputPath: "jobs/job_001/master.wav",
    outputPath: "jobs/job_001/extended.wav",
    durationTargetSec: 7200,
    crossfadeDurationSec: 6,
    targetLufs: -23
  });
  assert.ok(args.join(" ").includes("acrossfade"));
  assert.ok(args.join(" ").includes("loudnorm=I=-23"));
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test tests/lib/render-plan.test.js tests/lib/ffmpeg-commands.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

**Step 3: Write minimal implementation**

```js
export function buildRenderPlan({ themeId, durationTargetSec, videoTemplateId }) {
  return {
    themeId,
    durationTargetSec,
    audio: { loopStrategy: "crossfade_loop", crossfadeDurationSec: 6, targetLufs: -23 },
    video: { templateId: videoTemplateId }
  };
}

export function buildAudioExtendArgs({ inputPath, outputPath, durationTargetSec, crossfadeDurationSec, targetLufs }) {
  return [
    "-stream_loop", "-1",
    "-i", inputPath,
    "-filter_complex", `acrossfade=d=${crossfadeDurationSec},loudnorm=I=${targetLufs}`,
    "-t", String(durationTargetSec),
    outputPath
  ];
}

export function buildVideoLoopArgs({ videoTemplateId, durationTargetSec, outputPath }) {
  if (videoTemplateId === "default-black") {
    return ["-f", "lavfi", "-i", `color=c=black:s=1280x720:d=${durationTargetSec}`, outputPath];
  }
  return [outputPath];
}
```

Then complete the module with three argument builders:

- `buildAudioExtendArgs`
- `buildVideoLoopArgs`
- `buildMuxArgs`

Keep them pure so they can be unit-tested without invoking `ffmpeg`.

Make sure `buildAudioExtendArgs` supports:

- simple loop fallback
- crossfade loop
- `loudnorm`

Keep video templates procedural in MVP. Do not block implementation on external footage.

**Step 4: Run tests to verify they pass**

Run: `node --test tests/lib/render-plan.test.js tests/lib/ffmpeg-commands.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/render-plan.js src/lib/ffmpeg-commands.js tests/lib/render-plan.test.js tests/lib/ffmpeg-commands.test.js
git commit -m "feat: add render planning and ffmpeg command builders"
```

### Task 6: Implement The OpenClaw Plugin Tools

**Files:**
- Create: `openclaw/index.js`
- Test: `tests/openclaw/tool-registration.test.js`
- Test: `tests/openclaw/ambient-music-build.test.js`
- Test: `tests/openclaw/ambient-media-render.test.js`

**Step 1: Write the failing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { registerAmbientTools } from "../../openclaw/index.js";

test("registerAmbientTools registers ambient_music_build and ambient_media_render", () => {
  const tools = [];
  registerAmbientTools({
    registerTool(tool) {
      tools.push(tool);
    },
    config: {}
  });
  assert.deepEqual(tools.map((tool) => tool.name), [
    "ambient_music_build",
    "ambient_media_render"
  ]);
});
```

Add execution tests that assert:

- `ambient_music_build` accepts a standardized `theme_id`, writes a job manifest, and records `theme_version`
- `ambient_media_render` returns stable output paths and does not require the skill layer
- `ambient_media_render` returns `ffprobe_summary` and file sizes

**Step 2: Run tests to verify they fail**

Run: `node --test tests/openclaw/tool-registration.test.js tests/openclaw/ambient-music-build.test.js tests/openclaw/ambient-media-render.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `openclaw/index.js`.

**Step 3: Write minimal implementation**

```js
export function registerAmbientTools(api) {
  api.registerTool({
    name: "ambient_music_build",
    description: "Generate or plan a short ambient music master",
    async execute() {
      return {
        content: [{ type: "text", text: "ambient_music_build planned" }]
      };
    }
  });

  api.registerTool({
    name: "ambient_media_render",
    description: "Extend audio, loop video, and export a final MP4",
    async execute() {
      return {
        content: [{ type: "text", text: "ambient_media_render planned" }]
      };
    }
  });
}

export default {
  id: "ambient-media-tools",
  name: "Ambient Media Tools",
  description: "OpenClaw helpers for ambient longform media generation",
  register(api) {
    registerAmbientTools(api);
  }
};
```

Then replace the placeholder execution branches with real calls into:

- `loadThemeRegistry`
- `createJobWorkspace`
- `buildMusicPrompt`
- `resolveMusicProvider`
- `buildRenderPlan`
- `writeManifest`

Keep tool return values structured and deterministic.

Keep the plugin boundary strict:

- skill layer handles free-text parsing
- plugin layer accepts normalized ids and parameters
- plugin layer does not implement fuzzy NLP matching

**Step 4: Run tests to verify they pass**

Run: `node --test tests/openclaw/tool-registration.test.js tests/openclaw/ambient-music-build.test.js tests/openclaw/ambient-media-render.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add openclaw/index.js tests/openclaw/tool-registration.test.js tests/openclaw/ambient-music-build.test.js tests/openclaw/ambient-media-render.test.js
git commit -m "feat: add ambient media OpenClaw tools"
```

### Task 7: Add The Local Skill And Skill Validation

**Files:**
- Create: `skills/ambient-video-maker/SKILL.md`
- Create: `skills/ambient-video-maker/references/workflow.md`
- Test: `tests/skills/ambient-video-maker.test.js`

**Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("ambient-video-maker skill references the plugin tools and trigger phrases", () => {
  const body = fs.readFileSync(new URL("../../skills/ambient-video-maker/SKILL.md", import.meta.url), "utf8");
  assert.match(body, /ambient_music_build/);
  assert.match(body, /ambient_media_render/);
  assert.match(body, /睡眠/);
  assert.match(body, /钢琴/);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/skills/ambient-video-maker.test.js`

Expected: FAIL with `ENOENT` for `skills/ambient-video-maker/SKILL.md`.

**Step 3: Write minimal implementation**

```md
---
name: ambient-video-maker
description: Generate long ambient video outputs from a theme using ambient_music_build and ambient_media_render.
---
```

Then expand the skill so it:

- detects theme, style, and duration
- resolves to a configured theme id
- uses aliases and keywords when matching user text
- asks one concise clarification question if confidence is too low
- calls `ambient_music_build` first
- calls `ambient_media_render` second
- returns final output path and manifest path

Keep a short `references/workflow.md` with one happy-path example and one fallback example.

**Step 4: Run test to verify it passes**

Run: `node --test tests/skills/ambient-video-maker.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add skills/ambient-video-maker/SKILL.md skills/ambient-video-maker/references/workflow.md tests/skills/ambient-video-maker.test.js
git commit -m "feat: add ambient video maker skill"
```

### Task 8: Add A Local Smoke Script And End-To-End Verification

**Files:**
- Create: `scripts/smoke-local-render.sh`
- Create: `tests/smoke/local-render-smoke.test.js`

**Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("smoke-local-render script exits successfully", () => {
  const result = spawnSync("bash", ["scripts/smoke-local-render.sh"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SMOKE_OK/);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/smoke/local-render-smoke.test.js`

Expected: FAIL with missing script error.

**Step 3: Write minimal implementation**

```bash
#!/usr/bin/env bash
set -euo pipefail

mkdir -p outputs
ffmpeg -y -f lavfi -i color=c=black:s=1280x720:d=3 -f lavfi -i anullsrc=r=44100:cl=stereo -shortest outputs/smoke.mp4
echo "SMOKE_OK outputs/smoke.mp4"
```

Then evolve the script so it exercises the real local pipeline:

1. create a job workspace
2. use the plugin in `mock` mode to build a short master
3. render a short final MP4 with `default-black`
4. use `ffprobe` to verify duration, stream counts, and readable codecs
5. verify that `outputs/*.mp4` and `jobs/*/manifest.json` exist

**Step 4: Run test to verify it passes**

Run: `node --test tests/smoke/local-render-smoke.test.js`

Expected: PASS.

Then run the full suite:

Run: `npm test`

Expected: PASS with all `node:test` suites green.

**Step 5: Commit**

```bash
git add scripts/smoke-local-render.sh tests/smoke/local-render-smoke.test.js
git add src openclaw skills config assets package.json openclaw.plugin.json README.md
git commit -m "feat: ship ambient longform video generator mvp"
```

## Verification Checklist

- `node --test tests/openclaw/plugin-bootstrap.test.js`
- `node --test tests/lib/theme-registry.test.js`
- `node --test tests/lib/jobs.test.js`
- `node --test tests/lib/music-prompt.test.js tests/lib/music-provider.test.js`
- `node --test tests/lib/render-plan.test.js tests/lib/ffmpeg-commands.test.js`
- `node --test tests/openclaw/tool-registration.test.js tests/openclaw/ambient-music-build.test.js tests/openclaw/ambient-media-render.test.js`
- `node --test tests/skills/ambient-video-maker.test.js`
- `node --test tests/smoke/local-render-smoke.test.js`
- `npm test`

## Notes For Execution

- Keep the first vertical slice shippable with `mock` music generation plus real local render, then wire `infsh` after the unit boundaries are stable.
- Do not add a database, API server, or queue in this phase.
- Do not block MVP on real visual assets beyond procedural templates such as `default-black`, `soft-stars`, and `gradient-drift`.
- Do not add preview mode in this phase.
- Do not design for concurrent generation beyond unique job ids; MVP runs are expected to be serial.
