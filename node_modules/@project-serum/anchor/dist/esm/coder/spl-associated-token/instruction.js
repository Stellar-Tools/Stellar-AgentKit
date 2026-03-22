import camelCase from "camelcase";
export class SplAssociatedTokenInstructionCoder {
    constructor(_) { }
    encode(ixName, _) {
        switch (camelCase(ixName)) {
            case "create": {
                return Buffer.alloc(0);
            }
            default: {
                throw new Error(`Invalid instruction: ${ixName}`);
            }
        }
    }
    encodeState(_ixName, _ix) {
        throw new Error("SPL associated token does not have state");
    }
}
//# sourceMappingURL=instruction.js.map