/**
 * 监控页面对应的 REST 接口
 */
import { http } from "../utils/http.js";

export const getPing = () => http.get("/ping");
export const getHealth = () => http.get("/health");
export const getVersion = () => http.get("/version");
export const getSysinfo = () => http.get("/sysinfo");
