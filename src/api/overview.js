/**
 * 系统概览页面对应的 REST 接口
 */
import { http } from "../utils/http.js";

export const getPing = () => http.get("/ping");
export const getHealth = () => http.get("/health");
export const getSysinfo = () => http.get("/sysinfo");
export const getProfit = () => http.get("/profit");
export const getCount = () => http.get("/count");
export const getStatus = () => http.get("/status");
export const getShowConfig = () => http.get("/show_config");
export const getPanelStrategies = () => http.get("/panel/strategies");
export const getPanelAiOverview = () => http.get("/panel/ai_overview");
/** @param {{ limit?: number }} [q] */
export const getLogs = (q) => {
  const qs = q?.limit != null ? `?limit=${encodeURIComponent(String(q.limit))}` : "";
  return http.get(`/logs${qs}`);
};
