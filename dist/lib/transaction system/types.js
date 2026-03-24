"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AntigravityError = exports.ErrorType = void 0;
var ErrorType;
(function (ErrorType) {
    ErrorType["TRANSIENT"] = "TRANSIENT";
    ErrorType["PERMANENT"] = "PERMANENT";
    ErrorType["UNKNOWN"] = "UNKNOWN";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
class AntigravityError extends Error {
    constructor(message, type, originalError) {
        super(message);
        this.name = "AntigravityError";
        this.type = type;
        this.originalError = originalError;
    }
}
exports.AntigravityError = AntigravityError;
