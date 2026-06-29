/**
 * 面板壳层：登录显隐、侧栏分区、i18n、语言与模拟数据源（对齐历史根目录 main.js 面板壳行为）。
 * 数据轮询见 panel-poll.js。
 */
import { i18n } from "./i18n/index.js";
import { postPanelAuthLogin, getPanelPreferences } from "./api/settings.js";
import { postDryRunConfig, postReloadConfig, getShowConfig } from "./api/overview.js";
import { Modal, Spin } from "ant-design-vue";
import {
  state,
  uiState,
  persistProfileToLocalStorage,
  clearFreqtradePasswordSession,
  applyPanelProfileFromPrefs
} from "./store/state-core.js";
import { normalizeSectionIdCandidate } from "./router/bridge.js";
import { panelRouter } from "./router/index.js";
import { startPanelPolling, stopPanelPolling, applyTopbarDecor } from "./panel-poll.js";
import { renderControlHeroAndCards } from "./components/control-console.js";
import { bindMonitorRefreshButtonOnce, refreshMonitorPageMetrics } from "./utils/monitor-page-metrics.js";

/** 为 true：不拦截，直接进入面板（不弹登录）；为 false 时须先登录（/panel/auth/login）再进入。 */
export const SKIP_PANEL_LOGIN = false;

let sectionNavigate = null;
let loginFormBound = false;
let logoutBound = false;
let navBound = false;
let themeSystemMediaQuery = null;

window.handleLoginSubmit = async function(e) {
  e.preventDefault();
  console.log("[Login] Legacy login form submitted, redirecting to login route...");
  if (panelRouter) {
    await panelRouter.push({ name: "login" });
  } else {
    location.href = `${location.origin}${location.pathname}#/login`;
  }
  return false;
};

export function registerSectionRouteNavigator(nav) {
  sectionNavigate = typeof nav === "function" ? nav : null;
}

function t(key) {
  const lang = state.lang || "zh-CN";
  return i18n[lang]?.[key] ?? i18n["zh-CN"]?.[key] ?? key;
}

window.t = t;

export function applyDomI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (!k) return;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      return;
    }
    el.textContent = t(k);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const k = el.getAttribute("data-i18n-placeholder");
    if (!k || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    el.placeholder = t(k);
  });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const k = el.getAttribute("data-i18n-aria");
    if (!k) return;
    el.setAttribute("aria-label", t(k));
  });
}

function $(id) {
  return document.getElementById(id);
}

function resolveThemeMode(themeSetting) {
  const mode = String(themeSetting || "dark").trim().toLowerCase();
  if (mode === "light" || mode === "dark") return mode;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function syncThemeButtonUi() {
  const btn = $("topbarThemeBtn");
  if (!btn) return;
  const isLight = resolveThemeMode(uiState.theme) === "light";
  btn.setAttribute("aria-pressed", isLight ? "true" : "false");
  btn.classList.toggle("is-active", isLight);
}

function applyThemeToDom(themeSetting) {
  const mode = resolveThemeMode(themeSetting);
  if (mode === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
  syncThemeButtonUi();
  try {
    window.dispatchEvent(new CustomEvent("bovin-theme-changed", { detail: { mode } }));
  } catch {
    /* ignore */
  }
}

function bindThemeToggleOnce() {
  if (uiState.themeMediaBound) return;
  uiState.themeMediaBound = true;

  const fromStorage = localStorage.getItem("ft_theme");
  uiState.theme = fromStorage === "light" || fromStorage === "dark" || fromStorage === "system" ? fromStorage : "dark";
  applyThemeToDom(uiState.theme);

  themeSystemMediaQuery = window.matchMedia?.("(prefers-color-scheme: light)") ?? null;
  themeSystemMediaQuery?.addEventListener?.("change", () => {
    if (uiState.theme === "system") applyThemeToDom("system");
  });

  if (!uiState.themeToggleDelegationBound) {
    uiState.themeToggleDelegationBound = true;
    document.addEventListener("click", (ev) => {
      const el = ev.target instanceof Element ? ev.target.closest("#topbarThemeBtn") : null;
      if (!el) return;
      if (el instanceof HTMLButtonElement && el.disabled) return;
      ev.preventDefault();
      const next = resolveThemeMode(uiState.theme) === "light" ? "dark" : "light";
      uiState.theme = next;
      try {
        localStorage.setItem("ft_theme", next);
      } catch {
        /* ignore */
      }
      applyThemeToDom(next);
    });
  }
}

function syncLoginShell() {
  console.log("[Login] syncLoginShell called - using Vue Router routes now");
}

function pickInitialSectionId() {
  const fromHash = normalizeSectionIdCandidate(location.hash);
  if (fromHash && document.getElementById(fromHash)?.classList.contains("section")) return fromHash;
  let fromLs = "";
  try {
    fromLs = String(localStorage.getItem("ft_active_section") || "").trim();
  } catch {
    fromLs = "";
  }
  if (fromLs && document.getElementById(fromLs)?.classList.contains("section")) return fromLs;
  return "overview";
}

export function activateSection(sectionId) {
  const id = String(sectionId || "overview").trim() || "overview";
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const sec = btn.getAttribute("data-section");
    if (sec === id) btn.classList.add("active");
    else btn.classList.remove("active");
  });
  document.querySelectorAll("section.section").forEach((sec) => {
    if (sec.id === id) sec.classList.add("active");
    else sec.classList.remove("active");
  });
  try {
    localStorage.setItem("ft_active_section", id);
  } catch {
    /* ignore */
  }
  if (sectionNavigate) {
    sectionNavigate(id);
  } else if (panelRouter) {
    if (panelRouter.hasRoute?.(id) && String(panelRouter.currentRoute?.value?.name || "") !== id) {
      void panelRouter.push({ name: id });
    }
  }
  if (id === "monitor" && uiState.authed) {
    void refreshMonitorPageMetrics();
  }
}

export function bindNavOnce() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = btn.getAttribute("data-section");
      if (s) activateSection(s);
    });
  });
  const handleHashChange = () => {
    const id = normalizeSectionIdCandidate(location.hash);
    if (!id || !document.getElementById(id)?.classList.contains("section")) return;
    const cur = document.querySelector(".section.active")?.id;
    if (cur === id) return;
    activateSection(id);
  };
  window.addEventListener("hashchange", handleHashChange);
}

function reconcileStaleAuth() {
  if (SKIP_PANEL_LOGIN) return;
  if (uiState.authed && !String(state.password || "").trim()) {
    try {
      localStorage.removeItem("ft_panel_auth");
    } catch {
      /* ignore */
    }
    uiState.authed = false;
  }
}

/** 解包 GET /panel/preferences 响应（部分网关使用 `{ data: profile }`）。 */
function unwrapPanelPreferencesBody(body) {
  if (!body || typeof body !== "object") return body;
  const d = body.data;
  if (d != null && typeof d === "object" && !Array.isArray(d)) return d;
  return body;
}

export function refreshStrategyConsoleAfterPrefs() {
  const dailyPayload = uiState.lastDaily && typeof uiState.lastDaily === "object" ? uiState.lastDaily : {};
  const showCfg = uiState.lastShowConfig && typeof uiState.lastShowConfig === "object" ? uiState.lastShowConfig : {};
  const profitObj = uiState.lastProfit && typeof uiState.lastProfit === "object" ? uiState.lastProfit : {};
  const health = uiState.lastHealth && typeof uiState.lastHealth === "object" ? uiState.lastHealth : {};
  renderControlHeroAndCards(
    dailyPayload,
    showCfg,
    profitObj,
    health,
    uiState.lastProxyHealth,
    uiState.strategyBotSnapshots || {}
  );
}

/**
 * 登录并已具备 Basic 凭据后拉取 SQLite panel_profile / api_bindings，合并进 state（策略 AI 控制台与本地条目一致）。
 */
async function syncPanelPreferencesFromServer() {
  if (!uiState.authed || !String(state.password || "").trim()) {
    uiState.panelPrefsSyncedFromDb = false;
    uiState.panelPrefsBindingsLoadedFromDb = false;
    return;
  }
  try {
    const body = await getPanelPreferences();
    const profile = unwrapPanelPreferencesBody(body);
    const { bindingsLoadedFromDb } = applyPanelProfileFromPrefs(profile);
    uiState.panelPrefsSyncedFromDb = true;
    uiState.panelPrefsBindingsLoadedFromDb = bindingsLoadedFromDb;
    uiState.panelPrefsLoadErrorDetail = "";
    refreshStrategyConsoleAfterPrefs();
    try {
      window.dispatchEvent(new CustomEvent("bovin-panel-prefs-applied", { detail: { ok: true } }));
    } catch {
      /* ignore */
    }
  } catch (ex) {
    uiState.panelPrefsSyncedFromDb = false;
    uiState.panelPrefsBindingsLoadedFromDb = false;
    uiState.panelPrefsLoadErrorDetail = ex?.message || String(ex || "");
    try {
      window.dispatchEvent(
        new CustomEvent("bovin-panel-prefs-applied", { detail: { ok: false, error: uiState.panelPrefsLoadErrorDetail } })
      );
    } catch {
      /* ignore */
    }
  }
}

function bindPanelChromeOnce() {
  if (uiState.topbarChromeBound) return;
  uiState.topbarChromeBound = true;
  bindThemeToggleOnce();

  const metaV = document.querySelector('meta[name="panel-version"]')?.getAttribute("content") || "";
  const verEl = $("appVersionLabel");
  if (verEl && metaV) verEl.textContent = `v${metaV}`;

  if (!uiState.langDelegatedBound) {
    uiState.langDelegatedBound = true;
    document.addEventListener("click", (ev) => {
      const el = ev.target instanceof Element ? ev.target.closest("#langQuickToggle") : null;
      if (!el) return;
      if (el instanceof HTMLButtonElement && el.disabled) return;
      ev.preventDefault();
      
      state.lang = state.lang === "en" ? "zh-CN" : "en";
      try {
        localStorage.setItem("ft_lang", state.lang);
      } catch {
        /* ignore */
      }
      const langSel = $("langSwitch");
      if (langSel instanceof HTMLSelectElement) langSel.value = state.lang === "en" ? "en" : "zh-CN";
      applyDomI18n(document);
      const shell = $("appRoot");
      if (shell) applyDomI18n(shell);
      syncMockPillUi();
      applyTopbarDecor(uiState.lastPingOk, uiState.lastPingLatencyMs);
      window.dispatchEvent(new CustomEvent("bovin-lang-changed", { detail: { lang: state.lang } }));
    });
  }
  
  const langSel = $("langSwitch");
  if (langSel instanceof HTMLSelectElement) {
    langSel.value = state.lang === "en" ? "en" : "zh-CN";
    langSel.addEventListener("change", () => {
      state.lang = langSel.value === "en" ? "en" : "zh-CN";
      try {
        localStorage.setItem("ft_lang", state.lang);
      } catch {
        /* ignore */
      }
      applyDomI18n(document);
      const shell = $("appRoot");
      if (shell) applyDomI18n(shell);
      syncMockPillUi();
      applyTopbarDecor(uiState.lastPingOk, uiState.lastPingLatencyMs);
    });
  }

  function syncMockPillUi() {
    const badge = $("dataSourceBadge");
    const label = badge?.querySelector(".status-pill-label");
    const showCfg =
      uiState.lastShowConfig && typeof uiState.lastShowConfig === "object"
        ? uiState.lastShowConfig
        : null;
    const fromServer = showCfg ? showCfg.dry_run === true : null;
    const mock = fromServer !== null ? fromServer : state.mockMode;
    state.mockMode = mock;
    if (badge) {
      badge.setAttribute("aria-pressed", mock ? "true" : "false");
      if (mock) {
        badge.classList.add("is-mock");
      } else {
        badge.classList.remove("is-mock");
      }
    }
    if (label) {
      const liveLabel = state.lang === "en" ? "Live" : "实时";
      label.textContent = `${t("data.sourceLabel")}: ${mock ? t("data.sourcePill.mock") : liveLabel}`;
    }
    const togg = $("toggleMock");
    if (togg) {
      togg.setAttribute("aria-pressed", mock ? "true" : "false");
      togg.textContent =
        state.lang === "en" ? `Mock: ${mock ? "ON" : "OFF"}` : `模拟数据: ${mock ? "ON" : "OFF"}`;
    }
  }

  syncMockPillUi();
  window.__syncMockPillUi = syncMockPillUi;

  const toggleMockMode = async () => {
    const newDryRun = !state.mockMode;
    const isMock = newDryRun;
    Modal.confirm({
      title: isMock ? t('panel.switchToMock') : t('panel.switchToLive'),
      content: isMock ? t('panel.confirmSwitchMock') : t('panel.confirmSwitchLive'),
      okText: t('common.ok'),
      cancelText: t('common.cancel'),
      centered: true,
      async onOk() {
        try {
          await postDryRunConfig(newDryRun);
          try {
            await postReloadConfig();
            if (window.__showReloadConfigModal) {
              window.__showReloadConfigModal();
            }
          } catch {
            /* ignore reload error */
          }
          try {
            const fresh = await getShowConfig();
            if (fresh && typeof fresh === "object") {
              uiState.lastShowConfig = fresh;
            }
          } catch {
            /* ignore refresh error */
          }
          state.mockMode = newDryRun;
          try {
            localStorage.setItem("ft_mock_mode", state.mockMode ? "1" : "0");
          } catch {
            /* ignore */
          }
        } catch {
          /* ignore error */
        }
        syncMockPillUi();
      }
    });
  };

  /* 用文档级委托，避免路由切换/重挂载后按钮节点替换导致“看得到但点不了”。 */
  if (!uiState.mockToggleDelegationBound) {
    uiState.mockToggleDelegationBound = true;
    document.addEventListener("click", (ev) => {
      const el = ev.target instanceof Element ? ev.target.closest("#dataSourceBadge, #toggleMock") : null;
      if (!el) return;
      if (el instanceof HTMLButtonElement && el.disabled) return;
      ev.preventDefault();
      toggleMockMode();
    });
  }
}

export function enterShellAfterAuth() {
  uiState.authed = true;
  
  const shell = document.getElementById("app") || document.getElementById("appRoot");
  if (shell) applyDomI18n(shell);
  
  bindMonitorRefreshButtonOnce();
  bindPanelChromeOnce();
  startPanelPolling();
  
  void syncPanelPreferencesFromServer();
  
  setTimeout(() => {
    void refreshMonitorPageMetrics();
  }, 100);
  
  try {
    window.dispatchEvent(new CustomEvent("bovin-panel-auth"));
  } catch {
    /* ignore */
  }
  
  console.log("[Login] Shell entered, navigation handled by Vue Router");
}

function bindLoginOnce() {
  if (loginFormBound) return;
  loginFormBound = true;
  $("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = $("loginUsername")?.value?.trim() || "";
    const p = $("loginPassword")?.value || "";
    const err = $("loginError");
    try {
      state.username = u;
      state.password = p;
      await postPanelAuthLogin({ username: u, password: p });
      try {
        localStorage.setItem("ft_panel_auth", "1");
      } catch {
        /* ignore */
      }
      uiState.authed = true;
      persistProfileToLocalStorage();
      if (err) err.textContent = "";
      enterShellAfterAuth();
    } catch (ex) {
      stopPanelPolling();
      uiState.authed = false;
      try {
        localStorage.removeItem("ft_panel_auth");
      } catch {
        /* ignore */
      }
      const msg = ex?.message || String(ex || "");
      if (err) err.textContent = msg || t("login.error");
    }
  });
}

function bindLogoutOnce() {
  if (logoutBound) return;
  logoutBound = true;
  
  const bindLogout = () => {
    const logoutBtn = $("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        stopPanelPolling();
        try {
          localStorage.removeItem("ft_panel_auth");
        } catch {
          /* ignore */
        }
        uiState.authed = false;
        uiState.panelPrefsSyncedFromDb = false;
        uiState.panelPrefsBindingsLoadedFromDb = false;
        uiState.panelPrefsLoadErrorDetail = "";
        state.password = "";
        
        if (panelRouter) {
          panelRouter.push({ name: "login" }).then(() => {
            console.log("[Logout] Redirected to login page");
          }).catch(err => {
            console.error("[Logout] Navigation error:", err);
            location.href = `${location.origin}${location.pathname}#/login`;
          });
        } else {
          location.href = `${location.origin}${location.pathname}#/login`;
        }
      });
    } else {
      setTimeout(bindLogout, 100);
    }
  };
  
  bindLogout();
}

export async function startPanelApp() {
  reconcileStaleAuth();
  if (SKIP_PANEL_LOGIN) {
    uiState.authed = true;
  }
  applyDomI18n(document);
  bindLoginOnce();
  bindLogoutOnce();

  if (SKIP_PANEL_LOGIN || (uiState.authed && String(state.password || "").trim())) {
    enterShellAfterAuth();
  } else {
    setTimeout(() => {
      if (panelRouter) {
        const currentRoute = panelRouter.currentRoute.value.name;
        if (currentRoute !== "login") {
          console.log("[Login] Redirecting to login route...");
          panelRouter.push({ name: "login" });
        }
      } else {
        console.log("[Login] Router not ready, redirecting via location...");
        location.href = `${location.origin}${location.pathname}#/login`;
      }
    }, 50);
  }
}
