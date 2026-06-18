import { http } from "../utils/http.js";

export const getPerformance = () => http.get("/performance");
export const getEntries = () => http.get("/entries");
export const getExits = () => http.get("/exits");
export const getMixTags = () => http.get("/mix_tags");