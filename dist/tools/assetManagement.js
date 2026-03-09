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
exports.assetManagementTool = void 0;
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const STELLAR_PUBLIC_KEY = process.env.STELLAR_PUBLIC_KEY;
const STELLAR_PRIVATE_KEY = process.env.STELLAR_PRIVATE_KEY;
if (!STELLAR_PUBLIC_KEY || !STELLAR_PRIVATE_KEY) {
    throw new Error("Missing Stellar environment variables");
}
const derivedPublicKey = stellar_sdk_1.Keypair.fromSecret(STELLAR_PRIVATE_KEY).publicKey();
if (derivedPublicKey !== STELLAR_PUBLIC_KEY) {
    throw new Error("STELLAR_PUBLIC_KEY does not match STELLAR_PRIVATE_KEY. Use a matching keypair.");
}
const STELLAR_NETWORK_CONFIG = {
    "stellar-testnet": {
        networkPassphrase: stellar_sdk_1.Networks.TESTNET,
        horizonUrl: "https://horizon-testnet.stellar.org",
    },
    "stellar-mainnet": {
        networkPassphrase: stellar_sdk_1.Networks.PUBLIC,
        horizonUrl: "https://horizon.stellar.org",
    },
};
const ASSET_CODE_REGEX = /^[a-zA-Z0-9]{1,12}$/;
const STELLAR_AMOUNT_REGEX = /^\d+(\.\d{1,7})?$/;
const isValidPositiveAmount = (value) => {
    if (!STELLAR_AMOUNT_REGEX.test(value)) {
        return false;
    }
    return Number(value) > 0;
};
exports.assetManagementTool = new tools_1.DynamicStructuredTool({
    name: "asset_management",
    description: "Manage Stellar assets: retrieve account balances, add or remove trustlines for custom assets, and issue new custom assets on the Stellar network.",
    schema: zod_1.z.object({
        action: zod_1.z.enum(["get_balances", "manage_trustline", "create_asset"]),
        assetCode: zod_1.z.string().optional(),
        assetIssuer: zod_1.z.string().optional(),
        operation: zod_1.z.enum(["add", "remove"]).optional(),
        limit: zod_1.z.string().optional(),
        recipientAddress: zod_1.z.string().optional(),
        amount: zod_1.z.string().optional(),
        network: zod_1.z
            .enum(["stellar-testnet", "stellar-mainnet"])
            .default("stellar-testnet")
            .optional(),
    }),
    func: (_a) => __awaiter(void 0, [_a], void 0, function* ({ action, assetCode, assetIssuer, operation, limit, recipientAddress, amount, network = "stellar-testnet", }) {
        var _b, _c;
        try {
            const { networkPassphrase, horizonUrl } = STELLAR_NETWORK_CONFIG[network !== null && network !== void 0 ? network : "stellar-testnet"];
            const server = new stellar_sdk_1.Horizon.Server(horizonUrl);
            // Mainnet safeguard: all asset management operations require explicit opt-in.
            // This prevents accidental mainnet usage, similar to bridgeTokenTool pattern.
            if (network === "stellar-mainnet" &&
                process.env.ALLOW_MAINNET_ASSET_MANAGEMENT !== "true") {
                throw new Error("Mainnet asset management is disabled. Set ALLOW_MAINNET_ASSET_MANAGEMENT=true in your .env file to enable.");
            }
            switch (action) {
                /**
                 * get_balances: Load the account from Horizon and return all asset
                 * balances (native XLM and any custom assets) held by STELLAR_PUBLIC_KEY.
                 */
                case "get_balances": {
                    const account = yield server.loadAccount(STELLAR_PUBLIC_KEY);
                    const balances = account.balances.map((b) => {
                        var _a;
                        if (b.asset_type === "native") {
                            return { asset: "XLM", balance: b.balance };
                        }
                        return {
                            asset: (_a = b.asset_code) !== null && _a !== void 0 ? _a : "UNKNOWN",
                            balance: b.balance,
                            issuer: b.asset_issuer,
                        };
                    });
                    return JSON.stringify(balances, null, 2);
                }
                /**
                 * manage_trustline: Add or remove a trustline for a custom Stellar asset
                 * on the STELLAR_PUBLIC_KEY account, signed with STELLAR_PRIVATE_KEY.
                 * Uses Operation.changeTrust; for "remove" the limit is set to "0".
                 */
                case "manage_trustline": {
                    if (!assetCode) {
                        throw new Error("assetCode is required for manage_trustline");
                    }
                    if (!assetIssuer) {
                        throw new Error("assetIssuer is required for manage_trustline");
                    }
                    if (!operation) {
                        throw new Error('operation ("add" or "remove") is required for manage_trustline');
                    }
                    if (!ASSET_CODE_REGEX.test(assetCode)) {
                        throw new Error("assetCode must be 1-12 alphanumeric characters");
                    }
                    if (!stellar_sdk_1.StrKey.isValidEd25519PublicKey(assetIssuer)) {
                        throw new Error("assetIssuer must be a valid Stellar public key");
                    }
                    if (limit !== undefined && operation === "add" && !isValidPositiveAmount(limit)) {
                        throw new Error("limit must be a positive numeric string with up to 7 decimal places");
                    }
                    const keypair = stellar_sdk_1.Keypair.fromSecret(STELLAR_PRIVATE_KEY);
                    const account = yield server.loadAccount(STELLAR_PUBLIC_KEY);
                    const asset = new stellar_sdk_1.Asset(assetCode, assetIssuer);
                    const trustLimit = operation === "remove" ? "0" : (limit !== null && limit !== void 0 ? limit : "1000000");
                    const transaction = new stellar_sdk_1.TransactionBuilder(account, {
                        fee: stellar_sdk_1.BASE_FEE,
                        networkPassphrase,
                    })
                        .addOperation(stellar_sdk_1.Operation.changeTrust({
                        asset,
                        limit: trustLimit,
                    }))
                        .setTimeout(300)
                        .build();
                    transaction.sign(keypair);
                    const response = yield server.submitTransaction(transaction);
                    return `Trustline ${operation === "add" ? "added" : "removed"} successfully. Transaction hash: ${response.hash}`;
                }
                /**
                 * create_asset: Issue a new custom asset on Stellar. The issuer keypair
                 * (STELLAR_PRIVATE_KEY) first establishes a trustline on the recipient
                 * account (when issuer != recipient), then sends the asset via
                 * Operation.payment to recipientAddress.
                 */
                case "create_asset": {
                    if (!assetCode) {
                        throw new Error("assetCode is required for create_asset");
                    }
                    if (!recipientAddress) {
                        throw new Error("recipientAddress is required for create_asset");
                    }
                    if (!amount) {
                        throw new Error("amount is required for create_asset");
                    }
                    if (!ASSET_CODE_REGEX.test(assetCode)) {
                        throw new Error("assetCode must be 1-12 alphanumeric characters");
                    }
                    if (!stellar_sdk_1.StrKey.isValidEd25519PublicKey(recipientAddress)) {
                        throw new Error("recipientAddress must be a valid Stellar public key");
                    }
                    if (!isValidPositiveAmount(amount)) {
                        throw new Error("amount must be a positive numeric string with up to 7 decimal places");
                    }
                    const issuerKeypair = stellar_sdk_1.Keypair.fromSecret(STELLAR_PRIVATE_KEY);
                    const issuerPublicKey = issuerKeypair.publicKey();
                    const asset = new stellar_sdk_1.Asset(assetCode, issuerPublicKey);
                    // The recipient must trust the issuer asset before receiving it.
                    // This tool controls only the issuer secret key, so trustline creation
                    // can only be performed for the issuer account itself.
                    if (recipientAddress !== issuerPublicKey) {
                        const recipientAccount = yield server.loadAccount(recipientAddress);
                        const hasTrustline = recipientAccount.balances.some((balance) => balance.asset_type !== "native" &&
                            balance.asset_code === assetCode &&
                            balance.asset_issuer === issuerPublicKey);
                        if (!hasTrustline) {
                            throw new Error(`Recipient ${recipientAddress} must add a trustline for ${assetCode}:${issuerPublicKey} before asset issuance.`);
                        }
                    }
                    // Step 2: Issue the asset by sending a payment from the issuer to the
                    // recipient account.
                    const issuerAccount = yield server.loadAccount(issuerPublicKey);
                    const paymentTx = new stellar_sdk_1.TransactionBuilder(issuerAccount, {
                        fee: stellar_sdk_1.BASE_FEE,
                        networkPassphrase,
                    })
                        .addOperation(stellar_sdk_1.Operation.payment({
                        destination: recipientAddress,
                        asset,
                        amount,
                    }))
                        .setTimeout(300)
                        .build();
                    paymentTx.sign(issuerKeypair);
                    const response = yield server.submitTransaction(paymentTx);
                    return `Asset ${assetCode} issued successfully. Transaction hash: ${response.hash}`;
                }
                default:
                    throw new Error("Unsupported action");
            }
        }
        catch (error) {
            const errorMessage = ((_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.title) ||
                error.message ||
                "Unknown error occurred";
            return `Asset management failed: ${errorMessage}`;
        }
    }),
});
