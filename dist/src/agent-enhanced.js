"use strict";
/**
 * Updated AgentClient with comprehensive validation and error handling
 *
 * This demonstrates the integration of the new validation and error handling framework.
 * Can be used to replace or augment the existing agent.ts file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentClient = void 0;
const contract_1 = require("../lib/contract");
const bridge_1 = require("../tools/bridge");
const validation_1 = require("../src/validation");
const errors_1 = require("../src/errors");
const handlers_1 = require("../src/errors/handlers");
class AgentClient {
    constructor(config) {
        // Validate network
        try {
            this.network = (0, validation_1.validateNetwork)(config.network);
        }
        catch (error) {
            throw new errors_1.InvalidNetworkError(String(config.network));
        }
        // Mainnet safety check
        if (this.network === "mainnet" && !config.allowMainnet) {
            throw new errors_1.OperationNotAllowedError("mainnet operation", "Mainnet operations require explicit opt-in for safety", {}, "Set allowMainnet: true in your config to enable mainnet operations");
        }
        // Warning for mainnet usage
        if (this.network === "mainnet" && config.allowMainnet) {
            console.warn("\n⚠️  WARNING: STELLAR MAINNET ACTIVE ⚠️\n" +
                "You are executing transactions on Stellar mainnet.\n" +
                "Real funds will be used. Double-check all parameters before proceeding.\n");
        }
        this.publicKey = config.publicKey || process.env.STELLAR_PUBLIC_KEY || "";
        this.rpcUrl = config.rpcUrl;
        this.validateInput = config.validateInput !== false;
        // Auto-retry for reads is safe (idempotent)
        // Auto-retry for writes requires explicit opt-in (dangerous if not idempotent)
        // These are independently configurable
        this.autoRetry = config.autoRetry === true; // Enable for safe read operations
        this.allowRetryOnWrites = config.allowRetryOnWrites === true; // Separate control for write retries
    }
    /**
     * Perform a swap on the Stellar network with full validation
     */
    async swap(params) {
        if (this.validateInput) {
            params = (0, validation_1.validateSwapParams)(params);
        }
        return await this.executeWriteWithRetry(() => (0, contract_1.swap)(params.to, params.buyA, params.out, params.inMax, this.network));
    }
    /**
     * Perform a bridge operation with validation
     */
    async bridge(params) {
        if (this.validateInput) {
            params = (0, validation_1.validateBridgeParams)(params);
        }
        // Check if bridge operations are allowed on mainnet
        if (this.network === "mainnet" && process.env.ALLOW_MAINNET_BRIDGE !== "true") {
            throw new errors_1.OperationNotAllowedError("bridge", "Mainnet bridging requires additional security approval", {}, "Set ALLOW_MAINNET_BRIDGE=true in your .env file");
        }
        return await this.executeWriteWithRetry(() => bridge_1.bridgeTokenTool.func({
            ...params,
            ...(this.rpcUrl ? { rpcUrl: this.rpcUrl } : {}),
        }));
    }
    /**
     * Liquidity pool operations
     */
    get lp() {
        return {
            deposit: async (params) => {
                if (this.validateInput) {
                    params = (0, validation_1.validateDepositParams)(params);
                }
                return await this.executeWriteWithRetry(() => (0, contract_1.deposit)(params.to, params.desiredA, params.minA, params.desiredB, params.minB, this.network));
            },
            withdraw: async (params) => {
                if (this.validateInput) {
                    params = (0, validation_1.validateWithdrawParams)(params);
                }
                return await this.executeWriteWithRetry(() => (0, contract_1.withdraw)(params.to, params.shareAmount, params.minA, params.minB, this.network));
            },
            getReserves: async () => {
                return await this.executeWithRetry(() => (0, contract_1.getReserves)(this.network));
            },
            getShareId: async () => {
                return await this.executeWithRetry(() => (0, contract_1.getShareId)(this.network));
            },
        };
    }
    /**
     * Execute read-only operation with optional retry logic
     * Retries are safe for read-only operations (idempotent)
     */
    async executeWithRetry(operation) {
        if (this.autoRetry) {
            return await (0, handlers_1.retryWithBackoff)(operation, {
                maxAttempts: 3,
                initialDelayMs: 100,
            });
        }
        return await operation();
    }
    /**
     * Execute write operation with optional retry logic
     * WARNING: Retries for write operations can cause duplicate transactions
     * Only enable if the operation is idempotent or you have duplicate detection
     */
    async executeWriteWithRetry(operation) {
        // For write operations, both autoRetry AND allowRetryOnWrites must be true
        if (this.autoRetry && this.allowRetryOnWrites) {
            console.warn("⚠️ WARNING: Executing write operation with retry enabled. " +
                "This can cause duplicate transactions if the operation is not idempotent. " +
                "Ensure you have duplicate detection or idempotent operations before enabling this.");
            return await (0, handlers_1.retryWithBackoff)(operation, {
                maxAttempts: 3,
                initialDelayMs: 100,
            });
        }
        return await operation();
    }
    /**
     * Get network info
     */
    getNetwork() {
        return this.network;
    }
    /**
     * Get configured RPC URL, if any
     */
    getRpcUrl() {
        return this.rpcUrl;
    }
    /**
     * Get public key
     */
    getPublicKey() {
        return this.publicKey;
    }
}
exports.AgentClient = AgentClient;
