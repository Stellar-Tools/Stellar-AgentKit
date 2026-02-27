"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signTransaction = void 0;
const stellar_sdk_1 = require("stellar-sdk");
const signTransaction = (txXDR, networkPassphrase) => {
    const keypair = stellar_sdk_1.Keypair.fromSecret(`${process.env.STELLAR_PRIVATE_KEY}`);
    const transaction = stellar_sdk_1.TransactionBuilder.fromXDR(txXDR, networkPassphrase);
    transaction.sign(keypair);
    return transaction.toXDR();
};
exports.signTransaction = signTransaction;
