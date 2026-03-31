/**
 * 设置中心页面对应的 REST 接口（偏好、面板用户、登录）
 */
import { http, request } from "../utils/http.js";

export const getPanelPreferences = () => http.get("/panel/preferences");
export const postPanelPreferences = (body) => http.post("/panel/preferences", body);
export const getShowConfig = () => http.get("/show_config");

export const getPanelUsers = () => http.get("/panel/users");
export const postPanelUser = (body) => http.post("/panel/users", body);
/** @param {string | number} userId */
export const patchPanelUser = (userId, body) =>
  request(`/panel/users/${encodeURIComponent(String(userId))}`, { method: "PATCH", json: body });
/** @param {string | number} userId */
export const deletePanelUser = (userId) =>
  http.delete(`/panel/users/${encodeURIComponent(String(userId))}`);

export const postPanelAuthLogin = (body) => http.post("/panel/auth/login", body);
