# GCP GCE Deployment

## Recommendation

For the current app, use a single `Compute Engine` VM instead of `Cloud Run`.

Why:

- jobs run for minutes, not milliseconds
- the app depends on local filesystem state under `jobs/` and `outputs/`
- `ffmpeg` is part of the critical path
- bundled VFX overlays are easiest to manage from mounted disk

## Suggested Host Layout

Use a stable directory layout on the VM:

```text
/opt/ambient-video/app
/opt/ambient-video/shared/vfx
```

The repository lives under `/opt/ambient-video/app`. Large shared VFX artifacts stay outside the git checkout.

Current code still writes jobs and outputs under the repository root:

```text
/opt/ambient-video/app/jobs
/opt/ambient-video/app/outputs
```

If you want those on a larger disk, mount storage there or replace those folders with symlinks.

## Provision The VM

Suggested baseline:

- Ubuntu 24.04 LTS
- 4 vCPU
- 16 GB RAM
- persistent disk sized for generated outputs and VFX frames

Install runtime packages:

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg git curl
```

Install Node.js 22 and npm using your preferred setup, then confirm:

```bash
node --version
npm --version
ffmpeg -version
ffprobe -version
```

## Deploy The App

Clone the repository:

```bash
sudo mkdir -p /opt/ambient-video
sudo chown "$USER":"$USER" /opt/ambient-video
git clone git@github.com:Anticlimax/video-generator.git /opt/ambient-video/app
cd /opt/ambient-video/app
npm install
npm run build
```

## Production Environment

Copy [`.env.production.example`](/Users/liyang/project/video-generate/.env.production.example) to `.env.production` and fill the real values.

At minimum, configure:

- `GEMINI_API_KEY`
- `MUSICGPT_API_KEY` or the provider you intend to use
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`
- `VFX_ASSET_ROOT=/opt/ambient-video/shared/vfx`

Recommended image settings:

- `GEMINI_IMAGE_PRIMARY_MODEL=gemini-3-pro-image-preview`
- `GEMINI_IMAGE_FALLBACK_MODEL=gemini-2.5-flash-image`
- `GEMINI_IMAGE_MAX_ATTEMPTS=1`
- `COVER_GENERATION_ATTEMPT_TIMEOUT_MS=120000`
- `COVER_GENERATION_TIMEOUT_MS=240000`

If you want real rain overlays, copy the registered frame sequences into:

```text
/opt/ambient-video/shared/vfx/RainOnGlass-004
/opt/ambient-video/shared/vfx/Rain-022
```

## Verify Before Start

Run the built-in self-check:

```bash
cd /opt/ambient-video/app
./scripts/verify-web-runtime.sh
```

## Start The App

Do not use `next dev` in production.

Use:

```bash
cd /opt/ambient-video/app
PORT=3334 npm run start
```

For a real deploy, run it under `systemd`. A starter unit file is included at:

- [ambient-video-studio.service](/Users/liyang/project/video-generate/deploy/systemd/ambient-video-studio.service)

## systemd Setup

Copy the unit file to the VM:

```bash
sudo cp deploy/systemd/ambient-video-studio.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ambient-video-studio
sudo systemctl start ambient-video-studio
```

Then check status:

```bash
sudo systemctl status ambient-video-studio
journalctl -u ambient-video-studio -f
```

## Reverse Proxy

Optional but recommended:

- put nginx in front of port `3334`
- restrict access with VPN, IP allowlist, or basic auth
- add HTTPS once you attach a domain

## Notes

- This is still a single-machine deployment.
- `jobs/` and `outputs/` should stay on persistent disk.
- The scheduler and job runner are designed for a single process host right now.
- If you later split worker and web roles, keep the shared directories or replace them with explicit storage services.
