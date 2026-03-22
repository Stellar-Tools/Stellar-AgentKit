import { BcsType } from "@mysten/sui/bcs";
import { FieldsWithTypes } from "./util";
import { SuiClient, SuiParsedData, SuiObjectData } from "@mysten/sui/client";
export { vector } from "./vector";
export interface StructClass {
    readonly $typeName: string;
    readonly $fullTypeName: string;
    readonly $typeArgs: string[];
    readonly $isPhantom: readonly boolean[];
    toJSONField(): Record<string, any>;
    toJSON(): Record<string, any>;
    __StructClass: true;
}
export interface VectorClass {
    readonly $typeName: "vector";
    readonly $fullTypeName: string;
    readonly $typeArgs: [string];
    readonly $isPhantom: readonly [false];
    toJSONField(): any[];
    toJSON(): Record<string, any>;
    readonly elements: any;
    __VectorClass: true;
}
export type Primitive = "bool" | "u8" | "u16" | "u32" | "u64" | "u128" | "u256" | "address";
export type TypeArgument = StructClass | Primitive | VectorClass;
export interface StructClassReified<T extends StructClass, Fields> {
    typeName: T["$typeName"];
    fullTypeName: ToTypeStr<T>;
    typeArgs: T["$typeArgs"];
    isPhantom: T["$isPhantom"];
    reifiedTypeArgs: Array<Reified<TypeArgument, any> | PhantomReified<PhantomTypeArgument>>;
    bcs: BcsType<any>;
    fromFields(fields: Record<string, any>): T;
    fromFieldsWithTypes(item: FieldsWithTypes): T;
    fromBcs(data: Uint8Array): T;
    fromJSONField: (field: any) => T;
    fromJSON: (json: Record<string, any>) => T;
    fromSuiParsedData: (content: SuiParsedData) => T;
    fromSuiObjectData: (data: SuiObjectData) => T;
    fetch: (client: SuiClient, id: string) => Promise<T>;
    new: (fields: Fields) => T;
    kind: "StructClassReified";
}
export interface VectorClassReified<T extends VectorClass, Elements> {
    typeName: T["$typeName"];
    fullTypeName: ToTypeStr<T>;
    typeArgs: T["$typeArgs"];
    isPhantom: readonly [false];
    reifiedTypeArgs: Array<Reified<TypeArgument, any>>;
    bcs: BcsType<any>;
    fromFields(fields: any[]): T;
    fromFieldsWithTypes(item: FieldsWithTypes): T;
    fromBcs(data: Uint8Array): T;
    fromJSONField: (field: any) => T;
    fromJSON: (json: Record<string, any>) => T;
    new: (elements: Elements) => T;
    kind: "VectorClassReified";
}
export type Reified<T extends TypeArgument, Fields> = T extends Primitive ? Primitive : T extends StructClass ? StructClassReified<T, Fields> : T extends VectorClass ? VectorClassReified<T, Fields> : never;
export type ToTypeArgument<T extends Primitive | StructClassReified<StructClass, any> | VectorClassReified<VectorClass, any>> = T extends Primitive ? T : T extends StructClassReified<infer U, any> ? U : T extends VectorClassReified<infer U, any> ? U : never;
export type ToPhantomTypeArgument<T extends PhantomReified<PhantomTypeArgument>> = T extends PhantomReified<infer U> ? U : never;
export type PhantomTypeArgument = string;
export interface PhantomReified<P> {
    phantomType: P;
    kind: "PhantomReified";
}
export declare function phantom<T extends Reified<TypeArgument, any>>(reified: T): PhantomReified<ToTypeStr<ToTypeArgument<T>>>;
export declare function phantom<P extends PhantomTypeArgument>(phantomType: P): PhantomReified<P>;
export type ToTypeStr<T extends TypeArgument> = T extends Primitive ? T : T extends StructClass ? T["$fullTypeName"] : T extends VectorClass ? T["$fullTypeName"] : never;
export type PhantomToTypeStr<T extends PhantomTypeArgument> = T extends PhantomTypeArgument ? T : never;
export type ToJSON<T extends TypeArgument> = T extends "bool" ? boolean : T extends "u8" ? number : T extends "u16" ? number : T extends "u32" ? number : T extends "u64" ? string : T extends "u128" ? string : T extends "u256" ? string : T extends "address" ? string : T extends {
    $typeName: "0x1::string::String";
} ? string : T extends {
    $typeName: "0x1::ascii::String";
} ? string : T extends {
    $typeName: "0x2::object::UID";
} ? string : T extends {
    $typeName: "0x2::object::ID";
} ? string : T extends {
    $typeName: "0x2::url::Url";
} ? string : T extends {
    $typeName: "0x1::option::Option";
    __inner: infer U extends TypeArgument;
} ? ToJSON<U> | null : T extends VectorClass ? ReturnType<T["toJSONField"]> : T extends StructClass ? ReturnType<T["toJSONField"]> : never;
export type ToField<T extends TypeArgument> = T extends "bool" ? boolean : T extends "u8" ? number : T extends "u16" ? number : T extends "u32" ? number : T extends "u64" ? bigint : T extends "u128" ? bigint : T extends "u256" ? bigint : T extends "address" ? string : T extends {
    $typeName: "0x1::string::String";
} ? string : T extends {
    $typeName: "0x1::ascii::String";
} ? string : T extends {
    $typeName: "0x2::object::UID";
} ? string : T extends {
    $typeName: "0x2::object::ID";
} ? string : T extends {
    $typeName: "0x2::url::Url";
} ? string : T extends {
    $typeName: "0x1::option::Option";
    __inner: infer U extends TypeArgument;
} ? ToField<U> | null : T extends VectorClass ? T["elements"] : T extends StructClass ? T : never;
export declare function toBcs<T extends Reified<TypeArgument, any>>(arg: T): BcsType<any>;
export declare function extractType<T extends Reified<TypeArgument, any>>(reified: T): ToTypeStr<ToTypeArgument<T>>;
export declare function extractType<T extends PhantomReified<PhantomTypeArgument>>(reified: T): PhantomToTypeStr<ToPhantomTypeArgument<T>>;
export declare function extractType<T extends Reified<TypeArgument, any> | PhantomReified<PhantomTypeArgument>>(reified: T): string;
export declare function decodeFromFields(reified: Reified<TypeArgument, any>, field: any): any;
export declare function decodeFromFieldsWithTypes(reified: Reified<TypeArgument, any>, item: any): any;
export declare function assertReifiedTypeArgsMatch(fullType: string, typeArgs: string[], reifiedTypeArgs: Array<Reified<TypeArgument, any> | PhantomReified<string>>): void;
export declare function assertFieldsWithTypesArgsMatch(item: FieldsWithTypes, reifiedTypeArgs: Array<Reified<TypeArgument, any> | PhantomReified<string>>): void;
export declare function fieldToJSON<T extends TypeArgument>(type: string, field: ToField<T>): ToJSON<T>;
export declare function decodeFromJSONField(typeArg: Reified<TypeArgument, any>, field: any): any;
