#!/bin/bash
# Control arm: one process call per capability (the conventional MCP shape).
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a
RPC_URL=http://127.0.0.1:8545 STATE_DIR=.state-baseline BENCH_LOG=bench/logs/baseline.jsonl exec npx tsx bench/cli.ts "$@"
