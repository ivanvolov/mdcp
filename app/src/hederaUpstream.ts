/**
 * MCP-upstream adapter pointed at Hedera's own mirror-node MCP server.
 *
 * Deliberately a sibling of graphUpstream.ts rather than a refactor of it: that
 * file backs recorded benchmark numbers and is left untouched.
 *
 * Why this upstream matters. hedera-dev/mirrornode-mcp-server generates one MCP
 * tool per mirror-node GET endpoint (43 of them) straight from the OpenAPI
 * spec. That is the per-tool shape: one model round-trip per call and a full
 * JSON-Schema catalog resident in context — structurally the same as The
 * Graph's subgraph-mcp, and where the interaction-shape win is largest
 * (BENCHMARK.md §4: 47,766 -> 434 bytes into context, 6 round-trips -> 1).
 *
 * The server is used unmodified, serving live testnet mirror-node data.
 *
 * Transport, in order of preference:
 *   1. MIRRORNODE_MCP_BIN — the upstream's tool definitions served over stdio.
 *   2. MIRRORNODE_MCP_URL — the upstream's own SSE endpoint (see caveat below).
 *
 * Two upstream defects found while wiring this up, both worth a PR:
 *   - A clean clone does not start: fastmcp pulls zod-to-json-schema, which
 *     imports the `zod/v3` subpath, but the repo pins zod 3.24.2, which
 *     predates it. Pinning zod-to-json-schema@3.24.1 gets past it.
 *   - Once running, its SSE endpoint answers HTTP 500 "Error creating server"
 *     on every connection — reproduced with the repo's own pinned versions, so
 *     the 43 tools it defines are unreachable as shipped. That is why stdio is
 *     the preferred transport here.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { registerTools, type ToolDef } from "./tools.js";

const DEFAULT_URL =
  process.env.MIRRORNODE_MCP_URL ??
  "http://127.0.0.1:3333/hedera-testnet-mirror-node-api/sse";

let client: Client | null = null;
let registered = false;

/**
 * Bytes a conventional MCP client would hold in context just to *have* these
 * tools available: name + description + full JSON Schema per tool, as the
 * upstream advertises them.
 *
 * Measured from the upstream's own listTools response rather than from mdcp's
 * catalog entries, which use a passthrough schema and would understate it by
 * an order of magnitude.
 */
export let upstreamCatalogBytes = 0;

/** JSON Schema -> compact TS type string, the catalog's signature currency. */
function tsType(s: any): string {
  if (!s || typeof s !== "object") return "unknown";
  if (s.enum) return s.enum.map((v: unknown) => JSON.stringify(v)).join(" | ");
  switch (s.type) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return `${tsType(s.items)}[]`;
    case "object": {
      const props = s.properties ?? {};
      const required = new Set<string>(s.required ?? []);
      const fields = Object.entries(props)
        .map(([k, v]) => `${k}${required.has(k) ? "" : "?"}: ${tsType(v)}`)
        .join("; ");
      return fields ? `{ ${fields} }` : "object";
    }
    default:
      return "unknown";
  }
}

/**
 * Upstream failures come back as data rather than throwing: a host-side throw
 * aborts the whole sandbox run, while an error value lets the program branch
 * and keep going — sweeping many accounts must survive one 404.
 */
function unwrap(result: any): unknown {
  const text = result?.content
    ?.filter((c: any) => c?.type === "text")
    .map((c: any) => c.text)
    .join("\n");
  if (result?.isError) return { ok: false, error: String(text ?? "upstream_tool_error") };
  if (text == null) return result;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function connect(): Promise<Client> {
  if (client) return client;
  const bin = process.env.MIRRORNODE_MCP_BIN;
  const transport = bin
    ? new StdioClientTransport({
        command: "bun",
        args: ["run", bin],
        env: { ...(process.env as Record<string, string>) },
      })
    : new SSEClientTransport(new URL(DEFAULT_URL));
  const c = new Client({ name: "mdcp-upstream", version: "0.1.0" });
  await c.connect(transport);
  client = c;
  return c;
}

/**
 * Discover the upstream's tools and register them as `mirror.<tool_name>`.
 * Idempotent; costs one listTools call.
 *
 * The server only exposes GET endpoints, so every tool is a read and
 * classifies as "view" — auto-allowed by the sandbox policy gate, no approval
 * round-trip, and no HBAR.
 */
export async function ensureMirrorTools(): Promise<ToolDef[]> {
  if (registered) return [];
  const c = await connect();
  const { tools } = await c.listTools();

  upstreamCatalogBytes = tools.reduce(
    (n, t) =>
      n +
      t.name.length +
      (t.description ?? "").length +
      JSON.stringify(t.inputSchema ?? {}).length,
    0,
  );

  const defs: ToolDef[] = tools.map((t) => {
    const path = `mirror.${t.name}`;
    return {
      path,
      summary: (t.description ?? "").split("\n")[0].slice(0, 160),
      signature: `${path}(a: ${tsType(t.inputSchema)}): unknown`,
      schema: z.object({}).passthrough(),
      sideEffect: "view",
      invoke: async (args) => {
        try {
          return unwrap(await c.callTool({ name: t.name, arguments: args ?? {} }));
        } catch (error: any) {
          return { ok: false, error: String(error?.message ?? error) };
        }
      },
    };
  });

  registerTools(defs);
  registered = true;
  return defs;
}

/** Close the SSE connection so a CLI process can exit. */
export async function closeMirrorUpstream() {
  if (client) {
    await client.close().catch(() => {});
    client = null;
  }
}
