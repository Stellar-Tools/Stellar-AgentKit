import { bridgeTokenTool } from "./tools/bridge";
import { StellarLiquidityContractTool } from "./tools/contract";
import { StellarDexTool } from "./tools/dex";
import { StellarContractTool } from "./tools/stake";
import { stellarSendPaymentTool } from "./tools/stellar";
import { StellarClaimBalanceTool } from "./tools/claim_balance_tool";

// Agent exportları (Hem sınıfları hem de tipleri içerecek şekilde)
export {
  AgentClient,
  AgentConfig,
  LaunchTokenParams,
  LaunchTokenResult,
} from "./agent";

export type {
  StellarAssetInput,
  QuoteSwapParams,
  RouteQuote,
  SwapBestRouteParams,
  SwapBestRouteResult,
} from "./agent";

// claim_balance_tool içindeki her şeyi export et
export * from "./tools/claim_balance_tool";

// Bütün tool'ların listesi
export const stellarTools = [
  bridgeTokenTool,
  StellarDexTool,
  StellarLiquidityContractTool,
  StellarContractTool,
  stellarSendPaymentTool,
  StellarClaimBalanceTool,
];
