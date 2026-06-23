/**
 * 下载数据专用的 REST 接口（使用8681端口）
 */
import { DOWNLOAD_DATA_API_V1_BASE } from "./default-api-base.js";
import { requestAtBase } from "../utils/http.js";

const http = {
  get(path, options) {
    return requestAtBase(DOWNLOAD_DATA_API_V1_BASE, path, { ...options, method: "GET" });
  },
  post(path, json, options) {
    return requestAtBase(DOWNLOAD_DATA_API_V1_BASE, path, { ...options, method: "POST", json });
  },
  put(path, json, options) {
    return requestAtBase(DOWNLOAD_DATA_API_V1_BASE, path, { ...options, method: "PUT", json });
  },
  patch(path, json, options) {
    return requestAtBase(DOWNLOAD_DATA_API_V1_BASE, path, { ...options, method: "PATCH", json });
  },
  delete(path, options) {
    return requestAtBase(DOWNLOAD_DATA_API_V1_BASE, path, { ...options, method: "DELETE" });
  }
};

export const downloadData = (params) => {
  return http.post("/download_data", params);
};

export const getBackgroundStatus = (jobId) => {
  return http.get(`/background/${jobId}`);
};
