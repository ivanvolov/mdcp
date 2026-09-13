#!/bin/bash
# Level-3 arm: mdcp gateway against LIVE Sepolia through the production Trading API.
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a
CHAIN_PROFILE=sepolia STATE_DIR=.state-l3 BENCH_LOG=bench/logs/l3-mdcp.jsonl exec npx tsx bench/cli.ts "$@"
