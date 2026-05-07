import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.js";

export const ROBINHOOD_CHAIN_ID = 4663;

/** Official NOXA Fun UI (ENS limo mirror; fun.noxa.fi is offline). */
export const NOXA_UI_URL = "https://fun.noxa.eth.limo/" as const;

export const ADDRESSES = {
  launchFactory: "0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB" as Address,
  launchLocker: "0x7F03effbd7ceB22A3f80Dd468f67eF27826acD85" as Address,
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as Address,
  uniswapV3Factory: "0x1f7d7550B1b028f7571E69A784071F0205Fd2EfA" as Address,
  swapRouter02: "0xCaf681a66D020601342297493863E78C959E5cb2" as Address,
  quoterV2: "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7" as Address,
} as const;

export const robinhoodChain = {
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [config.rpcUrl], webSocket: config.wssRpcUrl ? [config.wssRpcUrl] : [] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
} as const satisfies Chain;

export const launchFactoryAbi = [
  {
    type: "event",
    name: "TokenLaunched",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "deployer", type: "address", indexed: true },
      { name: "dexFactory", type: "address", indexed: true },
      { name: "pairToken", type: "address", indexed: false },
      { name: "pool", type: "address", indexed: false },
      { name: "dexId", type: "uint256", indexed: false },
      { name: "launchConfigId", type: "uint256", indexed: false },
      { name: "positionId", type: "uint256", indexed: false },
      { name: "restrictionsEndBlock", type: "uint256", indexed: false },
      { name: "initialBuyAmount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "getLaunchedToken",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "deployer", type: "address" },
          { name: "pairedToken", type: "address" },
          { name: "positionManager", type: "address" },
          { name: "positionId", type: "uint256" },
          { name: "dexId", type: "uint256" },
          { name: "launchConfigId", type: "uint256" },
          { name: "restrictionsEndBlock", type: "uint256" },
          { name: "supply", type: "uint256" },
          { name: "isToken0", type: "bool" },
          { name: "poolFee", type: "uint24" },
          { name: "exists", type: "bool" },
          { name: "initialBuyAmount", type: "uint256" },
        ],
      },
    ],
  },
] as const;

export const erc20Abi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export const wethAbi = [
  ...erc20Abi,
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "wad", type: "uint256" }],
    outputs: [],
  },
] as const;

export const swapRouter02Abi = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

export const quoterV2Abi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

export const poolAbi = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "fee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint24" }],
  },
] as const;

export type Clients = {
  publicClient: PublicClient<Transport, typeof robinhoodChain>;
  walletClient: WalletClient<Transport, typeof robinhoodChain>;
  account: ReturnType<typeof privateKeyToAccount>;
};

export function createClients(): Clients {
  const account = privateKeyToAccount(config.privateKey as Hex);

  const publicClient = createPublicClient({
    chain: robinhoodChain,
    transport: config.wssRpcUrl ? webSocket(config.wssRpcUrl) : http(config.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: robinhoodChain,
    transport: http(config.rpcUrl),
  });

  return { publicClient, walletClient, account };
}
