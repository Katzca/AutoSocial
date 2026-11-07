const path = require("path");
const fs = require("fs/promises");
const { chromium } = require("playwright");
const { config } = require("./config");
const uiLabels = require("./platform-ui-labels");
const { parseSchedule } = require("./schedule-sidecar");
const {
  getActiveAccount,
  getPlatformProfileDir,
  hasSavedPlatformSession,
} = require("./account-manager");

let loginSessionContext = null;
let loginSessionAccountId = null;

async function openPersistentContext(accountId) {
  const profileDir = await getPlatformProfileDir("youtube", accountId);
  await fs.mkdir(profileDir, { recursive: true });
  return chromium.launchPersistentContext(profileDir, {
    headless: config.headless,
    channel: process.env.BROWSER_CHANNEL || undefined,
    viewport: { width: 1400, height: 1000 },
    locale: config.browserLocale,
    timezoneId: config.timezone,
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

async function gotoUploadPage(page) {
  await page.goto(config.youtubeUploadPageUrl, { waitUntil: "domcontentloaded" });
}

async function clickFirstVisibleEnabledLocator(page, locator) {
  const total = await locator.count();
  for (let i = 0; i < total; i += 1) {
    const candidate = locator.nth(i);
    const visible = await candidate.isVisible().catch(() => false);
    if (!visible) continue;
    const disabled = await candidate.isDisabled().catch(() => false);
    if (disabled) continue;
    try {
      await candidate.scrollIntoViewIfNeeded({ timeout: 3000 });
      await candidate.click({ timeout: 5000 });
      return true;
    } catch {
      try {
        await candidate.click({ timeout: 5000, force: true });
        return true;
      } catch {
        // continue
      }
    }
  }
  return false;
}

async function openUploadDialog(page) {
  async function recoverFromInvalidUploadPage() {
    const bodyText = (await page.locator("body").innerText().catch(() => "")) || "";
    const onBrokenUploadPage =
      /studio\.youtube\.com\/videos\/upload/.test(page.url()) &&
      uiLabels.pattern("error").test(bodyText);
    if (!onBrokenUploadPage) return;

    await page.goto("https://studio.youtube.com", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
  }

  await recoverFromInvalidUploadPage();

  const hasFileInput = async () => (await page.locator('input[type="file"]').count()) > 0;
  if (await hasFileInput()) return true;

  const createButtons = [
    // Explicitly target YouTube Studio's top-right create button host.
    page.locator(uiLabels.attrSelector("ytcp-button.ytcpAppHeaderCreateIcon button", "aria-label", "youtubeCreate")),
    page.getByRole("button", { name: uiLabels.pattern("youtubeCreate") }),
    page.locator(uiLabels.attrSelector("button", "aria-label", "youtubeCreate")),
  ];

  const uploadTargets = [
    page.locator('a[href*="/channel/"][href*="/videos/upload"]'),
    page.getByRole("menuitem", { name: uiLabels.pattern("youtubeUploadVideo") }),
    page.getByRole("button", { name: uiLabels.pattern("youtubeUploadVideo") }),
    page.locator(uiLabels.attrSelector("ytcp-icon-button", "aria-label", "youtubeUploadVideo")),
    page.locator(uiLabels.attrSelector("ytcp-button button", "aria-label", "youtubeUploadVideo")),
    page.locator('a[href*="/videos/upload"]'),
    page.locator('[role="menuitem"], a, button').filter({
      hasText: uiLabels.pattern("youtubeUploadVideo"),
    }),
  ];

  for (const btn of createButtons) {
    const clicked = await clickFirstVisibleEnabledLocator(page, btn);
    if (!clicked) continue;
    await page.waitForTimeout(700);
    for (const target of uploadTargets) {
      const picked = await clickFirstVisibleEnabledLocator(page, target);
      if (!picked) continue;
      await page.waitForTimeout(1200);
      if ((await hasFileInput()) || /\/videos\/upload/.test(page.url())) {
        return true;
      }
    }
  }

  // Fallback: use explicit channel upload link if available.
  const directUploadLink = page.locator('a[href*="/channel/"][href*="/videos/upload"]').first();
  if ((await directUploadLink.count()) > 0) {
    await clickFirstVisibleEnabledLocator(page, directUploadLink);
    await page.waitForTimeout(1200);
    if ((await hasFileInput()) || /\/videos\/upload/.test(page.url())) {
      return true;
    }
  }

  return await hasFileInput();
}

async function setVideoFile(page, videoPath) {
  await openUploadDialog(page);

  const tryViaFileChooser = async () => {
    const triggers = [
      page.getByRole("button", {
        name: uiLabels.pattern("youtubeUploadVideo", "youtubeSelectFiles"),
      }),
      page.locator(uiLabels.attrSelector("button", "aria-label", "youtubeUploadVideo")),
      page.locator(uiLabels.attrSelector("button", "aria-label", "youtubeSelectFiles")),
      page.locator("ytcp-upload-video-button button, ytcp-button#upload-button button"),
      page.locator(uiLabels.attrSelector("ytcp-icon-button", "aria-label", "youtubeUploadVideo")),
      page.locator('a[test-id="upload-icon-url"], a[href*="/videos/upload"]'),
      page.locator("button, [role='button']").filter({
        hasText: uiLabels.pattern("youtubeUploadVideo", "youtubeSelectFiles"),
      }),
    ];

    for (const trigger of triggers) {
      const chooserPromise = page
        .waitForEvent("filechooser", { timeout: 2500 })
        .catch(() => null);
      const clicked = await clickFirstVisibleEnabledLocator(page, trigger);
      if (!clicked) continue;
      const chooser = await chooserPromise;
      if (chooser) {
        await chooser.setFiles(videoPath);
        return true;
      }
    }
    return false;
  };

  if (await tryViaFileChooser()) {
    return;
  }

  let fileInput = page.locator('input[type="file"]').first();
  if ((await fileInput.count()) > 0) {
    await fileInput.setInputFiles(videoPath);
    return;
  }

  await page.waitForTimeout(1200);
  if (await tryViaFileChooser()) {
    return;
  }

  fileInput = page.locator('input[type="file"]').first();
  try {
    await fileInput.waitFor({ state: "attached", timeout: 10000 });
    await fileInput.setInputFiles(videoPath);
    return;
  } catch {
    const uploadUrl = page.url();
    throw new Error(
      `Could not open YouTube file picker on upload page. Current URL: ${uploadUrl}`
    );
  }
}

async function setTitleAndDescription(page, caption, fileNameStem, title) {
  const effectiveCaption = caption && caption.trim() ? caption.trim() : "";
  const baseTitle = title || effectiveCaption || fileNameStem;
  const shortTitle = baseTitle.slice(0, 95);
  const descriptionText = effectiveCaption || config.defaultCaption || "";

  async function fillContentEditable(locator, value) {
    if ((await locator.count()) === 0) return false;
    try {
      await locator.first().click({ timeout: 5000 });
      await page.keyboard.press("Control+A");
      await page.keyboard.press("Delete");
      if (value) {
        await page.keyboard.type(value, { delay: 8 });
      }

      // Force model sync in Polymer inputs.
      await locator.first().evaluate((el, nextValue) => {
        const node = el;
        node.textContent = nextValue;
        node.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
        node.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      }, value);
      return true;
    } catch {
      return false;
    }
  }

  const titleCandidates = [
    page.locator('#title-textarea #textbox[contenteditable="true"]').first(),
    page.locator('#title-textarea [role="textbox"][contenteditable="true"]').first(),
    page.locator(uiLabels.attrSelector("textarea", "aria-label", "youtubeTitleAttribute")).first(),
    page.locator('#title-textarea textarea').first(),
  ];

  let titleSet = false;
  for (const titleInput of titleCandidates) {
    titleSet = await fillContentEditable(titleInput, shortTitle);
    if (titleSet) break;
  }

  const descCandidates = [
    page.locator('#description-textarea #textbox[contenteditable="true"]').first(),
    page.locator('#description-textarea [role="textbox"][contenteditable="true"]').first(),
    page.locator(uiLabels.attrSelector("textarea", "aria-label", "youtubeDescriptionAttribute")).first(),
    page.locator('#description-textarea textarea').first(),
  ];
  let descSet = false;
  for (const descInput of descCandidates) {
    descSet = await fillContentEditable(descInput, descriptionText);
    if (descSet) break;
  }

  if (!titleSet) {
    throw new Error("Could not set YouTube title field in upload wizard.");
  }
  if (!descSet) {
    throw new Error("Could not set YouTube description field in upload wizard.");
  }
}

async function markNotMadeForKids(page) {
  const selectors = [
    page.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]'),
    page.locator('[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]'),
    page.getByRole("radio", { name: uiLabels.pattern("youtubeNotMadeForKids") }),
    page.locator('[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"], tp-yt-paper-radio-button').filter({
      hasText: uiLabels.pattern("youtubeNotMadeForKids"),
    }),
  ];
  for (const selector of selectors) {
    const clicked = await clickFirstVisibleEnabledLocator(page, selector);
    if (!clicked) continue;
    const chosen = page.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]');
    const checked = await chosen
      .first()
      .getAttribute("aria-checked")
      .catch(() => null);
    if (checked === "true") {
      return;
    }
  }

  throw new Error('Could not select "not made for kids" option.');
}

async function setNotAgeRestricted(page) {
  const desired = page.locator('tp-yt-paper-radio-button[name="VIDEO_AGE_RESTRICTION_NONE"]');
  const isSelected = async () =>
    (await desired.first().getAttribute("aria-checked").catch(() => null)) === "true";

  if (await isSelected()) {
    return;
  }

  const expandButton = page.locator('button[aria-controls="age-restriction"]').first();
  if ((await desired.count()) === 0 || !(await desired.first().isVisible().catch(() => false))) {
    const canExpand = (await expandButton.count()) > 0;
    if (canExpand) {
      await clickFirstVisibleEnabledLocator(page, expandButton);
      await page.waitForTimeout(500);
    }
  }

  const clicked = await clickFirstVisibleEnabledLocator(
    page,
    page.locator(
      'tp-yt-paper-radio-button[name="VIDEO_AGE_RESTRICTION_NONE"], [name="VIDEO_AGE_RESTRICTION_NONE"]'
    )
  );
  if (!clicked || !(await isSelected())) {
    throw new Error('Could not select "not age restricted" option.');
  }
}

async function clickNext(page) {
  const nextLocators = [
    page.locator("ytcp-button#next-button button"),
    page.getByRole("button", { name: uiLabels.pattern("next") }),
    page.locator(uiLabels.attrSelector("button", "aria-label", "next")),
  ];

  for (let i = 0; i < 6; i += 1) {
    const doneBtn = page.locator("ytcp-button#done-button button").first();
    const doneVisible = await doneBtn.isVisible().catch(() => false);
    if (doneVisible) {
      return;
    }

    let clicked = false;
    for (const locator of nextLocators) {
      clicked = await clickFirstVisibleEnabledLocator(page, locator);
      if (clicked) {
        await page.waitForTimeout(1200);
        break;
      }
    }
    if (!clicked) break;
  }
}

async function dbgDump(page, name) {
  if (!process.env.YOUTUBE_DEBUG) return;
  const base = path.resolve(config.projectRoot, `debug-yt-${name}`);
  await page.screenshot({ path: `${base}.png` }).catch(() => { });
  const html = await page.locator("ytcp-uploads-dialog").first().evaluate((el) => el.outerHTML).catch(() => "");
  await fs.writeFile(`${base}.html`, html).catch(() => { });
}

async function setYouTubeSchedule(page, when) {
  const hhmm = `${String(when.hour).padStart(2, "0")}:${String(when.minute).padStart(2, "0")}`;
  const dateText = `${when.day} ${uiLabels.YOUTUBE_SHORT_MONTHS_TR[when.month - 1]} ${when.year}`;

  await page.locator("#second-container-expand-button").first().click({ timeout: 8000 });
  await page.waitForTimeout(800);
  await dbgDump(page, "sched-1-open");

  await page.locator("#datepicker-trigger").first().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await dbgDump(page, "sched-2-date");
  const dateInput = page.locator("ytcp-date-picker input").first();
  await dateInput.fill(dateText, { timeout: 5000 });
  await dateInput.press("Enter");
  await page.waitForTimeout(600);

  const timeInput = page.locator("#time-of-day-container input, #time-of-day-trigger input").first();
  await timeInput.fill(hhmm, { timeout: 5000 });
  await timeInput.press("Enter");
  await page.waitForTimeout(600);
  await dbgDump(page, "sched-3-set");

  // Guard: do not publish if the date and time on screen differ from the request.
  const shownDate = (await page.locator("#datepicker-trigger").first().innerText()).trim();
  const shownTime = await timeInput.inputValue();
  console.log(`YouTube schedule shown: ${shownDate} ${shownTime}`);
  if (shownDate !== dateText || shownTime !== hhmm) {
    throw new Error(`Schedule mismatch: wanted ${dateText} ${hhmm}, screen shows ${shownDate} ${shownTime}.`);
  }
}

// Closing the browser before the upload finishes would cut the video off.
async function waitForYouTubeUploadComplete(page) {
  const deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline) {
    const text = await page.locator("ytcp-uploads-dialog").first().innerText().catch(() => "");
    if (!uiLabels.pattern("youtubeUploading").test(text)) return;
    await page.waitForTimeout(2000);
  }
  throw new Error("YouTube upload did not finish in time.");
}

async function setYouTubeDetails(page, { tags, category, coverPath }) {
  await page.locator("ytcp-button#toggle-button button, #toggle-button").first().click({ timeout: 8000 });
  await page.waitForTimeout(1000);
  await dbgDump(page, "details-1-open");

  // Altered-content question: answer "No".
  const noAltered = page.locator('tp-yt-paper-radio-button[name="VIDEO_HAS_ALTERED_CONTENT_NO"]').first();
  const alteredClicked = await noAltered.click({ timeout: 4000 }).then(() => true).catch(() => false);
  console.log(`YouTube altered-content No: ${alteredClicked}`);

  if (tags) {
    const tagInput = page.locator('#tags-container input, ytcp-free-text-chip-bar input, input[aria-label*="Etiket"], input[aria-label*="Tags"]').first();
    await tagInput.click({ timeout: 5000 });
    await tagInput.pressSequentially(`${tags},`, { delay: 5 });
    await page.waitForTimeout(400);
    const chips = await page.locator("ytcp-free-text-chip-bar ytcp-chip").allInnerTexts().catch(() => []);
    console.log(`YouTube tags shown: ${chips.map((c) => c.trim()).join(" | ")}`);
    const firstTag = tags.split(",")[0].trim();
    if (!chips.some((c) => c.includes(firstTag))) throw new Error("YouTube tags were not added.");
  }

  if (category) {
    await page.locator("ytcp-form-select#category ytcp-dropdown-trigger, #category ytcp-dropdown-trigger, ytcp-form-select#category").first().click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await dbgDump(page, "details-2-category");
    await page.locator("tp-yt-paper-item, ytcp-text-menu tp-yt-paper-item").filter({ hasText: new RegExp(`^\\s*${category}\\s*$`) }).first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    const shown = (await page.locator("ytcp-form-select#category, #category").first().innerText()).trim();
    console.log(`YouTube category shown: ${shown.replace(/\s+/g, " ")}`);
    if (!shown.includes(category)) throw new Error(`Category not set: wanted ${category}, screen shows ${shown}.`);
  }

  if (coverPath) {
    await page.locator("ytcp-thumbnail-uploader input#file-loader").first().setInputFiles(coverPath, { timeout: 8000 });
    await page.waitForTimeout(4000);
    const editor = page.locator("ytcp-video-custom-still-editor").first();
    await editor.scrollIntoViewIfNeeded().catch(() => { });
    const errorTip = (await editor.locator("ytcp-form-error-tip").first().innerText().catch(() => "")).trim();
    await dbgDump(page, "details-4-thumb");
    console.log(`YouTube thumbnail set; error tip: "${errorTip}"`);
    if (errorTip) throw new Error(`YouTube thumbnail rejected: ${errorTip}`);
  }
  await dbgDump(page, "details-3-set");
}

async function clickScheduleDone(page) {
  const done = page.locator("ytcp-button#done-button button").first();
  const label = (await done.innerText()).trim();
  console.log(`YouTube done button: ${label}`);
  if (!uiLabels.pattern("youtubeScheduleButton").test(label)) {
    throw new Error(`Done button says "${label}", not Schedule; not clicking.`);
  }
  await done.click({ timeout: 8000 });
}

async function setVisibilityAndPublish(page) {
  const vis = String(process.env.YOUTUBE_VISIBILITY || "public").toLowerCase();
  const visKey = vis === "private" ? "youtubePrivate" : vis === "unlisted" ? "youtubeUnlisted" : "youtubePublic";
  const visibilityOptions = [
    page.getByRole("radio", { name: uiLabels.pattern(visKey) }),
    page.locator('tp-yt-paper-radio-button').filter({ hasText: uiLabels.pattern(visKey) }),
  ];
  for (const option of visibilityOptions) {
    const clicked = await clickFirstVisibleEnabledLocator(page, option);
    if (clicked) break;
  }

  const publishButtons = [
    page.locator("ytcp-button#done-button button"),
    page.getByRole("button", { name: uiLabels.pattern("youtubePublish") }),
    page.getByRole("button", { name: uiLabels.pattern("youtubeSave") }),
    page.locator("ytcp-button#done-button button"),
    page.locator("button").filter({ hasText: uiLabels.pattern("youtubePublish", "youtubeSave") }),
  ];
  for (const btn of publishButtons) {
    const disabled = await btn.first().isDisabled().catch(() => false);
    if (disabled) continue;
    const clicked = await clickFirstVisibleEnabledLocator(page, btn);
    if (clicked) return true;
  }
  return false;
}

async function waitForPublishConfirmation(page) {
  for (let i = 0; i < 40; i += 1) {
    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (uiLabels.pattern("youtubePublished").test(bodyText)) {
      return { ok: true };
    }
    if (uiLabels.pattern("error").test(bodyText)) {
      return { ok: false, reason: "YouTube reported an error while publishing." };
    }
    await page.waitForTimeout(1500);
  }
  return { ok: false, reason: "No reliable YouTube publish confirmation within timeout." };
}

async function startLoginSession() {
  const activeAccount = await getActiveAccount();
  if (loginSessionContext && loginSessionAccountId !== activeAccount.id) {
    const previous = loginSessionContext;
    loginSessionContext = null;
    loginSessionAccountId = null;
    await previous.close().catch(() => { });
  }

  if (loginSessionContext) {
    return { ok: true, alreadyOpen: true };
  }
  const context = await openPersistentContext(activeAccount.id);
  const page = context.pages()[0] || (await context.newPage());
  loginSessionContext = context;
  loginSessionAccountId = activeAccount.id;
  context.on("close", () => {
    if (loginSessionContext === context) {
      loginSessionContext = null;
      loginSessionAccountId = null;
    }
  });
  await gotoUploadPage(page);
  return { ok: true, alreadyOpen: false, url: page.url() };
}

async function getLoginSessionStatus() {
  const activeAccount = await getActiveAccount();
  const saved = await hasSavedPlatformSession("youtube", activeAccount.id);
  return {
    open: Boolean(loginSessionContext) && loginSessionAccountId === activeAccount.id,
    saved,
  };
}

async function closeLoginSession() {
  if (!loginSessionContext) {
    return { ok: true, alreadyClosed: true };
  }
  const context = loginSessionContext;
  loginSessionContext = null;
  loginSessionAccountId = null;
  await context.close().catch(() => { });
  return { ok: true, alreadyClosed: false };
}

async function uploadVideo({ videoPath, caption, scheduleAt, title, tags, category, coverPath, accountId }) {
  const absoluteVideoPath = path.resolve(videoPath);
  const context = await openPersistentContext(accountId);
  const page = context.pages()[0] || (await context.newPage());
  let closeHoldMs = 0;
  try {
    const when = scheduleAt ? parseSchedule(scheduleAt) : null;
    await gotoUploadPage(page);
    await setVideoFile(page, absoluteVideoPath);
    await page.waitForTimeout(Math.max(config.postDelayMs, 5000));
    await setTitleAndDescription(
      page,
      caption,
      path.parse(absoluteVideoPath).name,
      title
    );
    await markNotMadeForKids(page);
    await setNotAgeRestricted(page);
    await setYouTubeDetails(page, { tags, category, coverPath });
    await clickNext(page);
    await waitForYouTubeUploadComplete(page);
    if (when) {
      await setYouTubeSchedule(page, when);
      if (process.env.YOUTUBE_DRY_RUN) {
        throw new Error("DRY RUN: stopped before Schedule.");
      }
      await clickScheduleDone(page);
    } else {
      const published = await setVisibilityAndPublish(page);
      if (!published) {
        throw new Error("Could not find/click YouTube publish button.");
      }
    }

    const confirmation = await waitForPublishConfirmation(page);
    if (!confirmation.ok) {
      throw new Error(confirmation.reason);
    }

    const successScreenshotPath = path.resolve(
      config.projectRoot,
      "last-youtube-upload-success.png"
    );
    await page.screenshot({ path: successScreenshotPath, fullPage: true }).catch(() => { });
    closeHoldMs = Math.max(config.postPublishHoldMs, 0);
    return { ok: true };
  } catch (error) {
    const screenshotPath = path.resolve(
      config.projectRoot,
      "last-youtube-upload-error.png"
    );
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => { });
    closeHoldMs = Math.max(config.failureHoldMs, 0);
    return {
      ok: false,
      error: error.message,
      screenshotPath,
    };
  } finally {
    await page.waitForTimeout(closeHoldMs).catch(() => { });
    await context.close();
  }
}

module.exports = {
  uploadVideo,
  startLoginSession,
  getLoginSessionStatus,
  closeLoginSession,
};

