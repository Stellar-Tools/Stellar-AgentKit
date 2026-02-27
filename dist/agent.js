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
const launchToken_1 = require("./lib/launchToken");
const bridge_1 = require("./tools/bridge");
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const errors_1 = require("./lib/errors");
const stakeF_1 = require("./lib/stakeF");
const account_1 = require("./tools/account");
const trustline_1 = require("./tools/trustline");
class AgentClient {
    constructor(config) {
        /**
         * Liquidity Pool operations.
         */
        this.lp = {
            deposit: (params) => __awaiter(this, void 0, void 0, function* () {
                if (!stellar_sdk_1.StrKey.isValidEd25519PublicKey(params.to)) {
                    throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.INVALID_ADDRESS, `Invalid recipient address format: ${params.to}`, { to: params.to, operation: "lp.deposit" });
                }
                return yield (0, contract_1.deposit)(this.publicKey, params.to, params.desiredA, params.minA, params.desiredB, params.minB);
            }),
            withdraw: (params) => __awaiter(this, void 0, void 0, function* () {
                if (!stellar_sdk_1.StrKey.isValidEd25519PublicKey(params.to)) {
                    throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.INVALID_ADDRESS, `Invalid recipient address format: ${params.to}`, { to: params.to, operation: "lp.withdraw" });
                }
                return yield (0, contract_1.withdraw)(this.publicKey, params.to, params.shareAmount, params.minA, params.minB);
            }),
            getReserves: () => __awaiter(this, void 0, void 0, function* () {
                return yield (0, contract_1.getReserves)(this.publicKey);
            }),
            getShareId: () => __awaiter(this, void 0, void 0, function* () {
                return yield (0, contract_1.getShareId)(this.publicKey);
            }),
        };
        /**
         * Staking operations.
         */
        this.stake = {
            initialize: (params) => __awaiter(this, void 0, void 0, function* () {
                return yield (0, stakeF_1.initialize)(this.publicKey, params.tokenAddress, params.rewardRate);
            }),
            deposit: (amount) => __awaiter(this, void 0, void 0, function* () {
                return yield (0, stakeF_1.stake)(this.publicKey, amount);
            }),
            withdraw: (amount) => __awaiter(this, void 0, void 0, function* () {
                return yield (0, stakeF_1.unstake)(this.publicKey, amount);
            }),
            claimRewards: () => __awaiter(this, void 0, void 0, function* () {
                return yield (0, stakeF_1.claimRewards)(this.publicKey);
            }),
            getStake: (userAddress) => __awaiter(this, void 0, void 0, function* () {
                if (!stellar_sdk_1.StrKey.isValidEd25519PublicKey(userAddress)) {
                    throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.INVALID_ADDRESS, `Invalid user address format for getStake: ${userAddress}`, { to: userAddress, operation: "stake.getStake" });
                }
                return yield (0, stakeF_1.getStake)(this.publicKey, userAddress);
            }),
        };
        // Mainnet safety check for general operations
        if (config.network === "mainnet" && !config.allowMainnet) {
            throw new Error("🚫 Mainnet execution blocked for safety.\n" +
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
        this.allowMainnetTokenIssuance = config.allowMainnetTokenIssuance || false;
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
            if (!stellar_sdk_1.StrKey.isValidEd25519PublicKey(params.to)) {
                throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.INVALID_ADDRESS, `Invalid recipient address format: ${params.to}`, { to: params.to, operation: "swap" });
            }
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
            return yield bridge_1.bridgeTokenTool.func(Object.assign(Object.assign({}, params), { assetSymbol: params.assetSymbol || "USDC", fromNetwork: this.network === "mainnet"
                    ? "stellar-mainnet"
                    : "stellar-testnet" }));
        });
    }
    /**
     * Launch a Stellar token (classic asset).
     *
     * ⚠️ IMPORTANT: Mainnet issuance requires BOTH:
     * 1. AgentClient initialized with allowMainnetTokenIssuance: true
     * 2. ALLOW_MAINNET_TOKEN_ISSUANCE=true in your .env file
     *
     * @param params Issuance parameters
     * @returns Issuance result
     */
    launchToken(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!stellar_sdk_1.StrKey.isValidEd25519PublicKey(params.distributorPublicKey)) {
                throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.INVALID_ADDRESS, `Invalid distributor address format: ${params.distributorPublicKey}`, { to: params.distributorPublicKey, operation: "launchToken" });
            }
            return yield (0, launchToken_1.launchToken)(Object.assign(Object.assign({}, params), { network: this.network, allowMainnetTokenIssuance: this.allowMainnetTokenIssuance }));
        });
    }
    /**
     * Account & Asset management.
     */
    getBalances(address) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield account_1.stellarGetBalanceTool.func({
                address: address || this.publicKey,
                network: this.network,
            });
        });
    }
    ensureTrustline(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield trustline_1.stellarEnsureTrustlineTool.func(Object.assign(Object.assign({}, params), { network: this.network }));
        });
    }
}
exports.AgentClient = AgentClient;
