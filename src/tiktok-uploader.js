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
  const profileDir = await getPlatformProfileDir("tiktok", accountId);
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
  await page.goto(config.uploadPageUrl, { waitUntil: "domcontentloaded" });
}

async function setVideoFile(page, videoPath) {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached", timeout: 120000 });
  await fileInput.setInputFiles(videoPath);
}

async function setCaption(page, caption) {
  if (!caption) {
    return;
  }

  const candidates = [
    'div[contenteditable="true"]',
    'textarea[placeholder*="caption" i]',
    'textarea',
  ];

  for (const selector of candidates) {
    const target = page.locator(selector).first();
    const count = await target.count();
    if (count === 0) {
      continue;
    }

    try {
      await target.click({ timeout: 8000 });
      await page.keyboard.press("Control+A");
      await page.keyboard.press("Delete");
      await target.type(caption, { delay: 10 });
      return;
    } catch {
      // Try the next candidate selector.
    }
  }

  throw new Error("Could not find caption input field.");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function clickFirstVisibleEnabledLocator(page, locator) {
  const total = await locator.count();
  if (total === 0) {
    return false;
  }

  for (let i = 0; i < total; i += 1) {
    const candidate = locator.nth(i);
    const visible = await candidate.isVisible().catch(() => false);
    if (!visible) {
      continue;
    }

    const disabled = await candidate.isDisabled().catch(() => false);
    if (disabled) {
      continue;
    }

    try {
      await candidate.scrollIntoViewIfNeeded({ timeout: 3000 });
      await page.waitForTimeout(250);
      await candidate.click({ timeout: 5000 });
      return true;
    } catch {
      try {
        await candidate.click({ timeout: 5000, force: true });
        return true;
      } catch {
        // Continue to next candidate.
      }
    }
  }

  return false;
}

function normalizeUiText(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getPublishCandidateScore(info, publishTerms = uiLabels.terms("tiktokPublish")) {
  const text = normalizeUiText(info?.text || info?.ariaLabel);
  if (!text || info?.disabled || info?.inNavigation) {
    return -1;
  }

  const tagName = normalizeUiText(info?.tagName);
  const role = normalizeUiText(info?.role);
  if (!["button", "a"].includes(tagName) && role !== "button") {
    return -1;
  }

  const href = normalizeUiText(info?.href);
  if (href && /\/(post|posts|analytics|comment|home|inspiration|monetization|academy|sound|feedback)(\/|$|\?)/i.test(href)) {
    return -1;
  }

  if (text === "posts") {
    return -1;
  }

  const labels = publishTerms.map(normalizeUiText).filter(Boolean);
  const exactMatch = labels.includes(text);
  const nonAmbiguousMatch = labels
    .filter((label) => label !== "post")
    .some((label) => text.includes(label));
  if (!exactMatch && !nonAmbiguousMatch) {
    return -1;
  }

  const rect = info?.rect || {};
  const viewportWidth = Number(info?.viewportWidth) || 0;
  const viewportHeight = Number(info?.viewportHeight) || 0;
  const left = Number(rect.left) || 0;
  const top = Number(rect.top) || 0;
  const width = Number(rect.width) || 0;
  const height = Number(rect.height) || 0;
  const right = Number(rect.right) || left + width;
  const mainContentBoundary = viewportWidth >= 900 ? Math.min(300, viewportWidth * 0.25) : 0;

  if (viewportWidth >= 900 && right <= mainContentBoundary) {
    return -1;
  }

  const isBottomAction = viewportHeight > 0 && top >= viewportHeight * 0.5;
  const isCtaSized = width >= 80 && height >= 28;
  const className = normalizeUiText(info?.className);
  const hasPublishCue = /\b(post|publish|submit)\b/.test(className);

  if (text === "post" && viewportHeight >= 600 && !isBottomAction && !hasPublishCue) {
    return -1;
  }

  let score = 0;
  if (exactMatch) score += 30;
  if (nonAmbiguousMatch) score += 20;
  if (tagName === "button") score += 20;
  if (normalizeUiText(info?.type) === "submit") score += 20;
  if (hasPublishCue) score += 20;
  if (isCtaSized) score += 15;
  if (isBottomAction) score += 60;
  if (viewportWidth >= 900 && left >= mainContentBoundary) score += 20;
  score += Math.min(20, Math.max(0, top / 40));

  return score;
}

function isLikelyPublishCandidateInfo(info, publishTerms = uiLabels.terms("tiktokPublish")) {
  return getPublishCandidateScore(info, publishTerms) >= 0;
}

async function getPublishCandidateInfo(candidate) {
  return candidate.evaluate((el) => {
    const clickable = el.closest("button, [role='button'], a") || el;
    const rect = clickable.getBoundingClientRect();
    const className = (clickable.className || "").toString();
    const dataAttributes = Array.from(clickable.attributes || [])
      .filter((attr) => attr.name.startsWith("data-"))
      .map((attr) => `${attr.name}=${attr.value}`)
      .join(" ");
    const inNavigation = Boolean(
      clickable.closest(
        [
          "nav",
          "aside",
          "[role='navigation']",
          "[role='menu']",
          "[role='menubar']",
          "[class*='sidebar' i]",
          "[class*='side-bar' i]",
          "[class*='sidenav' i]",
          "[class*='side-nav' i]",
          "[class*='side_nav' i]",
          "[class*='menu' i]",
          "[class*='navigation' i]",
          "[class*='nav-item' i]",
          "[class*='nav_item' i]",
          "[data-e2e*='nav' i]",
          "[data-e2e*='side' i]",
          "[data-testid*='nav' i]",
          "[data-testid*='side' i]",
        ].join(", ")
      )
    );
    const anchor = clickable.closest("a");
    return {
      ariaLabel: clickable.getAttribute("aria-label") || "",
      className,
      dataAttributes,
      disabled: Boolean(clickable.disabled) || clickable.getAttribute("aria-disabled") === "true",
      href: anchor ? anchor.getAttribute("href") || "" : "",
      inNavigation,
      rect: {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      role: clickable.getAttribute("role") || "",
      tagName: clickable.tagName,
      type: clickable.getAttribute("type") || "",
      text: clickable.textContent || "",
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
}

async function clickFirstLikelyPublishLocator(page, locator, publishTerms = uiLabels.terms("tiktokPublish")) {
  const total = await locator.count();
  if (total === 0) {
    return false;
  }

  const candidates = [];
  for (let i = 0; i < total; i += 1) {
    const candidate = locator.nth(i);
    const visible = await candidate.isVisible().catch(() => false);
    if (!visible) {
      continue;
    }

    const info = await getPublishCandidateInfo(candidate).catch(() => null);
    const score = getPublishCandidateScore(info, publishTerms);
    if (score < 0) {
      continue;
    }

    candidates.push({ candidate, info, score });
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (Number(b.info?.rect?.top) || 0) - (Number(a.info?.rect?.top) || 0);
  });

  for (const entry of candidates) {
    const { candidate, info, score } = entry;

    try {
      await candidate.scrollIntoViewIfNeeded({ timeout: 3000 });
      await page.waitForTimeout(250);
      await candidate.click({ timeout: 5000 });
      const rect = info?.rect || {};
      console.log(
        `Publish candidate clicked: "${normalizeUiText(info?.text || info?.ariaLabel)}" score=${score.toFixed(1)} ` +
          `rect=${Math.round(Number(rect.left) || 0)},${Math.round(Number(rect.top) || 0)},` +
          `${Math.round(Number(rect.width) || 0)}x${Math.round(Number(rect.height) || 0)}`
      );
      return true;
    } catch {
      try {
        await candidate.click({ timeout: 5000, force: true });
        const rect = info?.rect || {};
        console.log(
          `Publish candidate force-clicked: "${normalizeUiText(info?.text || info?.ariaLabel)}" score=${score.toFixed(1)} ` +
            `rect=${Math.round(Number(rect.left) || 0)},${Math.round(Number(rect.top) || 0)},` +
            `${Math.round(Number(rect.width) || 0)}x${Math.round(Number(rect.height) || 0)}`
        );
        return true;
      } catch {
        // Continue to next candidate.
      }
    }
  }

  return false;
}

async function addDefaultSound(page, source) {
  if (source === "instant-post") {
    console.log("Skipping auto-add sound: Post triggered via Instant Post (video already has sound).");
    return;
  }

  if (!config.autoAddSound) {
    console.log("Auto-add sound disabled by config.");
    return;
  }

  const query = (config.defaultSoundQuery || "").trim();
  if (!query) {
    console.log("Auto-add sound enabled, but DEFAULT_SOUND_QUERY is empty; skipping sound change.");
    return;
  }

  console.log(`Adding sound flow started${query ? `: ${query}` : ""}`);

  async function clickUploadEditorSoundsButton() {
    // Strict targeting for the editor action row under the preview.
    const rowPattern = uiLabels.pattern("tiktokEdit");
    const soundsPattern = uiLabels.pattern("tiktokSounds");
    const textPattern = uiLabels.pattern("tiktokText");

    const rowCandidates = page
      .locator("div, section")
      .filter({ hasText: rowPattern })
      .filter({ hasText: soundsPattern })
      .filter({ hasText: textPattern });

    const rowCount = await rowCandidates.count();
    for (let i = 0; i < rowCount; i += 1) {
      const row = rowCandidates.nth(i);
      const rowVisible = await row.isVisible().catch(() => false);
      if (!rowVisible) {
        continue;
      }

      const box = await row.boundingBox().catch(() => null);
      if (!box) {
        continue;
      }

      // Keep only right-side rows near the phone preview area.
      if (box.x < 520) {
        continue;
      }

      const exactSounds = row.locator(
        uiLabels.textSelector("button", "tiktokSounds") +
          ", " +
          uiLabels.textSelector('[role="button"]', "tiktokSounds")
      );
      const clickedExact = await clickFirstVisibleEnabledLocator(page, exactSounds);
      if (clickedExact) {
        console.log("Sound panel open strategy: strict editor row");
        return true;
      }

      const looseSounds = row.locator("button, [role='button'], div").filter({
        hasText: soundsPattern,
      });
      const clickedLoose = await clickFirstVisibleEnabledLocator(page, looseSounds);
      if (clickedLoose) {
        console.log("Sound panel open strategy: editor row fallback");
        return true;
      }
    }

    // Last resort: right-side clickable element named Sounds/Audio, never nav/aside.
    const soundLabels = uiLabels.terms("tiktokSounds").map((term) => term.toLowerCase());
    const clicked = await page.evaluate((labels) => {
      const isVisible = (el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const nodes = Array.from(document.querySelectorAll("button, [role='button']"));
      for (const el of nodes) {
        const text = (el.textContent || "").trim().toLowerCase();
        if (!labels.includes(text)) {
          continue;
        }
        if (el.closest("nav, aside, [role='navigation']")) {
          continue;
        }
        if (!isVisible(el)) {
          continue;
        }

        const rect = el.getBoundingClientRect();
        // Stronger right-side lock so it cannot hit left menu.
        if (rect.left < window.innerWidth * 0.65) {
          continue;
        }

        el.scrollIntoView({ block: "center", inline: "center" });
        el.click();
        return true;
      }

      return false;
    }, soundLabels);

    if (clicked) {
      console.log("Sound panel open strategy: right-side hard fallback");
      return true;
    }

    return false;
  }

  const previousUrl = page.url();
  const opened = await clickUploadEditorSoundsButton();

  if (!opened) {
    console.log("Could not open sound panel; continuing without sound change.");
    return;
  }

  await page.waitForTimeout(700);
  // Guard: if wrong control caused navigation, jump back to upload page and skip sound.
  if (!page.url().includes("/upload")) {
    console.log(`Sounds click navigated away (${page.url()}); returning to upload page.`);
    await gotoUploadPage(page);
    await page.waitForTimeout(1000);
    return;
  }

  if (page.url() !== previousUrl) {
    console.log(`Upload page URL changed after sounds click: ${page.url()}`);
  }

  await page.waitForTimeout(1000);

  let added = false;

  // The "Use this sound" button in the sound panel is the ArrowLeftRight icon button.
  // The PlusBold icon button is typically disabled. We target both but prefer ArrowLeftRight.
  const useButtonSelector = [
    'button:has([data-testid="ArrowLeftRight"])',
    'button:has([data-icon="ArrowLeftRight"])',
  ].join(", ");

  // Step 1: try direct row match first (avoids flaky input focus/autocomplete issues).
  const queryPattern = new RegExp(escapeRegExp(query), "i");
  const directRow = page
    .locator('[role="listitem"], .MusicPanelMusicItem__wrap')
    .filter({ hasText: queryPattern });
  const directUse = directRow.locator(useButtonSelector);
  added = await clickFirstVisibleEnabledLocator(page, directUse);
  if (added) {
    console.log(`Sound used directly from visible "${query}" row (ArrowLeftRight).`);
    await page.waitForTimeout(1500);
  }

  // Step 2: fallback to search when direct row is unavailable.
  if (!added) {
    const soundSearchInput = page.getByPlaceholder(uiLabels.pattern("tiktokSearchSounds")).first();
    const inputVisible = await soundSearchInput.isVisible().catch(() => false);

    if (!inputVisible) {
      console.log("Sound search input not visible; skipping search.");
    } else {
      const queryPrefix = query.split(/\s+/).slice(0, 2).join(" ");
      const searchQueries = Array.from(new Set([query, queryPrefix].filter(Boolean)));

      for (const currentQuery of searchQueries) {
        await soundSearchInput.click({ timeout: 3000 });
        await page.waitForTimeout(300);

        await soundSearchInput.evaluate((el) => {
          el.focus();
          el.value = "";
          el.dispatchEvent(new Event("input", { bubbles: true }));
        });
        await page.waitForTimeout(200);

        await page.keyboard.type(currentQuery, { delay: 30 });
        await page.waitForTimeout(300);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);

        const typedValue = await soundSearchInput.inputValue().catch(() => "");
        console.log(`Sound search typed: "${typedValue}" (wanted: "${currentQuery}")`);

        const rows = page
          .locator('[role="listitem"], .MusicPanelMusicItem__wrap')
          .filter({ hasText: new RegExp(escapeRegExp(currentQuery), "i") });
        const rowCount = await rows.count();
        if (rowCount === 0) {
          console.log(`No rows found for "${currentQuery}".`);
          continue;
        }

        const maxRowsToTry = Math.min(rowCount, 5);
        for (let i = 0; i < maxRowsToTry; i += 1) {
          const row = rows.nth(i);
          const rowVisible = await row.isVisible().catch(() => false);
          if (!rowVisible) continue;

          const addStrategies = [
            row.locator(useButtonSelector),
            row.locator(".MusicPanelMusicItem__operation button").first(),
          ];

          for (const locator of addStrategies) {
            added = await clickFirstVisibleEnabledLocator(page, locator);
            if (added) {
              console.log(`Sound "${currentQuery}" applied via use-button.`);
              await page.waitForTimeout(1500);
              break;
            }
          }
          if (added) break;
        }
        if (added) break;
      }
    }
  }

  // Step 3: hard fallback - click first enabled use-button in the panel.
  if (!added) {
    const firstUse = page.locator(
      `.MusicPanelMusicItem__operation ${useButtonSelector}`
    );
    added = await clickFirstVisibleEnabledLocator(page, firstUse);
    if (added) {
      console.log("Sound applied via first visible ArrowLeftRight fallback.");
      await page.waitForTimeout(1500);
    }
  }

  if (!added) {
    throw new Error(`Could not click use-button for sound "${query}".`);
  }

  // Step 4: Click "Save" to confirm the sound selection.
  // The sound panel is an overlay; the Publish button may be visible behind it,
  // so we must NOT rely on publishVisible to decide if we are done.
  let saved = false;
  const saveLocator = page.locator("button.Button__root--type-primary, button").filter({
    hasText: uiLabels.pattern("tiktokSave"),
  });

  // Retry a few times with waits; the button may need a moment after the sound loads.
  for (let attempt = 0; attempt < 5; attempt++) {
    saved = await clickFirstVisibleEnabledLocator(page, saveLocator);
    if (saved) {
      console.log(`Sound saved via Save (attempt ${attempt + 1}).`);
      break;
    }
    console.log(`Save not ready yet, waiting... (attempt ${attempt + 1}/5)`);
    await page.waitForTimeout(1500);
  }

  if (!saved) {
    // Last resort: try clicking via page.evaluate to force-find and click the button.
    const saveTerms = uiLabels.terms("tiktokSave").map((term) => term.toLowerCase());
    saved = await page.evaluate((labels) => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const saveBtn = buttons.find(
        (b) =>
          labels.includes((b.textContent || "").trim().toLowerCase())
      );
      if (saveBtn && !saveBtn.disabled) {
        saveBtn.scrollIntoView();
        saveBtn.click();
        return true;
      }
      return false;
    }, saveTerms);
    if (saved) {
      console.log("Sound saved via evaluate fallback.");
    }
  }

  if (!saved) {
    // Check if the panel actually closed on its own.
    const soundSearchStillVisible = await page
      .getByPlaceholder(uiLabels.pattern("tiktokSearchSounds"))
      .first()
      .isVisible()
      .catch(() => false);
    const cancelVisible = await page
      .locator("button")
      .filter({ hasText: uiLabels.pattern("tiktokCancel") })
      .first()
      .isVisible()
      .catch(() => false);

    if (!soundSearchStillVisible && !cancelVisible) {
      console.log("Sound panel closed on its own after applying sound.");
      await page.waitForTimeout(800);
      return;
    }

    console.log(
      "WARNING: Could not click Save. Trying Cancel to avoid stuck panel."
    );
    await clickFirstVisibleEnabledLocator(
      page,
      page.locator("button").filter({ hasText: uiLabels.pattern("tiktokCancel") })
    );
    throw new Error("Could not click Save in sound editor.");
  }

  await page.waitForTimeout(1500);
}

async function disableShortContentCheck(page) {
  const labelPattern =
    uiLabels.pattern("tiktokShortContentCheck");
  const section = page
    .locator("section, div, li, form")
    .filter({ hasText: labelPattern })
    .first();

  if ((await section.count()) === 0) {
    console.log("Short content check toggle not found; continuing.");
    return;
  }

  async function readSwitchState(candidate) {
    return candidate.evaluate((el) => {
      const ariaChecked = (el.getAttribute("aria-checked") || "").toLowerCase();
      if (ariaChecked === "true") {
        return true;
      }
      if (ariaChecked === "false") {
        return false;
      }

      if (el instanceof HTMLInputElement && el.type === "checkbox") {
        return el.checked;
      }

      const className = (el.className || "").toString().toLowerCase();
      if (
        className.includes("checked") ||
        className.includes("active") ||
        className.includes("enabled") ||
        className.includes("on")
      ) {
        return true;
      }
      if (
        className.includes("disabled") ||
        className.includes("inactive") ||
        className.includes("off")
      ) {
        return false;
      }

      return null;
    });
  }

  const switchCandidates = [
    section.locator('[role="switch"]'),
    section.locator('button[aria-checked], button[class*="switch" i], button[class*="toggle" i]'),
    section.locator('input[type="checkbox"]'),
  ];

  for (const pool of switchCandidates) {
    const count = await pool.count();
    for (let i = 0; i < count; i += 1) {
      const candidate = pool.nth(i);
      const visible = await candidate.isVisible().catch(() => false);
      if (!visible) {
        continue;
      }

      await candidate.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => { });
      const before = await readSwitchState(candidate).catch(() => null);
      if (before === false) {
        console.log("Short content check already disabled.");
        return;
      }

      await candidate.click({ timeout: 3000, force: true }).catch(() => { });
      await page.waitForTimeout(800);
      const after = await readSwitchState(candidate).catch(() => null);

      if (after === false || (before === true && after !== true)) {
        console.log("Short content check disabled.");
        return;
      }
    }
  }

  console.log("Short content check toggle found but could not be switched off.");
}

async function clickFirstVisibleButton(page, nameRegex, timeout = 3000) {
  const button = page.getByRole("button", { name: nameRegex }).first();
  if ((await button.count()) === 0) {
    return false;
  }
  try {
    await button.click({ timeout });
    return true;
  } catch {
    return false;
  }
}

async function dismissInterferingOverlays(page) {
  // NOTE: never click a generic "Cancel" here: while uploading it cancels the upload.
  await dismissTikTokOverlays(page);

  // TikTok Studio sometimes opens "content checks" and other hints dialogs
  // that block the publish button; dismiss/accept them before publishing.
  const overlayActions = [
    uiLabels.pattern("tiktokContinue"),
    uiLabels.pattern("tiktokLater"),
  ];

  for (let pass = 0; pass < 3; pass += 1) {
    let clickedSomething = false;
    for (const action of overlayActions) {
      const clicked = await clickFirstVisibleButton(page, action, 1200);
      if (clicked) {
        clickedSomething = true;
        await page.waitForTimeout(400);
      }
    }

    const closeIcon = page
      .locator(uiLabels.attrSelector("button", "aria-label", "tiktokClose"))
      .first();
    if ((await closeIcon.count()) > 0) {
      await closeIcon.click({ timeout: 1200 }).catch(() => { });
      clickedSomething = true;
      await page.waitForTimeout(300);
    }

    if (!clickedSomething) {
      break;
    }
  }
}

async function scrollToBottom(page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
}

async function tryClickPublishButton(page) {
  // Strategy 1: exact text buttons (most reliable on TikTok Studio)
  const exactSelectors = [
    uiLabels.textSelector("button", "tiktokPublish"),
    uiLabels.textSelector('[role="button"]', "tiktokPublish"),
  ];

  for (const selector of exactSelectors) {
    const locator = page.locator(selector);
    const clicked = await clickFirstLikelyPublishLocator(page, locator);
    if (clicked) {
      console.log(`Publish click strategy: exact selector ${selector}`);
      return true;
    }
  }

  // Strategy 2: role-based labels.
  const roleTexts = [
    uiLabels.pattern("tiktokPublish"),
  ];

  for (const textPattern of roleTexts) {
    const button = page.getByRole("button", { name: textPattern });
    const clicked = await clickFirstLikelyPublishLocator(page, button);
    if (clicked) {
      console.log(`Publish click strategy: role ${textPattern}`);
      return true;
    }
  }

  // Strategy 3: CSS selectors for the red publish button
  const cssSelectors = [
    'button[class*="publish" i]',
    'button[class*="post-btn" i]',
    'button[class*="submit" i]',
    'div[class*="publish" i] button',
    'div[class*="btn-post" i]',
  ];

  for (const selector of cssSelectors) {
    const el = page.locator(selector);
    const clicked = await clickFirstLikelyPublishLocator(page, el);
    if (clicked) {
      console.log(`Publish click strategy: css ${selector}`);
      return true;
    }
  }

  // Strategy 4: find by visible text content (any clickable element)
  const textLabels = uiLabels.terms("tiktokPublish");

  for (const label of textLabels) {
    const el = page.locator(`text="${label}"`);
    const clicked = await clickFirstLikelyPublishLocator(page, el);
    if (clicked) {
      console.log(`Publish click strategy: text ${label}`);
      return true;
    }
  }

  // Strategy 5: brute-force - find any likely submit element by text.
  const publishTerms = uiLabels.terms("tiktokPublish").map((term) => term.toLowerCase());
  const clicked = await page.evaluate((labels) => {
    const normalize = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
    const normalizedLabels = labels.map(normalize).filter(Boolean);
    const isPublishText = (text) => {
      const exactMatch = normalizedLabels.includes(text);
      const nonAmbiguousMatch = normalizedLabels
        .filter((label) => label !== "post")
        .some((label) => text.includes(label));
      return exactMatch || nonAmbiguousMatch;
    };
    const isLikelyCandidate = (btn) => {
      const text = normalize(btn.textContent || btn.getAttribute("aria-label"));
      if (!text || text === "posts" || !isPublishText(text)) {
        return false;
      }
      if (btn.disabled || btn.getAttribute("aria-disabled") === "true") {
        return false;
      }
      if (
        btn.closest(
          "nav, aside, [role='navigation'], [class*='sidebar' i], [class*='side-bar' i], [class*='sidenav' i], [class*='side-nav' i], [class*='menu' i]"
        )
      ) {
        return false;
      }
      const anchor = btn.closest("a");
      const href = normalize(anchor ? anchor.getAttribute("href") : "");
      if (href && /\/(post|posts|analytics|comment|home|inspiration|monetization|academy|sound|feedback)(\/|$|\?)/i.test(href)) {
        return false;
      }
      const rect = btn.getBoundingClientRect();
      const mainContentBoundary = window.innerWidth >= 900 ? Math.min(300, window.innerWidth * 0.25) : 0;
      if (window.innerWidth >= 900 && rect.right <= mainContentBoundary) {
        return false;
      }
      const className = normalize(btn.className || "");
      const hasPublishCue = /\b(post|publish|submit)\b/.test(className);
      if (text === "post" && window.innerHeight >= 600 && rect.top < window.innerHeight * 0.5 && !hasPublishCue) {
        return false;
      }
      return true;
    };
    const scoreCandidate = (btn) => {
      const text = normalize(btn.textContent || btn.getAttribute("aria-label"));
      const rect = btn.getBoundingClientRect();
      const className = normalize(btn.className || "");
      let score = 0;
      if (normalizedLabels.includes(text)) score += 30;
      if (btn.tagName.toLowerCase() === "button") score += 20;
      if (normalize(btn.getAttribute("type")) === "submit") score += 20;
      if (/\b(post|publish|submit)\b/.test(className)) score += 20;
      if (rect.width >= 80 && rect.height >= 28) score += 15;
      if (window.innerHeight > 0 && rect.top >= window.innerHeight * 0.5) score += 60;
      if (window.innerWidth >= 900 && rect.left >= Math.min(300, window.innerWidth * 0.25)) score += 20;
      score += Math.min(20, Math.max(0, rect.top / 40));
      return score;
    };

    const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
    const candidates = buttons
      .filter(isLikelyCandidate)
      .map((btn) => ({ btn, score: scoreCandidate(btn), top: btn.getBoundingClientRect().top }))
      .sort((a, b) => b.score - a.score || b.top - a.top);
    if (candidates.length > 0) {
      candidates[0].btn.scrollIntoView({ block: "center" });
      candidates[0].btn.click();
      return true;
    }
    return false;
  }, publishTerms);
  if (clicked) {
    console.log("Publish click strategy: DOM evaluate fallback");
  }

  return clicked;
}

async function clickPublish(page) {
  await dismissInterferingOverlays(page);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    await scrollToBottom(page);
    await page.waitForTimeout(500);

    const clicked = await tryClickPublishButton(page);
    if (clicked) {
      console.log(`Publish button clicked on attempt ${attempt + 1}.`);
      return;
    }

    await dismissInterferingOverlays(page);
    await page.waitForTimeout(2000);
  }

  throw new Error("Could not find an enabled Publish/Post button after 6 attempts.");
}

function hasSuccessCueText(text) {
  const successPatterns = [
    uiLabels.pattern("tiktokPublished"),
  ];

  return successPatterns.some((pattern) => pattern.test(text));
}

function hasFailureCueText(text) {
  const failurePatterns = [
    uiLabels.pattern("tiktokFailed"),
  ];

  return failurePatterns.some((pattern) => pattern.test(text));
}

function isLikelyPublishApiResponse(response) {
  const url = response.url().toLowerCase();
  const method = response.request().method().toUpperCase();

  if (!["POST", "PUT", "PATCH"].includes(method)) {
    return false;
  }

  const urlPatterns = [
    "/publish",
    "/post",
    "/aweme",
    "/upload",
    "/creator",
    "/studio",
    "/web/project",
    "/web/post",
  ];

  return urlPatterns.some((pattern) => url.includes(pattern));
}

function createPublishResponseTracker(page) {
  let publishApiSuccess = false;
  let publishApiFailure = null;

  const responseHandler = (response) => {
    if (!isLikelyPublishApiResponse(response)) {
      return;
    }

    const status = response.status();
    const url = response.url();

    if (status >= 200 && status < 300) {
      publishApiSuccess = true;
      console.log(`Publish API success: ${status} ${url}`);
      return;
    }

    if (status >= 400) {
      publishApiFailure = `Publish API returned ${status}: ${url}`;
      console.log(publishApiFailure);
    }
  };

  page.on("response", responseHandler);

  return {
    dispose() {
      page.off("response", responseHandler);
    },
    failure() {
      return publishApiFailure;
    },
    success() {
      return publishApiSuccess;
    },
  };
}

async function trySecondaryPublishConfirm(page) {
  const confirmTerms = uiLabels
    .terms("tiktokConfirm")
    .filter((term) => normalizeUiText(term) !== "post");
  const confirmPattern = new RegExp(confirmTerms.map(escapeRegExp).join("|"), "i");
  const scopedConfirmLocator = page
    .locator(
      [
        "[role='dialog']",
        "[aria-modal='true']",
        "[class*='modal' i]",
        "[class*='dialog' i]",
        "[class*='popover' i]",
        "[class*='drawer' i]",
      ].join(", ")
    )
    .locator("button, [role='button']")
    .filter({ hasText: confirmPattern });
  const scopedClicked = await clickFirstLikelyPublishLocator(
    page,
    scopedConfirmLocator,
    confirmTerms
  );
  if (scopedClicked) {
    await page.waitForTimeout(500);
    return true;
  }

  const confirmLocator = page.getByRole("button", {
    name: confirmPattern,
  });
  const clicked = await clickFirstLikelyPublishLocator(
    page,
    confirmLocator,
    confirmTerms
  );
  if (clicked) {
    await page.waitForTimeout(500);
    return true;
  }

  return false;
}

async function waitForPublishConfirmation(page, responseTracker) {
  const startedUrl = page.url();
  const tracker = responseTracker || createPublishResponseTracker(page);
  const ownsTracker = !responseTracker;
  let primaryRetryCount = 0;

  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await dismissInterferingOverlays(page);

      const bodyText = await page
        .locator("body")
        .innerText()
        .then((value) => value || "")
        .catch(() => "");
      if (hasFailureCueText(bodyText)) {
        return {
          ok: false,
          reason: "TikTok displayed an error after publish click.",
        };
      }

      const publishApiFailure = tracker.failure();
      if (publishApiFailure) {
        return {
          ok: false,
          reason: publishApiFailure,
        };
      }

      if (tracker.success()) {
        return {
          ok: true,
          reason: "Publish API call succeeded.",
        };
      }

      if (hasSuccessCueText(bodyText)) {
        return {
          ok: true,
          reason: "Success confirmation text found.",
        };
      }

      await trySecondaryPublishConfirm(page);

      if (
        primaryRetryCount < 2 &&
        attempt > 0 &&
        attempt % 5 === 0 &&
        page.url().includes("/upload")
      ) {
        console.log("No publish confirmation yet; retrying the primary TikTok Post button.");
        const retried = await tryClickPublishButton(page);
        if (retried) {
          primaryRetryCount += 1;
          await page.waitForTimeout(1000);
        }
      }

      const urlChanged = page.url() !== startedUrl;
      if (urlChanged && !page.url().includes("/upload")) {
        return {
          ok: true,
          reason: `Navigation changed to ${page.url()}.`,
        };
      }

      await page.waitForTimeout(2000);
    }

    return {
      ok: false,
      reason: "No reliable publish confirmation observed within timeout.",
    };
  } finally {
    if (ownsTracker) {
      tracker.dispose();
    }
  }
}

async function waitForUploadReady(page) {
  await page.waitForTimeout(Math.max(config.postDelayMs, 5000));
}

async function holdBrowserBeforeClose(page, holdMs, reason) {
  if (!Number.isFinite(holdMs) || holdMs <= 0) {
    return;
  }

  console.log(`Holding browser for ${holdMs}ms (${reason}).`);
  await page.waitForTimeout(holdMs).catch(() => { });
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
  const saved = await hasSavedPlatformSession("tiktok", activeAccount.id);
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

async function startLoginSessionCli() {
  const result = await startLoginSession();

  console.log("");
  console.log("Log in to TikTok in the opened browser window.");
  console.log("After login is complete, press Ctrl+C in this terminal.");
  console.log("Your session will be reused for future automated posts.");
  console.log("");

  if (result.alreadyOpen) {
    return;
  }

  await new Promise(() => {
    // Keep process alive until manual interruption.
  });
}

async function dismissTikTokOverlays(page) {
  const clickBtn = async (re) =>
    page.getByRole("button", { name: re }).first().click({ timeout: 300 }).then(() => true).catch(() => false);
  // Accidental "cancel your upload?" prompt: answer No.
  if (await page.getByText(/Sure you want to cancel your upload\?/).first().isVisible().catch(() => false)) {
    await clickBtn(/^no$/i);
  }
  // Accidental "Discard this post?" prompt: keep the post.
  const discardPrompt = page.getByText(/^Discard this post\?$/).first();
  if (await discardPrompt.isVisible().catch(() => false)) {
    await clickBtn(uiLabels.exactPattern("tiktokNotNow"));
  }
  // Privacy-preserving choice: decline optional cookies.
  await clickBtn(uiLabels.exactPattern("tiktokDeclineCookies"));
  // Auto content checks prompt: Cancel, scoped to that prompt only.
  const heading = page.getByText(uiLabels.pattern("tiktokContentChecksHeading")).first();
  if (await heading.isVisible().catch(() => false)) {
    const box = page.locator(
      `xpath=//*[${uiLabels.terms("tiktokContentChecksText").map((t) => `contains(text(),"${t}")`).join(" or ")}]/ancestor::div[.//button[${uiLabels.terms("tiktokDialogCancel").map((t) => `normalize-space()="${t}"`).join(" or ")}]][1]`
    ).first();
    await box.getByRole("button", { name: uiLabels.exactPattern("tiktokDialogCancel") }).first().click({ timeout: 800 }).catch(() => { });
  }
  await clickBtn(uiLabels.exactPattern("tiktokGotIt"));
}

async function waitForTikTokUploaded(page) {
  const started = Date.now();
  const deadline = started + 20 * 60 * 1000;
  let seenUploading = false;
  for (let i = 0; Date.now() < deadline; i += 1) {
    await dismissTikTokOverlays(page);
    const text = await page.locator("body").innerText().catch(() => "");
    const uploading = /\d{1,3}(\.\d+)?\s?%/.test(text) || /\d+(\.\d+)?\s?[MG]B\s?\/\s?\d+(\.\d+)?\s?[MG]B/i.test(text);
    const cancelVisible = await page.getByRole("button", { name: /^cancel$/i }).first().isVisible().catch(() => false);
    if (uploading || cancelVisible) seenUploading = true;
    // The form can render before the upload card: do not return before the card was seen.
    const settled = seenUploading || Date.now() - started > 20000;
    if (settled && uiLabels.pattern("tiktokWhenToPost").test(text) && !uploading && !cancelVisible) return;
    await page.waitForTimeout(1500);
  }
  throw new Error("TikTok upload did not finish in time.");
}

async function setTikTokVisibility(page) {
  const vis = String(process.env.TIKTOK_VISIBILITY || "").toLowerCase();
  if (!vis || vis === "public" || vis === "everyone") return;
  const label = vis === "private" || vis === "only me" ? /^only (me|you)$/i : vis === "friends" ? /^friends$/i : null;
  if (!label) throw new Error(`Unknown TIKTOK_VISIBILITY: ${vis}`);
  await page.getByText(/^Everyone$/).first().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.getByText(label).first().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await dbgShot(page, "after-visibility");
  // Guard: the selected value must really be the private one before publishing.
  if (label.source.includes("only")) {
    const ok = await page.getByText(/^only (me|you)$/i).first().isVisible().catch(() => false);
    if (!ok) throw new Error("Visibility did not switch to Only you; not publishing.");
  }
}

async function dumpTikTok(page, name) {
  if (!process.env.TIKTOK_DEBUG) return;
  const base = path.resolve(config.projectRoot, `debug-tt-${name}`);
  await page.screenshot({ path: `${base}.png` }).catch(() => { });
  const html = await page.locator("body").evaluate((el) => el.outerHTML).catch(() => "");
  await require("fs/promises").writeFile(`${base}.html`, html).catch(() => { });
}

async function findInputByValue(page, re) {
  const inputs = page.locator("input");
  const n = await inputs.count();
  for (let i = 0; i < n; i += 1) {
    const value = await inputs.nth(i).inputValue().catch(() => "");
    if (re.test(value)) return inputs.nth(i);
  }
  return null;
}

// The scrolling list ignores a plain click, so send the full event sequence.
async function pressTimeItem(item) {
  await item.evaluate((el) => {
    el.scrollIntoView({ block: "center" });
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      const Ctor = type.startsWith("pointer") ? PointerEvent : MouseEvent;
      el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, composed: true }));
    }
  });
}

async function setTikTokSchedule(page, when) {
  const pad = (v) => String(v).padStart(2, "0");
  const wantDate = `${when.year}-${pad(when.month)}-${pad(when.day)}`;
  const wantTime = `${pad(when.hour)}:${pad(when.minute)}`;
  if (when.minute % 5 !== 0) throw new Error("TikTok schedule minutes must be a multiple of 5.");

  await page.locator('input[type="radio"][value="schedule"]').first().evaluate((el) => el.click());
  await page.waitForTimeout(1500);
  await dumpTikTok(page, "sched-1-radio");

  const dateInput = await findInputByValue(page, /^\d{4}-\d{2}-\d{2}$/);
  const timeInput = await findInputByValue(page, /^\d{2}:\d{2}$/);
  if (!dateInput || !timeInput) throw new Error("TikTok schedule date/time inputs not found.");

  await dateInput.click({ timeout: 5000 });
  await page.waitForTimeout(800);
  await dumpTikTok(page, "sched-2-date");
  await goToTikTokMonth(page, when);
  const dayCell = page.locator('.calendar-wrapper [class*="day"]:not([class*="disabled"])')
    .filter({ hasText: new RegExp(`^${when.day}$`) }).first();
  await dayCell.click({ timeout: 5000 });
  await page.waitForTimeout(800);

  await timeInput.click({ timeout: 5000 });
  await page.waitForTimeout(1200);
  await dumpTikTok(page, "sched-3-time");
  await pressTimeItem(page.locator(".tiktok-timepicker-left").filter({ hasText: new RegExp(`^${pad(when.hour)}$`) }).first());
  await page.waitForTimeout(800);
  await pressTimeItem(page.locator(".tiktok-timepicker-right").filter({ hasText: new RegExp(`^${pad(when.minute)}$`) }).first());
  await page.waitForTimeout(800);
  // Close the time list so it does not cover other controls: click an empty area.
  await page.mouse.click(700, 30);
  await page.waitForTimeout(500);
  await dumpTikTok(page, "sched-4-set");

  // Guard: do not publish if the date and time on screen differ from the request.
  const shownDate = await dateInput.inputValue();
  const shownTime = await timeInput.inputValue();
  console.log(`TikTok schedule shown: ${shownDate} ${shownTime}`);
  if (shownDate !== wantDate || shownTime !== wantTime) {
    throw new Error(`Schedule mismatch: wanted ${wantDate} ${wantTime}, screen shows ${shownDate} ${shownTime}.`);
  }
}

// Uploads our own image through the "Edit cover" dialog.
async function setTikTokCover(page, coverPath) {
  await page.getByText(uiLabels.exactPattern("tiktokEditCover")).first().click({ timeout: 8000 });
  await page.waitForTimeout(1500);
  await dumpTikTok(page, "cover-1-open");
  // This button opens a native file dialog: listen first so Playwright intercepts it.
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 8000 });
  await page.getByText(uiLabels.exactPattern("tiktokUploadCover")).first().click({ timeout: 8000 });
  const chooser = await chooserPromise;
  await chooser.setFiles(coverPath);
  await page.waitForTimeout(2500);
  await dumpTikTok(page, "cover-3-file");
  await page.getByRole("button", { name: uiLabels.exactPattern("tiktokCoverSave") }).last().click({ timeout: 8000 });
  await page.waitForTimeout(2000);
  await dumpTikTok(page, "cover-4-saved");
  console.log("TikTok cover uploaded.");
}

async function goToTikTokMonth(page, when) {
  const title = (await page.locator(".calendar-wrapper .month-title").first().innerText()).trim().toLowerCase();
  const shownYear = Number((await page.locator(".calendar-wrapper .year-title").first().innerText()).trim());
  const shownMonth = uiLabels.TIKTOK_MONTHS.findIndex((names) => names.includes(title)) + 1;
  if (!shownMonth || !shownYear) throw new Error(`Unknown TikTok calendar header: ${title} ${shownYear}.`);
  const steps = (when.year * 12 + when.month) - (shownYear * 12 + shownMonth);
  if (steps < 0) throw new Error("TikTok calendar is past the requested month.");
  const nextArrow = page.locator(".calendar-wrapper .month-header-wrapper .arrow").last();
  for (let i = 0; i < steps; i += 1) {
    await nextArrow.click({ timeout: 3000 });
    await page.waitForTimeout(400);
  }
}

function tikTokMainButton(page) {
  return page.locator('[data-e2e="post_video_button"]').first();
}

// "Post" publishes immediately: only click when the main button is an enabled "Schedule".
async function waitForTikTokScheduleButton(page) {
  const button = tikTokMainButton(page);
  for (let i = 0; i < 60; i += 1) {
    const label = (await button.innerText().catch(() => "")).trim();
    const disabled = await button.getAttribute("data-disabled").catch(() => "true");
    if (uiLabels.exactPattern("tiktokScheduleButton").test(label) && disabled === "false") {
      console.log(`TikTok main button ready: ${label}`);
      return;
    }
    await page.waitForTimeout(1500);
  }
  throw new Error("TikTok main button never became an enabled Schedule button; not publishing.");
}

async function clickTikTokScheduleButton(page) {
  await tikTokMainButton(page).click({ timeout: 8000 });
}

async function dbgShot(page, name) {
  if (!process.env.TIKTOK_DEBUG) return;
  await page.screenshot({ path: path.resolve(config.projectRoot, `debug-tt-${name}.png`), fullPage: true }).catch(() => { });
}

async function uploadVideo({ videoPath, caption, scheduleAt, coverPath, source, accountId }) {
  const absoluteVideoPath = path.resolve(videoPath);
  const context = await openPersistentContext(accountId);
  const page = context.pages()[0] || (await context.newPage());
  let closeHoldMs = 0;
  let publishResponseTracker = null;

  try {
    const when = scheduleAt ? parseSchedule(scheduleAt) : null;
    await gotoUploadPage(page);
    await page.waitForTimeout(3000);
    // Unsaved-draft banner from an earlier aborted run: discard it.
    await page.getByRole("button", { name: uiLabels.exactPattern("tiktokDiscardDraft") }).first().click({ timeout: 2500 }).catch(() => { });
    await page.getByRole("button", { name: uiLabels.exactPattern("tiktokDeclineCookies") }).first().click({ timeout: 2500 }).catch(() => { });
    await setVideoFile(page, absoluteVideoPath);
    await dbgShot(page, "after-select");
    await waitForTikTokUploaded(page);
    await dismissTikTokOverlays(page);
    await waitForUploadReady(page);
    await dbgShot(page, "after-ready");
    await setCaption(page, caption || config.defaultCaption);
    if (caption) {
      // Guard: do not publish an incomplete caption (the hashtag line can get dropped).
      const typed = await page.locator('div[contenteditable="true"]').first().innerText().catch(() => "");
      const norm = (t) => t.replace(/\s+/g, "");
      console.log(`TikTok caption typed: ${typed.replace(/\s+/g, " ").slice(0, 200)}`);
      if (norm(typed) !== norm(caption)) throw new Error("TikTok caption does not match the intended text.");
    }
    await addDefaultSound(page, source).catch((error) => {
      console.log(`Sound step failed softly: ${error.message}`);
    });
    await disableShortContentCheck(page);
    if (coverPath) {
      await setTikTokCover(page, coverPath);
    }
    if (when) {
      await setTikTokSchedule(page, when);
      await waitForTikTokScheduleButton(page);
    } else {
      await setTikTokVisibility(page);
    }
    await dbgShot(page, "before-publish");
    if (process.env.TIKTOK_DRY_RUN) {
      throw new Error("DRY RUN: stopped before Publish.");
    }
    publishResponseTracker = createPublishResponseTracker(page);
    if (when) {
      await clickTikTokScheduleButton(page);
    } else {
      await clickPublish(page);
    }
    const confirmation = await waitForPublishConfirmation(page, publishResponseTracker);
    if (!confirmation.ok) {
      throw new Error(`Publish verification failed: ${confirmation.reason}`);
    }

    const successScreenshotPath = path.resolve(
      config.projectRoot,
      "last-upload-success.png"
    );
    await page
      .screenshot({ path: successScreenshotPath, fullPage: true })
      .catch(() => { });

    closeHoldMs = Math.max(config.postPublishHoldMs, 0);
    return { ok: true };
  } catch (error) {
    const screenshotPath = path.resolve(
      config.projectRoot,
      "last-upload-error.png"
    );
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => { });
    closeHoldMs = Math.max(config.failureHoldMs, 0);
    return {
      ok: false,
      error: error.message,
      screenshotPath,
    };
  } finally {
    if (publishResponseTracker) {
      publishResponseTracker.dispose();
    }
    await holdBrowserBeforeClose(page, closeHoldMs, "post-finalization");
    await context.close();
  }
}

module.exports = {
  startLoginSession: startLoginSessionCli,
  startDashboardLoginSession: startLoginSession,
  getLoginSessionStatus,
  closeLoginSession,
  uploadVideo,
  _private: {
    getPublishCandidateScore,
    isLikelyPublishCandidateInfo,
  },
};
