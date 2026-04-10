import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("stellarSendPaymentTool", () => {
  const originalPublicKey = process.env.STELLAR_PUBLIC_KEY;

  beforeEach(() => {
    process.env.STELLAR_PUBLIC_KEY =
      "GDQP2KPQGKIHYJGXNUIYOMHARUARCA6LK6GITSTKOXFWUCIM5T5RZVBR";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();

    if (originalPublicKey === undefined) {
      delete process.env.STELLAR_PUBLIC_KEY;
      return;
    }

    process.env.STELLAR_PUBLIC_KEY = originalPublicKey;
  });

  it("blocks mainnet execution unless allowMainnet is enabled", async () => {
    vi.doMock("../../../lib/payments", () => ({
      sendPayment: vi.fn(),
    }));

    const { stellarSendPaymentTool } = await import("../../../tools/stellar");

    await expect(
      stellarSendPaymentTool.func({
        recipient: "GBRPYHIL2C3Z3QKYLH6N2IYVMZT7B4M4U7CUC3VQ44S2M2XNO4M6JJ74",
        amount: "10",
        network: "mainnet",
      })
    ).rejects.toThrow("allowMainnet: true is required for mainnet payments");
  });

  it("forwards asset, memo, and Horizon overrides to the payment library", async () => {
    const publicKey = process.env.STELLAR_PUBLIC_KEY!;
    const sendPayment = vi.fn().mockResolvedValue({
      hash: "payment-hash",
      network: "testnet",
      operation: "payment",
      destination: "GBRPYHIL2C3Z3QKYLH6N2IYVMZT7B4M4U7CUC3VQ44S2M2XNO4M6JJ74",
      amount: "12.5000000",
      asset: { code: "USDC", issuer: publicKey },
      memo: "invoice-7",
    });

    vi.doMock("../../../lib/payments", () => ({
      sendPayment,
    }));

    const { stellarSendPaymentTool } = await import("../../../tools/stellar");

    const result = await stellarSendPaymentTool.func({
      recipient: "GBRPYHIL2C3Z3QKYLH6N2IYVMZT7B4M4U7CUC3VQ44S2M2XNO4M6JJ74",
      amount: "12.5000000",
      asset: { code: "USDC", issuer: publicKey },
      memo: "invoice-7",
      horizonUrl: "https://custom-horizon.example",
    });

    expect(JSON.parse(result)).toEqual({
      hash: "payment-hash",
      network: "testnet",
      operation: "payment",
      destination: "GBRPYHIL2C3Z3QKYLH6N2IYVMZT7B4M4U7CUC3VQ44S2M2XNO4M6JJ74",
      amount: "12.5000000",
      asset: { code: "USDC", issuer: publicKey },
      memo: "invoice-7",
    });
    expect(sendPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        network: "testnet",
        publicKey,
        horizonUrl: "https://custom-horizon.example",
      }),
      expect.objectContaining({
        destination: "GBRPYHIL2C3Z3QKYLH6N2IYVMZT7B4M4U7CUC3VQ44S2M2XNO4M6JJ74",
        amount: "12.5000000",
        asset: { code: "USDC", issuer: publicKey },
        memo: "invoice-7",
      })
    );
  });

  it("uses mainnet defaults when explicitly allowed", async () => {
    const sendPayment = vi.fn().mockResolvedValue({
      hash: "mainnet-hash",
      network: "mainnet",
      operation: "payment",
      destination: "GBRPYHIL2C3Z3QKYLH6N2IYVMZT7B4M4U7CUC3VQ44S2M2XNO4M6JJ74",
      amount: "1",
      asset: { type: "native" },
    });

    vi.doMock("../../../lib/payments", () => ({
      sendPayment,
    }));

    const { stellarSendPaymentTool } = await import("../../../tools/stellar");

    await stellarSendPaymentTool.func({
      recipient: "GBRPYHIL2C3Z3QKYLH6N2IYVMZT7B4M4U7CUC3VQ44S2M2XNO4M6JJ74",
      amount: "1",
      network: "mainnet",
      allowMainnet: true,
    });

    expect(sendPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        network: "mainnet",
        horizonUrl: "https://horizon.stellar.org",
      }),
      expect.objectContaining({
        destination: "GBRPYHIL2C3Z3QKYLH6N2IYVMZT7B4M4U7CUC3VQ44S2M2XNO4M6JJ74",
        amount: "1",
      })
    );
  });
});
