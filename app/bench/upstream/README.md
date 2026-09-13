# Upstream: Hedera mirror-node MCP server

`mirrornode-stdio.mjs` serves the **unmodified tool definitions** of
[hedera-dev/mirrornode-mcp-server](https://github.com/hedera-dev/mirrornode-mcp-server)
over stdio. It imports that repo's own `openApiZod.ts` and applies the same
GET-only conversion its `mcpServer.js` does — the 43 tools, their descriptions
and their schemas are theirs verbatim. Only the transport differs.

Why a different transport: the upstream hardcodes SSE via fastmcp, and that
endpoint answers HTTP 500 "Error creating server" on every connection —
reproduced with the repo's own pinned dependencies, so the tools it defines are
unreachable as shipped. See BENCHMARK.md §6.

## Setup

```bash
git clone https://github.com/hedera-dev/mirrornode-mcp-server.git
cd mirrornode-mcp-server
bun install
bun add zod-to-json-schema@3.24.1 @modelcontextprotocol/sdk   # clean clone won't start otherwise
cp <this repo>/app/bench/upstream/mirrornode-stdio.mjs .
```

Then point mdcp at it and run the benchmark:

```bash
# in app/.env
MIRRORNODE_MCP_BIN=/abs/path/to/mirrornode-mcp-server/stdioServer.mjs

bash bench/arm-mirror.sh help                 # 43 mirror.* tools in the catalog
npx tsx bench/mirror-sweep.ts                 # the §6 numbers
```

All tools are GET endpoints, so nothing here costs HBAR.
