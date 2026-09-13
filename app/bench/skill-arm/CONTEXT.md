# Environment for the skill arm

- Chain: Ethereum mainnet state, forked locally. RPC: http://127.0.0.1:8545
- Chain id 1. The deployed mainnet Uniswap contracts are live at their real addresses.
- Wallet: anvil account #0
  address    0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  privateKey 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  (a public, well-known test key — it never holds real funds)
- Funded with 40,000 USDC and 1000 ETH.
- `viem` is installed in this project (../../node_modules). Run scripts with
  `npx tsx <file>` from the `app/` directory.
- Tokens: USDC 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (6 decimals)
          WETH 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 (18 decimals)

## One deviation from the skills as written

The Uniswap Trading API requires an API key issued through an interactive login,
which is not available here. Use the on-chain path the skills also document:
QuoterV2 at 0x61fFE014bA17989E743c5F6cB21bF9697530B21e and SwapRouter02 at
0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45. Everything else — the flow, the
guardrails, the state model — follows the skills.
