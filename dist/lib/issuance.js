"use strict";
/**
 * Token issuance (classic Stellar assets): issuer, distributor, trustline, mint.
 * Uses AgentKitError for all failures. Mainnet requires ALLOW_MAINNET_TOKEN_ISSUANCE=true.
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
exports.launchToken = launchToken;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const stellar_sdk_2 = require("@stellar/stellar-sdk");
const errors_1 = require("../errors");
const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
const HORIZON_MAINNET = "https://horizon.stellar.org";
const STELLAR_ADDRESS_REGEX = /^[CG][A-Z0-9]{55}$/;
function validateAddress(address, name) {
    if (!STELLAR_ADDRESS_REGEX.test(address)) {
        throw new errors_1.AgentKitError(`Invalid ${name} address format: ${address}`, "invalid_address", {
            context: { address, operation: "launchToken" },
        });
    }
}
function validateParams(params) {
    if (params.decimals < 0 || params.decimals > 7) {
        throw new errors_1.AgentKitError(`decimals must be between 0 and 7, got ${params.decimals}`, "invalid_params", { context: { operation: "launchToken", decimals: params.decimals } });
    }
    const supply = BigInt(params.initialSupply);
    if (supply <= BigInt(0)) {
        throw new errors_1.AgentKitError(`initialSupply must be positive, got ${params.initialSupply}`, "invalid_params", { context: { operation: "launchToken", initialSupply: params.initialSupply } });
    }
    if (!/^[a-zA-Z0-9]{1,12}$/.test(params.assetCode)) {
        throw new errors_1.AgentKitError(`assetCode must be 1-12 alphanumeric, got ${params.assetCode}`, "invalid_params", { context: { operation: "launchToken", assetCode: params.assetCode } });
    }
    validateAddress(params.distributorPublicKey, "distributor");
}
/**
 * Mainnet safeguard: token issuance on mainnet requires explicit env opt-in.
 */
function checkMainnetSafeguard(network) {
    if (network === "mainnet" && process.env.ALLOW_MAINNET_TOKEN_ISSUANCE !== "true") {
        throw new errors_1.AgentKitError("Mainnet token issuance is disabled. Set ALLOW_MAINNET_TOKEN_ISSUANCE=true in your .env to enable.", "network_blocked", { context: { network: "mainnet", operation: "launchToken" } });
    }
}
/**
 * Launch a classic Stellar asset: ensure distributor has trustline, then mint initial supply.
 * Idempotent: if trustline already exists, ChangeTrust is skipped or no-op; mint is a new Payment each time.
 */
function launchToken(params) {
    return __awaiter(this, void 0, void 0, function* () {
        validateParams(params);
        checkMainnetSafeguard(params.network);
        const networkPassphrase = params.network === "mainnet" ? stellar_sdk_1.Networks.PUBLIC : stellar_sdk_1.Networks.TESTNET;
        const horizonUrl = params.network === "mainnet" ? HORIZON_MAINNET : HORIZON_TESTNET;
        const server = new stellar_sdk_2.Horizon.Server(horizonUrl);
        let issuerKeypair;
        try {
            issuerKeypair = stellar_sdk_1.Keypair.fromSecret(params.issuerSecretKey);
        }
        catch (e) {
            throw new errors_1.AgentKitError("Invalid issuer secret key", "invalid_params", { context: { operation: "launchToken" }, cause: e });
        }
        const issuerPublicKey = issuerKeypair.publicKey();
        const asset = new stellar_sdk_1.Asset(params.assetCode, issuerPublicKey);
        let issuerAccount;
        try {
            issuerAccount = yield server.loadAccount(issuerPublicKey);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            throw new errors_1.AgentKitError(`Failed to load issuer account: ${msg}`, "transaction_failed", { context: { operation: "launchToken", issuerPublicKey, network: params.network }, cause: e });
        }
        let distributorAccount;
        try {
            distributorAccount = yield server.loadAccount(params.distributorPublicKey);
        }
        catch (_a) {
            // Distributor may not exist; we could create it if we had funding. For now we require it to exist.
            throw new errors_1.AgentKitError(`Distributor account not found: ${params.distributorPublicKey}. Create and fund it first.`, "invalid_address", { context: { address: params.distributorPublicKey, operation: "launchToken", network: params.network } });
        }
        // Idempotency: if trustline missing, throw with clear instructions to use getTrustlineSetupTransaction first.
        const hasTrustline = distributorAccount.balances.some((b) => b.asset_type !== "native" && b.asset_code === params.assetCode && b.asset_issuer === issuerPublicKey);
        if (!hasTrustline) {
            throw new errors_1.AgentKitError(`Distributor has no trustline for ${params.assetCode}. Use getTrustlineSetupTransaction() to get XDR for distributor to sign and submit, then retry launchToken.`, "missing_trustline", {
                context: {
                    operation: "launchToken",
                    assetCode: params.assetCode,
                    distributorPublicKey: params.distributorPublicKey,
                    issuerPublicKey,
                    network: params.network,
                },
            });
        }
        // Mint: issuer pays distributor (idempotent: each call is a new payment).
        const transaction = new stellar_sdk_1.TransactionBuilder(issuerAccount, {
            fee: stellar_sdk_1.BASE_FEE,
            networkPassphrase,
        })
            .addOperation(stellar_sdk_1.Operation.payment({
            destination: params.distributorPublicKey,
            asset,
            amount: params.initialSupply,
            source: issuerPublicKey,
        }))
            .setTimeout(30)
            .build();
        transaction.sign(issuerKeypair);
        try {
            const result = yield server.submitTransaction(transaction);
            return {
                hash: result.hash,
                network: params.network,
                assetCode: params.assetCode,
                issuerPublicKey,
                distributorPublicKey: params.distributorPublicKey,
                initialSupply: params.initialSupply,
            };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const code = msg.toLowerCase().includes("trust") ? "missing_trustline" : "transaction_failed";
            throw new errors_1.AgentKitError(`Submit transaction failed: ${msg}`, code, {
                context: { operation: "launchToken", network: params.network, assetCode: params.assetCode },
                cause: e,
            });
        }
    });
}
