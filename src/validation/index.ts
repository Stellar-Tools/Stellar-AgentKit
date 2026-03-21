/**
 * Validation Utilities for Stellar AgentKit
 * 
 * Provides comprehensive input validation for all SDK operations.
 * All validators throw descriptive AgentKitError subclasses on failure.
 */

import * as StellarSdk from 'stellar-sdk';
import Big from 'big.js';
import {
  InvalidAddressError,
  InvalidAmountError,
  InvalidNetworkError,
  MissingParameterError,
  ValidationError,
} from './index';

/**
 * Validates a Stellar address (public key or contract)
 * 
 * @param address - The address to validate
 * @param type - Optional: 'public', 'contract', or 'any' (default)
 * @returns The validated address
 * @throws InvalidAddressError if address is invalid
 */
export function validateStellarAddress(
  address: unknown,
  type: 'public' | 'contract' | 'any' = 'any'
): string {
  if (typeof address !== 'string') {
    throw new InvalidAddressError(String(address), {
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
    if (StellarSdk.StrKey.isValidContractId(trimmed)) {
      return trimmed;
    }
  }

  throw new InvalidAddressError(trimmed, {
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
export function validatePrivateKey(privateKey: unknown): string {
  if (typeof privateKey !== 'string') {
    throw new ValidationError(
      `Invalid private key type: expected string, got ${typeof privateKey}`,
      { receivedType: typeof privateKey },
      'Private keys must be provided as strings (secret seed format)'
    );
  }

  const trimmed = privateKey.trim();

  if (!StellarSdk.StrKey.isValidEd25519SecretSeed(trimmed)) {
    throw new ValidationError(
      'Invalid Stellar private key format',
      { keyLength: trimmed.length, format: 'expected: SXXXXXXX' },
      'Ensure the private key is a valid Stellar secret seed (starts with "S" and is 56 characters)'
    );
  }

  return trimmed;
}

/**
 * Validates a numeric amount (asset quantity)
 * 
 * @param amount - The amount to validate (string or number)
 * @param options - Validation options
 * @returns The validated amount as a string
 * @throws InvalidAmountError if amount is invalid
 */
export interface AmountValidationOptions {
  minAmount?: number | string;
  maxAmount?: number | string;
  allowZero?: boolean;
  allowNegative?: boolean;
  decimals?: number; // Enforce specific decimal places
}

export function validateAmount(
  amount: unknown,
  options: AmountValidationOptions = {}
): string {
  const {
    minAmount = 0,
    maxAmount,
    allowZero = false,
    allowNegative = false,
    decimals,
  } = options;

  // Type check
  if (typeof amount !== 'string' && typeof amount !== 'number') {
    throw new InvalidAmountError(amount as any, {
      expectedType: 'string | number',
      receivedType: typeof amount,
    });
  }

  const amountStr = String(amount).trim();

  // Parse and validate as big number
  let bigAmount: Big;
  try {
    bigAmount = new Big(amountStr);
  } catch (error) {
    throw new InvalidAmountError(amount as any, {}, undefined, error as Error);
  }

  // Check for NaN or Infinity
  if (!isFinite(bigAmount.toNumber())) {
    throw new InvalidAmountError(amount as any, {
      parsed: bigAmount.toString(),
      reason: 'Results in Infinity or NaN',
    });
  }

  // Check negative
  if (bigAmount.lt(0) && !allowNegative) {
    throw new InvalidAmountError(amount as any, {
      value: bigAmount.toString(),
      constraint: 'Must be non-negative',
    });
  }

  // Check zero
  if (bigAmount.eq(0) && !allowZero) {
    throw new InvalidAmountError(amount as any, {
      constraint: 'Must be greater than zero',
    });
  }

  // Check minimum
  if (bigAmount.lt(minAmount)) {
    throw new InvalidAmountError(amount as any, {
      value: bigAmount.toString(),
      minAmount: String(minAmount),
      constraint: `Must be >= ${minAmount}`,
    });
  }

  // Check maximum
  if (maxAmount && bigAmount.gt(maxAmount)) {
    throw new InvalidAmountError(amount as any, {
      value: bigAmount.toString(),
      maxAmount: String(maxAmount),
      constraint: `Must be <= ${maxAmount}`,
    });
  }

  // Check decimal places
  if (decimals !== undefined) {
    const parts = amountStr.split('.');
    if (parts[1] && parts[1].length > decimals) {
      throw new InvalidAmountError(amount as any, {
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
export function validateNetwork(network: unknown): 'testnet' | 'mainnet' {
  if (network !== 'testnet' && network !== 'mainnet') {
    throw new InvalidNetworkError(String(network), {
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
export function validateRequired<T>(
  value: T | undefined | null,
  paramName: string,
  operation: string
): T {
  if (value === undefined || value === null) {
    throw new MissingParameterError(paramName, operation);
  }

  return value;
}

/**
 * Validates swap parameters
 */
export interface SwapParams {
  to: string;
  buyA: boolean;
  out: string;
  inMax: string;
}

export function validateSwapParams(params: any): SwapParams {
  const validated = {
    to: validateStellarAddress(validateRequired(params.to, 'to', 'swap')),
    buyA: validateRequired(params.buyA, 'buyA', 'swap'),
    out: validateAmount(validateRequired(params.out, 'out', 'swap'), { minAmount: 0 }),
    inMax: validateAmount(validateRequired(params.inMax, 'inMax', 'swap'), { minAmount: 0 }),
  };

  // Validate logical constraints
  if (typeof validated.buyA !== 'boolean') {
    throw new ValidationError(
      'buyA must be a boolean value',
      { buyA: validated.buyA, type: typeof validated.buyA }
    );
  }

  const outAmount = new Big(validated.out);
  const inMaxAmount = new Big(validated.inMax);

  if (outAmount.lte(0)) {
    throw new ValidationError(
      'out amount must be greater than 0',
      { out: validated.out }
    );
  }

  if (inMaxAmount.lte(0)) {
    throw new ValidationError(
      'inMax amount must be greater than 0',
      { inMax: validated.inMax }
    );
  }

  return validated;
}

/**
 * Validates LP deposit parameters
 */
export interface DepositParams {
  to: string;
  desiredA: string;
  minA: string;
  desiredB: string;
  minB: string;
}

export function validateDepositParams(params: any): DepositParams {
  const validated = {
    to: validateStellarAddress(validateRequired(params.to, 'to', 'deposit')),
    desiredA: validateAmount(validateRequired(params.desiredA, 'desiredA', 'deposit')),
    minA: validateAmount(validateRequired(params.minA, 'minA', 'deposit')),
    desiredB: validateAmount(validateRequired(params.desiredB, 'desiredB', 'deposit')),
    minB: validateAmount(validateRequired(params.minB, 'minB', 'deposit')),
  };

  // Validate logical constraints
  const desiredA = new Big(validated.desiredA);
  const minA = new Big(validated.minA);
  const desiredB = new Big(validated.desiredB);
  const minB = new Big(validated.minB);

  if (minA.gt(desiredA)) {
    throw new ValidationError(
      'minA cannot be greater than desiredA',
      { minA: validated.minA, desiredA: validated.desiredA }
    );
  }

  if (minB.gt(desiredB)) {
    throw new ValidationError(
      'minB cannot be greater than desiredB',
      { minB: validated.minB, desiredB: validated.desiredB }
    );
  }

  return validated;
}

/**
 * Validates LP withdrawal parameters
 */
export interface WithdrawParams {
  to: string;
  shareAmount: string;
  minA: string;
  minB: string;
}

export function validateWithdrawParams(params: any): WithdrawParams {
  return {
    to: validateStellarAddress(validateRequired(params.to, 'to', 'withdraw')),
    shareAmount: validateAmount(validateRequired(params.shareAmount, 'shareAmount', 'withdraw')),
    minA: validateAmount(validateRequired(params.minA, 'minA', 'withdraw')),
    minB: validateAmount(validateRequired(params.minB, 'minB', 'withdraw')),
  };
}

/**
 * Validates bridge parameters
 */
export interface BridgeParams {
  amount: string;
  toAddress: string;
  fromNetwork?: 'stellar-testnet' | 'stellar-mainnet';
}

export function validateBridgeParams(params: any): BridgeParams {
  const fromNetwork = params.fromNetwork || 'stellar-testnet';

  if (fromNetwork !== 'stellar-testnet' && fromNetwork !== 'stellar-mainnet') {
    throw new ValidationError(
      'Invalid fromNetwork value',
      { received: fromNetwork, allowed: ['stellar-testnet', 'stellar-mainnet'] }
    );
  }

  return {
    amount: validateAmount(validateRequired(params.amount, 'amount', 'bridge')),
    toAddress: validateRequired(params.toAddress, 'toAddress', 'bridge') as string,
    fromNetwork: fromNetwork as 'stellar-testnet' | 'stellar-mainnet',
  };
}

/**
 * Validates all addresses in a collection
 */
export function validateAddresses(addresses: string[]): string[] {
  if (!Array.isArray(addresses)) {
    throw new ValidationError(
      'Expected array of addresses',
      { received: typeof addresses }
    );
  }

  return addresses.map((addr, idx) => {
    try {
      return validateStellarAddress(addr);
    } catch (error) {
      throw new ValidationError(
        `Invalid address at index ${idx}`,
        { index: idx, address: addr },
        undefined,
        error as Error
      );
    }
  });
}
