const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const { resolveYtDlpExecutable } = require("../src/yt-dlp-utils");

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "autosocial-ytdlp-"));
}

test("resolveYtDlpExecutable prefers local binary inside autodownload directory when present", async () => {
  const root = await makeTempDir();
  const autoDir = path.join(root, "autodownload");
  await fs.mkdir(autoDir, { recursive: true });

  const isWin = process.platform === "win32";
  const binaryName = isWin ? "yt-dlp.exe" : "yt-dlp";
  const binaryPath = path.join(autoDir, binaryName);
  await fs.writeFile(binaryPath, "fake-binary-content");

  const res = resolveYtDlpExecutable(root);
  assert.equal(res.isLocal, true);
  assert.equal(res.exists, true);
  assert.equal(res.path, binaryPath);
});

test("resolveYtDlpExecutable returns fallback when binary missing in project root", async () => {
  const root = await makeTempDir();
  const res = resolveYtDlpExecutable(root);
  assert.ok(typeof res.path === "string");
  assert.ok(typeof res.exists === "boolean");
});
