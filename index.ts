import { bridgeTokenTool } from "./tools/bridge";
import { StellarLiquidityContractTool } from "./tools/contract";
import { StellarContractTool } from "./tools/stake";
import { stellarSendPaymentTool } from "./tools/stellar";
import { getTransactionHistory } from "./tools/getTransactionHistory";

import { 
  AgentClient, 
  AgentConfig,
  LaunchTokenParams,
  LaunchTokenResult 
} from "./agent";

export * from "./tools/getTransactionHistory";

export { 
  AgentClient,
  AgentConfig,
  LaunchTokenParams,
  LaunchTokenResult
};

export const stellarTools = [
  bridgeTokenTool,
  StellarLiquidityContractTool,
  StellarContractTool,
  stellarSendPaymentTool,
  getTransactionHistory   // ✅ IMPORTANT
];