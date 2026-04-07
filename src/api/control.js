/**
 * 运行控制页面对应的 REST 接口（/start、/pause 等）
 */
import { http, requestAtBase } from "../utils/http.js";

export const getShowConfig = () => http.get("/show_config");
export const getPanelStrategies = () => http.get("/panel/strategies");
const DIRECT_TRADE_API_V1 = "http://127.0.0.1:18080/api/v1";
export const postStart = () => requestAtBase(DIRECT_TRADE_API_V1, "/start", { method: "POST", json: {} });
export const postPause = () => requestAtBase(DIRECT_TRADE_API_V1, "/pause", { method: "POST", json: {} });
export const postStop = () => http.post("/stop", {});
export const postStopentry = () => http.post("/stopentry", {});
export const postStopbuy = () => http.post("/stopbuy", {});
export const postReloadConfig = () => http.post("/reload_config", {});
