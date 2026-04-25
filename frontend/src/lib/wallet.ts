import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk";
import { defaultModules } from "@creit-tech/stellar-wallets-kit/modules/utils";

export function initKit(): void {
  StellarWalletsKit.init({ modules: defaultModules() });
}

export { StellarWalletsKit };
