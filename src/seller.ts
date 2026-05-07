import { formatEther, type Address, type Hex } from "viem";
import { config } from "./config.js";
import { ADDRESSES, erc20Abi, swapRouter02Abi, type Clients } from "./chain.js";
import { ensureAllowance, quoteExactInputSingle } from "./buyer.js";
import { logger } from "./logger.js";

function applySlippageMinOut(quotedOut: bigint, slippageBps: number): bigint {
  return (quotedOut * BigInt(10_000 - slippageBps)) / 10_000n;
}

export type SellResult = {
  txHash: Hex | "dry-run";
  amountIn: bigint;
  amountOut: bigint;
};

export async function sellToken(
  clients: Clients,
  token: Address,
  poolFee: number,
  amountIn?: bigint,
): Promise<SellResult> {
  const balance =
    amountIn ??
    (await clients.publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [clients.account.address],
    }));

  if (balance <= 0n) {
    throw new Error(`No balance to sell for ${token}`);
  }

  await ensureAllowance(clients, token, ADDRESSES.swapRouter02, balance);

  let quotedOut = 0n;
  try {
    quotedOut = await quoteExactInputSingle(clients, token, ADDRESSES.weth, poolFee, balance);
  } catch (err) {
    logger.warn("Sell quote failed; using amountOutMinimum=0", err);
  }

  const amountOutMinimum =
    quotedOut > 0n ? applySlippageMinOut(quotedOut, config.slippageBps) : 0n;

  logger.info(
    `Selling ${balance} of ${token} -> WETH (fee=${poolFee}, minOut=${formatEther(amountOutMinimum)})`,
  );

  if (config.dryRun) {
    logger.info("[DRY_RUN] skip sell swap");
    return { txHash: "dry-run", amountIn: balance, amountOut: quotedOut };
  }

  const hash = await clients.walletClient.writeContract({
    address: ADDRESSES.swapRouter02,
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: token,
        tokenOut: ADDRESSES.weth,
        fee: poolFee,
        recipient: clients.account.address,
        amountIn: balance,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
    account: clients.account,
    chain: clients.walletClient.chain,
  });

  await clients.publicClient.waitForTransactionReceipt({ hash });
  logger.info(`Sell confirmed ${hash}`);
  return { txHash: hash, amountIn: balance, amountOut: quotedOut };
}
