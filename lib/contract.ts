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
  import { SorobanClient } from "./soroban";
  
  // Configuration
  const rpcUrl = "https://soroban-testnet.stellar.org";
  const contractAddress = "CCUMBJFVC3YJOW3OOR6WTWTESH473ZSXQEGYPQDWXAYYC4J77OT4NVHJ"; // From networks.testnet.contractId
  const networkPassphrase = Networks.TESTNET;

  const client = new SorobanClient({
    rpcUrl,
    contractAddress,
    networkPassphrase,
  });
  
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

  
  // Contract interaction functions
  export async function getShareId(caller: string): Promise<string | null> {
    try {
      const result = await client.call(caller, "share_id");
      console.log("Share ID:", result);
      return result as string | null;
    } catch (error: any) {
      console.error("Failed to get share ID:", error.message);
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
  ): Promise<any> {
    try {
      const toScVal = addressToScVal(to);
      const desiredAScVal = numberToI128(desiredA);
      const minAScVal = numberToI128(minA);
      const desiredBScVal = numberToI128(desiredB);
      const minBScVal = numberToI128(minB);
      const result = await client.call(caller, "deposit", [
        toScVal,
        desiredAScVal,
        minAScVal,
        desiredBScVal,
        minBScVal,
      ]);
      console.log(`Deposited successfully to ${to}`);
      return result;
    } catch (error: any) {
      console.error("Failed to deposit:", error.message);
      throw error;
    }
  }
  
  export async function swap(
    caller: string,
    to: string,
    buyA: boolean,
    out: string,
    inMax: string
  ): Promise<any> {
    try {
      const toScVal = addressToScVal(to);
      const buyAScVal = booleanToScVal(buyA);
      const outScVal = numberToI128(out);
      const inMaxScVal = numberToI128(inMax);
      const result = await client.call(caller, "swap", [toScVal, buyAScVal, outScVal, inMaxScVal]);
      console.log(`Swapped successfully to ${to}`);
      return result;
    } catch (error: any) {
      console.error("Failed to swap:", error.message);
      throw error;
    }
  }
  
  export async function withdraw(
    caller: string,
    to: string,
    shareAmount: string,
    minA: string,
    minB: string
  ): Promise<any> {
    try {
      const toScVal = addressToScVal(to);
      const shareAmountScVal = numberToI128(shareAmount);
      const minAScVal = numberToI128(minA);
      const minBScVal = numberToI128(minB);
      const result = await client.call(caller, "withdraw", [
        toScVal,
        shareAmountScVal,
        minAScVal,
        minBScVal,
      ]);
      console.log(`Withdrawn successfully to ${to}:, ${result}`);
      return result;
    } catch (error: any) {
      console.error("Failed to withdraw:", error.message);
      throw error;
    }
  }
  
  export async function getReserves(caller: string): Promise<any> {
    try {
      const result = await client.call(caller, "get_rsrvs");
      console.log("Reserves:", result);
      return result;
    } catch (error: any) {
      console.error("Failed to get reserves:", error.message);
      throw error;
    }
  }