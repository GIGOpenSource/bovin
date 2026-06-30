/**
 * 策略列表接口（使用 api-web/v1 前缀）
 */
import { DOWNLOAD_DATA_API_V1_BASE } from "./default-api-base.js";
import { requestAtBase } from "../utils/http.js";

function isDevEnv() {
  try {
    if (typeof location === "undefined") return false;
    const host = String(location.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
    if (location.port === "9999") return true;
    return false;
  } catch {
    return false;
  }
}

const PROD_ORIGIN = "https://www.prbgame.com";

const httpWeb = {
  get(path, options) {
    return requestAtBase(DOWNLOAD_DATA_API_V1_BASE, path, { ...options, method: "GET" });
  },
  post(path, data, options) {
    return requestAtBase(DOWNLOAD_DATA_API_V1_BASE, path, { ...options, method: "POST", body: JSON.stringify(data) });
  },
  put(path, data, options) {
    return requestAtBase(DOWNLOAD_DATA_API_V1_BASE, path, { ...options, method: "PUT", body: JSON.stringify(data) });
  }
};
export const getPanelStrategies = () => httpWeb.get("/strategies");
export const getStrategyDetail = (strategyName) => httpWeb.get(`/strategy/${encodeURIComponent(String(strategyName))}`);
export const getStrategyTemplates = () => httpWeb.get("/c1/templates_name");
export const createStrategy = (strategyName, template) => httpWeb.post("/c1/strategy/create", { strategy_name: strategyName, template });
export const saveStrategyParams = (strategyName, params) => httpWeb.put(`/c1/strategy/${encodeURIComponent(String(strategyName))}/params`, { params });
export const saveStrategyCode = (strategyName, code) => httpWeb.put(`/c1/strategy/${encodeURIComponent(String(strategyName))}/code`, { code });