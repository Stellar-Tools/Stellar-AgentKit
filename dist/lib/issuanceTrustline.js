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
exports.getTrustlineSetupTransaction = getTrustlineSetupTransaction;
/**
 * Build unsigned ChangeTrust XDR for distributor. Use when launchToken throws missing_trustline.
 */
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const stellar_sdk_2 = require("@stellar/stellar-sdk");
const errors_1 = require("../errors");
const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
const HORIZON_MAINNET = "https://horizon.stellar.org";
const STELLAR_ADDRESS_REGEX = /^[CG][A-Z0-9]{55}$/;
function getTrustlineSetupTransaction(assetCode, issuerPublicKey, distributorPublicKey, network, limit) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!STELLAR_ADDRESS_REGEX.test(issuerPublicKey) || !STELLAR_ADDRESS_REGEX.test(distributorPublicKey)) {
            throw new errors_1.AgentKitError("Invalid issuer or distributor address format", "invalid_address", {
                context: { operation: "getTrustlineSetupTransaction", assetCode, network },
            });
        }
        if (!/^[a-zA-Z0-9]{1,12}$/.test(assetCode)) {
            throw new errors_1.AgentKitError("assetCode must be 1-12 alphanumeric, got " + assetCode, "invalid_params", {
                context: { operation: "getTrustlineSetupTransaction", assetCode, network },
            });
        }
        const horizonUrl = network === "mainnet" ? HORIZON_MAINNET : HORIZON_TESTNET;
        const server = new stellar_sdk_2.Horizon.Server(horizonUrl);
        const networkPassphrase = network === "mainnet" ? stellar_sdk_1.Networks.PUBLIC : stellar_sdk_1.Networks.TESTNET;
        const asset = new stellar_sdk_1.Asset(assetCode, issuerPublicKey);
        const account = yield server.loadAccount(distributorPublicKey);
        const tx = new stellar_sdk_1.TransactionBuilder(account, { fee: stellar_sdk_1.BASE_FEE, networkPassphrase })
            .addOperation(stellar_sdk_1.Operation.changeTrust({ asset, limit: limit !== null && limit !== void 0 ? limit : "922337203685.4775807" }))
            .setTimeout(30)
            .build();
        return tx.toXDR();
    });
}
