#!/usr/bin/env tsx
/**
 * Benchmark harness CLI.
 *
 * Both arms of the experiment reach the chain through this one binary, so the
 * only difference measured is the *shape* of the interaction:
 *
 *   baseline:  one process call per capability  (9-ish round-trips)
 *   mdcp:      one process call carrying a program (1-2 round-trips)
 *
 * Every invocation appends a record to $BENCH_LOG.
 */
import { TOOL_BY_PATH, TOOLS, jsonSafe } from "../src/tools.js";
import { execute, resume } from "../src/sandbox.js";
import { bytesOf, logCall } from "../src/instrument.js";
import { ensureGraphTools, closeGraphUpstream } from "../src/graphUpstream.js";

const [, , command, payloadRaw] = process.argv;

function out(value: unknown) {
  const text = JSON.stringify(value);
  process.stdout.write(text + "\n");
  return text;
}

async function main() {
  // Graph scenarios opt in; Uniswap scenarios never pay the upstream handshake.
  if (process.env.GRAPH_UPSTREAM === "1") await ensureGraphTools();

  if (!command || command === "help") {
    out({
      usage: "cli.ts <tool-path|execute|resume> '<json>'",
      tools: TOOLS.map((t) => t.signature),
    });
    return;
  }

  // `execute` accepts either {"code": "..."} or the program source directly, so
  // an agent does not have to JSON-escape a whole TypeScript file on a shell line.
  let payload: any = {};
  if (payloadRaw) {
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      if (command !== "execute") throw new Error(`invalid_json_args: ${payloadRaw}`);
      payload = { code: payloadRaw };
    }
  }

  if (command === "execute") {
    const started = Date.now();
    const outcome = await execute(payload.code);
    const text = out(outcome);
    logCall({
      server: "mdcp",
      mcpTool: "execute",
      argsBytes: bytesOf(payload.code),
      resultBytes: bytesOf(text),
      durationMs: Date.now() - started,
      ok: outcome.status !== "error",
      boundary: true,
    });
    return;
  }

  if (command === "resume") {
    const started = Date.now();
    const outcome = await resume(payload.executionId, payload.approve !== false);
    const text = out(outcome);
    logCall({
      server: "mdcp",
      mcpTool: "resume",
      argsBytes: bytesOf(payloadRaw),
      resultBytes: bytesOf(text),
      durationMs: Date.now() - started,
      ok: outcome.status !== "error",
      boundary: true,
    });
    return;
  }

  const tool = TOOL_BY_PATH.get(command);
  if (!tool) {
    out({ error: `unknown_tool: ${command}`, known: [...TOOL_BY_PATH.keys()] });
    process.exitCode = 1;
    return;
  }

  const started = Date.now();
  let ok = true;
  let result: unknown;
  try {
    result = jsonSafe(await tool.invoke(payload));
  } catch (error: any) {
    ok = false;
    result = { error: String(error?.shortMessage ?? error?.message ?? error) };
  }
  const text = out(result);
  logCall({
    server: "baseline",
    mcpTool: command,
    argsBytes: bytesOf(payloadRaw ?? ""),
    resultBytes: bytesOf(text),
    durationMs: Date.now() - started,
    ok,
    boundary: true,
  });
}

main()
  .catch((error) => {
    out({ error: String(error?.message ?? error) });
    process.exitCode = 1;
  })
  .finally(() => closeGraphUpstream());
