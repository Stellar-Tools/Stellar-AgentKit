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
exports.stellarGetBalanceTool = void 0;
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
const StellarSdk = __importStar(require("@stellar/stellar-sdk"));
exports.stellarGetBalanceTool = new tools_1.DynamicStructuredTool({
    name: "stellar_get_balance",
    description: "Query current balances for a Stellar account. Returns native XLM balance and all established trustlines (token balances). Use this to check if an account has sufficient funds before initiating a trade or bridge.",
    schema: zod_1.z.object({
        address: zod_1.z.string().describe("The Stellar address to check balances for"),
        network: zod_1.z.enum(["testnet", "mainnet"]).default("testnet").describe("The network to use"),
    }),
    func: (_a) => __awaiter(void 0, [_a], void 0, function* ({ address, network }) {
        try {
            if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
                throw new Error(`Invalid address format: ${address}`);
            }
            const horizonUrl = network === "mainnet"
                ? "https://horizon.stellar.org"
                : "https://horizon-testnet.stellar.org";
            const server = new StellarSdk.Horizon.Server(horizonUrl);
            const account = yield server.loadAccount(address);
            const balances = account.balances.map((b) => {
                if (b.asset_type === "native") {
                    return { asset: "XLM", balance: b.balance };
                }
                else {
                    return {
                        asset: `${b.asset_code}:${b.asset_issuer}`,
                        balance: b.balance,
                        code: b.asset_code,
                        issuer: b.asset_issuer
                    };
                }
            });
            return JSON.stringify({
                address,
                network,
                balances
            }, null, 2);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return `Failed to get balance: ${msg}`;
        }
    }),
});
