/** Lazily served docs. Everything verbose lives here, never in tool descriptions. */
export const SKILLS: Record<string, string> = {
  execute: `
# chainmode execute() calling convention

Write TypeScript. A global \`tools\` proxy gives progressive access to on-chain tools:

1. const hits = await tools.search({ query: "swap on uniswap", limit: 8 })
   → { items: [{ path, summary }], total }
2. const t = await tools.describe({ path: "uniswap.default.sepolia.quote" })
   → { inputTS, outputTS }   // compact TypeScript types derived from ABIs
3. const res = await tools.uniswap.default.sepolia.quote({ tokenIn, tokenOut, amountIn })
   → { ok: true, data } | { ok: false, error: { code, message, retryable } }
   Errors are DATA — branch and retry in code, do not throw.

Rules:
- Filter large collections (pools, routes) in code; return only what the user needs.
- emit(value) streams progress; return carries the final structured result.
- State-changing calls pause execution for wallet approval. You will receive
  { paused: true, executionId, approvalUrl }. Tell the user; they approve; the
  runtime resumes your code where it stopped — with re-quoted, re-simulated state.
- Never construct raw transactions; use tools.* which simulate before submitting.
- Submitted transactions are checkpoints: re-running your code cannot re-submit them.
`,
  policies: `
Side-effect policy is derived from the ABI:
- view/pure           → auto-allowed
- nonpayable/payable  → require_approval (pause/resume)
- unlimited approve, delegatecall → blocked by default
`,
  signing: `
Keys never enter the sandbox. On approval, the host signer (Privy server wallet
or local keystore) signs. The sandbox only ever sees addresses and tx hashes.
Resume re-validates: quotes are re-fetched and re-simulated against the slippage
bound recorded at pause time; if drift exceeds the bound, the call returns
{ ok:false, error:{ code:"stale_quote", retryable:true } } instead of executing.
`,
};
