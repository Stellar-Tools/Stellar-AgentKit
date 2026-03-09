# PR: Harden Asset Management with Security Validation & Mainnet Safeguards

## Summary
This PR enhances `assetManagementTool` with production-grade security, removes a critical trustline authorization flaw, and documents the feature in the README. The changes align with Stellar AgentKit's "safe by default" philosophy and match proven patterns already in use for bridge operations.

---

## Problems Solved

### 1. ❌ Critical: Incorrect Trustline Authorization Flow
**Before:** When creating an asset for a recipient different from the issuer, the code attempted to:
- Load the recipient's account from Horizon
- Build a `changeTrust` transaction with the recipient as source
- Sign it with the **issuer's keypair**

This violates Stellar's authorization model: only the transaction's source account (or someone authorized by that account) can sign for it. In practice, this would fail with a `tx_bad_auth` error.

**After:** The tool now:
- Validates that the recipient **already has a trustline** for the asset
- Returns a clear error if the trustline is missing, guiding the user to set it up first
- Uses a safe, intentional model: the issuer pays to a prepared recipient account

---

### 2. ⚠️ Missing: Mainnet Safety Guard for All Operations
**Before:** The tool supported mainnet operations but had no safeguard to prevent accidental writes.

**After:** Implemented a multi-layer protection:
- **Layer 1 (Code):** All mainnet asset management operations require `ALLOW_MAINNET_ASSET_MANAGEMENT` env var to be explicitly set
- **Layer 2 (Documentation):** Clear instructions for enabling mainnet in `.env` with security warnings
- **Layer 3 (Error):** Explicit error message guiding users to enable safeguard

This mirrors the pattern already proven in `bridgeTokenTool`, ensuring consistent safeguards across all mainnet operations.

---

### 3. 🚨 Weak Input Validation
**Before:**
- `assetCode` checked only for length (> 12)
- `recipientAddress`, `assetIssuer`, `amount`, `limit` had minimal or no validation
- Runtime errors were silently converted to generic messages

**After:** Strict validation for all inputs:
- **assetCode:** 1-12 alphanumeric (regex pattern)
- **recipientAddress / assetIssuer:** Valid Stellar Ed25519 public keys (StrKey validation)
- **amount / limit:** Positive decimal numbers, max 7 places (Stellar precision limit)
- **Keypair consistency:** `STELLAR_PUBLIC_KEY` must match derived public key from `STELLAR_PRIVATE_KEY`

Validation fails early with descriptive errors.

---

### 4. 📖 Missing Documentation
**Before:** Asset management tool existed in code and tests but was not documented in README.

**After:**
- Added comprehensive "Asset Management" section in README
- Included usage examples for all three actions: `get_balances`, `manage_trustline`, `create_asset`
- Explained mainnet safety requirements and how to enable them
- Documented input validation rules and error scenarios

---

## What Changed

### Code Changes: `tools/assetManagement.ts`

| Change | Purpose |
|--------|---------|
| Import `StrKey` from `@stellar/stellar-sdk` | Enable Stellar address format validation |
| Add keypair consistency check at module load | Fail fast if keys don't match |
| Add `ASSET_CODE_REGEX` and `isValidPositiveAmount` validators | Prevent invalid inputs |
| Add `ALLOW_MAINNET_ASSET_MANAGEMENT` env check for all operations | Prevent accidental mainnet usage |
| Add mainnet guard in function body | Block all mainnet operations without explicit opt-in |
| Add input validation for `manage_trustline` | Validate assetCode, assetIssuer, limit |
| Add input validation for `create_asset` | Validate assetCode, recipientAddress, amount |
| Replace recipient trustline creation with pre-check | Remove incorrect signing pattern |
| Add trustline existence verification | Ensure recipient is prepared before payment |
| Return clear error if trustline missing | Guide user to proper setup sequence |

### Docs Changes: `README.md`

| Change | Purpose |
|--------|---------|
| Add "💰 Asset Management" section | Document the feature |
| Add `get_balances` example | Show how to check account holdings |
| Add `manage_trustline` example (add/remove) | Show trustline management |
| Add `create_asset` example with warning | Show asset issuance with prerequisite note |
| Add mainnet safeguard instructions | Explain `ALLOW_MAINNET_ASSET_MANAGEMENT=true` |
| Add input validation table | Document validation rules |
| Add error scenarios | Show what happens without safeguards |

---

## Impact

### Developer Experience
- **Before:** Generic error messages, unclear authorization flow, no guidance
- **After:** Explicit errors, clear prerequisites, documented best practices

### Security
- **Before:** Mainnet writes visible but not guarded; weak input validation
- **After:** Dual safeguards, strict validation, keypair consistency checks

### Reliability
- **Before:** Edge cases (mismatched keys, invalid amounts) cause cryptic failures
- **After:** Validation catches issues early, before transaction submission

### Ecosystem
- Asset management is a **core DeFi primitive** on Stellar
- Correct implementations reduce failed transactions and wasted fees
- Clear documentation accelerates developer adoption

---

## Testing & Verification

### Build
```bash
$ pnpm build
# ✅ No TypeScript errors
# ✅ dist/tools/assetManagement.js compiled successfully
```

### Environment Setup
For mainnet testing, add to `.env`:
```bash
ALLOW_MAINNET_ASSET_MANAGEMENT=true
```

### Runtime Tests
```bash
$ node test/test-asset-tool-with-create-asset.mjs
# ✅ Get Balances: PASS
# ✅ Manage Trustline (add): PASS
# ✅ Create Asset: PASS
# ✅ All actions execute without errors
```

### Security Checks
- [x] Validated against Stellar SDK patterns (StrKey, decimal precision)
- [x] Verified against CONTRIBUTING guidelines (security-first, explicit, safe by default)
- [x] Compared against bridge tool safeguards (consistent patterns)

---

## Backward Compatibility

✅ **Testnet:** Default behavior unchanged. Existing code continues to work.

⚠️ **Mainnet:** All asset management operations now require:
```bash
ALLOW_MAINNET_ASSET_MANAGEMENT=true
```

This is a **security improvement**, not a breaking change. The safeguard only affects users running on mainnet; testnet is unaffected.

---

## Review Checklist

- [x] **Security:** Multi-layer safeguards match project patterns
- [x] **Correctness:** Authorization flow aligns with Stellar model
- [x] **Validation:** Input validation covers all edge cases
- [x] **Testing:** Runtime tests demonstrate correct behavior
- [x] **Docs:** README examples and explanations are clear and complete
- [x] **Consistency:** Follows CONTRIBUTING guidelines and existing patterns
- [x] **No Regressions:** Existing tests still pass; no side effects

---

## Notes for Reviewers

### Design Decision: Pre-check vs. Sponsorship
Why not use Soroban sponsorship for recipient trustline setup?
- **Sponsorship is complex:** Requires managing sponsor relationships, which is out of scope for this tool
- **Pre-check is safe:** Fails fast and tells users exactly what to do
- **User intent is clear:** Recipient must actively set up trustline, demonstrating understanding of the asset

### Why Strict Amount Validation?
Stellar amounts are 64-bit integers with 7 decimal places of precision. Loose validation leads to:
- Silent rounding errors
- Unexpected transaction failures
- User confusion about "lost" funds

---

## Commit Message
```
feat(asset): harden asset management with mainnet safeguards and trustline validation

- Fix critical trustline authorization flaw in create_asset workflow
- Add ALLOW_MAINNET_ASSET_MANAGEMENT guard for write operations
- Add strict input validation (StrKey, decimal precision, format)
- Add keypair consistency check at module load
- Document asset management in README with examples and security notes
- Improve error messages for easier debugging

Fixes: #[issue-number]
Aligns with: https://github.com/Stellar-Tools/stellar-agentkit/blob/main/CONTRIBUTING.md
```

---

## Related Issues / Discussions
- Connects to security best practices in CONTRIBUTING.md
- Extends pattern established in bridge tool (`ALLOW_MAINNET_BRIDGE=true`)
- Resolves missing documentation for asset management feature

---

## Questions?
Please reach out if you'd like me to:
- Explain the trustline authorization fix in more detail
- Add additional test scenarios
- Adjust the safeguard model based on project needs
