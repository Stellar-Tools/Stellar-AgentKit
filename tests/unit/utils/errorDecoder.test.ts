import { describe, expect, it } from "vitest";
import { decodeStellarError } from "../../../utils/errorDecoder";

describe("errorDecoder", () => {
  it("decodes Horizon error with result codes", () => {
    const error = {
      response: {
        data: {
          extras: {
            result_codes: {
              transaction: "tx_failed",
              operations: ["op_underfunded"],
            },
          },
        },
      },
    };
    const decoded = decodeStellarError(error);
    expect(decoded).toContain("The transaction failed to execute.");
    expect(decoded).toContain("Account has insufficient funds for this operation.");
  });

  it("decodes Horizon error with multiple operation failures", () => {
    const error = {
      response: {
        data: {
          extras: {
            result_codes: {
              transaction: "tx_failed",
              operations: ["op_success", "op_no_trust"],
            },
          },
        },
      },
    };
    const decoded = decodeStellarError(error);
    expect(decoded).toContain("The transaction failed to execute.");
    expect(decoded).toContain("The account is missing a trustline for the required asset.");
    expect(decoded).not.toContain("op_success");
  });

  it("handles Horizon detail message if no result codes", () => {
    const error = {
      response: {
        data: {
          detail: "The request was invalid.",
        },
      },
    };
    const decoded = decodeStellarError(error);
    expect(decoded).toBe("The request was invalid.");
  });

  it("handles Soroban FAILED status", () => {
    const error = {
      status: "FAILED",
    };
    const decoded = decodeStellarError(error);
    expect(decoded).toBe("The smart contract transaction failed.");
  });

  it("handles general error objects", () => {
    const error = new Error("Something went wrong");
    const decoded = decodeStellarError(error);
    expect(decoded).toBe("Something went wrong");
  });

  it("extracts codes from error messages", () => {
    const error = new Error("Error: op_low_reserve");
    const decoded = decodeStellarError(error);
    expect(decoded).toContain("Account does not have enough balance to meet the minimum reserve requirement.");
    expect(decoded).toContain("(op_low_reserve)");
  });

  it("handles unknown errors", () => {
    const decoded = decodeStellarError(null);
    expect(decoded).toBe("Unknown error occurred.");
    
    expect(decodeStellarError({})).toBe("[object Object]");
  });
});
