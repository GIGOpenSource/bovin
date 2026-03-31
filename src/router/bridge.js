export function normalizeSectionIdCandidate(raw) {
  const plain = decodeURIComponent(String(raw || "").trim())
    .replace(/^#/, "")
    .replace(/^\/+/, "");
  const id = plain.split(/[/?#]/)[0];
  return id || "";
}

export function createSectionRouteNavigator(router) {
  return (sectionId) => {
    const target = String(sectionId || "").trim() || "overview";
    if (!router?.hasRoute?.(target)) return;
    if (String(router.currentRoute?.value?.name || "") === target) return;
    void router.push({ name: target });
  };
}
