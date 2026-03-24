"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllbridgeCoreClientImpl = void 0;
class AllbridgeCoreClientImpl {
    apiClient;
    constructor(apiClient) {
        this.apiClient = apiClient;
    }
    async getChainDetailsMap() {
        return (await this.apiClient.getTokenInfo()).chainDetailsMap;
    }
    async tokens() {
        const map = await this.getChainDetailsMap();
        return Object.values(map).flatMap((chainDetails) => chainDetails.tokens);
    }
    async getPendingInfo() {
        return this.apiClient.getPendingInfo();
    }
    async getGasBalance(chainSymbol, address) {
        return this.apiClient.getGasBalance(chainSymbol, address);
    }
    async getChainDetailsMapAndPoolInfoMap() {
        return await this.apiClient.getTokenInfo();
    }
    async getTransferStatus(chainSymbol, txId) {
        return await this.apiClient.getTransferStatus(chainSymbol, txId);
    }
    async getReceiveTransactionCost(args) {
        return await this.apiClient.getReceiveTransactionCost(args);
    }
    async getPoolInfoMap(pools) {
        return await this.apiClient.getPoolInfoMap(pools);
    }
}
exports.AllbridgeCoreClientImpl = AllbridgeCoreClientImpl;
//# sourceMappingURL=core-client-base.js.map