import { createRouter, createWebHashHistory } from "vue-router";
import { buildPanelRoutes } from "./routes.js";

export const panelRouter = createRouter({
  history: createWebHashHistory(),
  routes: buildPanelRoutes()
});

export default panelRouter;
