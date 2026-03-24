import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as StellarSdk from "@stellar/stellar-sdk";

/**
 * Tool: simulateTransaction
 *
 * Performs a dry-run of a Stellar/Soroban transaction using the RPC
 * `simulateTransaction` endpoint. This lets an agent validate fee estimates,
 * detect auth requirements, and surface contract errors before committing to
 * the network — avoiding wasted sequence numbers and failed transactions.
 *
 * Accepts a base64-encoded XDR transaction envelope and returns:
 *  - Estimated fee (in stroops)
 *  - Minimum resource fee
 *  - Soroban resource usage (instructions, read/write bytes, ledger entries)
 *  - Auth entries required
 *  - Any simulation error with a human-readable message
 *
 * @param xdrEnvelope - Base64-encoded TransactionEnvelope XDR
 * @param network     - "testnet" | "mainnet"
 */
const simulateTransactionTool = new DynamicStructuredTool({
  name: "simulate_transaction",
  description:
    "Dry-run a Stellar or Soroban transaction without submitting it to the network. " +
    "Returns estimated fees, resource usage (CPU instructions, read/write bytes, " +
    "ledger entries), and any auth requirements or contract errors. " +
    "Always simulate before executing Soroban contract calls to catch errors early " +
    "and get accurate fee estimates. Accepts a base64-encoded XDR transaction envelope.",
  schema: z.object({
    xdrEnvelope: z
      .string()
      .describe(
        "Base64-encoded XDR TransactionEnvelope to simulate. " +
          "Build this using the Stellar SDK before calling this tool."
      ),
    network: z
      .enum(["testnet", "mainnet"])
      .default("testnet")
      .describe("The Stellar network to simulate against. Defaults to testnet."),
  }),
  func: async ({
    xdrEnvelope,
    network,
  }: {
    xdrEnvelope: string;
    network: "testnet" | "mainnet";
  }) => {
    const rpcUrl =
      network === "mainnet"
        ? "https://mainnet.stellar.validationcloud.io/v1/XDR"
        : "https://soroban-testnet.stellar.org";

    // Validate that the XDR is parseable before sending it over the wire
    let tx: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction;
    try {
      tx = StellarSdk.TransactionBuilder.fromXDR(
        xdrEnvelope,
        network === "mainnet"
          ? StellarSdk.Networks.PUBLIC
          : StellarSdk.Networks.TESTNET
      );
    } catch {
      return JSON.stringify({
        success: false,
        error:
          "Failed to parse XDR envelope. Ensure it is a valid base64-encoded " +
          "TransactionEnvelope for the specified network.",
      });
    }

    const rpcServer = new StellarSdk.SorobanRpc.Server(rpcUrl, {
      allowHttp: false,
    });

    try {
      const simResult = await rpcServer.simulateTransaction(
        tx as StellarSdk.Transaction
      );

      // Surface simulation errors with a clean message
      if (StellarSdk.SorobanRpc.Api.isSimulationError(simResult)) {
        return JSON.stringify({
          success: false,
          simulationFailed: true,
          error: simResult.error,
          // Attempt to extract a readable diagnostics message if present
          events: simResult.events ?? [],
        });
      }

      if (StellarSdk.SorobanRpc.Api.isSimulationRestore(simResult)) {
        return JSON.stringify({
          success: false,
          simulationFailed: false,
          requiresRestore: true,
          message:
            "One or more ledger entries are archived and must be restored " +
            "before this transaction can succeed. Use the restoreFootprint " +
            "operation first.",
          restorePreamble: {
            minResourceFee: simResult.restorePreamble.minResourceFee,
            transactionData: simResult.restorePreamble.transactionData
              .build()
              .toXDR("base64"),
          },
        });
      }

      // Successful simulation
      const sorobanData = simResult.transactionData.build();
      const resources = sorobanData.resources();

      const result = {
        success: true,
        simulationFailed: false,
        network,
        // Fee breakdown
        feeEstimate: {
          minResourceFee: simResult.minResourceFee,
          baseFee: tx.fee,
          totalRecommendedFee: (
            parseInt(simResult.minResourceFee) + parseInt(tx.fee)
          ).toString(),
        },
        // Soroban resource consumption
        resources: {
          instructions: resources.instructions().toString(),
          readBytes: resources.readBytes().toString(),
          writeBytes: resources.writeBytes().toString(),
          // Count of ledger entries accessed
          readOnlyFootprint: sorobanData
            .resources()
            .footprint()
            .readOnly().length,
          readWriteFootprint: sorobanData
            .resources()
            .footprint()
            .readWrite().length,
        },
        // Auth entries that must be signed before submission
        authRequired: simResult.result?.auth?.map((entry) =>
          entry.toXDR("base64")
        ) ?? [],
        authCount: simResult.result?.auth?.length ?? 0,
        // Return value from the contract invocation (if any)
        returnValue: simResult.result?.retval
          ? simResult.result.retval.toXDR("base64")
          : null,
        // Emitted contract events
        events: simResult.events?.map((e) => e.toXDR("base64")) ?? [],
        latestLedger: simResult.latestLedger,
      };

      return JSON.stringify(result, null, 2);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        success: false,
        error: `RPC simulation request failed: ${message}`,
      });
    }
  },
});

export default simulateTransactionTool;
