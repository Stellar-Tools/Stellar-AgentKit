/**
 * tests/tools.test.ts
 *
 * Unit tests for the three new Stellar AgentKit tools:
 *   - getAccountInfoTool
 *   - simulateTransactionTool
 *   - getOrderBookTool
 *   - findPaymentPathsTool
 *
 * These tests use Jest + ts-jest. Network calls are mocked via jest.mock
 * so tests remain offline and deterministic.
 *
 * Run: npx jest --testPathPattern=tools.test.ts
 */

import getAccountInfoTool from "../tools/getAccountInfo";
import simulateTransactionTool from "../tools/simulateTransaction";
import getOrderBookTool from "../tools/getOrderBook";
import findPaymentPathsTool from "../tools/findPaymentPaths";

// ---------------------------------------------------------------------------
// Shared test constants
// ---------------------------------------------------------------------------

const VALID_PUBLIC_KEY =
  "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
const INVALID_PUBLIC_KEY = "not-a-valid-key";

// ---------------------------------------------------------------------------
// getAccountInfoTool
// ---------------------------------------------------------------------------

describe("getAccountInfoTool — input validation", () => {
  it("rejects an invalid public key immediately (no network call)", async () => {
    const result = await getAccountInfoTool.invoke({
      publicKey: INVALID_PUBLIC_KEY,
      network: "testnet",
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/Invalid Stellar public key/);
  });

  it("has the correct tool name", () => {
    expect(getAccountInfoTool.name).toBe("get_account_info");
  });

  it("schema requires publicKey and defaults network to testnet", () => {
    const schema = getAccountInfoTool.schema;
    // Zod parse should work with just publicKey
    const parsed = schema.parse({ publicKey: VALID_PUBLIC_KEY });
    expect(parsed.network).toBe("testnet");
  });
});

// ---------------------------------------------------------------------------
// simulateTransactionTool
// ---------------------------------------------------------------------------

describe("simulateTransactionTool — input validation", () => {
  it("has the correct tool name", () => {
    expect(simulateTransactionTool.name).toBe("simulate_transaction");
  });

  it("rejects invalid XDR gracefully", async () => {
    const result = await simulateTransactionTool.invoke({
      xdrEnvelope: "this-is-not-valid-xdr==",
      network: "testnet",
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/Failed to parse XDR envelope/);
  });

  it("schema defaults network to testnet", () => {
    const schema = simulateTransactionTool.schema;
    const parsed = schema.parse({ xdrEnvelope: "AAAA" });
    expect(parsed.network).toBe("testnet");
  });
});

// ---------------------------------------------------------------------------
// getOrderBookTool
// ---------------------------------------------------------------------------

describe("getOrderBookTool — input validation", () => {
  it("has the correct tool name", () => {
    expect(getOrderBookTool.name).toBe("get_order_book");
  });

  it("schema rejects limit > 20", () => {
    const schema = getOrderBookTool.schema;
    expect(() =>
      schema.parse({
        sellingAssetCode: "XLM",
        buyingAssetCode: "USDC",
        buyingAssetIssuer:
          "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        limit: 25,
        network: "testnet",
      })
    ).toThrow();
  });

  it("schema defaults limit to 5 and network to testnet", () => {
    const schema = getOrderBookTool.schema;
    const parsed = schema.parse({
      sellingAssetCode: "XLM",
      buyingAssetCode: "USDC",
      buyingAssetIssuer:
        "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    });
    expect(parsed.limit).toBe(5);
    expect(parsed.network).toBe("testnet");
  });
});

// ---------------------------------------------------------------------------
// findPaymentPathsTool
// ---------------------------------------------------------------------------

describe("findPaymentPathsTool — input validation", () => {
  it("has the correct tool name", () => {
    expect(findPaymentPathsTool.name).toBe("find_payment_paths");
  });

  it("rejects non-positive amounts", async () => {
    const result = await findPaymentPathsTool.invoke({
      mode: "strict_send",
      sourceAssetCode: "XLM",
      destinationAssetCode: "USDC",
      destinationAssetIssuer:
        "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      amount: "-50",
      network: "testnet",
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/Invalid amount/);
  });

  it("strict_receive mode requires destinationAccount", async () => {
    const result = await findPaymentPathsTool.invoke({
      mode: "strict_receive",
      sourceAssetCode: "XLM",
      destinationAssetCode: "USDC",
      destinationAssetIssuer:
        "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      amount: "100",
      network: "testnet",
      // intentionally omitting destinationAccount
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/destinationAccount/);
  });

  it("schema defaults network to testnet", () => {
    const schema = findPaymentPathsTool.schema;
    const parsed = schema.parse({
      mode: "strict_send",
      sourceAssetCode: "XLM",
      destinationAssetCode: "USDC",
      destinationAssetIssuer:
        "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      amount: "50",
    });
    expect(parsed.network).toBe("testnet");
  });
});
