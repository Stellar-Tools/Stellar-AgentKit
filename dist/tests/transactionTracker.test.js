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
const transactionTracker_1 = require("../lib/transactionTracker");
describe("TransactionTracker", () => {
    let tracker;
    beforeEach(() => {
        tracker = new transactionTracker_1.TransactionTracker({
            network: "testnet",
            maxRetries: 5,
            retryInterval: 100,
            timeout: 5000,
        });
    });
    afterEach(() => {
        tracker.clearTracking();
    });
    describe("Constructor and Configuration", () => {
        test("should initialize with default configuration", () => {
            const defaultTracker = new transactionTracker_1.TransactionTracker();
            const networkInfo = defaultTracker.getNetworkInfo();
            expect(networkInfo.network).toBe("testnet");
            expect(networkInfo.rpcUrl).toBeDefined();
        });
        test("should initialize with custom configuration", () => {
            const customTracker = new transactionTracker_1.TransactionTracker({
                network: "mainnet",
                rpcUrl: "https://custom-rpc.stellar.org",
            });
            const networkInfo = customTracker.getNetworkInfo();
            expect(networkInfo.network).toBe("mainnet");
            expect(networkInfo.rpcUrl).toBe("https://custom-rpc.stellar.org");
        });
        test("should use environment variables for RPC URL", () => {
            const originalEnv = process.env.SRB_PROVIDER_URL;
            process.env.SRB_PROVIDER_URL = "https://env-rpc.stellar.org";
            const envTracker = new transactionTracker_1.TransactionTracker({ network: "testnet" });
            const networkInfo = envTracker.getNetworkInfo();
            expect(networkInfo.rpcUrl).toBe("https://env-rpc.stellar.org");
            process.env.SRB_PROVIDER_URL = originalEnv;
        });
    });
    describe("Transaction Tracking", () => {
        test("should track a new transaction", () => {
            var _a;
            const hash = "test_hash_123";
            tracker.trackTransaction(hash, transactionTracker_1.OperationType.SWAP, { amount: "100" });
            const tracked = tracker.getTrackedTransactions();
            expect(tracked.has(hash)).toBe(true);
            expect((_a = tracked.get(hash)) === null || _a === void 0 ? void 0 : _a.operationType).toBe(transactionTracker_1.OperationType.SWAP);
        });
        test("should track multiple transactions", () => {
            tracker.trackTransaction("hash1", transactionTracker_1.OperationType.SWAP);
            tracker.trackTransaction("hash2", transactionTracker_1.OperationType.BRIDGE);
            tracker.trackTransaction("hash3", transactionTracker_1.OperationType.LP_DEPOSIT);
            const tracked = tracker.getTrackedTransactions();
            expect(tracked.size).toBe(3);
        });
        test("should clear tracking history", () => {
            tracker.trackTransaction("hash1", transactionTracker_1.OperationType.SWAP);
            tracker.trackTransaction("hash2", transactionTracker_1.OperationType.BRIDGE);
            expect(tracker.getTrackedTransactions().size).toBe(2);
            tracker.clearTracking();
            expect(tracker.getTrackedTransactions().size).toBe(0);
        });
    });
    describe("Transaction Filtering", () => {
        beforeEach(() => {
            tracker.trackTransaction("swap1", transactionTracker_1.OperationType.SWAP);
            tracker.trackTransaction("swap2", transactionTracker_1.OperationType.SWAP);
            tracker.trackTransaction("bridge1", transactionTracker_1.OperationType.BRIDGE);
            tracker.trackTransaction("lp1", transactionTracker_1.OperationType.LP_DEPOSIT);
        });
        test("should filter transactions by operation type", () => {
            const swapTxs = tracker.getTransactionsByType(transactionTracker_1.OperationType.SWAP);
            expect(swapTxs.length).toBe(2);
            expect(swapTxs.every(tx => tx.metadata.operationType === transactionTracker_1.OperationType.SWAP)).toBe(true);
        });
        test("should return empty array for non-existent operation type", () => {
            const stakeTxs = tracker.getTransactionsByType(transactionTracker_1.OperationType.STAKE);
            expect(stakeTxs.length).toBe(0);
        });
        test("should return all transactions of a specific type", () => {
            const bridgeTxs = tracker.getTransactionsByType(transactionTracker_1.OperationType.BRIDGE);
            expect(bridgeTxs.length).toBe(1);
            expect(bridgeTxs[0].hash).toBe("bridge1");
        });
    });
    describe("Network Management", () => {
        test("should update network configuration", () => {
            tracker.updateNetwork("mainnet");
            const networkInfo = tracker.getNetworkInfo();
            expect(networkInfo.network).toBe("mainnet");
        });
        test("should update network with custom RPC URL", () => {
            tracker.updateNetwork("mainnet", "https://custom-mainnet.stellar.org");
            const networkInfo = tracker.getNetworkInfo();
            expect(networkInfo.network).toBe("mainnet");
            expect(networkInfo.rpcUrl).toBe("https://custom-mainnet.stellar.org");
        });
        test("should maintain tracked transactions after network update", () => {
            tracker.trackTransaction("hash1", transactionTracker_1.OperationType.SWAP);
            tracker.updateNetwork("mainnet");
            const tracked = tracker.getTrackedTransactions();
            expect(tracked.size).toBe(1);
        });
    });
    describe("Transaction Status Response", () => {
        test("should return NOT_FOUND status for non-existent transaction", () => __awaiter(void 0, void 0, void 0, function* () {
            const status = yield tracker.getTransactionStatus("non_existent_hash");
            expect(status.status).toBe(transactionTracker_1.TransactionStatus.NOT_FOUND);
            expect(status.hash).toBe("non_existent_hash");
            expect(status.network).toBe("testnet");
        }));
        test("should include metadata in status response", () => __awaiter(void 0, void 0, void 0, function* () {
            const hash = "test_hash";
            tracker.trackTransaction(hash, transactionTracker_1.OperationType.SWAP, { amount: "100" });
            const status = yield tracker.getTransactionStatus(hash);
            expect(status.operationType).toBe(transactionTracker_1.OperationType.SWAP);
        }));
    });
    describe("Factory Function", () => {
        test("should create tracker using factory function", () => {
            const factoryTracker = (0, transactionTracker_1.createTransactionTracker)({
                network: "testnet",
                maxRetries: 10,
            });
            expect(factoryTracker).toBeInstanceOf(transactionTracker_1.TransactionTracker);
            const networkInfo = factoryTracker.getNetworkInfo();
            expect(networkInfo.network).toBe("testnet");
        });
        test("should create tracker with default config", () => {
            const defaultFactoryTracker = (0, transactionTracker_1.createTransactionTracker)();
            expect(defaultFactoryTracker).toBeInstanceOf(transactionTracker_1.TransactionTracker);
        });
    });
    describe("Operation Types", () => {
        test("should support all operation types", () => {
            const operations = [
                transactionTracker_1.OperationType.SWAP,
                transactionTracker_1.OperationType.BRIDGE,
                transactionTracker_1.OperationType.LP_DEPOSIT,
                transactionTracker_1.OperationType.LP_WITHDRAW,
                transactionTracker_1.OperationType.PAYMENT,
                transactionTracker_1.OperationType.STAKE,
            ];
            operations.forEach((op, index) => {
                tracker.trackTransaction(`hash_${index}`, op);
            });
            const tracked = tracker.getTrackedTransactions();
            expect(tracked.size).toBe(operations.length);
        });
    });
    describe("Transaction Metadata", () => {
        test("should store transaction parameters", () => {
            const params = {
                amount: "100",
                recipient: "GXXX...",
                asset: "USDC",
            };
            tracker.trackTransaction("hash1", transactionTracker_1.OperationType.SWAP, params);
            const tracked = tracker.getTrackedTransactions();
            const metadata = tracked.get("hash1");
            expect(metadata === null || metadata === void 0 ? void 0 : metadata.params).toEqual(params);
        });
        test("should store timestamp", () => {
            const beforeTime = Date.now();
            tracker.trackTransaction("hash1", transactionTracker_1.OperationType.SWAP);
            const afterTime = Date.now();
            const tracked = tracker.getTrackedTransactions();
            const metadata = tracked.get("hash1");
            expect(metadata === null || metadata === void 0 ? void 0 : metadata.timestamp).toBeGreaterThanOrEqual(beforeTime);
            expect(metadata === null || metadata === void 0 ? void 0 : metadata.timestamp).toBeLessThanOrEqual(afterTime);
        });
        test("should store network information", () => {
            tracker.trackTransaction("hash1", transactionTracker_1.OperationType.SWAP);
            const tracked = tracker.getTrackedTransactions();
            const metadata = tracked.get("hash1");
            expect(metadata === null || metadata === void 0 ? void 0 : metadata.network).toBe("testnet");
        });
    });
    describe("Error Handling", () => {
        test("should handle invalid transaction hash gracefully", () => __awaiter(void 0, void 0, void 0, function* () {
            const status = yield tracker.getTransactionStatus("");
            expect(status.status).toBeDefined();
        }));
        test("should handle network errors gracefully", () => __awaiter(void 0, void 0, void 0, function* () {
            const offlineTracker = new transactionTracker_1.TransactionTracker({
                network: "testnet",
                rpcUrl: "https://invalid-url-that-does-not-exist.stellar.org",
            });
            const status = yield offlineTracker.getTransactionStatus("test_hash");
            expect(status.status).toBe(transactionTracker_1.TransactionStatus.FAILED);
            expect(status.errorMessage).toBeDefined();
        }));
    });
    describe("Transaction Status Types", () => {
        test("should have all required status types", () => {
            expect(transactionTracker_1.TransactionStatus.PENDING).toBe("PENDING");
            expect(transactionTracker_1.TransactionStatus.SUCCESS).toBe("SUCCESS");
            expect(transactionTracker_1.TransactionStatus.FAILED).toBe("FAILED");
            expect(transactionTracker_1.TransactionStatus.NOT_FOUND).toBe("NOT_FOUND");
            expect(transactionTracker_1.TransactionStatus.TIMEOUT).toBe("TIMEOUT");
        });
    });
});
