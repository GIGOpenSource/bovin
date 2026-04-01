import { createRouter, createWebHashHistory } from "vue-router";
import { buildPanelRoutes } from "./routes.js";
import { stripSensitiveQueryParamsFromUrl } from "../utils/strip-sensitive-url-params.js";

export const panelRouter = createRouter({
  history: createWebHashHistory(),
  routes: buildPanelRoutes()
});

panelRouter.afterEach(() => {
  stripSensitiveQueryParamsFromUrl();
});

export default panelRouter;
