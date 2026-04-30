import Big from "big.js";
import { RouteQuote, StellarAssetInput } from "./dex";

/**
 * Advanced slippage protection and MEV defense for Stellar DEX operations
 */

export interface SlippageConfig {
  maxSlippageBps: number;
  priceImpactWarningThreshold: number;
  sandwichDetectionEnabled: boolean;
  mevProtectionEnabled: boolean;
  routeValidationEnabled: boolean;
}

export interface PriceImpactAnalysis {
  priceImpactBps: number;
  isHighImpact: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendation: string;
  maxSafeAmount?: string;
}

export interface RouteValidationResult {
  isValid: boolean;
  riskFactors: string[];
  optimizedRoute?: RouteQuote;
  securityScore: number;
}

export interface SlippageProtectionResult {
  adjustedSlippageBps: number;
  priceImpact: PriceImpactAnalysis;
  routeValidation: RouteValidationResult;
  mevRisk: MEVRiskAssessment;
  shouldProceed: boolean;
  warnings: string[];
}

export interface MEVRiskAssessment {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  sandwichRisk: number;
  frontRunningRisk: number;
  recommendations: string[];
}

export class SlippageProtectionManager {
  private config: SlippageConfig;

  constructor(config: Partial<SlippageConfig> = {}) {
    this.config = {
      maxSlippageBps: config.maxSlippageBps ?? 500,
      priceImpactWarningThreshold: config.priceImpactWarningThreshold ?? 100,
      sandwichDetectionEnabled: config.sandwichDetectionEnabled ?? true,
      mevProtectionEnabled: config.mevProtectionEnabled ?? true,
      routeValidationEnabled: config.routeValidationEnabled ?? true,
    };
  }

  public analyzeSlippageProtection(
    quote: RouteQuote,
    requestedSlippageBps: number,
    tradeAmount: string,
    sendAsset: StellarAssetInput,
    destAsset: StellarAssetInput
  ): SlippageProtectionResult {
    this.validateSlippageBounds(requestedSlippageBps);

    const priceImpact = this.analyzePriceImpact(quote, tradeAmount, sendAsset, destAsset);
    const routeValidation = this.validateRoute(quote, sendAsset, destAsset);
    const mevRisk = this.assessMEVRisk(quote, tradeAmount, requestedSlippageBps);
    const adjustedSlippageBps = this.calculateOptimalSlippage(requestedSlippageBps, priceImpact, mevRisk);
    const shouldProceed = this.shouldAllowTrade(priceImpact, routeValidation, mevRisk);
    const warnings = this.generateWarnings(priceImpact, routeValidation, mevRisk, adjustedSlippageBps);

    return {
      adjustedSlippageBps,
      priceImpact,
      routeValidation,
      mevRisk,
      shouldProceed,
      warnings
    };
  }

  private validateSlippageBounds(slippageBps: number): void {
    if (slippageBps < 0) {
      throw new Error("🛡️ Slippage tolerance cannot be negative");
    }

    if (slippageBps > this.config.maxSlippageBps) {
      throw new Error(
        `🛡️ Slippage tolerance ${slippageBps / 100}% exceeds maximum allowed ${this.config.maxSlippageBps / 100}%.\n` +
        `High slippage increases risk of sandwich attacks and significant losses.`
      );
    }

    if (slippageBps > 200) {
      console.warn(
        `⚠️  HIGH SLIPPAGE WARNING: ${slippageBps / 100}% slippage tolerance is high.\n` +
        `This increases risk of MEV attacks and unexpected losses.`
      );
    }
  }

  private analyzePriceImpact(
    quote: RouteQuote,
    tradeAmount: string,
    sendAsset: StellarAssetInput,
    destAsset: StellarAssetInput
  ): PriceImpactAnalysis {
    const amount = new Big(tradeAmount);
    const baseImpactBps = this.calculateBasePriceImpact(amount, sendAsset, destAsset);
    const routeComplexityMultiplier = 1 + (quote.hopCount * 0.1);
    const adjustedImpactBps = Math.floor(baseImpactBps * routeComplexityMultiplier);

    let riskLevel: PriceImpactAnalysis['riskLevel'] = 'LOW';
    let recommendation = 'Trade appears safe to proceed.';
    let maxSafeAmount: string | undefined;

    if (adjustedImpactBps > 1000) {
      riskLevel = 'CRITICAL';
      recommendation = 'CRITICAL: Extremely high price impact. Consider splitting into multiple smaller trades.';
      maxSafeAmount = amount.div(4).toString();
    } else if (adjustedImpactBps > 500) {
      riskLevel = 'HIGH';
      recommendation = 'HIGH RISK: Significant price impact detected. Consider reducing trade size.';
      maxSafeAmount = amount.div(2).toString();
    } else if (adjustedImpactBps > 200) {
      riskLevel = 'MEDIUM';
      recommendation = 'MEDIUM RISK: Moderate price impact. Monitor execution carefully.';
    }

    return {
      priceImpactBps: adjustedImpactBps,
      isHighImpact: adjustedImpactBps > this.config.priceImpactWarningThreshold,
      riskLevel,
      recommendation,
      maxSafeAmount
    };
  }

  private calculateBasePriceImpact(
    amount: Big,
    sendAsset: StellarAssetInput,
    destAsset: StellarAssetInput
  ): number {
    const isNativeInvolved = 'type' in sendAsset || 'type' in destAsset;
    const baseImpact = isNativeInvolved ? 10 : 25;
    const sizeMultiplier = Math.log10(amount.toNumber() + 1) / 2;
    return Math.floor(baseImpact * sizeMultiplier);
  }

  private validateRoute(
    quote: RouteQuote,
    sendAsset: StellarAssetInput,
    destAsset: StellarAssetInput
  ): RouteValidationResult {
    const riskFactors: string[] = [];
    let securityScore = 100;

    if (quote.hopCount > 3) {
      riskFactors.push('Route has many hops, increasing complexity and gas costs');
      securityScore -= 15;
    }

    if (this.hasCircularPath(quote.path, sendAsset, destAsset)) {
      riskFactors.push('Circular route detected - may indicate inefficient pathfinding');
      securityScore -= 25;
    }

    const hasUnknownAssets = this.checkForUnknownAssets(quote.path);
    if (hasUnknownAssets) {
      riskFactors.push('Route contains assets with unknown liquidity characteristics');
      securityScore -= 20;
    }

    const priceConsistency = this.validatePriceConsistency(quote);
    if (!priceConsistency) {
      riskFactors.push('Price inconsistency detected in route');
      securityScore -= 30;
    }

    return {
      isValid: securityScore >= 50,
      riskFactors,
      securityScore,
    };
  }

  private assessMEVRisk(
    quote: RouteQuote,
    tradeAmount: string,
    slippageBps: number
  ): MEVRiskAssessment {
    const amount = new Big(tradeAmount);
    const sandwichRisk = this.calculateSandwichRisk(amount, slippageBps, quote.hopCount);
    const frontRunningRisk = this.calculateFrontRunningRisk(amount, quote.estimatedPrice);
    
    let riskLevel: MEVRiskAssessment['riskLevel'] = 'LOW';
    const recommendations: string[] = [];

    if (sandwichRisk > 70 || frontRunningRisk > 70) {
      riskLevel = 'HIGH';
      recommendations.push('Consider using private mempool or splitting trade');
      recommendations.push('Reduce slippage tolerance to minimize MEV extraction');
    } else if (sandwichRisk > 40 || frontRunningRisk > 40) {
      riskLevel = 'MEDIUM';
      recommendations.push('Monitor transaction carefully for MEV attacks');
      recommendations.push('Consider timing trade during low network activity');
    } else {
      recommendations.push('MEV risk is low - trade appears safe');
    }

    return {
      riskLevel,
      sandwichRisk,
      frontRunningRisk,
      recommendations
    };
  }

  private calculateSandwichRisk(amount: Big, slippageBps: number, hopCount: number): number {
    const amountRisk = Math.min(amount.toNumber() / 10000, 50);
    const slippageRisk = Math.min(slippageBps / 10, 30);
    const complexityRisk = Math.min(hopCount * 5, 20);
    return Math.floor(amountRisk + slippageRisk + complexityRisk);
  }

  private calculateFrontRunningRisk(amount: Big, estimatedPrice: string): number {
    const price = new Big(estimatedPrice);
    const attractivenessScore = amount.mul(price).toNumber() / 1000;
    return Math.min(Math.floor(attractivenessScore), 100);
  }

  private calculateOptimalSlippage(
    requestedSlippageBps: number,
    priceImpact: PriceImpactAnalysis,
    mevRisk: MEVRiskAssessment
  ): number {
    let adjustedSlippage = requestedSlippageBps;

    if (mevRisk.riskLevel === 'HIGH') {
      adjustedSlippage = Math.min(adjustedSlippage, 100);
    } else if (mevRisk.riskLevel === 'MEDIUM') {
      adjustedSlippage = Math.min(adjustedSlippage, 200);
    }

    if (priceImpact.riskLevel === 'HIGH' || priceImpact.riskLevel === 'CRITICAL') {
      adjustedSlippage = Math.max(adjustedSlippage, priceImpact.priceImpactBps + 50);
    }

    return Math.min(adjustedSlippage, this.config.maxSlippageBps);
  }

  private shouldAllowTrade(
    priceImpact: PriceImpactAnalysis,
    routeValidation: RouteValidationResult,
    mevRisk: MEVRiskAssessment
  ): boolean {
    if (priceImpact.riskLevel === 'CRITICAL') return false;
    if (!routeValidation.isValid) return false;
    if (mevRisk.riskLevel === 'HIGH' && priceImpact.riskLevel === 'HIGH') return false;
    return true;
  }

  private generateWarnings(
    priceImpact: PriceImpactAnalysis,
    routeValidation: RouteValidationResult,
    mevRisk: MEVRiskAssessment,
    adjustedSlippageBps: number
  ): string[] {
    const warnings: string[] = [];

    if (priceImpact.isHighImpact) {
      warnings.push(`⚠️  Price Impact: ${priceImpact.priceImpactBps / 100}% - ${priceImpact.recommendation}`);
    }

    if (mevRisk.riskLevel !== 'LOW') {
      warnings.push(`🛡️ MEV Risk: ${mevRisk.riskLevel} - Consider using private mempool`);
    }

    if (routeValidation.riskFactors.length > 0) {
      warnings.push(`🔍 Route Issues: ${routeValidation.riskFactors.join(', ')}`);
    }

    if (adjustedSlippageBps > 300) {
      warnings.push(`📊 High Slippage: ${adjustedSlippageBps / 100}% - Monitor execution carefully`);
    }

    return warnings;
  }

  private hasCircularPath(path: StellarAssetInput[], sendAsset: StellarAssetInput, destAsset: StellarAssetInput): boolean {
    return path.some(asset => 
      this.assetsEqual(asset, sendAsset) || this.assetsEqual(asset, destAsset)
    );
  }

  private checkForUnknownAssets(path: StellarAssetInput[]): boolean {
    return path.some(asset => !('type' in asset));
  }

  private validatePriceConsistency(quote: RouteQuote): boolean {
    const price = new Big(quote.estimatedPrice);
    return price.gt(0) && price.lt(1000000);
  }

  private assetsEqual(asset1: StellarAssetInput, asset2: StellarAssetInput): boolean {
    if ('type' in asset1 && 'type' in asset2) return true;
    if ('type' in asset1 || 'type' in asset2) return false;
    return asset1.code === asset2.code && asset1.issuer === asset2.issuer;
  }
}

export function createSlippageProtection(config?: Partial<SlippageConfig>): SlippageProtectionManager {
  return new SlippageProtectionManager(config);
}

export function validateSlippage(slippageBps: number, maxAllowed: number = 500): void {
  if (slippageBps < 0) {
    throw new Error("🛡️ Slippage tolerance cannot be negative");
  }
  
  if (slippageBps > maxAllowed) {
    throw new Error(
      `🛡️ Slippage tolerance ${slippageBps / 100}% exceeds maximum ${maxAllowed / 100}%`
    );
  }
}