/**
 * AutoDownloadController
 *
 * Wraps autodownload/watcher.js logic into a dashboard-manageable controller.
 * Supports start/stop, live logs, and runtime configuration of channel,
 * interval, and max-videos. State is persisted to autodownload-state.json.
 */

const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { config } = require("./config");
const { getActiveAccount, getAccountQueueDirs, ensureAccountDirs } = require("./account-manager");
const { resolveYtDlpExecutable } = require("./yt-dlp-utils");

function nowIso() {
    return new Date().toISOString();
}

function ensureDir(dir) {
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
}

class AutoDownloadController {
    constructor() {
        this.channel = config.autoDownload.channel || "";
        this.interval = config.autoDownload.interval || 10;
        this.maxVideos = config.autoDownload.maxVideos || 5;
        this.minViews = config.autoDownload.minViews || 0;
        this.platforms = config.autoDownload.platforms || ["tiktok"];
        this.accountId = "default";
        this.running = false;
        this.isDownloading = false;
        this.lastCheckAt = null;
        this.totalDownloaded = 0;
        this.logs = [];
        this._timer = null;

        this.baseDir = path.resolve(config.projectRoot, "autodownload");
        this.ytDlp = resolveYtDlpExecutable().path;
        this.downloadsDir = path.join(this.baseDir, "downloads");
        this.archivePath = path.join(this.baseDir, "archive.txt");
        this.statePath = path.resolve(config.projectRoot, "autodownload-state.json");

        this._loadState();
    }

    _loadState() {
        try {
            const data = fsSync.readFileSync(this.statePath, "utf-8");
            const state = JSON.parse(data);
            if (state.channel) this.channel = state.channel;
            if (state.interval) this.interval = state.interval;
            if (state.maxVideos) this.maxVideos = state.maxVideos;
            if (state.minViews !== undefined) this.minViews = state.minViews;
            if (Array.isArray(state.platforms) && state.platforms.length) {
                this.platforms = state.platforms;
            }
            if (state.accountId) {
                this.accountId = state.accountId;
            }
        } catch {
            // Ignore missing state file.
        }
    }

    async _saveState() {
        try {
            await fs.writeFile(
                this.statePath,
                JSON.stringify(
                    {
                        channel: this.channel,
                        interval: this.interval,
                        maxVideos: this.maxVideos,
                        minViews: this.minViews,
                        platforms: this.platforms,
                        accountId: this.accountId,
                    },
                    null,
                    2
                )
            );
        } catch (err) {
            this.log(`Failed to save state: ${err.message}`, "error");
        }
    }

    log(message, level = "info") {
        const entry = { at: nowIso(), level, message };
        this.logs.unshift(entry);
        this.logs = this.logs.slice(0, 120);
        const prefix = `[${entry.at}] [autodownload]`;
        if (level === "error") {
            console.error(`${prefix} ${message}`);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }

    async configure({ channel, interval, maxVideos, minViews, platforms, accountId }) {
        if (channel !== undefined) this.channel = String(channel).trim();
        if (interval !== undefined) {
            const n = parseInt(interval, 10);
            if (isNaN(n) || n < 1) throw new Error("Interval must be at least 1 minute.");
            this.interval = n;
        }
        if (maxVideos !== undefined) {
            const n = parseInt(maxVideos, 10);
            if (isNaN(n) || n < 1) throw new Error("Max videos must be at least 1.");
            this.maxVideos = n;
        }
        if (minViews !== undefined) {
            const n = parseInt(minViews, 10);
            if (isNaN(n) || n < 0) throw new Error("Min views must be 0 or greater.");
            this.minViews = n;
        }
        if (platforms !== undefined && Array.isArray(platforms)) {
            this.platforms = platforms;
        }
        if (accountId !== undefined && String(accountId).trim()) {
            this.accountId = String(accountId).trim();
        }

        await this._saveState();
        this.log(
            `Configuration updated - channel: ${this.channel}, interval: ${this.interval}m, max: ${this.maxVideos}, minViews: ${this.minViews}, account: ${this.accountId}`
        );

        if (this.running) {
            this.stop();
            await this.start({ accountId: this.accountId });
        }
        return { ok: true };
    }

    async start(options = {}) {
        if (this.running) return { ok: true, alreadyRunning: true };
        if (!this.channel) {
            throw new Error("No channel configured. Set a TikTok username first.");
        }

        if (options.accountId) {
            this.accountId = String(options.accountId).trim();
        }
        if (!this.accountId) {
            const activeAccount = await getActiveAccount();
            this.accountId = activeAccount.id;
        }

        await ensureAccountDirs(this.accountId);
        await this._saveState();

        this.running = true;
        ensureDir(this.downloadsDir);

        const platformList = this.platforms.map((p) => p.toUpperCase()).join(", ");
        this.log(
            `Watcher started - channel: ${this._channelUrl()}, every ${this.interval}m, posting to: ${platformList}, account: ${this.accountId}`
        );

        this._poll();
        this._timer = setInterval(() => this._poll(), this.interval * 60 * 1000);

        return { ok: true, alreadyRunning: false, accountId: this.accountId };
    }

    stop() {
        if (!this.running) return { ok: true, alreadyStopped: true };
        clearInterval(this._timer);
        this._timer = null;
        this.running = false;
        this.log("Watcher stopped.");
        return { ok: true, alreadyStopped: false };
    }

    _getPlatformQueueMap() {
        const queueDirs = getAccountQueueDirs(this.accountId || "default");
        return {
            tiktok: queueDirs.tiktok.pending,
            instagram: queueDirs.instagram.pending,
            youtube: queueDirs.youtube.pending,
        };
    }

    _channelUrl() {
        const ch = this.channel;
        return ch.startsWith("http") ? ch : `https://www.tiktok.com/${ch}`;
    }

    async _poll() {
        if (this.isDownloading) {
            this.log("Skipping poll - previous download still in progress.");
            return;
        }
        this.isDownloading = true;
        this.lastCheckAt = nowIso();

        try {
            const newFiles = await this._runYtDlp();
            if (newFiles.length > 0) {
                this.log(`${newFiles.length} new video(s) downloaded. Distributing to queues...`);
                for (const filePath of newFiles) {
                    this.log(`  Processing: ${path.basename(filePath)}`);
                    await this._distributeToQueues(filePath);
                }
                this.totalDownloaded += newFiles.length;
                this.log("Distribution complete.");
            }
        } catch (err) {
            this.log(`Poll error: ${err.message}`, "error");
        } finally {
            this.isDownloading = false;
            if (this.running) {
                this.log(`Next check in ${this.interval} minutes.`);
            }
        }
    }

    _runYtDlp() {
        return new Promise((resolve) => {
            const dlArgs = [
                "--no-warnings",
                "--write-description",
                "-S", "vcodec:h264,res,acodec",
                "--playlist-items",
                `1:${this.maxVideos}`,
                "--download-archive",
                this.archivePath,
                "-o",
                path.join(this.downloadsDir, "%(uploader)s", "%(upload_date)s_%(id)s.%(ext)s")
            ];

            if (this.minViews > 0) {
                dlArgs.push("--match-filter", `view_count >= ${this.minViews}`);
            }

            dlArgs.push(this._channelUrl());

            this.log(`Checking ${this._channelUrl()} for new videos...`);

            execFile(this.ytDlp, dlArgs, { timeout: 180_000 }, (err, stdout, stderr) => {
                if (stdout) {
                    const lines = stdout.trim().split("\n");
                    lines.forEach((line) => this.log(`  yt-dlp: ${line}`));
                }
                if (err) {
                    if (err.code === 101 || (stderr && stderr.includes("has already been recorded"))) {
                        this.log("No new videos found.");
                        return resolve([]);
                    }
                    this.log(`yt-dlp error: ${err.message}`, "error");
                    return resolve([]);
                }

                const downloaded = [];
                if (stdout) {
                    const destMatches = stdout.matchAll(/\[download\] Destination: (.+)/g);
                    for (const match of destMatches) downloaded.push(match[1].trim());
                    const mergeMatches = stdout.matchAll(/\[Merger\] Merging formats into "(.+)"/g);
                    for (const match of mergeMatches) downloaded.push(match[1].trim());
                }

                resolve(downloaded);
            });
        });
    }

    async _distributeToQueues(videoPath) {
        const filename = path.basename(videoPath);
        const parsed = path.parse(videoPath);

        const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm", ".avi", ".mkv"]);
        if (!VIDEO_EXTS.has(parsed.ext.toLowerCase())) {
            this.log(`  Skipping non-video file distribution: ${filename}`);
            return;
        }

        const descriptionPath = path.join(parsed.dir, `${parsed.name}.description`);
        let captionText = "";
        try {
            captionText = await fs.readFile(descriptionPath, "utf-8");
            captionText = captionText.trim();
            if (captionText) {
                this.log(`  Found original caption (${captionText.length} chars)`);
            }
        } catch {
            // No description file - upload time will fall back to DEFAULT_CAPTION.
        }

        const platformQueues = this._getPlatformQueueMap();

        for (const platform of this.platforms) {
            const queueDir = platformQueues[platform];
            if (!queueDir) {
                this.log(`  Unknown platform "${platform}", skipping.`);
                continue;
            }

            ensureDir(queueDir);
            const dest = path.join(queueDir, filename);

            try {
                await fs.copyFile(videoPath, dest);
                if (captionText) {
                    const captionDest = path.join(queueDir, `${parsed.name}.txt`);
                    await fs.writeFile(captionDest, captionText, "utf-8");
                }
                this.log(`  Queued for ${platform.toUpperCase()} -> ${path.basename(dest)} (account: ${this.accountId})`);
            } catch (err) {
                this.log(`  Failed to queue for ${platform}: ${err.message}`, "error");
            }
        }
    }

    getStatus() {
        return {
            running: this.running,
            isDownloading: this.isDownloading,
            channel: this.channel,
            interval: this.interval,
            maxVideos: this.maxVideos,
            minViews: this.minViews,
            platforms: this.platforms,
            accountId: this.accountId,
            lastCheckAt: this.lastCheckAt,
            totalDownloaded: this.totalDownloaded,
            logs: this.logs,
        };
    }
}

module.exports = { AutoDownloadController };
