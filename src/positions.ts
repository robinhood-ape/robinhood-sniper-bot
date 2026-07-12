import { formatEther, type Address, type Hex } from "viem";
import { config } from "./config.js";
import type { Clients } from "./chain.js";
import { logger } from "./logger.js";
import { pnlPercent, quoteTokenValueInWeth } from "./price.js";
import { sellToken } from "./seller.js";

export type Position = {
  token: Address;
  pool: Address;
  name: string;
  symbol: string;
  poolFee: number;
  entryWeth: bigint;
  tokenAmount: bigint;
  buyTxHash: Hex | "dry-run";
  openedAt: number;
};

export class PositionTracker {
  private readonly positions = new Map<string, Position>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(private readonly clients: Clients) {}

  get size(): number {
    return this.positions.size;
  }

  has(token: Address): boolean {
    return this.positions.has(token.toLowerCase());
  }

  add(position: Position): void {
    this.positions.set(position.token.toLowerCase(), position);
    logger.info(
      `Position opened ${position.symbol} (${position.token}) entry=${formatEther(position.entryWeth)} ETH`,
    );
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, config.pollMs);
    logger.info(`Position monitor started (poll=${config.pollMs}ms, TP=${config.takeProfitPercent}%, SL=${config.stopLossPercent || "off"})`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const open = [...this.positions.values()];
      for (const pos of open) {
        await this.checkPosition(pos);
      }
    } catch (err) {
      logger.error("Position tick failed", err);
    } finally {
      this.ticking = false;
    }
  }

  private async checkPosition(pos: Position): Promise<void> {
    const current = await quoteTokenValueInWeth(
      this.clients,
      pos.token,
      pos.poolFee,
      pos.tokenAmount,
    );
    if (current === null) return;

    const pnl = pnlPercent(pos.entryWeth, current);
    logger.debug(
      `${pos.symbol} pnl=${pnl.toFixed(2)}% value=${formatEther(current)} ETH`,
    );

    const hitTp = pnl >= config.takeProfitPercent;
    const hitSl =
      config.stopLossPercent > 0 && pnl <= -config.stopLossPercent;

    if (!hitTp && !hitSl) return;

    const reason = hitTp ? `take-profit ${pnl.toFixed(2)}%` : `stop-loss ${pnl.toFixed(2)}%`;
    logger.info(`Exit ${pos.symbol}: ${reason}`);

    try {
      const result = await sellToken(this.clients, pos.token, pos.poolFee, pos.tokenAmount);
      logger.info(
        `Sold ${pos.symbol} tx=${result.txHash} out≈${formatEther(result.amountOut)} WETH`,
      );
      this.positions.delete(pos.token.toLowerCase());
    } catch (err) {
      logger.error(`Sell failed for ${pos.symbol}`, err);
    }
  }
}
