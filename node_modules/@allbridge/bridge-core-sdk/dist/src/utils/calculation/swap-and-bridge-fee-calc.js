"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swapAndBridgeFeeCalculation = swapAndBridgeFeeCalculation;
exports.swapAndBridgeFeeCalculationReverse = swapAndBridgeFeeCalculationReverse;
const big_js_1 = require("big.js");
const index_1 = require("./index");
function swapAndBridgeFeeCalculation(amountInTokenPrecision, sourcePoolInfo, destinationPoolInfo) {
    const swapToVUsdCalcResult = swapToVUsd(amountInTokenPrecision, { decimals: sourcePoolInfo.decimals, feeShare: sourcePoolInfo.feeShare }, sourcePoolInfo.poolInfo);
    const swapFromVUsdCalcResult = swapFromVUsd(swapToVUsdCalcResult.amountIncludingCommissionInSystemPrecision, { decimals: destinationPoolInfo.decimals, feeShare: destinationPoolInfo.feeShare }, destinationPoolInfo.poolInfo);
    return { swapToVUsdCalcResult, swapFromVUsdCalcResult };
}
function swapAndBridgeFeeCalculationReverse(amountInTokenPrecision, sourcePoolInfo, destinationPoolInfo) {
    const swapToVUsdCalcResult = swapToVUsdReverse(amountInTokenPrecision, { decimals: destinationPoolInfo.decimals, feeShare: destinationPoolInfo.feeShare }, destinationPoolInfo.poolInfo);
    const swapFromVUsdCalcResult = swapFromVUsdReverse(swapToVUsdCalcResult.amountIncludingCommissionInSystemPrecision, { decimals: sourcePoolInfo.decimals, feeShare: sourcePoolInfo.feeShare }, sourcePoolInfo.poolInfo);
    return {
        swapToVUsdCalcResult,
        swapFromVUsdCalcResult,
    };
}
function swapToVUsd(amount, { feeShare, decimals }, poolInfo) {
    const amountValue = (0, big_js_1.Big)(amount);
    const fee = amountValue.times(feeShare);
    const amountWithoutFee = amountValue.minus(fee);
    return {
        bridgeFeeInTokenPrecision: fee.round().toFixed(),
        amountIncludingCommissionInSystemPrecision: calcSwapToVUsd((0, index_1.toSystemPrecision)(amountWithoutFee, decimals), poolInfo),
        amountExcludingCommissionInSystemPrecision: calcSwapToVUsd((0, index_1.toSystemPrecision)(amountValue, decimals), poolInfo),
    };
}
function calcSwapToVUsd(amountInSystemPrecision, poolInfo) {
    if (amountInSystemPrecision.eq(0)) {
        return "0";
    }
    const tokenBalance = (0, big_js_1.Big)(poolInfo.tokenBalance).plus(amountInSystemPrecision);
    const vUsdNewAmount = (0, index_1.getY)(tokenBalance.toFixed(), poolInfo.aValue, poolInfo.dValue);
    return (0, big_js_1.Big)(poolInfo.vUsdBalance).minus(vUsdNewAmount).round().toFixed();
}
function swapFromVUsd(amount, { feeShare, decimals }, poolInfo) {
    if ((0, big_js_1.Big)(amount).eq(0)) {
        return {
            bridgeFeeInTokenPrecision: "0",
            amountIncludingCommissionInTokenPrecision: "0",
            amountExcludingCommissionInTokenPrecision: "0",
        };
    }
    const amountValue = (0, big_js_1.Big)(amount);
    const vUsdBalance = amountValue.plus(poolInfo.vUsdBalance);
    const newAmount = (0, index_1.getY)(vUsdBalance, poolInfo.aValue, poolInfo.dValue);
    const result = (0, index_1.fromSystemPrecision)((0, big_js_1.Big)(poolInfo.tokenBalance).minus(newAmount), decimals);
    const fee = (0, big_js_1.Big)(result).times(feeShare);
    const resultWithoutFee = (0, big_js_1.Big)(result).minus(fee).round();
    return {
        bridgeFeeInTokenPrecision: fee.round().toFixed(),
        amountIncludingCommissionInTokenPrecision: resultWithoutFee.toFixed(),
        amountExcludingCommissionInTokenPrecision: result.toFixed(),
    };
}
function swapToVUsdReverse(amountInTokenPrecision, { feeShare, decimals }, poolInfo) {
    const reversedFeeShare = (0, big_js_1.Big)(feeShare).div((0, big_js_1.Big)(1).minus(feeShare));
    const fee = (0, big_js_1.Big)(amountInTokenPrecision).times(reversedFeeShare);
    const amountWithFee = (0, big_js_1.Big)(amountInTokenPrecision).plus(fee);
    return {
        bridgeFeeInTokenPrecision: fee.round().toFixed(),
        amountIncludingCommissionInSystemPrecision: calcSwapToVUsdReverse((0, index_1.toSystemPrecision)(amountWithFee, decimals), poolInfo),
        amountExcludingCommissionInSystemPrecision: calcSwapToVUsdReverse((0, index_1.toSystemPrecision)(amountInTokenPrecision, decimals), poolInfo),
    };
}
function calcSwapToVUsdReverse(amountInSystemPrecision, poolInfo) {
    const tokenBalance = (0, big_js_1.Big)(poolInfo.tokenBalance).minus(amountInSystemPrecision);
    const vUsdNewAmount = (0, index_1.getY)(tokenBalance.toFixed(), poolInfo.aValue, poolInfo.dValue);
    return (0, big_js_1.Big)(vUsdNewAmount).minus(poolInfo.vUsdBalance).round().toFixed();
}
function swapFromVUsdReverse(amountInSystemPrecision, { feeShare, decimals }, poolInfo) {
    if ((0, big_js_1.Big)(amountInSystemPrecision).eq(0)) {
        return {
            bridgeFeeInTokenPrecision: "0",
            amountIncludingCommissionInTokenPrecision: "0",
            amountExcludingCommissionInTokenPrecision: "0",
        };
    }
    const vUsdNewAmount = (0, big_js_1.Big)(poolInfo.vUsdBalance).minus(amountInSystemPrecision);
    const tokenBalance = (0, index_1.getY)(vUsdNewAmount.toFixed(), poolInfo.aValue, poolInfo.dValue);
    const inSystemPrecision = (0, big_js_1.Big)(tokenBalance).minus(poolInfo.tokenBalance);
    const amountWithoutFee = (0, index_1.fromSystemPrecision)(inSystemPrecision.toFixed(), decimals);
    const reversedFeeShare = (0, big_js_1.Big)(feeShare).div((0, big_js_1.Big)(1).minus(feeShare));
    const fee = (0, big_js_1.Big)(amountWithoutFee).times(reversedFeeShare);
    const amount = (0, big_js_1.Big)(amountWithoutFee).plus(fee);
    return {
        bridgeFeeInTokenPrecision: fee.round().toFixed(),
        amountIncludingCommissionInTokenPrecision: amount.round().toFixed(),
        amountExcludingCommissionInTokenPrecision: amountWithoutFee.toFixed(),
    };
}
//# sourceMappingURL=swap-and-bridge-fee-calc.js.map