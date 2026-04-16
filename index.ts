import { bridgeTokenTool } from "./tools/bridge";
import { StellarLiquidityContractTool } from "./tools/contract";
import { StellarDexTool } from "./tools/dex";
import { StellarContractTool } from "./tools/stake";
import { stellarSendPaymentTool } from "./tools/stellar";
import { createGetAccountBalanceTool } from "./tools/getAccountBalance";
import { createPathPaymentStrictSendTool } from "./tools/pathPaymentStrictSend";
import { createInvokeContractTool } from "./tools/invokeContract";

// export * from "./tools/swap";
export * from "./tools/bridge";
// export * from "./tools/liquidityPool";

export { createGetAccountBalanceTool } from "./tools/getAccountBalance";
export type { AccountBalance, AccountBalanceResult } from "./tools/getAccountBalance";

export { createPathPaymentStrictSendTool } from "./tools/pathPaymentStrictSend";

export { createInvokeContractTool } from "./tools/invokeContract";

export {
  estimateFee,
  withRetry,
  classifyStellarError,
  buildHorizonServer,
  buildSorobanServer,
  getNetworkPassphrase,
} from "./utils/transactionUtils";

export type {
  FeeEstimate,
  RetryOptions,
  StellarErrorInfo,
  StellarNetwork,
} from "./utils/transactionUtils";

import {
  AgentClient,
  AgentConfig,
  LaunchTokenParams,
  LaunchTokenResult,
} from "./agent";

import type {
  StellarAssetInput,
  QuoteSwapParams,
  RouteQuote,
  SwapBestRouteParams,
  SwapBestRouteResult,
} from "./agent";

export {
  AgentClient,
  AgentConfig,
  LaunchTokenParams,
  LaunchTokenResult,
};

export type {
  StellarAssetInput,
  QuoteSwapParams,
  RouteQuote,
  SwapBestRouteParams,
  SwapBestRouteResult,
};

export const stellarTools = [
  bridgeTokenTool,
  StellarDexTool,
  StellarLiquidityContractTool,
  StellarContractTool,
  stellarSendPaymentTool,
];

export function getAllStellarTools() {
  return [
    createGetAccountBalanceTool(),
    createPathPaymentStrictSendTool(),
    createInvokeContractTool(),
  ];
}