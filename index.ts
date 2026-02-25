import { bridgeTokenTool } from "./tools/bridge";
import { StellarLiquidityContractTool } from "./tools/contract";
import { StellarContractTool } from "./tools/stake";
import { stellarSendPaymentTool } from "./tools/stellar";
import { AgentClient } from "./agent";
import { AgentKitError, AgentKitErrorCode } from "./lib/errors";

export { AgentClient, AgentKitError, AgentKitErrorCode };
export const stellarTools = [
  bridgeTokenTool,
  StellarLiquidityContractTool,
  StellarContractTool,
  stellarSendPaymentTool
];