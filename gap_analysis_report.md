# Stellar AgentKit Gap Analysis Report

## Part 1: Tool Analysis (`tools/` directory)

### 1. `bridge.ts` (`bridgeTokenTool`)
- **Action/Wrap**: Bridges tokens from Stellar (mainnet/testnet) to EVM compatible chains using AllbridgeCoreSdk.
- **Zod Schema**: 
  ```typescript
  z.object({
    amount: z.string().describe("The amount of tokens to bridge"),
    toAddress: z.string().describe("The destination address"),
    fromNetwork: z
      .enum(["stellar-testnet", "stellar-mainnet"])
      .default("stellar-testnet")
      .describe("Source Stellar network"),
  })
  ```
- **Try/Catch Exists**: **No** top-level `try/catch` in the `func`.
- **Error Typing**: Any errors thrown by `AllbridgeCoreSdk` or Stellar operations will bubble up as raw, untyped errors to the caller. Explicit manual throws just use standard strings.
- **Pre-SDK Validation**: Minimal. It validates runtime safety by checking `process.env.ALLOW_MAINNET_BRIDGE` but lacks proactive valid EVM address validation or `amount` parsing before executing SDK chains.

### 2. `contract.ts` (`StellarLiquidityContractTool`)
- **Action/Wrap**: Interacts with a liquidity AMM contract on Stellar Soroban (actions: `get_share_id`, `deposit`, `swap`, `withdraw`, `get_reserves`).
- **Zod Schema**:
  ```typescript
  z.object({
    action: z.enum(["get_share_id", "deposit", "swap", "withdraw", "get_reserves"]),
    to: z.string().optional(),
    desiredA: z.string().optional(),
    minA: z.string().optional(),
    desiredB: z.string().optional(),
    minB: z.string().optional(),
    buyA: z.boolean().optional(),
    out: z.string().optional(),
    inMax: z.string().optional(),
    shareAmount: z.string().optional(),
  })
  ```
- **Try/Catch Exists**: **Yes**
- **Error Typing**: Typed as `error: any` in the catch block (`error.message` is extracted).
- **Pre-SDK Validation**: Within the `switch(action)`, there are manual `if/throw` blocks asserting requisite params exist, but weak input validation occurs prior to schema parsing (all inputs blindly take strings without strict address validation).

### 3. `stake.ts` (`StellarContractTool`)
- **Action/Wrap**: Interacts with a staking contract on Stellar Soroban (actions: `initialize`, `stake`, `unstake`, `claim_rewards`, `get_stake`).
- **Zod Schema**:
  ```typescript
  z.object({
    action: z.enum(["initialize", "stake", "unstake", "claim_rewards", "get_stake"]),
    tokenAddress: z.string().optional(),
    rewardRate: z.number().optional(),
    amount: z.number().optional(),
    userAddress: z.string().optional(),
  })
  ```
- **Try/Catch Exists**: **Yes**
- **Error Typing**: Typed as `error: any` securely in a wrapper.
- **Pre-SDK Validation**: Like above, checks `undefined` state for target arguments inside a JS switch condition. No cryptographically secure formatting checks prior to execution.

### 4. `stellar.ts` (`stellarSendPaymentTool`)
- **Action/Wrap**: Sends a standard payment (XLM native asset) on the Stellar network.
- **Zod Schema**:
  ```typescript
  z.object({
    recipient: z.string().describe("The Stellar address to send to"),
    amount: z.string().describe("The amount of XLM to send (as a string)"),
  })
  ```
- **Try/Catch Exists**: **Yes**
- **Error Typing**: Intelligently typed through fallback object casting: `(error as { response?: { data?: { title?: string } }; message?: string })`.
- **Pre-SDK Validation**: Very strong. It explicitly asserts `StellarSdk.StrKey.isValidEd25519PublicKey(recipient)` and verifies computational bounds `!amount || isNaN(Number(amount)) || Number(amount) <= 0` prior to any SDK calls.

---

## Part 2: Critical Gap Analysis

### 1. Every tool that has no try/catch
- `bridgeTokenTool` (`tools/bridge.ts`) does not encapsulate its complex multi-step cross-chain logic inside a `try/catch` block, guaranteeing SDK errors halt flow unexpectedly.

### 2. Every tool with missing or weak Zod validation
- `bridgeTokenTool` (`bridge.ts`): No `z.string().regex()` matches to enforce valid EVM `toAddress` formats or parsing bounds for `amount`.
- `StellarLiquidityContractTool` (`contract.ts`) & `StellarContractTool` (`stake.ts`): Huge structural vulnerability. They use a monolithic catch-all schema where every sub-argument across all actions is arbitrarily `.optional()`, relying purely on JavaScript boilerplate validation.

### 3. Every tool in README not yet in tools/
- **None missing**. All functionality explicitly advertised in the README (`Swap`, `Bridge`, and `LP operations`) exists efficiently in the tooling architecture (`bridge.ts` and `contract.ts`).

### 4. All TypeScript errors from `tsc`
Issuing `npx tsc --noEmit` yielded 7 errors spanning 3 files:
1. `agent.ts:10:3` - `error TS2614: Module '"@stellar/stellar-sdk"' has no exported member 'Server'. Did you mean to use 'import Server from "@stellar/stellar-sdk"' instead?`
2. `agent.ts:240:33` - `error TS2367: This comparison appears to be unintentional because the types '"testnet"' and '"mainnet"' have no overlap.`
3. `agent.ts:359:36` - `error TS7006: Parameter 'balance' implicitly has an 'any' type.`
4. `examples/token-launch-example.ts:62:19` - `error TS18046: 'error' is of type 'unknown'.`
5. `examples/token-launch-example.ts:100:19` - `error TS18046: 'error' is of type 'unknown'.`
6. `tests/unit/tools/bridge.test.ts:60:64` - `error TS2367: This comparison appears to be unintentional because the types '"false"' and '"true"' have no overlap.`
7. `tests/unit/tools/bridge.test.ts:76:27` - `error TS2367: This comparison appears to be unintentional because the types '"stellar-testnet"' and '"stellar-mainnet"' have no overlap.`

### 5. Whether there is a test suite at all
- **Yes.** The agent integrates a fully functioning `vitest` suite. Output yields `5 passed (5), Tests 28 passed (28)`.

### 6. The 3 highest-impact contributions possible
1. **Refactor Zod Schemas into Discriminated Unions:**
   - Overhaul `contract.ts` and `stake.ts` schemas from amorphous grids of `.optional()` fields into runtime-safe discriminated unions based on the `action` variant. This provides LLMs 100% rigid interfaces to interface flawlessly against.
2. **Resolve Global TypeScript Bleeding & Build Failure:**
   - Resolve the compile-time breakages. Fixing `@stellar/stellar-sdk` Server imports and repairing impossible boolean/enum tests means AgentKit integrates correctly in typed deployment pipelines.
3. **Overhaul the Bridge Tool Exception Handling Pipeline:**
   - As cross-chain operations entail extreme failure rates, retrofitting `bridgeTokenTool` with an all-encompassing `try/catch` and highly typed error objects mapping specific ALLBRIDGE faults saves devastating crashes down the line.
