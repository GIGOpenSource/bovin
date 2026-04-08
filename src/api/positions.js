/**
 * 持仓与订单页面对应的 REST 接口
 */
import { http, request } from "../utils/http.js";

export const getStatus = () => http.get("/status");
export const getBalance = () => http.get("/balance");
export const getTrades = () => http.get("/trades");
/**
 * 控制台「实时成交流」：与面板同一 …/api/v1 基址 GET /trades
 * @param {number} [limit] 最近成交条数（1–500），缺省由 state 归一化值决定
 */
export function getTradesFeed(limit = 12) {
  const lim = Math.min(500, Math.max(1, Math.round(Number(limit) || 12)));
  return http.get(`/trades?limit=${lim}&order_by_id=false`);
}
/** @param {string} tradeId */
export const getTrade = (tradeId) => http.get(`/trade/${encodeURIComponent(tradeId)}`);
export const getWhitelist = () => http.get("/whitelist");
/** @param {{ whitelist: string[] }} body 与 Bovin POST /whitelist/add 一致 */
export const postWhitelistAdd = (body) => http.post("/whitelist/add", body);
/**
 * 从白名单删除交易对：DELETE …/api/v1/whitelist?pairs_to_delete=编码后的 pair
 * @param {string} pair 如 BTC/USDT:USDT
 */
export function deleteWhitelistPair(pair) {
  const p = String(pair || "").trim();
  if (!p) return Promise.reject(new Error("缺少交易对"));
  const qs = new URLSearchParams();
  qs.set("pairs_to_delete", p);
  return request(`/whitelist?${qs.toString()}`, { method: "DELETE" });
}
export const getBlacklist = () => http.get("/blacklist");
export const postBlacklist = (body) => http.post("/blacklist", body);
/** @param {unknown} body 请求体（交易对等） */
export const deleteBlacklist = (body) => request("/blacklist", { method: "DELETE", json: body });
export const getLocks = () => http.get("/locks");
export const postForceExit = () => http.post("/forceexit", {});
