import { describe, expect, it } from "vitest";
import { Account, Asset, Keypair, Networks } from "@stellar/stellar-sdk";
import { buildPathPaymentTransaction } from "../../../utils/buildTransaction";

describe("buildPathPaymentTransaction", () => {
  const sourceAccount = new Account(Keypair.random().publicKey(), "123");
  const issuerA = Keypair.random().publicKey();
  const issuerB = Keypair.random().publicKey();

  it("builds a strict-send path payment transaction", () => {
    const tx = buildPathPaymentTransaction(
      sourceAccount,
      {
        mode: "strict-send",
        sendAsset: new Asset("USD", issuerA),
        destAsset: new Asset("EUR", issuerB),
        sendAmount: "10.0000000",
        destAmount: "12.0000000",
        destination: Keypair.random().publicKey(),
        destMin: "11.8800000",
        path: [Asset.native()],
      },
      { networkPassphrase: Networks.TESTNET }
    );

    expect(tx.networkPassphrase).toBe(Networks.TESTNET);
    expect(tx.operations).toHaveLength(1);
    expect(tx.toXDR()).toBeTypeOf("string");
  });

  it("builds a strict-receive path payment transaction", () => {
    const tx = buildPathPaymentTransaction(
      sourceAccount,
      {
        mode: "strict-receive",
        sendAsset: Asset.native(),
        destAsset: new Asset("EUR", issuerB),
        sendAmount: "10.0000000",
        destAmount: "9.5000000",
        destination: Keypair.random().publicKey(),
        sendMax: "10.1000000",
        path: [new Asset("USD", issuerA)],
      },
      { networkPassphrase: Networks.PUBLIC }
    );

    expect(tx.networkPassphrase).toBe(Networks.PUBLIC);
    expect(tx.operations).toHaveLength(1);
    expect(tx.toXDR()).toBeTypeOf("string");
  });

  it("requires mode-specific swap bounds", () => {
    expect(() =>
      buildPathPaymentTransaction(
        sourceAccount,
        {
          mode: "strict-send",
          sendAsset: Asset.native(),
          destAsset: new Asset("EUR", issuerB),
          sendAmount: "10.0000000",
          destAmount: "9.5000000",
          destination: Keypair.random().publicKey(),
          path: [],
        },
        { networkPassphrase: Networks.TESTNET }
      )
    ).toThrow("destMin is required");

    expect(() =>
      buildPathPaymentTransaction(
        sourceAccount,
        {
          mode: "strict-receive",
          sendAsset: Asset.native(),
          destAsset: new Asset("EUR", issuerB),
          sendAmount: "10.0000000",
          destAmount: "9.5000000",
          destination: Keypair.random().publicKey(),
          path: [],
        },
        { networkPassphrase: Networks.TESTNET }
      )
    ).toThrow("sendMax is required");
  });
});
