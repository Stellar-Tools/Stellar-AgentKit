import {
  Contract,
  rpc,
  TransactionBuilder,
  scValToNative,
  xdr,
  Networks,
  Address,
} from "@stellar/stellar-sdk";
import { signTransaction } from "./stellar";
import { buildTransaction, OperationType } from "../utils/buildTransaction";

export interface SorobanClientConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractAddress: string;
}

export class SorobanClient {
  private server: rpc.Server;
  private networkPassphrase: string;
  private contractAddress: string;

  constructor(config: SorobanClientConfig) {
    this.server = new rpc.Server(config.rpcUrl, { allowHttp: true });
    this.networkPassphrase = config.networkPassphrase;
    this.contractAddress = config.contractAddress;
  }

  /**
   * Interact with a Soroban contract
   * @param caller Public key of the caller
   * @param functionName Name of the contract function
   * @param args Arguments for the function call
   * @param operationType Type of operation (default: "lp")
   * @returns The parsed result of the contract call
   */
  async call(
    caller: string,
    functionName: string,
    args: any[] | null = null,
    operationType: OperationType = "lp"
  ): Promise<any> {
    try {
      const sourceAccount = await this.server.getAccount(caller).catch((err) => {
        throw new Error(`Failed to fetch account ${caller}: ${err.message}`);
      });

      const contract = new Contract(this.contractAddress);

      // Build transaction using unified builder
      const sorobanOperation = {
        contract,
        functionName,
        args: args == null ? undefined : Array.isArray(args) ? args : [args],
      };
      const transaction = buildTransaction(operationType, sourceAccount, sorobanOperation);

      const simulation = await this.server.simulateTransaction(transaction).catch((err) => {
        console.error(`Simulation failed for ${functionName}: ${err.message}`);
        throw new Error(`Failed to simulate transaction: ${err.message}`);
      });

      // Handle Read-Only Calls (Simulation Results)
      if ("results" in simulation && Array.isArray(simulation.results) && simulation.results.length > 0) {
        const result = simulation.results[0];
        if (result.xdr) {
          const scVal = xdr.ScVal.fromXDR(result.xdr, "base64");
          return scValToNative(scVal);
        }
      } else if ("error" in simulation) {
        throw new Error(`Simulation failed: ${simulation.error}`);
      }

      // For state-changing calls, prepare and submit
      const preparedTx = await this.server.prepareTransaction(transaction).catch((err) => {
        throw new Error(`Failed to prepare transaction: ${err.message}`);
      });

      const signedXDR = signTransaction(preparedTx.toXDR(), this.networkPassphrase);
      const tx = TransactionBuilder.fromXDR(signedXDR, this.networkPassphrase);
      
      const txResult = await this.server.sendTransaction(tx).catch((err) => {
        throw new Error(`Send transaction failed: ${err.message}`);
      });

      // Wait for transaction to be confirmed
      let txResponse = await this.server.getTransaction(txResult.hash);
      const maxRetries = 30;
      let retries = 0;

      while (txResponse.status === "NOT_FOUND" && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        txResponse = await this.server.getTransaction(txResult.hash);
        retries++;
      }

      if (txResponse.status === "NOT_FOUND") {
        return { 
          hash: txResult.hash, 
          status: "PENDING", 
          message: "Transaction is still pending. Please check status later using this hash." 
        };
      }

      if (txResponse.status !== "SUCCESS") {
        throw new Error(`Transaction failed with status: ${txResponse.status}`);
      }

      // Parse return value if present
      if (txResponse.returnValue) {
        return scValToNative(txResponse.returnValue);
      }

      return null;
    } catch (error: any) {
      console.error(`Error in Soroban interaction (${functionName}):`, error.message);
      throw error;
    }
  }
}
