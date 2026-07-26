/**
 * ProfileDownloadController
 *
 * One-off downloader allowing the user to scrape a specific TikTok channel
 * with filters (like min-views), saving it explicitly to autodownload/profile_downloads/
 * to prevent auto-queue insertion.
 */

const fsSync = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { config } = require("./config");
const { enrichRecentSlideshowDownloads } = require("./tiktok-slideshow-downloader");
const { resolveYtDlpExecutable } = require("./yt-dlp-utils");

function nowIso() {
    return new Date().toISOString();
}

function ensureDir(dir) {
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
}

class ProfileDownloadController {
    constructor() {
        this.running = false;
        this.logs = [];

        this.baseDir = path.resolve(config.projectRoot, "autodownload");
        this.ytDlp = resolveYtDlpExecutable().path;
        this.downloadsDir = path.join(this.baseDir, "profile_downloads");

        ensureDir(this.downloadsDir);
    }

    log(message, level = "info") {
        const entry = { at: nowIso(), level, message };
        this.logs.unshift(entry);
        this.logs = this.logs.slice(0, 120);
        const prefix = `[${entry.at}] [profile-download]`;
        if (level === "error") {
            console.error(`${prefix} ${message}`);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }

    _channelUrl(channel) {
        let ch = String(channel).trim();
        if (ch.startsWith("http")) return ch;
        if (!ch.startsWith("@")) ch = "@" + ch;
        return `https://www.tiktok.com/${ch}`;
    }

    async start({ channel, minViews, maxVideos, scanOnly }) {
        if (this.running) {
            return { ok: false, error: "A profile download is already in progress." };
        }
        if (!channel) {
            return { ok: false, error: "No channel provided." };
        }

        const max = parseInt(maxVideos, 10) || 0;
        const min = parseInt(minViews, 10) || 0;
        const isScan = Boolean(scanOnly);
        const url = this._channelUrl(channel);

        this.running = true;
        this.logs = [];

        this.log(`Starting Profile ${isScan ? "Scan" : "Download"} - Target: ${url}`);
        this.log(`Parameters - Max loop: ${max > 0 ? max : "All"} videos, Minimum views: ${min > 0 ? min : "None"}`);

        this._runYtDlp(url, min, max, isScan)
            .then(() => {
                this.log("Profile download session finished.");
                this.running = false;
            })
            .catch((err) => {
                this.log(`Profile download error: ${err.message}`, "error");
                this.running = false;
            });

        return { ok: true };
    }

    _runYtDlp(url, minViews, maxVideos, scanOnly) {
        return new Promise((resolve) => {
            const startedAtMs = Date.now();
            const dlArgs = [
                "--no-warnings",
                "-S", "vcodec:h264,res,acodec"
            ];

            if (maxVideos > 0) {
                dlArgs.push("--playlist-items", `1:${maxVideos}`);
            }

            if (scanOnly) {
                dlArgs.push("--simulate");
                dlArgs.push("--print", "Found Video - ID: %(id)s | Views: %(view_count)s");
            } else {
                dlArgs.push("-o", path.join(this.downloadsDir, "%(uploader)s", "%(upload_date)s_%(id)s.%(ext)s"));
                dlArgs.push("--write-description");
                dlArgs.push("--write-info-json");
            }

            if (minViews > 0) {
                dlArgs.push("--match-filter", `view_count >= ${minViews}`);
            }

            dlArgs.push(url);

            this.log(`Checking ${url} for videos matching criteria...`);

            execFile(this.ytDlp, dlArgs, { timeout: 300_000 }, async (err, stdout, stderr) => {
                if (stdout) {
                    const lines = stdout.trim().split("\n").filter(Boolean);
                    lines.forEach((line) => this.log(`  yt-dlp: ${line}`));
                }
                if (stderr) {
                    const lines = stderr.trim().split("\n").filter(Boolean);
                    lines.forEach((line) => this.log(`  yt-dlp: ${line}`));
                }
                if (err) {
                    if (err.code === 101) {
                        this.log("Search criteria likely returned no videos.");
                        return resolve();
                    }
                    this.log(`yt-dlp error: ${err.message}`, "error");
                    return resolve();
                }

                if (!scanOnly) {
                    try {
                        const summary = await enrichRecentSlideshowDownloads(
                            this.downloadsDir,
                            startedAtMs,
                            (message, level = "info") => this.log(message, level)
                        );

                        if (summary.processed > 0) {
                            this.log(
                                `Slideshow enrichment complete - processed ${summary.processed} post(s), saved ${summary.images} image(s).`
                            );
                        }
                    } catch (slideshowError) {
                        this.log(`Slideshow enrichment failed: ${slideshowError.message}`, "error");
                    }
                }

                resolve();
            });
        });
    }

    getStatus() {
        return {
            running: this.running,
            logs: this.logs,
            downloadsDir: this.downloadsDir
        };
    }
}

module.exports = { ProfileDownloadController };
