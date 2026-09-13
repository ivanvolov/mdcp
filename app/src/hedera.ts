/**
 * Hedera layer: Hiero SDK client + HTS (Hedera Token Service) helpers.
 *
 * Same philosophy as chain.ts: deliberately thin, one implementation that both
 * the per-tool baseline and the mdcp code-mode gateway call, so a benchmark
 * between the two measures the protocol shape, not two implementations.
 *
 * Unlike the EVM layer there is no local fork profile — HTS is a native
 * service, so all runs are level 3 (live Hedera testnet). Views go through the
 * free mirror-node REST API; only writes cost testnet HBAR.
 *
 * Operator identity: HEDERA_OPERATOR_KEY (ECDSA hex). The 0.0.x account id is
 * resolved once from the mirror node via the key's EVM alias, so funding the
 * alias at the faucet is the only setup step. HEDERA_OPERATOR_ID overrides.
 *
 * Recipient accounts created by hts.createAccount get host-generated keys kept
 * in STATE_DIR/hedera-keys.json — the sandbox can *reference* those accounts
 * (associate/receive), but their keys never enter it. That mirrors the
 * official skill's multi-party flows (recipient signs association) without
 * handing key material to the model.
 */
import fs from "node:fs";
import path from "node:path";
import {
  AccountCreateTransaction,
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  TransferTransaction,
  type Transaction,
} from "@hiero-ledger/sdk";

const NETWORK = process.env.HEDERA_NETWORK ?? "testnet";
const MIRROR_BASE =
  process.env.HEDERA_MIRROR_URL ?? `https://${NETWORK}.mirrornode.hedera.com`;

const STATE_DIR = process.env.STATE_DIR ?? path.join(process.cwd(), ".state");
const KEYSTORE = path.join(STATE_DIR, "hedera-keys.json");

function operatorKey(): PrivateKey {
  const hex = process.env.HEDERA_OPERATOR_KEY;
  if (!hex) throw new Error("HEDERA_OPERATOR_KEY missing (ECDSA hex, funded via faucet)");
  return PrivateKey.fromStringECDSA(hex);
}

async function mirror(pathname: string): Promise<any> {
  const res = await fetch(`${MIRROR_BASE}/api/v1${pathname}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`mirror_error ${res.status}: ${pathname}`);
  return res.json();
}

let cached: { client: Client; operatorId: AccountId } | null = null;

/** Lazy: resolves the operator 0.0.x id from the key's EVM alias on first use. */
async function ctx(): Promise<{ client: Client; operatorId: AccountId }> {
  if (cached) return cached;
  const key = operatorKey();
  let idStr = process.env.HEDERA_OPERATOR_ID;
  if (!idStr) {
    const evm = `0x${key.publicKey.toEvmAddress()}`;
    const acct = await mirror(`/accounts/${evm}`);
    if (!acct?.account) {
      throw new Error(
        `operator account not found on ${NETWORK} for alias ${evm} — fund it at the faucet first`,
      );
    }
    idStr = acct.account as string;
  }
  const operatorId = AccountId.fromString(idStr);
  const client = Client.forName(NETWORK).setOperator(operatorId, key);
  cached = { client, operatorId };
  return cached;
}

function hashscan(txId: string): string {
  return `https://hashscan.io/${NETWORK}/transaction/${txId}`;
}

/** Every write funnels through here: execute, wait for the receipt, normalize. */
async function run(tx: Transaction, extraSigners: PrivateKey[] = []) {
  const { client } = await ctx();
  let prepared = tx;
  if (extraSigners.length > 0) {
    prepared = tx.freezeWith(client);
    for (const k of extraSigners) prepared = await prepared.sign(k);
  }
  const response = await prepared.execute(client);
  const receipt = await response.getReceipt(client);
  const txId = response.transactionId.toString();
  return { receipt, txId, status: receipt.status.toString(), hashscanUrl: hashscan(txId) };
}

// ---- recipient keystore (host-side only) ----

function loadKeystore(): Record<string, string> {
  if (!fs.existsSync(KEYSTORE)) return {};
  return JSON.parse(fs.readFileSync(KEYSTORE, "utf8"));
}

function saveKeystoreEntry(accountId: string, keyHex: string) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const store = loadKeystore();
  store[accountId] = keyHex;
  fs.writeFileSync(KEYSTORE, JSON.stringify(store, null, 2));
}

function storedKey(accountId: string): PrivateKey {
  const hex = loadKeystore()[accountId];
  if (!hex) {
    throw new Error(
      `no_stored_key: ${accountId} — only accounts created by hts.createAccount can sign here`,
    );
  }
  return PrivateKey.fromStringECDSA(hex);
}

// ---- views (mirror node, free) ----

export async function networkInfo() {
  const { operatorId } = await ctx();
  const acct = await mirror(`/accounts/${operatorId.toString()}`);
  return {
    network: NETWORK,
    operatorId: operatorId.toString(),
    hbarBalance: acct ? (acct.balance.balance / 1e8).toFixed(8) : "0",
  };
}

export async function tokenInfo(a: { tokenId: string }) {
  const t = await mirror(`/tokens/${a.tokenId}`);
  if (!t) throw new Error(`token_not_found: ${a.tokenId} (mirror node lags ~3s after creation)`);
  return {
    tokenId: t.token_id,
    name: t.name,
    symbol: t.symbol,
    type: t.type,
    decimals: Number(t.decimals),
    totalSupply: t.total_supply,
    treasury: t.treasury_account_id,
    supplyType: t.supply_type,
    maxSupply: t.max_supply,
  };
}

export async function accountBalances(a?: { accountId?: string }) {
  const id = a?.accountId ?? (await ctx()).operatorId.toString();
  const acct = await mirror(`/accounts/${id}`);
  if (!acct) throw new Error(`account_not_found: ${id}`);
  const tokens = await mirror(`/accounts/${id}/tokens?limit=100`);
  return {
    accountId: id,
    hbar: (acct.balance.balance / 1e8).toFixed(8),
    tokens: Object.fromEntries(
      (tokens?.tokens ?? []).map((t: any) => [t.token_id, String(t.balance)]),
    ),
  };
}

// ---- writes (consensus nodes, cost testnet HBAR) ----

export async function createToken(a: {
  name: string;
  symbol: string;
  decimals?: number;
  initialSupply?: string;
  tokenType?: "fungible" | "nft";
  maxSupply?: string;
}) {
  const { operatorId } = await ctx();
  const key = operatorKey();
  const isNft = a.tokenType === "nft";
  const tx = new TokenCreateTransaction()
    .setTokenName(a.name)
    .setTokenSymbol(a.symbol)
    .setTreasuryAccountId(operatorId)
    .setAdminKey(key)
    .setSupplyKey(key);
  if (isNft) {
    tx.setTokenType(TokenType.NonFungibleUnique);
    if (a.maxSupply) tx.setSupplyType(TokenSupplyType.Finite).setMaxSupply(Number(a.maxSupply));
  } else {
    tx.setDecimals(a.decimals ?? 0).setInitialSupply(Number(a.initialSupply ?? 0));
  }
  const { receipt, txId, status, hashscanUrl } = await run(tx);
  return { tokenId: receipt.tokenId!.toString(), status, txId, hashscanUrl };
}

export async function mint(a: { tokenId: string; amount?: string; metadata?: string[] }) {
  const tx = new TokenMintTransaction().setTokenId(a.tokenId);
  if (a.metadata?.length) {
    for (const m of a.metadata) tx.addMetadata(Buffer.from(m));
  } else {
    tx.setAmount(Number(a.amount ?? 0));
  }
  const { receipt, txId, status, hashscanUrl } = await run(tx);
  return {
    status,
    txId,
    hashscanUrl,
    newTotalSupply: receipt.totalSupply?.toString(),
    serials: receipt.serials?.map((s) => s.toString()),
  };
}

export async function createAccount(a?: { initialHbar?: number; maxAutoAssociations?: number }) {
  const key = PrivateKey.generateECDSA();
  const tx = new AccountCreateTransaction()
    .setECDSAKeyWithAlias(key)
    .setInitialBalance(new Hbar(a?.initialHbar ?? 1))
    .setMaxAutomaticTokenAssociations(a?.maxAutoAssociations ?? 0);
  const { receipt, txId, status, hashscanUrl } = await run(tx);
  const accountId = receipt.accountId!.toString();
  saveKeystoreEntry(accountId, key.toStringRaw());
  return { accountId, status, txId, hashscanUrl };
}

export async function associate(a: { accountId: string; tokenId: string }) {
  const tx = new TokenAssociateTransaction()
    .setAccountId(AccountId.fromString(a.accountId))
    .setTokenIds([a.tokenId]);
  const { txId, status, hashscanUrl } = await run(tx, [storedKey(a.accountId)]);
  return { status, txId, hashscanUrl };
}

export async function transfer(a: {
  tokenId: string;
  to: string;
  amount?: string;
  serial?: number;
  from?: string;
}) {
  const { operatorId } = await ctx();
  const from = a.from ?? operatorId.toString();
  const tx = new TransferTransaction();
  if (a.serial != null) {
    tx.addNftTransfer(a.tokenId, a.serial, from, a.to);
  } else {
    const amount = Number(a.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`invalid_amount: ${a.amount}`);
    // Signed legs net to zero by construction — the skill's gotcha #2 lives
    // here instead of in the model's memory.
    tx.addTokenTransfer(a.tokenId, from, -amount).addTokenTransfer(a.tokenId, a.to, amount);
  }
  const signers = from === operatorId.toString() ? [] : [storedKey(from)];
  const { txId, status, hashscanUrl } = await run(tx, signers);
  return { status, txId, hashscanUrl };
}
