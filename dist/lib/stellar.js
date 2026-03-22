"use strict";
/// <reference types="node" />
Object.defineProperty(exports, "__esModule", { value: true });
exports.signTransaction = void 0;
const stellar_sdk_1 = require("stellar-sdk");
/**
 * Signs a Stellar transaction XDR string using the private key
 * stored in environment variables.
 *
 * @param txXDR - transaction in XDR format
 * @param networkPassphrase - Stellar network passphrase
 * @returns signed transaction XDR
 */
const signTransaction = (txXDR, networkPassphrase) => {
    const secretKey = process.env.STELLAR_PRIVATE_KEY;
    if (!secretKey) {
        throw new Error("Missing STELLAR_PRIVATE_KEY in environment variables");
    }
    if (!txXDR) {
        throw new Error("txXDR parameter is required");
    }
    if (!networkPassphrase) {
        throw new Error("networkPassphrase parameter is required");
    }
    const keypair = stellar_sdk_1.Keypair.fromSecret(secretKey);
    const transaction = new stellar_sdk_1.Transaction(txXDR, networkPassphrase);
    transaction.sign(keypair);
    return transaction.toXDR();
};
exports.signTransaction = signTransaction;
