/**
 * Period Breakdown 页面对应的 REST 接口
 * GET /daily, /weekly, /monthly  timescale: 20
 */
import { http } from "../utils/http.js";

export const getDaily = (timescale = 20) =>
  http.get(`/daily?timescale=${timescale}`);

export const getWeekly = (timescale = 20) =>
  http.get(`/weekly?timescale=${timescale}`);

export const getMonthly = (timescale = 20) =>
  http.get(`/monthly?timescale=${timescale}`);