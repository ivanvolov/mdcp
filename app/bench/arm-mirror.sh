#!/bin/bash
# Hedera mirror-node arm: Hedera's own MCP server (hedera-dev/mirrornode-mcp-server,
# unmodified, 43 auto-generated GET tools) reached through the mdcp sandbox,
# plus the hts.*/hcs.* write family in the same catalog.
#
# All tools here are reads, so this arm costs zero HBAR.
#
# Start the upstream first:
#   cd <clone-of-mirrornode-mcp-server> && bun run mcpServer.js
# Override its URL with MIRRORNODE_MCP_URL.
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a
MIRROR_UPSTREAM=1 HEDERA_TOOLS=1 STATE_DIR=.state-mirror BENCH_LOG=bench/logs/mirror-mdcp.jsonl \
  SANDBOX_TIMEOUT_MS=180000 exec npx tsx bench/cli.ts "$@"
