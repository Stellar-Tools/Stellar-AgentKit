"use strict";
// @ts-nocheck
Object.defineProperty(exports, "__esModule", { value: true });
exports.vector = void 0;
exports.phantom = phantom;
exports.toBcs = toBcs;
exports.extractType = extractType;
exports.decodeFromFields = decodeFromFields;
exports.decodeFromFieldsWithTypes = decodeFromFieldsWithTypes;
exports.assertReifiedTypeArgsMatch = assertReifiedTypeArgsMatch;
exports.assertFieldsWithTypesArgsMatch = assertFieldsWithTypesArgsMatch;
exports.fieldToJSON = fieldToJSON;
exports.decodeFromJSONField = decodeFromJSONField;
const bcs_1 = require("@mysten/sui/bcs");
const utils_1 = require("@mysten/sui/utils");
const util_1 = require("./util");
// for backwards compatibility
var vector_1 = require("./vector");
Object.defineProperty(exports, "vector", { enumerable: true, get: function () { return vector_1.vector; } });
function phantom(type) {
    if (typeof type === "string") {
        return {
            phantomType: type,
            kind: "PhantomReified",
        };
    }
    else {
        return {
            phantomType: type.fullTypeName,
            kind: "PhantomReified",
        };
    }
}
const Address = bcs_1.bcs.bytes(32).transform({
    input: (val) => (0, utils_1.fromHEX)(val),
    output: (val) => (0, utils_1.toHEX)(val),
});
function toBcs(arg) {
    switch (arg) {
        case "bool":
            return bcs_1.bcs.bool();
        case "u8":
            return bcs_1.bcs.u8();
        case "u16":
            return bcs_1.bcs.u16();
        case "u32":
            return bcs_1.bcs.u32();
        case "u64":
            return bcs_1.bcs.u64();
        case "u128":
            return bcs_1.bcs.u128();
        case "u256":
            return bcs_1.bcs.u256();
        case "address":
            return Address;
        default:
            return arg.bcs;
    }
}
function extractType(reified) {
    switch (reified) {
        case "u8":
        case "u16":
        case "u32":
        case "u64":
        case "u128":
        case "u256":
        case "bool":
        case "address":
            return reified;
    }
    switch (reified.kind) {
        case "PhantomReified":
            return reified.phantomType;
        case "StructClassReified":
            return reified.fullTypeName;
        case "VectorClassReified":
            return reified.fullTypeName;
    }
    throw new Error("unreachable");
}
function decodeFromFields(reified, field) {
    switch (reified) {
        case "bool":
        case "u8":
        case "u16":
        case "u32":
            return field;
        case "u64":
        case "u128":
        case "u256":
            return BigInt(field);
        case "address":
            return `0x${field}`;
    }
    if (reified.kind === "VectorClassReified") {
        return reified.fromFields(field).elements;
    }
    switch (reified.typeName) {
        case "0x1::string::String":
        case "0x1::ascii::String":
            return new TextDecoder().decode(Uint8Array.from(field.bytes)).toString();
        case "0x2::url::Url":
            return new TextDecoder().decode(Uint8Array.from(field.url.bytes)).toString();
        case "0x2::object::ID":
            return `0x${field.bytes}`;
        case "0x2::object::UID":
            return `0x${field.id.bytes}`;
        case "0x1::option::Option": {
            if (field.vec.length === 0) {
                return null;
            }
            return reified.fromFields(field).vec[0];
        }
        default:
            return reified.fromFields(field);
    }
}
function decodeFromFieldsWithTypes(reified, item) {
    switch (reified) {
        case "bool":
        case "u8":
        case "u16":
        case "u32":
            return item;
        case "u64":
        case "u128":
        case "u256":
            return BigInt(item);
        case "address":
            return item;
    }
    if (reified.kind === "VectorClassReified") {
        return reified.fromFieldsWithTypes(item).elements;
    }
    switch (reified.typeName) {
        case "0x1::string::String":
        case "0x1::ascii::String":
        case "0x2::url::Url":
        case "0x2::object::ID":
            return item;
        case "0x2::object::UID":
            return item.id;
        case "0x2::balance::Balance":
            return reified.fromFields({ value: BigInt(item) });
        case "0x1::option::Option": {
            if (item === null) {
                return null;
            }
            return decodeFromFieldsWithTypes(reified.reifiedTypeArgs[0], item);
        }
        default:
            return reified.fromFieldsWithTypes(item);
    }
}
function assertReifiedTypeArgsMatch(fullType, typeArgs, reifiedTypeArgs) {
    if (reifiedTypeArgs.length !== typeArgs.length) {
        throw new Error(`provided item has mismatching number of type argments ${fullType} (expected ${reifiedTypeArgs.length}, got ${typeArgs.length}))`);
    }
    for (let i = 0; i < typeArgs.length; i++) {
        if ((0, util_1.compressSuiType)(typeArgs[i]) !== (0, util_1.compressSuiType)(extractType(reifiedTypeArgs[i]))) {
            throw new Error(`provided item has mismatching type argments ${fullType} (expected ${extractType(reifiedTypeArgs[i])}, got ${typeArgs[i]}))`);
        }
    }
}
function assertFieldsWithTypesArgsMatch(item, reifiedTypeArgs) {
    const { typeArgs: itemTypeArgs } = (0, util_1.parseTypeName)(item.type);
    assertReifiedTypeArgsMatch(item.type, itemTypeArgs, reifiedTypeArgs);
}
function fieldToJSON(type, field) {
    const { typeName, typeArgs } = (0, util_1.parseTypeName)(type);
    switch (typeName) {
        case "bool":
            return field;
        case "u8":
        case "u16":
        case "u32":
            return field;
        case "u64":
        case "u128":
        case "u256":
            return field.toString();
        case "address":
        case "signer":
            return field;
        case "vector":
            return field.map((item) => fieldToJSON(typeArgs[0], item));
        // handle special types
        case "0x1::string::String":
        case "0x1::ascii::String":
        case "0x2::url::Url":
        case "0x2::object::ID":
        case "0x2::object::UID":
            return field;
        case "0x1::option::Option": {
            if (field === null) {
                return null;
            }
            return fieldToJSON(typeArgs[0], field);
        }
        default:
            return field.toJSONField();
    }
}
function decodeFromJSONField(typeArg, field) {
    switch (typeArg) {
        case "bool":
        case "u8":
        case "u16":
        case "u32":
            return field;
        case "u64":
        case "u128":
        case "u256":
            return BigInt(field);
        case "address":
            return field;
    }
    if (typeArg.kind === "VectorClassReified") {
        return typeArg.fromJSONField(field).elements;
    }
    switch (typeArg.typeName) {
        case "0x1::string::String":
        case "0x1::ascii::String":
        case "0x2::url::Url":
        case "0x2::object::ID":
        case "0x2::object::UID":
            return field;
        case "0x1::option::Option": {
            if (field === null) {
                return null;
            }
            return decodeFromJSONField(typeArg.reifiedTypeArgs[0], field);
        }
        default:
            return typeArg.fromJSONField(field);
    }
}
//# sourceMappingURL=reified.js.map