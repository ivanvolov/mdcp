/**
 * Benchmark instrumentation.
 *
 * Every tool invocation on either server appends one JSONL record. The analyzer
 * (bench/analyze.ts) turns those records into the numbers we report.
 *
 * What we record is deliberately raw: paths, byte sizes, durations. All
 * interpretation happens in the analyzer so the measurement itself stays
 * auditable.
 */
import fs from "node:fs";
import path from "node:path";

const LOG_PATH = process.env.BENCH_LOG;

export interface CallRecord {
  ts: number;
  /** "baseline" | "mdcp" */
  server: string;
  /** MCP tool name the model actually called */
  mcpTool: string;
  /** underlying capability, when reached through the sandbox */
  innerTool?: string;
  argsBytes: number;
  resultBytes: number;
  durationMs: number;
  ok: boolean;
  /**
   * True when this call crossed the model boundary — i.e. it cost a full
   * round-trip and its payload entered the transcript. Inner sandbox calls are
   * false: they happen without the model seeing them, which is the whole point.
   */
  boundary?: boolean;
}

let sequence = 0;

export function logCall(rec: Omit<CallRecord, "ts">) {
  if (!LOG_PATH) return;
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(
    LOG_PATH,
    JSON.stringify({ seq: sequence++, ts: Date.now(), ...rec }) + "\n",
  );
}

export function bytesOf(value: unknown): number {
  if (value === undefined) return 0;
  return Buffer.byteLength(
    typeof value === "string" ? value : JSON.stringify(value) ?? "",
    "utf8",
  );
}

/** Records the static surface (tool schemas) the model carries every turn. */
export function logSurface(server: string, surfaceBytes: number, toolCount: number) {
  if (!LOG_PATH) return;
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(
    LOG_PATH,
    JSON.stringify({
      kind: "surface",
      ts: Date.now(),
      server,
      surfaceBytes,
      toolCount,
    }) + "\n",
  );
}
