# AutoSocial Studio Setup Guide

This guide walks through a fresh local setup for AutoSocial Studio.

## Prerequisites

- Node.js 18+
- npm
- Git
- FFmpeg and ffprobe in `PATH`
- Playwright Chromium
- Optional: yt-dlp for downloader features

## 1. Clone and Install

```bash
git clone https://github.com/Katzca/AutoSocial.git
cd AutoSocial
npm ci
npx playwright install chromium
```

Run the environment check:

```bash
npm run doctor
```

`yt-dlp` is optional. If the doctor reports it as missing, only the downloader
features are affected.

## 2. Add FFmpeg and yt-dlp for Downloader Features

AutoSocial Studio runs cross-platform on **macOS**, **Linux**, and **Windows**.

- **macOS**:
  ```bash
  brew install ffmpeg yt-dlp
  ```
- **Linux (Ubuntu/Debian)**:
  ```bash
  sudo apt update && sudo apt install -y ffmpeg yt-dlp
  ```
- **Windows**:
  Install FFmpeg and add it to `PATH`. Place the `yt-dlp.exe` binary in `autodownload/yt-dlp.exe` (or install via winget / PATH).

You can also place platform binaries directly into `autodownload/`:
- Windows: `autodownload/yt-dlp.exe`
- macOS / Linux: `autodownload/yt-dlp`

## 3. Create `.env`

```bash
cp .env.example .env
```
*(On Windows Command Prompt: `copy .env.example .env`)*

Important settings:

- `TZ`
- `BROWSER_LOCALE`
- `CRON_EXPRESSION`, `INSTAGRAM_CRON_EXPRESSION`, `YOUTUBE_CRON_EXPRESSION`
- `DEFAULT_CAPTION`
- `WATCH_CHANNEL`, `WATCH_INTERVAL`, `WATCH_MAX_VIDEOS`, `WATCH_MIN_VIEWS`
- `AUTO_POST_PLATFORMS`
- `HEADLESS`
- `AUTO_ADD_SOUND`
- `RANDOM_QUEUE_ORDER`
- `DASHBOARD_HOST`, `DASHBOARD_PORT`

Hashtag captions must be quoted:

```env
DEFAULT_CAPTION="#mybrand #shorts"
```

## 4. Start the Dashboard

```bash
npm run dashboard
```

Open http://127.0.0.1:3000.

Start with the `Setup` view. It shows local dependency checks, saved platform
sessions, and the exact pending folders for the active brand.

The dashboard controls:

- First-run setup and health checks
- Account switching
- Platform login sessions
- TikTok, Instagram, and YouTube schedulers
- Queue status and logs
- Auto-download management
- Profile downloads
- Video uniquifier runs

## 5. Create or Select Accounts

Use the brand/account switcher in the dashboard sidebar.

Each account gets separate runtime directories:

```text
queue/<account>/<platform>/{pending,posted,failed}
.profiles/<account>/<platform>
.scheduler-state/<account>/
```

The active account is tracked in `accounts-state.json`, which is ignored by Git.

## 6. Log In to Platforms

Open the `Accounts` view and start a login session for each platform.

- TikTok: `.profiles/<account>/tiktok`
- Instagram: `.profiles/<account>/instagram`
- YouTube: `.profiles/<account>/youtube`

Sessions persist across restarts.

## 7. Queue Videos

Place video files into the pending folder for the account and platform:

```text
queue/default/tiktok/pending
queue/default/instagram/pending
queue/default/youtube/pending
```

Supported video files:

- `.mp4`
- `.mov`
- `.webm`
- `.avi`
- `.mkv`

Optional caption sidecars:

- `.description`
- `.txt`

## 8. Configure Posting

From each platform view in the dashboard you can:

- Run one post immediately
- Set a cron expression
- Use daily posting times
- Enable or disable instant-post mode
- Start or stop the scheduler

Schedule settings persist, but scheduler processes do not auto-start after an
app restart. Start them again from the dashboard.

## Optional Subsystems

### Auto Download

The auto-download watcher polls a TikTok channel through yt-dlp, downloads new
videos, and copies them into pending queues for selected platforms.

Dashboard-managed watcher: use the `Auto Download` view.

Standalone watcher:

```bash
npm run autodownload
```

### Profile Downloader

The profile downloader saves videos into `autodownload/profile_downloads`
without auto-queueing them. It can scan channels, filter by views, and collect
slideshow/image assets where available.

### Video Uniquifier

The uniquifier runs FFmpeg recipes against videos in an input folder and writes
modified outputs to a separate folder. It is available from the dashboard and
from the CLI.

Logo overlay is optional. Put your own logo in `user-assets/` or point to any
local image path, then enter it in the dashboard's `Logo Image` field before
starting a batch. You can also set `UNIQUIFY_LOGO_IMAGE` in `.env`. Leave it
empty to run without a logo overlay.

## CLI Reference

```bash
npm run dashboard
npm run clean:debug
npm run doctor
npm run check
npm run login
npm run post
npm run daemon
npm run uniquify
npm run video-info -- --video "C:\path\video.mp4"
npm run autodownload
```

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `CRON_EXPRESSION` | `0 */2 * * *` | TikTok scheduler cron expression |
| `INSTAGRAM_CRON_EXPRESSION` | `0 */2 * * *` | Instagram scheduler cron expression |
| `YOUTUBE_CRON_EXPRESSION` | `0 */2 * * *` | YouTube scheduler cron expression |
| `TZ` | `UTC` | Timezone used by scheduler logic |
| `BROWSER_LOCALE` | `en-US` | Locale used by Playwright browser contexts that need an explicit locale |
| `HEADLESS` | `false` | Run Playwright in headless mode |
| `POST_DELAY_MS` | `15000` | Delay after file upload before publish steps continue |
| `POST_PUBLISH_HOLD_MS` | `25000` | Keep browser open after a successful post |
| `FAILURE_HOLD_MS` | `8000` | Keep browser open after a failure for inspection |
| `AUTO_ADD_SOUND` | `false` | Try to add a TikTok sound before publishing |
| `DEFAULT_SOUND_QUERY` | empty | Optional TikTok sound search query |
| `RANDOM_QUEUE_ORDER` | `false` | Pick a random pending file instead of alphabetic order |
| `DEFAULT_CAPTION` | empty | Caption fallback when no sidecar caption exists |
| `WATCH_CHANNEL` | empty | TikTok account watched by auto-download |
| `WATCH_INTERVAL` | `10` | Minutes between auto-download checks |
| `WATCH_MAX_VIDEOS` | `5` | Number of recent videos checked per poll |
| `WATCH_MIN_VIEWS` | `0` | Minimum views filter for downloader flows |
| `AUTO_POST_PLATFORMS` | `tiktok,instagram,youtube` | Platforms that receive copied downloads |
| `UNIQUIFY_INPUT_DIR` | `queue/uniquify-input` | Default dashboard input folder for uniquifier |
| `UNIQUIFY_OUTPUT_DIR` | `queue/uniquify-output` | Default dashboard output folder for uniquifier |
| `UNIQUIFY_LOGO_IMAGE` | empty | Optional default logo image used by uniquifier |
| `DASHBOARD_HOST` | `127.0.0.1` | Dashboard bind host |
| `DASHBOARD_PORT` | `3000` | Dashboard bind port |
| `DASHBOARD_ALLOW_REMOTE` | `false` | Allow non-local dashboard bind host |
| `TIKTOK_UPLOAD_URL` | `https://www.tiktok.com/tiktokstudio/upload` | TikTok upload page override |
| `INSTAGRAM_UPLOAD_URL` | `https://www.instagram.com/create/style/` | Instagram upload page override |
| `YOUTUBE_UPLOAD_URL` | `https://studio.youtube.com` | YouTube Studio upload page override |

## Troubleshooting

- `npm run doctor` fails for FFmpeg: install FFmpeg and add it to PATH.
- `Playwright Chromium missing`: run `npx playwright install chromium`.
- `yt-dlp missing`: add `autodownload/yt-dlp.exe` or skip downloader features.
- `No session found`: open the dashboard and log in for that platform.
- Upload opens but does not finish: inspect `last-*.png` and dashboard logs.
- Stale debug screenshots/logs: run `npm run clean:debug`.
- Schedule looks saved but nothing posts after restart: start the scheduler again.
- Dashboard refuses remote bind: use `DASHBOARD_HOST=127.0.0.1` or explicitly set `DASHBOARD_ALLOW_REMOTE=true`.

## Open Source Publishing Checklist

Before publishing a fork:

- Confirm `.env`, profiles, queues, screenshots, state files, and downloader
  metadata are not committed.
- Run `npm run check`.
- Run `npm audit --omit=dev`.
- Review `SECURITY.md`.
- If sensitive files were ever committed, scrub Git history or publish from a
  fresh repository.
