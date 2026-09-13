/**
 * Generic MCP-upstream adapter, pointed at The Graph's official subgraph-mcp.
 *
 * This is the executor.sh move applied to a partner's own product: mdcp
 * connects to an *unmodified* MCP server as a client, discovers its tools at
 * runtime, and re-exposes them inside the sandbox as `tools["graph.<name>"]`.
 * Nothing of The Graph's is forked or reimplemented — the improvement being
 * measured is purely the interaction shape (N tool round-trips through the
 * model vs one program in the sandbox).
 *
 * Transport, in order of preference:
 *   1. SUBGRAPH_MCP_BIN — a locally built graphops/subgraph-mcp binary over
 *      stdio (millisecond spawn; right for benchmarking, since a fresh process
 *      per harness call must not charge either arm a network handshake).
 *   2. hosted SSE at subgraphs.mcp.thegraph.com, bridged via `npx mcp-remote`
 *      (zero-install fallback).
 * Both need GATEWAY_API_KEY; either way every query is served live by the
 * Graph gateway — no mocks anywhere in the pipeline.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { registerTools, type ToolDef } from "./tools.js";

const HOSTED_SSE = "https://subgraphs.mcp.thegraph.com/sse";

let client: Client | null = null;
let registered = false;

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

async function connect(): Promise<Client> {
  if (client) return client;
  const key = process.env.GATEWAY_API_KEY;
  if (!key) throw new Error("missing_gateway_api_key: set GATEWAY_API_KEY (Subgraph Studio)");

  const bin = process.env.SUBGRAPH_MCP_BIN;
  const transport = bin
    ? new StdioClientTransport({
        command: bin,
        env: { GATEWAY_API_KEY: key, PATH: process.env.PATH ?? "" },
      })
    : new StdioClientTransport({
        command: "npx",
        args: ["-y", "mcp-remote", "--header", `Authorization:Bearer ${key}`, HOSTED_SSE],
        env: { ...(process.env as Record<string, string>) },
      });

  const c = new Client({ name: "mdcp-upstream", version: "0.1.0" });
  await c.connect(transport);
  client = c;
  return c;
}

/**
 * Text-content MCP results unwrap to plain JSON so sandbox code can compute on
 * them. Upstream failures come back as data ({ ok: false, error }) instead of
 * throwing: a thrown host-side error aborts the whole sandbox run with an
 * opaque message, while an error value lets the program branch and continue —
 * probing five subgraphs must survive one of them lacking an entity.
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

/**
 * Discover the upstream's tools and register them in the shared catalog as
 * `graph.<tool_name>`. Idempotent; costs one listTools call.
 *
 * Every subgraph-mcp tool is a read (the server only proxies gateway queries),
 * so they all classify as "view" — auto-allowed by the sandbox policy gate.
 */
export async function ensureGraphTools(): Promise<ToolDef[]> {
  if (registered) return [];
  const c = await connect();
  const { tools } = await c.listTools();

  const defs: ToolDef[] = tools.map((t) => {
    const path = `graph.${t.name}`;
    return {
      path,
      summary: (t.description ?? "").split("\n")[0].slice(0, 160),
      signature: `${path}(a: ${tsType(t.inputSchema)}): unknown`,
      schema: z.object({}).passthrough(),
      sideEffect: "view",
      invoke: async (args) => {
        // callTool throws on MCP protocol errors (-32603 wraps upstream GraphQL
        // failures) — those must reach the program as values too.
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

/** The upstream child process holds stdio pipes open; close it so the CLI can exit. */
export async function closeGraphUpstream() {
  if (client) {
    await client.close().catch(() => {});
    client = null;
  }
}
