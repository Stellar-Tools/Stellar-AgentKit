import { afterEach, describe, expect, it } from "vitest";
import { Account, Asset, Keypair, Networks } from "@stellar/stellar-sdk";
import { buildPathPaymentTransaction } from "../../../utils/buildTransaction";
import { getSigningKeypair, signTransaction } from "../../../lib/stellar";

describe("stellar signing helpers", () => {
  const previousSecret = process.env.STELLAR_PRIVATE_KEY;

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.STELLAR_PRIVATE_KEY;
      return;
    }

    process.env.STELLAR_PRIVATE_KEY = previousSecret;
  });

  it("returns the signing keypair when the secret matches the expected public key", () => {
    const keypair = Keypair.random();
    process.env.STELLAR_PRIVATE_KEY = keypair.secret();

    const signingKeypair = getSigningKeypair(keypair.publicKey());

    expect(signingKeypair.publicKey()).toBe(keypair.publicKey());
  });

  it("throws when the signing secret is missing or mismatched", () => {
    delete process.env.STELLAR_PRIVATE_KEY;
    expect(() => getSigningKeypair()).toThrow("Missing STELLAR_PRIVATE_KEY");

    const expectedKeypair = Keypair.random();
    process.env.STELLAR_PRIVATE_KEY = Keypair.random().secret();
    expect(() => getSigningKeypair(expectedKeypair.publicKey())).toThrow(
      "STELLAR_PRIVATE_KEY does not match the configured source public key"
    );
  });

  it("signs transactions with the expected source account contract", () => {
    const signer = Keypair.random();
    const destination = Keypair.random().publicKey();
    process.env.STELLAR_PRIVATE_KEY = signer.secret();

    const tx = buildPathPaymentTransaction(
      new Account(signer.publicKey(), "123"),
      {
        mode: "strict-send",
        sendAsset: Asset.native(),
        destAsset: new Asset("USD", Keypair.random().publicKey()),
        sendAmount: "10.0000000",
        destAmount: "9.5000000",
        destination,
        destMin: "9.0000000",
        path: [],
      },
      { networkPassphrase: Networks.TESTNET }
    );

    const signedXdr = signTransaction(tx.toXDR(), Networks.TESTNET, signer.publicKey());

    expect(signedXdr).toBeTypeOf("string");
    expect(signedXdr).not.toBe(tx.toXDR());
  });
});
