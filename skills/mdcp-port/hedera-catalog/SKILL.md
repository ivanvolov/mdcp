---
name: hedera-catalog
description: "Do anything on Hedera — tokens and consensus topics — by writing one program that runs in a sandbox next to the network. Use for HTS (fungible tokens, NFTs, minting, association, transfers) and HCS (topics, message submission, reading a topic back), including pipelines that span both, such as minting a token and writing its audit trail to a topic. Replaces the hedera-token-service and hedera-consensus-service skills and the Hiero JS SDK setup they describe."
license: Apache-2.0
metadata:
  author: mdcp port of hedera-dev/hedera-skills native-services-js @ 8b1fccd
  version: '0.2.0'
---

# Hedera Catalog — one execute() for every native service

Hedera's native services need no smart contracts: HTS makes tokens first-class
network entities, HCS makes append-only timestamped logs. This skill is the
whole surface in one file. You do not set up a `Client`, call `setOperator`,
freeze, sign, or wait for receipts — the gateway owns that lifecycle host-side.

## Calling convention

Write a TypeScript program and hand it to the gateway. It runs in a QuickJS
sandbox next to the network. Every capability is an async function on `tools`.
Use `await`, loops and conditionals freely. `return` only what the caller needs
— everything else stays in the sandbox and never enters the model's context.

Pass the program **as a file** (preferred — no shell quoting, no escaping):

```bash
# write program.ts with your editor/Write tool, then:
bash bench/arm-hedera.sh execute @program.ts
```

Inline also works for one-liners: `bash bench/arm-hedera.sh execute '<source>'`.

```ts
const topic = await tools["hcs.createTopic"]({ memo: "audit" });
const token = await tools["hts.createToken"]({
  name: "GameGold", symbol: "GG", decimals: 8, initialSupply: "100000000000000",
});
await tools["hcs.submitMessage"]({
  topicId: topic.topicId,
  message: JSON.stringify({ event: "token_created", tokenId: token.tokenId }),
});
return { tokenId: token.tokenId, topicId: topic.topicId };
```

That is a two-service pipeline in one round-trip. The token id flows into the
audit message **inside the sandbox** — it never crosses into model context and
back.

## Capabilities

### HTS — Hedera Token Service

```
hts.network(): { network, operatorId, hbarBalance }                                  // view
hts.tokenInfo({ tokenId }): { name, symbol, type, decimals, totalSupply, treasury }  // view
hts.balances({ accountId? }): { accountId, hbar, tokens: Record<tokenId,string> }    // view
hts.createToken({ name, symbol, decimals?, initialSupply?, tokenType?, maxSupply? })
    : { tokenId, status, txId, hashscanUrl }                                         // chain write
hts.mint({ tokenId, amount?, metadata? }): { status, newTotalSupply?, serials? }     // chain write
hts.createAccount({ initialHbar?, maxAutoAssociations? }): { accountId, status }     // chain write
hts.associate({ accountId, tokenId }): { status, txId }                              // chain write
hts.transfer({ tokenId, to, amount?, serial?, from? }): { status, txId, hashscanUrl } // chain write
```

### HCS — Hedera Consensus Service

```
hcs.createTopic({ memo? }): { topicId, status, txId, hashscanUrl }                   // chain write
hcs.submitMessage({ topicId, message }): { status, txId, sequenceNumber }            // chain write
hcs.messages({ topicId, limit? }): { topicId, messages: [{ sequenceNumber,
    consensusTimestamp, contents }] }                                                // view
```

Notes that save you a retry:

- Amounts are **raw integer strings**: a token with 8 decimals holds `1e8` raw
  per human unit. NFTs (`tokenType: "nft"`) have no decimals and no initial
  supply — mint serials with a `metadata` array, then transfer by `serial`.
- The operator account is treasury of every token it creates, and admin+supply
  keys are set host-side, so tokens stay mintable and updatable.
- `hcs.messages` reads through the **mirror node**, which lags consensus by
  ~3 seconds. Reading a topic in the same program that wrote to it may return
  fewer messages than you submitted; that is the mirror node, not a failure.
  Same applies to `hts.tokenInfo` right after `hts.createToken`.
- Messages over 1KB are chunked host-side; you get one receipt regardless.
- **Errors come back as data**, not exceptions to guess about — branch on them
  and keep going.

## Approval

Chain writes are **not** broadcast on the first call. The program runs to
completion in a planning pass and returns every transaction it intends to make:

```json
{ "status": "awaiting_approval",
  "approval": { "executionId": "b3238339",
    "plan": [ { "tool": "hcs.createTopic",  "args": {...}, "intentHash": "..." },
              { "tool": "hts.createToken", "args": {...}, "intentHash": "..." } ] } }
```

Review the whole pipeline, then approve once:

```bash
bash bench/arm-hedera.sh resume '{"executionId":"b3238339","approve":true}'
```

During planning, entities that do not exist yet report stub ids
(`"0.0.0-planned"`). That is expected — the real ids exist after approval, and
the program re-runs against live state then. Transactions that already landed
replay from the intent ledger instead of being sent twice, and a transaction
that was not in the approved plan goes back for approval rather than executing
silently.

## Guarantees you do not have to implement

- **Keys never enter the sandbox.** Signing happens host-side. Accounts created
  by `hts.createAccount` keep their keys in a host keystore, so the gateway can
  sign an association on their behalf while a program only ever names an
  account id.
- **Transfer legs net to zero by construction** — you cannot express an
  unbalanced transfer.
- **Idempotency.** Each chain write is identified by its economic fields plus
  its occurrence index, so re-running cannot double-spend, and legitimate
  repeats stay distinct. Ids minted earlier in the same program are excluded
  from that identity, because during planning they are stubs.

## What this replaces

The `hedera-token-service` and `hedera-consensus-service` skills and everything
they teach about the Hiero JS SDK: `Client`/`Wallet` setup, the
configure → freeze → sign → execute → receipt lifecycle, multi-party signing,
manual chunking, and mirror-node subscription plumbing. Do not import
`@hiero-ledger/sdk` — the gateway owns it.

Not yet covered (fall back to the official skills): KYC/freeze/wipe/pause
compliance operations, burns, airdrops, custom fee schedules, and topics with
submit keys or custom fees.
