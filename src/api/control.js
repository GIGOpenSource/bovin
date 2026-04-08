/**
 * 运行控制页面对应的 REST 接口（/start、/pause 等）
 */
import { http } from "../utils/http.js";

export const getShowConfig = () => http.get("/show_config");
export const getPanelStrategies = () => http.get("/panel/strategies");
/** @param {{ includeBodies?: boolean }} [opts] 默认 true → ?includeBodies=true */
export const getPanelStrategySlots = (opts = {}) => {
  const include = opts.includeBodies !== false;
  if (!include) return http.get("/panel/strategy-slots");
  const qs = new URLSearchParams();
  qs.set("includeBodies", "true");
  return http.get(`/panel/strategy-slots?${qs.toString()}`);
};
/** PATCH …/panel/strategy-slots/{id}，body 如 `{ detailJson, mml }` 择一改 */
export const patchPanelStrategySlot = (id, body) =>
  http.patch(`/panel/strategy-slots/${encodeURIComponent(String(id))}`, body);
export const postStart = () => http.post("/start", {});
export const postPause = () => http.post("/pause", {});
export const postStop = () => http.post("/stop", {});
export const postStopentry = () => http.post("/stopentry", {});
export const postStopbuy = () => http.post("/stopbuy", {});
export const postReloadConfig = () => http.post("/reload_config", {});
