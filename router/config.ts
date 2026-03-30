// router/config.ts
import { Networks } from "@stellar/stellar-sdk";
import type { NetworkConfig } from "./types";

// Soroswap factory addresses
const SOROSWAP_FACTORY_TESTNET = "CDKDFC5YCQPC7EQLPH34ZS2T6VXYMSMB44BCZPIQJYP3TLNMAO7MN7D";
const SOROSWAP_FACTORY_MAINNET = "CA4HEQTL2WPEUYKYKCDOSMKN3FKHBPS4OFE73CFCMZDOX7WEN4JQK3C";

// Phoenix factory addresses
const PHOENIX_FACTORY_TESTNET = "CB4SVAWJA6TSRNOJZ7O2TGAZ2C5OHPEQLPVHQKDX3SAVKM4LCABTFKV";
const PHOENIX_FACTORY_MAINNET = "CB4SVAWJA6TSRNOJZ7O2TGAZ2C5OHPEQLPVHQKDX3SAVKM4LCABTFKV";

export const MAINNET_CONFIG: NetworkConfig = {
  rpcUrl: "https://soroban.stellar.org",
  horizonUrl: "https://horizon.stellar.org",
  networkPassphrase: Networks.PUBLIC,
  soroswapFactory: SOROSWAP_FACTORY_MAINNET,
  phoenixFactory: PHOENIX_FACTORY_MAINNET,
};

export const TESTNET_CONFIG: NetworkConfig = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: Networks.TESTNET,
  soroswapFactory: SOROSWAP_FACTORY_TESTNET,
  phoenixFactory: PHOENIX_FACTORY_TESTNET,
};

export function getNetworkConfig(network: "testnet" | "mainnet"): NetworkConfig {
  return network === "mainnet" ? MAINNET_CONFIG : TESTNET_CONFIG;
}
