import {
    Contract,
    rpc,
    TransactionBuilder,
    nativeToScVal,
    Networks,
    Address,
  } from "@stellar/stellar-sdk";
  import {signTransaction} from "./stellar";
  import { buildTransaction } from "../utils/buildTransaction";
  import { SorobanClient } from "./soroban";
  
  // Configuration
  const rpcUrl = "https://soroban-testnet.stellar.org";
  const contractAddress = "CBTYOERLDPHPODHLZ7XKPUIJJTEZKYMBKEUA2JBCRPRMMDK6A4GM2UZF"; // Replace with actual deployed contract address
  const networkPassphrase = Networks.TESTNET;

  const client = new SorobanClient({
    rpcUrl,
    contractAddress,
    networkPassphrase,
  });
  
  const addressToScVal = (address: string) => {
    // Validate address format
    if (!address.match(/^[CG][A-Z0-9]{55}$/)) {
      throw new Error(`Invalid address format: ${address}`);
    }
    // Use Address directly or convert to ScVal
    return nativeToScVal(new Address(address), { type: "address" });
  };
  
  const numberToI128 = (value: number) => {
    return nativeToScVal(value, { type: "i128" });
  };
  
  // Contract interaction functions
  async function initialize(caller: string, tokenAddress: string, rewardRate: number) {
    try {
      const tokenScVal = addressToScVal(tokenAddress);
      const rewardRateScVal = numberToI128(rewardRate);
      await client.call(caller, "initialize", [tokenScVal, rewardRateScVal], "stake");
      return "Contract initialized successfully";
    } catch (error: any) {
      return error.message;
    }
  }
  
  async function stake(caller: string, amount: number) {
    try {
      const userScVal = addressToScVal(caller);
      const amountScVal = numberToI128(amount);
      await client.call(caller, "stake", [userScVal, amountScVal], "stake");
      return `Staked ${amount} successfully`;
    } catch (error: any) {
      return error.message;
    }
  }
  
  async function unstake(caller: string, amount: number) {
    try {
      const userScVal = addressToScVal(caller);
      const amountScVal = numberToI128(amount);
      await client.call(caller, "unstake", [userScVal, amountScVal], "stake");
      return `Unstaked ${amount} successfully`;
    } catch (error: any) {
      return error.message;
    }
  }
  
  async function claimRewards(caller: string) {
    try {
      const userScVal = addressToScVal(caller);
      await client.call(caller, "claim_rewards", userScVal, "stake");
      return "Rewards claimed successfully";
    } catch (error: any) {
      return error.message;
    }
  }
  
  async function getStake(caller: string, userAddress: string) {
    try {
      const userScVal = addressToScVal(userAddress);
      const result = await client.call(caller, "get_stake", userScVal, "stake");
      return `Stake for ${userAddress}: ${result}`;
    } catch (error: any) {
      return error.message;
    }
  }
  
  export { initialize, stake, unstake, claimRewards, getStake };