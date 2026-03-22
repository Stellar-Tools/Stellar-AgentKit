"use strict";
/**
 * Validation Utilities for Stellar AgentKit
 *
 * Provides comprehensive input validation for all SDK operations.
 * All validators throw descriptive AgentKitError subclasses on failure.
 */
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateStellarAddress = validateStellarAddress;
exports.validatePrivateKey = validatePrivateKey;
exports.validateAmount = validateAmount;
exports.validateNetwork = validateNetwork;
exports.validateRequired = validateRequired;
exports.validateSwapParams = validateSwapParams;
exports.validateDepositParams = validateDepositParams;
exports.validateWithdrawParams = validateWithdrawParams;
exports.validateBridgeParams = validateBridgeParams;
exports.validateAddresses = validateAddresses;
const StellarSdk = __importStar(require("stellar-sdk"));
const big_js_1 = __importDefault(require("big.js"));
const errors_1 = require("../errors");
/**
 * Validates a Stellar address (public key or contract)
 *
 * @param address - The address to validate
 * @param type - Optional: 'public', 'contract', or 'any' (default)
 * @returns The validated address
 * @throws InvalidAddressError if address is invalid
 */
function validateStellarAddress(address, type = 'any') {
    if (typeof address !== 'string') {
        throw new errors_1.InvalidAddressError(String(address), {
            expectedType: 'string',
            receivedType: typeof address,
        });
    }
    const trimmed = address.trim();
    if (type === 'public' || type === 'any') {
        if (StellarSdk.StrKey.isValidEd25519PublicKey(trimmed)) {
            return trimmed;
        }
    }
    if (type === 'contract' || type === 'any') {
        if (StellarSdk.StrKey.isValidContract(trimmed)) {
            return trimmed;
        }
    }
    throw new errors_1.InvalidAddressError(trimmed, {
        expectedType: type,
    });
}
/**
 * Validates a Stellar private key
 *
 * @param privateKey - The private key to validate
 * @returns The validated private key
 * @throws InvalidAddressError if key is invalid
 */
function validatePrivateKey(privateKey) {
    if (typeof privateKey !== 'string') {
        throw new errors_1.ValidationError(`Invalid private key type: expected string, got ${typeof privateKey}`, { receivedType: typeof privateKey }, 'Private keys must be provided as strings (secret seed format)');
    }
    const trimmed = privateKey.trim();
    if (!StellarSdk.StrKey.isValidEd25519SecretSeed(trimmed)) {
        throw new errors_1.ValidationError('Invalid Stellar private key format', { keyLength: trimmed.length, format: 'expected: SXXXXXXX' }, 'Ensure the private key is a valid Stellar secret seed (starts with "S" and is 56 characters)');
    }
    return trimmed;
}
function validateAmount(amount, options = {}) {
    const { minAmount = 0, maxAmount, allowZero = false, allowNegative = false, decimals, } = options;
    // Type check
    if (typeof amount !== 'string' && typeof amount !== 'number') {
        throw new errors_1.InvalidAmountError(amount, {
            expectedType: 'string | number',
            receivedType: typeof amount,
        });
    }
    const amountStr = String(amount).trim();
    // Parse and validate as big number
    let bigAmount;
    try {
        bigAmount = new big_js_1.default(amountStr);
    }
    catch (error) {
        throw new errors_1.InvalidAmountError(amount, {
            parseError: error instanceof Error ? error.message : String(error),
        });
    }
    // Check for NaN or Infinity
    if (!isFinite(bigAmount.toNumber())) {
        throw new errors_1.InvalidAmountError(amount, {
            parsed: bigAmount.toString(),
            reason: 'Results in Infinity or NaN',
        });
    }
    // Check negative
    if (bigAmount.lt(0) && !allowNegative) {
        throw new errors_1.InvalidAmountError(amount, {
            value: bigAmount.toString(),
            constraint: 'Must be non-negative',
        });
    }
    // Check zero
    if (bigAmount.eq(0) && !allowZero) {
        throw new errors_1.InvalidAmountError(amount, {
            constraint: 'Must be greater than zero',
        });
    }
    // Check minimum
    if (bigAmount.lt(minAmount)) {
        throw new errors_1.InvalidAmountError(amount, {
            value: bigAmount.toString(),
            minAmount: String(minAmount),
            constraint: `Must be >= ${minAmount}`,
        });
    }
    // Check maximum
    if (maxAmount !== undefined && bigAmount.gt(maxAmount)) {
        throw new errors_1.InvalidAmountError(amount, {
            value: bigAmount.toString(),
            maxAmount: String(maxAmount),
            constraint: `Must be <= ${maxAmount}`,
        });
    }
    // Check decimal places
    if (decimals !== undefined) {
        const parts = amountStr.split('.');
        if (parts[1] && parts[1].length > decimals) {
            throw new errors_1.InvalidAmountError(amount, {
                value: amountStr,
                actualDecimals: parts[1].length,
                maxDecimals: decimals,
                constraint: `Cannot exceed ${decimals} decimal places`,
            });
        }
    }
    return bigAmount.toString();
}
/**
 * Validates network configuration
 *
 * @param network - The network to validate
 * @returns The validated network
 * @throws InvalidNetworkError if network is invalid
 */
function validateNetwork(network) {
    if (network !== 'testnet' && network !== 'mainnet') {
        throw new errors_1.InvalidNetworkError(String(network), {
            received: network,
            allowed: ['testnet', 'mainnet'],
        });
    }
    return network;
}
/**
 * Validates that a required parameter is provided
 *
 * @param value - The value to check
 * @param paramName - Name of the parameter
 * @param operation - Name of the operation
 * @throws MissingParameterError if value is undefined or null
 */
function validateRequired(value, paramName, operation) {
    if (value === undefined || value === null) {
        throw new errors_1.MissingParameterError(paramName, operation);
    }
    return value;
}
function validateParamsObject(params, operation) {
    if (params === null || params === undefined || typeof params !== 'object' || Array.isArray(params)) {
        throw new errors_1.ValidationError(`Invalid ${operation} parameters: expected object`, { receivedType: params === null ? 'null' : typeof params }, 'Provide a non-null object with required parameters');
    }
    return params;
}
function validateSwapParams(params) {
    const safeParams = validateParamsObject(params, 'swap');
    const validated = {
        to: validateStellarAddress(validateRequired(safeParams.to, 'to', 'swap')),
        buyA: validateRequired(safeParams.buyA, 'buyA', 'swap'),
        out: validateAmount(validateRequired(safeParams.out, 'out', 'swap'), { minAmount: 0 }),
        inMax: validateAmount(validateRequired(safeParams.inMax, 'inMax', 'swap'), { minAmount: 0 }),
    };
    // Validate logical constraints
    if (typeof validated.buyA !== 'boolean') {
        throw new errors_1.ValidationError('buyA must be a boolean value', { buyA: validated.buyA, type: typeof validated.buyA });
    }
    const outAmount = new big_js_1.default(validated.out);
    const inMaxAmount = new big_js_1.default(validated.inMax);
    if (outAmount.lte(0)) {
        throw new errors_1.ValidationError('out amount must be greater than 0', { out: validated.out });
    }
    if (inMaxAmount.lte(0)) {
        throw new errors_1.ValidationError('inMax amount must be greater than 0', { inMax: validated.inMax });
    }
    return validated;
}
function validateDepositParams(params) {
    const safeParams = validateParamsObject(params, 'deposit');
    const validated = {
        to: validateStellarAddress(validateRequired(safeParams.to, 'to', 'deposit')),
        desiredA: validateAmount(validateRequired(safeParams.desiredA, 'desiredA', 'deposit')),
        minA: validateAmount(validateRequired(safeParams.minA, 'minA', 'deposit')),
        desiredB: validateAmount(validateRequired(safeParams.desiredB, 'desiredB', 'deposit')),
        minB: validateAmount(validateRequired(safeParams.minB, 'minB', 'deposit')),
    };
    // Validate logical constraints
    const desiredA = new big_js_1.default(validated.desiredA);
    const minA = new big_js_1.default(validated.minA);
    const desiredB = new big_js_1.default(validated.desiredB);
    const minB = new big_js_1.default(validated.minB);
    if (minA.gt(desiredA)) {
        throw new errors_1.ValidationError('minA cannot be greater than desiredA', { minA: validated.minA, desiredA: validated.desiredA });
    }
    if (minB.gt(desiredB)) {
        throw new errors_1.ValidationError('minB cannot be greater than desiredB', { minB: validated.minB, desiredB: validated.desiredB });
    }
    return validated;
}
function validateWithdrawParams(params) {
    const safeParams = validateParamsObject(params, 'withdraw');
    return {
        to: validateStellarAddress(validateRequired(safeParams.to, 'to', 'withdraw')),
        shareAmount: validateAmount(validateRequired(safeParams.shareAmount, 'shareAmount', 'withdraw')),
        minA: validateAmount(validateRequired(safeParams.minA, 'minA', 'withdraw')),
        minB: validateAmount(validateRequired(safeParams.minB, 'minB', 'withdraw')),
    };
}
function validateBridgeParams(params) {
    const safeParams = validateParamsObject(params, 'bridge');
    const fromNetwork = safeParams.fromNetwork || 'stellar-testnet';
    if (fromNetwork !== 'stellar-testnet' && fromNetwork !== 'stellar-mainnet') {
        throw new errors_1.ValidationError('Invalid fromNetwork value', { received: fromNetwork, allowed: ['stellar-testnet', 'stellar-mainnet'] });
    }
    return {
        amount: validateAmount(validateRequired(safeParams.amount, 'amount', 'bridge')),
        toAddress: validateRequired(safeParams.toAddress, 'toAddress', 'bridge'),
        fromNetwork: fromNetwork,
    };
}
/**
 * Validates all addresses in a collection
 */
function validateAddresses(addresses) {
    if (!Array.isArray(addresses)) {
        throw new errors_1.ValidationError('Expected array of addresses', { received: typeof addresses });
    }
    return addresses.map((addr, idx) => {
        try {
            return validateStellarAddress(addr);
        }
        catch (error) {
            throw new errors_1.ValidationError(`Invalid address at index ${idx}`, { index: idx, address: addr }, undefined, error);
        }
    });
}
