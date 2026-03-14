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
exports.AgentClient = void 0;
const contract_1 = require("./lib/contract");
const bridge_1 = require("./tools/bridge");
const transactionTracker_1 = require("./lib/transactionTracker");
class AgentClient {
    constructor(config) {
        /**
         * Liquidity Pool operations.
         */
        this.lp = {
            deposit: (params) => __awaiter(this, void 0, void 0, function* () {
                return yield (0, contract_1.deposit)(this.publicKey, params.to, params.desiredA, params.minA, params.desiredB, params.minB);
            }),
            withdraw: (params) => __awaiter(this, void 0, void 0, function* () {
                return yield (0, contract_1.withdraw)(this.publicKey, params.to, params.shareAmount, params.minA, params.minB);
            }),
            getReserves: () => __awaiter(this, void 0, void 0, function* () {
                return yield (0, contract_1.getReserves)(this.publicKey);
            }),
            getShareId: () => __awaiter(this, void 0, void 0, function* () {
                return yield (0, contract_1.getShareId)(this.publicKey);
            }),
        };
        // Mainnet safety check for general operations
        if (config.network === "mainnet" && !config.allowMainnet) {
            throw new Error(" Mainnet execution blocked for safety.\n" +
                "Stellar AgentKit requires explicit opt-in for mainnet operations to prevent accidental use of real funds.\n" +
                "To enable mainnet, set allowMainnet: true in your config:\n" +
                "  new AgentClient({ network: 'mainnet', allowMainnet: true, ... })");
        }
        // Warning for mainnet usage (when opted in)
        if (config.network === "mainnet" && config.allowMainnet) {
            console.warn("\n⚠️  WARNING: STELLAR MAINNET ACTIVE ⚠️\n" +
                "You are executing transactions on Stellar mainnet.\n" +
                "Real funds will be used. Double-check all parameters before proceeding.\n");
        }
        this.network = config.network;
        this.publicKey = config.publicKey || process.env.STELLAR_PUBLIC_KEY || "";
        // Initialize transaction tracker if enabled
        if (config.enableTracking !== false) {
            this.tracker = new transactionTracker_1.TransactionTracker({
                network: config.network,
                rpcUrl: config.rpcUrl,
            });
        }
        else {
            this.tracker = null;
        }
        if (!this.publicKey && this.network === "testnet") {
            // In a real SDK, we might not throw here if only read-only methods are used,
            // but for this implementation, we'll assume it's needed for most actions.
        }
    }
    /**
     * Perform a swap on the Stellar network.
     * @param params Swap parameters
     */
    swap(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, contract_1.swap)(this.publicKey, params.to, params.buyA, params.out, params.inMax);
        });
    }
    /**
     * Bridge tokens from Stellar to EVM compatible chains.
     *
     * ⚠️ IMPORTANT: Mainnet bridging requires BOTH:
     * 1. AgentClient initialized with allowMainnet: true
     * 2. ALLOW_MAINNET_BRIDGE=true in your .env file
     *
     * This dual-safeguard approach prevents accidental mainnet bridging.
     *
     * @param params Bridge parameters
     * @returns Bridge transaction result with status, hash, and network
     */
    bridge(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield bridge_1.bridgeTokenTool.func(Object.assign(Object.assign({}, params), { fromNetwork: this.network === "mainnet"
                    ? "stellar-mainnet"
                    : "stellar-testnet" }));
        });
    }
    /**
     * Get transaction status
     *
     * @param hash - Transaction hash to query
     * @returns Transaction status details
     */
    getTransactionStatus(hash) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.tracker) {
                throw new Error("Transaction tracking is disabled. Enable it by setting enableTracking: true in AgentConfig.");
            }
            return yield this.tracker.getTransactionStatus(hash);
        });
    }
    /**
     * Wait for transaction confirmation
     *
     * @param hash - Transaction hash to monitor
     * @param operationType - Type of operation
     * @returns Final transaction status
     */
    waitForConfirmation(hash, operationType) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.tracker) {
                throw new Error("Transaction tracking is disabled. Enable it by setting enableTracking: true in AgentConfig.");
            }
            return yield this.tracker.waitForConfirmation(hash, operationType);
        });
    }
    /**
     * Monitor multiple transactions
     *
     * @param hashes - Array of transaction hashes
     * @param operationType - Type of operation
     * @returns Array of transaction statuses
     */
    monitorTransactions(hashes, operationType) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.tracker) {
                throw new Error("Transaction tracking is disabled. Enable it by setting enableTracking: true in AgentConfig.");
            }
            return yield this.tracker.monitorTransactions(hashes, operationType);
        });
    }
    /**
     * Get transaction tracker instance
     *
     * @returns TransactionTracker instance or null if disabled
     */
    getTracker() {
        return this.tracker;
    }
}
exports.AgentClient = AgentClient;
