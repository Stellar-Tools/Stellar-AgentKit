import {
  validateStellarAddress,
  validateAmount,
  validateNetwork,
  validateRequired,
  validateSwapParams,
  validateDepositParams,
  validateWithdrawParams,
  validateBridgeParams,
  validateAddresses,
} from "../validation";
import { Keypair } from "@stellar/stellar-sdk";
import {
  AgentKitError,
  ValidationError,
  InvalidAddressError,
  InvalidAmountError,
  InvalidNetworkError,
  MissingParameterError,
  NetworkError,
  isAgentKitError,
  ensureAgentKitError,
} from "../errors";
import { handleErrorSync, isRetriable } from "../errors/handlers";

describe("Error Classes", () => {
  it("creates AgentKitError with code and context", () => {
    const error = new AgentKitError("Test error", "TEST_CODE", { value: 123 }, "Try again");

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.getFormattedMessage()).toContain("TEST_CODE");
  });

  it("recognizes and wraps errors", () => {
    const akError = new AgentKitError("x", "Y");
    expect(isAgentKitError(akError)).toBe(true);
    expect(isAgentKitError(new Error("regular"))).toBe(false);

    const wrapped = ensureAgentKitError(new Error("regular"));
    expect(isAgentKitError(wrapped)).toBe(true);
  });
});

describe("Validation", () => {
  const validPublic = Keypair.random().publicKey();

  it("validates stellar public keys", () => {
    expect(validateStellarAddress(validPublic)).toBe(validPublic);
    expect(() => validateStellarAddress("invalid-address")).toThrow(InvalidAddressError);
  });

  it("validates amounts with range and decimal constraints", () => {
    expect(validateAmount("100.5")).toBe("100.5");
    expect(() => validateAmount("-1")).toThrow(InvalidAmountError);
    expect(() => validateAmount("150", { maxAmount: 100 })).toThrow(InvalidAmountError);
    expect(() => validateAmount("0", { maxAmount: 0, allowZero: true })).not.toThrow();
    expect(() => validateAmount("1.123", { decimals: 2 })).toThrow(InvalidAmountError);
  });

  it("validates network and required parameters", () => {
    expect(validateNetwork("testnet")).toBe("testnet");
    expect(validateNetwork("mainnet")).toBe("mainnet");
    expect(() => validateNetwork("foo")).toThrow(InvalidNetworkError);

    expect(() => validateRequired(undefined, "p", "op")).toThrow(MissingParameterError);
    expect(validateRequired("ok", "p", "op")).toBe("ok");
  });

  it("rejects null params objects in operation validators", () => {
    expect(() => validateSwapParams(null)).toThrow(ValidationError);
    expect(() => validateDepositParams(undefined)).toThrow(ValidationError);
    expect(() => validateWithdrawParams(null)).toThrow(ValidationError);
    expect(() => validateBridgeParams(undefined)).toThrow(ValidationError);
  });

  it("validates complete operation params", () => {
    expect(
      validateSwapParams({ to: validPublic, buyA: true, out: "10", inMax: "11" }).buyA
    ).toBe(true);

    expect(
      validateDepositParams({
        to: validPublic,
        desiredA: "10",
        minA: "9",
        desiredB: "20",
        minB: "18",
      }).to
    ).toBe(validPublic);

    expect(
      validateWithdrawParams({ to: validPublic, shareAmount: "10", minA: "1", minB: "1" }).to
    ).toBe(validPublic);

    expect(
      validateBridgeParams({ amount: "1", toAddress: validPublic }).fromNetwork
    ).toBe("stellar-testnet");
  });

  it("validates address arrays", () => {
    expect(validateAddresses([validPublic, validPublic])).toHaveLength(2);
    expect(() => validateAddresses(["bad"]))
      .toThrow(ValidationError);
  });
});

describe("Error Handlers", () => {
  it("returns result on success and error object on failure", () => {
    expect(handleErrorSync(() => "ok", { throwError: false })).toBe("ok");

    const err = handleErrorSync(
      () => {
        throw new Error("boom");
      },
      { throwError: false, returnErrorObject: true }
    );

    expect(isAgentKitError(err)).toBe(true);
  });

  it("classifies retriable errors", () => {
    expect(isRetriable(new NetworkError("network"))).toBe(true);
    expect(isRetriable(new ValidationError("validation"))).toBe(false);
  });
});
