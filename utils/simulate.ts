/**
 * Pre-execution simulation for swap, bridge, and LP operations.
 * Addresses issue #35 — lets users dry-run before committing real funds.
 *
 * Usage:
 *   const result = await agent.simulate.swap({ to, buyA, out, inMax });
 *   if (result.success) {
 *     console.log('Estimated fee:', result.estimatedFeeXlm);
 *     await agent.swap({ to, buyA, out, inMax }); // execute for real
 *   }
 */

export interface SimulationResult {
  /** Whether the simulation succeeded */
  success: boolean;
  /** Estimated network fee in stroops */
  estimatedFee?: string;
  /** Human-readable fee in XLM */
  estimatedFeeXlm?: string;
  /** Estimated resource usage */
  resourceUsage?: {
    cpuInstructions?: number;
    memBytes?: number;
    ledgerReads?: number;
    ledgerWrites?: number;
  };
  /** Warning messages (e.g. high slippage) */
  warnings: string[];
  /** Error message if simulation failed */
  error?: string;
  /** Raw simulation response for advanced inspection */
  raw?: unknown;
}

export interface SimulateSwapParams {
  to: string;
  buyA: boolean;
  out: string;
  inMax: string;
}

export interface SimulateBridgeParams {
  amount: string;
  toAddress: string;
}

export interface SimulateLpDepositParams {
  to: string;
  desiredA: string;
  minA: string;
  desiredB: string;
  minB: string;
}

export interface SimulateLpWithdrawParams {
  to: string;
  shareAmount: string;
  minA: string;
  minB: string;
}

const STROOP = 10_000_000;

function stroopsToXlm(stroops: string | number): string {
  const n = typeof stroops === "string" ? parseInt(stroops, 10) : stroops;
  return (n / STROOP).toFixed(7);
}

function parseResourceUsage(sim: any): SimulationResult["resourceUsage"] {
  const cost = sim?.cost ?? sim?.transaction_data?.resources;
  if (!cost) return undefined;
  return {
    cpuInstructions: cost.instructions ?? cost.cpu_insns,
    memBytes: cost.readBytes ?? cost.mem_bytes,
    ledgerReads: cost.readLedgerEntries ?? cost.ledger_read_entries,
    ledgerWrites: cost.writeLedgerEntries ?? cost.ledger_write_entries,
  };
}

async function runSimulation(
  server: { simulateTransaction: (tx: unknown) => Promise<any> },
  transaction: unknown,
  warnings: string[] = []
): Promise<SimulationResult> {
  try {
    const sim = await server.simulateTransaction(transaction);

    if (sim && "error" in sim && sim.error) {
      return { success: false, warnings, error: String(sim.error), raw: sim };
    }

    const fee = sim?.minResourceFee ?? sim?.min_resource_fee ?? "0";
    return {
      success: true,
      estimatedFee: String(fee),
      estimatedFeeXlm: stroopsToXlm(fee),
      resourceUsage: parseResourceUsage(sim),
      warnings,
      raw: sim,
    };
  } catch (err) {
    return {
      success: false,
      warnings,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface SimulatorDeps {
  server: { simulateTransaction: (tx: unknown) => Promise<any> };
  network: "testnet" | "mainnet";
  buildSwapTx: (params: SimulateSwapParams) => Promise<unknown>;
  buildLpDepositTx: (params: SimulateLpDepositParams) => Promise<unknown>;
  buildLpWithdrawTx: (params: SimulateLpWithdrawParams) => Promise<unknown>;
}

/**
 * Creates the simulation API surface for AgentClient.
 * All methods mirror their real counterparts but call simulateTransaction
 * instead of sendTransaction — no funds are moved.
 */
export function createSimulator(deps: SimulatorDeps) {
  const { server, network } = deps;

  return {
    /**
     * Simulate a swap without executing it.
     *
     * @example
     * const sim = await agent.simulate.swap({ to: poolId, buyA: true, out: "100", inMax: "103" });
     * if (sim.success) await agent.swap(...);
     */
    async swap(params: SimulateSwapParams): Promise<SimulationResult> {
      const warnings: string[] = [];

      const out = parseFloat(params.out);
      const inMax = parseFloat(params.inMax);
      if (out > 0 && inMax > 0) {
        const slippage = ((inMax - out) / out) * 100;
        if (slippage > 5) {
          warnings.push(
            `High slippage tolerance: ${slippage.toFixed(1)}% (inMax is ${slippage.toFixed(1)}% more than out)`
          );
        }
      }

      try {
        const tx = await deps.buildSwapTx(params);
        return runSimulation(server, tx, warnings);
      } catch (err) {
        return { success: false, warnings, error: err instanceof Error ? err.message : String(err) };
      }
    },

    /**
     * Simulate a bridge operation without executing it.
     * Validates parameters only — cross-chain dry-run is not available via Stellar RPC.
     *
     * @example
     * const sim = await agent.simulate.bridge({ amount: "100", toAddress: "0x..." });
     */
    async bridge(params: SimulateBridgeParams): Promise<SimulationResult> {
      const warnings: string[] = [];

      if (network === "mainnet") {
        warnings.push("Bridge operations on mainnet use real funds. Verify toAddress carefully.");
      }

      const amount = parseFloat(params.amount);
      if (isNaN(amount) || amount <= 0) {
        return { success: false, warnings, error: "amount must be a positive number" };
      }

      if (!params.toAddress || params.toAddress.trim().length === 0) {
        return { success: false, warnings, error: "toAddress is required" };
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(params.toAddress)) {
        return { success: false, warnings, error: "toAddress must be a valid EVM address (0x...)" };
      }

      if (amount > 10000) {
        warnings.push(`Large bridge amount: ${amount} tokens. Double-check before executing.`);
      }

      return {
        success: true,
        warnings,
        estimatedFee: "N/A",
        estimatedFeeXlm: "N/A (cross-chain)",
        raw: { note: "Cross-chain bridge simulation validates parameters only." },
      };
    },

    /**
     * LP operation simulation namespace.
     */
    lp: {
      /**
       * Simulate an LP deposit without executing it.
       *
       * @example
       * const sim = await agent.simulate.lp.deposit({ to, desiredA: "100", minA: "95", desiredB: "200", minB: "190" });
       */
      async deposit(params: SimulateLpDepositParams): Promise<SimulationResult> {
        const warnings: string[] = [];

        const desiredA = parseFloat(params.desiredA);
        const minA = parseFloat(params.minA);
        if (desiredA > 0 && minA > 0) {
          const slippage = ((desiredA - minA) / desiredA) * 100;
          if (slippage > 5) {
            warnings.push(`High slippage tolerance on asset A: ${slippage.toFixed(1)}%`);
          }
        }

        try {
          const tx = await deps.buildLpDepositTx(params);
          return runSimulation(server, tx, warnings);
        } catch (err) {
          return { success: false, warnings, error: err instanceof Error ? err.message : String(err) };
        }
      },

      /**
       * Simulate an LP withdrawal without executing it.
       *
       * @example
       * const sim = await agent.simulate.lp.withdraw({ to, shareAmount: "50", minA: "45", minB: "90" });
       */
      async withdraw(params: SimulateLpWithdrawParams): Promise<SimulationResult> {
        const warnings: string[] = [];

        try {
          const tx = await deps.buildLpWithdrawTx(params);
          return runSimulation(server, tx, warnings);
        } catch (err) {
          return { success: false, warnings, error: err instanceof Error ? err.message : String(err) };
        }
      },
    },
  };
}

export type Simulator = ReturnType<typeof createSimulator>;
