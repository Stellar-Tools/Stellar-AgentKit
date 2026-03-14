"use strict";
/**
 * Transaction Tracking Example
 *
 * This example demonstrates how to use the Transaction Tracker
 * to monitor and track Stellar transactions across different operations.
 */
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
exports.basicTrackingExample = basicTrackingExample;
exports.standaloneTrackerExample = standaloneTrackerExample;
exports.multipleTransactionsExample = multipleTransactionsExample;
exports.networkSwitchingExample = networkSwitchingExample;
exports.errorHandlingExample = errorHandlingExample;
exports.agentClientIntegrationExample = agentClientIntegrationExample;
exports.transactionHistoryExample = transactionHistoryExample;
const index_1 = require("../index");
// Example 1: Basic Transaction Tracking with AgentClient
function basicTrackingExample() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("\n=== Example 1: Basic Transaction Tracking ===\n");
        // Initialize AgentClient with tracking enabled (enabled by default)
        const agent = new index_1.AgentClient({
            network: "testnet",
            publicKey: process.env.STELLAR_PUBLIC_KEY,
            enableTracking: true,
        });
        // Perform a swap operation
        try {
            const swapResult = yield agent.swap({
                to: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                buyA: true,
                out: "100",
                inMax: "110",
            });
            console.log("Swap initiated:", swapResult);
            // If the swap returns a transaction hash, track it
            if (swapResult && typeof swapResult === "object" && "hash" in swapResult) {
                const hash = swapResult.hash;
                // Wait for confirmation
                const status = yield agent.waitForConfirmation(hash, index_1.OperationType.SWAP);
                console.log("Transaction Status:", status);
                if ((status === null || status === void 0 ? void 0 : status.status) === index_1.TransactionStatus.SUCCESS) {
                    console.log("✅ Transaction confirmed successfully!");
                    console.log("Ledger:", status.ledger);
                    console.log("Created At:", status.createdAt);
                }
                else if ((status === null || status === void 0 ? void 0 : status.status) === index_1.TransactionStatus.FAILED) {
                    console.error("❌ Transaction failed:", status.errorMessage);
                }
                else if ((status === null || status === void 0 ? void 0 : status.status) === index_1.TransactionStatus.TIMEOUT) {
                    console.warn("⏱️ Transaction confirmation timeout");
                }
            }
        }
        catch (error) {
            console.error("Error:", error);
        }
    });
}
// Example 2: Standalone Transaction Tracker
function standaloneTrackerExample() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("\n=== Example 2: Standalone Transaction Tracker ===\n");
        // Create a standalone tracker
        const tracker = (0, index_1.createTransactionTracker)({
            network: "testnet",
            maxRetries: 30,
            retryInterval: 2000,
            timeout: 60000,
        });
        // Track a transaction manually
        const txHash = "example_transaction_hash_123";
        tracker.trackTransaction(txHash, index_1.OperationType.BRIDGE, {
            amount: "100",
            toAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        });
        // Get transaction status
        const status = yield tracker.getTransactionStatus(txHash);
        console.log("Transaction Status:", status);
        // Get all tracked transactions
        const allTracked = tracker.getTrackedTransactions();
        console.log(`\nTotal tracked transactions: ${allTracked.size}`);
        // Filter by operation type
        const bridgeTxs = tracker.getTransactionsByType(index_1.OperationType.BRIDGE);
        console.log(`Bridge transactions: ${bridgeTxs.length}`);
    });
}
// Example 3: Monitor Multiple Transactions
function multipleTransactionsExample() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("\n=== Example 3: Monitor Multiple Transactions ===\n");
        const tracker = new index_1.TransactionTracker({
            network: "testnet",
            maxRetries: 20,
            retryInterval: 1500,
        });
        // Simulate multiple transaction hashes
        const txHashes = [
            "hash_1_swap",
            "hash_2_bridge",
            "hash_3_lp_deposit",
        ];
        // Track all transactions
        tracker.trackTransaction(txHashes[0], index_1.OperationType.SWAP);
        tracker.trackTransaction(txHashes[1], index_1.OperationType.BRIDGE);
        tracker.trackTransaction(txHashes[2], index_1.OperationType.LP_DEPOSIT);
        // Monitor all transactions simultaneously
        console.log("Monitoring multiple transactions...");
        const statuses = yield tracker.monitorTransactions(txHashes, index_1.OperationType.SWAP // Default operation type for monitoring
        );
        // Display results
        statuses.forEach((status, index) => {
            console.log(`\nTransaction ${index + 1}:`);
            console.log(`  Hash: ${status.hash}`);
            console.log(`  Status: ${status.status}`);
            console.log(`  Operation: ${status.operationType}`);
            console.log(`  Retry Count: ${status.retryCount}`);
            console.log(`  Elapsed Time: ${status.elapsedTime}ms`);
        });
    });
}
// Example 4: Network Switching
function networkSwitchingExample() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("\n=== Example 4: Network Switching ===\n");
        const tracker = new index_1.TransactionTracker({
            network: "testnet",
        });
        console.log("Initial Network:", tracker.getNetworkInfo());
        // Track some testnet transactions
        tracker.trackTransaction("testnet_tx_1", index_1.OperationType.SWAP);
        tracker.trackTransaction("testnet_tx_2", index_1.OperationType.PAYMENT);
        // Switch to mainnet (requires proper configuration)
        tracker.updateNetwork("mainnet", "https://soroban.stellar.org");
        console.log("Updated Network:", tracker.getNetworkInfo());
        // Track mainnet transactions
        tracker.trackTransaction("mainnet_tx_1", index_1.OperationType.BRIDGE);
        // View all tracked transactions across networks
        const allTxs = tracker.getTrackedTransactions();
        console.log(`\nTotal transactions tracked: ${allTxs.size}`);
    });
}
// Example 5: Error Handling and Status Checking
function errorHandlingExample() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("\n=== Example 5: Error Handling ===\n");
        const tracker = new index_1.TransactionTracker({
            network: "testnet",
            timeout: 10000, // 10 second timeout
        });
        // Try to get status of non-existent transaction
        const nonExistentStatus = yield tracker.getTransactionStatus("non_existent_hash_xyz");
        console.log("Non-existent transaction status:", nonExistentStatus.status);
        console.log("Error message:", nonExistentStatus.errorMessage);
        // Handle different status types
        const handleTransactionStatus = (status) => {
            switch (status.status) {
                case index_1.TransactionStatus.SUCCESS:
                    console.log("✅ Transaction successful!");
                    break;
                case index_1.TransactionStatus.FAILED:
                    console.error("❌ Transaction failed:", status.errorMessage);
                    break;
                case index_1.TransactionStatus.PENDING:
                    console.log("⏳ Transaction pending...");
                    break;
                case index_1.TransactionStatus.NOT_FOUND:
                    console.warn("🔍 Transaction not found on network");
                    break;
                case index_1.TransactionStatus.TIMEOUT:
                    console.warn("⏱️ Transaction confirmation timeout");
                    break;
                default:
                    console.log("Unknown status:", status.status);
            }
        };
        handleTransactionStatus(nonExistentStatus);
    });
}
// Example 6: Using with AgentClient Operations
function agentClientIntegrationExample() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("\n=== Example 6: AgentClient Integration ===\n");
        const agent = new index_1.AgentClient({
            network: "testnet",
            publicKey: process.env.STELLAR_PUBLIC_KEY,
            enableTracking: true,
        });
        // Get the tracker instance
        const tracker = agent.getTracker();
        if (tracker) {
            console.log("Tracker enabled!");
            console.log("Network Info:", tracker.getNetworkInfo());
            // Perform operations and track them
            // Example: Bridge operation
            try {
                const bridgeResult = yield agent.bridge({
                    amount: "50",
                    toAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
                });
                console.log("Bridge Result:", bridgeResult);
                // If bridge returns a hash, you can track it
                if (bridgeResult && typeof bridgeResult === "object" && "hash" in bridgeResult) {
                    const hash = bridgeResult.hash;
                    tracker.trackTransaction(hash, index_1.OperationType.BRIDGE);
                    // Check status later
                    setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                        const status = yield tracker.getTransactionStatus(hash);
                        console.log("Bridge Status:", status);
                    }), 5000);
                }
            }
            catch (error) {
                console.error("Bridge error:", error);
            }
        }
        else {
            console.log("Tracker is disabled");
        }
    });
}
// Example 7: Transaction History and Filtering
function transactionHistoryExample() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("\n=== Example 7: Transaction History ===\n");
        const tracker = new index_1.TransactionTracker({
            network: "testnet",
        });
        // Simulate various operations
        tracker.trackTransaction("swap_1", index_1.OperationType.SWAP, {
            amount: "100",
            buyA: true,
        });
        tracker.trackTransaction("swap_2", index_1.OperationType.SWAP, {
            amount: "200",
            buyA: false,
        });
        tracker.trackTransaction("bridge_1", index_1.OperationType.BRIDGE, {
            amount: "50",
            toAddress: "0xabc...",
        });
        tracker.trackTransaction("lp_deposit_1", index_1.OperationType.LP_DEPOSIT, {
            desiredA: "1000",
            desiredB: "1000",
        });
        tracker.trackTransaction("lp_withdraw_1", index_1.OperationType.LP_WITHDRAW, {
            shareAmount: "100",
        });
        // Get all transactions
        const allTxs = tracker.getTrackedTransactions();
        console.log(`Total transactions: ${allTxs.size}`);
        // Filter by operation type
        const swapTxs = tracker.getTransactionsByType(index_1.OperationType.SWAP);
        console.log(`\nSwap transactions: ${swapTxs.length}`);
        swapTxs.forEach((tx) => {
            console.log(`  - ${tx.hash}:`, tx.metadata.params);
        });
        const bridgeTxs = tracker.getTransactionsByType(index_1.OperationType.BRIDGE);
        console.log(`\nBridge transactions: ${bridgeTxs.length}`);
        const lpTxs = [
            ...tracker.getTransactionsByType(index_1.OperationType.LP_DEPOSIT),
            ...tracker.getTransactionsByType(index_1.OperationType.LP_WITHDRAW),
        ];
        console.log(`\nLP transactions: ${lpTxs.length}`);
        // Clear tracking history
        tracker.clearTracking();
        console.log(`\nAfter clearing: ${tracker.getTrackedTransactions().size} transactions`);
    });
}
// Run examples
function runExamples() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🚀 Stellar AgentKit - Transaction Tracking Examples");
        console.log("=".repeat(60));
        // Uncomment the examples you want to run:
        // await basicTrackingExample();
        yield standaloneTrackerExample();
        yield multipleTransactionsExample();
        yield networkSwitchingExample();
        yield errorHandlingExample();
        // await agentClientIntegrationExample(); // Requires valid credentials
        yield transactionHistoryExample();
        console.log("\n" + "=".repeat(60));
        console.log("✅ Examples completed!");
    });
}
// Execute if run directly
if (require.main === module) {
    runExamples().catch(console.error);
}
