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
  
  export interface SorobanContractConfig {
    network: "testnet" | "mainnet";
    rpcUrl: string;
    contractAddress?: string; // If omitted, defaults to testnet pool below
    simulate?: boolean; // Dry-run simulation mode
  }
  
  const DEFAULT_TESTNET_CONTRACT = "CCUMBJFVC3YJOW3OOR6WTWTESH473ZSXQEGYPQDWXAYYC4J77OT4NVHJ";
  
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
  const contractInt = async (
    caller: string, 
    functName: string, 
    values: any, 
    config: SorobanContractConfig = { network: "testnet", rpcUrl: "https://soroban-testnet.stellar.org" }
  ) => {
    try {
      const server = new rpc.Server(config.rpcUrl, { allowHttp: true });
      const sourceAccount = await server.getAccount(caller).catch((err) => {
        throw new Error(`Failed to fetch account ${caller}: ${err.message}`);
      });
  
      const targetContractId = config.contractAddress || (config.network === "testnet" ? DEFAULT_TESTNET_CONTRACT : "");
      if (!targetContractId) {
        throw new Error("A specific contractAddress must be provided for Soroban LP/Swap operations on mainnet.");
      }

      const contract = new Contract(targetContractId);
  
      // Build transaction using unified builder
      const sorobanOperation = {
        contract,
        functionName: functName,
        args: values == null ? undefined : Array.isArray(values) ? values : [values],
      };
      const transaction = buildTransaction("lp", sourceAccount, sorobanOperation);
  
      // Simulate transaction if requested
      if (config.simulate) {
        const simulation = await server.simulateTransaction(transaction) as any;
        if (simulation.error) {
          throw new Error(`Simulation Failed: ${simulation.error}`);
        }
        
        let returnValue = null;
        if (simulation.result?.retval) {
           try {
             returnValue = scValToNative(simulation.result.retval);
           } catch(e) {
             returnValue = "Failed to parse return value";
           }
        }

        return JSON.stringify({
          status: "simulated",
          minResourceFee: simulation.minResourceFee,
          cost: simulation.cost,
          events: simulation.events?.length || 0,
          result: returnValue
        }, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2);
      }

      // Prepare and sign transaction
      const preparedTx = await server.prepareTransaction(transaction).catch((err) => {
        throw new Error(`Failed to prepare transaction: ${err.message}`);
      });
      const prepareTxXDR = preparedTx.toXDR();
      
      let signedTxResponse: string;
      try {
        const passphrase = config.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
        signedTxResponse = signTransaction(prepareTxXDR, passphrase);
      } catch (err: any) {
        throw new Error(`Failed to sign transaction: ${err.message}`);
      }
  
      // Handle both string and object response from signTransaction
      const signedXDR = signedTxResponse
  
      const passphrase = config.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
      const tx = TransactionBuilder.fromXDR(signedXDR, passphrase);
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
  export async function getShareId(caller: string, config?: SorobanContractConfig): Promise<string | null> {
    try {
      const result = await contractInt(caller, "share_id", null, config);
      if (config?.simulate) return result as any; // Forward the simulation text
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
    minB: string,
    config?: SorobanContractConfig
  ) {
    try {
      const toScVal = addressToScVal(to);
      const desiredAScVal = numberToI128(desiredA);
      const minAScVal = numberToI128(minA);
      const desiredBScVal = numberToI128(desiredB);
      const minBScVal = numberToI128(minB);
      const result = await contractInt(caller, "deposit", [
        toScVal,
        desiredAScVal,
        minAScVal,
        desiredBScVal,
        minBScVal,
      ], config);
      if (config?.simulate) return result as any; // Forward the simulation text
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
    inMax: string,
    config?: SorobanContractConfig
  ) {
    try {
      const toScVal = addressToScVal(to);
      const buyAScVal = booleanToScVal(buyA);
      const outScVal = numberToI128(out);
      const inMaxScVal = numberToI128(inMax);
      const result = await contractInt(caller, "swap", [toScVal, buyAScVal, outScVal, inMaxScVal], config);
      if (config?.simulate) return result as any; // Forward the simulation text
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
    minB: string,
    config?: SorobanContractConfig
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
      ], config);
      if (config?.simulate) return result as any; // Forward the simulation text
      console.log(`Withdrawn successfully to ${to}:, ${result}`);
      return result ? (result as [BigInt, BigInt]) : null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to withdraw:", errorMessage);
      throw error;
    }
  }
  
  export async function getReserves(caller: string, config?: SorobanContractConfig): Promise<readonly [BigInt, BigInt] | null> {
    try {
      const result = await contractInt(caller, "get_rsrvs", null, config);
      if (config?.simulate) return result as any; // Forward the simulation text
      console.log("Reserves:", result);
      return result ? (result as [BigInt, BigInt]) : null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to get reserves:", errorMessage);
      throw error;
    }
  }