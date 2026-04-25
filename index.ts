import { bridgeTokenTool } from "./tools/bridge";
import { StellarLiquidityContractTool } from "./tools/contract";
import { StellarDexTool } from "./tools/dex";
import { StellarContractTool } from "./tools/stake";
import { stellarSendPaymentTool } from "./tools/stellar";
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
  ClaimPredicate,
  ClaimantInput,
};
export const stellarTools = [
  bridgeTokenTool,
  StellarDexTool,
  StellarLiquidityContractTool,
  StellarContractTool,
  stellarSendPaymentTool
];
