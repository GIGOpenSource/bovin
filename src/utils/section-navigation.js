function pickSettingsPane(tab) {
  return tab === "strategy" ? "strategy" : tab === "users" ? "users" : "integrations";
}

export function createSectionNavigation(deps) {
  const {
    $,
    t,
    uiState,
    menuPermissionFor,
    firstVisibleMenuSectionId,
    persistActiveSection,
    settingsSubtabKey,
    loadPanelPreferences,
    refreshSettingsBotContext,
    refreshControlStrategyConfig,
    refreshOverview,
    refreshDataPanel,
    scheduleDataPanelChartLayout,
    syncDataRealtimePollingForSection,
    isAutoRefreshArmed,
    getRouteNavigator,
    renderPanelUsersListLoaded,
    syncStrategyEntriesWithBotAndDiscovered,
    renderStrategyEntriesList,
    normalizeSectionIdCandidate
  } = deps;

  function setSettingsTab(tab) {
    const pane = pickSettingsPane(tab);
    localStorage.setItem(settingsSubtabKey, pane);
    document.querySelectorAll(".settings-dual-tab").forEach((btn) => {
      const on = btn.getAttribute("data-settings-tab") === pane;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    const pInt = $("settingsPanelIntegrations");
    const pStr = $("settingsPanelStrategy");
    const pUsr = $("settingsPanelUsers");
    if (pInt) pInt.classList.toggle("active", pane === "integrations");
    if (pStr) pStr.classList.toggle("active", pane === "strategy");
    if (pUsr) pUsr.classList.toggle("active", pane === "users");
    if (pane === "users") void renderPanelUsersListLoaded();
    if (pane === "strategy") {
      syncStrategyEntriesWithBotAndDiscovered(uiState.lastShowConfig, uiState.panelStrategyList);
      renderStrategyEntriesList();
    }
  }

  function updatePageHeading(sectionId) {
    const titleEl = $("pageTitle");
    const subtitleEl = $("pageSubtitle");
    if (!titleEl) return;
    const activeSection = sectionId || document.querySelector(".nav-btn.active")?.dataset.section || "overview";
    const activeNavBtn = document.querySelector(`.nav-btn[data-section="${activeSection}"]`);
    const navKey = activeNavBtn?.getAttribute("data-i18n");
    titleEl.textContent = navKey ? t(navKey) : (activeNavBtn?.textContent || t("nav.overview"));
    if (subtitleEl) subtitleEl.textContent = "";
  }

  function switchSection(sectionId, options = {}) {
    const { skipPersist = false, skipRouteSync = false } = options;
    if (sectionId && menuPermissionFor(sectionId) === "hidden") {
      const alt = firstVisibleMenuSectionId();
      if (alt != null && alt !== sectionId) {
        switchSection(alt, options);
        return;
      }
    }
    const el = sectionId && document.getElementById(sectionId);
    if (!el || !el.classList.contains("section")) return;
    document.querySelectorAll(".section").forEach((e) => e.classList.remove("active"));
    document.querySelectorAll(".sidebar-nav .nav-btn").forEach((e) => {
      e.classList.remove("active");
      e.removeAttribute("aria-current");
    });
    el.classList.add("active");
    const navBtn = document.querySelector(`.sidebar-nav .nav-btn[data-section="${sectionId}"]`);
    if (navBtn) {
      navBtn.classList.add("active");
      navBtn.setAttribute("aria-current", "page");
    }
    updatePageHeading(sectionId);
    if (!skipPersist) persistActiveSection(sectionId);
    if (sectionId === "settings") {
      const sub = pickSettingsPane(localStorage.getItem(settingsSubtabKey) || "integrations");
      setSettingsTab(sub);
      void loadPanelPreferences();
      void refreshSettingsBotContext();
    }
    if (sectionId === "control") refreshControlStrategyConfig();
    if (sectionId === "monitor") {
      void refreshOverview();
    }
    if (sectionId === "data") {
      void refreshDataPanel().finally(() => {
        scheduleDataPanelChartLayout();
      });
    }
    if (isAutoRefreshArmed() && uiState.authed) {
      syncDataRealtimePollingForSection(sectionId);
    }
    const routeNavigator = getRouteNavigator();
    if (!skipRouteSync && routeNavigator) {
      try {
        routeNavigator(sectionId);
      } catch {
        // ignore router sync failure
      }
    }
  }

  function resolveInitialSectionId() {
    const fromHash = normalizeSectionIdCandidate(location.hash || "");
    const pick = (id) => {
      if (!id || !document.getElementById(id)?.classList.contains("section")) return null;
      if (uiState.authed && menuPermissionFor(id) === "hidden") return firstVisibleMenuSectionId() || "overview";
      return id;
    };
    const a = pick(fromHash);
    if (a) return a;
    const stored = localStorage.getItem("ft_active_section");
    const b = pick(stored);
    if (b) return b;
    const htmlActive = document.querySelector(".section.active")?.id;
    const c = pick(htmlActive);
    if (c) return c;
    return firstVisibleMenuSectionId() || "overview";
  }

  function syncInitialActiveSection() {
    const id = resolveInitialSectionId();
    switchSection(id, { skipPersist: true, skipRouteSync: Boolean(getRouteNavigator()) });
    persistActiveSection(id);
  }

  return {
    setSettingsTab,
    switchSection,
    syncInitialActiveSection,
    updatePageHeading
  };
}
