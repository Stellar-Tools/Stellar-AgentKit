/**
 * Advanced Slippage Protection for Stellar AgentKit
 * 
 * Provides comprehensive price protection for swaps by:
 * - Calculating actual price impact before execution
 * - Validating minimum amounts with safety margins
 * - Detecting unusual price movements
 * - Offering warnings before executing risky trades
 */

import Big from 'big.js';

/**
 * Price calculation options
 */
export interface PriceCalculationOptions {
  reserveIn: string;      // Token A reserve
  reserveOut: string;     // Token B reserve
  amountIn: string;       // Input amount
  feePercent?: number;    // DEX fee (default 0.25%)
}

/**
 * Price impact details
 */
export interface PriceImpactInfo {
  amountIn: string;
  amountOut: string;
  executionPrice: string;       // Amount out per 1 unit in
  priceImpact: number;          // Percentage (0-100)
  priceImpactRaw: Big;          // Exact price impact
  spotPrice: string;            // Spot price (no impact)
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
}

/**
 * Slippage validation result
 */
export interface SlippageValidation {
  valid: boolean;
  minAmountOut: string;           // Minimum required output
  actualMinAmount: string;        // What user specified
  difference: string;             // Deficit
  recommended: string;            // Recommended min amount
  warning?: string;               // Warning message
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
}

/**
 * Slippage monitor for tracking price movements
 */
export interface SlippageMonitor {
  initialPrice: Big;
  currentPrice: Big;
  maxSlippage: number;            // Percentage (0-100)
  priceDeviation: number;         // Current deviation %
  isWithinLimit: boolean;
}

/**
 * Calculate expected output for a swap using constant product formula
 * 
 * Formula: Output = (Input * Reserve_Out * (1 - fee)) / (Reserve_In + Input * (1 - fee))
 */
export function calculateSwapOutput(options: PriceCalculationOptions): string {
  const { reserveIn, reserveOut, amountIn, feePercent = 0.25 } = options;

  const inAmount = new Big(amountIn);
  const rIn = new Big(reserveIn);
  const rOut = new Big(reserveOut);
  const fee = new Big(1 - feePercent / 100);

  // Input amount after fee
  const amountInWithFee = inAmount.times(fee);
  const denominator = rIn.plus(amountInWithFee);

  if (denominator.lte(0)) {
    throw new Error('Invalid pool state: swap denominator must be greater than zero');
  }

  // Output = (amountInWithFee * rOut) / (rIn + amountInWithFee)
  const output = amountInWithFee.times(rOut).div(denominator);

  return output.toFixed(7);
}

/**
 * Calculate price impact for a swap
 */
export function calculatePriceImpact(options: PriceCalculationOptions): PriceImpactInfo {
  const { reserveIn, reserveOut, amountIn, feePercent = 0.25 } = options;

  const inAmount = new Big(amountIn);
  const rIn = new Big(reserveIn);
  const rOut = new Big(reserveOut);

  if (rIn.lte(0)) {
    throw new Error('Invalid pool state: reserveIn must be greater than zero');
  }
  if (inAmount.lte(0)) {
    throw new Error('amountIn must be greater than zero');
  }

  // Spot price (no input)
  const spotPrice = rOut.div(rIn);

  // Execution price (with input)
  const amountOut = new Big(calculateSwapOutput(options));
  const executionPrice = amountOut.div(inAmount);

  // Price impact percentage
  const priceImpactRaw = spotPrice.minus(executionPrice).div(spotPrice).times(100);
  const priceImpact = parseFloat(priceImpactRaw.toFixed(2));

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'extreme' = 'low';
  if (priceImpact > 0.5) riskLevel = 'medium';
  if (priceImpact > 2) riskLevel = 'high';
  if (priceImpact > 5) riskLevel = 'extreme';

  return {
    amountIn: amountIn,
    amountOut: amountOut.toFixed(7),
    executionPrice: executionPrice.toFixed(7),
    priceImpact,
    priceImpactRaw,
    spotPrice: spotPrice.toFixed(7),
    riskLevel,
  };
}

/**
 * Validate slippage tolerance for a swap
 */
export function validateSlippage(
  amountIn: string,
  expectedAmountOut: string,
  minAmountOut: string,
  maxAllowedSlippage: number = 1  // Default 1%
): SlippageValidation {
  const expected = new Big(expectedAmountOut);
  const minimum = new Big(minAmountOut);

  if (expected.lte(0)) {
    throw new Error('expectedAmountOut must be greater than zero');
  }
  if (!Number.isFinite(maxAllowedSlippage) || maxAllowedSlippage <= 0) {
    throw new Error(`maxAllowedSlippage must be a finite positive number, got ${maxAllowedSlippage}`);
  }
  if (new Big(amountIn).lt(0)) {
    throw new Error('amountIn cannot be negative');
  }

  // Calculate actual slippage
  const slippage = expected.minus(minimum).div(expected).times(100);
  const slippagePercent = parseFloat(slippage.toFixed(2));

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'extreme' = 'low';
  if (slippagePercent > 0.5) riskLevel = 'medium';
  if (slippagePercent > 2) riskLevel = 'high';
  if (slippagePercent > 5) riskLevel = 'extreme';

  // Calculate deficit
  const difference = expected.minus(minimum);
  const deficit = difference.div(expected).times(100);

  // Recommended minimum (with safety margin)
  const safetyMargin = maxAllowedSlippage * 0.8; // Use 80% of max
  const recommended = expected.times(1 - safetyMargin / 100);

  // Validation result
  const valid = slippagePercent <= maxAllowedSlippage;
  let warning: string | undefined;

  if (slippagePercent > maxAllowedSlippage * 0.7) {
    warning = `Slippage is ${slippagePercent.toFixed(2)}%, approaching your limit of ${maxAllowedSlippage}%`;
  }

  if (riskLevel === 'extreme') {
    warning = `⚠️ EXTREME RISK: ${slippagePercent.toFixed(2)}% slippage detected. Consider smaller trade size.`;
  }

  if (riskLevel === 'high') {
    warning = `⚠️ HIGH RISK: ${slippagePercent.toFixed(2)}% slippage. Market may be volatile.`;
  }

  return {
    valid,
    minAmountOut,
    actualMinAmount: minimum.toFixed(7),
    difference: difference.toFixed(7),
    recommended: recommended.toFixed(7),
    warning,
    riskLevel,
  };
}

/**
 * Create a price monitor to track movements during execution
 */
export function createSlippageMonitor(initialPrice: string, maxSlippage: number): SlippageMonitor {
  const price = new Big(initialPrice);

  return {
    initialPrice: price,
    currentPrice: price,
    maxSlippage,
    priceDeviation: 0,
    isWithinLimit: true,
  };
}

/**
 * Update price monitor with current price
 */
export function updatePriceMonitor(
  monitor: SlippageMonitor,
  currentPrice: string
): SlippageMonitor {
  const current = new Big(currentPrice);

  if (monitor.initialPrice.eq(0)) {
    throw new Error('initialPrice must be greater than zero');
  }

  const deviation = monitor.initialPrice.minus(current)
    .div(monitor.initialPrice)
    .times(100);

  const deviationPercent = parseFloat(deviation.toFixed(2));

  return {
    ...monitor,
    currentPrice: current,
    priceDeviation: deviationPercent,
    isWithinLimit: Math.abs(deviationPercent) <= monitor.maxSlippage,
  };
}

/**
 * Analyze trade safety based on multiple factors
 */
export function analyzeTradesafety(
  priceImpact: PriceImpactInfo,
  slippageValidation: SlippageValidation,
  liquidity: string  // Total liquidity in pool
): {
  safeToExecute: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  warnings: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' | 'extreme' = 'low';

  // Check price impact
  if (priceImpact.priceImpact > 5) {
    warnings.push(`High price impact: ${priceImpact.priceImpact.toFixed(2)}%`);
    riskLevel = 'extreme';
    recommendations.push('Consider breaking the trade into smaller swaps');
  } else if (priceImpact.priceImpact > 2) {
    warnings.push(`Moderate price impact: ${priceImpact.priceImpact.toFixed(2)}%`);
    riskLevel = 'high';
  } else if (priceImpact.priceImpact > 0.5) {
    riskLevel = 'medium';
  }

  // Check slippage
  if (!slippageValidation.valid) {
    warnings.push(`Slippage exceeds limit: ${slippageValidation.difference}`);
    if (riskLevel === 'low') riskLevel = 'high';
  }

  if (slippageValidation.warning) {
    warnings.push(slippageValidation.warning);
  }

  // Check trade size vs liquidity
  const tradeSize = new Big(priceImpact.amountIn);
  const liquidityBig = new Big(liquidity);

  if (liquidityBig.lte(0)) {
    throw new Error('liquidity must be greater than zero');
  }

  const tradeSizePercent = tradeSize.div(liquidityBig).times(100);

  if (tradeSizePercent.gt(10)) {
    warnings.push(`Large trade: ${tradeSizePercent.toFixed(2)}% of pool liquidity`);
    recommendations.push('Liquidity is limited - swap may fail or be slipped significantly');
  }

  return {
    safeToExecute: warnings.length === 0 && riskLevel !== 'extreme',
    riskLevel,
    warnings,
    recommendations,
  };
}

/**
 * Calculate recommended slippage tolerance based on market conditions
 */
export function recommendSlippageTolerance(
  priceImpact: number,
  volatility: number = 1 // Volatility multiplier (1 = normal)
): number {
  // Base tolerance increases with price impact
  let tolerance = Math.max(0.1, priceImpact * 1.5);

  // Add volatility factor
  tolerance *= volatility;

  // Round to nearest 0.5%
  return Math.ceil(tolerance * 2) / 2;
}
