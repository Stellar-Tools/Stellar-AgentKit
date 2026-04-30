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
  import { SorobanContractConfig } from "./contract";
  
  const DEFAULT_STAKE_CONTRACT = "CBTYOERLDPHPODHLZ7XKPUIJJTEZKYMBKEUA2JBCRPRMMDK6A4GM2UZF";
  
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
  
      const targetContractId = config.contractAddress || (config.network === "testnet" ? DEFAULT_STAKE_CONTRACT : "");
      if (!targetContractId) {
        throw new Error("A specific contractAddress must be provided for Soroban Staking operations on mainnet.");
      }

      const contract = new Contract(targetContractId);
  
      // Build transaction using unified builder
      const sorobanOperation = {
        contract,
        functionName: functName,
        args: values == null ? undefined : Array.isArray(values) ? values : [values],
      };
      const transaction = buildTransaction("stake", sourceAccount, sorobanOperation);
  
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
      const signedXDR = signedTxResponse;
  
      const passphrase = config.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
      const tx = TransactionBuilder.fromXDR(signedXDR, passphrase);
      const txResult = await server.sendTransaction(tx).catch((err) => {
        throw new Error(`Failed to send transaction: ${err.message}`);
      });
  
      let txResponse = await server.getTransaction(txResult.hash);
      const maxRetries = 30;
      let retries = 0;
  
      while (txResponse.status === "NOT_FOUND" && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        txResponse = await server.getTransaction(txResult.hash);
        retries++;
      }
  
      if (txResponse.status !== "SUCCESS") {
        return `Transaction failed with status: ${txResponse.status}`;
      }
  
  
      return null; // No return value (e.g., for void functions)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error in contract interaction (${functName}): ${errorMessage}`;
    }
  };
  
  // Contract interaction functions
  async function initialize(caller: string, tokenAddress: string, rewardRate: number, config?: SorobanContractConfig) {
    try {
      const tokenScVal = addressToScVal(tokenAddress);
      const rewardRateScVal = numberToI128(rewardRate);
      await contractInt(caller, "initialize", [tokenScVal, rewardRateScVal], config);
      return "Contract initialized successfully";
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return errorMessage;
    }
  }
  
  async function stake(caller: string, amount: number, config?: SorobanContractConfig) {
    try {
      const userScVal = addressToScVal(caller);
      const amountScVal = numberToI128(amount);
      await contractInt(caller, "stake", [userScVal, amountScVal], config);
      return `Staked ${amount} successfully`;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return errorMessage;
    }
  }
  
  async function unstake(caller: string, amount: number, config?: SorobanContractConfig) {
    try {
      const userScVal = addressToScVal(caller);
      const amountScVal = numberToI128(amount);
      await contractInt(caller, "unstake", [userScVal, amountScVal], config);
      return `Unstaked ${amount} successfully`;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return errorMessage;
    }
  }
  
  async function claimRewards(caller: string, config?: SorobanContractConfig) {
    try {
      const userScVal = addressToScVal(caller);
      await contractInt(caller, "claim_rewards", userScVal, config);
      return "Rewards claimed successfully";
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return errorMessage;
    }
  }
  
  async function getStake(caller: string, userAddress: string, config?: SorobanContractConfig) {
    try {
      const userScVal = addressToScVal(userAddress);
      const result = await contractInt(caller, "get_stake", userScVal, config);
      return `Stake for ${userAddress}: ${result}`;
      return result; // Returns i128 as a BigInt
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return errorMessage; // Returns error message as a string
    }
  }
  
  export { initialize, stake, unstake, claimRewards, getStake };