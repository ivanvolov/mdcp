#!/bin/bash
# Treatment arm: one process call carrying a program.
cd "$(dirname "$0")/.."
RPC_URL=http://127.0.0.1:8546 STATE_DIR=.state-mdcp BENCH_LOG=bench/logs/mdcp.jsonl exec npx tsx bench/cli.ts "$@"
