/**
 * Wallet integration (Privy prize target): balances + approvals.
 * Keys are host-side only (Privy server wallet or local keystore) — the sandbox
 * sees addresses and tx hashes, never key material.
 * TODO(h7-10): Privy server-wallet signer behind the pause/resume gate.
 */
import type { ToolDef } from "./index.js";

const todo = async () => ({ ok: false, error: { code: "not_implemented", retryable: false } });

export const walletTools: ToolDef[] = [
  {
    path: "wallet.default.sepolia.balances",
    summary: "Native + ERC-20 balances for the connected wallet",
    inputTS: "{ tokens?: Address[] }",
    outputTS: "{ native: bigint; tokens: { address: Address; symbol: string; balance: bigint }[] }",
    sideEffect: "view",
    invoke: todo,
  },
  {
    path: "wallet.default.sepolia.approve",
    summary: "ERC-20 approve with an exact amount (unlimited approvals are blocked by policy)",
    inputTS: "{ token: Address; spender: Address; amount: bigint }",
    outputTS: "{ txHash: Hex }",
    sideEffect: "write",
    invoke: todo,
  },
];
