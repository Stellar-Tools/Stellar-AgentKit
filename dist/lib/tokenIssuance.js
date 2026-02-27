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
exports.launchToken = launchToken;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const errors_1 = require("./errors");
const retry_1 = require("../utils/retry");
const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
const HORIZON_MAINNET = "https://horizon.stellar.org";
const DECIMALS_MIN = 0;
const DECIMALS_MAX = 7;
const ASSET_CODE_REGEX = /^[a-zA-Z0-9]{1,12}$/;
function normalizeAmount(amount, decimals) {
    const d = Math.min(Math.max(decimals, DECIMALS_MIN), DECIMALS_MAX);
    if (d === 7)
        return amount;
    const [whole = "0", frac = ""] = amount.split(".");
    const padded = frac.padEnd(d, "0").slice(0, d);
    return padded ? `${whole}.${padded}` : whole;
}
/**
 * Launch a Stellar classic asset: ensure trustline and mint initial supply to distributor.
 * Mainnet requires allowMainnetTokenIssuance and optionally ALLOW_MAINNET_TOKEN_ISSUANCE=true.
 * Idempotent: if trustline already exists, skips changeTrust and only mints if needed.
 */
function launchToken(params) {
    return __awaiter(this, void 0, void 0, function* () {
        const { network, allowMainnetTokenIssuance = false, symbol, decimals = 7, initialSupply, issuerSecretKey, distributorPublicKey, distributorSecretKey,
        // lockIssuer = false, // Not implemented in MVP logic but present in params
         } = params;
        // Mainnet safeguard
        if (network === "mainnet") {
            const envAllowed = process.env.ALLOW_MAINNET_TOKEN_ISSUANCE === "true";
            if (!allowMainnetTokenIssuance || !envAllowed) {
                throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.NETWORK_BLOCKED, "Token issuance on mainnet is disabled. Set allowMainnetTokenIssuance: true and ALLOW_MAINNET_TOKEN_ISSUANCE=true in .env to enable.", { network, symbol });
            }
        }
        // Validation
        if (decimals < DECIMALS_MIN || decimals > DECIMALS_MAX) {
            throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.INVALID_DECIMALS, `decimals must be between ${DECIMALS_MIN} and ${DECIMALS_MAX}`, { decimals, symbol });
        }
        const supplyNum = parseFloat(initialSupply);
        if (isNaN(supplyNum) || supplyNum <= 0) {
            throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.INVALID_SUPPLY, "initialSupply must be a positive number string", { initialSupply, symbol });
        }
        if (!ASSET_CODE_REGEX.test(symbol)) {
            throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.INVALID_ADDRESS, "symbol must be 1–12 alphanumeric characters", { symbol });
        }
        const issuerKeypair = stellar_sdk_1.Keypair.fromSecret(issuerSecretKey);
        const issuerPublicKey = issuerKeypair.publicKey();
        const horizonUrl = network === "mainnet" ? HORIZON_MAINNET : HORIZON_TESTNET;
        const networkPassphrase = network === "mainnet" ? stellar_sdk_1.Networks.PUBLIC : stellar_sdk_1.Networks.TESTNET;
        const server = new stellar_sdk_1.Horizon.Server(horizonUrl);
        const asset = new stellar_sdk_1.Asset(symbol, issuerPublicKey);
        const amountStr = normalizeAmount(initialSupply, decimals);
        let trustlineHash;
        let trustlineExisted = false;
        // 1) ChangeTrust from distributor (if we have distributor secret)
        if (distributorSecretKey) {
            try {
                const distributorAccount = yield (0, retry_1.withRetry)(() => server.loadAccount(distributorPublicKey));
                const distributorKeypair = stellar_sdk_1.Keypair.fromSecret(distributorSecretKey);
                const fee = yield (0, retry_1.withRetry)(() => server.fetchBaseFee());
                const trustTx = new stellar_sdk_1.TransactionBuilder(distributorAccount, {
                    fee: String(fee),
                    networkPassphrase,
                })
                    .addOperation(stellar_sdk_1.Operation.changeTrust({
                    asset,
                    limit: "922337203685.4775807", // max int64 in decimal
                }))
                    .setTimeout(100)
                    .build();
                trustTx.sign(distributorKeypair);
                const trustResult = yield (0, retry_1.withRetry)(() => server.submitTransaction(trustTx));
                trustlineHash = trustResult.hash;
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (/trustline.*already exists|change_trust.*already exists/i.test(msg)) {
                    trustlineExisted = true;
                }
                else {
                    throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.TRUSTLINE_FAILED, `Failed to create trustline: ${msg}`, { symbol, distributor: distributorPublicKey, operation: "changeTrust" }, err instanceof Error ? err : undefined);
                }
            }
        }
        // 2) Payment from issuer to distributor (mint)
        let paymentHash;
        try {
            const issuerAccount = yield (0, retry_1.withRetry)(() => server.loadAccount(issuerPublicKey));
            const fee = yield (0, retry_1.withRetry)(() => server.fetchBaseFee());
            const paymentTx = new stellar_sdk_1.TransactionBuilder(issuerAccount, {
                fee: String(fee),
                networkPassphrase,
            })
                .addOperation(stellar_sdk_1.Operation.payment({
                destination: distributorPublicKey,
                asset,
                amount: amountStr,
            }))
                .setTimeout(100)
                .build();
            paymentTx.sign(issuerKeypair);
            const paymentResult = yield (0, retry_1.withRetry)(() => server.submitTransaction(paymentTx));
            paymentHash = paymentResult.hash;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new errors_1.AgentKitError(errors_1.AgentKitErrorCode.MINT_FAILED, `Failed to mint payment: ${msg}`, { symbol, amount: amountStr, distributor: distributorPublicKey }, err instanceof Error ? err : undefined);
        }
        return {
            status: trustlineExisted && !trustlineHash ? "idempotent_skip" : "launched",
            symbol,
            issuer: issuerPublicKey,
            distributor: distributorPublicKey,
            trustlineHash,
            paymentHash,
        };
    });
}
