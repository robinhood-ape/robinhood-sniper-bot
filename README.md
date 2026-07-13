# NOXA Fun Sniper Bot

TypeScript / Node.js sniper for [NOXA Fun](https://fun.noxa.eth.limo/) launches on **Robinhood Chain** (chain ID `4663`).

UI: [https://fun.noxa.eth.limo/](https://fun.noxa.eth.limo/) (ENS mirror — `fun.noxa.fi` is offline). The live site is **NOXA Lite**: browse historical launches, claim creator fees; new token creation may remain disabled.

Watches the NOXA Launch Factory for `TokenLaunched`, buys via Uniswap V3 `SwapRouter02`, then auto-sells when take-profit is hit (optional stop-loss).

## Setup

```bash
npm install
cp .env.example .env
# edit .env — set PRIVATE_KEY, optionally WSS_RPC_URL
```

## Run

```bash
npm run dev
```

Keep `DRY_RUN=true` until you are ready to trade with real ETH.

## How it works

1. Subscribe to `TokenLaunched` on the NOXA factory
2. Apply filters (min initial buy, deny name substrings, WETH pair only, max positions)
3. Buy with `BUY_AMOUNT_ETH` via Uniswap V3 exact-input swap
4. Poll pool price; sell 100% when PnL ≥ `TAKE_PROFIT_PERCENT`
5. If `STOP_LOSS_PERCENT` > 0, also sell when PnL ≤ −SL

## Notes

- Frontend moved to [fun.noxa.eth.limo](https://fun.noxa.eth.limo/); the bot does not depend on the website — it listens on-chain.
- If new launches stay disabled on NOXA Lite, you will see no `TokenLaunched` events until they resume.
- Memecoins are high risk. You can lose your entire buy amount.
- Prefer a dedicated WSS RPC (Alchemy / QuickNode) over the public HTTP endpoint.
- Never commit `.env` or share your private key.

## Bundler

See [`bundler/`](./bundler) for a multi-wallet NOXA launch bundler (`npm run bundle` inside that folder).

## Contracts (Robinhood mainnet)

| Contract | Address |
|----------|---------|
| NOXA Launch Factory | `0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB` |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| SwapRouter02 | `0xCaf681a66D020601342297493863E78C959E5cb2` |
| QuoterV2 | `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` |
