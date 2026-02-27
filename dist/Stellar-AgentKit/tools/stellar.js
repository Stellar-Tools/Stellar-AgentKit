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
exports.stellarSendPaymentTool = void 0;
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
const StellarSdk = __importStar(require("stellar-sdk"));
// ... import StellarSdk, getPublicKey, connect, signTransaction, etc. as needed ...
exports.stellarSendPaymentTool = new tools_1.DynamicStructuredTool({
    name: "stellar_send_payment",
    description: "Send a payment on the Stellar testnet. Requires recipient address and amount.",
    schema: zod_1.z.object({
        recipient: zod_1.z.string().describe("The Stellar address to send to"),
        amount: zod_1.z.string().describe("The amount of XLM to send (as a string)"),
    }),
    func: (_a) => __awaiter(void 0, [_a], void 0, function* ({ recipient, amount }) {
        var _b, _c;
        try {
            // Step 1: Validate inputs
            if (!StellarSdk.StrKey.isValidEd25519PublicKey(recipient)) {
                throw new Error("Invalid recipient address.");
            }
            if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
                throw new Error("Amount must be a positive number.");
            }
            // Step 2: Get private key from environment
            const privateKey = process.env.STELLAR_PRIVATE_KEY;
            if (!privateKey || !StellarSdk.StrKey.isValidEd25519SecretSeed(privateKey)) {
                throw new Error("Invalid or missing Stellar private key in environment.");
            }
            const keypair = StellarSdk.Keypair.fromSecret(privateKey);
            const sourcePublicKey = keypair.publicKey();
            // Step 3: Create an unsigned transaction
            const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
            const account = yield server.loadAccount(sourcePublicKey);
            const transaction = new StellarSdk.TransactionBuilder(account, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: StellarSdk.Networks.TESTNET,
            })
                .addOperation(StellarSdk.Operation.payment({
                destination: recipient,
                asset: StellarSdk.Asset.native(),
                amount: amount,
            }))
                .setTimeout(300)
                .build();
            // Step 4: Sign the transaction with the private key
            transaction.sign(keypair);
            const signedTxXdr = transaction.toXDR();
            // Step 5: Submit the transaction
            const tx = new StellarSdk.Transaction(signedTxXdr, StellarSdk.Networks.TESTNET);
            const response = yield server.submitTransaction(tx);
            return `Transaction successful! Hash: ${response.hash}`;
        }
        catch (error) {
            const errorMessage = ((_c = (_b = error
                .response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.title) ||
                error.message ||
                "Unknown error occurred";
            return `Transaction failed: ${errorMessage}`;
        }
    }),
});
