# Environment

- Chain: Ethereum mainnet state on a local fork. RPC http://127.0.0.1:8545, chainId 1.
  Mainnet-built transactions execute on it unmodified.
- Wallet: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,
  key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  (well-known public anvil test key, never real funds).
  Funded with 5,000 USDC and plenty of ETH.
- Execution path: use the ON-CHAIN path the skills also document — QuoterV2
  0x61fFE014bA17989E743c5F6cB21bF9697530B21e and SwapRouter02
  0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45, with a direct ERC-20 approval to
  the router.

  Why not the Trading API here: its /quote signs a Permit2 permit whose nonce is
  read from live mainnet. On any environment that diverges from mainnet the
  nonce advances locally while the API keeps issuing the mainnet value, so the
  SECOND permit-consuming swap always reverts with Permit2 InvalidNonce. A
  multi-leg basket is therefore not executable against the API outside mainnet.
  (Measured: fork nonce 1, live nonce 0, API-issued nonce 0.) The on-chain path
  has no such constraint.
- Tokens (mainnet): USDC 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (6 dec),
  WETH 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 (18),
  WBTC 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 (8),
  LINK 0x514910771AF9Ca656af840dff83E8264EcF986CA (18).
- viem is installed; run scripts with npx tsx from app/. Scripts go in bench/skill-arm-idx/.
  STATE_DIR: bench/skill-arm-idx/.state
