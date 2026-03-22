"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GasOracleContract = exports.Errors = void 0;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
var ContractSpec = stellar_sdk_1.contract.Spec;
var ContractClient = stellar_sdk_1.contract.Client;
exports.Errors = {
    0: { message: "" },
    1: { message: "" },
    2: { message: "" },
    3: { message: "" },
    4: { message: "" },
    5: { message: "" },
    6: { message: "" },
    7: { message: "" },
    8: { message: "" },
    9: { message: "" },
    10: { message: "" },
    11: { message: "" },
    12: { message: "" },
    103: { message: "" },
    104: { message: "" },
    105: { message: "" },
    106: { message: "" },
    107: { message: "" },
    108: { message: "" },
    109: { message: "" },
    203: { message: "" },
    204: { message: "" },
    205: { message: "" },
    206: { message: "" },
    207: { message: "" },
    208: { message: "" },
    209: { message: "" },
    210: { message: "" },
    211: { message: "" },
    212: { message: "" },
    214: { message: "" },
    215: { message: "" },
    216: { message: "" },
    217: { message: "" },
    218: { message: "" },
    300: { message: "" },
    301: { message: "" },
    302: { message: "" },
    303: { message: "" },
    400: { message: "" },
};
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
class GasOracleContract extends ContractClient {
    options;
    constructor(options) {
        super(new ContractSpec([
            "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
            "AAAAAAAAAAAAAAAJc2V0X3ByaWNlAAAAAAAAAwAAAAAAAAAIY2hhaW5faWQAAAAEAAAAAAAAAAVwcmljZQAAAAAAA+gAAAAKAAAAAAAAAAlnYXNfcHJpY2UAAAAAAAPoAAAACgAAAAEAAAPpAAAD7QAAAAAAAAAD",
            "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
            "AAAAAAAAAAAAAAANZ2V0X2dhc19wcmljZQAAAAAAAAEAAAAAAAAACGNoYWluX2lkAAAABAAAAAEAAAPpAAAH0AAAAAlDaGFpbkRhdGEAAAAAAAAD",
            "AAAAAAAAAAAAAAAJZ2V0X3ByaWNlAAAAAAAAAQAAAAAAAAAIY2hhaW5faWQAAAAEAAAAAQAAA+kAAAAKAAAAAw==",
            "AAAAAAAAAAAAAAAcZ2V0X2dhc19jb3N0X2luX25hdGl2ZV90b2tlbgAAAAIAAAAAAAAADm90aGVyX2NoYWluX2lkAAAAAAAEAAAAAAAAAApnYXNfYW1vdW50AAAAAAAKAAAAAQAAA+kAAAAKAAAAAw==",
            "AAAAAAAAAAAAAAAfZ2V0X3RyYW5zYWN0aW9uX2dhc19jb3N0X2luX3VzZAAAAAACAAAAAAAAAA5vdGhlcl9jaGFpbl9pZAAAAAAABAAAAAAAAAAKZ2FzX2Ftb3VudAAAAAAACgAAAAEAAAPpAAAACgAAAAM=",
            "AAAAAAAAAAAAAAAJY3Jvc3NyYXRlAAAAAAAAAQAAAAAAAAAOb3RoZXJfY2hhaW5faWQAAAAAAAQAAAABAAAD6QAAAAoAAAAD",
            "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAPpAAAAEwAAAAM=",
            "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAABAAAD6QAAA+0AAAAAAAAAAw==",
            "AAAAAQAAAAAAAAAAAAAACUNoYWluRGF0YQAAAAAAAAIAAAAAAAAACWdhc19wcmljZQAAAAAAAAoAAAAAAAAABXByaWNlAAAAAAAACg==",
            "AAAAAQAAAAAAAAAAAAAABUFkbWluAAAAAAAAAQAAAAAAAAABMAAAAAAAABM=",
            "AAAAAQAAAAAAAAAAAAAAEEdhc09yYWNsZUFkZHJlc3MAAAABAAAAAAAAAAEwAAAAAAAAEw==",
            "AAAAAQAAAAAAAAAAAAAACEdhc1VzYWdlAAAAAQAAAAAAAAABMAAAAAAAA+wAAAAEAAAACg==",
            "AAAAAQAAAAAAAAAAAAAAC05hdGl2ZVRva2VuAAAAAAEAAAAAAAAAATAAAAAAAAAT",
            "AAAAAQAAAAAAAAAAAAAADVN0b3BBdXRob3JpdHkAAAAAAAABAAAAAAAAAAEwAAAAAAAAEw==",
            "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAKAAAAAAAAAANVW5pbXBsZW1lbnRlZAAAAAAAAAAAAAAAAAAAC0luaXRpYWxpemVkAAAAAAEAAAAAAAAADVVuaW5pdGlhbGl6ZWQAAAAAAAACAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAADAAAAAAAAAApJbnZhbGlkQXJnAAAAAAAEAAAAAAAAAA5JbnZhbGlkQ2hhaW5JZAAAAAAABQAAAAAAAAATSW52YWxpZE90aGVyQ2hhaW5JZAAAAAAGAAAAAAAAAA5HYXNVc2FnZU5vdFNldAAAAAAABwAAAAAAAAANQnJva2VuQWRkcmVzcwAAAAAAAAgAAAAAAAAACE5vdEZvdW5kAAAACQAAAAAAAAAYVG9rZW5JbnN1ZmZpY2llbnRCYWxhbmNlAAAACgAAAAAAAAAKQ2FzdEZhaWxlZAAAAAAACwAAAAAAAAAMVTI1Nk92ZXJmbG93AAAADAAAAAAAAAAKWmVyb0Ftb3VudAAAAAAAZwAAAAAAAAAMUG9vbE92ZXJmbG93AAAAaAAAAAAAAAALWmVyb0NoYW5nZXMAAAAAaQAAAAAAAAARUmVzZXJ2ZXNFeGhhdXN0ZWQAAAAAAABqAAAAAAAAABpJbnN1ZmZpY2llbnRSZWNlaXZlZEFtb3VudAAAAAAAawAAAAAAAAAUQmFsYW5jZVJhdGlvRXhjZWVkZWQAAABsAAAAAAAAAAlGb3JiaWRkZW4AAAAAAABtAAAAAAAAABlVbmF1dGhvcml6ZWRTdG9wQXV0aG9yaXR5AAAAAAAAywAAAAAAAAAOU3dhcFByb2hpYml0ZWQAAAAAAMwAAAAAAAAAEkFtb3VudFRvb0xvd0ZvckZlZQAAAAAAzQAAAAAAAAAWQnJpZGdlVG9UaGVaZXJvQWRkcmVzcwAAAAAAzgAAAAAAAAAORW1wdHlSZWNpcGllbnQAAAAAAM8AAAAAAAAAE1NvdXJjZU5vdFJlZ2lzdGVyZWQAAAAA0AAAAAAAAAAVV3JvbmdEZXN0aW5hdGlvbkNoYWluAAAAAAAA0QAAAAAAAAATVW5rbm93bkFub3RoZXJDaGFpbgAAAADSAAAAAAAAABFUb2tlbnNBbHJlYWR5U2VudAAAAAAAANMAAAAAAAAAEE1lc3NhZ2VQcm9jZXNzZWQAAADUAAAAAAAAAAxOb3RFbm91Z2hGZWUAAADWAAAAAAAAAAlOb01lc3NhZ2UAAAAAAADXAAAAAAAAAA1Ob1JlY2VpdmVQb29sAAAAAAAA2AAAAAAAAAAGTm9Qb29sAAAAAADZAAAAAAAAABNVbmtub3duQW5vdGhlclRva2VuAAAAANoAAAAAAAAAD1dyb25nQnl0ZUxlbmd0aAAAAAEsAAAAAAAAAApIYXNNZXNzYWdlAAAAAAEtAAAAAAAAABdJbnZhbGlkUHJpbWFyeVNpZ25hdHVyZQAAAAEuAAAAAAAAABlJbnZhbGlkU2Vjb25kYXJ5U2lnbmF0dXJlAAAAAAABLwAAAAAAAAARTm9HYXNEYXRhRm9yQ2hhaW4AAAAAAAGQ",
        ]), options);
        this.options = options;
    }
    fromJSON = {
        initialize: (this.txFromJSON),
        set_price: (this.txFromJSON),
        set_admin: (this.txFromJSON),
        get_gas_price: (this.txFromJSON),
        get_price: (this.txFromJSON),
        get_gas_cost_in_native_token: (this.txFromJSON),
        get_transaction_gas_cost_in_usd: (this.txFromJSON),
        crossrate: (this.txFromJSON),
        get_admin: (this.txFromJSON),
        upgrade: (this.txFromJSON),
    };
}
exports.GasOracleContract = GasOracleContract;
//# sourceMappingURL=gas-oracle-contract.js.map