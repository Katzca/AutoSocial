const fs = require("fs/promises");
const path = require("path");
const { config } = require("./config");
const { getNextQueuedItem, getSidecarPaths } = require("./youtube-queue");
const { uploadVideo } = require("./youtube-uploader");
const { ensureDirectories, fileExists, moveWithTimestamp } = require("./fs-utils");

async function moveCaptionsIfExists(captionPaths, targetDir) {
  const moved = [];
  for (const cp of captionPaths) {
    if (await fileExists(cp)) {
      const result = await moveFileSafely(cp, targetDir, "caption file");
      if (result) moved.push(result);
    }
  }
  return moved.length > 0 ? moved[0] : null;
}

async function moveFileSafely(sourcePath, targetDir, label) {
  try {
    return await moveWithTimestamp(sourcePath, targetDir);
  } catch (error) {
    console.error(`Could not move ${label}: ${error.message}`);
    return null;
  }
}

async function postSingleVideo({ videoPath, caption, scheduleAt, title, tags, category, coverPath, postedDir, failedDir, accountId }) {
  const posted = postedDir || config.youtubePostedDir;
  const failed = failedDir || config.youtubeFailedDir;
  await ensureDirectories([posted, failed]);

  const result = await uploadVideo({ videoPath, caption, scheduleAt, title, tags, category, coverPath, accountId });
  const captionPaths = getSidecarPaths(videoPath);

  if (result.ok) {
    const movedVideo = await moveFileSafely(videoPath, posted, "posted video");
    const movedCaption = await moveCaptionsIfExists(captionPaths, posted);
    if (!movedVideo) {
      return {
        ok: false,
        error: "Video posted, but could not archive file from YouTube queue.",
        screenshotPath: result.screenshotPath,
      };
    }
    return { ok: true, movedVideo, movedCaption };
  }

  const movedVideo = await moveFileSafely(videoPath, failed, "failed video");
  const movedCaption = await moveCaptionsIfExists(captionPaths, failed);
  return {
    ok: false,
    movedVideo,
    movedCaption,
    error: result.error,
    screenshotPath: result.screenshotPath,
  };
}

async function postNextFromQueue({ source, queueDir, postedDir, failedDir, accountId } = {}) {
  const queue = queueDir || config.youtubeQueueDir;
  const posted = postedDir || config.youtubePostedDir;
  const failed = failedDir || config.youtubeFailedDir;
  await ensureDirectories([queue, posted, failed]);

  const nextItem = await getNextQueuedItem(queue);
  if (!nextItem) {
    return { ok: true, skipped: true, reason: "YouTube queue is empty." };
  }

  return postSingleVideo({ ...nextItem, postedDir: posted, failedDir: failed, accountId });
}

async function postFromManualInput(videoPath, caption) {
  const resolvedPath = path.resolve(videoPath);
  await fs.access(resolvedPath);
  return postSingleVideo({
    videoPath: resolvedPath,
    caption: caption || "",
  });
}

module.exports = {
  postNextFromQueue,
  postFromManualInput,
};
