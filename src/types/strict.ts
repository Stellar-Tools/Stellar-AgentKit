/**
 * Advanced TypeScript Types for Stellar AgentKit
 * 
 * Provides branded types and strict type safety to prevent:
 * - Invalid address usage
 * - Amount precision loss
 * - Network misconfigurations
 * - Wrong contract addresses
 */

/**
 * Opaque branded types for compile-time safety
 * These prevent accidental mixing of similar strings at compile time
 */

/**
 * Stellar public key/account address
 * Format: GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (uppercase, 56 chars)
 */
export type PublicKey = string & { readonly __brand: 'PublicKey' };

/**
 * Stellar contract address
 * Format: CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (uppercase, 56 chars)
 */
export type ContractAddress = string & { readonly __brand: 'ContractAddress' };

/**
 * Stellar contract method name
 */
export type ContractMethod = string & { readonly __brand: 'ContractMethod' };

/**
 * Amount as decimal string (safe for large numbers)
 * Examples: "1000.50", "0.0001", "1000000"
 */
export type Amount = string & { readonly __brand: 'Amount' };

/**
 * Asset symbol (e.g., "USDC", "XLM", "BTC")
 */
export type AssetSymbol = string & { readonly __brand: 'AssetSymbol' };

/**
 * Percentage value (0-100)
 */
export type Percentage = number & { readonly __brand: 'Percentage' };

/**
 * Network identifier
 */
export type Network = 'testnet' | 'mainnet';

/**
 * Transaction hash from ledger
 */
export type TransactionHash = string & { readonly __brand: 'TransactionHash' };

/**
 * Ledger sequence number
 */
export type LedgerSequence = number & { readonly __brand: 'LedgerSequence' };

/**
 * Fee in stroops (smallest XLM unit)
 */
export type Fee = string & { readonly __brand: 'Fee' };

// ============================================================================
// Type Guards / Constructors
// ============================================================================

/**
 * Validate and create a PublicKey
 */
export function createPublicKey(key: string): PublicKey {
  if (!/^G[A-Z0-9]{55}$/.test(key)) {
    throw new Error(`Invalid Stellar public key: ${key}`);
  }
  return key as PublicKey;
}

/**
 * Validate and create a ContractAddress
 */
export function createContractAddress(address: string): ContractAddress {
  if (!/^C[A-Z0-9]{55}$/.test(address)) {
    throw new Error(`Invalid Stellar contract address: ${address}`);
  }
  return address as ContractAddress;
}

/**
 * Create a ContractMethod (no validation, just type safety)
 */
export function createContractMethod(method: string): ContractMethod {
  if (!method || method.trim() === '') {
    throw new Error('Contract method cannot be empty');
  }
  return method.toLowerCase() as ContractMethod;
}

/**
 * Validate and create an Amount
 * Prevents invalid amounts like negative, NaN, etc.
 */
export function createAmount(amount: string | number): Amount {
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

  return amountStr as Amount;
}

/**
 * Create AssetSymbol
 */
export function createAssetSymbol(symbol: string): AssetSymbol {
  const trimmed = symbol.toUpperCase().trim();
  
  if (!/^[A-Z]{1,12}$/.test(trimmed)) {
    throw new Error(`Invalid asset symbol: ${symbol}`);
  }
  
  return trimmed as AssetSymbol;
}

/**
 * Create Percentage (0-100)
 */
export function createPercentage(value: number): Percentage {
  if (value < 0 || value > 100) {
    throw new Error(`Percentage must be between 0 and 100, got ${value}`);
  }
  
  return value as Percentage;
}

/**
 * Create Fee in stroops
 */
export function createFee(stroops: string | number): Fee {
  const feeStr = typeof stroops === 'number' ? stroops.toString() : stroops;
  const fee = BigInt(feeStr);
  
  if (fee < 0n) {
    throw new Error('Fee cannot be negative');
  }
  
  return feeStr as Fee;
}

/**
 * Create LedgerSequence
 */
export function createLedgerSequence(seq: number): LedgerSequence {
  if (!Number.isInteger(seq) || seq < 0) {
    throw new Error(`Ledger sequence must be non-negative integer, got ${seq}`);
  }
  
  return seq as LedgerSequence;
}

/**
 * Create TransactionHash
 */
export function createTransactionHash(hash: string): TransactionHash {
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    throw new Error(`Invalid transaction hash: ${hash}`);
  }
  
  return hash.toLowerCase() as TransactionHash;
}

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Extract the raw value from a branded type
 */
export function unbox<T extends { readonly __brand: string }>(value: T): string {
  return value as unknown as string;
}

/**
 * Safe amount multiplication
 */
export function multiplyAmount(amount: Amount, multiplier: number): Amount {
  const result = (BigInt(amount.replace('.', '')) * BigInt(Math.round(multiplier * 1000000))) / BigInt(1000000);
  return createAmount(result.toString());
}

/**
 * Safe amount division
 */
export function divideAmount(amount: Amount, divisor: number): Amount {
  const result = BigInt(amount.replace('.', '')) / BigInt(Math.round(divisor * 1000000));
  return createAmount(result.toString());
}

// ============================================================================
// Operation Types
// ============================================================================

/**
 * Generic operation result type
 */
export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: number;
  duration: number; // ms
}

/**
 * Swap operation
 */
export interface SwapOperation {
  type: 'swap';
  tokenIn: AssetSymbol;
  tokenOut: AssetSymbol;
  amountIn: Amount;
  minAmountOut: Amount;
  from: PublicKey;
  to: PublicKey;
  contract: ContractAddress;
  slippageTolerance: Percentage;
}

/**
 * Deposit operation
 */
export interface DepositOperation {
  type: 'deposit';
  tokenA: AssetSymbol;
  tokenB: AssetSymbol;
  amountA: Amount;
  amountB: Amount;
  from: PublicKey;
  to: PublicKey;
  contract: ContractAddress;
  slippageTolerance: Percentage;
}

/**
 * Withdraw operation
 */
export interface WithdrawOperation {
  type: 'withdraw';
  shareToken: AssetSymbol;
  shareAmount: Amount;
  from: PublicKey;
  to: PublicKey;
  contract: ContractAddress;
  minAmountA: Amount;
  minAmountB: Amount;
}

/**
 * Union type for all operations
 */
export type Operation = SwapOperation | DepositOperation | WithdrawOperation;

/**
 * Operation metadata
 */
export interface OperationMetadata {
  operation: Operation;
  network: Network;
  priority: 'low' | 'normal' | 'high';
  maxFee: Fee;
  timeout: number; // seconds
  retryable: boolean;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Strict configuration type with branded types
 */
export interface StrictAgentConfig {
  network: Network;
  publicKey: PublicKey;
  privateKey?: string;
  allowMainnet?: boolean;
  defaultSlippage: Percentage;
  defaultTimeout: number; // seconds
  rpcUrl?: string;
  maxFee: Fee;
}

/**
 * Create strict config from plain object
 */
export function createStrictConfig(config: {
  network: string;
  publicKey: string;
  allowMainnet?: boolean;
  defaultSlippage?: number;
  defaultTimeout?: number;
  maxFee?: string;
}): StrictAgentConfig {
  return {
    network: (config.network === 'mainnet' ? 'mainnet' : 'testnet') as Network,
    publicKey: createPublicKey(config.publicKey),
    allowMainnet: config.allowMainnet,
    defaultSlippage: createPercentage(config.defaultSlippage ?? 1),
    defaultTimeout: config.defaultTimeout ?? 300,
    maxFee: createFee(config.maxFee ?? '100'),
  };
}
