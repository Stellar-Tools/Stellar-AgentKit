"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensure = ensure;
function ensure(argument, message) {
    if (argument === undefined || argument === null) {
        throw new TypeError(message || "This value was promised to be there.");
    }
    return argument;
}
