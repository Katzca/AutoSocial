const path = require("path");
const fs = require("fs/promises");
const { chromium } = require("playwright");
const { config } = require("./config");
const uiLabels = require("./platform-ui-labels");
const {
  getActiveAccount,
  getPlatformProfileDir,
  hasSavedPlatformSession,
} = require("./account-manager");

const REALISTIC_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let loginSessionContext = null;
let loginSessionAccountId = null;

async function openPersistentContext(accountId) {
  const profileDir = await getPlatformProfileDir("instagram", accountId);
  await fs.mkdir(profileDir, { recursive: true });
  return chromium.launchPersistentContext(profileDir, {
    headless: config.headless,
    channel: process.env.BROWSER_CHANNEL || undefined,
    viewport: { width: 1400, height: 1000 },
    userAgent: REALISTIC_USER_AGENT,
    locale: config.browserLocale,
    timezoneId: config.timezone,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
    ],
  });
}

/**
 * Navigate with retry logic and exponential backoff.
 * On 429 / network errors, waits and retries up to `maxRetries` times.
 */
async function navigateWithRetry(page, url, { maxRetries = 3, waitUntil = "domcontentloaded" } = {}) {
  const backoffMs = [5000, 15000, 30000];
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await page.goto(url, { waitUntil, timeout: 60000 });
      if (response && response.status() === 429) {
        throw new Error("HTTP 429 - Instagram rate limit");
      }
      // Random human-like pause after navigation (1.5-3.5 s)
      await page.waitForTimeout(1500 + Math.random() * 2000);
      return response;
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }
      const delay = backoffMs[attempt] || 30000;
      console.log(
        `Instagram navigation failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}. ` +
        `Retrying in ${delay / 1000}s...`
      );
      await page.waitForTimeout(delay);
    }
  }
}

async function gotoUploadPage(page) {
  await navigateWithRetry(page, config.instagramUploadPageUrl);
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

  // Navigate to the homepage first; less suspicious than going straight to /create/.
  await navigateWithRetry(page, "https://www.instagram.com/");
  return { ok: true, alreadyOpen: false, url: page.url() };
}

async function getLoginSessionStatus() {
  const activeAccount = await getActiveAccount();
  const saved = await hasSavedPlatformSession("instagram", activeAccount.id);
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

async function ensureCreateFlowInput(page) {
  const input = page.locator('input[type="file"]').first();
  if ((await input.count()) > 0) return input;

  // Sidebar "+" icon (label may only appear as a tooltip / svg aria-label).
  const plusIcons = [
    page.locator(uiLabels.terms("instagramCreateIcon").map((t) => `svg[aria-label="${t}"]`).join(", ")).first(),
    page.locator('[aria-label="New post"], [aria-label="Create"]').first(),
  ];
  for (const icon of plusIcons) {
    if (!(await icon.click({ timeout: 3000 }).then(() => true).catch(() => false))) continue;
    console.log("Instagram sidebar create icon clicked.");
    await page.waitForTimeout(1200);
    const postItem = page.getByText(uiLabels.exactPattern("instagramPostMenuItem")).first();
    if (await postItem.click({ timeout: 3000 }).then(() => true).catch(() => false)) {
      console.log("Instagram Post menu item clicked.");
      await page.waitForTimeout(1500);
    }
    if ((await input.count()) > 0) return input;
  }

  const createPattern = uiLabels.pattern("create");
  const postFormatPattern = uiLabels.pattern("instagramPostFormat", "instagramReelFormat");
  const createEntryPoints = [
    page.getByRole("link", { name: createPattern }),
    page.getByRole("button", { name: createPattern }),
    page.locator('a[href*="/create"]').filter({ hasText: createPattern }),
    page.locator('nav a, nav [role="link"], nav button, nav [role="button"]').filter({
      hasText: createPattern,
    }),
  ];

  for (const entry of createEntryPoints) {
    const clicked = await clickFirstVisibleEnabledLocator(page, entry);
    if (!clicked) continue;
    console.log("Instagram create entry clicked.");
    await page.waitForTimeout(1200);
    if ((await input.count()) > 0) return input;
    // Create opens a small menu (Post / Live video / Ad): pick "Post".
    const postItem = page.getByText(uiLabels.exactPattern("instagramPostMenuItem")).first();
    if (await postItem.click({ timeout: 3000 }).then(() => true).catch(() => false)) {
      console.log("Instagram Post menu item clicked.");
      await page.waitForTimeout(1500);
      if ((await input.count()) > 0) return input;
    }
  }

  // Some flows open a chooser first (post/reel/story).
  const formatPickers = [
    ...uiLabels
      .terms("instagramPostFormat", "instagramReelFormat")
      .map((term) => page.getByText(term, { exact: true })),
    page.getByRole("button", { name: postFormatPattern }),
    page.getByRole("menuitem", { name: postFormatPattern }),
    page.getByRole("button", { name: /reel|reels/i }),
    page.locator('[role="menuitem"], [role="option"], button, a').filter({
      hasText: postFormatPattern,
    }),
  ];
  for (const picker of formatPickers) {
    const clicked = await clickFirstVisibleEnabledLocator(page, picker);
    if (!clicked) continue;
    console.log("Instagram post format selected (Post/Reel).");
    await page.waitForTimeout(1200);
    if ((await input.count()) > 0) return input;
  }

  const createButtons = [
    page.getByRole("button", { name: uiLabels.pattern("create", "instagramPostFormat") }),
    page.locator('[role="button"]').filter({ hasText: uiLabels.pattern("create", "instagramPostFormat") }),
    page.locator("a, [role='link']").filter({ hasText: uiLabels.pattern("create", "instagramPostFormat") }),
  ];

  for (const button of createButtons) {
    const clicked = await clickFirstVisibleEnabledLocator(page, button);
    if (clicked) {
      await page.waitForTimeout(1200);
      if ((await input.count()) > 0) return input;
    }
  }

  return input;
}

async function setVideoFile(page, videoPath) {
  let input = await ensureCreateFlowInput(page);
  if ((await input.count()) > 0) {
    await input.waitFor({ state: "attached", timeout: 120000 });
    await input.setInputFiles(videoPath);
    return;
  }

  // Fallback: use file chooser event if no file input is exposed yet.
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 10000 }).catch(() => null);
  const uploadTriggerPattern = uiLabels.pattern("instagramUploadTrigger");
  const uploadTriggers = [
    page.getByRole("button", { name: uploadTriggerPattern }),
    page.locator('button, [role="button"]').filter({
      hasText: uploadTriggerPattern,
    }),
  ];

  for (const trigger of uploadTriggers) {
    const clicked = await clickFirstVisibleEnabledLocator(page, trigger);
    if (clicked) {
      console.log("Instagram upload trigger clicked.");
      break;
    }
  }

  const chooser = await chooserPromise;
  if (chooser) {
    await chooser.setFiles(videoPath);
    return;
  }

  // One last attempt to locate input after opening dialogs.
  input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached", timeout: 120000 });
  await input.setInputFiles(videoPath);
}

async function dismissPopups(page) {
  const notNow = page.getByRole("button", { name: uiLabels.exactPattern("instagramNotNow") });
  for (let i = 0; i < 3; i += 1) {
    const clicked = await notNow.first().click({ timeout: 2500 }).then(() => true).catch(() => false);
    if (!clicked) break;
    await page.waitForTimeout(800);
  }
}

async function ensureOriginalCrop(page) {
  // "Video posts are now shared as reels" info dialog.
  await page.getByRole("button", { name: uiLabels.exactPattern("instagramOk") }).first().click({ timeout: 4000 }).catch(() => { });
  await page.waitForTimeout(800);
  await dbgShot(page, "crop-0");
  const cropBtn = page.locator([...uiLabels.terms("instagramCropIcon").map((t) => `svg[aria-label="${t}"]`), '[aria-label="Select crop"]'].join(", ")).first();
  if (!(await cropBtn.click({ timeout: 5000 }).then(() => true).catch(() => false))) {
    console.log("Instagram crop button not found.");
    return;
  }
  await page.waitForTimeout(800);
  await dbgShot(page, "crop-1");
  const original = page.getByText(uiLabels.exactPattern("instagramCropOriginal")).first();
  if (await original.click({ timeout: 4000 }).then(() => true).catch(() => false)) {
    console.log("Instagram crop set to Original.");
  }
  await page.waitForTimeout(800);
  await dbgShot(page, "crop-2");
}

async function dbgShot(page, name) {
  if (!process.env.INSTAGRAM_DEBUG) return;
  await page.screenshot({ path: path.resolve(config.projectRoot, `debug-ig-${name}.png`) }).catch(() => { });
}

async function dumpIg(page, name) {
  if (!process.env.INSTAGRAM_DEBUG) return;
  const base = path.resolve(config.projectRoot, `debug-ig-${name}`);
  await page.screenshot({ path: `${base}.png` }).catch(() => { });
  const html = await page.locator('[role="dialog"]').last().evaluate((el) => el.outerHTML).catch(() => "");
  await fs.writeFile(`${base}.html`, html).catch(() => { });
}

// Uploads our own image as the cover on the reel edit step.
async function setInstagramCover(page, coverPath) {
  await dumpIg(page, "cover-1-edit");
  const trigger = page.getByText(uiLabels.exactPattern("instagramCoverFromComputer")).first();
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 8000 });
  await trigger.click({ timeout: 8000 });
  const chooser = await chooserPromise;
  await chooser.setFiles(coverPath);
  await page.waitForTimeout(2500);
  await dumpIg(page, "cover-2-set");
  console.log("Instagram cover uploaded.");
}

async function clickNextButtons(page, onEditStep) {
  const nextSelectors = [
    page.getByRole("button", { name: uiLabels.pattern("next") }),
    page.locator("button").filter({ hasText: uiLabels.pattern("next") }),
  ];

  for (let pass = 0; pass < 3; pass += 1) {
    let clicked = false;
    for (const selector of nextSelectors) {
      const didClick = await clickFirstVisibleEnabledLocator(page, selector);
      if (didClick) {
        clicked = true;
        await page.waitForTimeout(1200);
        await dbgShot(page, `after-next-${pass + 1}`);
        if (pass === 0 && onEditStep) await onEditStep();
        break;
      }
    }
    if (!clicked) break;
  }
}

async function setCaption(page, caption) {
  if (!caption) return;
  const candidates = [
    uiLabels.attrSelector("textarea", "aria-label", "captionAttribute"),
    uiLabels.attrSelector("textarea", "placeholder", "captionAttribute"),
    'textarea',
    'div[contenteditable="true"]',
  ];

  for (const selector of candidates) {
    const target = page.locator(selector).first();
    if ((await target.count()) === 0) continue;
    try {
      await target.click({ timeout: 8000 });
      await page.keyboard.press("Control+A");
      await page.keyboard.press("Delete");
      await target.type(caption, { delay: 10 });
      return;
    } catch {
      // next
    }
  }
}

async function clickShare(page) {
  const sharePattern = uiLabels.pattern("share");
  const shareLocators = [
    page.getByRole("button", { name: sharePattern }),
    page.locator("button").filter({ hasText: sharePattern }),
    page.locator('[role="button"]').filter({ hasText: sharePattern }),
  ];

  for (const locator of shareLocators) {
    const clicked = await clickFirstVisibleEnabledLocator(page, locator);
    if (clicked) return true;
  }
  return false;
}

async function waitForPostConfirmation(page, startedUrl) {
  // Wait up to 60 * 1500ms = 90 seconds for upload processing
  for (let i = 0; i < 200; i += 1) {
    const text = await page.locator("body").innerText().catch(() => "");
    if (uiLabels.pattern("posted").test(text)) {
      return { ok: true };
    }
    if (uiLabels.pattern("error").test(text)) {
      return { ok: false, reason: "Instagram reported an error while posting." };
    }

    const currentUrl = page.url();
    if (currentUrl !== startedUrl && !/\/create\//i.test(currentUrl)) {
      return { ok: true };
    }
    await page.waitForTimeout(1500);
  }
  return { ok: false, reason: "No reliable Instagram post confirmation within timeout." };
}

async function uploadVideo({ videoPath, caption, coverPath, accountId }) {
  const absoluteVideoPath = path.resolve(videoPath);
  const context = await openPersistentContext(accountId);
  const page = context.pages()[0] || (await context.newPage());
  let closeHoldMs = 0;

  try {
    // Instagram has no web scheduling: stop instead of publishing a scheduled video now.
    const parsedVideo = path.parse(absoluteVideoPath);
    const scheduleFile = path.join(parsedVideo.dir, `${parsedVideo.name}.schedule`);
    if (await fs.access(scheduleFile).then(() => true).catch(() => false)) {
      throw new Error("Instagram cannot schedule from the web; remove the .schedule file to publish now.");
    }
    await gotoUploadPage(page);
    await dismissPopups(page);
    await setVideoFile(page, absoluteVideoPath);
    await page.waitForTimeout(Math.max(config.postDelayMs, 5000));
    await dbgShot(page, "after-upload");
    await ensureOriginalCrop(page);
    await clickNextButtons(page, coverPath ? () => setInstagramCover(page, coverPath) : null);
    await setCaption(page, caption || config.defaultCaption);
    await dbgShot(page, "after-caption");
    // Guard: never publish a non-9:16 preview (square crop bug seen before).
    const vbox = await page.locator('[role="dialog"] video').first().boundingBox().catch(() => null);
    if (!vbox || vbox.height <= 0) {
      throw new Error("Could not measure the preview video; not publishing.");
    }
    const ratio = vbox.width / vbox.height;
    console.log(`Instagram preview ratio: ${ratio.toFixed(3)}`);
    if (ratio < 0.5 || ratio > 0.62) {
      throw new Error(`Preview is not 9:16 (ratio ${ratio.toFixed(2)}); not publishing.`);
    }
    await dbgShot(page, "before-share");
    if (process.env.INSTAGRAM_DRY_RUN) {
      throw new Error("DRY RUN: stopped before Share.");
    }

    const startedUrl = page.url();
    const shared = await clickShare(page);
    if (!shared) {
      throw new Error("Could not find/click Instagram Share button.");
    }

    const confirmation = await waitForPostConfirmation(page, startedUrl);
    if (!confirmation.ok) {
      throw new Error(confirmation.reason);
    }

    const successScreenshotPath = path.resolve(
      config.projectRoot,
      "last-instagram-upload-success.png"
    );
    await page.screenshot({ path: successScreenshotPath, fullPage: true }).catch(() => { });

    // Hold the browser open so background processing finishes
    closeHoldMs = Math.max(config.postPublishHoldMs || 15000, 15000);
    return { ok: true };
  } catch (error) {
    const screenshotPath = path.resolve(
      config.projectRoot,
      "last-instagram-upload-error.png"
    );
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => { });

    closeHoldMs = Math.max(config.failureHoldMs, 0);
    return {
      ok: false,
      error: error.message,
      screenshotPath,
    };
  } finally {
    if (closeHoldMs > 0) {
      console.log(`Holding browser for ${closeHoldMs / 1000}s before closing...`);
      await page.waitForTimeout(closeHoldMs).catch(() => { });
    }
    await context.close();
  }
}

module.exports = {
  uploadVideo,
  startLoginSession,
  getLoginSessionStatus,
  closeLoginSession,
};

