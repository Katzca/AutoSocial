# Scheduling, covers, YouTube metadata and upload fixes

Summary of the changes in this fork. They came from using AutoSocial Studio daily
for one Turkish-language channel on YouTube, Instagram and TikTok.

## New features

### Native scheduling (YouTube, TikTok)

Put a `<video>.schedule` file next to the video, containing `YYYY-MM-DD HH:MM` in
the configured `TZ`. The video is scheduled with the platform's own scheduler, so
the computer can be off after the upload finishes. This is separate from the
existing local cron scheduler.

Instagram has no scheduling on the web. An Instagram queue item with a `.schedule`
file now fails instead of publishing immediately.

### Cover images (all three platforms)

Put a `<video>.cover.jpg` file next to the video. It is uploaded through each
platform's own cover or thumbnail control.

### YouTube metadata

- `<video>.title`: title, separate from the description.
- `<video>.tags`: comma-separated tags, added to the channel defaults.
- `<video>.category`: category name as shown in the Studio UI.
- The altered-content question is answered "No".

All sidecars are parsed in `src/schedule-sidecar.js` and archived with the video.

### Visibility and test settings

| Variable | Purpose |
|---|---|
| `YOUTUBE_VISIBILITY` | `public` (default), `unlisted` or `private`, for uploads without a schedule |
| `TIKTOK_VISIBILITY` | `private` selects "Only you", for uploads without a schedule |
| `BROWSER_CHANNEL` | Playwright channel, e.g. `chrome`, for machines where bundled Chromium does not start |
| `YOUTUBE_DRY_RUN`, `TIKTOK_DRY_RUN`, `INSTAGRAM_DRY_RUN` | Stop right before the final publish click |
| `YOUTUBE_DEBUG`, `TIKTOK_DEBUG`, `INSTAGRAM_DEBUG` | Write step screenshots, some with an HTML dump |

These variables are documented in `.env.example` and `README.md`.

## Safety checks

The run stops without publishing when:

- the date or time on screen differs from the requested one;
- the main button does not say Schedule (on TikTok, "Post" publishes immediately);
- a schedule file is invalid, in the past, or under 20 minutes away;
- the Instagram preview is not 9:16;
- YouTube tags or category were not applied, or the thumbnail was rejected;
- the TikTok caption on screen differs from the intended text.

## Bug fixes

### TikTok

- Overlay dismissal clicked any "Cancel" button, which cancelled uploads in progress. Removed.
- Overlay dismissal could click "Turn on" on the automatic content checks prompt. Removed; the prompt is now cancelled.
- Upload completion is now detected from the progress card and its Cancel button.
- An unsaved-draft banner from an earlier aborted run is discarded, and the cookie banner is declined.

### Instagram

- The Create flow could open the Reels tab instead of the upload dialog. It now uses the sidebar icon and the Post menu item.
- The notifications prompt and the "shared as reels" notice no longer block the flow.
- The crop is set to Original. Before this, videos could be published as a 1:1 crop.
- The publish confirmation wait went from 90 seconds to 5 minutes, because slow shares were reported as failures after they had succeeded.

### YouTube

- The wizard waits for the upload to finish before the final click, so closing the browser does not cut it off.

### Other

- Turkish UI labels added to `src/platform-ui-labels.js`.
- `npm audit fix` applied to the lockfile (body-parser, proxy-addr, qs).

## Testing

Tested by hand on Windows 10 with Chrome, on one account:

- **YouTube and TikTok:** a test video was really scheduled, and it appeared in each
  Studio list with the right date and cover. Its title and description showed in
  the lists too. On YouTube, tags, category and the altered-content answer were
  checked on screen during the upload.
- **Instagram:** one real Reel was published before cover support existed. Cover
  upload was only seen in a dry run, so the cover on a published Reel is not verified.

Selectors were checked with
Turkish account UIs and English browser locale; other languages are untested.

## Known limitations

- No automated tests were added for the new upload steps; they depend on live platform pages.
- `npm test` passes (22 tests), including the English-only check. It was run in a temporary git copy.
- Date parsing in YouTube scheduling assumes Turkish short month names. An account in another language stops at the date guard instead of publishing.
