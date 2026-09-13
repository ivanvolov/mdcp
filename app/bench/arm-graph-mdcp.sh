#!/bin/bash
# Graph treatment arm: same official subgraph-mcp upstream, reached from inside
# one execute() program — schemas and raw query results stay in the sandbox.
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a
GRAPH_UPSTREAM=1 STATE_DIR=.state-graph-mdcp BENCH_LOG=bench/logs/graph-mdcp.jsonl exec npx tsx bench/cli.ts "$@"
