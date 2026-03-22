/**
 * Gas Estimation Engine for Stellar AgentKit
 * 
 * Estimates Soroban operation fees before execution.
 * Critical for DeFi UX - users need to know costs upfront.
 */

import { rpc, BASE_FEE } from "@stellar/stellar-sdk";
import Big from "big.js";
import { NetworkError, ContractError } from "../errors";

function toBigOrZero(value: unknown): Big {
  if (value === undefined || value === null) {
    return new Big(0);
  }

  try {
    return new Big(String(value));
  } catch {
    return new Big(0);
  }
}

export interface FeeEstimate {
  baseFee: string;           // Base fee in stroops
  networkFee: string;        // Estimated network fee
  simulationFee: string;     // Soroban simulation fee
  totalFee: string;          // Total estimated fee
  resourceFees: {
    cpu: string;            // CPU cost
    memory: string;         // Memory cost
    bandwidth: string;      // Bandwidth cost
  };
}

export interface GasEstimationOptions {
  rpcUrl?: string;
  includeResourceBreakdown?: boolean;
  feeMultiplier?: number;    // Safety multiplier (1.2 = 20% buffer)
}

/**
 * Estimates Soroban operation fees
 * 
 * Uses simulation to determine actual resource costs.
 * Adds safety multiplier for realistic estimates.
 */
export async function estimateSorobanFee(
  transaction: any,
  options: GasEstimationOptions = {}
): Promise<FeeEstimate> {
  const {
    rpcUrl = "https://soroban-testnet.stellar.org",
    includeResourceBreakdown = true,
    feeMultiplier = 1.5, // 50% buffer by default
  } = options;

  if (!Number.isFinite(feeMultiplier) || feeMultiplier <= 0) {
    throw new ContractError(
      `Invalid feeMultiplier: ${feeMultiplier}`,
      { feeMultiplier },
      "feeMultiplier must be a finite positive number"
    );
  }

  try {
    const server = new rpc.Server(rpcUrl, { allowHttp: true });

    // Simulate the transaction to get resource usage
    const simulation = await server.simulateTransaction(transaction);

    if ("error" in simulation) {
      throw new ContractError(
        `Simulation failed during fee estimation: ${simulation.error}`,
        { rpcUrl, transactionType: "soroban" }
      );
    }

    // Parse simulation response for fee data
    if (
      !("results" in simulation) ||
      !(simulation as any).results ||
      !(simulation as any).results[0]
    ) {
      throw new ContractError(
        "Invalid simulation response: missing results",
        { simulation: JSON.stringify(simulation) }
      );
    }

    const result = (simulation as any).results[0];

    // Soroban RPC v13+ exposes fees at top-level fields (e.g. minResourceFee).
    const minResourceFee = toBigOrZero((simulation as any).minResourceFee);
    const transactionDataResourceFee = toBigOrZero((simulation as any).transactionData?.resourceFee);
    const resourceFeeAmount = minResourceFee.gt(0) ? minResourceFee : transactionDataResourceFee;

    // Keep a lightweight resource breakdown for compatibility.
    const cpuCost = includeResourceBreakdown ? String((simulation as any).cpuInstructions || 0) : "0";
    const memCost = includeResourceBreakdown ? String((simulation as any).memoryBytes || 0) : "0";
    const bandwidthCost = includeResourceBreakdown ? String((simulation as any).readWriteBytes || 0) : "0";

    // Calculate fee components
    const baseFeeAmount = new Big(BASE_FEE);
    const networkFeeAmount = baseFeeAmount.plus(resourceFeeAmount);

    // Apply safety multiplier for conservative estimate
    const totalFeeAmount = networkFeeAmount
      .times(feeMultiplier)
      .round(0, 3); // Round up

    return {
      baseFee: baseFeeAmount.toString(),
      networkFee: networkFeeAmount.toString(),
      simulationFee: resourceFeeAmount.toString(),
      totalFee: totalFeeAmount.toString(),
      resourceFees: {
        cpu: cpuCost,
        memory: memCost,
        bandwidth: bandwidthCost,
      },
    };
  } catch (error) {
    if (error instanceof ContractError) {
      throw error;
    }

    throw new NetworkError(
      `Failed to estimate gas fees: ${error instanceof Error ? error.message : String(error)}`,
      { rpcUrl },
      "Check RPC URL and network connectivity",
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Estimates swap operation fee
 * 
 * @param swapAmount The amount being swapped
 * @returns Estimated network fee in stroops
 * 
 * Note: Slippage is handled separately from network fees.
 * Network fee is a fixed Soroban cost in stroops.
 * Slippage tolerance should be applied to expected output separately.
 */
export function estimateSwapFee(swapAmount: string): FeeEstimate {
  const amount = new Big(swapAmount);

  // Typical swap costs on Soroban (in stroops)
  // Network fee is fixed Soroban operation cost
  const networkFee = new Big(BASE_FEE).times(2.5); // ~2.5x base for swap

  // Slippage is a percentage of the TOKEN amount, not stroops
  // Example: 1% slippage on 1000 USDC = 10 USDC loss
  // This is separate from the network fee
  const protocolSlippage = amount.times(0.003); // 0.3% protocol fee

  return {
    baseFee: BASE_FEE.toString(),
    networkFee: networkFee.toString(),
    simulationFee: "0",  // Simulation fee in stroops (actual value depends on pool state)
    totalFee: networkFee.toString(), // Network fee in stroops
    resourceFees: {
      cpu: "5000000", // Approximate CPU cost
      memory: "100000",
      bandwidth: "10000",
    },
  };
}

/**
 * Estimates LP deposit fee
 */
export function estimateDepositFee(
  desiredAmountA: string,
  desiredAmountB: string
): FeeEstimate {
  // Parse amounts to fail fast on invalid numeric inputs.
  new Big(desiredAmountA);
  new Big(desiredAmountB);

  // LP operations typically consume more network resources than swaps.
  const networkFee = new Big(BASE_FEE).times(3); // Higher cost for LP

  return {
    baseFee: BASE_FEE.toString(),
    networkFee: networkFee.toString(),
    simulationFee: "0",
    totalFee: networkFee.toString(),
    resourceFees: {
      cpu: "8000000",
      memory: "200000",
      bandwidth: "20000",
    },
  };
}

/**
 * Estimates LP withdrawal fee
 */
export function estimateWithdrawalFee(shareAmount: string): FeeEstimate {
  // Parse amount to fail fast on invalid numeric input.
  new Big(shareAmount);

  const networkFee = new Big(BASE_FEE).times(2.8); // ~2.8x for withdrawal

  return {
    baseFee: BASE_FEE.toString(),
    networkFee: networkFee.toString(),
    simulationFee: "0",
    totalFee: networkFee.toString(),
    resourceFees: {
      cpu: "7000000",
      memory: "150000",
      bandwidth: "15000",
    },
  };
}

/**
 * Calculates effective slippage and total cost
 */
export function calculateOperationCost(
  inputAmount: string,
  estimatedOutput: string,
  fee: FeeEstimate
): {
  inputAmount: string;
  outputAmount: string;
  feeAmount: string;
  totalCost: string;
  slippagePercent: string;
} {
  const input = new Big(inputAmount);
  const estimated = new Big(estimatedOutput);
  const totalFee = new Big(fee.totalFee);

  const slippage = input.minus(estimated);
  const slippagePercent = input.eq(0) ? new Big(0) : slippage.div(input).times(100);

  return {
    inputAmount: input.toString(),
    outputAmount: estimated.toString(),
    feeAmount: totalFee.toString(),
    totalCost: input.plus(totalFee).toString(),
    slippagePercent: slippagePercent.toFixed(2),
  };
}

/**
 * Fee estimation cache for quick lookups
 */
export class FeeEstimationCache {
  private cache: Map<string, { estimate: FeeEstimate; timestamp: number }> = new Map();
  private readonly ttlMs = 5 * 60 * 1000; // 5 minute TTL

  /**
   * Get cached estimate or compute new one
   */
  async getOrEstimate(
    key: string,
    estimator: () => Promise<FeeEstimate>
  ): Promise<FeeEstimate> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.ttlMs) {
      return cached.estimate;
    }

    const estimate = await estimator();
    this.cache.set(key, { estimate, timestamp: now });

    return estimate;
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear old entries
   */
  prune(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
}

export const feeEstimationCache = new FeeEstimationCache();
