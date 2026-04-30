import { bridgeTokenTool } from "./tools/bridge";
import { StellarLiquidityContractTool } from "./tools/contract";
import { StellarDexTool } from "./tools/dex";
import { StellarContractTool } from "./tools/stake";
import { stellarSendPaymentTool, stellarGetBalanceTool, stellarGetAccountInfoTool } from "./tools/stellar";
import { StellarClaimableBalanceTool } from "./tools/claimableBalance";
export { StellarClaimableBalanceTool } from "./tools/claimableBalance";
export {
  MAX_CLAIMANTS_PER_BALANCE,
  MAX_OPERATIONS_PER_TRANSACTION,
  MAX_PREDICATE_DEPTH,
  DEFAULT_TRANSACTION_TIMEOUT_SECONDS,
  buildPredicate,
  extractBalanceIdsFromTransactionResult,
} from "./lib/claimableBalance";
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
  CreateClaimableBalanceParams,
  CreateClaimableBalanceResult,
  ClaimClaimableBalanceParams,
  ClaimClaimableBalanceResult,
  ListClaimableBalancesParams,
  ClaimableBalanceRecord,
  ClaimableBalanceOptions,
  ClaimPredicate,
  ClaimantInput,
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
  CreateClaimableBalanceParams,
  CreateClaimableBalanceResult,
  ClaimClaimableBalanceParams,
  ClaimClaimableBalanceResult,
  ListClaimableBalancesParams,
  ClaimableBalanceRecord,
  ClaimableBalanceOptions,
  ClaimPredicate,
  ClaimantInput,
};
export const stellarTools = [
  bridgeTokenTool,
  StellarDexTool,
  StellarLiquidityContractTool,
  StellarContractTool,
  stellarSendPaymentTool,
  stellarGetBalanceTool,
  stellarGetAccountInfoTool,
  StellarClaimableBalanceTool,
];
