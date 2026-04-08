/**
 * 策略卡 `.action-btn` 委托：POST 到交易 API（/start、/pause、/stop 等），成功后拉一轮 panel 数据刷新状态。
 * `data-control-op` 优先：暂停固定为 /pause，避免与 /stop 混淆。
 * `/panel/*` 始终走面板主 REST 基址（`effectiveApiBasePrimary()`）；其余路径优先策略卡 `data-strategy-api-base`。
 */
import { requestAtBase } from "./http.js";
import { effectiveApiBasePrimary } from "../api/config.js";
import { runPanelTickOnce } from "../panel-poll.js";

/** 「强制平掉全部持仓」：POST …/forceenter（参数暂写死，与后端约定） */
const FORCE_ENTER_CLOSE_ALL_BODY = {
  pair: "BTC/USDT:USDT",
  ordertype: "market",
};

/**
 * @param {string} fullUrl
 * @returns {{ base: string, path: string } | null}
 */
function splitAbsoluteApiRequest(fullUrl) {
  try {
    const u = new URL(fullUrl);
    const pathname = u.pathname || "/";
    const last = pathname.lastIndexOf("/");
    if (last <= 0) {
      const base = `${u.origin}${pathname}`.replace(/\/+$/, "");
      return { base, path: "/" };
    }
    const pathOnly = pathname.slice(last) || "/";
    const basePath = pathname.slice(0, last).replace(/\/+$/, "") || "";
    const base = `${u.origin}${basePath}`.replace(/\/+$/, "");
    return { base, path: pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}` };
  } catch {
    return null;
  }
}

/**
 * @param {string} endpoint
 * @param {Element | null | undefined} strategyCard
 * @returns {{ base: string, path: string } | null}
 */
export function resolveTradeControlPostTarget(endpoint, strategyCard) {
  const ep = String(endpoint || "").trim();
  if (!ep) return null;
  if (/^https?:\/\//i.test(ep)) {
    return splitAbsoluteApiRequest(ep);
  }
  const path = ep.startsWith("/") ? ep : `/${ep}`;
  let base = "";
  if (path.toLowerCase().startsWith("/panel/")) {
    base = String(effectiveApiBasePrimary() || "").trim().replace(/\/+$/, "");
  } else {
    const enc = strategyCard?.getAttribute?.("data-strategy-api-base");
    if (enc) {
      try {
        base = decodeURIComponent(enc).trim().replace(/\/+$/, "");
      } catch {
        base = "";
      }
    }
    if (!base) {
      base = String(effectiveApiBasePrimary() || "").trim().replace(/\/+$/, "");
    }
  }
  if (!base) return null;
  return { base, path };
}

/**
 * @param {HTMLElement | null} controlSection `#control`
 * @returns {() => void} cleanup
 */
export function bindControlTradeActionDelegation(controlSection) {
  if (!controlSection) return () => {};

  const onClick = (ev) => {
    const fromEl = ev.target instanceof Element ? ev.target : null;

    const forceExitRaw = fromEl?.closest("button[data-control-force-exit]");
    const forceExitBtn = forceExitRaw instanceof HTMLButtonElement ? forceExitRaw : null;
    if (forceExitBtn && !forceExitBtn.disabled) {
      const card = forceExitBtn.closest("[data-strategy-card]");
      const target = resolveTradeControlPostTarget("/forceenter", card);
      if (!target) {
        window.alert("缺少 API 基址");
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      void (async () => {
        const prevDisabled = forceExitBtn.disabled;
        forceExitBtn.disabled = true;
        try {
          await requestAtBase(target.base, target.path, {
            method: "POST",
            json: FORCE_ENTER_CLOSE_ALL_BODY,
          });
          await runPanelTickOnce();
        } catch (e) {
          const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
          window.alert(msg);
        } finally {
          forceExitBtn.disabled = prevDisabled;
        }
      })();
      return;
    }

    const raw = fromEl?.closest("button.action-btn");
    const btn = raw instanceof HTMLButtonElement ? raw : null;
    if (!btn || btn.disabled) return;
    const method = String(btn.getAttribute("data-method") || "POST").toUpperCase();
    if (method !== "POST") return;
    const card = btn.closest("[data-strategy-card]");
    const op = String(btn.getAttribute("data-control-op") || "").trim().toLowerCase();
    let target = null;
    if (op === "start" || op === "pause" || op === "stop") {
      target = resolveTradeControlPostTarget(`/${op}`, card);
    } else {
      const endpoint = btn.getAttribute("data-endpoint");
      if (!endpoint) return;
      target = resolveTradeControlPostTarget(endpoint, card);
    }
    if (!target) {
      window.alert("缺少 API 基址");
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    void (async () => {
      const prevDisabled = btn.disabled;
      btn.disabled = true;
      try {
        await requestAtBase(target.base, target.path, { method: "POST", json: {} });
        await runPanelTickOnce();
      } catch (e) {
        const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
        window.alert(msg);
      } finally {
        btn.disabled = prevDisabled;
      }
    })();
  };

  controlSection.addEventListener("click", onClick);
  return () => controlSection.removeEventListener("click", onClick);
}
