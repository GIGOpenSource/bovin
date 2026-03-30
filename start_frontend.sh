#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HEALTH_SCRIPT="${SCRIPT_DIR}/check_frontend_health.sh"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
# 默认 0.0.0.0 便于手机/同网电脑访问；仅本机可设 FRONTEND_HOST=127.0.0.1
FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
CHECK_ONLY="${1:-}"

if [[ ! -x "${HEALTH_SCRIPT}" ]]; then
  chmod +x "${HEALTH_SCRIPT}"
fi

echo "[STEP] 运行前置健康检查..."
"${HEALTH_SCRIPT}"

if [[ "${CHECK_ONLY}" == "--check-only" ]]; then
  echo "[DONE] 健康检查完成（未启动静态服务）"
  exit 0
fi

echo "[STEP] 启动前端静态服务..."
echo "[INFO] 监听: http://192.168.77.46:8000/"
echo "[INFO] 本机浏览器: http://192.168.77.46:8000/"
if [[ "${FRONTEND_HOST}" == "0.0.0.0" ]] || [[ "${FRONTEND_HOST}" == "*" ]]; then
  LAN_IP=""
  if command -v ipconfig >/dev/null 2>&1; then
    LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  fi
  if [[ -n "${LAN_IP}" ]]; then
    echo "[INFO] 局域网其它设备: http://${LAN_IP}:${FRONTEND_PORT}/ （须同 Wi‑Fi/路由；若打不开请检查本机防火墙）"
  else
    echo "[INFO] 局域网访问: 请将 127.0.0.1 换成本机在路由中的 IPv4（若打不开检查防火墙是否放行端口 ${FRONTEND_PORT}）"
  fi
fi
echo "[INFO] 按 Ctrl+C 停止服务"

python3 -m http.server "${FRONTEND_PORT}" --bind "${FRONTEND_HOST}" --directory "${SCRIPT_DIR}"
