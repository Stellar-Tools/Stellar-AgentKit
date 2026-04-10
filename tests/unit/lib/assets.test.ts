import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { assetInputToSdkAsset, isNativeAssetInput } from "../../../lib/assets";

describe("asset helpers", () => {
  const issuer = Keypair.random().publicKey();

  it("recognizes only an explicit native discriminator", () => {
    expect(isNativeAssetInput({ type: "native" })).toBe(true);
    expect(
      isNativeAssetInput({ type: "credit_alphanum4", code: "USD", issuer } as never)
    ).toBe(false);
    expect(isNativeAssetInput({ code: "USD", issuer } as never)).toBe(false);
  });

  it("does not misclassify malformed issued assets as native", () => {
    expect(() =>
      assetInputToSdkAsset({ type: "credit_alphanum4" } as never)
    ).toThrow("Issued assets require both code and issuer");
  });
});
