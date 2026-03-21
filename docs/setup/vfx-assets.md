# VFX Assets

This app uses a small registry for bundled motion and overlay assets.

## Registry

The registry lives in [src/core/media/vfx-assets.js](/Users/liyang/project/video-generate/src/core/media/vfx-assets.js).

It currently documents:

- `rain-on-glass-004`
- `rain-022`

Each entry records:

- a stable asset id
- the folder name under the asset root
- the frame pattern
- the frame rate
- whether the source includes alpha
- the recommended overlay opacity
- the motion preset it fits best

## Asset Root

The runtime looks for bundled VFX assets under:

- `assets/vfx`

You can override that with:

- `VFX_ASSET_ROOT`

Example layout:

```text
assets/vfx/RainOnGlass-004/RainOnGlass-004.1001.exr
assets/vfx/Rain-022/Rain-022.1001.exr
```

## Current Recommendation

- Use `rain-on-glass-004` as the default rain overlay asset.
- Keep `rain-022` as a fallback screen-key style rain asset.

## Runtime Check

Run the web runtime self-check before deploy:

```bash
./scripts/verify-web-runtime.sh
```

The check verifies:

- `node`, `npm`, `ffmpeg`, and `ffprobe`
- the VFX asset root
- the bundled rain overlay frame sequences
- write access to `jobs/` and `outputs/`

