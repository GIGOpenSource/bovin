/**
 * Bovin /api/v1/message/ws：订阅 RPC 消息流，驱动面板增量刷新（与 REST 轮询互补）。
 * 鉴权：query token = api_server.ws_token（或短期 JWT）；见 bovin/rpc/api_server/api_ws.py
 */

const DEFAULT_TOPICS = [
  "status",
  "warning",
  "exception",
  "startup",
  "entry",
  "entry_fill",
  "entry_cancel",
  "exit",
  "exit_fill",
  "exit_cancel",
  "protection_trigger",
  "protection_trigger_global",
  "strategy_msg",
  "whitelist",
  "new_candle"
];

/**
 * @param {string} apiV1Base 如 http://host:port/api/v1
 * @param {string} token ws_token 或 JWT
 * @returns {string | null}
 */
export function buildMessageWsUrl(apiV1Base, token) {
  const base = String(apiV1Base || "").trim().replace(/\/+$/, "");
  const tok = String(token || "").trim();
  if (!base || !tok) return null;
  let originPath = base;
  if (base.startsWith("https://")) originPath = `wss://${base.slice(8)}`;
  else if (base.startsWith("http://")) originPath = `ws://${base.slice(7)}`;
  else return null;
  return `${originPath}/message/ws?token=${encodeURIComponent(tok)}`;
}

/**
 * @param {object} options
 * @param {() => string | null} options.getUrl
 * @param {() => void} [options.onOpen]
 * @param {() => void} [options.onClose]
 * @param {(err: unknown) => void} [options.onError]
 * @param {(msg: object) => void} [options.onMessage]
 * @param {() => void} [options.onSkip]
 */
export function createBovinMessageWsClient(options) {
  let ws = null;
  let reconnectDelayMs = 2000;
  let reconnectTimer = null;
  let intentionalClose = false;

  function clearReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect() {
    clearReconnect();
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectDelayMs = Math.min(Math.round(reconnectDelayMs * 1.45), 30000);
      connect();
    }, reconnectDelayMs);
  }

  function connect() {
    if (intentionalClose || typeof WebSocket === "undefined") return;
    const url = options.getUrl();
    if (!url) {
      options.onSkip?.();
      return;
    }
    try {
      ws = new WebSocket(url);
    } catch (err) {
      options.onError?.(err);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectDelayMs = 2000;
      options.onOpen?.();
      try {
        ws?.send(JSON.stringify({ type: "subscribe", data: DEFAULT_TOPICS }));
      } catch {
        // ignore
      }
    };

    ws.onmessage = (ev) => {
      let msg = null;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg && typeof msg === "object") options.onMessage?.(msg);
    };

    ws.onerror = () => {
      options.onError?.(new Error("WebSocket error"));
    };

    ws.onclose = () => {
      options.onClose?.();
      ws = null;
      if (!intentionalClose) scheduleReconnect();
    };
  }

  return {
    start() {
      intentionalClose = false;
      clearReconnect();
      connect();
    },
    stop() {
      intentionalClose = true;
      clearReconnect();
      try {
        ws?.close();
      } catch {
        // ignore
      }
      ws = null;
    }
  };
}
