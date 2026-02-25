# Next Steps (Project Planning)

Follow-up work that can be done gradually.

---

## 1. Tests ✅

- **Integration tests (testnet):** `tests/integration.test.ts` — runs `lp.getReserves()` / `lp.getShareId()` when `STELLAR_PUBLIC_KEY` is set (skips in CI with dummy key).
- **Error scenario tests:** `tests/error-scenarios.test.ts` — mainnet guard, invalid `to` address for swap, testnet with allowMainnet.

## 2. CI / Automation ✅

- **GitHub Actions:** Already added (`.github/workflows/ci.yml`). Runs build, test, and `pnpm run docs:generate`.

## 3. Documentation ✅

- **README:** Error handling and API reference sections added.
- **Error contract:** `docs/api.md` now includes a table of which method throws and when (constructor mainnet guard, invalid address, contract/RPC, bridge).

## 4. Optional

- **launchToken issuer lock:** Set auth required on issuer (SetOptions).
- **Mainnet token issuance env:** Document `ALLOW_MAINNET_TOKEN_ISSUANCE` if applicable.
