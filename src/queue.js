const fs = require("fs/promises");
const path = require("path");
const { config } = require("./config");
const { planPaths, readPlan } = require("./schedule-sidecar");

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".avi", ".mkv"]);

function getCaptionPaths(videoPath) {
  const parsed = path.parse(videoPath);
  return [
    path.join(parsed.dir, `${parsed.name}.description`),
    path.join(parsed.dir, `${parsed.name}.txt`),
  ];
}

// Every file archived together with the video.
function getSidecarPaths(videoPath) {
  return [...getCaptionPaths(videoPath), ...planPaths(videoPath)];
}

async function readCaption(videoPath) {
  const captionPaths = getCaptionPaths(videoPath);
  for (const cp of captionPaths) {
    try {
      const text = await fs.readFile(cp, "utf8");
      return text.trim();
    } catch {
      // try next
    }
  }
  return "";
}

async function listQueueVideos(queueDir) {
  const dir = queueDir || config.queueDir;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const videos = entries
    .filter((entry) => entry.isFile())
    .filter((entry) => VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(dir, entry.name));

  videos.sort((a, b) => a.localeCompare(b));
  return videos;
}

function pickNextVideo(videos) {
  if (videos.length === 0) {
    return null;
  }
  if (config.randomQueueOrder) {
    return videos[Math.floor(Math.random() * videos.length)];
  }
  return videos[0];
}

async function getNextQueuedItem(queueDir) {
  const videos = await listQueueVideos(queueDir);
  const videoPath = pickNextVideo(videos);
  if (!videoPath) {
    return null;
  }

  const caption = await readCaption(videoPath);
  return {
    videoPath,
    caption,
    ...(await readPlan(videoPath)),
    captionPaths: getCaptionPaths(videoPath),
  };
}

module.exports = {
  getNextQueuedItem,
  getCaptionPaths,
  getSidecarPaths,
  listQueueVideos,
  VIDEO_EXTENSIONS,
};