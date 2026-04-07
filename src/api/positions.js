/**
 * 持仓与订单页面对应的 REST 接口
 */
import { http, request } from "../utils/http.js";

export const getStatus = () => http.get("/status");
export const getBalance = () => http.get("/balance");
export const getTrades = () => http.get("/trades");
/** @param {string} tradeId */
export const getTrade = (tradeId) => http.get(`/trade/${encodeURIComponent(tradeId)}`);
export const getWhitelist = () => http.get("/whitelist");
/** @param {{ whitelist: string[] }} body 与 Bovin POST /whitelist/add 一致 */
export const postWhitelistAdd = (body) => http.post("/whitelist/add", body);
export const getBlacklist = () => http.get("/blacklist");
export const postBlacklist = (body) => http.post("/blacklist", body);
/** @param {unknown} body 请求体（交易对等） */
export const deleteBlacklist = (body) => request("/blacklist", { method: "DELETE", json: body });
export const getLocks = () => http.get("/locks");
export const postForceExit = () => http.post("/forceexit", {});
