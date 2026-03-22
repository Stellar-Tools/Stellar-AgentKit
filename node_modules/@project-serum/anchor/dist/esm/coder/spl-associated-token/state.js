export class SplAssociatedTokenStateCoder {
    constructor(_idl) { }
    encode(_name, _account) {
        throw new Error("SPL associated token does not have state");
    }
    decode(_ix) {
        throw new Error("SPL associated token does not have state");
    }
}
//# sourceMappingURL=state.js.map