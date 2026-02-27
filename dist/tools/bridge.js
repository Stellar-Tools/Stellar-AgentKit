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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bridgeTokenTool = void 0;
const big_js_1 = __importDefault(require("big.js"));
const bridge_core_sdk_1 = require("@allbridge/bridge-core-sdk");
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const utils_1 = require("../utils/utils");
const buildTransaction_1 = require("../utils/buildTransaction");
const dotenv = __importStar(require("dotenv"));
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
const errors_1 = require("../lib/errors");
dotenv.config({ path: ".env" });
const STELLAR_NETWORK_CONFIG = {
    "stellar-testnet": {
        networkPassphrase: stellar_sdk_1.Networks.TESTNET,
    },
    "stellar-mainnet": {
        networkPassphrase: stellar_sdk_1.Networks.PUBLIC,
    },
};
exports.bridgeTokenTool = new tools_1.DynamicStructuredTool({
    name: "bridge_token",
    description: "Bridge tokens (like USDC) from Stellar chain to EVM-compatible chains (like Ethereum). Use this when the user wants to move assets cross-chain. Requires amount, destination EVM address, and asset symbol.",
    schema: zod_1.z.object({
        amount: zod_1.z.string().describe("The amount of tokens to bridge"),
        toAddress: zod_1.z.string().describe("The destination address"),
        fromNetwork: zod_1.z
            .enum(["stellar-testnet", "stellar-mainnet"])
            .default("stellar-testnet")
            .describe("Source Stellar network"),
        assetSymbol: zod_1.z.string().default("USDC").describe("The asset symbol to bridge (e.g., USDC, XLM)"),
    }),
    func: (_a) => __awaiter(void 0, [_a], void 0, function* ({ amount, toAddress, fromNetwork, assetSymbol, }) {
        const fromAddress = process.env.STELLAR_PUBLIC_KEY;
        const privateKey = process.env.STELLAR_PRIVATE_KEY;
        if (!fromAddress || !privateKey) {
            throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.TOOL_EXECUTION_FAILED, "Missing Stellar public or private key in environment.");
        }
        // Mainnet safeguard - additional layer beyond AgentClient
        if (fromNetwork === "stellar-mainnet" &&
            process.env.ALLOW_MAINNET_BRIDGE !== "true") {
            throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.NETWORK_BLOCKED, "Mainnet bridging is disabled. Set ALLOW_MAINNET_BRIDGE=true in your .env file to enable.", { network: fromNetwork, amount });
        }
        const sdk = new bridge_core_sdk_1.AllbridgeCoreSdk(Object.assign(Object.assign({}, bridge_core_sdk_1.nodeRpcUrlsDefault), { SRB: `${process.env.SRB_PROVIDER_URL}` }));
        const chainDetailsMap = yield sdk.chainDetailsMap();
        const sourceToken = (0, utils_1.ensure)(chainDetailsMap[bridge_core_sdk_1.ChainSymbol.SRB].tokens.find((t) => t.symbol === assetSymbol), `Asset ${assetSymbol} not found on Stellar (SRB)`);
        const destinationToken = (0, utils_1.ensure)(chainDetailsMap[bridge_core_sdk_1.ChainSymbol.ETH].tokens.find((t) => t.symbol === assetSymbol), `Asset ${assetSymbol} not found on Ethereum (ETH)`);
        const sendParams = {
            amount,
            fromAccountAddress: fromAddress,
            toAccountAddress: toAddress,
            sourceToken,
            destinationToken,
            messenger: bridge_core_sdk_1.Messenger.ALLBRIDGE,
            extraGas: "1.15",
            extraGasFormat: bridge_core_sdk_1.AmountFormat.FLOAT,
            gasFeePaymentMethod: bridge_core_sdk_1.FeePaymentMethod.WITH_STABLECOIN,
        };
        const xdrTx = (yield sdk.bridge.rawTxBuilder.send(sendParams));
        const srbKeypair = stellar_sdk_1.Keypair.fromSecret(privateKey);
        const transaction = (0, buildTransaction_1.buildTransactionFromXDR)("bridge", xdrTx, STELLAR_NETWORK_CONFIG[fromNetwork].networkPassphrase);
        transaction.sign(srbKeypair);
        let signedTx = transaction.toXDR();
        const restoreXdrTx = yield sdk.utils.srb.simulateAndCheckRestoreTxRequiredSoroban(signedTx, fromAddress);
        if (restoreXdrTx) {
            const restoreTx = (0, buildTransaction_1.buildTransactionFromXDR)("bridge", restoreXdrTx, STELLAR_NETWORK_CONFIG[fromNetwork].networkPassphrase);
            restoreTx.sign(srbKeypair);
            const signedRestoreXdrTx = restoreTx.toXDR();
            const sentRestoreXdrTx = yield sdk.utils.srb.sendTransactionSoroban(signedRestoreXdrTx);
            const confirmRestoreXdrTx = yield sdk.utils.srb.confirmTx(sentRestoreXdrTx.hash);
            // Handle FAILED restore explicitly
            if (confirmRestoreXdrTx.status === stellar_sdk_1.rpc.Api.GetTransactionStatus.FAILED) {
                throw new Error(`Restore transaction failed. Hash: ${sentRestoreXdrTx.hash}`);
            }
            if (confirmRestoreXdrTx.status === stellar_sdk_1.rpc.Api.GetTransactionStatus.NOT_FOUND) {
                return {
                    status: "pending_restore",
                    hash: sentRestoreXdrTx.hash,
                    network: fromNetwork,
                };
            }
            // Get new tx with updated sequences
            const xdrTx2 = (yield sdk.bridge.rawTxBuilder.send(sendParams));
            const transaction2 = (0, buildTransaction_1.buildTransactionFromXDR)("bridge", xdrTx2, STELLAR_NETWORK_CONFIG[fromNetwork].networkPassphrase);
            transaction2.sign(srbKeypair);
            signedTx = transaction2.toXDR();
        }
        const sent = yield sdk.utils.srb.sendTransactionSoroban(signedTx);
        const confirm = yield sdk.utils.srb.confirmTx(sent.hash);
        if (confirm.status === stellar_sdk_1.rpc.Api.GetTransactionStatus.NOT_FOUND) {
            return {
                status: "pending",
                hash: sent.hash,
                network: fromNetwork,
            };
        }
        if (confirm.status === stellar_sdk_1.rpc.Api.GetTransactionStatus.FAILED) {
            throw new Error(`Transaction failed. Hash: ${sent.hash}`);
        }
        // TrustLine check and setup for destinationToken if it is SRB
        const destinationTokenSBR = sourceToken;
        const balanceLine = yield sdk.utils.srb.getBalanceLine(fromAddress, destinationTokenSBR.tokenAddress);
        const notEnoughBalanceLine = !balanceLine ||
            (0, big_js_1.default)(balanceLine.balance)
                .add(amount)
                .gt((0, big_js_1.default)(balanceLine.limit));
        if (notEnoughBalanceLine) {
            const xdrTx = yield sdk.utils.srb.buildChangeTrustLineXdrTx({
                sender: fromAddress,
                tokenAddress: destinationTokenSBR.tokenAddress,
            });
            // Use unified transaction builder for XDR-based bridge TrustLine operation
            const keypair = stellar_sdk_1.Keypair.fromSecret(privateKey);
            const trustTx = (0, buildTransaction_1.buildTransactionFromXDR)("bridge", xdrTx, STELLAR_NETWORK_CONFIG[fromNetwork].networkPassphrase);
            trustTx.sign(keypair);
            const signedTrustLineTx = trustTx.toXDR();
            const submit = yield sdk.utils.srb.submitTransactionStellar(signedTrustLineTx);
            return {
                status: "trustline_submitted",
                hash: submit.hash,
                network: fromNetwork,
            };
        }
        return {
            status: "confirmed",
            hash: sent.hash,
            network: fromNetwork,
            asset: sourceToken.symbol,
            amount,
        };
    }),
});
