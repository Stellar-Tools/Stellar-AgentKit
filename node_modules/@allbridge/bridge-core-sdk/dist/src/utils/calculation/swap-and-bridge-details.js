"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSendAmountDetails = getSendAmountDetails;
const big_js_1 = require("big.js");
const index_1 = require("./index");
function getSendAmountDetails(amountInTokenPrecision, sourceToken, sourcePool, destToken, destPool) {
    const vUsd = (0, index_1.swapToVUsd)(amountInTokenPrecision, sourceToken, sourcePool);
    const vUsdInTokenPrecision = (0, index_1.fromSystemPrecision)(vUsd, sourceToken.decimals);
    const result = (0, index_1.swapFromVUsd)(vUsd, destToken, destPool);
    const swapToFeeInt = (0, big_js_1.Big)(amountInTokenPrecision).times(sourceToken.feeShare);
    const swapFromFeeInt = (0, big_js_1.Big)(result).div((0, big_js_1.Big)(1).minus(destToken.feeShare)).minus(result);
    return {
        sourceLPSwap: {
            fee: (0, index_1.convertIntAmountToFloat)(swapToFeeInt, sourceToken.decimals)
                .neg()
                .round(sourceToken.decimals, big_js_1.Big.roundUp)
                .toFixed(),
            swap: (0, index_1.convertIntAmountToFloat)((0, big_js_1.Big)(amountInTokenPrecision).minus(vUsdInTokenPrecision).minus(swapToFeeInt), sourceToken.decimals)
                .neg()
                .round(sourceToken.decimals, big_js_1.Big.roundUp)
                .toFixed(),
        },
        destLPSwap: {
            fee: (0, index_1.convertIntAmountToFloat)(swapFromFeeInt, destToken.decimals)
                .neg()
                .round(destToken.decimals, big_js_1.Big.roundUp)
                .toFixed(),
            swap: (0, index_1.convertIntAmountToFloat)((0, index_1.fromSystemPrecision)(vUsd, destToken.decimals).minus(result).minus(swapFromFeeInt), destToken.decimals)
                .neg()
                .round(destToken.decimals, big_js_1.Big.roundUp)
                .toFixed(),
        },
    };
}
//# sourceMappingURL=swap-and-bridge-details.js.map