/**
 * 系统概览页面对应的 REST 接口
 */
import { http, HttpError } from "../utils/http.js";

export const getPing = () => http.get("/ping");
export const getHealth = () => http.get("/health");
export const getSysinfo = () => http.get("/sysinfo");
export const getProfit = () => http.get("/profit");
export const getCount = () => http.get("/count");
/** 日统计序列，供概览日收益卡与走势（默认近 14 根） */
export const getDaily = (timescale = 14) =>
  http.get(`/daily?timescale=${encodeURIComponent(String(timescale))}`);
export const getStatus = () => http.get("/status");
export const getShowConfig = () => http.get("/show_config");
export const getPanelStrategies = () => http.get("/panel/strategies");
/**
 * GET /panel/strategy-slots?includeBodies=true（相对 …/api/v1，默认带正文）。
 * @param {{ includeBodies?: boolean }} [opts] 默认 true；为 false 时不加查询参数
 */
export const getPanelStrategySlots = (opts = {}) => {
  const include = opts.includeBodies !== false;
  if (!include) return http.get("/panel/strategy-slots");
  const qs = new URLSearchParams();
  qs.set("includeBodies", "true");
  return http.get(`/panel/strategy-slots?${qs.toString()}`);
};
/**
 * 策略卡「编辑 JSON/MML」：GET ?slot_id={id}&includeBodies=true（相对 …/api/v1）。
 * 优先：/panel/strategy-slots?slot_id=…&includeBodies=true；若 404 再试 /panel/strategy-slots/{id}?…
 * @param {string|number} slotId 列表条目主键，对应查询参数 slot_id
 * @param {{ includeBodies?: boolean }} [opts] 默认 true
 */
export async function getPanelStrategySlotDetail(slotId, opts = {}) {
  const listId = String(slotId ?? "").trim();
  if (!listId) {
    throw new HttpError("缺少策略槽位 id", { status: 0, url: "" });
  }
  const include = opts.includeBodies !== false;
  const qs = new URLSearchParams();
  qs.set("slot_id", listId);
  if (include) qs.set("includeBodies", "true");
  const qstr = qs.toString();
  const samePath = `/panel/strategy-slots?${qstr}`;
  const withPathSeg = `/panel/strategy-slots/${encodeURIComponent(listId)}?${qstr}`;
  try {
    return await http.get(samePath);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) {
      return http.get(withPathSeg);
    }
    throw e;
  }
}
/**
 * PATCH …/api/v1/panel/strategy-slots/{id}，body 仅提交变更字段，例如：
 * `{ "mml": "…" }` 或 `{ "detailJson": "{…}" }`，可同时包含二者。
 */
export const patchPanelStrategySlot = (id, body) =>
  http.patch(`/panel/strategy-slots/${encodeURIComponent(String(id))}`, body);
export const getPanelAiOverview = () => http.get("/panel/ai_overview");
/** @param {{ limit?: number }} [q] */
export const getLogs = (q) => {
  const qs = q?.limit != null ? `?limit=${encodeURIComponent(String(q.limit))}` : "";
  return http.get(`/logs${qs}`);
};
