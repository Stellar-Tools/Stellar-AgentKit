"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllbridgeCoreClientFilteredImpl = void 0;
class AllbridgeCoreClientFilteredImpl {
    client;
    isStaging;
    constructor(client, params) {
        this.client = client;
        this.isStaging = params.coreApiQueryParams?.staging === "true";
    }
    async getChainDetailsMap(type) {
        const chainDetailsMapWithFlags = await this.client.getChainDetailsMap();
        const result = {};
        for (const key in chainDetailsMapWithFlags) {
            const chainDetailsWithTokensWithFlag = chainDetailsMapWithFlags[key];
            if (chainDetailsWithTokensWithFlag) {
                result[key] = {
                    ...chainDetailsWithTokensWithFlag,
                    tokens: filterAndConvertToTokenWithChainDetails(chainDetailsWithTokensWithFlag.tokens, type, this.isStaging),
                };
            }
        }
        return result;
    }
    async tokens(type) {
        return filterAndConvertToTokenWithChainDetails(await this.client.tokens(), type, this.isStaging);
    }
    async getPendingInfo() {
        return this.client.getPendingInfo();
    }
    async getGasBalance(chainSymbol, address) {
        return this.client.getGasBalance(chainSymbol, address);
    }
    async getTransferStatus(chainSymbol, txId) {
        return await this.client.getTransferStatus(chainSymbol, txId);
    }
    async getReceiveTransactionCost(args) {
        return await this.client.getReceiveTransactionCost(args);
    }
    cachePut(poolKeyObject, poolInfo) {
        return this.client.cachePut(poolKeyObject, poolInfo);
    }
    getPoolInfoByKey(poolKeyObject) {
        return this.client.getPoolInfoByKey(poolKeyObject);
    }
    refreshPoolInfo(poolKeyObjects) {
        return this.client.refreshPoolInfo(poolKeyObjects);
    }
}
exports.AllbridgeCoreClientFilteredImpl = AllbridgeCoreClientFilteredImpl;
function filterAndConvertToTokenWithChainDetails(tokens, type, isStaging) {
    return tokens.filter((token) => (isStaging ? true : token.flags[type])).map(convertToTokenWithChainDetails);
}
function convertToTokenWithChainDetails(token) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { flags, ...rest } = token;
    return rest;
}
//# sourceMappingURL=core-client-filtered.js.map