const fs = require("fs/promises");
const path = require("path");
const { config } = require("./config");
const { getNextQueuedItem, getSidecarPaths } = require("./queue");
const { uploadVideo } = require("./tiktok-uploader");
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

async function postSingleVideo({ videoPath, caption, scheduleAt, coverPath, source, postedDir, failedDir, accountId }) {
  const posted = postedDir || config.postedDir;
  const failed = failedDir || config.failedDir;
  await ensureDirectories([posted, failed]);

  const result = await uploadVideo({ videoPath, caption, scheduleAt, coverPath, source, accountId });
  const captionPaths = getSidecarPaths(videoPath);

  if (result.ok) {
    const movedVideo = await moveFileSafely(videoPath, posted, "posted video");
    const movedCaption = await moveCaptionsIfExists(captionPaths, posted);
    if (!movedVideo) {
      return {
        ok: false,
        error: "Video posted, but could not archive file from queue.",
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
  const queue = queueDir || config.queueDir;
  const posted = postedDir || config.postedDir;
  const failed = failedDir || config.failedDir;
  await ensureDirectories([queue, posted, failed]);

  const nextItem = await getNextQueuedItem(queue);
  if (!nextItem) {
    return { ok: true, skipped: true, reason: "Queue is empty." };
  }

  return postSingleVideo({ ...nextItem, source, postedDir: posted, failedDir: failed, accountId });
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
