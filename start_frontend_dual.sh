#!/usr/bin/env bash
# 同时提供 HTTP（静态）与 HTTPS（静态 + /api/v1、/health 反代），便于本机 HTTP 与手机 HTTPS 二选一访问。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HEALTH_SCRIPT="${SCRIPT_DIR}/check_frontend_health.sh"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
CHECK_ONLY="${1:-}"

if [[ ! -x "${HEALTH_SCRIPT}" ]]; then
  chmod +x "${HEALTH_SCRIPT}"
fi

echo "[STEP] 运行前置健康检查..."
"${HEALTH_SCRIPT}"

if [[ "${CHECK_ONLY}" == "--check-only" ]]; then
  echo "[DONE] 健康检查完成（未启动服务）"
  exit 0
fi

cleanup() {
  if [[ -n "${HTTP_PID:-}" ]]; then kill "${HTTP_PID}" 2>/dev/null || true; fi
  if [[ -n "${HTTPS_PID:-}" ]]; then kill "${HTTPS_PID}" 2>/dev/null || true; fi
}
trap cleanup INT TERM EXIT

echo "[STEP] 启动 HTTP 静态服务 + HTTPS（含 API 反代）..."
python3 -m http.server "${FRONTEND_PORT}" --bind "${FRONTEND_HOST}" --directory "${SCRIPT_DIR}" &
HTTP_PID=$!
python3 "${SCRIPT_DIR}/serve_https_lan.py" &
HTTPS_PID=$!

echo "[INFO] HTTP  监听: http://${FRONTEND_HOST}:${FRONTEND_PORT}/"
echo "[INFO] HTTPS 监听: https://${FRONTEND_HOST}:3443/ （默认端口，见 serve_https_lan 环境变量）"
echo "[INFO] 按 Ctrl+C 将结束两个进程"
wait "${HTTP_PID}" "${HTTPS_PID}" || true
