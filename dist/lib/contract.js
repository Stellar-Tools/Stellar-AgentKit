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
exports.getShareId = getShareId;
exports.deposit = deposit;
exports.swap = swap;
exports.withdraw = withdraw;
exports.getReserves = getReserves;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const stellar_1 = require("./stellar");
const buildTransaction_1 = require("../utils/buildTransaction");
// Configuration
const rpcUrl = "https://soroban-testnet.stellar.org";
const contractAddress = "CCUMBJFVC3YJOW3OOR6WTWTESH473ZSXQEGYPQDWXAYYC4J77OT4NVHJ"; // From networks.testnet.contractId
const networkPassphrase = stellar_sdk_1.Networks.TESTNET;
// Utility functions for ScVal conversion
const addressToScVal = (address) => {
    // Validate address format
    if (!address.match(/^[CG][A-Z0-9]{55}$/)) {
        throw new Error(`Invalid address format: ${address}`);
    }
    return (0, stellar_sdk_1.nativeToScVal)(new stellar_sdk_1.Address(address), { type: "address" });
};
const numberToI128 = (value) => {
    return (0, stellar_sdk_1.nativeToScVal)(typeof value === 'string' ? BigInt(value) : value, { type: "i128" });
};
const booleanToScVal = (value) => {
    return (0, stellar_sdk_1.nativeToScVal)(value, { type: "bool" });
};
// Core contract interaction function
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
        const transaction = (0, buildTransaction_1.buildTransaction)("lp", sourceAccount, sorobanOperation);
        const simulation = yield server.simulateTransaction(transaction).catch((err) => {
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
                    const scVal = stellar_sdk_1.xdr.ScVal.fromXDR(result.xdr, "base64");
                    const parsedValue = (0, stellar_sdk_1.scValToNative)(scVal);
                    console.log(`Parsed simulation result for ${functName}:`, parsedValue);
                    return parsedValue; // Returns string for share_id, array for get_rsrvs
                }
                catch (err) {
                    console.error(`Failed to parse XDR for ${functName}:`, err);
                    throw new Error(`Failed to parse simulation result: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            console.error(`No xdr field in simulation results[0] for ${functName}:`, result);
            throw new Error("No return value in simulation results");
        }
        else if ("error" in simulation) {
            console.error(`Simulation error for ${functName}:`, simulation.error);
            throw new Error(`Simulation failed: ${simulation.error}`);
        }
        // For state-changing calls, prepare and submit transaction
        console.log(`Submitting transaction for ${functName}`);
        const preparedTx = yield server.prepareTransaction(transaction).catch((err) => {
            console.error(`Prepare transaction failed for ${functName}: ${err.message}`);
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
            console.error(`Send transaction failed for ${functName}: ${err.message}`);
            throw new Error(`Send transaction failed: ${err.message}`);
        });
        let txResponse = yield server.getTransaction(txResult.hash);
        const maxRetries = 30;
        let retries = 0;
        while (txResponse.status === "NOT_FOUND" && retries < maxRetries) {
            yield new Promise((resolve) => setTimeout(resolve, 1000));
            txResponse = yield server.getTransaction(txResult.hash);
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
                const parsedValue = (0, stellar_sdk_1.scValToNative)(txResponse.returnValue);
                console.log(`Parsed transaction result for ${functName}:`, parsedValue);
                return parsedValue; // Returns array for withdraw
            }
            catch (err) {
                console.error(`Failed to parse transaction return value for ${functName}:`, err);
                throw new Error(`Failed to parse transaction result: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        return null; // No return value for void functions
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error in contract interaction (${functName}):`, errorMessage);
        throw error;
    }
});
// Contract interaction functions
function getShareId(caller) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield contractInt(caller, "share_id", null);
            console.log("Share ID:", result);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Failed to get share ID:", errorMessage);
            throw error;
        }
    });
}
function deposit(caller, to, desiredA, minA, desiredB, minB) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const toScVal = addressToScVal(to);
            const desiredAScVal = numberToI128(desiredA);
            const minAScVal = numberToI128(minA);
            const desiredBScVal = numberToI128(desiredB);
            const minBScVal = numberToI128(minB);
            yield contractInt(caller, "deposit", [
                toScVal,
                desiredAScVal,
                minAScVal,
                desiredBScVal,
                minBScVal,
            ]);
            console.log(`Deposited successfully to ${to}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Failed to deposit:", errorMessage);
            throw error;
        }
    });
}
function swap(caller, to, buyA, out, inMax) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const toScVal = addressToScVal(to);
            const buyAScVal = booleanToScVal(buyA);
            const outScVal = numberToI128(out);
            const inMaxScVal = numberToI128(inMax);
            yield contractInt(caller, "swap", [toScVal, buyAScVal, outScVal, inMaxScVal]);
            console.log(`Swapped successfully to ${to}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Failed to swap:", errorMessage);
            throw error;
        }
    });
}
function withdraw(caller, to, shareAmount, minA, minB) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const toScVal = addressToScVal(to);
            const shareAmountScVal = numberToI128(shareAmount);
            const minAScVal = numberToI128(minA);
            const minBScVal = numberToI128(minB);
            const result = yield contractInt(caller, "withdraw", [
                toScVal,
                shareAmountScVal,
                minAScVal,
                minBScVal,
            ]);
            console.log(`Withdrawn successfully to ${to}:, ${result}`);
            return result ? result : null;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Failed to withdraw:", errorMessage);
            throw error;
        }
    });
}
function getReserves(caller) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield contractInt(caller, "get_rsrvs", null);
            console.log("Reserves:", result);
            return result ? result : null;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Failed to get reserves:", errorMessage);
            throw error;
        }
    });
}
