const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { config } = require("./config");

function checkCommand(command, args = ["--version"]) {
  try {
    const result = spawnSync(command, args, { encoding: "utf8", timeout: 5000 });
    return result.status === 0;
  } catch {
    return false;
  }
}

function resolveYtDlpExecutable(projectRootOverride) {
  const root = projectRootOverride || config?.projectRoot || path.resolve(__dirname, "..");
  const isWindows = process.platform === "win32";

  // Platform-specific binary filenames
  const localNames = isWindows ? ["yt-dlp.exe", "yt-dlp"] : ["yt-dlp", "yt-dlp.exe"];

  for (const name of localNames) {
    const localPath = path.join(root, "autodownload", name);
    if (fs.existsSync(localPath)) {
      return {
        path: localPath,
        isLocal: true,
        exists: true,
      };
    }
  }

  // Check if available on system PATH
  const systemName = isWindows ? "yt-dlp.exe" : "yt-dlp";
  if (checkCommand("yt-dlp") || (isWindows && checkCommand("yt-dlp.exe"))) {
    return {
      path: systemName,
      isLocal: false,
      exists: true,
    };
  }

  // Default fallback path for display / error messages
  const defaultLocal = path.join(root, "autodownload", isWindows ? "yt-dlp.exe" : "yt-dlp");
  return {
    path: defaultLocal,
    isLocal: true,
    exists: false,
  };
}

module.exports = {
  resolveYtDlpExecutable,
};
