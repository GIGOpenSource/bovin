/**
 * 「接口能力」页：探测类、面板扩展接口（接口清单数据可按需从服务端或脚本生成后接入）
 */
import { http, request } from "../utils/http.js";

export const postPanelExchangeProbe = (body) => http.post("/panel/exchange_probe", body);
export const postPanelLlmProbe = (body) => http.post("/panel/llm_probe", body);
export const postPanelStrategyRulesAppend = (body) =>
  request("/panel/strategy-rules/append", { method: "POST", json: body });
export const getPanelStrategyPresets = () => http.get("/panel/strategy-presets");
