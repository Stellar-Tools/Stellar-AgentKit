import { bridgeTokenTool } from "./tools/bridge";
import { StellarLiquidityContractTool } from "./tools/contract";
import { StellarContractTool } from "./tools/stake";
import { stellarSendPaymentTool } from "./tools/stellar";
import getAccountInfoTool from "./tools/getAccountInfo";
import simulateTransactionTool from "./tools/simulateTransaction";
import getOrderBookTool from "./tools/getOrderBook";
import findPaymentPathsTool from "./tools/findPaymentPaths";
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
export const stellarTools = [
  bridgeTokenTool,
  StellarLiquidityContractTool,
  StellarContractTool,
  stellarSendPaymentTool,
  getAccountInfoTool,
  simulateTransactionTool,
  getOrderBookTool,
  findPaymentPathsTool
];