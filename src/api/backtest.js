import { DOWNLOAD_DATA_API_V1_BASE } from "./default-api-base.js";
import { requestAtBase } from "../utils/http.js";

const http = {
  get(path, options) {
    return requestAtBase(DOWNLOAD_DATA_API_V1_BASE, path, { ...options, method: "GET" });
  },
  post(path, json, options) {
    return requestAtBase(DOWNLOAD_DATA_API_V1_BASE, path, { ...options, method: "POST", json });
  },
  delete(path, options) {
    return requestAtBase(DOWNLOAD_DATA_API_V1_BASE, path, { ...options, method: "DELETE" });
  }
};

export const getBacktestHistory = () => {
  return http.get("/backtest/history");
};

export const runBacktest = (params) => {
  return http.post("/backtest/run", params);
};

export const getBacktestHistoryResult = (params) => {
  return http.get("/backtest/history/result", { params });
};

export const deleteBacktestHistory = (filename) => {
  return http.delete(`/backtest/history/${filename}`);
};