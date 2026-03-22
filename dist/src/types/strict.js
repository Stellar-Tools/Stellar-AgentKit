"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPublicKey = createPublicKey;
exports.createContractAddress = createContractAddress;
exports.createContractMethod = createContractMethod;
exports.createAmount = createAmount;
exports.createAssetSymbol = createAssetSymbol;
exports.createPercentage = createPercentage;
exports.createFee = createFee;
exports.createLedgerSequence = createLedgerSequence;
exports.createTransactionHash = createTransactionHash;
exports.unbox = unbox;
exports.multiplyAmount = multiplyAmount;
exports.divideAmount = divideAmount;
exports.createStrictConfig = createStrictConfig;
const big_js_1 = __importDefault(require("big.js"));
// ============================================================================
// Type Guards / Constructors
// ============================================================================
/**
 * Validate and create a PublicKey
 */
function createPublicKey(key) {
    if (!/^G[A-Z0-9]{55}$/.test(key)) {
        throw new Error(`Invalid Stellar public key: ${key}`);
    }
    return key;
}
/**
 * Validate and create a ContractAddress
 */
function createContractAddress(address) {
    if (!/^C[A-Z0-9]{55}$/.test(address)) {
        throw new Error(`Invalid Stellar contract address: ${address}`);
    }
    return address;
}
/**
 * Create a ContractMethod (no validation, just type safety)
 */
function createContractMethod(method) {
    if (!method || method.trim() === '') {
        throw new Error('Contract method cannot be empty');
    }
    return method.toLowerCase();
}
/**
 * Validate and create an Amount
 * Prevents invalid amounts like negative, NaN, etc.
 */
function createAmount(amount) {
    let amountStr = typeof amount === 'number' ? amount.toString() : amount;
    // Remove whitespace
    amountStr = amountStr.trim();
    // Validate format
    if (!/^[0-9]+(\.[0-9]{1,18})?$/.test(amountStr)) {
        throw new Error(`Invalid amount format: ${amountStr}`);
    }
    // Prevent scientific notation
    if (amountStr.includes('e') || amountStr.includes('E')) {
        throw new Error(`Amount cannot use scientific notation: ${amountStr}`);
    }
    // Check for zero after decimal (valid but not negative)
    const num = parseFloat(amountStr);
    if (isNaN(num) || num < 0) {
        throw new Error(`Invalid amount: must be non-negative number`);
    }
    return amountStr;
}
/**
 * Create AssetSymbol
 */
function createAssetSymbol(symbol) {
    const trimmed = symbol.toUpperCase().trim();
    if (!/^[A-Z]{1,12}$/.test(trimmed)) {
        throw new Error(`Invalid asset symbol: ${symbol}`);
    }
    return trimmed;
}
/**
 * Create Percentage (0-100)
 */
function createPercentage(value) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new Error(`Percentage must be between 0 and 100, got ${value}`);
    }
    return value;
}
/**
 * Create Fee in stroops
 */
function createFee(stroops) {
    const feeStr = typeof stroops === 'number' ? stroops.toString() : stroops;
    const fee = BigInt(feeStr);
    if (fee < 0n) {
        throw new Error('Fee cannot be negative');
    }
    return feeStr;
}
/**
 * Create LedgerSequence
 */
function createLedgerSequence(seq) {
    if (!Number.isInteger(seq) || seq < 0) {
        throw new Error(`Ledger sequence must be non-negative integer, got ${seq}`);
    }
    return seq;
}
/**
 * Create TransactionHash
 */
function createTransactionHash(hash) {
    if (!/^[a-f0-9]{64}$/i.test(hash)) {
        throw new Error(`Invalid transaction hash: ${hash}`);
    }
    return hash.toLowerCase();
}
// ============================================================================
// Type Utilities
// ============================================================================
/**
 * Extract the raw value from a branded type
 */
function unbox(value) {
    return value;
}
function normalizeDecimal(value) {
    const fixed = value.toFixed(18);
    return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}
/**
 * Safe amount multiplication
 */
function multiplyAmount(amount, multiplier) {
    if (!Number.isFinite(multiplier) || multiplier < 0) {
        throw new Error(`Invalid multiplier: ${multiplier}`);
    }
    const result = new big_js_1.default(amount).times(multiplier);
    return createAmount(normalizeDecimal(result));
}
/**
 * Safe amount division
 */
function divideAmount(amount, divisor) {
    if (!Number.isFinite(divisor) || divisor <= 0) {
        throw new Error(`Divisor must be a finite positive number, got ${divisor}`);
    }
    const result = new big_js_1.default(amount).div(divisor);
    return createAmount(normalizeDecimal(result));
}
/**
 * Create strict config from plain object
 */
function createStrictConfig(config) {
    if (config.network !== 'testnet' && config.network !== 'mainnet') {
        throw new Error(`Invalid network: ${config.network}`);
    }
    return {
        network: config.network,
        publicKey: createPublicKey(config.publicKey),
        allowMainnet: config.allowMainnet,
        defaultSlippage: createPercentage(config.defaultSlippage ?? 1),
        defaultTimeout: config.defaultTimeout ?? 300,
        maxFee: createFee(config.maxFee ?? '100'),
    };
}
