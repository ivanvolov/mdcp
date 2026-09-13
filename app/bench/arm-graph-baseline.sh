#!/bin/bash
# Graph control arm: The Graph's official subgraph-mcp tools, one process call
# per capability. Same unmodified upstream server as the mdcp arm; the only
# variable is interaction shape.
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a
GRAPH_UPSTREAM=1 STATE_DIR=.state-graph-baseline BENCH_LOG=bench/logs/graph-baseline.jsonl exec npx tsx bench/cli.ts "$@"
