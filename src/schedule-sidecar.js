// Optional files next to a queued video: .schedule ("2026-11-20 17:00" in the configured TZ),
// .title, .tags, .category and .cover.jpg.
const fs = require("fs/promises");
const path = require("path");

const MIN_LEAD_MS = 20 * 60 * 1000; // Platforms reject times that are too close.

function planPaths(videoPath) {
  const p = path.parse(videoPath);
  return ["schedule", "title", "tags", "category", "cover.jpg"].map((ext) => path.join(p.dir, `${p.name}.${ext}`));
}

async function readOptional(filePath) {
  try {
    return (await fs.readFile(filePath, "utf8")).trim();
  } catch {
    return "";
  }
}

async function readPlan(videoPath) {
  const [schedulePath, titlePath, tagsPath, categoryPath, coverPath] = planPaths(videoPath);
  const hasCover = await fs.access(coverPath).then(() => true).catch(() => false);
  return {
    scheduleAt: await readOptional(schedulePath),
    title: await readOptional(titlePath),
    tags: await readOptional(tagsPath),
    category: await readOptional(categoryPath),
    coverPath: hasCover ? coverPath : "",
  };
}

// Throws on bad input so an invalid date can never fall through to "publish now".
function parseSchedule(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(String(text).trim());
  if (!m) throw new Error(`Invalid schedule "${text}" (expected YYYY-MM-DD HH:MM).`);
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (date.getMonth() !== month - 1 || date.getDate() !== day || hour > 23 || minute > 59) {
    throw new Error(`Invalid schedule date "${text}".`);
  }
  if (date.getTime() - Date.now() < MIN_LEAD_MS) {
    throw new Error(`Schedule "${text}" is in the past or under 20 minutes away.`);
  }
  return { year, month, day, hour, minute };
}

module.exports = { planPaths, readPlan, parseSchedule };
