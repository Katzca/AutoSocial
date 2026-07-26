#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const minimumNodeMajor = 18;
const checks = [];

function addCheck(name, status, detail) {
  checks.push({ name, status, detail });
}

function commandWorks(command, args) {
  const candidates =
    process.platform === "win32" && !/\.(cmd|exe)$/i.test(command)
      ? [command, `${command}.cmd`, `${command}.exe`]
      : [command];

  let result = null;
  for (const candidate of candidates) {
    result = spawnSync(candidate, args, {
      cwd: projectRoot,
      encoding: "utf8",
      windowsHide: true,
    });

    if (!result.error || result.error.code !== "ENOENT") {
      break;
    }
  }

  result = result || {};

  return {
    ok: result.status === 0,
    output: (result.stdout || result.stderr || "").trim().split(/\r?\n/)[0] || "",
    error: result.error,
  };
}

function checkNode() {
  const version = process.versions.node;
  const major = Number(version.split(".")[0]);
  addCheck(
    "Node.js",
    major >= minimumNodeMajor ? "ok" : "fail",
    `${version} (requires >= ${minimumNodeMajor})`
  );
}

function checkNpm() {
  if (process.env.npm_execpath) {
    const userAgent = process.env.npm_config_user_agent || "npm available";
    addCheck("npm", "ok", userAgent);
    return;
  }

  if (process.platform === "win32") {
    const npm = commandWorks("cmd.exe", ["/d", "/s", "/c", "npm --version"]);
    addCheck("npm", npm.ok ? "ok" : "fail", npm.ok ? npm.output : npm.error?.message || "not found");
    return;
  }

  const npm = commandWorks("npm", ["--version"]);
  addCheck("npm", npm.ok ? "ok" : "fail", npm.ok ? npm.output : npm.error?.message || "not found");
}

function checkFfmpeg() {
  const ffmpeg = commandWorks("ffmpeg", ["-version"]);
  addCheck("FFmpeg", ffmpeg.ok ? "ok" : "fail", ffmpeg.ok ? ffmpeg.output : "ffmpeg not found in PATH");

  const ffprobe = commandWorks("ffprobe", ["-version"]);
  addCheck("ffprobe", ffprobe.ok ? "ok" : "fail", ffprobe.ok ? ffprobe.output : "ffprobe not found in PATH");
}

function checkPlaywrightChromium() {
  try {
    const { chromium } = require("playwright");
    const executablePath = chromium.executablePath();
    addCheck(
      "Playwright Chromium",
      fs.existsSync(executablePath) ? "ok" : "fail",
      fs.existsSync(executablePath)
        ? executablePath
        : "missing; run `npx playwright install chromium`"
    );
  } catch (error) {
    addCheck("Playwright Chromium", "fail", error.message);
  }
}

function checkYtDlp() {
  const { resolveYtDlpExecutable } = require("../src/yt-dlp-utils");
  const res = resolveYtDlpExecutable(projectRoot);
  if (res.isLocal && res.exists) {
    addCheck("yt-dlp", "ok", res.path);
    return;
  }

  const pathTool = commandWorks("yt-dlp", ["--version"]);
  addCheck(
    "yt-dlp",
    pathTool.ok ? "ok" : "warn",
    pathTool.ok
      ? `PATH version ${pathTool.output}`
      : "optional; add autodownload/yt-dlp executable or install system yt-dlp"
  );
}

function checkEnvExample() {
  const envExamplePath = path.join(projectRoot, ".env.example");
  addCheck(
    ".env.example",
    fs.existsSync(envExamplePath) ? "ok" : "fail",
    fs.existsSync(envExamplePath) ? envExamplePath : "missing"
  );
}

checkNode();
checkNpm();
checkFfmpeg();
checkPlaywrightChromium();
checkYtDlp();
checkEnvExample();

const label = {
  ok: "OK",
  warn: "WARN",
  fail: "FAIL",
};

for (const check of checks) {
  console.log(`[${label[check.status]}] ${check.name}: ${check.detail}`);
}

const failed = checks.filter((check) => check.status === "fail");
if (failed.length > 0) {
  console.error("");
  console.error(`${failed.length} required check(s) failed.`);
  process.exit(1);
}

console.log("");
console.log("Doctor checks passed.");
