import { bridgeTokenTool } from "./tools/bridge";
import { StellarLiquidityContractTool } from "./tools/contract";
import { StellarContractTool } from "./tools/stake";
import { stellarSendPaymentTool } from "./tools/stellar";
import { stellarGetBalanceTool } from "./tools/account";
import { stellarEnsureTrustlineTool } from "./tools/trustline";
import { AgentClient } from "./agent";
import { AgentKitError, AgentKitErrorCode } from "./lib/errors";
import { formatStellarError } from "./utils/error_formatter";

export { 
  AgentClient, 
  AgentKitError, 
  AgentKitErrorCode,
  formatStellarError
};

export const stellarTools = [
  bridgeTokenTool,
  StellarLiquidityContractTool,
  StellarContractTool,
  stellarSendPaymentTool,
  stellarGetBalanceTool,
  stellarEnsureTrustlineTool
];