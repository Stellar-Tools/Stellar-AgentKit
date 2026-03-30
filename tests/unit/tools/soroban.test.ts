import { describe, it, expect, vi, beforeEach } from "vitest";
import { stellarGenericSorobanCallTool } from "../../../tools/soroban";
import { SorobanClient } from "../../../lib/soroban";

vi.mock("../../../lib/soroban", () => {
  return {
    SorobanClient: vi.fn().mockImplementation(() => ({
      call: vi.fn().mockResolvedValue("mocked_result"),
    })),
  };
});

describe("stellar_generic_soroban_call", () => {
  const mockConfig = {
    caller: "GABC...",
    contractId: "CDEF...",
    functionName: "hello",
    args: ["world"],
    operationType: "other" as const,
  };

  it("should successfully call a soroban function", async () => {
    const result = await stellarGenericSorobanCallTool.func(mockConfig);
    const parsed = JSON.parse(result);
    
    expect(parsed.status).toBe("success");
    expect(parsed.result).toBe("mocked_result");
  });

  it("should handle errors gracefully", async () => {
    // Force SorobanClient to throw an error
    vi.mocked(SorobanClient).mockImplementationOnce(() => ({
        call: vi.fn().mockRejectedValue(new Error("Call failed")),
    } as any));

    const result = await stellarGenericSorobanCallTool.func(mockConfig);
    const parsed = JSON.parse(result);
    
    expect(parsed.status).toBe("error");
    expect(parsed.message).toBe("Call failed");
  });
});
