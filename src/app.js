/**
 * 面板壳层：登录显隐、侧栏分区、i18n、语言与模拟数据源（对齐历史根目录 main.js 面板壳行为）。
 * 数据轮询见 panel-poll.js。
 */
import { i18n } from "./i18n/index.js";
import { postPanelAuthLogin } from "./api/settings.js";
import {
  state,
  uiState,
  persistProfileToLocalStorage,
  clearFreqtradePasswordSession
} from "./store/state-core.js";
import { normalizeSectionIdCandidate } from "./router/bridge.js";
import { startPanelPolling, stopPanelPolling } from "./panel-poll.js";

/** 为 true：不拦截，直接进入面板（不弹登录）；为 false 时走 /panel/auth/login。 */
export const SKIP_PANEL_LOGIN = true;

let sectionNavigate = null;
let loginFormBound = false;
let logoutBound = false;
let navBound = false;

export function registerSectionRouteNavigator(nav) {
  sectionNavigate = typeof nav === "function" ? nav : null;
}

function t(key) {
  const lang = state.lang || "zh-CN";
  return i18n[lang]?.[key] ?? i18n["zh-CN"]?.[key] ?? key;
}

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

function syncLoginShell() {
  const loginEl = $("loginScreen");
  const appRoot = $("appRoot");
  if (!loginEl || !appRoot) return;
  const pwd = String(state.password || "").trim();
  const ok = SKIP_PANEL_LOGIN || (uiState.authed && pwd.length > 0);
  if (ok) {
    loginEl.classList.add("hidden");
    appRoot.classList.remove("hidden");
  } else {
    loginEl.classList.remove("hidden");
    appRoot.classList.add("hidden");
  }
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
  sectionNavigate?.(id);
}

function bindNavOnce() {
  if (navBound) return;
  navBound = true;
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = btn.getAttribute("data-section");
      if (s) activateSection(s);
    });
  });
  window.addEventListener("hashchange", () => {
    const id = normalizeSectionIdCandidate(location.hash);
    if (!id || !document.getElementById(id)?.classList.contains("section")) return;
    const cur = document.querySelector(".section.active")?.id;
    if (cur === id) return;
    activateSection(id);
  });
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

function bindPanelChromeOnce() {
  if (uiState.topbarChromeBound) return;
  uiState.topbarChromeBound = true;

  const metaV = document.querySelector('meta[name="panel-version"]')?.getAttribute("content") || "";
  const verEl = $("appVersionLabel");
  if (verEl && metaV) verEl.textContent = `v${metaV}`;

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
    });
  }

  const langQuick = $("langQuickToggle");
  if (langQuick) {
    langQuick.addEventListener("click", () => {
      state.lang = state.lang === "en" ? "zh-CN" : "en";
      try {
        localStorage.setItem("ft_lang", state.lang);
      } catch {
        /* ignore */
      }
      if (langSel instanceof HTMLSelectElement) langSel.value = state.lang === "en" ? "en" : "zh-CN";
      applyDomI18n(document);
      const shell = $("appRoot");
      if (shell) applyDomI18n(shell);
      syncMockPillUi();
    });
  }

  function syncMockPillUi() {
    const badge = $("dataSourceBadge");
    const label = badge?.querySelector(".status-pill-label");
    const mock = state.mockMode;
    if (badge) badge.setAttribute("aria-pressed", mock ? "true" : "false");
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

  const toggleMockMode = () => {
    state.mockMode = !state.mockMode;
    try {
      localStorage.setItem("ft_mock_mode", state.mockMode ? "1" : "0");
    } catch {
      /* ignore */
    }
    syncMockPillUi();
  };

  $("dataSourceBadge")?.addEventListener("click", toggleMockMode);
  $("toggleMock")?.addEventListener("click", toggleMockMode);
}

function enterShellAfterAuth() {
  syncLoginShell();
  bindNavOnce();
  bindPanelChromeOnce();
  activateSection(pickInitialSectionId());
  const shell = $("appRoot");
  if (shell) applyDomI18n(shell);
  startPanelPolling();
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
  $("logoutBtn")?.addEventListener("click", () => {
    stopPanelPolling();
    try {
      localStorage.removeItem("ft_panel_auth");
    } catch {
      /* ignore */
    }
    uiState.authed = false;
    clearFreqtradePasswordSession();
    persistProfileToLocalStorage();
    syncLoginShell();
  });
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
    syncLoginShell();
  }
}
