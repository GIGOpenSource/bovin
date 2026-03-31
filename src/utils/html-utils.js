export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

/** 仅允许数字 ID 写入 data-*，防止属性注入。 */
export function safeDataIdAttr(value) {
  const s = String(value ?? "").trim();
  if (!/^\d{1,20}$/.test(s)) return "";
  return s;
}

/** SVG 数值坐标：拒绝 NaN/Infinity，并限制范围。 */
export function sanitizeSvgCoordinate(value, max = 1e6) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, n));
}
