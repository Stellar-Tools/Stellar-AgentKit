"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialize = initialize;
exports.stake = stake;
exports.unstake = unstake;
exports.claimRewards = claimRewards;
exports.getStake = getStake;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const stellar_1 = require("./stellar");
const buildTransaction_1 = require("../utils/buildTransaction");
// Configuration
const rpcUrl = "https://soroban-testnet.stellar.org";
const contractAddress = "CBTYOERLDPHPODHLZ7XKPUIJJTEZKYMBKEUA2JBCRPRMMDK6A4GM2UZF"; // Replace with actual deployed contract address
const networkPassphrase = stellar_sdk_1.Networks.TESTNET;
const addressToScVal = (address) => {
    // Validate address format
    if (!address.match(/^[CG][A-Z0-9]{55}$/)) {
        throw new Error(`Invalid address format: ${address}`);
    }
    // Use Address directly or convert to ScVal
    return (0, stellar_sdk_1.nativeToScVal)(new stellar_sdk_1.Address(address), { type: "address" });
};
const numberToI128 = (value) => {
    return (0, stellar_sdk_1.nativeToScVal)(value, { type: "i128" });
};
const contractInt = (caller, functName, values) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const server = new stellar_sdk_1.rpc.Server(rpcUrl, { allowHttp: true });
        const sourceAccount = yield server.getAccount(caller).catch((err) => {
            throw new Error(`Failed to fetch account ${caller}: ${err.message}`);
        });
        const contract = new stellar_sdk_1.Contract(contractAddress);
        // Build transaction using unified builder
        const sorobanOperation = {
            contract,
            functionName: functName,
            args: values == null ? undefined : Array.isArray(values) ? values : [values],
        };
        const transaction = (0, buildTransaction_1.buildTransaction)("stake", sourceAccount, sorobanOperation);
        // Prepare and sign transaction
        const preparedTx = yield server.prepareTransaction(transaction).catch((err) => {
            throw new Error(`Failed to prepare transaction: ${err.message}`);
        });
        const prepareTxXDR = preparedTx.toXDR();
        let signedTxResponse;
        try {
            signedTxResponse = (0, stellar_1.signTransaction)(prepareTxXDR, networkPassphrase);
        }
        catch (err) {
            throw new Error(`Failed to sign transaction: ${err.message}`);
        }
        // Handle both string and object response from signTransaction
        const signedXDR = signedTxResponse;
        const tx = stellar_sdk_1.TransactionBuilder.fromXDR(signedXDR, stellar_sdk_1.Networks.TESTNET);
        const txResult = yield server.sendTransaction(tx).catch((err) => {
            throw new Error(`Failed to send transaction: ${err.message}`);
        });
        let txResponse = yield server.getTransaction(txResult.hash);
        const maxRetries = 30;
        let retries = 0;
        while (txResponse.status === "NOT_FOUND" && retries < maxRetries) {
            yield new Promise((resolve) => setTimeout(resolve, 1000));
            txResponse = yield server.getTransaction(txResult.hash);
            retries++;
        }
        if (txResponse.status !== "SUCCESS") {
            return `Transaction failed with status: ${txResponse.status}`;
        }
        return null; // No return value (e.g., for void functions)
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error in contract interaction (${functName}): ${errorMessage}`;
    }
});
// Contract interaction functions
function initialize(caller, tokenAddress, rewardRate) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const tokenScVal = addressToScVal(tokenAddress);
            const rewardRateScVal = numberToI128(rewardRate);
            yield contractInt(caller, "initialize", [tokenScVal, rewardRateScVal]);
            return "Contract initialized successfully";
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return errorMessage;
        }
    });
}
function stake(caller, amount) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userScVal = addressToScVal(caller);
            const amountScVal = numberToI128(amount);
            yield contractInt(caller, "stake", [userScVal, amountScVal]);
            return `Staked ${amount} successfully`;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return errorMessage;
        }
    });
}
function unstake(caller, amount) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userScVal = addressToScVal(caller);
            const amountScVal = numberToI128(amount);
            yield contractInt(caller, "unstake", [userScVal, amountScVal]);
            return `Unstaked ${amount} successfully`;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return errorMessage;
        }
    });
}
function claimRewards(caller) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userScVal = addressToScVal(caller);
            yield contractInt(caller, "claim_rewards", userScVal);
            return "Rewards claimed successfully";
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return errorMessage;
        }
    });
}
function getStake(caller, userAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userScVal = addressToScVal(userAddress);
            const result = yield contractInt(caller, "get_stake", userScVal);
            return `Stake for ${userAddress}: ${result}`;
            return result; // Returns i128 as a BigInt
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return errorMessage; // Returns error message as a string
        }
    });
}
