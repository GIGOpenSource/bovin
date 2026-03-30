#!/usr/bin/env bash
set -euo pipefail

PROXY_HOST="${PROXY_HOST:-127.0.0.1}"
PROXY_PORT="${BINANCE_PROXY_PORT:-19090}"
PROXY_URL="http://${PROXY_HOST}:${PROXY_PORT}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_SCRIPT="${SCRIPT_DIR}/binance_proxy.py"
SAMPLE_SYMBOLS='%5B%22BTCUSDT%22%2C%22ETHUSDT%22%5D'

_tmp_started=0
_tmp_pid=""
_tmp_log="/tmp/binance_proxy_healthcheck.log"

cleanup() {
  if [[ "${_tmp_started}" -eq 1 && -n "${_tmp_pid}" ]]; then
    kill "${_tmp_pid}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

check_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[ERROR] 缺少命令: $1"
    exit 1
  fi
}

check_cmd curl
check_cmd python3

echo "[INFO] 检查代理端口: ${PROXY_URL}"
if ! curl -fsS "${PROXY_URL}/health" >/dev/null 2>&1; then
  echo "[WARN] 代理未运行，尝试临时启动: ${PROXY_SCRIPT}"
  if [[ ! -f "${PROXY_SCRIPT}" ]]; then
    echo "[ERROR] 未找到代理脚本: ${PROXY_SCRIPT}"
    exit 1
  fi

  python3 "${PROXY_SCRIPT}" >"${_tmp_log}" 2>&1 &
  _tmp_pid=$!
  _tmp_started=1
  sleep 1

  if ! kill -0 "${_tmp_pid}" >/dev/null 2>&1; then
    echo "[ERROR] 代理启动失败，日志如下:"
    cat "${_tmp_log}"
    exit 1
  fi
fi

echo "[OK] /health"
curl -fsS "${PROXY_URL}/health" | python3 -m json.tool

UPSTREAM="$("${SCRIPT_DIR}/binance_proxy.py" --print-resolved-upstream 2>/dev/null || true)"
if [[ -n "${UPSTREAM}" ]]; then
  echo "[INFO] 代理上报 Bovin 上游: ${UPSTREAM}"
  if curl -fsS "${UPSTREAM}/api/v1/ping" >/dev/null 2>&1; then
    echo "[OK] Bovin 上游 /api/v1/ping 可达"
  else
    echo "[WARN] Bovin 上游不可达（${UPSTREAM}/api/v1/ping）。面板会出现 502 / 无法加载 preferences。"
    echo "       可执行: ./scripts/start_panel_dev.sh（默认 BOVIN_MODE=trade，含 /start；仅数据站设 BOVIN_MODE=webserver）"
    echo "       或手动: python3 -m bovin trade -c user_data/config.json -c user_data/config.api.json"
  fi
fi

echo "[OK] /api/v1/ticker24hr"
resp="$(curl -fsS "${PROXY_URL}/api/v1/ticker24hr?symbols=${SAMPLE_SYMBOLS}")"
echo "${resp}" | python3 -m json.tool >/dev/null

RESP_JSON="${resp}" python3 - <<'PY'
import json
import os
import sys

raw = os.environ.get("RESP_JSON", "").strip()
data = json.loads(raw)
if not isinstance(data, list) or not data:
    raise SystemExit("ticker24hr 返回非预期: 不是非空数组")

symbols = [item.get("symbol") for item in data if isinstance(item, dict)]
print("[OK] ticker24hr 返回条数:", len(data))
print("[OK] ticker24hr 符号:", ", ".join([s for s in symbols if s][:8]))
PY

echo "[SUCCESS] 前端启动前健康检查通过"
