"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.TransactionTracker = exports.OperationType = exports.TransactionStatus = void 0;
exports.createTransactionTracker = createTransactionTracker;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: ".env" });
/**
 * Transaction status types
 */
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["PENDING"] = "PENDING";
    TransactionStatus["SUCCESS"] = "SUCCESS";
    TransactionStatus["FAILED"] = "FAILED";
    TransactionStatus["NOT_FOUND"] = "NOT_FOUND";
    TransactionStatus["TIMEOUT"] = "TIMEOUT";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
/**
 * Operation types for transaction tracking
 */
var OperationType;
(function (OperationType) {
    OperationType["SWAP"] = "swap";
    OperationType["BRIDGE"] = "bridge";
    OperationType["LP_DEPOSIT"] = "lp_deposit";
    OperationType["LP_WITHDRAW"] = "lp_withdraw";
    OperationType["PAYMENT"] = "payment";
    OperationType["STAKE"] = "stake";
})(OperationType || (exports.OperationType = OperationType = {}));
/**
 * Transaction Tracker Class
 *
 * Provides comprehensive transaction monitoring and status tracking
 * for all Stellar operations including swap, bridge, LP, and payment operations.
 */
class TransactionTracker {
    constructor(config = {}) {
        this.maxRetries = config.maxRetries || 30;
        this.retryInterval = config.retryInterval || 2000; // 2 seconds
        this.timeout = config.timeout || 60000; // 60 seconds
        this.network = config.network || "testnet";
        // Set RPC URL based on network
        if (config.rpcUrl) {
            this.rpcUrl = config.rpcUrl;
        }
        else {
            this.rpcUrl = this.network === "mainnet"
                ? process.env.SRB_MAINNET_PROVIDER_URL || "https://soroban.stellar.org"
                : process.env.SRB_PROVIDER_URL || "https://soroban-testnet.stellar.org";
        }
        this.server = new stellar_sdk_1.rpc.Server(this.rpcUrl, { allowHttp: true });
        this.trackedTransactions = new Map();
    }
    /**
     * Track a new transaction
     *
     * @param hash - Transaction hash
     * @param operationType - Type of operation
     * @param params - Optional parameters associated with the transaction
     */
    trackTransaction(hash, operationType, params) {
        this.trackedTransactions.set(hash, {
            operationType,
            network: this.network,
            timestamp: Date.now(),
            params,
        });
    }
    /**
     * Get transaction status with detailed information
     *
     * @param hash - Transaction hash to query
     * @returns Detailed transaction status
     */
    getTransactionStatus(hash) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const metadata = this.trackedTransactions.get(hash);
            const operationType = (metadata === null || metadata === void 0 ? void 0 : metadata.operationType) || OperationType.PAYMENT;
            try {
                const txResponse = yield this.server.getTransaction(hash);
                if (txResponse.status === stellar_sdk_1.rpc.Api.GetTransactionStatus.NOT_FOUND) {
                    return {
                        hash,
                        status: TransactionStatus.NOT_FOUND,
                        network: this.network,
                        operationType,
                        errorMessage: "Transaction not found on the network",
                    };
                }
                if (txResponse.status === stellar_sdk_1.rpc.Api.GetTransactionStatus.SUCCESS) {
                    const response = {
                        hash,
                        status: TransactionStatus.SUCCESS,
                        network: this.network,
                        operationType,
                        ledger: txResponse.ledger,
                        createdAt: txResponse.createdAt,
                        applicationOrder: txResponse.applicationOrder,
                        envelopeXdr: (_a = txResponse.envelopeXdr) === null || _a === void 0 ? void 0 : _a.toString(),
                        resultXdr: (_b = txResponse.resultXdr) === null || _b === void 0 ? void 0 : _b.toString(),
                        resultMetaXdr: (_c = txResponse.resultMetaXdr) === null || _c === void 0 ? void 0 : _c.toString(),
                    };
                    // Parse return value if available
                    if (txResponse.returnValue) {
                        try {
                            response.returnValue = this.parseReturnValue(txResponse.returnValue);
                        }
                        catch (error) {
                            console.warn("Failed to parse return value:", error);
                        }
                    }
                    return response;
                }
                if (txResponse.status === stellar_sdk_1.rpc.Api.GetTransactionStatus.FAILED) {
                    return {
                        hash,
                        status: TransactionStatus.FAILED,
                        network: this.network,
                        operationType,
                        ledger: txResponse.ledger,
                        createdAt: txResponse.createdAt,
                        resultXdr: (_d = txResponse.resultXdr) === null || _d === void 0 ? void 0 : _d.toString(),
                        errorMessage: "Transaction failed on the network",
                    };
                }
                return {
                    hash,
                    status: TransactionStatus.PENDING,
                    network: this.network,
                    operationType,
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    hash,
                    status: TransactionStatus.FAILED,
                    network: this.network,
                    operationType,
                    errorMessage: `Failed to query transaction: ${errorMessage}`,
                };
            }
        });
    }
    /**
     * Wait for transaction confirmation with retry logic
     *
     * @param hash - Transaction hash to monitor
     * @param operationType - Type of operation
     * @returns Final transaction status
     */
    waitForConfirmation(hash, operationType) {
        return __awaiter(this, void 0, void 0, function* () {
            this.trackTransaction(hash, operationType);
            const startTime = Date.now();
            let retryCount = 0;
            while (retryCount < this.maxRetries) {
                const elapsedTime = Date.now() - startTime;
                // Check timeout
                if (elapsedTime > this.timeout) {
                    return {
                        hash,
                        status: TransactionStatus.TIMEOUT,
                        network: this.network,
                        operationType,
                        retryCount,
                        elapsedTime,
                        errorMessage: `Transaction confirmation timeout after ${this.timeout}ms`,
                    };
                }
                const status = yield this.getTransactionStatus(hash);
                status.retryCount = retryCount;
                status.elapsedTime = elapsedTime;
                // Return if transaction is in final state
                if (status.status === TransactionStatus.SUCCESS ||
                    status.status === TransactionStatus.FAILED) {
                    return status;
                }
                // Wait before next retry
                yield this.sleep(this.retryInterval);
                retryCount++;
            }
            // Max retries reached
            return {
                hash,
                status: TransactionStatus.TIMEOUT,
                network: this.network,
                operationType,
                retryCount,
                elapsedTime: Date.now() - startTime,
                errorMessage: `Max retries (${this.maxRetries}) reached without confirmation`,
            };
        });
    }
    /**
     * Monitor multiple transactions simultaneously
     *
     * @param hashes - Array of transaction hashes to monitor
     * @param operationType - Type of operation
     * @returns Array of transaction statuses
     */
    monitorTransactions(hashes, operationType) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = hashes.map((hash) => this.waitForConfirmation(hash, operationType));
            return Promise.all(promises);
        });
    }
    /**
     * Get all tracked transactions
     *
     * @returns Map of tracked transactions
     */
    getTrackedTransactions() {
        return new Map(this.trackedTransactions);
    }
    /**
     * Clear tracking history
     */
    clearTracking() {
        this.trackedTransactions.clear();
    }
    /**
     * Get transaction history for a specific operation type
     *
     * @param operationType - Type of operation to filter
     * @returns Array of transaction hashes and metadata
     */
    getTransactionsByType(operationType) {
        const results = [];
        for (const [hash, metadata] of this.trackedTransactions.entries()) {
            if (metadata.operationType === operationType) {
                results.push({ hash, metadata });
            }
        }
        return results;
    }
    /**
     * Parse return value from transaction
     *
     * @param returnValue - ScVal return value
     * @returns Parsed native value
     */
    parseReturnValue(returnValue) {
        try {
            // Import scValToNative dynamically to avoid circular dependencies
            const { scValToNative } = require("@stellar/stellar-sdk");
            return scValToNative(returnValue);
        }
        catch (error) {
            console.warn("Failed to parse return value:", error);
            return returnValue;
        }
    }
    /**
     * Sleep utility for retry logic
     *
     * @param ms - Milliseconds to sleep
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Update network configuration
     *
     * @param network - New network type
     * @param rpcUrl - Optional custom RPC URL
     */
    updateNetwork(network, rpcUrl) {
        this.network = network;
        if (rpcUrl) {
            this.rpcUrl = rpcUrl;
        }
        else {
            this.rpcUrl = network === "mainnet"
                ? process.env.SRB_MAINNET_PROVIDER_URL || "https://soroban.stellar.org"
                : process.env.SRB_PROVIDER_URL || "https://soroban-testnet.stellar.org";
        }
        this.server = new stellar_sdk_1.rpc.Server(this.rpcUrl, { allowHttp: true });
    }
    /**
     * Get network information
     *
     * @returns Current network and RPC URL
     */
    getNetworkInfo() {
        return {
            network: this.network,
            rpcUrl: this.rpcUrl,
        };
    }
}
exports.TransactionTracker = TransactionTracker;
/**
 * Create a default transaction tracker instance
 *
 * @param config - Optional configuration
 * @returns TransactionTracker instance
 */
function createTransactionTracker(config) {
    return new TransactionTracker(config);
}
