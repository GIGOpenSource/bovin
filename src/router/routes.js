import PanelShell from "../layouts/PanelShell.vue";
import { PANEL_SECTION_IDS } from "./sections.js";

export function buildPanelRoutes() {
  return [
    {
      path: "/",
      component: PanelShell,
      children: [
        ...PANEL_SECTION_IDS.map((id) => ({
          path: id,
          name: id,
          component: { name: `RoutePlaceholder_${id}`, render: () => null }
        })),
        { path: "", redirect: { name: "overview" } },
        { path: ":pathMatch(.*)*", redirect: { name: "overview" } }
      ]
    }
  ];
}
