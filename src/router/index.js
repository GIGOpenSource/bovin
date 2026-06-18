import { createRouter, createWebHashHistory } from "vue-router";
import { buildPanelRoutes } from "./routes.js";
import { stripSensitiveQueryParamsFromUrl } from "../utils/strip-sensitive-url-params.js";
import { uiState } from "../store/state-core.js";
import { state } from "../store/state-core.js";

export const panelRouter = createRouter({
  history: createWebHashHistory(),
  routes: buildPanelRoutes()
});

panelRouter.beforeEach((to, from, next) => {
  const isLoggedIn = uiState.authed && String(state.password || "").trim();
  const isLoginPage = to.name === "login";
  
  if (isLoginPage) {
    if (isLoggedIn) {
      const lastSection = localStorage.getItem("ft_active_section") || "overview";
      next({ name: lastSection });
    } else {
      next();
    }
  } else {
    if (isLoggedIn) {
      next();
    } else {
      next({ name: "login" });
    }
  }
});

panelRouter.afterEach(() => {
  stripSensitiveQueryParamsFromUrl();
});

export default panelRouter;
