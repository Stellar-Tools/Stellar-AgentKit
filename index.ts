import { bridgeTokenTool } from "./tools/bridge";
import { StellarLiquidityContractTool } from "./tools/contract";
import { StellarContractTool } from "./tools/stake";
import { stellarSendPaymentTool } from "./tools/stellar";
import { stellarGetBalanceTool } from "./tools/getBalance";
import { stellarLaunchTokenTool } from "./tools/tokenIssuance";
import { AgentClient } from "./agent";

export { AgentClient };
export const stellarTools = [
  bridgeTokenTool,
  StellarLiquidityContractTool,
  StellarContractTool,
  stellarSendPaymentTool,
  stellarGetBalanceTool,
  stellarLaunchTokenTool
];