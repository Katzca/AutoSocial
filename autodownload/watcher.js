/**
 * TikTok Auto-Downloader -> Auto-Post Pipeline
 *
 * Polls a TikTok channel on a schedule. When new videos are found,
 * downloads them and copies into each platform's queue folder so the
 * existing scheduler automatically posts them.
 *
 * Config is read from .env (WATCH_CHANNEL, WATCH_INTERVAL, etc.)
 * CLI flags override env: --channel, --interval, --max, --account
 *
 * Usage:
 *   node autodownload/watcher.js
 *   node autodownload/watcher.js --channel "@someone" --interval 5
 *   node autodownload/watcher.js --account default
 */

const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");

// Load .env from project root
const { config } = require("../src/config");
const {
    getActiveAccount,
    getAccountQueueDirs,
    ensureAccountDirs,
} = require("../src/account-manager");
const { resolveYtDlpExecutable } = require("../src/yt-dlp-utils");

const args = process.argv.slice(2);

function getArg(name, fallback) {
    const idx = args.indexOf(`--${name}`);
    const val = idx !== -1 ? args[idx + 1] : undefined;
    if (!val || val.startsWith("--")) return fallback;
    return val;
}

const CHANNEL = getArg("channel", config.autoDownload.channel);
const INTERVAL = parseInt(getArg("interval", String(config.autoDownload.interval)), 10);
const MAX_VIDEOS = parseInt(getArg("max", String(config.autoDownload.maxVideos)), 10);
const MIN_VIEWS = parseInt(getArg("min-views", String(config.autoDownload.minViews || 0)), 10);
const PLATFORMS = config.autoDownload.platforms;
const ACCOUNT_ARG = getArg("account", process.env.ACCOUNT_ID || "");

const BASE_DIR = __dirname;
const YT_DLP = resolveYtDlpExecutable(path.resolve(BASE_DIR, "..")).path;
const DOWNLOADS = path.join(BASE_DIR, "downloads");
const ARCHIVE = path.join(BASE_DIR, "archive.txt");

const CHANNEL_URL = CHANNEL.startsWith("http")
    ? CHANNEL
    : `https://www.tiktok.com/${CHANNEL}`;

function log(msg) {
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] ${msg}`);
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getPlatformQueueMap(accountId) {
    const queueDirs = getAccountQueueDirs(accountId);
    return {
        tiktok: queueDirs.tiktok.pending,
        instagram: queueDirs.instagram.pending,
        youtube: queueDirs.youtube.pending,
    };
}

async function resolveAccountId() {
    const requestedAccountId = String(ACCOUNT_ARG || "").trim();
    if (requestedAccountId) {
        return requestedAccountId;
    }
    const activeAccount = await getActiveAccount();
    return activeAccount.id;
}

/**
 * Copy a downloaded video into each platform's pending queue.
 * We copy (not move) so the original stays in downloads/ as a record.
 */
async function distributeToQueues(videoPath, accountId) {
    const filename = path.basename(videoPath);
    const parsed = path.parse(videoPath);
    const platformQueues = getPlatformQueueMap(accountId);

    const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm", ".avi", ".mkv"]);
    if (!VIDEO_EXTS.has(parsed.ext.toLowerCase())) {
        log(`  Skipping non-video file distribution: ${filename}`);
        return;
    }

    const descriptionPath = path.join(parsed.dir, `${parsed.name}.description`);
    let captionText = "";
    try {
        captionText = (await fsp.readFile(descriptionPath, "utf-8")).trim();
        if (captionText) {
            log(`  Found original caption (${captionText.length} chars)`);
        }
    } catch {
        // No description file.
    }

    for (const platform of PLATFORMS) {
        const queueDir = platformQueues[platform];
        if (!queueDir) {
            log(`  Unknown platform "${platform}", skipping.`);
            continue;
        }

        ensureDir(queueDir);
        const dest = path.join(queueDir, filename);

        try {
            await fsp.copyFile(videoPath, dest);
            if (captionText) {
                const captionDest = path.join(queueDir, `${parsed.name}.txt`);
                await fsp.writeFile(captionDest, captionText, "utf-8");
            }
            log(`  Queued for ${platform.toUpperCase()} -> ${dest} (account: ${accountId})`);
        } catch (err) {
            log(`  Failed to queue for ${platform}: ${err.message}`);
        }
    }
}

function runYtDlp() {
    return new Promise((resolve) => {
        const dlArgs = [
            "--no-warnings",
            "--write-description",
            "-S", "vcodec:h264,res,acodec",
            "--playlist-items", `1:${MAX_VIDEOS}`,
            "--download-archive", ARCHIVE,
            "-o", path.join(DOWNLOADS, "%(uploader)s", "%(upload_date)s_%(id)s.%(ext)s"),
        ];

        if (MIN_VIEWS > 0) {
            dlArgs.push("--match-filter", `view_count >= ${MIN_VIEWS}`);
        }

        dlArgs.push(CHANNEL_URL);

        log(`Checking ${CHANNEL_URL} for new videos...`);

        execFile(YT_DLP, dlArgs, { timeout: 180_000 }, (err, stdout, stderr) => {
            if (stdout) {
                const lines = stdout.trim().split("\n");
                lines.forEach((line) => log(`  yt-dlp: ${line}`));
            }
            if (err) {
                if (err.code === 101 || (stderr && stderr.includes("has already been recorded"))) {
                    log("No new videos found.");
                    return resolve([]);
                }
                log(`yt-dlp error: ${err.message}`);
                return resolve([]);
            }

            const downloaded = [];
            if (stdout) {
                const matches = stdout.matchAll(/\[download\] Destination: (.+)/g);
                for (const match of matches) {
                    downloaded.push(match[1].trim());
                }
                const mergeMatches = stdout.matchAll(/\[Merger\] Merging formats into "(.+)"/g);
                for (const match of mergeMatches) {
                    downloaded.push(match[1].trim());
                }
            }

            resolve(downloaded);
        });
    });
}

async function poll(accountId) {
    const newFiles = await runYtDlp();

    if (newFiles.length > 0) {
        log(`${newFiles.length} new video(s) downloaded. Distributing to queues...`);
        for (const filePath of newFiles) {
            log(`  Processing: ${path.basename(filePath)}`);
            await distributeToQueues(filePath, accountId);
        }
        log("Distribution complete.");
    }
}

async function main() {
    const accountId = await resolveAccountId();
    await ensureAccountDirs(accountId);
    ensureDir(DOWNLOADS);

    const platformList = PLATFORMS.map((platform) => platform.toUpperCase()).join(", ");

    log("Auto-Download -> Auto-Post Pipeline");
    log(`Channel:    ${CHANNEL_URL}`);
    log(`Interval:   Every ${INTERVAL} minutes`);
    log(`Max check:  Last ${MAX_VIDEOS} videos per poll`);
    log(`Min views:  ${MIN_VIEWS > 0 ? MIN_VIEWS : "None"}`);
    log(`Post to:    ${platformList}`);
    log(`Account:    ${accountId}`);
    log(`Downloads:  ${DOWNLOADS}`);
    log(`Archive:    ${ARCHIVE}`);

    await poll(accountId);

    setInterval(() => {
        poll(accountId).catch((error) => {
            log(`Poll error: ${error.message}`);
        });
    }, INTERVAL * 60 * 1000);

    log(`Next check in ${INTERVAL} minutes. Press Ctrl+C to stop.`);
}

main().catch((error) => {
    log(`Fatal error: ${error.message}`);
    process.exitCode = 1;
});
