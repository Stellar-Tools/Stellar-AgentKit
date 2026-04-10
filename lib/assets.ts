import { Asset, StrKey } from "@stellar/stellar-sdk";

export type StellarAssetInput =
  | { type: "native" }
  | { code: string; issuer: string };

export function isNativeAssetInput(
  asset: StellarAssetInput
): asset is { type: "native" } {
  return (
    typeof asset === "object" &&
    asset !== null &&
    "type" in asset &&
    asset.type === "native"
  );
}

export function assetInputToSdkAsset(asset: StellarAssetInput): Asset {
  if (isNativeAssetInput(asset)) {
    return Asset.native();
  }

  if (!asset.code || !asset.issuer) {
    throw new Error("Issued assets require both code and issuer");
  }

  if (!StrKey.isValidEd25519PublicKey(asset.issuer)) {
    throw new Error(`Invalid issuer public key: ${asset.issuer}`);
  }

  return new Asset(asset.code, asset.issuer);
}

export function assetInputToHorizonAsset(asset: StellarAssetInput): string {
  return isNativeAssetInput(asset) ? "native" : `${asset.code}:${asset.issuer}`;
}
