/** 将各形态 REST 响应规范为交易对字符串数组（Freqtrade / Bovin 兼容）。 */
function normPair(x) {
  if (x == null) return "";
  if (typeof x === "string") return x.trim();
  if (typeof x === "object" && x.pair != null) return String(x.pair).trim();
  return String(x).trim();
}

/**
 * 从对象中按字段顺序读取若干数组，合并为交易对列表并去重（保留首次出现顺序）。
 * 兼容 Freqtrade 风格：`blacklist` + `blacklist_expanded`，`whitelist` + `whitelist_expanded`，
 * 以及 `length` / `errors` / `method` 等元数据字段（忽略）。
 *
 * @param {unknown} payload
 * @param {readonly string[]} keys
 */
function pairsByKeysMerge(payload, keys) {
  if (payload == null) return [];
  if (Array.isArray(payload)) return payload.map(normPair).filter(Boolean);
  if (typeof payload !== "object") return [];
  const o = /** @type {Record<string, unknown>} */ (payload);
  const seen = new Set();
  const out = [];
  for (const k of keys) {
    const v = o[k];
    if (!Array.isArray(v)) continue;
    for (const x of v.map(normPair).filter(Boolean)) {
      if (seen.has(x)) continue;
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

/** @param {unknown} payload */
export function pairsFromWhitelistPayload(payload) {
  return pairsByKeysMerge(payload, [
    "whitelist",
    "whitelist_expanded",
    "pair_whitelist",
    "pairs",
    "pairlist"
  ]);
}

/** @param {unknown} payload */
export function pairsFromBlacklistPayload(payload) {
  return pairsByKeysMerge(payload, ["blacklist", "blacklist_expanded", "pair_blacklist"]);
}
