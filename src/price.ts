import type { Address } from "viem";
import { ADDRESSES, quoterV2Abi, type Clients } from "./chain.js";
import { logger } from "./logger.js";

/** Quote WETH value of a token amount via QuoterV2. */
export async function quoteTokenValueInWeth(
  clients: Clients,
  token: Address,
  poolFee: number,
  tokenAmount: bigint,
): Promise<bigint | null> {
  if (tokenAmount <= 0n) return 0n;

  try {
    const result = await clients.publicClient.simulateContract({
      address: ADDRESSES.quoterV2,
      abi: quoterV2Abi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn: token,
          tokenOut: ADDRESSES.weth,
          amountIn: tokenAmount,
          fee: poolFee,
          sqrtPriceLimitX96: 0n,
        },
      ],
      account: clients.account.address,
    });
    return result.result[0];
  } catch (err) {
    logger.debug(`Quote token->WETH failed for ${token}`, err);
    return null;
  }
}

export function pnlPercent(entryWeth: bigint, currentWeth: bigint): number {
  if (entryWeth <= 0n) return 0;
  const delta = Number(currentWeth - entryWeth);
  const base = Number(entryWeth);
  return (delta / base) * 100;
}
