import { beforeEach, describe, expect, it, vi } from "vitest";
import { Account, Keypair, Networks } from "@stellar/stellar-sdk";
import { swapBestRoute } from "../../lib/dex";

vi.mock("../../lib/stellar", async () => {
  const actual = await vi.importActual<typeof import("../../lib/stellar")>(
    "../../lib/stellar"
  );

  return {
    ...actual,
    signTransaction: vi.fn((xdr: string) => xdr),
  };
});

const issuerA = Keypair.random().publicKey();
const issuerB = Keypair.random().publicKey();
const sourceKeypair = Keypair.random();
const publicKey = sourceKeypair.publicKey();

function quoteResponse(sourceAmount: string, destinationAmount: string) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      _embedded: {
        records: [
          {
            source_asset_type: "credit_alphanum4",
            source_asset_code: "USD",
            source_asset_issuer: issuerA,
            source_amount: sourceAmount,
            destination_asset_type: "credit_alphanum4",
            destination_asset_code: "EUR",
            destination_asset_issuer: issuerB,
            destination_amount: destinationAmount,
            path: [{ asset_type: "native" }],
          },
        ],
      },
    }),
  };
}

function destinationAccountResponse() {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      balances: [
        {
          asset_type: "credit_alphanum4",
          asset_code: "EUR",
          asset_issuer: issuerB,
        },
      ],
    }),
  };
}

describe("dex workflow", () => {
  beforeEach(() => {
    process.env.STELLAR_PRIVATE_KEY = sourceKeypair.secret();
  });

  it("executes a strict-send best-route swap on testnet", async () => {
    let submittedTx: any;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(destinationAccountResponse())
      .mockResolvedValueOnce(quoteResponse("10.0000000", "12.0000000"));
    const createServer = vi.fn().mockReturnValue({
      loadAccount: vi.fn().mockResolvedValue(new Account(publicKey, "123")),
      submitTransaction: vi.fn().mockImplementation(async (tx: any) => {
        submittedTx = tx;
        return { hash: "hash-testnet" };
      }),
    });

    const result = await swapBestRoute(
      {
        network: "testnet",
        horizonUrl: "https://horizon-testnet.stellar.org",
        publicKey,
      },
      {
        mode: "strict-send",
        sendAsset: { code: "USD", issuer: issuerA },
        destAsset: { code: "EUR", issuer: issuerB },
        sendAmount: "10.0000000",
      },
      { fetchImpl, createServer }
    );

    expect(result.hash).toBe("hash-testnet");
    expect(result.destAmount).toBe("12.0000000");
    expect(result.path).toEqual([{ type: "native" }]);
    expect(submittedTx.networkPassphrase).toBe(Networks.TESTNET);
  });

  it("executes a strict-receive best-route swap on mainnet", async () => {
    let submittedTx: any;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(destinationAccountResponse())
      .mockResolvedValueOnce(quoteResponse("9.8000000", "9.5000000"));
    const createServer = vi.fn().mockReturnValue({
      loadAccount: vi.fn().mockResolvedValue(new Account(publicKey, "123")),
      submitTransaction: vi.fn().mockImplementation(async (tx: any) => {
        submittedTx = tx;
        return { hash: "hash-mainnet" };
      }),
    });

    const result = await swapBestRoute(
      {
        network: "mainnet",
        horizonUrl: "https://horizon.stellar.org",
        publicKey,
      },
      {
        mode: "strict-receive",
        sendAsset: { code: "USD", issuer: issuerA },
        destAsset: { code: "EUR", issuer: issuerB },
        destAmount: "9.5000000",
      },
      { fetchImpl, createServer }
    );

    expect(result.hash).toBe("hash-mainnet");
    expect(result.sendAmount).toBe("9.8000000");
    expect(submittedTx.networkPassphrase).toBe(Networks.PUBLIC);
  });

  it("fails fast when no route exists", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(destinationAccountResponse())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ _embedded: { records: [] } }),
      });

    await expect(
      swapBestRoute(
        {
          network: "testnet",
          horizonUrl: "https://horizon-testnet.stellar.org",
          publicKey,
        },
        {
          mode: "strict-send",
          sendAsset: { code: "USD", issuer: issuerA },
          destAsset: { code: "EUR", issuer: issuerB },
          sendAmount: "10.0000000",
        },
        { fetchImpl }
      )
    ).rejects.toThrow("No route available");
  });

  it("surfaces destination trustline-style submission failures", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(destinationAccountResponse())
      .mockResolvedValueOnce(quoteResponse("10.0000000", "12.0000000"));
    const createServer = vi.fn().mockReturnValue({
      loadAccount: vi.fn().mockResolvedValue(new Account(publicKey, "123")),
      submitTransaction: vi.fn().mockRejectedValue(new Error("PATH_PAYMENT_STRICT_SEND_NO_TRUST")),
    });

    await expect(
      swapBestRoute(
        {
          network: "testnet",
          horizonUrl: "https://horizon-testnet.stellar.org",
          publicKey,
        },
        {
          mode: "strict-send",
          sendAsset: { code: "USD", issuer: issuerA },
          destAsset: { code: "EUR", issuer: issuerB },
          sendAmount: "10.0000000",
        },
        { fetchImpl, createServer }
      )
    ).rejects.toThrow("PATH_PAYMENT_STRICT_SEND_NO_TRUST");
  });

  it("fails before submission when signer does not match the configured source account", async () => {
    process.env.STELLAR_PRIVATE_KEY = Keypair.random().secret();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(destinationAccountResponse())
      .mockResolvedValueOnce(quoteResponse("10.0000000", "12.0000000"));
    const createServer = vi.fn().mockReturnValue({
      loadAccount: vi.fn(),
      submitTransaction: vi.fn(),
    });

    await expect(
      swapBestRoute(
        {
          network: "testnet",
          horizonUrl: "https://horizon-testnet.stellar.org",
          publicKey,
        },
        {
          mode: "strict-send",
          sendAsset: { code: "USD", issuer: issuerA },
          destAsset: { code: "EUR", issuer: issuerB },
          sendAmount: "10.0000000",
        },
        { fetchImpl, createServer }
      )
    ).rejects.toThrow("STELLAR_PRIVATE_KEY does not match the configured source public key");

    expect(createServer).not.toHaveBeenCalled();
  });
});
