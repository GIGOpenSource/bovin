/**
 * 数据 / K 线页面对应的 REST 接口
 */
import { http, request } from "../utils/http.js";

export const getAvailablePairs = () => http.get("/available_pairs");
export const getMarkets = (query) => {
  const q = query && typeof query === "object" ? new URLSearchParams(query).toString() : "";
  return http.get(q ? `/markets?${q}` : "/markets");
};
export const getExchanges = () => http.get("/exchanges");
export const getStrategies = () => http.get("/strategies");
/** @param {string} strategyClass 策略类名 */
export const getStrategy = (strategyClass) =>
  http.get(`/strategy/${encodeURIComponent(strategyClass)}`);
export const getPlotConfig = () => http.get("/plot_config");
export const getFreqaimodels = () => http.get("/freqaimodels");

/** @param {Record<string, string | number | boolean | undefined>} [params] */
export const getPairHistory = (params) => {
  const q = params && typeof params === "object" ? new URLSearchParams(params).toString() : "";
  return http.get(q ? `/pair_history?${q}` : "/pair_history");
};

/** @param {Record<string, string | number | boolean | undefined>} [params] */
export const postPairHistory = (body, params) => {
  const q = params && typeof params === "object" ? new URLSearchParams(params).toString() : "";
  const path = q ? `/pair_history?${q}` : "/pair_history";
  return request(path, { method: "POST", json: body ?? {} });
};

/** @param {Record<string, string | number | boolean | undefined>} [params] */
export const getPairCandles = (params) => {
  const q = params && typeof params === "object" ? new URLSearchParams(params).toString() : "";
  return http.get(q ? `/pair_candles?${q}` : "/pair_candles");
};

/** @param {unknown} [body] @param {Record<string, string | number | boolean | undefined>} [params] */
export const postPairCandles = (body, params) => {
  const q = params && typeof params === "object" ? new URLSearchParams(params).toString() : "";
  const path = q ? `/pair_candles?${q}` : "/pair_candles";
  return request(path, { method: "POST", json: body ?? {} });
};

/** @param {Record<string, string | number | boolean | undefined>} params */
export const getPanelBinanceKlines = (params) => {
  const q = new URLSearchParams(params || {}).toString();
  return http.get(q ? `/panel/binance_klines?${q}` : "/panel/binance_klines");
};
