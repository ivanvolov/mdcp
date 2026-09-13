#!/bin/bash
# Level-3 arm: mdcp gateway against LIVE Hedera testnet (HTS native service).
# All Hedera runs are level 3 — there is no local-fork profile for HTS.
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a
STATE_DIR=.state-hedera BENCH_LOG=bench/logs/hedera-mdcp.jsonl SANDBOX_TIMEOUT_MS=120000 exec npx tsx bench/cli.ts "$@"
