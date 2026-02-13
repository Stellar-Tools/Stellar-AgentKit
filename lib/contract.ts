import {
    Contract,
    rpc,
    TransactionBuilder,
    nativeToScVal,
    scValToNative,
    xdr,
    Networks,
    BASE_FEE,
    Address,
  } from "@stellar/stellar-sdk";
  import { signTransaction } from "./stellar";
  import { buildTransaction } from "../utils/buildTransaction";
  
  // Configuration
  const rpcUrl = "https://soroban-testnet.stellar.org";
  const contractAddress = "CCUMBJFVC3YJOW3OOR6WTWTESH473ZSXQEGYPQDWXAYYC4J77OT4NVHJ"; // From networks.testnet.contractId
  const networkPassphrase = Networks.TESTNET;
  
  // Utility functions for ScVal conversion
  const addressToScVal = (address: string) => {
    // Validate address format
    if (!address.match(/^[CG][A-Z0-9]{55}$/)) {
      throw new Error(`Invalid address format: ${address}`);
    }
    return nativeToScVal(new Address(address), { type: "address" });
  };
  
  const numberToI128 = (value: string | BigInt) => {
    return nativeToScVal(typeof value === 'string' ? BigInt(value) : value, { type: "i128" });
  };
  
  const booleanToScVal = (value: boolean) => {
    return nativeToScVal(value, { type: "bool" });
  };
  
  // Core contract interaction function
  const contractInt = async (caller: string, functName: string, values: any) => {
    try {
      const server = new rpc.Server(rpcUrl, { allowHttp: true });
      const sourceAccount = await server.getAccount(caller).catch((err) => {
        throw new Error(`Failed to fetch account ${caller}: ${err.message}`);
      });
  
      const contract = new Contract(contractAddress);
  
      // Build transaction using unified builder
      const sorobanOperation = {
        contract,
        functionName: functName,
        args: values == null ? undefined : Array.isArray(values) ? values : [values],
      };
      const transaction = buildTransaction("lp", sourceAccount, sorobanOperation);
  
      const simulation = await server.simulateTransaction(transaction).catch((err) => {
        console.error(`Simulation failed for ${functName}: ${err.message}`);
        throw new Error(`Failed to simulate transaction: ${err.message}`);
      });
  
      console.log(`Simulation response for ${functName}:`, JSON.stringify(simulation, null, 2));
  
      if ("results" in simulation && Array.isArray(simulation.results) && simulation.results.length > 0) {
        console.log(`Read-only call detected for ${functName}`);
        const result = simulation.results[0];
        if (result.xdr) {
          try {
            // Parse the return value from XDR
            const scVal = xdr.ScVal.fromXDR(result.xdr, "base64");
            const parsedValue = scValToNative(scVal);
            console.log(`Parsed simulation result for ${functName}:`, parsedValue);
            return parsedValue; // Returns string for share_id, array for get_rsrvs
          } catch (err) {
            console.error(`Failed to parse XDR for ${functName}:`, err);
            throw new Error(`Failed to parse simulation result: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        console.error(`No xdr field in simulation results[0] for ${functName}:`, result);
        throw new Error("No return value in simulation results");
      } else if ("error" in simulation) {
        console.error(`Simulation error for ${functName}:`, simulation.error);
        throw new Error(`Simulation failed: ${simulation.error}`);
      }
  
      // For state-changing calls, prepare and submit transaction
      console.log(`Submitting transaction for ${functName}`);
      const preparedTx = await server.prepareTransaction(transaction).catch((err) => {
        console.error(`Prepare transaction failed for ${functName}: ${err.message}`);
        throw new Error(`Failed to prepare transaction: ${err.message}`);
      });
      const prepareTxXDR = preparedTx.toXDR();
  
      let signedTxResponse: string;
      try {
        signedTxResponse = signTransaction(prepareTxXDR, networkPassphrase);
      } catch (err: any) {
        throw new Error(`Failed to sign transaction: ${err.message}`);
      }
  
      // Handle both string and object response from signTransaction
      const signedXDR = signedTxResponse
  
      const tx = TransactionBuilder.fromXDR(signedXDR, Networks.TESTNET);
      const txResult = await server.sendTransaction(tx).catch((err) => {
        console.error(`Send transaction failed for ${functName}: ${err.message}`);
        throw new Error(`Send transaction failed: ${err.message}`);
      });
  
      let txResponse = await server.getTransaction(txResult.hash);
      const maxRetries = 30;
      let retries = 0;
  
      while (txResponse.status === "NOT_FOUND" && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        txResponse = await server.getTransaction(txResult.hash);
        retries++;
      }

      if (txResponse.status === "NOT_FOUND") {
        return { hash: txResult.hash, status: "PENDING", message: "Transaction is still pending. Please check status later using this hash." };
      }
  
      if (txResponse.status !== "SUCCESS") {
        console.error(`Transaction failed for ${functName} with status: ${txResponse.status}`, JSON.stringify(txResponse, null, 2));
        throw new Error(`Transaction failed with status: ${txResponse.status}`);
      }
  
      // Parse return value if present (e.g., for withdraw)
      if (txResponse.returnValue) {
        try {
          // returnValue is already an ScVal, no need for fromXDR
          const parsedValue = scValToNative(txResponse.returnValue);
          console.log(`Parsed transaction result for ${functName}:`, parsedValue);
          return parsedValue; // Returns array for withdraw
        } catch (err) {
          console.error(`Failed to parse transaction return value for ${functName}:`, err);
          throw new Error(`Failed to parse transaction result: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
  
      return null; // No return value for void functions
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error in contract interaction (${functName}):`, errorMessage);
      throw error;
    }
  };
  
  // Contract interaction functions
  export async function getShareId(caller: string): Promise<string | null> {
    try {
      const result = await contractInt(caller, "share_id", null);
      console.log("Share ID:", result);
      return result as string | null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to get share ID:", errorMessage);
      throw error;
    }
  }
  
  export async function deposit(
    caller: string,
    to: string,
    desiredA: string,
    minA: string,
    desiredB: string,
    minB: string
  ) {
    try {
      const toScVal = addressToScVal(to);
      const desiredAScVal = numberToI128(desiredA);
      const minAScVal = numberToI128(minA);
      const desiredBScVal = numberToI128(desiredB);
      const minBScVal = numberToI128(minB);
      await contractInt(caller, "deposit", [
        toScVal,
        desiredAScVal,
        minAScVal,
        desiredBScVal,
        minBScVal,
      ]);
      console.log(`Deposited successfully to ${to}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to deposit:", errorMessage);
      throw error;
    }
  }
  
  export async function swap(
    caller: string,
    to: string,
    buyA: boolean,
    out: string,
    inMax: string
  ) {
    try {
      const toScVal = addressToScVal(to);
      const buyAScVal = booleanToScVal(buyA);
      const outScVal = numberToI128(out);
      const inMaxScVal = numberToI128(inMax);
      await contractInt(caller, "swap", [toScVal, buyAScVal, outScVal, inMaxScVal]);
      console.log(`Swapped successfully to ${to}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to swap:", errorMessage);
      throw error;
    }
  }
  
  export async function withdraw(
    caller: string,
    to: string,
    shareAmount: string,
    minA: string,
    minB: string
  ): Promise<readonly [BigInt, BigInt] | null> {
    try {
      const toScVal = addressToScVal(to);
      const shareAmountScVal = numberToI128(shareAmount);
      const minAScVal = numberToI128(minA);
      const minBScVal = numberToI128(minB);
      const result = await contractInt(caller, "withdraw", [
        toScVal,
        shareAmountScVal,
        minAScVal,
        minBScVal,
      ]);
      console.log(`Withdrawn successfully to ${to}:, ${result}`);
      return result ? (result as [BigInt, BigInt]) : null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to withdraw:", errorMessage);
      throw error;
    }
  }
  
  export async function getReserves(caller: string): Promise<readonly [BigInt, BigInt] | null> {
    try {
      const result = await contractInt(caller, "get_rsrvs", null);
      console.log("Reserves:", result);
      return result ? (result as [BigInt, BigInt]) : null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to get reserves:", errorMessage);
      throw error;
    }
  }