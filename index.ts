import { bridgeTokenTool } from "./tools/bridge";
import { StellarLiquidityContractTool } from "./tools/contract";
import { StellarContractTool } from "./tools/stake";
import { stellarSendPaymentTool } from "./tools/stellar";
import { StellarClaimBalanceTool } from "./tools/claim_balance_tool";
import { AgentClient } from "./agent";

export { AgentClient };
export * from "./tools/claim_balance_tool";

export const stellarTools = [
  bridgeTokenTool,
  StellarLiquidityContractTool,
  StellarContractTool,
  stellarSendPaymentTool,
  StellarClaimBalanceTool
];