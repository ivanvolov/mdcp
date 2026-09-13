---
name: hedera-token-service
description: "How to create, manage, and transfer tokens on Hedera using the mdcp code-mode gateway. Use this skill whenever the user wants to work with fungible tokens, NFTs, token creation, minting, transfers, token association, or any HTS (Hedera Token Service) operation. Also trigger when users mention ERC-20/ERC-721 equivalents on Hedera, or tokenization on the Hedera network."
license: Apache-2.0
metadata:
  author: mdcp port of hedera-dev/hedera-skills native-services-js @ 8b1fccd
  version: '0.1.0'
prerequisites:
  - mdcp-execute
---

# Hedera Token Service (HTS) — mdcp

HTS is Hedera's native token engine: fungible tokens and NFTs as first-class
network entities, no smart contracts. This skill is the mdcp port of the
official `hedera-token-service` skill — the *same operations*, reached through
one `execute` call instead of hand-written Hiero SDK scripts.

## Calling convention

Same as `mdcp-execute`: send one TypeScript program; it runs in a sandbox next
to the network. Do NOT set up a Client, call setOperator, freeze, sign, or wait
for receipts — the gateway owns the whole
configure -> freeze -> sign -> execute -> receipt lifecycle host-side.

```ts
const token = await tools["hts.createToken"]({
  name: "GameGold", symbol: "GG", decimals: 8, initialSupply: "100000000000000",
});
const rcpt = await tools["hts.createAccount"]({ maxAutoAssociations: 0 });
await tools["hts.associate"]({ accountId: rcpt.accountId, tokenId: token.tokenId });
const tx = await tools["hts.transfer"]({
  tokenId: token.tokenId, to: rcpt.accountId, amount: "50000000000",
});
return { tokenId: token.tokenId, recipient: rcpt.accountId, url: tx.hashscanUrl };
```

That is the full create -> associate -> transfer pipeline: one round-trip, only
the receipt returns to the model.

## Capabilities

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

- Amounts are raw integer strings: a token with 8 decimals holds `1e8` raw per
  human unit. NFTs (`tokenType: "nft"`) have no decimals and no initial supply —
  mint serials with a `metadata` array (one entry per serial), then transfer by
  `serial`.
- The operator account is the treasury of every token it creates; admin and
  supply keys are set host-side, so created tokens stay mintable and updatable.
- Chain writes go through the standard mdcp planning pass: the first `execute`
  returns the full transaction plan for approval, `resume` runs it. Ids minted
  mid-program (tokenId, accountId) are stub values during planning — that is
  expected; the real ids exist after approval.

## What the gateway absorbs (the official skill's gotchas)

1. **Association before transfer** is still a real step (Hedera requires the
   recipient's opt-in) — but the recipient's signature happens host-side via
   the account's stored key. `hts.createAccount` recipients can always be
   associated; external accounts must associate themselves.
2. **Signed amounts netting to zero**: `hts.transfer` builds the debit and
   credit legs itself. You cannot express an unbalanced transfer.
3. **Keys**: never enter the sandbox. No key material, no `PrivateKey`, no
   multi-sig choreography — a program references accounts by id only.
4. **Supply key for mint**: always set at creation by the gateway, so
   `hts.mint` works on any token this operator created.
5. **Treasury auto-association**: as on Hedera — the treasury needs no
   associate call for its own token.

Not yet ported (use the official skill if needed): KYC/freeze/wipe/pause
compliance ops, burns, airdrops, custom fee schedules.

## What this replaces

The official skill's `Client`/`Wallet` setup, the five-step transaction
lifecycle, `freezeWith`/`.sign()` multi-party flows, and the
`references/api-reference.md` class catalog. Do not import
`@hiero-ledger/sdk` — the gateway owns it.
