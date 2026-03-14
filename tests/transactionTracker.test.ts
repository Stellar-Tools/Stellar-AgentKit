import {
  TransactionTracker,
  TransactionStatus,
  OperationType,
  createTransactionTracker,
} from "../lib/transactionTracker";

describe("TransactionTracker", () => {
  let tracker: TransactionTracker;

  beforeEach(() => {
    tracker = new TransactionTracker({
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
      const defaultTracker = new TransactionTracker();
      const networkInfo = defaultTracker.getNetworkInfo();
      
      expect(networkInfo.network).toBe("testnet");
      expect(networkInfo.rpcUrl).toBeDefined();
    });

    test("should initialize with custom configuration", () => {
      const customTracker = new TransactionTracker({
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
      
      const envTracker = new TransactionTracker({ network: "testnet" });
      const networkInfo = envTracker.getNetworkInfo();
      
      expect(networkInfo.rpcUrl).toBe("https://env-rpc.stellar.org");
      
      process.env.SRB_PROVIDER_URL = originalEnv;
    });
  });

  describe("Transaction Tracking", () => {
    test("should track a new transaction", () => {
      const hash = "test_hash_123";
      tracker.trackTransaction(hash, OperationType.SWAP, { amount: "100" });
      
      const tracked = tracker.getTrackedTransactions();
      expect(tracked.has(hash)).toBe(true);
      expect(tracked.get(hash)?.operationType).toBe(OperationType.SWAP);
    });

    test("should track multiple transactions", () => {
      tracker.trackTransaction("hash1", OperationType.SWAP);
      tracker.trackTransaction("hash2", OperationType.BRIDGE);
      tracker.trackTransaction("hash3", OperationType.LP_DEPOSIT);
      
      const tracked = tracker.getTrackedTransactions();
      expect(tracked.size).toBe(3);
    });

    test("should clear tracking history", () => {
      tracker.trackTransaction("hash1", OperationType.SWAP);
      tracker.trackTransaction("hash2", OperationType.BRIDGE);
      
      expect(tracker.getTrackedTransactions().size).toBe(2);
      
      tracker.clearTracking();
      expect(tracker.getTrackedTransactions().size).toBe(0);
    });
  });

  describe("Transaction Filtering", () => {
    beforeEach(() => {
      tracker.trackTransaction("swap1", OperationType.SWAP);
      tracker.trackTransaction("swap2", OperationType.SWAP);
      tracker.trackTransaction("bridge1", OperationType.BRIDGE);
      tracker.trackTransaction("lp1", OperationType.LP_DEPOSIT);
    });

    test("should filter transactions by operation type", () => {
      const swapTxs = tracker.getTransactionsByType(OperationType.SWAP);
      expect(swapTxs.length).toBe(2);
      expect(swapTxs.every(tx => tx.metadata.operationType === OperationType.SWAP)).toBe(true);
    });

    test("should return empty array for non-existent operation type", () => {
      const stakeTxs = tracker.getTransactionsByType(OperationType.STAKE);
      expect(stakeTxs.length).toBe(0);
    });

    test("should return all transactions of a specific type", () => {
      const bridgeTxs = tracker.getTransactionsByType(OperationType.BRIDGE);
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
      tracker.trackTransaction("hash1", OperationType.SWAP);
      tracker.updateNetwork("mainnet");
      
      const tracked = tracker.getTrackedTransactions();
      expect(tracked.size).toBe(1);
    });
  });

  describe("Transaction Status Response", () => {
    test("should return NOT_FOUND status for non-existent transaction", async () => {
      const status = await tracker.getTransactionStatus("non_existent_hash");
      
      expect(status.status).toBe(TransactionStatus.NOT_FOUND);
      expect(status.hash).toBe("non_existent_hash");
      expect(status.network).toBe("testnet");
    });

    test("should include metadata in status response", async () => {
      const hash = "test_hash";
      tracker.trackTransaction(hash, OperationType.SWAP, { amount: "100" });
      
      const status = await tracker.getTransactionStatus(hash);
      expect(status.operationType).toBe(OperationType.SWAP);
    });
  });

  describe("Factory Function", () => {
    test("should create tracker using factory function", () => {
      const factoryTracker = createTransactionTracker({
        network: "testnet",
        maxRetries: 10,
      });
      
      expect(factoryTracker).toBeInstanceOf(TransactionTracker);
      const networkInfo = factoryTracker.getNetworkInfo();
      expect(networkInfo.network).toBe("testnet");
    });

    test("should create tracker with default config", () => {
      const defaultFactoryTracker = createTransactionTracker();
      expect(defaultFactoryTracker).toBeInstanceOf(TransactionTracker);
    });
  });

  describe("Operation Types", () => {
    test("should support all operation types", () => {
      const operations = [
        OperationType.SWAP,
        OperationType.BRIDGE,
        OperationType.LP_DEPOSIT,
        OperationType.LP_WITHDRAW,
        OperationType.PAYMENT,
        OperationType.STAKE,
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
      
      tracker.trackTransaction("hash1", OperationType.SWAP, params);
      const tracked = tracker.getTrackedTransactions();
      const metadata = tracked.get("hash1");
      
      expect(metadata?.params).toEqual(params);
    });

    test("should store timestamp", () => {
      const beforeTime = Date.now();
      tracker.trackTransaction("hash1", OperationType.SWAP);
      const afterTime = Date.now();
      
      const tracked = tracker.getTrackedTransactions();
      const metadata = tracked.get("hash1");
      
      expect(metadata?.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(metadata?.timestamp).toBeLessThanOrEqual(afterTime);
    });

    test("should store network information", () => {
      tracker.trackTransaction("hash1", OperationType.SWAP);
      const tracked = tracker.getTrackedTransactions();
      const metadata = tracked.get("hash1");
      
      expect(metadata?.network).toBe("testnet");
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid transaction hash gracefully", async () => {
      const status = await tracker.getTransactionStatus("");
      expect(status.status).toBeDefined();
    });

    test("should handle network errors gracefully", async () => {
      const offlineTracker = new TransactionTracker({
        network: "testnet",
        rpcUrl: "https://invalid-url-that-does-not-exist.stellar.org",
      });
      
      const status = await offlineTracker.getTransactionStatus("test_hash");
      expect(status.status).toBe(TransactionStatus.FAILED);
      expect(status.errorMessage).toBeDefined();
    });
  });

  describe("Transaction Status Types", () => {
    test("should have all required status types", () => {
      expect(TransactionStatus.PENDING).toBe("PENDING");
      expect(TransactionStatus.SUCCESS).toBe("SUCCESS");
      expect(TransactionStatus.FAILED).toBe("FAILED");
      expect(TransactionStatus.NOT_FOUND).toBe("NOT_FOUND");
      expect(TransactionStatus.TIMEOUT).toBe("TIMEOUT");
    });
  });
});
