"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultRawPoolTransactionBuilder = void 0;
const calculation_1 = require("../../utils/calculation");
const constants_1 = require("../../utils/calculation/constants");
const utils_1 = require("../../utils/utils");
const index_1 = require("./index");
class DefaultRawPoolTransactionBuilder {
    api;
    nodeRpcUrlsConfig;
    params;
    tokenService;
    constructor(api, nodeRpcUrlsConfig, params, tokenService) {
        this.api = api;
        this.nodeRpcUrlsConfig = nodeRpcUrlsConfig;
        this.params = params;
        this.tokenService = tokenService;
    }
    async approve(a, b) {
        if (b) {
            const provider = a;
            const approveData = b;
            return this.tokenService.buildRawTransactionApprove({
                ...approveData,
                spender: approveData.token.poolAddress,
            }, provider);
        }
        else {
            const approveData = a;
            return this.tokenService.buildRawTransactionApprove({
                ...approveData,
                spender: approveData.token.poolAddress,
            });
        }
    }
    async deposit(params, provider) {
        (0, utils_1.validateAmountGtZero)(params.amount);
        (0, utils_1.validateAmountDecimals)("amount", params.amount, params.token.decimals);
        params.amount = (0, calculation_1.convertFloatAmountToInt)(params.amount, params.token.decimals).toFixed();
        return (0, index_1.getChainPoolService)(params.token.chainSymbol, this.api, this.nodeRpcUrlsConfig, this.params, provider).buildRawTransactionDeposit(params);
    }
    async withdraw(params, provider) {
        (0, utils_1.validateAmountGtZero)(params.amount);
        (0, utils_1.validateAmountDecimals)("amount", params.amount, params.token.decimals);
        params.amount = (0, calculation_1.convertFloatAmountToInt)(params.amount, constants_1.SYSTEM_PRECISION).toFixed();
        return (0, index_1.getChainPoolService)(params.token.chainSymbol, this.api, this.nodeRpcUrlsConfig, this.params, provider).buildRawTransactionWithdraw(params);
    }
    async claimRewards(params, provider) {
        return (0, index_1.getChainPoolService)(params.token.chainSymbol, this.api, this.nodeRpcUrlsConfig, this.params, provider).buildRawTransactionClaimRewards(params);
    }
}
exports.DefaultRawPoolTransactionBuilder = DefaultRawPoolTransactionBuilder;
//# sourceMappingURL=raw-pool-transaction-builder.js.map