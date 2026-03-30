import { bridgeTokenTool } from "./tools/bridge";
import { StellarLiquidityContractTool } from "./tools/contract";
import { StellarContractTool } from "./tools/stake";
import { stellarSendPaymentTool } from "./tools/stellar";
import { 
  AgentClient, 
  AgentConfig,
  LaunchTokenParams,
  LaunchTokenResult 
} from "./agent";

export {
  AgentClient,
  AgentConfig,
  LaunchTokenParams,
  LaunchTokenResult
};

// Router exports
export { SwapRouter } from "./router/router";
export { PoolRegistry } from "./router/registry";
export { TokenGraph } from "./router/graph";
export { SoroswapAdapter } from "./router/adapters/soroswap";
export { PhoenixAdapter } from "./router/adapters/phoenix";
export { SdexAdapter } from "./router/adapters/sdex";
export { getNetworkConfig, MAINNET_CONFIG, TESTNET_CONFIG } from "./router/config";
export type {
  DexAdapter,
  Pool,
  Quote,
  Route,
  RouteLeg,
  SwapParams,
  SwapResult,
  NetworkConfig,
} from "./router/types";

export const stellarTools = [
  bridgeTokenTool,
  StellarLiquidityContractTool,
  StellarContractTool,
  stellarSendPaymentTool
];