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
exports.stellarEnsureTrustlineTool = void 0;
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
const StellarSdk = __importStar(require("@stellar/stellar-sdk"));
const retry_1 = require("../utils/retry");
exports.stellarEnsureTrustlineTool = new tools_1.DynamicStructuredTool({
    name: "stellar_ensure_trustline",
    description: "Verify and maintain asset trustlines for a Stellar account. Checks if a trustline for a specific asset exists and creates it if missing. ESSENTIAL to call this before many swap, bridge, or payment operations if you are unsure.",
    schema: zod_1.z.object({
        assetCode: zod_1.z.string().describe("The asset code (e.g., USDC)"),
        assetIssuer: zod_1.z.string().describe("The asset issuer address"),
        network: zod_1.z.enum(["testnet", "mainnet"]).default("testnet").describe("The network to use"),
    }),
    func: (_a) => __awaiter(void 0, [_a], void 0, function* ({ assetCode, assetIssuer, network }) {
        try {
            const privateKey = process.env.STELLAR_PRIVATE_KEY;
            if (!privateKey)
                throw new Error("STELLAR_PRIVATE_KEY not found in environment.");
            const keypair = StellarSdk.Keypair.fromSecret(privateKey);
            const publicKey = keypair.publicKey();
            const horizonUrl = network === "mainnet"
                ? "https://horizon.stellar.org"
                : "https://horizon-testnet.stellar.org";
            const networkPassphrase = network === "mainnet"
                ? StellarSdk.Networks.PUBLIC
                : StellarSdk.Networks.TESTNET;
            const server = new StellarSdk.Horizon.Server(horizonUrl);
            const asset = new StellarSdk.Asset(assetCode, assetIssuer);
            // 1. Check if trustline already exists
            const account = yield (0, retry_1.withRetry)(() => server.loadAccount(publicKey));
            const hasTrustline = account.balances.some((b) => b.asset_code === assetCode && b.asset_issuer === assetIssuer);
            if (hasTrustline) {
                return `Trustline already exists for ${assetCode}:${assetIssuer}. No action needed.`;
            }
            // 2. Create trustline
            const fee = yield (0, retry_1.withRetry)(() => server.fetchBaseFee());
            const tx = new StellarSdk.TransactionBuilder(account, {
                fee: String(fee),
                networkPassphrase,
            })
                .addOperation(StellarSdk.Operation.changeTrust({
                asset,
                limit: "922337203685.4775807",
            }))
                .setTimeout(100)
                .build();
            tx.sign(keypair);
            const result = yield (0, retry_1.withRetry)(() => server.submitTransaction(tx));
            return `Trustline successfully created for ${assetCode}:${assetIssuer}. Hash: ${result.hash}`;
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return `Failed to ensure trustline: ${msg}`;
        }
    }),
});
