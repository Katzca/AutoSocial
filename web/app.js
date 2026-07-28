const API = createApiClient();

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const Router = {
  init() {
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        this.navigate(view);
      });
    });
  },

  navigate(viewName) {
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === viewName);
    });
    document.querySelectorAll(".view-section").forEach((sec) => {
      sec.classList.toggle("active", sec.id === `view-${viewName}`);
    });
    document.dispatchEvent(new CustomEvent("autosocial:viewchange", { detail: { viewName } }));
  },
};

const UI = {
  accountState: {
    tiktok: { loginOpen: false, sessionSaved: false, schedulerRunning: false },
    instagram: { loginOpen: false, sessionSaved: false, schedulerRunning: false },
    youtube: { loginOpen: false, sessionSaved: false, schedulerRunning: false },
    brands: [],
    activeBrandId: null,
    activeBrandName: "",
  },
  scheduleDraftDirty: {
    tiktok: false,
    instagram: false,
    youtube: false,
  },

  els: {
    brandSelect: document.getElementById("brandSelect"),
    addBrandBtn: document.getElementById("addBrandBtn"),
    brandCreateRow: document.getElementById("brandCreateRow"),
    brandNameInput: document.getElementById("brandNameInput"),
    saveBrandBtn: document.getElementById("saveBrandBtn"),
    cancelBrandBtn: document.getElementById("cancelBrandBtn"),
    activeBrandLabel: document.getElementById("activeBrandLabel"),
    statusBadge: document.getElementById("statusBadge"),
    setupRefreshBtn: document.getElementById("setupRefreshBtn"),
    setupSummaryIcon: document.getElementById("setupSummaryIcon"),
    setupSummaryTitle: document.getElementById("setupSummaryTitle"),
    setupSummaryMeta: document.getElementById("setupSummaryMeta"),
    setupMetrics: document.getElementById("setupMetrics"),
    setupChecksList: document.getElementById("setupChecksList"),
    setupSessionsList: document.getElementById("setupSessionsList"),
    setupFoldersList: document.getElementById("setupFoldersList"),
    setupNextSteps: document.getElementById("setupNextSteps"),

    pendingCount: document.getElementById("pendingCount"),
    successCount: document.getElementById("successCount"),
    failedCount: document.getElementById("failedCount"),
    activeAccountsCount: document.getElementById("activeAccountsCount"),
    overviewProfilesContainer: document.getElementById("overviewProfilesContainer"),

    ttQueueList: document.getElementById("ttQueueList"),
    logsContainer: document.getElementById("logsContainer"),
    ttLogsContainer: document.getElementById("ttLogsContainer"),
    accountsTableBody: document.getElementById("accountsTableBody"),

    ttRunBtn: document.getElementById("ttRunBtn"),
    ttStartBtn: document.getElementById("ttStartBtn"),
    ttStopBtn: document.getElementById("ttStopBtn"),
    ttCronInput: document.getElementById("ttCronInput"),
    ttUpdateScheduleBtn: document.getElementById("ttUpdateScheduleBtn"),
    ttPlanType: document.getElementById("ttPlanType"),
    ttPlanTime: document.getElementById("ttPlanTime"),
    ttPlanTimes: document.getElementById("ttPlanTimes"),
    ttPlanWeekday: document.getElementById("ttPlanWeekday"),
    ttPlanApplyBtn: document.getElementById("ttPlanApplyBtn"),
    ttPendingCount: document.getElementById("ttPendingCount"),
    ttPostedCount: document.getElementById("ttPostedCount"),
    ttFailedCount: document.getElementById("ttFailedCount"),
    ttSchedulerState: document.getElementById("ttSchedulerState"),
    ttTimezoneLabel: document.getElementById("ttTimezoneLabel"),
    ttLastRunLabel: document.getElementById("ttLastRunLabel"),
    ttInstantPostToggle: document.getElementById("ttInstantPostToggle"),
    ttAutoAddSoundToggle: document.getElementById("ttAutoAddSoundToggle"),
    ttSoundQueryInput: document.getElementById("ttSoundQueryInput"),
    ttSoundQuerySaveBtn: document.getElementById("ttSoundQuerySaveBtn"),
    ttRandomQueueToggle: document.getElementById("ttRandomQueueToggle"),
    igRunBtn: document.getElementById("igRunBtn"),
    igStartBtn: document.getElementById("igStartBtn"),
    igStopBtn: document.getElementById("igStopBtn"),
    igCronInput: document.getElementById("igCronInput"),
    igUpdateScheduleBtn: document.getElementById("igUpdateScheduleBtn"),
    igPlanType: document.getElementById("igPlanType"),
    igPlanTime: document.getElementById("igPlanTime"),
    igPlanTimes: document.getElementById("igPlanTimes"),
    igPlanWeekday: document.getElementById("igPlanWeekday"),
    igPlanApplyBtn: document.getElementById("igPlanApplyBtn"),
    igPendingCount: document.getElementById("igPendingCount"),
    igPostedCount: document.getElementById("igPostedCount"),
    igFailedCount: document.getElementById("igFailedCount"),
    igSchedulerState: document.getElementById("igSchedulerState"),
    igTimezoneLabel: document.getElementById("igTimezoneLabel"),
    igLastRunLabel: document.getElementById("igLastRunLabel"),
    igInstantPostToggle: document.getElementById("igInstantPostToggle"),
    igRandomQueueToggle: document.getElementById("igRandomQueueToggle"),
    igQueueList: document.getElementById("igQueueList"),
    igLogsContainer: document.getElementById("igLogsContainer"),
    ytRunBtn: document.getElementById("ytRunBtn"),
    ytStartBtn: document.getElementById("ytStartBtn"),
    ytStopBtn: document.getElementById("ytStopBtn"),
    ytCronInput: document.getElementById("ytCronInput"),
    ytUpdateScheduleBtn: document.getElementById("ytUpdateScheduleBtn"),
    ytPlanType: document.getElementById("ytPlanType"),
    ytPlanTime: document.getElementById("ytPlanTime"),
    ytPlanTimes: document.getElementById("ytPlanTimes"),
    ytPlanWeekday: document.getElementById("ytPlanWeekday"),
    ytPlanApplyBtn: document.getElementById("ytPlanApplyBtn"),
    ytPendingCount: document.getElementById("ytPendingCount"),
    ytPostedCount: document.getElementById("ytPostedCount"),
    ytFailedCount: document.getElementById("ytFailedCount"),
    ytSchedulerState: document.getElementById("ytSchedulerState"),
    ytTimezoneLabel: document.getElementById("ytTimezoneLabel"),
    ytLastRunLabel: document.getElementById("ytLastRunLabel"),
    ytInstantPostToggle: document.getElementById("ytInstantPostToggle"),
    ytRandomQueueToggle: document.getElementById("ytRandomQueueToggle"),
    ytQueueList: document.getElementById("ytQueueList"),
    ytLogsContainer: document.getElementById("ytLogsContainer"),

    uniqStartBtn: document.getElementById("uniqStartBtn"),
    uniqStopBtn: document.getElementById("uniqStopBtn"),
    uniqOpenInputBtn: document.getElementById("uniqOpenInputBtn"),
    uniqOpenOutputBtn: document.getElementById("uniqOpenOutputBtn"),
    uniqInputDir: document.getElementById("uniqInputDir"),
    uniqOutputDir: document.getElementById("uniqOutputDir"),
    uniqLogoImage: document.getElementById("uniqLogoImage"),
    uniqState: document.getElementById("uniqState"),
    uniqProgress: document.getElementById("uniqProgress"),
    uniqSucceeded: document.getElementById("uniqSucceeded"),
    uniqFailed: document.getElementById("uniqFailed"),
    uniqInputFiles: document.getElementById("uniqInputFiles"),
    uniqOutputFiles: document.getElementById("uniqOutputFiles"),
    uniqLogs: document.getElementById("uniqLogs"),

    adStartBtn: document.getElementById("adStartBtn"),
    adStopBtn: document.getElementById("adStopBtn"),
    adChannel: document.getElementById("adChannel"),
    adInterval: document.getElementById("adInterval"),
    adMaxVideos: document.getElementById('adMaxVideos'),
    adPlatTiktok: document.getElementById('adPlatTiktok'),
    adPlatInstagram: document.getElementById("adPlatInstagram"),
    adPlatYoutube: document.getElementById("adPlatYoutube"),
    adSaveSettingsBtn: document.getElementById("adSaveSettingsBtn"),
    adWatcherState: document.getElementById("adWatcherState"),
    adTotalDownloaded: document.getElementById("adTotalDownloaded"),
    adLastCheck: document.getElementById("adLastCheck"),
    adLogsContainer: document.getElementById("adLogsContainer"),
    defaultCaptionInput: document.getElementById("defaultCaptionInput"),
    defaultCaptionSaveBtn: document.getElementById("defaultCaptionSaveBtn"),

    // Profile Downloader
    pdChannel: document.getElementById("pdChannel"),
    pdMaxVideos: document.getElementById("pdMaxVideos"),
    pdMinViews: document.getElementById("pdMinViews"),
    pdStartBtn: document.getElementById("pdStartBtn"),
    pdScanBtn: document.getElementById("pdScanBtn"),
    pdOpenFolderBtn: document.getElementById("pdOpenFolderBtn"),
    pdLogsContainer: document.getElementById("pdLogsContainer"),
    pdStatusBadge: document.getElementById("pdStatusBadge"),
  },

  init() {
    Router.init();
    this.bindEvents();
    this.updateFriendlyScheduleVisibility("tiktok");
    this.updateFriendlyScheduleVisibility("instagram");
    this.updateFriendlyScheduleVisibility("youtube");
    this.startPolling();
    this.renderAccounts();
  },

  bindEvents() {
    if (this.els.brandSelect) {
      this.els.brandSelect.addEventListener("change", (event) =>
        this.handleBrandSelect(event.target.value)
      );
    }
    if (this.els.addBrandBtn) {
      this.els.addBrandBtn.addEventListener("click", () => this.handleAddBrand());
    }
    if (this.els.saveBrandBtn) {
      this.els.saveBrandBtn.addEventListener("click", () => this.handleCreateBrand());
    }
    if (this.els.cancelBrandBtn) {
      this.els.cancelBrandBtn.addEventListener("click", () => this.hideBrandCreator());
    }
    if (this.els.brandNameInput) {
      this.els.brandNameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.handleCreateBrand();
        } else if (event.key === "Escape") {
          this.hideBrandCreator();
        }
      });
    }

    if (this.els.ttStartBtn) {
      this.els.ttStartBtn.addEventListener("click", () => this.handleAction("/api/start"));
    }
    if (this.els.ttStopBtn) {
      this.els.ttStopBtn.addEventListener("click", () => this.handleAction("/api/stop"));
    }
    if (this.els.ttRunBtn) {
      this.els.ttRunBtn.addEventListener("click", () => this.handleAction("/api/run-once"));
    }
    if (this.els.ttUpdateScheduleBtn) {
      this.els.ttUpdateScheduleBtn.addEventListener("click", () =>
        this.handleUpdateSchedule(true)
      );
    }
    if (this.els.ttPlanType) {
      this.els.ttPlanType.addEventListener("change", () =>
        this.handleFriendlyScheduleDraftChange("tiktok")
      );
    }
    if (this.els.ttPlanTime) {
      this.els.ttPlanTime.addEventListener("change", () =>
        this.handleFriendlyScheduleDraftChange("tiktok")
      );
    }
    if (this.els.ttPlanWeekday) {
      this.els.ttPlanWeekday.addEventListener("change", () =>
        this.handleFriendlyScheduleDraftChange("tiktok")
      );
    }
    if (this.els.ttPlanTimes) {
      this.els.ttPlanTimes.addEventListener("input", () =>
        this.handleFriendlyScheduleDraftChange("tiktok")
      );
    }
    if (this.els.ttPlanApplyBtn) {
      this.els.ttPlanApplyBtn.addEventListener("click", () =>
        this.handleFriendlySchedule("tiktok")
      );
    }
    if (this.els.ttInstantPostToggle) {
      this.els.ttInstantPostToggle.addEventListener("change", (e) =>
        this.handleInstantPostToggle("tiktok", e.target.checked)
      );
    }

    if (this.els.ttAutoAddSoundToggle) {
      this.els.ttAutoAddSoundToggle.addEventListener("change", async (e) => {
        try {
          const result = await API.post("/api/settings/save", {
            payload: { AUTO_ADD_SOUND: e.target.checked }
          });
          if (result?.ok === false && result?.error) {
            alert(result.error);
            e.target.checked = !e.target.checked; // Revert visually on error
          }
          this.refresh();
        } catch (err) {
          alert(`Failed to save auto-add sound setting: ${err.message}`);
          e.target.checked = !e.target.checked;
        }
      });
    }
    if (this.els.setupRefreshBtn) {
      this.els.setupRefreshBtn.addEventListener("click", () => this.refreshSetupHealth());
    }
    if (this.els.setupFoldersList) {
      this.els.setupFoldersList.addEventListener("click", (event) =>
        this.handleSetupFolderClick(event)
      );
    }
    document.addEventListener("autosocial:viewchange", (event) => {
      if (event.detail?.viewName === "setup") {
        this.refreshSetupHealth();
      }
    });

    if (this.els.ttSoundQuerySaveBtn) {
      this.els.ttSoundQuerySaveBtn.addEventListener("click", () =>
        this.handleSaveTextSetting(
          "DEFAULT_SOUND_QUERY",
          this.els.ttSoundQueryInput,
          this.els.ttSoundQuerySaveBtn,
          "Save Sound",
          "Sound query"
        )
      );
    }

    if (this.els.ttRandomQueueToggle) {
      this.els.ttRandomQueueToggle.addEventListener("change", (e) =>
        this.handleRandomQueueToggle(e.target.checked)
      );
    }

    if (this.els.igStartBtn) {
      this.els.igStartBtn.addEventListener("click", () =>
        this.handleAction("/api/instagram/start")
      );
    }
    if (this.els.igStopBtn) {
      this.els.igStopBtn.addEventListener("click", () =>
        this.handleAction("/api/instagram/stop")
      );
    }
    if (this.els.igRunBtn) {
      this.els.igRunBtn.addEventListener("click", () =>
        this.handleAction("/api/instagram/run-once")
      );
    }
    if (this.els.igUpdateScheduleBtn) {
      this.els.igUpdateScheduleBtn.addEventListener("click", () =>
        this.handleUpdateSchedule(false, true)
      );
    }
    if (this.els.igPlanType) {
      this.els.igPlanType.addEventListener("change", () =>
        this.handleFriendlyScheduleDraftChange("instagram")
      );
    }
    if (this.els.igPlanTime) {
      this.els.igPlanTime.addEventListener("change", () =>
        this.handleFriendlyScheduleDraftChange("instagram")
      );
    }
    if (this.els.igPlanWeekday) {
      this.els.igPlanWeekday.addEventListener("change", () =>
        this.handleFriendlyScheduleDraftChange("instagram")
      );
    }
    if (this.els.igPlanTimes) {
      this.els.igPlanTimes.addEventListener("input", () =>
        this.handleFriendlyScheduleDraftChange("instagram")
      );
    }
    if (this.els.igPlanApplyBtn) {
      this.els.igPlanApplyBtn.addEventListener("click", () =>
        this.handleFriendlySchedule("instagram")
      );
    }
    if (this.els.igInstantPostToggle) {
      this.els.igInstantPostToggle.addEventListener("change", () =>
        this.handleInstantPostToggle("instagram", this.els.igInstantPostToggle.checked)
      );
    }
    if (this.els.igRandomQueueToggle) {
      this.els.igRandomQueueToggle.addEventListener("change", () =>
        this.handleRandomQueueToggle(this.els.igRandomQueueToggle.checked)
      );
    }
    if (this.els.ytStartBtn) {
      this.els.ytStartBtn.addEventListener("click", () =>
        this.handleAction("/api/youtube/start")
      );
    }
    if (this.els.ytStopBtn) {
      this.els.ytStopBtn.addEventListener("click", () =>
        this.handleAction("/api/youtube/stop")
      );
    }
    if (this.els.ytRunBtn) {
      this.els.ytRunBtn.addEventListener("click", () =>
        this.handleAction("/api/youtube/run-once")
      );
    }
    if (this.els.ytUpdateScheduleBtn) {
      this.els.ytUpdateScheduleBtn.addEventListener("click", () =>
        this.handleUpdateSchedule(false, false, true)
      );
    }
    if (this.els.ytPlanType) {
      this.els.ytPlanType.addEventListener("change", () =>
        this.handleFriendlyScheduleDraftChange("youtube")
      );
    }
    if (this.els.ytPlanTime) {
      this.els.ytPlanTime.addEventListener("change", () =>
        this.handleFriendlyScheduleDraftChange("youtube")
      );
    }
    if (this.els.ytPlanWeekday) {
      this.els.ytPlanWeekday.addEventListener("change", () =>
        this.handleFriendlyScheduleDraftChange("youtube")
      );
    }
    if (this.els.ytPlanTimes) {
      this.els.ytPlanTimes.addEventListener("input", () =>
        this.handleFriendlyScheduleDraftChange("youtube")
      );
    }
    if (this.els.ytPlanApplyBtn) {
      this.els.ytPlanApplyBtn.addEventListener("click", () =>
        this.handleFriendlySchedule("youtube")
      );
    }
    if (this.els.ytInstantPostToggle) {
      this.els.ytInstantPostToggle.addEventListener("change", () =>
        this.handleInstantPostToggle("youtube", this.els.ytInstantPostToggle.checked)
      );
    }
    if (this.els.ytRandomQueueToggle) {
      this.els.ytRandomQueueToggle.addEventListener("change", () =>
        this.handleRandomQueueToggle(this.els.ytRandomQueueToggle.checked)
      );
    }
    if (this.els.accountsTableBody) {
      this.els.accountsTableBody.addEventListener("click", (event) =>
        this.handleAccountsTableClick(event)
      );
    }

    if (this.els.uniqStartBtn) {
      this.els.uniqStartBtn.addEventListener("click", () => this.handleUniquifierStart());
    }
    if (this.els.uniqStopBtn) {
      this.els.uniqStopBtn.addEventListener("click", () => this.handleUniquifierStop());
    }
    if (this.els.uniqOpenInputBtn) {
      this.els.uniqOpenInputBtn.addEventListener("click", () =>
        this.handleOpenFolder("input", this.els.uniqInputDir?.value)
      );
    }
    if (this.els.uniqOpenOutputBtn) {
      this.els.uniqOpenOutputBtn.addEventListener("click", () =>
        this.handleOpenFolder("output", this.els.uniqOutputDir?.value)
      );
    }

    // Auto-download events
    if (this.els.adStartBtn) {
      this.els.adStartBtn.addEventListener("click", () => this.handleAutoDownloadAction("/api/autodownload/start"));
    }
    if (this.els.adStopBtn) {
      this.els.adStopBtn.addEventListener("click", () => this.handleAutoDownloadAction("/api/autodownload/stop"));
    }
    if (this.els.adSaveSettingsBtn) {
      this.els.adSaveSettingsBtn.addEventListener("click", () => this.handleAutoDownloadSave());
    }
    if (this.els.defaultCaptionSaveBtn) {
      this.els.defaultCaptionSaveBtn.addEventListener("click", () =>
        this.handleSaveTextSetting(
          "DEFAULT_CAPTION",
          this.els.defaultCaptionInput,
          this.els.defaultCaptionSaveBtn,
          "Save Caption",
          "Default caption"
        )
      );
    }

    // Profile Downloader Listeners
    if (this.els.pdStartBtn) {
      this.els.pdStartBtn.addEventListener("click", () => this.handleProfileDownloadStart(false));
    }
    if (this.els.pdScanBtn) {
      this.els.pdScanBtn.addEventListener("click", () => this.handleProfileDownloadStart(true));
    }
    if (this.els.pdOpenFolderBtn) {
      this.els.pdOpenFolderBtn.addEventListener("click", () => this.handleProfileDownloadOpenFolder());
    }
  },

  async handleAddBrand() {
    if (!this.els.brandCreateRow) {
      const name = prompt("Brand name?");
      if (!name || !name.trim()) return;
      try {
        const result = await API.post("/api/accounts/add", { name: name.trim() });
        if (result?.ok === false && result?.error) {
          alert(result.error);
        }
        await this.refresh();
      } catch (err) {
        alert(`Could not add brand: ${err.message}`);
      }
      return;
    }

    this.els.brandCreateRow.classList.remove("hidden");
    if (this.els.brandNameInput) {
      this.els.brandNameInput.value = "";
      this.els.brandNameInput.focus();
    }
  },

  hideBrandCreator() {
    if (!this.els.brandCreateRow) return;
    this.els.brandCreateRow.classList.add("hidden");
    if (this.els.brandNameInput) {
      this.els.brandNameInput.value = "";
    }
  },

  async handleCreateBrand() {
    const name = this.els.brandNameInput?.value?.trim();
    if (!name) return;
    try {
      const result = await API.post("/api/accounts/add", { name });
      if (result?.ok === false && result?.error) {
        alert(result.error);
        return;
      }
      this.hideBrandCreator();
      await this.refresh();
    } catch (err) {
      alert(`Could not add brand: ${err.message}`);
    }
  },

  async handleBrandSelect(accountId) {
    if (!accountId || accountId === this.accountState.activeBrandId) return;
    try {
      await API.post("/api/accounts/select", { accountId });
      await this.refresh();
      if (this.isViewActive("setup")) {
        await this.refreshSetupHealth();
      }
    } catch (err) {
      alert(`Could not switch brand: ${err.message}`);
    }
  },

  isViewActive(viewName) {
    return document.getElementById(`view-${viewName}`)?.classList.contains("active");
  },

  statusMeta(status) {
    const map = {
      ok: { label: "Ready", icon: "ph-check-circle", className: "ok" },
      warn: { label: "Needs attention", icon: "ph-warning-circle", className: "warn" },
      fail: { label: "Blocked", icon: "ph-x-circle", className: "fail" },
    };
    return map[status] || map.warn;
  },

  async refreshSetupHealth() {
    if (this.els.setupRefreshBtn) {
      this.els.setupRefreshBtn.disabled = true;
      this.els.setupRefreshBtn.innerHTML = '<i class="ph ph-circle-notch"></i> Checking';
    }

    try {
      const health = await API.get("/api/setup/health");
      this.renderSetupHealth(health);
    } catch (err) {
      if (this.els.setupSummaryTitle) this.els.setupSummaryTitle.textContent = "Setup check failed";
      if (this.els.setupSummaryMeta) this.els.setupSummaryMeta.textContent = err.message;
      if (this.els.setupChecksList) {
        this.els.setupChecksList.innerHTML = `
          <div class="setup-empty error">Could not load setup health: ${escapeHtml(err.message)}</div>
        `;
      }
    } finally {
      if (this.els.setupRefreshBtn) {
        this.els.setupRefreshBtn.disabled = false;
        this.els.setupRefreshBtn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Refresh';
      }
    }
  },

  renderSetupHealth(health) {
    if (!health || typeof health !== "object") return;
    const summary = this.statusMeta(health.overall);
    const activeBrand = health.activeAccount?.name || "Default";
    const updated = health.generatedAt ? new Date(health.generatedAt).toLocaleTimeString() : "just now";

    if (this.els.setupSummaryIcon) {
      this.els.setupSummaryIcon.className = `setup-summary-icon ${summary.className}`;
      this.els.setupSummaryIcon.innerHTML = `<i class="ph ${summary.icon}"></i>`;
    }
    if (this.els.setupSummaryTitle) {
      this.els.setupSummaryTitle.textContent =
        health.overall === "ok" ? "This workstation is ready" : "Review setup items before posting";
    }
    if (this.els.setupSummaryMeta) {
      this.els.setupSummaryMeta.textContent = `Active brand: ${activeBrand} - Last checked ${updated}`;
    }
    if (this.els.setupMetrics) {
      const counts = health.counts || {};
      this.els.setupMetrics.innerHTML = `
        <div class="setup-metric">
          <span class="setup-metric-value ok">${counts.ok ?? 0}</span>
          <span class="setup-metric-label">Ready</span>
        </div>
        <div class="setup-metric">
          <span class="setup-metric-value warn">${counts.warn ?? 0}</span>
          <span class="setup-metric-label">Warnings</span>
        </div>
        <div class="setup-metric">
          <span class="setup-metric-value fail">${counts.fail ?? 0}</span>
          <span class="setup-metric-label">Blocking</span>
        </div>
      `;
    }

    if (this.els.setupChecksList) {
      this.els.setupChecksList.innerHTML = (health.checks || [])
        .map((check) => {
          const meta = this.statusMeta(check.status);
          return `
            <div class="setup-check-item ${meta.className}">
              <div class="setup-check-icon"><i class="ph ${meta.icon}"></i></div>
              <div class="setup-check-body">
                <div class="setup-check-title">${escapeHtml(check.label)}</div>
                <div class="setup-check-detail">${escapeHtml(check.detail)}</div>
                ${check.status === "ok" ? "" : `<div class="setup-check-action">${escapeHtml(check.action)}</div>`}
              </div>
            </div>
          `;
        })
        .join("");
    }

    if (this.els.setupSessionsList) {
      this.els.setupSessionsList.innerHTML = (health.sessions || [])
        .map((session) => {
          const meta = this.statusMeta(session.saved ? "ok" : "warn");
          return `
            <div class="setup-check-item ${meta.className}">
              <div class="setup-check-icon"><i class="ph ${meta.icon}"></i></div>
              <div class="setup-check-body">
                <div class="setup-check-title">${escapeHtml(session.label)}</div>
                <div class="setup-check-detail">${escapeHtml(session.saved ? "Saved session found" : "No saved session yet")}</div>
                <div class="setup-path">${escapeHtml(session.profileDir)}</div>
              </div>
            </div>
          `;
        })
        .join("");
    }

    if (this.els.setupFoldersList) {
      this.els.setupFoldersList.innerHTML = (health.folders || [])
        .map((folder) => {
          const meta = this.statusMeta(folder.exists ? "ok" : "fail");
          return `
            <div class="setup-folder-item">
              <div class="setup-folder-main">
                <div class="setup-folder-title">
                  <span class="setup-check-icon ${meta.className}"><i class="ph ${meta.icon}"></i></span>
                  ${escapeHtml(folder.label)}
                </div>
                <div class="setup-check-detail">${escapeHtml(folder.hint)}</div>
                <div class="setup-path">${escapeHtml(folder.path)}</div>
                <div class="setup-folder-meta">${folder.pendingCount ?? 0} video file(s) - ${escapeHtml((folder.supported || []).join(", "))}</div>
              </div>
              <button class="control-btn-small" data-setup-folder="${escapeHtml(folder.key)}">
                <i class="ph ph-folder-open"></i> Open
              </button>
            </div>
          `;
        })
        .join("");
    }

    if (this.els.setupNextSteps) {
      this.els.setupNextSteps.innerHTML = (health.nextSteps || [])
        .map(
          (step, index) => `
            <div class="setup-step">
              <span class="setup-step-number">${index + 1}</span>
              <span>${escapeHtml(step)}</span>
            </div>
          `
        )
        .join("");
    }
  },

  async handleSetupFolderClick(event) {
    const button = event.target.closest("button[data-setup-folder]");
    if (!button) return;
    button.disabled = true;
    try {
      await API.post("/api/setup/open-folder", { key: button.dataset.setupFolder });
    } catch (err) {
      alert(`Could not open folder: ${err.message}`);
    } finally {
      button.disabled = false;
    }
  },

  async handleAction(endpoint) {
    try {
      const result = await API.post(endpoint);
      if (result && result.skipped && result.reason) {
        alert(result.reason);
      } else if (result && result.ok === false && result.error) {
        alert(result.error);
      }
      this.refresh();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
  },

  getPlatformScheduleControls(platform) {
    const map = {
      tiktok: {
        type: this.els.ttPlanType,
        time: this.els.ttPlanTime,
        times: this.els.ttPlanTimes,
        weekday: this.els.ttPlanWeekday,
        cronInput: this.els.ttCronInput,
      },
      instagram: {
        type: this.els.igPlanType,
        time: this.els.igPlanTime,
        times: this.els.igPlanTimes,
        weekday: this.els.igPlanWeekday,
        cronInput: this.els.igCronInput,
      },
      youtube: {
        type: this.els.ytPlanType,
        time: this.els.ytPlanTime,
        times: this.els.ytPlanTimes,
        weekday: this.els.ytPlanWeekday,
        cronInput: this.els.ytCronInput,
      },
    };
    return map[platform];
  },

  getPlatformEndpoints(platform) {
    const map = {
      tiktok: { schedule: "/api/schedule", runOnce: "/api/run-once" },
      instagram: { schedule: "/api/instagram/schedule", runOnce: "/api/instagram/run-once" },
      youtube: { schedule: "/api/youtube/schedule", runOnce: "/api/youtube/run-once" },
    };
    return map[platform];
  },

  markScheduleDraftDirty(platform, dirty = true) {
    if (!Object.prototype.hasOwnProperty.call(this.scheduleDraftDirty, platform)) return;
    this.scheduleDraftDirty[platform] = dirty;
  },

  isScheduleDraftDirty(platform) {
    return Boolean(this.scheduleDraftDirty[platform]);
  },

  handleFriendlyScheduleDraftChange(platform) {
    this.markScheduleDraftDirty(platform, true);
    this.updateFriendlyScheduleVisibility(platform);
  },

  updateFriendlyScheduleVisibility(platform) {
    const controls = this.getPlatformScheduleControls(platform);
    if (
      !controls?.type ||
      !controls?.time ||
      !controls?.times ||
      !controls?.weekday ||
      !controls?.cronInput
    ) {
      return;
    }
    const mode = controls.type.value;
    controls.weekday.style.display = mode === "weekly" ? "" : "none";
    controls.time.style.display = /^every\d+h$/.test(mode) || mode === "dailyTimes" ? "none" : "";
    controls.times.style.display = mode === "dailyTimes" ? "" : "none";
    controls.cronInput.disabled = mode !== "custom";
  },

  parseCronToFriendly(cronExpression) {
    const cron = (cronExpression || "").trim();
    const daily = cron.match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/);
    if (daily) {
      const minute = String(Number(daily[1])).padStart(2, "0");
      const hour = String(Number(daily[2])).padStart(2, "0");
      return { mode: "daily", time: `${hour}:${minute}` };
    }

    const weekly = cron.match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+([0-6])$/);
    if (weekly) {
      const minute = String(Number(weekly[1])).padStart(2, "0");
      const hour = String(Number(weekly[2])).padStart(2, "0");
      return { mode: "weekly", time: `${hour}:${minute}`, weekday: weekly[3] };
    }

    const everyNh = cron.match(/^(\d{1,2})\s+\*\/(\d{1,2})\s+\*\s+\*\s+\*$/);
    if (everyNh) {
      const step = Number(everyNh[2]);
      if ([2, 3, 4, 6, 8, 12].includes(step)) {
        return { mode: `every${step}h` };
      }
    }

    return { mode: "custom" };
  },

  applyFriendlyScheduleFromCron(platform, cronExpression) {
    if (this.isScheduleDraftDirty(platform)) {
      this.updateFriendlyScheduleVisibility(platform);
      return;
    }
    const controls = this.getPlatformScheduleControls(platform);
    if (!controls?.type) return;
    const parsed = this.parseCronToFriendly(cronExpression);
    if (controls.type && document.activeElement !== controls.type) {
      controls.type.value = parsed.mode;
    }
    if (controls.time && parsed.time && document.activeElement !== controls.time) {
      controls.time.value = parsed.time;
    }
    if (controls.weekday && parsed.weekday && document.activeElement !== controls.weekday) {
      controls.weekday.value = parsed.weekday;
    }
    this.updateFriendlyScheduleVisibility(platform);
  },

  applySchedulePlanFromStatus(platform, statusData) {
    const controls = this.getPlatformScheduleControls(platform);
    if (!controls?.type) return;
    const plan = statusData?.schedulePlan;
    if (plan?.type === "daily-times") {
      if (!this.isScheduleDraftDirty(platform)) {
        controls.type.value = "dailyTimes";
        if (controls.times && document.activeElement !== controls.times) {
          controls.times.value = (plan.times || []).join(", ");
        }
      }
      this.updateFriendlyScheduleVisibility(platform);
      return;
    }

    this.applyFriendlyScheduleFromCron(platform, statusData?.cronExpression || "");
  },

  buildCronFromFriendly(mode, timeValue, weekdayValue) {
    const everyMatch = /^every(\d+)h$/.exec(mode || "");
    if (everyMatch) {
      const step = Number(everyMatch[1]);
      if ([2, 3, 4, 6, 8, 12].includes(step)) {
        return `0 */${step} * * *`;
      }
    }
    if (mode === "daily" || mode === "weekly") {
      const [hourRaw, minuteRaw] = (timeValue || "12:00").split(":");
      const hour = Math.min(Math.max(Number(hourRaw) || 0, 0), 23);
      const minute = Math.min(Math.max(Number(minuteRaw) || 0, 0), 59);
      if (mode === "daily") {
        return `${minute} ${hour} * * *`;
      }
      const weekday = ["0", "1", "2", "3", "4", "5", "6"].includes(String(weekdayValue))
        ? String(weekdayValue)
        : "1";
      return `${minute} ${hour} * * ${weekday}`;
    }
    return null;
  },

  parseTimesInput(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  },

  async handleFriendlySchedule(platform) {
    const controls = this.getPlatformScheduleControls(platform);
    const endpoints = this.getPlatformEndpoints(platform);
    if (!controls?.type || !endpoints) return;

    const mode = controls.type.value;
    if (mode === "once") {
      this.markScheduleDraftDirty(platform, false);
      await this.handleAction(endpoints.runOnce);
      return;
    }

    if (mode === "dailyTimes") {
      const parsedTimes = this.parseTimesInput(controls.times?.value);
      if (!parsedTimes.length) {
        alert("Please enter at least one time, e.g. 09:30, 13:15, 20:45");
        return;
      }
      try {
        await API.post(`${endpoints.schedule}-plan`, {
          type: "daily-times",
          times: parsedTimes,
        });
        this.markScheduleDraftDirty(platform, false);
        await this.refresh();
      } catch (err) {
        alert(`Schedule update failed: ${err.message}`);
      }
      return;
    }

    if (mode === "custom") {
      const cronExpression = controls.cronInput?.value?.trim();
      if (!cronExpression) {
        alert("Please enter a cron expression.");
        return;
      }
      try {
        await API.post(endpoints.schedule, { expression: cronExpression });
        this.markScheduleDraftDirty(platform, false);
        await this.refresh();
      } catch (err) {
        alert(`Schedule update failed: ${err.message}`);
      }
      return;
    }

    const cronExpression = this.buildCronFromFriendly(
      mode,
      controls.time?.value,
      controls.weekday?.value
    );
    if (!cronExpression) return;
    try {
      await API.post(endpoints.schedule, { expression: cronExpression });
      this.markScheduleDraftDirty(platform, false);
      await this.refresh();
    } catch (err) {
      alert(`Schedule update failed: ${err.message}`);
    }
  },

  async handleUpdateSchedule(
    fromTikTokView,
    fromInstagramView = false,
    fromYouTubeView = false
  ) {
    const platform = fromYouTubeView
      ? "youtube"
      : fromInstagramView
        ? "instagram"
        : "tiktok";
    const input = platform === "youtube"
      ? this.els.ytCronInput
      : platform === "instagram"
        ? this.els.igCronInput
        : this.els.ttCronInput;
    const saveBtn = platform === "youtube"
      ? this.els.ytUpdateScheduleBtn
      : platform === "instagram"
        ? this.els.igUpdateScheduleBtn
        : this.els.ttUpdateScheduleBtn;
    if (!input || !saveBtn) return;

    const expression = input.value.trim();
    if (!expression) return;

    try {
      const defaultLabel = "Save Schedule";
      saveBtn.textContent = "Saved!";
      setTimeout(() => {
        saveBtn.textContent = defaultLabel;
      }, 2000);

      const endpoint = fromYouTubeView
        ? "/api/youtube/schedule"
        : fromInstagramView
          ? "/api/instagram/schedule"
          : "/api/schedule";
      await API.post(endpoint, { expression });
      this.markScheduleDraftDirty(platform, false);
      this.refresh();
    } catch (err) {
      alert(`Schedule update failed: ${err.message}`);
    }
  },

  async handleUniquifierStart() {
    try {
      await API.post("/api/uniquifier/start", {
        inputDir: this.els.uniqInputDir?.value?.trim(),
        outputDir: this.els.uniqOutputDir?.value?.trim(),
        logoImage: this.els.uniqLogoImage?.value?.trim(),
      });
      await this.refresh();
    } catch (err) {
      alert(`Uniquifier start failed: ${err.message}`);
    }
  },

  async handleUniquifierStop() {
    try {
      await API.post("/api/uniquifier/stop");
      await this.refresh();
    } catch (err) {
      alert(`Uniquifier stop failed: ${err.message}`);
    }
  },

  async handleOpenFolder(kind, folderPath) {
    try {
      await API.post("/api/uniquifier/open-folder", {
        kind,
        folderPath: folderPath || undefined,
      });
    } catch (err) {
      alert(`Could not open folder: ${err.message}`);
    }
  },

  async handleInstantPostToggle(platform, enabled) {
    const endpointMap = {
      tiktok: "/api/instant-post",
      instagram: "/api/instagram/instant-post",
      youtube: "/api/youtube/instant-post",
    };
    const toggleMap = {
      tiktok: this.els.ttInstantPostToggle,
      instagram: this.els.igInstantPostToggle,
      youtube: this.els.ytInstantPostToggle,
    };
    try {
      await API.post(endpointMap[platform], { enabled });
      this.refresh();
    } catch (err) {
      alert(`Could not toggle instant post: ${err.message}`);
      if (toggleMap[platform]) {
        toggleMap[platform].checked = !enabled;
      }
    }
  },

  async handleRandomQueueToggle(enabled) {
    const toggles = [
      this.els.ttRandomQueueToggle,
      this.els.igRandomQueueToggle,
      this.els.ytRandomQueueToggle,
    ].filter(Boolean);
    try {
      const result = await API.post("/api/settings/save", {
        payload: { RANDOM_QUEUE_ORDER: enabled },
      });
      if (result?.ok === false && result?.error) {
        throw new Error(result.error);
      }
      this.refresh();
    } catch (err) {
      alert(`Could not update random queue order: ${err.message}`);
      toggles.forEach((toggle) => {
        toggle.checked = !enabled;
      });
    }
  },

  async handleSaveTextSetting(envKey, inputEl, buttonEl, idleLabel, label) {
    if (!inputEl) return;

    try {
      const result = await API.post("/api/settings/save", {
        payload: { [envKey]: inputEl.value || "" },
      });
      if (result?.ok === false && result?.error) {
        throw new Error(result.error);
      }
      if (buttonEl) {
        buttonEl.innerHTML = '<i class="ph ph-check"></i> Saved!';
        setTimeout(() => {
          buttonEl.textContent = idleLabel;
        }, 2000);
      }
      this.refresh();
    } catch (err) {
      alert(`${label} save failed: ${err.message}`);
    }
  },

  async handleInstagramLogin() {
    await this.handlePlatformLogin("instagram");
  },

  async handleYouTubeLogin() {
    await this.handlePlatformLogin("youtube");
  },

  async handlePlatformLogin(platform) {
    const endpointMap = {
      tiktok: "/api/tiktok/login",
      instagram: "/api/instagram/login",
      youtube: "/api/youtube/login",
    };
    const labelMap = {
      tiktok: "TikTok",
      instagram: "Instagram",
      youtube: "YouTube",
    };
    try {
      const result = await API.post(endpointMap[platform]);
      if (result.alreadyOpen) {
        alert(`${labelMap[platform]} login browser is already open.`);
      } else {
        alert(`${labelMap[platform]} Chromium opened. Please log in there once.`);
      }
      await this.refresh();
    } catch (err) {
      alert(`${labelMap[platform]} login failed: ${err.message}`);
    }
  },

  async handlePlatformCloseLogin(platform) {
    const endpointMap = {
      tiktok: "/api/tiktok/login/close",
      instagram: "/api/instagram/login/close",
      youtube: "/api/youtube/login/close",
    };
    const labelMap = {
      tiktok: "TikTok",
      instagram: "Instagram",
      youtube: "YouTube",
    };
    try {
      const result = await API.post(endpointMap[platform]);
      if (!result.alreadyClosed) {
        alert(`${labelMap[platform]} login browser closed.`);
      }
      await this.refresh();
    } catch (err) {
      alert(`Could not close ${labelMap[platform]} login browser: ${err.message}`);
    }
  },

  async handleAccountsTableClick(event) {
    const button = event.target.closest("button[data-platform][data-action]");
    if (!button) return;
    const { platform, action } = button.dataset;
    if (action === "login") {
      await this.handlePlatformLogin(platform);
      return;
    }
    if (action === "close") {
      await this.handlePlatformCloseLogin(platform);
    }
  },

  startPolling() {
    this.refresh();
    setInterval(() => this.refresh(), 3000);
  },

  async refresh() {
    try {
      const [
        status,
        instagramStatus,
        youtubeStatus,
        uniquifier,
        accounts,
        tiktokLoginStatus,
        instagramLoginStatus,
        youtubeLoginStatus,
      ] = await Promise.all([
        API.get("/api/status"),
        API.get("/api/instagram/status"),
        API.get("/api/youtube/status"),
        API.get("/api/uniquifier/status"),
        API.get("/api/accounts"),
        API.get("/api/tiktok/login/status"),
        API.get("/api/instagram/login/status"),
        API.get("/api/youtube/login/status"),
      ]);
      // Fetch autodownload status in parallel but don't block others
      API.get("/api/autodownload/status").then((ad) => this.renderAutoDownloadStatus(ad)).catch(() => { });
      API.get("/api/profile-download/status").then((pd) => this.renderProfileDownloadStatus(pd)).catch(() => { });
      API.get("/api/overview").then((ov) => this.renderOverview(ov)).catch(() => { });

      this.renderStatus(status);
      this.renderInstagramStatus(instagramStatus);
      this.renderYouTubeStatus(youtubeStatus);
      this.renderUniquifierStatus(uniquifier);
      this.renderBrandSelector(accounts);
      this.accountState = {
        tiktok: {
          loginOpen: Boolean(tiktokLoginStatus?.open),
          sessionSaved: Boolean(tiktokLoginStatus?.saved),
          schedulerRunning: Boolean(status?.running),
        },
        instagram: {
          loginOpen: Boolean(instagramLoginStatus?.open),
          sessionSaved: Boolean(instagramLoginStatus?.saved),
          schedulerRunning: Boolean(instagramStatus?.running),
        },
        youtube: {
          loginOpen: Boolean(youtubeLoginStatus?.open),
          sessionSaved: Boolean(youtubeLoginStatus?.saved),
          schedulerRunning: Boolean(youtubeStatus?.running),
        },
        brands: accounts?.accounts || [],
        activeBrandId: accounts?.activeAccountId || null,
        activeBrandName: accounts?.activeAccount?.name || "",
      };
      this.renderAccounts();
    } catch (err) {
      console.warn("Polling error", err);
    }
  },

  updateLogContainer(container, html) {
    if (!container) return;
    const nextHtml = html || "";
    if (container.innerHTML === nextHtml) return;

    const topThreshold = 24;
    const wasNearTop = container.scrollTop <= topThreshold;
    const bottomOffset = Math.max(
      0,
      container.scrollHeight - container.clientHeight - container.scrollTop
    );

    container.innerHTML = nextHtml;

    if (wasNearTop) {
      container.scrollTop = 0;
      return;
    }

    container.scrollTop = Math.max(
      0,
      container.scrollHeight - container.clientHeight - bottomOffset
    );
  },

  renderBrandSelector(data) {
    if (!this.els.brandSelect || !data) return;
    const brands = Array.isArray(data.accounts) ? data.accounts : [];
    const activeAccountId = data.activeAccountId || brands[0]?.id || "";
    const currentValue = this.els.brandSelect.value;

    this.els.brandSelect.innerHTML = brands
      .map((brand) => `<option value="${escapeHtml(brand.id)}">${escapeHtml(brand.name)}</option>`)
      .join("");

    if (brands.some((brand) => brand.id === currentValue)) {
      this.els.brandSelect.value = currentValue;
    } else {
      this.els.brandSelect.value = activeAccountId;
    }
  },

  renderOverview(overviewData) {
    if (!overviewData || typeof overviewData !== "object") return;
    const container = this.els.overviewProfilesContainer;
    if (!container) return;

    const platformMeta = {
      tiktok: {
        label: "TikTok",
        icon: "ph-tiktok-logo",
        color: "#ff0050",
        bg: "linear-gradient(135deg,#00f2ea,#ff0050)",
      },
      instagram: {
        label: "Instagram",
        icon: "ph-instagram-logo",
        color: "#E1306C",
        bg: "linear-gradient(135deg,#833AB4,#E1306C,#F77737)",
      },
      youtube: {
        label: "YouTube",
        icon: "ph-youtube-logo",
        color: "#FF0000",
        bg: "#FF0000",
      },
    };

    const escapeHtml = (value) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    const getProfileName = (profileId) => {
      const brands = this.accountState?.brands || [];
      const match = brands.find((brand) => brand.id === profileId);
      return match?.name || profileId;
    };

    const formatSchedule = (status) => {
      if (status?.schedulePlan?.type === "daily-times") {
        const times = Array.isArray(status.schedulePlan.times) && status.schedulePlan.times.length
          ? status.schedulePlan.times.join(", ")
          : "Not set";
        return `Daily: ${times}`;
      }
      if (status?.cronExpression) {
        return `Cron: ${status.cronExpression}`;
      }
      return "Not scheduled";
    };

    const formatLastRun = (status) => (
      status?.lastRunAt ? new Date(status.lastRunAt).toLocaleString() : "Never"
    );

    const getBadge = (status) => {
      if (status?.isPosting) {
        return { text: "Posting", color: "var(--status-warn)" };
      }
      if (status?.running) {
        return { text: "Running", color: "var(--status-good)" };
      }
      return { text: "Stopped", color: "var(--status-bad)" };
    };

    let totalPending = 0;
    let totalPosted = 0;
    let totalFailed = 0;
    let activeSchedulers = 0;
    const allLogs = [];
    const profileSections = [];

    for (const [profileId, statuses] of Object.entries(overviewData)) {
      const profileName = getProfileName(profileId);
      const cards = [];

      for (const [platformKey, meta] of Object.entries(platformMeta)) {
        const status = statuses?.[platformKey];
        if (!status) continue;

        const queueCounts = status.queue?.counts || {};
        const pending = Number(queueCounts.pending || 0);
        const posted = Number(queueCounts.posted || 0);
        const failed = Number(queueCounts.failed || 0);
        const badge = getBadge(status);

        totalPending += pending;
        totalPosted += posted;
        totalFailed += failed;
        if (status.running) {
          activeSchedulers += 1;
        }

        for (const log of status.logs || []) {
          allLogs.push({ ...log, platform: meta.label, profile: profileName });
        }

        cards.push(`
          <div class="card" style="border-left:3px solid ${meta.color};">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
              <div class="brand-icon" style="background:${meta.bg}; width:34px; height:34px; font-size:18px;">
                <i class="ph ${meta.icon}"></i>
              </div>
              <div style="min-width:0;">
                <div style="font-weight:600; font-size:15px;">${escapeHtml(meta.label)}</div>
                <div class="status-badge" style="margin-top:4px; color:${badge.color}; border:1px solid ${badge.color}; background:rgba(255,255,255,0.03);">
                  ${escapeHtml(badge.text)}
                </div>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; text-align:center;">
              <div>
                <div style="font-size:22px; font-weight:700;">${pending}</div>
                <div style="font-size:11px; color:var(--text-muted);">Pending</div>
              </div>
              <div>
                <div style="font-size:22px; font-weight:700; color:var(--success);">${posted}</div>
                <div style="font-size:11px; color:var(--text-muted);">Posted</div>
              </div>
              <div>
                <div style="font-size:22px; font-weight:700; color:var(--danger);">${failed}</div>
                <div style="font-size:11px; color:var(--text-muted);">Failed</div>
              </div>
            </div>
            <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06); font-size:12px; color:var(--text-muted);">
              <div><i class="ph ph-clock"></i> ${escapeHtml(formatSchedule(status))}</div>
              <div style="margin-top:4px;"><i class="ph ph-calendar-blank"></i> Last: ${escapeHtml(formatLastRun(status))}</div>
            </div>
          </div>
        `);
      }

      if (cards.length > 0) {
        profileSections.push(`
          <div style="margin-bottom:22px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; font-size:14px; font-weight:600; color:var(--text-primary);">
              <i class="ph ph-user"></i>
              <span>${escapeHtml(profileName)}</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px;">
              ${cards.join("")}
            </div>
          </div>
        `);
      }
    }

    container.innerHTML = profileSections.join("") || `
      <div class="card full-width">
        <div style="text-align:center; padding:28px; color:var(--text-muted);">No profile overview data yet.</div>
      </div>
    `;

    const setValue = (el, value) => {
      if (el) el.textContent = value;
    };
    setValue(this.els.pendingCount, totalPending);
    setValue(this.els.successCount, totalPosted);
    setValue(this.els.failedCount, totalFailed);
    setValue(this.els.activeAccountsCount, activeSchedulers);

    allLogs.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    const recentLogs = allLogs.slice(0, 50);

    const logsHtml = recentLogs.length
      ? recentLogs.map((logEntry) => {
        const time = logEntry.at ? new Date(logEntry.at).toLocaleTimeString() : "";
        const color = logEntry.level === "error" ? "var(--danger)" : "var(--text-muted)";
        const platformColor = logEntry.platform === "TikTok"
          ? "#ff0050"
          : logEntry.platform === "Instagram"
            ? "#E1306C"
            : "#FF0000";
        return `<div class="log-entry" style="color:${color}">
          <span style="opacity:0.5;">${escapeHtml(time)}</span>
          <span style="color:${platformColor}; font-weight:600; font-size:11px;">[${escapeHtml(logEntry.platform)}]</span>
          <span style="opacity:0.4; font-size:10px;">${escapeHtml(logEntry.profile || "")}</span>
          ${escapeHtml(logEntry.message || "")}
        </div>`;
      }).join("")
      : '<div style="text-align:center; padding:20px; color:#666;">No logs yet</div>';
    this.updateLogContainer(this.els.logsContainer, logsHtml);
  },
  renderStatus(data) {
    const pending = data.queue?.counts?.pending ?? 0;
    const posted = data.queue?.counts?.posted ?? 0;
    const failed = data.queue?.counts?.failed ?? 0;
    const pendingVideos = data.queue?.pendingVideos || [];
    const timezone = data.timezone || "UTC";
    const lastRunText = data.lastRunAt
      ? new Date(data.lastRunAt).toLocaleString()
      : "Never";


    if (this.els.ttPendingCount) this.els.ttPendingCount.textContent = pending;
    if (this.els.ttPostedCount) this.els.ttPostedCount.textContent = posted;
    if (this.els.ttFailedCount) this.els.ttFailedCount.textContent = failed;
    if (this.els.ttSchedulerState) {
      this.els.ttSchedulerState.textContent = data.running ? "Running" : "Stopped";
      this.els.ttSchedulerState.classList.toggle("success", Boolean(data.running));
      this.els.ttSchedulerState.classList.toggle("error", !data.running);
    }

    // Sync instant-post toggle
    if (this.els.ttInstantPostToggle && document.activeElement !== this.els.ttInstantPostToggle) {
      this.els.ttInstantPostToggle.checked = Boolean(data.instantPost);
    }

    if (this.els.ttAutoAddSoundToggle && document.activeElement !== this.els.ttAutoAddSoundToggle) {
      this.els.ttAutoAddSoundToggle.checked = Boolean(data.autoAddSound);
    }

    if (this.els.ttSoundQueryInput && document.activeElement !== this.els.ttSoundQueryInput) {
      this.els.ttSoundQueryInput.value = data.defaultSoundQuery || "";
    }

    if (this.els.ttRandomQueueToggle && document.activeElement !== this.els.ttRandomQueueToggle) {
      this.els.ttRandomQueueToggle.checked = Boolean(data.randomQueueOrder);
    }

    const logHtml = (data.logs || [])
      .slice()
      .reverse()
      .map(
        (logEntry) => `
      <div class="log-entry">
        <span class="log-time">${logEntry.at.split("T")[1].split(".")[0]}</span>
        <span class="log-msg ${logEntry.level === "error" ? "log-error" : ""}">${escapeHtml(logEntry.message)}</span>
      </div>
    `
      )
      .join("");
    this.updateLogContainer(this.els.ttLogsContainer, logHtml);

    const queueHtml = pendingVideos.length
      ? pendingVideos
        .map((video) => {
          const videoName = typeof video === "string" ? video : video.name;
          const hasCaption = typeof video === "object" && video.hasCaption;
          return `
      <div class="queue-item">
        <div style="display:flex; align-items:center; gap:10px;">
          <i class="ph ph-file-video" style="font-size:20px;"></i>
          <span>${escapeHtml(videoName)}</span>
          ${hasCaption ? '<span class="status-badge" style="background:rgba(255,255,255,0.1); color:#ccc; border:1px solid #444; margin-left:8px;"><i class="ph ph-text-align-left"></i> Caption</span>' : ''}
        </div>
        <span class="status-badge active">Pending</span>
      </div>
    `;
        })
        .join("")
      : '<div style="text-align:center; padding:20px; color:#666;">Queue is empty</div>';
    if (this.els.ttQueueList) this.els.ttQueueList.innerHTML = queueHtml;

    if (
      this.els.ttCronInput &&
      document.activeElement !== this.els.ttCronInput &&
      !this.isScheduleDraftDirty("tiktok")
    ) {
      this.els.ttCronInput.value = data.cronExpression || "";
    }
    this.applySchedulePlanFromStatus("tiktok", data);

    if (this.els.ttTimezoneLabel) this.els.ttTimezoneLabel.textContent = timezone;
    if (this.els.ttLastRunLabel) this.els.ttLastRunLabel.textContent = lastRunText;
    if (this.els.defaultCaptionInput && document.activeElement !== this.els.defaultCaptionInput) {
      this.els.defaultCaptionInput.value = data.defaultCaption || "";
    }

    if (this.els.statusBadge) {
      const textEl = this.els.statusBadge.querySelector("span");
      const dot = this.els.statusBadge.querySelector(".connection-dot");
      const isPosting = Boolean(data.isPosting);
      const running = Boolean(data.running);
      if (textEl) {
        textEl.textContent = isPosting
          ? "Posting in progress"
          : running
            ? "Scheduler running"
            : "Scheduler stopped";
      }
      if (dot) {
        const color = isPosting
          ? "var(--status-warn)"
          : running
            ? "var(--status-good)"
            : "var(--status-bad)";
        dot.style.backgroundColor = color;
        dot.style.boxShadow = `0 0 8px ${color}`;
      }
    }
  },

  renderInstagramStatus(data) {
    const pending = data.queue?.counts?.pending ?? 0;
    const posted = data.queue?.counts?.posted ?? 0;
    const failed = data.queue?.counts?.failed ?? 0;
    const pendingVideos = data.queue?.pendingVideos || [];
    const timezone = data.timezone || "UTC";
    const lastRunText = data.lastRunAt ? new Date(data.lastRunAt).toLocaleString() : "Never";

    if (this.els.igPendingCount) this.els.igPendingCount.textContent = pending;
    if (this.els.igPostedCount) this.els.igPostedCount.textContent = posted;
    if (this.els.igFailedCount) this.els.igFailedCount.textContent = failed;
    if (this.els.igSchedulerState) {
      this.els.igSchedulerState.textContent = data.running ? "Running" : "Stopped";
      this.els.igSchedulerState.classList.toggle("success", Boolean(data.running));
      this.els.igSchedulerState.classList.toggle("error", !data.running);
    }

    // Sync instant-post toggle
    if (this.els.igInstantPostToggle && document.activeElement !== this.els.igInstantPostToggle) {
      this.els.igInstantPostToggle.checked = Boolean(data.instantPost);
    }

    if (this.els.igRandomQueueToggle && document.activeElement !== this.els.igRandomQueueToggle) {
      this.els.igRandomQueueToggle.checked = Boolean(data.randomQueueOrder);
    }

    const logsHtml = (data.logs || [])
      .slice()
      .reverse()
      .map(
        (logEntry) => `
      <div class="log-entry">
        <span class="log-time">${logEntry.at.split("T")[1].split(".")[0]}</span>
        <span class="log-msg ${logEntry.level === "error" ? "log-error" : ""}">${escapeHtml(logEntry.message)}</span>
      </div>
    `
      )
      .join("");
    this.updateLogContainer(this.els.igLogsContainer, logsHtml);

    const queueHtml = pendingVideos.length
      ? pendingVideos
        .map((video) => {
          const videoName = typeof video === "string" ? video : video.name;
          const hasCaption = typeof video === "object" && video.hasCaption;
          return `
      <div class="queue-item">
        <div style="display:flex; align-items:center; gap:10px;">
          <i class="ph ph-file-video" style="font-size:20px;"></i>
          <span>${escapeHtml(videoName)}</span>
          ${hasCaption ? '<span class="status-badge" style="background:rgba(255,255,255,0.1); color:#ccc; border:1px solid #444; margin-left:8px;"><i class="ph ph-text-align-left"></i> Caption</span>' : ''}
        </div>
        <span class="status-badge active">Pending</span>
      </div>
    `;
        })
        .join("")
      : '<div style="text-align:center; padding:20px; color:#666;">Queue is empty</div>';
    if (this.els.igQueueList) this.els.igQueueList.innerHTML = queueHtml;

    if (
      this.els.igCronInput &&
      document.activeElement !== this.els.igCronInput &&
      !this.isScheduleDraftDirty("instagram")
    ) {
      this.els.igCronInput.value = data.cronExpression || "";
    }
    this.applySchedulePlanFromStatus("instagram", data);
    if (this.els.igTimezoneLabel) this.els.igTimezoneLabel.textContent = timezone;
    if (this.els.igLastRunLabel) this.els.igLastRunLabel.textContent = lastRunText;
  },

  renderYouTubeStatus(data) {
    const pending = data.queue?.counts?.pending ?? 0;
    const posted = data.queue?.counts?.posted ?? 0;
    const failed = data.queue?.counts?.failed ?? 0;
    const pendingVideos = data.queue?.pendingVideos || [];
    const timezone = data.timezone || "UTC";
    const lastRunText = data.lastRunAt ? new Date(data.lastRunAt).toLocaleString() : "Never";

    if (this.els.ytPendingCount) this.els.ytPendingCount.textContent = pending;
    if (this.els.ytPostedCount) this.els.ytPostedCount.textContent = posted;
    if (this.els.ytFailedCount) this.els.ytFailedCount.textContent = failed;
    if (this.els.ytSchedulerState) {
      this.els.ytSchedulerState.textContent = data.running ? "Running" : "Stopped";
      this.els.ytSchedulerState.classList.toggle("success", Boolean(data.running));
      this.els.ytSchedulerState.classList.toggle("error", !data.running);
    }

    // Sync instant-post toggle
    if (this.els.ytInstantPostToggle && document.activeElement !== this.els.ytInstantPostToggle) {
      this.els.ytInstantPostToggle.checked = Boolean(data.instantPost);
    }

    if (this.els.ytRandomQueueToggle && document.activeElement !== this.els.ytRandomQueueToggle) {
      this.els.ytRandomQueueToggle.checked = Boolean(data.randomQueueOrder);
    }

    const logsHtml = (data.logs || [])
      .slice()
      .reverse()
      .map(
        (logEntry) => `
      <div class="log-entry">
        <span class="log-time">${logEntry.at.split("T")[1].split(".")[0]}</span>
        <span class="log-msg ${logEntry.level === "error" ? "log-error" : ""}">${escapeHtml(logEntry.message)}</span>
      </div>
    `
      )
      .join("");
    this.updateLogContainer(this.els.ytLogsContainer, logsHtml);

    const queueHtml = pendingVideos.length
      ? pendingVideos
        .map((video) => {
          const videoName = typeof video === "string" ? video : video.name;
          const hasCaption = typeof video === "object" && video.hasCaption;
          return `
      <div class="queue-item">
        <div style="display:flex; align-items:center; gap:10px;">
          <i class="ph ph-file-video" style="font-size:20px;"></i>
          <span>${escapeHtml(videoName)}</span>
          ${hasCaption ? '<span class="status-badge" style="background:rgba(255,255,255,0.1); color:#ccc; border:1px solid #444; margin-left:8px;"><i class="ph ph-text-align-left"></i> Caption</span>' : ''}
        </div>
        <span class="status-badge active">Pending</span>
      </div>
    `;
        })
        .join("")
      : '<div style="text-align:center; padding:20px; color:#666;">Queue is empty</div>';
    if (this.els.ytQueueList) this.els.ytQueueList.innerHTML = queueHtml;

    if (
      this.els.ytCronInput &&
      document.activeElement !== this.els.ytCronInput &&
      !this.isScheduleDraftDirty("youtube")
    ) {
      this.els.ytCronInput.value = data.cronExpression || "";
    }
    this.applySchedulePlanFromStatus("youtube", data);
    if (this.els.ytTimezoneLabel) this.els.ytTimezoneLabel.textContent = timezone;
    if (this.els.ytLastRunLabel) this.els.ytLastRunLabel.textContent = lastRunText;
  },

  renderUniquifierStatus(data) {
    if (!data) return;

    if (this.els.uniqInputDir && document.activeElement !== this.els.uniqInputDir) {
      this.els.uniqInputDir.value = data.inputDir || "";
    }
    if (this.els.uniqOutputDir && document.activeElement !== this.els.uniqOutputDir) {
      this.els.uniqOutputDir.value = data.outputDir || "";
    }
    if (this.els.uniqLogoImage && document.activeElement !== this.els.uniqLogoImage) {
      this.els.uniqLogoImage.value = data.logoImage || "";
    }

    if (this.els.uniqState) {
      this.els.uniqState.textContent = data.running ? "Running" : "Idle";
      this.els.uniqState.classList.toggle("success", Boolean(data.running));
      this.els.uniqState.classList.toggle("error", !data.running);
    }

    const processed = data.progress?.processed ?? 0;
    const total = data.progress?.total ?? 0;
    const succeeded = data.progress?.succeeded ?? 0;
    const failed = data.progress?.failed ?? 0;
    if (this.els.uniqProgress) this.els.uniqProgress.textContent = `${processed} / ${total}`;
    if (this.els.uniqSucceeded) this.els.uniqSucceeded.textContent = String(succeeded);
    if (this.els.uniqFailed) this.els.uniqFailed.textContent = String(failed);

    if (this.els.uniqStartBtn) this.els.uniqStartBtn.disabled = Boolean(data.running);
    if (this.els.uniqStopBtn) this.els.uniqStopBtn.disabled = !data.running;

    const inputFiles = data.inputFiles || [];
    const outputFiles = data.outputFiles || [];

    if (this.els.uniqInputFiles) {
      this.els.uniqInputFiles.innerHTML = inputFiles.length
        ? inputFiles
          .map(
            (fileName) => `
        <div class="queue-item">
          <div style="display:flex; align-items:center; gap:10px;">
            <i class="ph ph-file-video" style="font-size:20px;"></i>
            <span>${escapeHtml(fileName)}</span>
          </div>
          <span class="status-badge active">Input</span>
        </div>
      `
          )
          .join("")
        : '<div style="text-align:center; padding:20px; color:#666;">No videos in input folder</div>';
    }

    if (this.els.uniqOutputFiles) {
      this.els.uniqOutputFiles.innerHTML = outputFiles.length
        ? outputFiles
          .map(
            (fileName) => `
        <div class="queue-item">
          <div style="display:flex; align-items:center; gap:10px;">
            <i class="ph ph-file-video" style="font-size:20px;"></i>
            <span>${escapeHtml(fileName)}</span>
          </div>
          <span class="status-badge active">Output</span>
        </div>
      `
          )
          .join("")
        : '<div style="text-align:center; padding:20px; color:#666;">No videos in output folder</div>';
    }

    const logs = data.logs || [];
    if (this.els.uniqLogs) {
      this.els.uniqLogs.innerHTML = logs
        .slice()
        .reverse()
        .map(
          (logEntry) => `
        <div class="log-entry">
          <span class="log-time">${logEntry.at.split("T")[1].split(".")[0]}</span>
          <span class="log-msg ${logEntry.level === "error" ? "log-error" : ""}">${escapeHtml(logEntry.message)}</span>
        </div>
      `
        )
        .join("");
    }
  },

  renderAccounts() {
    const rows = [
      {
        platformKey: "tiktok",
        platform: "TikTok",
        icon: "ph-tiktok-logo",
      },
      {
        platformKey: "instagram",
        platform: "Instagram",
        icon: "ph-instagram-logo",
      },
      {
        platformKey: "youtube",
        platform: "YouTube",
        icon: "ph-youtube-logo",
      },
    ];

    const activeCount = rows.filter(
      (row) =>
        this.accountState[row.platformKey]?.loginOpen ||
        this.accountState[row.platformKey]?.sessionSaved
    ).length;
    if (this.els.activeAccountsCount) {
      this.els.activeAccountsCount.textContent = String(activeCount);
    }
    if (this.els.activeBrandLabel) {
      const suffix = this.accountState.activeBrandName
        ? `- ${this.accountState.activeBrandName}`
        : "";
      this.els.activeBrandLabel.textContent = suffix;
    }
    if (!this.els.accountsTableBody) return;

    this.els.accountsTableBody.innerHTML = rows
      .map(
        (row) => {
          const platformState = this.accountState[row.platformKey] || {};
          const sessionText = platformState.loginOpen
            ? "Open"
            : platformState.sessionSaved
              ? "Saved"
              : "Not connected";
          return `
      <tr>
        <td><div class="platform-cell"><span class="platform-icon"><i class="ph ${row.icon}"></i></span> ${row.platform}</div></td>
        <td>${sessionText}</td>
        <td><span class="status-badge ${platformState.schedulerRunning ? "active" : ""}">${platformState.schedulerRunning ? "Scheduler Running" : "Scheduler Stopped"}</span></td>
        <td>
          <button class="control-btn-small" data-platform="${row.platformKey}" data-action="login"><i class="ph ph-sign-in"></i> Login Session</button>
          <button class="control-btn-small danger" data-platform="${row.platformKey}" data-action="close"><i class="ph ph-x-circle"></i> Close Session</button>
        </td>
      </tr>
    `;
        }
      )
      .join("");
  },

  async handleAutoDownloadAction(endpoint) {
    try {
      const result = await API.post(endpoint);
      if (result?.ok === false && result?.error) alert(result.error);
      this.refresh();
    } catch (err) {
      alert(`Auto-download action failed: ${err.message}`);
    }
  },

  async handleAutoDownloadSave() {
    const platforms = [];
    if (this.els.adPlatTiktok?.checked) platforms.push("tiktok");
    if (this.els.adPlatInstagram?.checked) platforms.push("instagram");
    if (this.els.adPlatYoutube?.checked) platforms.push("youtube");

    try {
      await API.post("/api/autodownload/configure", {
        channel: this.els.adChannel?.value || '',
        interval: parseInt(this.els.adInterval?.value, 10) || 10,
        maxVideos: parseInt(this.els.adMaxVideos?.value, 10) || 5,
        platforms
      });
      if (this.els.adSaveSettingsBtn) {
        this.els.adSaveSettingsBtn.innerHTML = '<i class="ph ph-check"></i> Saved!';
        setTimeout(() => {
          this.els.adSaveSettingsBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Save Settings';
        }, 2000);
      }
      this.refresh();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  },

  renderAutoDownloadStatus(data) {
    if (!data) return;

    if (this.els.adWatcherState) {
      this.els.adWatcherState.textContent = data.running ? "Running" : "Stopped";
      this.els.adWatcherState.classList.toggle("success", Boolean(data.running));
      this.els.adWatcherState.classList.toggle("error", !data.running);
    }
    if (this.els.adTotalDownloaded) {
      this.els.adTotalDownloaded.textContent = data.totalDownloaded ?? 0;
    }
    if (this.els.adLastCheck) {
      this.els.adLastCheck.textContent = data.lastCheckAt
        ? new Date(data.lastCheckAt).toLocaleTimeString()
        : "Never";
    }

    // Sync form fields only when user isn't focused
    if (this.els.adChannel && document.activeElement !== this.els.adChannel) {
      this.els.adChannel.value = data.channel || '';
      this.els.adInterval.value = data.interval || 10;
      this.els.adMaxVideos.value = data.maxVideos || 5;
      const platforms = data.platforms || [];
      if (this.els.adPlatTiktok) this.els.adPlatTiktok.checked = platforms.includes("tiktok");
      if (this.els.adPlatInstagram) this.els.adPlatInstagram.checked = platforms.includes("instagram");
      if (this.els.adPlatYoutube) this.els.adPlatYoutube.checked = platforms.includes("youtube");

      // Logs
      const logsHtml = (data.logs || [])
        .slice()
        .reverse()
        .map(
          (logEntry) => `
      <div class="log-entry">
        <span class="log-time">${logEntry.at.split("T")[1].split(".")[0]}</span>
        <span class="log-msg ${logEntry.level === "error" ? "log-error" : ""}">${escapeHtml(logEntry.message)}</span>
      </div>
    `
        )
        .join("");
      this.updateLogContainer(this.els.adLogsContainer, logsHtml);
    }
  },


  async handleProfileDownloadStart(scanOnly = false) {
    try {
      const channel = this.els.pdChannel?.value?.trim();
      const maxVideos = parseInt(this.els.pdMaxVideos?.value, 10) || 0;
      const minViews = parseInt(this.els.pdMinViews?.value, 10) || 0;

      if (!channel) {
        alert("Please provide a valid TikTok channel URL or username.");
        return;
      }

      const result = await API.post("/api/profile-download/start", {
        channel,
        maxVideos,
        minViews,
        scanOnly
      });

      if (result?.ok === false && result?.error) alert(result.error);
      this.refresh();
    } catch (err) {
      alert(`Profile downloader failed to start: ${err.message}`);
    }
  },

  async handleProfileDownloadOpenFolder() {
    try {
      await API.post("/api/profile-download/open-folder");
    } catch (err) {
      alert(`Could not open profile downloads folder: ${err.message}`);
    }
  },

  renderProfileDownloadStatus(data) {
    if (!data) return;

    if (this.els.pdStatusBadge) {
      this.els.pdStatusBadge.textContent = data.running ? "Scraping" : "Idle";
      this.els.pdStatusBadge.classList.toggle("success", Boolean(data.running));
      this.els.pdStatusBadge.classList.toggle("error", !data.running);
    }
    if (this.els.pdStartBtn) {
      this.els.pdStartBtn.disabled = Boolean(data.running);
    }
    if (this.els.pdScanBtn) {
      this.els.pdScanBtn.disabled = Boolean(data.running);
    }

    const logsHtml = (data.logs || [])
      .slice()
      .reverse()
      .map(
        (logEntry) => `
    <div class="log-entry">
      <span class="log-time">${logEntry.at.split("T")[1].split(".")[0]}</span>
      <span class="log-msg ${logEntry.level === "error" ? "log-error" : ""}">${escapeHtml(logEntry.message)}</span>
    </div>
    `
      )
      .join("");
    this.updateLogContainer(this.els.pdLogsContainer, logsHtml);
  }
};

document.addEventListener("DOMContentLoaded", () => UI.init());
