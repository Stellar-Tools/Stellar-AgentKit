import { afterEach, describe, expect, it, vi } from "vitest";
import { Account, Keypair } from "@stellar/stellar-sdk";
import { sendPayment } from "../../../lib/payments";

describe("sendPayment", () => {
  const originalSecret = process.env.STELLAR_PRIVATE_KEY;

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalSecret === undefined) {
      delete process.env.STELLAR_PRIVATE_KEY;
      return;
    }

    process.env.STELLAR_PRIVATE_KEY = originalSecret;
  });

  it("submits a standard native payment to an existing destination", async () => {
    const signer = Keypair.random();
    const destination = Keypair.random().publicKey();
    process.env.STELLAR_PRIVATE_KEY = signer.secret();

    const submitTransaction = vi.fn().mockResolvedValue({ hash: "payment-hash" });
    const loadAccount = vi.fn(async (publicKey: string) => {
      if (publicKey === signer.publicKey()) {
        return new Account(publicKey, "123");
      }

      return new Account(publicKey, "456");
    });

    const result = await sendPayment(
      {
        network: "testnet",
        horizonUrl: "https://horizon-testnet.stellar.org",
        publicKey: signer.publicKey(),
      },
      {
        destination,
        amount: "10.5000000",
      },
      {
        createServer: () => ({
          loadAccount,
          submitTransaction,
        }),
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        hash: "payment-hash",
        operation: "payment",
        destination,
        amount: "10.5000000",
        asset: { type: "native" },
      })
    );
    expect(loadAccount).toHaveBeenCalledWith(signer.publicKey());
    expect(loadAccount).toHaveBeenCalledWith(destination);
    expect(submitTransaction).toHaveBeenCalledTimes(1);
  });

  it("creates a new account when sending native XLM to an unfunded address", async () => {
    const signer = Keypair.random();
    const destination = Keypair.random().publicKey();
    process.env.STELLAR_PRIVATE_KEY = signer.secret();

    const submitTransaction = vi.fn().mockResolvedValue({ hash: "create-account-hash" });
    const loadAccount = vi.fn(async (publicKey: string) => {
      if (publicKey === signer.publicKey()) {
        return new Account(publicKey, "123");
      }

      throw { response: { status: 404 } };
    });

    const result = await sendPayment(
      {
        network: "testnet",
        horizonUrl: "https://horizon-testnet.stellar.org",
        publicKey: signer.publicKey(),
      },
      {
        destination,
        amount: "2.0000000",
      },
      {
        createServer: () => ({
          loadAccount,
          submitTransaction,
        }),
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        hash: "create-account-hash",
        operation: "create-account",
        destination,
      })
    );
    expect(submitTransaction).toHaveBeenCalledTimes(1);
  });

  it("blocks issued-asset payments when the destination lacks the trustline", async () => {
    const signer = Keypair.random();
    const destination = Keypair.random().publicKey();
    const issuer = Keypair.random().publicKey();
    process.env.STELLAR_PRIVATE_KEY = signer.secret();

    const loadAccount = vi.fn(async (publicKey: string) => {
      if (publicKey === signer.publicKey()) {
        return new Account(publicKey, "123");
      }

      return {
        ...new Account(publicKey, "456"),
        balances: [{ asset_type: "native" }],
      };
    });

    await expect(
      sendPayment(
        {
          network: "testnet",
          horizonUrl: "https://horizon-testnet.stellar.org",
          publicKey: signer.publicKey(),
        },
        {
          destination,
          amount: "5",
          asset: {
            code: "USDC",
            issuer,
          },
        },
        {
          createServer: () => ({
            loadAccount,
            submitTransaction: vi.fn(),
          }),
        }
      )
    ).rejects.toThrow("Destination account does not trust the requested asset");
  });

  it("allows issued-asset payments when the destination already trusts the asset", async () => {
    const signer = Keypair.random();
    const destination = Keypair.random().publicKey();
    const issuer = Keypair.random().publicKey();
    process.env.STELLAR_PRIVATE_KEY = signer.secret();

    const submitTransaction = vi.fn().mockResolvedValue({ hash: "asset-payment-hash" });
    const loadAccount = vi.fn(async (publicKey: string) => {
      if (publicKey === signer.publicKey()) {
        return new Account(publicKey, "123");
      }

      return {
        ...new Account(publicKey, "456"),
        balances: [
          { asset_type: "native" },
          {
            asset_type: "credit_alphanum4",
            asset_code: "USDC",
            asset_issuer: issuer,
          },
        ],
      };
    });

    const result = await sendPayment(
      {
        network: "testnet",
        horizonUrl: "https://horizon-testnet.stellar.org",
        publicKey: signer.publicKey(),
      },
      {
        destination,
        amount: "5.2500000",
        asset: {
          code: "USDC",
          issuer,
        },
        memo: "invoice-42",
      },
      {
        createServer: () => ({
          loadAccount,
          submitTransaction,
        }),
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        hash: "asset-payment-hash",
        operation: "payment",
        memo: "invoice-42",
        asset: {
          code: "USDC",
          issuer,
        },
      })
    );
    expect(submitTransaction).toHaveBeenCalledTimes(1);
  });

  it("validates amount precision and memo size before building a transaction", async () => {
    const signer = Keypair.random();
    const destination = Keypair.random().publicKey();
    process.env.STELLAR_PRIVATE_KEY = signer.secret();

    await expect(
      sendPayment(
        {
          network: "testnet",
          horizonUrl: "https://horizon-testnet.stellar.org",
          publicKey: signer.publicKey(),
        },
        {
          destination,
          amount: "1.12345678",
        },
        {
          createServer: () => ({
            loadAccount: vi.fn(),
            submitTransaction: vi.fn(),
          }),
        }
      )
    ).rejects.toThrow("Amount cannot have more than 7 decimal places");

    await expect(
      sendPayment(
        {
          network: "testnet",
          horizonUrl: "https://horizon-testnet.stellar.org",
          publicKey: signer.publicKey(),
        },
        {
          destination,
          amount: "1",
          memo: "12345678901234567890123456789",
        },
        {
          createServer: () => ({
            loadAccount: vi.fn(),
            submitTransaction: vi.fn(),
          }),
        }
      )
    ).rejects.toThrow("Memo must be 28 bytes or fewer");
  });
});
