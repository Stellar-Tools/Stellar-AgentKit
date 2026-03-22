"use strict";
/**
 * Batch Transaction Operations for Stellar AgentKit
 *
 * Execute multiple contract operations in a single transaction.
 * Improves gas efficiency and atomic execution.
 *
 * Example: Deposit to LP + Swap + Claim rewards in one transaction
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchTransactionBuilder = void 0;
exports.executeBatchTransaction = executeBatchTransaction;
exports.simulateBatchTransaction = simulateBatchTransaction;
exports.createBatchBuilder = createBatchBuilder;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const errors_1 = require("../errors");
function getDefaultRpcUrl(networkPassphrase) {
    return networkPassphrase === stellar_sdk_1.Networks.PUBLIC
        ? "https://mainnet.sorobanrpc.com"
        : "https://soroban-testnet.stellar.org";
}
function parsePositiveMultiplier(value, fallback) {
    const resolved = value ?? fallback;
    if (!Number.isFinite(resolved) || resolved <= 0) {
        throw new errors_1.ValidationError(`Invalid feeMultiplier: ${resolved}`, { feeMultiplier: resolved }, "feeMultiplier must be a finite positive number");
    }
    return resolved;
}
/**
 * Batch transaction builder
 *
 * Combines multiple Soroban contract operations into a single transaction
 * for atomic execution and gas efficiency.
 */
class BatchTransactionBuilder {
    constructor(sourceAccount, options = {}) {
        this.operations = [];
        this.maxOperations = 20; // Soroban limit
        this.sourceAccount = sourceAccount;
        const networkPassphrase = options.networkPassphrase || stellar_sdk_1.Networks.TESTNET;
        this.options = {
            rpcUrl: options.rpcUrl || getDefaultRpcUrl(networkPassphrase),
            networkPassphrase,
            timeout: options.timeout || 300,
            memo: options.memo || "",
            feeMultiplier: parsePositiveMultiplier(options.feeMultiplier, 1.2), // 20% extra for batch
        };
    }
    /**
     * Add an operation to the batch
     */
    addOperation(contract, functionName, args, description) {
        if (this.operations.length >= this.maxOperations) {
            throw new errors_1.ValidationError(`Maximum batch operations exceeded (${this.maxOperations})`, { current: this.operations.length, max: this.maxOperations });
        }
        this.operations.push({
            contract,
            functionName,
            args,
            description,
        });
        return this; // For chaining
    }
    /**
     * Add swap operation
     */
    addSwap(contract, to, buyA, out, inMax) {
        return this.addOperation(contract, "swap", [to, buyA, out, inMax], `Swap ${buyA ? "to A" : "to B"}: out=${out}`);
    }
    /**
     * Add LP deposit operation
     */
    addDeposit(contract, to, desiredA, minA, desiredB, minB) {
        return this.addOperation(contract, "deposit", [to, desiredA, minA, desiredB, minB], `Deposit: A=${desiredA}, B=${desiredB}`);
    }
    /**
     * Add LP withdrawal operation
     */
    addWithdraw(contract, to, shareAmount, minA, minB) {
        return this.addOperation(contract, "withdraw", [to, shareAmount, minA, minB], `Withdraw: shares=${shareAmount}`);
    }
    /**
     * Build the batch transaction (unsigned)
     */
    build() {
        if (this.operations.length === 0) {
            throw new errors_1.ValidationError("No operations in batch", {}, "Add at least one operation before building");
        }
        // Calculate fee: base + (count * operation fee) with multiplier
        const baseFeeNum = parseInt(stellar_sdk_1.BASE_FEE, 10);
        const operationFee = baseFeeNum * Math.ceil(this.operations.length * this.options.feeMultiplier);
        const memoObj = this.options.memo
            ? stellar_sdk_1.Memo.text(this.options.memo)
            : undefined;
        const builder = new stellar_sdk_1.TransactionBuilder(this.sourceAccount, {
            fee: operationFee.toString(),
            networkPassphrase: this.options.networkPassphrase,
            memo: memoObj,
        });
        // Add all operations
        for (const op of this.operations) {
            builder.addOperation(op.contract.call(op.functionName, ...op.args));
        }
        builder.setTimeout(this.options.timeout);
        return builder.build();
    }
    /**
     * Get operation count
     */
    getOperationCount() {
        return this.operations.length;
    }
    /**
     * Get operation descriptions
     */
    getOperationSummary() {
        return this.operations.map((op) => op.description || `${op.functionName}(...)`);
    }
    /**
     * Clear all operations
     */
    clear() {
        this.operations = [];
        return this;
    }
}
exports.BatchTransactionBuilder = BatchTransactionBuilder;
/**
 * Execute and monitor batch transaction
 */
async function executeBatchTransaction(transaction, privateKey, options = {}) {
    const networkPassphrase = options.networkPassphrase || stellar_sdk_1.Networks.TESTNET;
    const rpcUrl = options.rpcUrl || getDefaultRpcUrl(networkPassphrase);
    const timeoutSeconds = options.timeout ?? 300;
    try {
        const server = new stellar_sdk_1.rpc.Server(rpcUrl, { allowHttp: true });
        // Sign transaction
        const keypair = stellar_sdk_1.Keypair.fromSecret(privateKey);
        transaction.sign(keypair);
        // Submit transaction using sendTransaction (if available) or throw
        let response;
        if ('sendTransaction' in server) {
            response = await server.sendTransaction(transaction);
        }
        else if ('submitTransaction' in server) {
            response = await server.submitTransaction(transaction);
        }
        else {
            throw new errors_1.TransactionError("RPC server does not support transaction submission", { rpcUrl });
        }
        if (!("hash" in response)) {
            throw new errors_1.TransactionError("Invalid transaction submission response", { response: JSON.stringify(response) });
        }
        if (response.status === "ERROR") {
            throw new errors_1.TransactionError("Transaction submission failed", { response: JSON.stringify(response), rpcUrl });
        }
        // Confirm final transaction outcome from RPC instead of assuming success on submission.
        let finalTx = null;
        const deadline = Date.now() + timeoutSeconds * 1000;
        while (Date.now() < deadline) {
            finalTx = await server.getTransaction(response.hash);
            if (finalTx && (finalTx.status === "SUCCESS" || finalTx.status === "FAILED")) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        if (!finalTx || finalTx.status !== "SUCCESS") {
            throw new errors_1.TransactionError("Batch transaction was submitted but not confirmed successfully", { hash: response.hash, finalStatus: finalTx?.status, rpcUrl });
        }
        // Parse transaction results
        const operations = transaction.operations?.length || 0;
        return {
            transactionHash: response.hash,
            ledger: Number(finalTx.ledger) || Number(response.ledger) || 0,
            operations,
            status: "success",
            results: Array(operations)
                .fill(null)
                .map((_, i) => ({
                operation: `Operation ${i + 1}`,
                success: true,
            })),
            totalFee: transaction.fee?.toString() || stellar_sdk_1.BASE_FEE.toString(),
        };
    }
    catch (error) {
        throw new errors_1.TransactionError(`Batch transaction execution failed: ${error instanceof Error ? error.message : String(error)}`, { rpcUrl, operationCount: transaction.operations?.length }, undefined, error instanceof Error ? error : undefined);
    }
}
/**
 * Simulate batch transaction to estimate fees
 */
async function simulateBatchTransaction(transaction, options = {}) {
    const networkPassphrase = options.networkPassphrase || stellar_sdk_1.Networks.TESTNET;
    const rpcUrl = options.rpcUrl || getDefaultRpcUrl(networkPassphrase);
    try {
        const server = new stellar_sdk_1.rpc.Server(rpcUrl, { allowHttp: true });
        const simulation = await server.simulateTransaction(transaction);
        if ("error" in simulation) {
            throw new errors_1.ContractError(`Batch simulation failed: ${simulation.error}`, { rpcUrl });
        }
        const txFee = BigInt(transaction.fee || stellar_sdk_1.BASE_FEE);
        const resourceFee = (() => {
            const minResourceFee = simulation.minResourceFee;
            if (minResourceFee === undefined || minResourceFee === null) {
                return 0n;
            }
            try {
                return BigInt(String(minResourceFee));
            }
            catch {
                return 0n;
            }
        })();
        return {
            estimatedFee: (txFee + resourceFee).toString(),
            resourceUsage: simulation.results?.[0] || {},
            success: true,
        };
    }
    catch (error) {
        throw new errors_1.TransactionError(`Failed to simulate batch transaction: ${error instanceof Error ? error.message : String(error)}`, { rpcUrl }, undefined, error instanceof Error ? error : undefined);
    }
}
/**
 * Helper to create pre-configured batch builder
 */
function createBatchBuilder(sourceAccount, network = "testnet") {
    return new BatchTransactionBuilder(sourceAccount, {
        networkPassphrase: network === "testnet" ? stellar_sdk_1.Networks.TESTNET : stellar_sdk_1.Networks.PUBLIC,
    });
}
