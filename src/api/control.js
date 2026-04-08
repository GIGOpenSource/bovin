/**
 * 运行控制页面对应的 REST 接口（/start、/pause 等）
 */
import { http } from "../utils/http.js";

export const getShowConfig = () => http.get("/show_config");
export const getPanelStrategies = () => http.get("/panel/strategies");
export const postStart = () => http.post("/start", {});
export const postPause = () => http.post("/pause", {});
export const postStop = () => http.post("/stop", {});
export const postStopentry = () => http.post("/stopentry", {});
export const postStopbuy = () => http.post("/stopbuy", {});
export const postReloadConfig = () => http.post("/reload_config", {});
