export const PANEL_SECTION_IDS = [
  "overview",
  "positions",
  "control",
  "data",
  "settings",
  "monitor",
  "api"
];

export function isPanelSectionId(value) {
  return PANEL_SECTION_IDS.includes(String(value || ""));
}

export function sectionIdToRoutePath(sectionId) {
  return `/${String(sectionId || "overview")}`;
}
