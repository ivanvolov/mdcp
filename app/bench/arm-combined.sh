#!/bin/bash
# Cross-system arm: The Graph's official subgraph-mcp upstream AND the Hedera
# HTS family in ONE catalog, reached from one execute() program.
#
# This is the composition case executor.sh's headline actually claims — the
# advantage of code mode scales with the number of systems being joined, not
# with the depth of any single one. Graph results feed Hedera transaction
# arguments inside the sandbox; the handoff never enters model context.
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a
HEDERA_TOOLS=1 GRAPH_UPSTREAM=1 STATE_DIR=.state-combined BENCH_LOG=bench/logs/combined-mdcp.jsonl \
  SANDBOX_TIMEOUT_MS=180000 exec npx tsx bench/cli.ts "$@"
