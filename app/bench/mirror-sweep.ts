/**
 * Hedera mirror-node MCP: per-tool calls vs one execute() program.
 *
 * Deterministic (no agents, no HBAR — every mirror tool is a GET), so the
 * numbers are reproducible and isolate interaction shape from model variance.
 *
 * Both arms use Hedera's OWN tool definitions from
 * hedera-dev/mirrornode-mcp-server, unmodified, served live from testnet. The
 * only variable is where the calls happen: through the model one at a time, or
 * inside the sandbox with only the aggregate returned.
 *
 * This is the surface §4/§5 could not measure. Those rounds benchmarked
 * hedera-skills, whose SKILL.md tells the agent to write a script — already
 * code-mode, so a code-mode gateway had nothing to remove. The mirror-node MCP
 * server is the other shape: one tool per endpoint, one round-trip per call.
 *
 * Run (from app/), with the upstream reachable:
 *   MIRRORNODE_MCP_BIN=<clone>/stdioServer.mjs npx tsx bench/mirror-sweep.ts
 */
import { TOOLS, TOOL_BY_PATH, jsonSafe } from "../src/tools.js";
import { catalogSignatures, execute } from "../src/sandbox.js";
import {
  ensureMirrorTools,
  closeMirrorUpstream,
  upstreamCatalogBytes,
} from "../src/hederaUpstream.js";

const OPERATOR = process.env.HEDERA_OPERATOR_ID ?? "0.0.10521296";
const TOKEN = process.env.BENCH_TOKEN_ID ?? "0.0.10521642";
const TOPIC = process.env.BENCH_TOPIC_ID ?? "0.0.10521641";

await ensureMirrorTools();

/**
 * Task: a portfolio + audit review of one operator account — exactly the kind
 * of question the mirror node exists to answer, needing six endpoints.
 */
const CALLS: [string, Record<string, unknown>][] = [
  ["mirror.getAccount", { idOrAliasOrEvmAddress: OPERATOR }],
  ["mirror.getTokensByAccountId", { idOrAliasOrEvmAddress: OPERATOR }],
  ["mirror.getToken", { tokenId: TOKEN }],
  ["mirror.getTokenBalances", { tokenId: TOKEN }],
  ["mirror.getTopicMessages", { topicId: TOPIC }],
  ["mirror.getTransactions", { "account.id": OPERATOR, limit: 25 }],
];

// ---- Arm A: per-tool MCP. Every result crosses into the model's context. ----
let baselineBytes = 0;
const startA = Date.now();
for (const [path, args] of CALLS) {
  const tool = TOOL_BY_PATH.get(path)!;
  const result = jsonSafe(await tool.invoke(args));
  baselineBytes += Buffer.byteLength(JSON.stringify(result), "utf8");
}
const wallA = Date.now() - startA;

// ---- Arm B: one program. Only the aggregate crosses. ----
const program = `
  const acct = await tools["mirror.getAccount"]({ idOrAliasOrEvmAddress: ${JSON.stringify(OPERATOR)} });
  const held = await tools["mirror.getTokensByAccountId"]({ idOrAliasOrEvmAddress: ${JSON.stringify(OPERATOR)} });
  const token = await tools["mirror.getToken"]({ tokenId: ${JSON.stringify(TOKEN)} });
  const holders = await tools["mirror.getTokenBalances"]({ tokenId: ${JSON.stringify(TOKEN)} });
  const trail = await tools["mirror.getTopicMessages"]({ topicId: ${JSON.stringify(TOPIC)} });
  const txs = await tools["mirror.getTransactions"]({ "account.id": ${JSON.stringify(OPERATOR)}, limit: 25 });

  // Filtering, decoding and aggregation happen here — not in the transcript.
  // QuickJS has no atob, so base64 is decoded explicitly. Doing it in the
  // sandbox is the point: the baseline ships the encoded blobs to the model
  // and decodes them there, paying context for bytes nobody wanted.
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function b64decode(str) {
    let out = "", bits = 0, acc = 0;
    for (const ch of str.replace(/=+$/, "")) {
      const idx = B64.indexOf(ch);
      if (idx < 0) continue;
      acc = (acc << 6) | idx;
      bits += 6;
      if (bits >= 8) { bits -= 8; out += String.fromCharCode((acc >> bits) & 0xff); }
    }
    return out;
  }
  const nonZero = (holders.balances ?? []).filter(b => Number(b.balance) > 0);
  const events = (trail.messages ?? []).map(m => {
    try { return JSON.parse(b64decode(m.message)); } catch { return null; }
  }).filter(Boolean);
  const byType = {};
  for (const t of (txs.transactions ?? [])) byType[t.name] = (byType[t.name] ?? 0) + 1;

  return {
    account: acct.account,
    hbar: (acct.balance.balance / 1e8).toFixed(4),
    tokensHeld: (held.tokens ?? []).length,
    token: { id: token.token_id, symbol: token.symbol, supply: token.total_supply },
    holders: nonZero.length,
    topHolder: nonZero.sort((a,b) => Number(b.balance) - Number(a.balance))[0],
    auditEvents: events.map(e => e.event),
    recentTxByType: byType,
  };
`;

const startB = Date.now();
const outcome = await execute(program);
const wallB = Date.now() - startB;
const mdcpBytes = Buffer.byteLength(JSON.stringify(outcome.result ?? {}), "utf8");

// ---- Catalog surface: what each shape costs just to have the tools ----
// Per-tool MCP: every tool's schema is resident in context before any work.
// mdcp: one `execute` tool whose description carries compact TS signatures.
const mirrorTools = TOOLS.filter((t) => t.path.startsWith("mirror."));
const mdcpSignatureBytes = catalogSignatures()
  .split("\n")
  .filter((l) => l.startsWith("mirror."))
  .join("\n").length;

console.log(
  JSON.stringify(
    {
      task: "operator portfolio + audit review (6 mirror-node endpoints)",
      upstream: "hedera-dev/mirrornode-mcp-server (unmodified tool definitions), live testnet",
      toolsDiscovered: mirrorTools.length,
      perToolArm: {
        modelRoundTrips: CALLS.length,
        bytesIntoContext: baselineBytes,
        wallMs: wallA,
      },
      mdcpArm: {
        modelRoundTrips: 1,
        bytesIntoContext: mdcpBytes,
        wallMs: wallB,
        status: outcome.status,
      },
      payloadRatio: Number((baselineBytes / mdcpBytes).toFixed(1)),
      roundTripRatio: CALLS.length,
      bytesAbsorbedInSandbox: baselineBytes - mdcpBytes,
      catalog: {
        perToolMcpBytes: upstreamCatalogBytes,
        mdcpSignatureBytes,
        ratio: Number((upstreamCatalogBytes / mdcpSignatureBytes).toFixed(1)),
      },
      result: outcome.result,
    },
    null,
    2,
  ),
);

await closeMirrorUpstream();
process.exit(0);
