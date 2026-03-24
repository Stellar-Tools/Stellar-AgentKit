"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerClasses = registerClasses;
// @ts-nocheck
const package_source_1 = __importStar(require("../_dependencies/source/0x1/init"));
const package_source_31cc14d80c175ae39777c0238f20594c6d4869cfab199f40b69f3319956b8beb = __importStar(require("../_dependencies/source/0x31cc14d80c175ae39777c0238f20594c6d4869cfab199f40b69f3319956b8beb/init"));
const package_source_346e3233f61eb0055713417bfaddda7dc3bf26816faad1f7606994a368b92917 = __importStar(require("../_dependencies/source/0x346e3233f61eb0055713417bfaddda7dc3bf26816faad1f7606994a368b92917/init"));
const package_source_4931e06dce648b3931f890035bd196920770e913e43e45990b383f6486fdd0a5 = __importStar(require("../_dependencies/source/0x4931e06dce648b3931f890035bd196920770e913e43e45990b383f6486fdd0a5/init"));
const package_source_f47329f4344f3bf0f8e436e2f7b485466cff300f12a166563995d3888c296a94 = __importStar(require("../_dependencies/source/0xf47329f4344f3bf0f8e436e2f7b485466cff300f12a166563995d3888c296a94/init"));
const package_source_a2b1c8af2a4f4624362c4a7d0f91fb6b0921e780ffb2c07701901c734d75d2e3 = __importStar(require("../bridge/init"));
const package_source_cfb3ada02ea9b40f2beb396f5f781689a2f6862d224e6c9854e175d14278f9f5 = __importStar(require("../cctp-bridge/init"));
const package_source_34ae5595909bdfcd61191f6e5aabf0024250194f738b82df186fdd4fb18aa7ec = __importStar(require("../gas-oracle/init"));
const package_source_73d4d15293c2482646cdfc28c58da0f9eef64c577e9c0d2bbf614c1623346b49 = __importStar(require("../messenger/init"));
const package_source_2 = __importStar(require("../sui/init"));
const package_source_4dacc15807ba7ccfcdfcc2d0498401bbf504d112a5959323660d757a02b850d4 = __importStar(require("../utils/init"));
const package_source_0 = __importStar(require("../wormhole-messenger/init"));
function registerClassesSource(loader) {
    package_source_0.registerClasses(loader);
    package_source_1.registerClasses(loader);
    package_source_2.registerClasses(loader);
    package_source_31cc14d80c175ae39777c0238f20594c6d4869cfab199f40b69f3319956b8beb.registerClasses(loader);
    package_source_346e3233f61eb0055713417bfaddda7dc3bf26816faad1f7606994a368b92917.registerClasses(loader);
    package_source_34ae5595909bdfcd61191f6e5aabf0024250194f738b82df186fdd4fb18aa7ec.registerClasses(loader);
    package_source_4931e06dce648b3931f890035bd196920770e913e43e45990b383f6486fdd0a5.registerClasses(loader);
    package_source_4dacc15807ba7ccfcdfcc2d0498401bbf504d112a5959323660d757a02b850d4.registerClasses(loader);
    package_source_73d4d15293c2482646cdfc28c58da0f9eef64c577e9c0d2bbf614c1623346b49.registerClasses(loader);
    package_source_a2b1c8af2a4f4624362c4a7d0f91fb6b0921e780ffb2c07701901c734d75d2e3.registerClasses(loader);
    package_source_cfb3ada02ea9b40f2beb396f5f781689a2f6862d224e6c9854e175d14278f9f5.registerClasses(loader);
    package_source_f47329f4344f3bf0f8e436e2f7b485466cff300f12a166563995d3888c296a94.registerClasses(loader);
}
function registerClasses(loader) {
    registerClassesSource(loader);
}
//# sourceMappingURL=init-loader.js.map