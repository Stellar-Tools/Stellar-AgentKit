"use strict";
/**
 * Advanced Slippage Protection for Stellar AgentKit
 *
 * Provides comprehensive price protection for swaps by:
 * - Calculating actual price impact before execution
 * - Validating minimum amounts with safety margins
 * - Detecting unusual price movements
 * - Offering warnings before executing risky trades
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSwapOutput = calculateSwapOutput;
exports.calculatePriceImpact = calculatePriceImpact;
exports.validateSlippage = validateSlippage;
exports.createSlippageMonitor = createSlippageMonitor;
exports.updatePriceMonitor = updatePriceMonitor;
exports.analyzeTradesafety = analyzeTradesafety;
exports.recommendSlippageTolerance = recommendSlippageTolerance;
const big_js_1 = __importDefault(require("big.js"));
/**
 * Calculate expected output for a swap using constant product formula
 *
 * Formula: Output = (Input * Reserve_Out * (1 - fee)) / (Reserve_In + Input * (1 - fee))
 */
function calculateSwapOutput(options) {
    const { reserveIn, reserveOut, amountIn, feePercent = 0.25 } = options;
    const inAmount = new big_js_1.default(amountIn);
    const rIn = new big_js_1.default(reserveIn);
    const rOut = new big_js_1.default(reserveOut);
    const fee = new big_js_1.default(1 - feePercent / 100);
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
function calculatePriceImpact(options) {
    const { reserveIn, reserveOut, amountIn, feePercent = 0.25 } = options;
    const inAmount = new big_js_1.default(amountIn);
    const rIn = new big_js_1.default(reserveIn);
    const rOut = new big_js_1.default(reserveOut);
    if (rIn.lte(0)) {
        throw new Error('Invalid pool state: reserveIn must be greater than zero');
    }
    if (inAmount.lte(0)) {
        throw new Error('amountIn must be greater than zero');
    }
    // Spot price (no input)
    const spotPrice = rOut.div(rIn);
    // Execution price (with input)
    const amountOut = new big_js_1.default(calculateSwapOutput(options));
    const executionPrice = amountOut.div(inAmount);
    // Price impact percentage
    const priceImpactRaw = spotPrice.minus(executionPrice).div(spotPrice).times(100);
    const priceImpact = parseFloat(priceImpactRaw.toFixed(2));
    // Determine risk level
    let riskLevel = 'low';
    if (priceImpact > 0.5)
        riskLevel = 'medium';
    if (priceImpact > 2)
        riskLevel = 'high';
    if (priceImpact > 5)
        riskLevel = 'extreme';
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
function validateSlippage(amountIn, expectedAmountOut, minAmountOut, maxAllowedSlippage = 1 // Default 1%
) {
    const expected = new big_js_1.default(expectedAmountOut);
    const minimum = new big_js_1.default(minAmountOut);
    if (expected.lte(0)) {
        throw new Error('expectedAmountOut must be greater than zero');
    }
    if (!Number.isFinite(maxAllowedSlippage) || maxAllowedSlippage <= 0) {
        throw new Error(`maxAllowedSlippage must be a finite positive number, got ${maxAllowedSlippage}`);
    }
    if (new big_js_1.default(amountIn).lt(0)) {
        throw new Error('amountIn cannot be negative');
    }
    // Calculate actual slippage
    const slippage = expected.minus(minimum).div(expected).times(100);
    const slippagePercent = parseFloat(slippage.toFixed(2));
    // Determine risk level
    let riskLevel = 'low';
    if (slippagePercent > 0.5)
        riskLevel = 'medium';
    if (slippagePercent > 2)
        riskLevel = 'high';
    if (slippagePercent > 5)
        riskLevel = 'extreme';
    // Calculate deficit
    const difference = expected.minus(minimum);
    const deficit = difference.div(expected).times(100);
    // Recommended minimum (with safety margin)
    const safetyMargin = maxAllowedSlippage * 0.8; // Use 80% of max
    const recommended = expected.times(1 - safetyMargin / 100);
    // Validation result
    const valid = slippagePercent <= maxAllowedSlippage;
    let warning;
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
function createSlippageMonitor(initialPrice, maxSlippage) {
    const price = new big_js_1.default(initialPrice);
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
function updatePriceMonitor(monitor, currentPrice) {
    const current = new big_js_1.default(currentPrice);
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
function analyzeTradesafety(priceImpact, slippageValidation, liquidity // Total liquidity in pool
) {
    const warnings = [];
    const recommendations = [];
    let riskLevel = 'low';
    // Check price impact
    if (priceImpact.priceImpact > 5) {
        warnings.push(`High price impact: ${priceImpact.priceImpact.toFixed(2)}%`);
        riskLevel = 'extreme';
        recommendations.push('Consider breaking the trade into smaller swaps');
    }
    else if (priceImpact.priceImpact > 2) {
        warnings.push(`Moderate price impact: ${priceImpact.priceImpact.toFixed(2)}%`);
        riskLevel = 'high';
    }
    else if (priceImpact.priceImpact > 0.5) {
        riskLevel = 'medium';
    }
    // Check slippage
    if (!slippageValidation.valid) {
        warnings.push(`Slippage exceeds limit: ${slippageValidation.difference}`);
        if (riskLevel === 'low')
            riskLevel = 'high';
    }
    if (slippageValidation.warning) {
        warnings.push(slippageValidation.warning);
    }
    // Check trade size vs liquidity
    const tradeSize = new big_js_1.default(priceImpact.amountIn);
    const liquidityBig = new big_js_1.default(liquidity);
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
function recommendSlippageTolerance(priceImpact, volatility = 1 // Volatility multiplier (1 = normal)
) {
    // Base tolerance increases with price impact
    let tolerance = Math.max(0.1, priceImpact * 1.5);
    // Add volatility factor
    tolerance *= volatility;
    // Round to nearest 0.5%
    return Math.ceil(tolerance * 2) / 2;
}
