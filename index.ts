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
  SendPaymentParams,
  SendPaymentResult,
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
  SendPaymentParams,
  SendPaymentResult,
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
  stellarSendPaymentTool
];
