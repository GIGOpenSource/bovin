/**
 * 短期内存缓存：减轻大数据量下对 pair_candles / pair_history 的重复请求。
 * 同一 URL（含查询串）在 TTL 内直接命中；仅用于 GET JSON。
 */
const MAX_ENTRIES = 64;
const TTL_MS = 60_000;
const store = new Map();

export function getCachedJsonGet(urlKey) {
  const now = Date.now();
  const row = store.get(urlKey);
  if (!row) return null;
  if (row.exp <= now) {
    store.delete(urlKey);
    return null;
  }
  return row.data;
}

export function setCachedJsonGet(urlKey, data) {
  const now = Date.now();
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
  store.set(urlKey, { exp: now + TTL_MS, data });
}
