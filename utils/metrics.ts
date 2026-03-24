/**
 * Transaction Analytics and Performance Metrics
 * Addresses issue #38
 *
 * Tracks swap, bridge, and LP operations in-memory and exposes
 * a metrics API via AgentClient.metrics.*
 */

export type OperationType = "swap" | "bridge" | "lp_deposit" | "lp_withdraw";

export interface TransactionRecord {
  id: string;
  type: OperationType;
  timestamp: number;
  success: boolean;
  durationMs: number;
  inputAmount?: string;
  outputAmount?: string;
  slippagePct?: number;
  errorMessage?: string;
}

export interface MetricsSummary {
  totalTransactions: number;
  successCount: number;
  failureCount: number;
  successRate: string;
  totalVolume: string;
  avgDurationMs: number;
  avgSlippage: string;
  byType: Record<OperationType, { count: number; successCount: number }>;
}

export class TransactionMetrics {
  private records: TransactionRecord[] = [];
  private idCounter = 0;

  /**
   * Start timing a new transaction. Returns a finisher function.
   * Call finisher({ success, inputAmount, outputAmount, slippagePct, errorMessage })
   * when the operation completes.
   */
  track(type: OperationType): (result: Omit<TransactionRecord, "id" | "type" | "timestamp" | "durationMs">) => TransactionRecord {
    const id = `${type}-${++this.idCounter}-${Date.now()}`;
    const startTime = Date.now();

    return (result) => {
      const record: TransactionRecord = {
        id,
        type,
        timestamp: startTime,
        durationMs: Date.now() - startTime,
        ...result,
      };
      this.records.push(record);
      return record;
    };
  }

  /**
   * Returns aggregated performance metrics across all tracked operations.
   *
   * @example
   * const summary = agent.metrics.summary();
   * // {
   * //   totalTransactions: 10,
   * //   successRate: "90.00%",
   * //   totalVolume: "10000.0000000",
   * //   avgSlippage: "1.20%",
   * //   ...
   * // }
   */
  summary(): MetricsSummary {
    const successful = this.records.filter((r) => r.success);
    const failed = this.records.filter((r) => !r.success);

    const totalVolume = this.records
      .filter((r) => r.inputAmount)
      .reduce((acc, r) => acc + parseFloat(r.inputAmount!), 0);

    const slippageRecords = this.records.filter(
      (r) => r.slippagePct !== undefined && r.success
    );
    const avgSlippage =
      slippageRecords.length > 0
        ? slippageRecords.reduce((acc, r) => acc + r.slippagePct!, 0) /
          slippageRecords.length
        : 0;

    const avgDurationMs =
      this.records.length > 0
        ? this.records.reduce((acc, r) => acc + r.durationMs, 0) /
          this.records.length
        : 0;

    const byType = {} as Record<OperationType, { count: number; successCount: number }>;
    for (const type of ["swap", "bridge", "lp_deposit", "lp_withdraw"] as OperationType[]) {
      const typeRecords = this.records.filter((r) => r.type === type);
      byType[type] = {
        count: typeRecords.length,
        successCount: typeRecords.filter((r) => r.success).length,
      };
    }

    return {
      totalTransactions: this.records.length,
      successCount: successful.length,
      failureCount: failed.length,
      successRate:
        this.records.length > 0
          ? `${((successful.length / this.records.length) * 100).toFixed(2)}%`
          : "0.00%",
      totalVolume: totalVolume.toFixed(7),
      avgDurationMs: Math.round(avgDurationMs),
      avgSlippage: `${avgSlippage.toFixed(2)}%`,
      byType,
    };
  }

  /**
   * Returns the raw list of transaction records.
   * Useful for debugging or building custom dashboards.
   */
  history(): TransactionRecord[] {
    return [...this.records];
  }

  /**
   * Returns records filtered by operation type.
   */
  byType(type: OperationType): TransactionRecord[] {
    return this.records.filter((r) => r.type === type);
  }

  /**
   * Returns the last N transactions.
   */
  recent(n = 10): TransactionRecord[] {
    return this.records.slice(-n);
  }

  /**
   * Clears all tracked records.
   */
  clear(): void {
    this.records = [];
    this.idCounter = 0;
  }
}
