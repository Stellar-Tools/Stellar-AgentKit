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

// Export core agent types
export { 
  AgentClient,
  AgentConfig,
  LaunchTokenParams,
  LaunchTokenResult
};

// Export enhanced AgentClient (with built-in validation & retry)
export { AgentClient as AgentClientEnhanced } from "./src/agent-enhanced";

// Export error classes and handlers
export {
  AgentKitError,
  ValidationError,
  InvalidAddressError,
  InvalidAmountError,
  InvalidNetworkError,
  MissingParameterError,
  TransactionError,
  SimulationError,
  SubmissionError,
  NetworkError,
  ContractError,
  OperationNotAllowedError,
  isAgentKitError,
  ensureAgentKitError,
} from "./src/errors";

export {
  handleError,
  handleErrorSync,
  tryAsync,
  trySync,
  recoverWith,
  chainOperations,
  isRetriable,
  retryWithBackoff,
  type Result,
  type ErrorHandlerOptions,
  type RetryOptions,
} from "./src/errors/handlers";

// Export validation functions
export {
  validateStellarAddress,
  validatePrivateKey,
  validateAmount,
  validateNetwork,
  validateRequired,
  validateSwapParams,
  validateDepositParams,
  validateWithdrawParams,
  validateBridgeParams,
  validateAddresses,
  type AmountValidationOptions,
  type SwapParams,
  type DepositParams,
  type WithdrawParams,
  type BridgeParams,
} from "./src/validation";

// Export fee estimation
export {
  estimateSorobanFee,
  estimateSwapFee,
  estimateDepositFee,
  estimateWithdrawalFee,
  calculateOperationCost,
  FeeEstimationCache,
  feeEstimationCache,
  type FeeEstimate,
  type GasEstimationOptions,
} from "./src/fees/estimation";

// Export batch operations
export {
  BatchTransactionBuilder,
  executeBatchTransaction,
  simulateBatchTransaction,
  createBatchBuilder,
  type BatchOperation,
  type BatchTransactionOptions,
  type BatchExecutionResult,
} from "./src/operations/batch";

// Export optimization tools
export {
  TTLCache,
  memoizeAsync,
  SorobanCaches,
  sorobanCaches,
  PriceCalculator,
  priceCalculator,
  OperationProfiler,
  operationProfiler,
} from "./src/optimization";
export const stellarTools = [
  bridgeTokenTool,
  StellarLiquidityContractTool,
  StellarContractTool,
  stellarSendPaymentTool
];